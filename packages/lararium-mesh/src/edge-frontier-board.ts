/**
 * edge-frontier-board — where a board's signed frontiers, their snapshots and a reader's pinned heads rest.
 *
 * A frontier rides the board it closes (sync always carries acts, frontiers and snapshots). Each signature lands
 * under its OWN key, so two seats of a quorum hand writing the same frontier at once both survive a merge, and the
 * reader unions them per cid. A snapshot rests under its content address. A reader's pinned heads rest in the
 * vessel's own ledger, never on the board: a pin is what THIS reader accepted, and only a verified read raises it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/edge-frontier-2026
 */

import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { actCid } from "./signed-act.js";
import { frontierSnapshotCid, type EdgeFrontier } from "./edge-frontier.js";
import { storedLarRecord } from "./stored-record.js";

const FRONTIER_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-frontier/" as const;
const SNAPSHOT_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-frontier-snapshot/" as const;
const PIN_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-frontier-pin/" as const;

const frontierPrefixOf = (board: string, hand: string): string => `${FRONTIER_PREFIX}${encodeURIComponent(board)}/${encodeURIComponent(hand)}/`;

/** Land a frontier on a board draft, one tiddler per signature. Call INSIDE a `handle.change()` callback. */
export function writeEdgeFrontier(draft: LarDoc, f: EdgeFrontier): void {
  const cid = actCid(f.body);
  for (const s of f.signatures) {
    const key = `${frontierPrefixOf(f.body.group, f.body.hand)}${f.body.seq}/${cid}/${s.signer.toLowerCase()}`;
    draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify({ body: f.body, signatures: [s] }) }, cid);
  }
}

/** Land a snapshot (the counted raise cids) under its content address; returns the address. */
export function writeFrontierSnapshot(draft: LarDoc, raiseCids: readonly string[]): string {
  const cid = frontierSnapshotCid(raiseCids);
  const key = `${SNAPSHOT_PREFIX}${cid}`;
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify([...new Set(raiseCids)].sort()) }, cid);
  return cid;
}

/** Every carried frontier record of one hand on one board, signatures unioned per cid. Unjudged: the reader verifies. */
export function edgeFrontierRecords(doc: LarDoc | undefined | null, board: string, hand: string): unknown[] {
  const prefix = frontierPrefixOf(board, hand);
  const byCid = new Map<string, { body: unknown; signatures: unknown[] }>();
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    let parsed: { body?: unknown; signatures?: unknown };
    try { parsed = JSON.parse(text) as typeof parsed; } catch { continue; }
    if (typeof parsed.body !== "object" || parsed.body === null || !Array.isArray(parsed.signatures)) continue;
    const cid = title.split("/").slice(-2)[0] ?? "";
    // The title's cid is an ADDRESS: a body that does not hash to it is a counterfeit and joins nothing, so it can neither absorb
    // the real frontier's signatures nor stand in for it.
    try { if (actCid(parsed.body as never) !== cid) continue; } catch { continue; }
    const have = byCid.get(cid);
    if (have) have.signatures.push(...parsed.signatures);
    else byCid.set(cid, { body: parsed.body, signatures: [...parsed.signatures] });
  }
  return [...byCid.values()];
}

/** Every snapshot the board carries whose content matches its address: cid -> raise cids. */
export function frontierSnapshots(doc: LarDoc | undefined | null): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(SNAPSHOT_PREFIX)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try {
      const raises = JSON.parse(text) as unknown;
      if (Array.isArray(raises) && raises.every((r) => typeof r === "string") && frontierSnapshotCid(raises) === title.slice(SNAPSHOT_PREFIX.length)) out.set(title.slice(SNAPSHOT_PREFIX.length), raises as string[]);
    } catch { /* torn: skipped */ }
  }
  return out;
}

/** The heads this reader has accepted for a board, by hand. */
export function readFrontierPins(ledger: LarDoc | undefined | null, board: string): Record<string, { seq: number; cid: string }> {
  const prefix = `${PIN_PREFIX}${encodeURIComponent(board)}/`;
  const out: Record<string, { seq: number; cid: string }> = {};
  for (const [title, record] of Object.entries(ledger?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try {
      const pin = JSON.parse(text) as { seq?: unknown; cid?: unknown };
      if (Number.isSafeInteger(pin.seq) && typeof pin.cid === "string") out[decodeURIComponent(title.slice(prefix.length))] = { seq: pin.seq as number, cid: pin.cid };
    } catch { /* torn: skipped */ }
  }
  return out;
}

/** Raise a pin: written only when the head is higher than the one held, so a pin never falls. Inside a `change()`. */
export function writeFrontierPin(draft: LarDoc, board: string, hand: string, head: { seq: number; cid: string }): boolean {
  const key = `${PIN_PREFIX}${encodeURIComponent(board)}/${encodeURIComponent(hand)}`;
  const held = readFrontierPins(draft, board)[hand];
  if (held && held.seq >= head.seq) return false;
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(head) }, head.cid);
  return true;
}
