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
  | { readonly op: "unlock"; readonly credentials: readonly Credential[]; readonly face?: number }
  | { readonly op: "lock" }
  | { readonly op: "custody" }
  /** One act of the sealed-act table and its typed arguments; nothing rides beside them. */
  | { readonly op: "act"; readonly act: string; readonly args: Readonly<Record<string, unknown>> }
  /** One face's backup cut: the vessel's own route, the face's handle-index and the bundle key (64 lower hex). */
  | { readonly op: "backup"; readonly credentials: readonly Credential[]; readonly face: number; readonly key: string }
  /** The human route the next new face this vessel founds will bind (passphrase pins; one use). */
  | { readonly op: "face-route"; readonly slots: readonly SlotSpec[] };

/** The daemon's answer, as the door spells it (`custody-frames` in the node package). */
export type CustodyDoorAnswer = Record<string, unknown> & { readonly op?: string };

/**
 * Send one custody frame to the vessel standing on this store. Resolves its answer, or `null` when no vessel
 * answers (no socket, a refused connect, a closed line with no answer). An unlock waits as long as the vessel
 * takes to compose again: nothing here times it out.
 */
export function sendCustodyFrame(frame: CustodyFrame, dataDir?: string | null): Promise<CustodyDoorAnswer | null> {
  const path = udsSocketPath(dataDir);
  return new Promise((settle) => {
    const sock = createConnection(path);
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
  | { readonly reading: "vessel"; readonly unlocked: boolean }
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
  const silent = new Promise<VesselStanding>((resolve) => { timer = setTimeout(() => resolve({ reading: "silent" }), waitMs); });
  const asked = sendCustodyFrame({ op: "custody" }, dataDir).then((a): VesselStanding =>
    (a !== null && a["op"] === "custody" ? { reading: "vessel", unlocked: a["unlocked"] === true } : { reading: "none" }));
  return Promise.race([asked, silent]).finally(() => { if (timer) clearTimeout(timer); });
}
