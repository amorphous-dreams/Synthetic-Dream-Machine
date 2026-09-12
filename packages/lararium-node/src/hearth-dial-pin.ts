/**
 * hearth-dial-pin — THE PIN NAMES THE DIAL.
 *
 * A joinee founded by an admit edge (`lares vessel found --admit`) boots for years after it spent its payload,
 * and the one address it cannot derive from anything it holds is where its hearth LISTENS: the `ws://` sync
 * url the hearth's `device-admit --sync-url` named, and the hearth's gate key — the anti-relay binding the
 * V3 proof commits to, known out-of-band (the admit payload IS the out-of-band channel; a key read off the
 * wire would bind the proof to whoever answered). `HEARTH_DAEMON_URL_TIDDLER` keeps the hearth's daemon DOC
 * url (an `automerge:` address) and dials nothing.
 *
 * So the two ride the bootstrap beside the sentinel ids, packed at admission (`hearthDialTiddlers`) and read
 * at boot (`readHearthDialPin`): the dial's default where no `LAR_JOIN_SYNC` / `LAR_JOIN_GATE` rides the env.
 * Absent on a vessel that founded its own face — such a vessel IS the hearth. FAIL CLOSED: a torn pin (one
 * half), a malformed key, an unreadable bootstrap → no pin → no dial (byte-identical to a vessel never admitted).
 *
 * Meme: lar:///ha.ka.ba/lararium/node/hearth-dial-pin
 */

import { readFileSync } from "node:fs";
import { DAEMON_BAG_ID } from "@lararium/mesh";

/** The hearth's `ws://…/ws` relay — where this joinee dials. */
export const HEARTH_SYNC_URL_TIDDLER = `${DAEMON_BAG_ID}/hearth/sync-url`;
/** The hearth's gate verifying-key hex — the gate-binding the joinee's V3 proof commits to. */
export const HEARTH_GATE_KEY_TIDDLER = `${DAEMON_BAG_ID}/hearth/gate-key`;

const KEY_RE = /^[0-9a-f]{64}$/;

export interface HearthDialPin {
  readonly syncUrl:    string;
  readonly gatePubKey: string;
}

/** The two bootstrap tiddlers an admission packs — empty when the payload named no dial. */
export function hearthDialTiddlers(syncUrl: string | null | undefined, gatePubKey: string | null | undefined): Record<string, { title: string; text: string; kind: string }> {
  if (!syncUrl || !gatePubKey) return {};
  return {
    [HEARTH_SYNC_URL_TIDDLER]: { title: HEARTH_SYNC_URL_TIDDLER, text: syncUrl, kind: "hearth-door" },
    [HEARTH_GATE_KEY_TIDDLER]: { title: HEARTH_GATE_KEY_TIDDLER, text: gatePubKey.toLowerCase(), kind: "hearth-door" },
  };
}

/** Read the pin off a bootstrap file — null when the vessel holds none (fail-closed on any tear). */
export function readHearthDialPin(bootstrapPath: string): HearthDialPin | null {
  try {
    const plugin = JSON.parse(readFileSync(bootstrapPath, "utf8")) as { text?: string };
    const packed = JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: unknown }> };
    const syncUrl = packed.tiddlers?.[HEARTH_SYNC_URL_TIDDLER]?.text;
    const gate    = packed.tiddlers?.[HEARTH_GATE_KEY_TIDDLER]?.text;
    if (typeof syncUrl !== "string" || typeof gate !== "string") return null;
    const gatePubKey = gate.trim().toLowerCase();
    if (!/^wss?:\/\//.test(syncUrl.trim()) || !KEY_RE.test(gatePubKey)) return null;
    return { syncUrl: syncUrl.trim(), gatePubKey };
  } catch { return null; }
}
