/**
 * nexus-key-line — the LINE of one face's keys at one Nexus: the key the Nexus admitted, and every key it handed
 * its standing on to.
 *
 * A face holds one key at each Nexus, minted at random. The face's lineage re-issues it by a HAND-OVER: the
 * standing key and a fresh key both sign the same bytes, so the old key authorizes and the new key proves it
 * stands in the hand that signs. The records ride the Nexus's carriage board under their own prefix and accrete;
 * the fold, never the write, decides. A reader that admitted the first key walks the line from it and stands a
 * presenter under the line's HEAD alone. A key that hands one standing to two keys signed two lines: a FORK,
 * which refuses the line, and a compromise takes the face-key roll (a revoke and a fresh admit), never a
 * hand-over. A board holds many faces' records; the fold walks one line and ignores the rest.
 *
 * Platform-blind: rides ./crypto + ./base-doc + ./ed25519-door. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */

import { NEXUS_KEY_HAND_OVER_DOMAIN } from "./domains.js";
export { NEXUS_KEY_HAND_OVER_DOMAIN } from "./domains.js";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";
import { storedLarRecord } from "./stored-record.js";

export const NEXUS_KEY_HAND_OVER_PREFIX = "lar:///ha.ka.ba/dreamnet/nexus-key-hand-over/" as const;
/** How many hand-overs one line may hold; a reader walks no further. */
export const NEXUS_KEY_LINE_BOUND = 64;

export interface NexusKeyHandOver {
  readonly kind: typeof NEXUS_KEY_HAND_OVER_DOMAIN;
  readonly nexus: string;
  readonly from: string;
  readonly to: string;
  readonly fromSig: string;
  readonly toSig: string;
}

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const FIELDS = ["kind", "nexus", "from", "to", "fromSig", "toSig"] as const;
const norm = (value: string): string => value.trim().toLowerCase();
const fail = (message: string): Error => new Error(`nexus-key-hand-over: ${message}`);

/** canonicalJsonBytes({ kind, nexus, from, to }) — import canonicalJsonBytes from "./crypto.js". */
export function nexusKeyHandOverBytes(p: { readonly nexus: string; readonly from: string; readonly to: string }): Uint8Array {
  return canonicalJsonBytes({ kind: NEXUS_KEY_HAND_OVER_DOMAIN, nexus: p.nexus, from: p.from, to: p.to });
}

/** sha256 lower hex of the bytes above (sha256HexBytesSync from "./crypto.js"). */
export function nexusKeyHandOverId(h: Pick<NexusKeyHandOver, "nexus" | "from" | "to">): string {
  return sha256HexBytesSync(nexusKeyHandOverBytes(h));
}

/** Sign one hand-over with both the standing key and its fresh successor. */
export async function signNexusKeyHandOver(
  p: { readonly nexus: string; readonly from: string; readonly to: string },
  signFrom: (bytes: Uint8Array) => Promise<string>,
  signTo: (bytes: Uint8Array) => Promise<string>,
): Promise<NexusKeyHandOver> {
  const nexus = typeof p?.nexus === "string" ? norm(p.nexus) : "";
  const from = typeof p?.from === "string" ? norm(p.from) : "";
  const to = typeof p?.to === "string" ? norm(p.to) : "";
  if (!nexus) throw fail("empty nexus");
  if (from === to) throw fail("from equals to");
  if (!KEY_RE.test(from) || !acceptEd25519Key(from).ok) throw fail("invalid from key");
  if (!KEY_RE.test(to) || !acceptEd25519Key(to).ok) throw fail("invalid to key");
  const bytes = nexusKeyHandOverBytes({ nexus, from, to });
  let fromSig: string, toSig: string;
  try { fromSig = await signFrom(bytes); toSig = await signTo(bytes); }
  catch { throw fail("signing failed"); }
  if (typeof fromSig !== "string" || !SIG_RE.test(fromSig) || !verifyEd25519(fromSig, bytes, from)) throw fail("from signature failed verification");
  if (typeof toSig !== "string" || !SIG_RE.test(toSig) || !verifyEd25519(toSig, bytes, to)) throw fail("to signature failed verification");
  return { kind: NEXUS_KEY_HAND_OVER_DOMAIN, nexus, from, to, fromSig, toSig };
}

/** Read one exact record whose old and fresh keys both verify the same semantic bytes. */
export function readNexusKeyHandOver(value: unknown): NexusKeyHandOver | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const p = value as Record<string, unknown>;
    const keys = Object.keys(p);
    if (keys.length !== FIELDS.length || FIELDS.some((key) => !Object.prototype.hasOwnProperty.call(p, key))) return null;
    if (p.kind !== NEXUS_KEY_HAND_OVER_DOMAIN || typeof p.nexus !== "string" || !norm(p.nexus) || norm(p.nexus) !== p.nexus) return null;
    if (typeof p.from !== "string" || !KEY_RE.test(p.from) || !acceptEd25519Key(p.from).ok) return null;
    if (typeof p.to !== "string" || !KEY_RE.test(p.to) || !acceptEd25519Key(p.to).ok || p.from === p.to) return null;
    if (typeof p.fromSig !== "string" || !SIG_RE.test(p.fromSig) || typeof p.toSig !== "string" || !SIG_RE.test(p.toSig)) return null;
    const record: NexusKeyHandOver = { kind: p.kind as typeof NEXUS_KEY_HAND_OVER_DOMAIN, nexus: p.nexus, from: p.from, to: p.to, fromSig: p.fromSig, toSig: p.toSig };
    const bytes = nexusKeyHandOverBytes(record);
    return verifyEd25519(record.fromSig, bytes, record.from) && verifyEd25519(record.toSig, bytes, record.to) ? record : null;
  } catch { return null; }
}

/** The tiddler key one record rides under. */
export function nexusKeyHandOverKey(h: Pick<NexusKeyHandOver, "nexus" | "from" | "to">): string {
  return `${NEXUS_KEY_HAND_OVER_PREFIX}${nexusKeyHandOverId(h)}`;
}

/** Land a readable record on a board draft. */
export function writeNexusKeyHandOver(draft: LarDoc, record: NexusKeyHandOver): void {
  const readable = readNexusKeyHandOver(record);
  if (!readable) throw fail("refusing to write a record that reads as none");
  const key = nexusKeyHandOverKey(readable);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(readable) }, readable.nexus);
}

/** Read readable hand-overs for one Nexus from a board. */
export function nexusKeyHandOversFromBoard(doc: LarDoc | undefined | null, nexus: string): NexusKeyHandOver[] {
  const wanted = typeof nexus === "string" ? norm(nexus) : "";
  if (!wanted || !doc?.tiddlers) return [];
  const records: NexusKeyHandOver[] = [];
  try {
    for (const [key, stored] of Object.entries(doc.tiddlers)) {
      if (!key.startsWith(NEXUS_KEY_HAND_OVER_PREFIX)) continue;
      const text = tiddlerText(stored);
      if (text === null) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { continue; }
      const record = readNexusKeyHandOver(parsed);
      if (record && norm(record.nexus) === wanted) records.push(record);
    }
  } catch { return records; }
  return records;
}

export type NexusKeyLineRefusal = "carried-malformed" | "forked" | "loops" | "line-over-bound";
export type NexusKeyLine =
  | { readonly head: string; readonly keys: readonly string[]; readonly handOvers: readonly NexusKeyHandOver[] }
  | { readonly refusal: NexusKeyLineRefusal };

/** A record's shape, read with no signature checked: what the walk indexes before it verifies the few it steps on. */
function shapeOf(value: unknown): NexusKeyHandOver | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const p = value as Record<string, unknown>;
    if (Object.keys(p).length !== FIELDS.length || FIELDS.some((key) => !Object.prototype.hasOwnProperty.call(p, key))) return null;
    if (p.kind !== NEXUS_KEY_HAND_OVER_DOMAIN || typeof p.nexus !== "string" || typeof p.from !== "string" || typeof p.to !== "string") return null;
    if (typeof p.fromSig !== "string" || typeof p.toSig !== "string") return null;
    return { kind: NEXUS_KEY_HAND_OVER_DOMAIN, nexus: p.nexus, from: p.from, to: p.to, fromSig: p.fromSig, toSig: p.toSig };
  } catch { return null; }
}

/**
 * The records of ONE nexus a reader holds, indexed by the key each hands from and the key each hands to, read by shape
 * alone. Every face's records share a board, so the index never refuses on the board's size and never verifies a
 * record the walk does not step on: a flood of other records costs one shape read each and denies nobody.
 */
function indexOf(nexus: string, carried: unknown): { from: Map<string, NexusKeyHandOver[]>; to: Map<string, NexusKeyHandOver[]> } | null {
  if (!Array.isArray(carried)) return null;
  const from = new Map<string, NexusKeyHandOver[]>(), to = new Map<string, NexusKeyHandOver[]>();
  const count = carried.length;
  for (let i = 0; i < count; i++) {
    const r = shapeOf(carried[i]);
    if (r === null || r.nexus !== nexus) continue;
    const byFrom = from.get(r.from);
    if (byFrom) byFrom.push(r); else from.set(r.from, [r]);
    const byTo = to.get(r.to);
    if (byTo) byTo.push(r); else to.set(r.to, [r]);
  }
  return { from, to };
}

/** How many record readings one process remembers. */
const READ_MEMO_BOUND = 65_536;
/**
 * Whether each record reads, by its exact fields: a record a reader checked lately costs no second check. The memo
 * holds a verdict and no record, so nothing a caller does to a record it got back moves a later answer. Residue: the
 * memo keeps the last READ_MEMO_BOUND readings, so a flood past that bound costs a check per record per read.
 */
const READ_MEMO = new Map<string, boolean>();
function readOnce(c: NexusKeyHandOver): NexusKeyHandOver | null {
  const key = JSON.stringify([c.nexus, c.from, c.to, c.fromSig, c.toSig]);
  let reads = READ_MEMO.get(key);
  if (reads === undefined) {
    reads = readNexusKeyHandOver(c) !== null;
    if (READ_MEMO.size >= READ_MEMO_BOUND) READ_MEMO.delete(READ_MEMO.keys().next().value as string);
    READ_MEMO.set(key, reads);
  }
  return reads ? Object.freeze({ kind: NEXUS_KEY_HAND_OVER_DOMAIN, nexus: c.nexus, from: c.from, to: c.to, fromSig: c.fromSig, toSig: c.toSig }) : null;
}

/** The distinct records among `candidates` whose two signatures verify, by the key they hand to (or from). */
function verified(candidates: readonly NexusKeyHandOver[] | undefined, by: "to" | "from"): Map<string, NexusKeyHandOver> {
  const out = new Map<string, NexusKeyHandOver>();
  for (const c of candidates ?? []) {
    if (out.has(c[by])) continue;
    const r = readOnce(c);
    if (r !== null) out.set(r[by], r);
  }
  return out;
}

/**
 * Walk the line from `admitted` (64 hex, lower-cased) through `carried` (the records a reader holds, every face's and
 * every Nexus's together, e.g. off a board). Records of another nexus, records of other faces' lines, and records
 * whose signatures fail never touch the walk and never refuse it. Walk: from the current key, the distinct keys that
 * VERIFIED records hand it to: none → stop; more than one → "forked"; one → step (a key already passed → "loops";
 * past NEXUS_KEY_LINE_BOUND steps → "line-over-bound"). `keys` lists admitted first, head last; `handOvers` lists the
 * walked records in order. Never throws.
 */
export function followNexusKeyLine(args: { readonly nexus: string; readonly admitted: string; readonly carried: unknown }): NexusKeyLine {
  try {
    const nexus = norm(args.nexus);
    const admitted = norm(args.admitted);
    const index = indexOf(nexus, args.carried);
    if (!nexus || !KEY_RE.test(admitted) || index === null) return { refusal: "carried-malformed" };
    return walkForward(admitted, index);
  } catch { return { refusal: "carried-malformed" }; }
}

/** The forward walk from `admitted` over one built index. */
function walkForward(admitted: string, index: NonNullable<ReturnType<typeof indexOf>>): NexusKeyLine {
  try {
    const keys = [admitted];
    const walked: NexusKeyHandOver[] = [];
    let head = admitted;
    for (;;) {
      const nexts = verified(index.from.get(head), "to");
      if (nexts.size === 0) break;
      if (nexts.size > 1) return { refusal: "forked" };
      const [to, record] = nexts.entries().next().value as [string, NexusKeyHandOver];
      if (keys.includes(to)) return { refusal: "loops" };
      if (walked.length >= NEXUS_KEY_LINE_BOUND) return { refusal: "line-over-bound" };
      keys.push(to); walked.push(record); head = to;
    }
    return { head, keys, handOvers: walked };
  } catch { return { refusal: "carried-malformed" }; }
}

/**
 * The key the Nexus admitted, for a face that holds `key` there: walk the line BACKWARD from `key` through the
 * verified records that hand to each key, then forward again from the key reached, which must lead back to `key` as
 * its head. A key no record names answers itself. Null where the records fork backward (two keys hand to one), loop,
 * or walk forward past `key`: a key the line handed on presents nowhere. Never throws.
 */
export function admittedKeyOf(args: { readonly nexus: string; readonly key: string; readonly carried: readonly NexusKeyHandOver[] }): string | null {
  try {
    const nexus = norm(args.nexus);
    const start = norm(args.key);
    const index = indexOf(nexus, args.carried);
    if (!KEY_RE.test(start) || index === null) return null;
    let at = start;
    const seen = new Set([at]);
    for (let steps = 0; steps <= NEXUS_KEY_LINE_BOUND; steps++) {
      const froms = verified(index.to.get(at), "from");
      if (froms.size === 0) {
        const forward = walkForward(at, index);
        return "head" in forward && forward.head === start ? at : null;
      }
      if (froms.size > 1) return null;
      const [from] = froms.keys();
      if (seen.has(from!)) return null;
      seen.add(from!); at = from!;
    }
    return null;
  } catch { return null; }
}
