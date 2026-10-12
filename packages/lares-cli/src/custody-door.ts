/**
 * custody-door — the CLI's side of the vessel's custody door: one `unlock`, `lock` or `custody` frame on the
 * owner-only verb socket, and its one answer.
 *
 * A credential rides this frame and nothing else. A verb's arguments get hashed into a durable receipt the daemon
 * keeps; the custody frame stands ahead of every verb on the socket, so it never becomes an invocation and leaves
 * no digest, receipt or outcome behind. This module never logs what it sends.
 */
import { createConnection } from "node:net";
import type { Credential } from "@lararium/mesh";
import { udsSocketPath } from "./local-connector.js";

export type CustodyFrame =
  | { readonly op: "unlock"; readonly credentials: readonly Credential[] }
  | { readonly op: "lock" }
  | { readonly op: "custody" };

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
