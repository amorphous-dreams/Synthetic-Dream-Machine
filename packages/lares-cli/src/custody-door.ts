/**
 * custody-door — the CLI's side of the vessel's custody door: one `unlock`, `lock`, `custody`, `act` or `backup` frame on the
 * owner-only verb socket, and its one answer.
 *
 * A credential rides this frame and nothing else. A verb's arguments get hashed into a durable receipt the daemon
 * keeps; the custody frame stands ahead of every verb on the socket, so it never becomes an invocation and leaves
 * no digest, receipt or outcome behind. This module never logs what it sends.
 */
import { createConnection } from "node:net";
import type { Credential, SlotSpec } from "@lararium/mesh";
import { udsSocketPath } from "./local-connector.js";

export type CustodyFrame =
  | { readonly op: "unlock"; readonly credentials: readonly Credential[]; readonly face?: number; readonly all?: boolean }
  | { readonly op: "lock"; readonly face?: number }
  | { readonly op: "custody" }
  /** The census of saves the vessel holds in memory, read before a stop: no credential, answered at once. */
  | { readonly op: "census" }
  /** One act of the sealed-act table and its typed arguments; nothing rides beside them. */
  | { readonly op: "act"; readonly act: string; readonly args: Readonly<Record<string, unknown>> }
  /** One face's backup cut: the vessel's own route, the face's handle-index and the bundle key (64 lower hex). */
  | { readonly op: "backup"; readonly credentials: readonly Credential[]; readonly face: number; readonly key: string }
  /** The human route the next new face this vessel founds will bind (passphrase pins; one use). */
  | { readonly op: "face-route"; readonly slots: readonly SlotSpec[]; readonly purpose: "persona-new" | "bundle.restore"; readonly argsDigest: string }
  /** One ward act's route: the vessel parks it under a one-use ticket the verb names (seat-harness#/the-ward). */
  | { readonly op: "ward"; readonly credentials: readonly Credential[]; readonly verb: string; readonly argsDigest: string };

/** The daemon's answer, as the door spells it (`custody-frames` in the node package). */
export type CustodyDoorAnswer = Record<string, unknown> & { readonly op?: string };

/**
 * Send one custody frame to the vessel standing on this store. Resolves its answer, or `null` when no vessel
 * answers (no socket, a refused connect, a closed line with no answer). An unlock waits as long as the vessel
 * takes to compose again: nothing here times it out.
 */
export function sendCustodyFrame(frame: CustodyFrame, dataDir?: string | null, signal?: AbortSignal): Promise<CustodyDoorAnswer | null> {
  const path = udsSocketPath(dataDir);
  return new Promise((settle) => {
    const sock = createConnection(path);
    // A caller that stops waiting hangs up: its socket never rests open beside a vessel that cannot answer.
    signal?.addEventListener("abort", () => { sock.destroy(); settle(null); }, { once: true });
    let buf = "";
    sock.setEncoding("utf8");
    sock.once("connect", () => { sock.write(JSON.stringify(frame) + "\n"); });
    sock.on("data", (chunk: string) => { buf += chunk; });
    sock.once("error", () => settle(null));
    sock.once("close", () => {
      const line = buf.split("\n")[0] ?? "";
      if (!line) { settle(null); return; }
      try { settle(JSON.parse(line) as CustodyDoorAnswer); } catch { settle(null); }
    });
  });
}

/** What stands at the socket, as far as the custody door says. */
export type VesselStanding =
  /** A vessel's custody door answered: it holds its key, or rests locked. */
  | { readonly reading: "vessel"; readonly unlocked: boolean; /** An unlock or a lock still recomposes: the verb channel has not stood yet. */ readonly composing: boolean }
  /** Something accepted the connection and gave no answer inside the wait: a holder nobody can name. */
  | { readonly reading: "silent" }
  /** No custody door answers: nothing listens, or another command holds the store for one act. */
  | { readonly reading: "none" };

/**
 * Ask whether a vessel's custody door stands at the socket. A vessel answers a `custody` frame at once, at the
 * floor or above it; a command that holds the store for one act answers every line with its own refusal; a name
 * with nothing behind it refuses the connection. `waitMs` bounds only how long this caller waits to hear, and a
 * holder that never answers reads `silent`, which no caller may take for an empty store.
 */
export function vesselStanding(dataDir?: string | null, waitMs = 5_000): Promise<VesselStanding> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  // LIVENESS: a socket holder may accept the frame and remain silent; the result records silence.
  const silent = new Promise<VesselStanding>((resolve) => { timer = setTimeout(() => { abort.abort(); resolve({ reading: "silent" }); }, waitMs); });
  const asked = sendCustodyFrame({ op: "custody" }, dataDir, abort.signal).then((a): VesselStanding =>
    (a !== null && a["op"] === "custody" ? { reading: "vessel", unlocked: a["unlocked"] === true, composing: a["composing"] === true } : { reading: "none" }));
  return Promise.race([asked, silent]).finally(() => { if (timer) clearTimeout(timer); });
}
