/**
 * edge-kapae — the kāpae raised over a RELATIONSHIP rather than over a thing.
 *
 * Kāpae (Hawaiian): to set aside, to hold aside. Deliberate placement, never loss — the record beneath
 * survives whole, and another hand may take the marker back down (`lar:///ha.ka.ba/lares/api/pono/kapae`).
 *
 * ── WHY THE EDGE ──────────────────────────────────────────────────────────────────────────────────────────
 * A marker over a THING (a user, an instance, a certificate) demands global agreement, since a thing holds
 * one global standing. A marker over one EDGE scopes to a single relationship: no third party needs the
 * news, and two edges set aside concurrently never race, because they name different objects.
 *
 * ── TWO HANDS (kapae#/edge-hands) ─────────────────────────────────────────────────────────────────────────
 * The HOLDER hand signs with the one key the edge's own id names (a voucher, a fleet root). The QUORUM hand
 * signs with the seat quorum of the charter the realm stands under, at the seal epoch the act names. Each
 * hand folds its OWN causal heads, and the shadow stands while either hand's reading stands: a voucher's
 * lower never lifts a quorum's raise, and a quorum's lower never returns a stake its voucher withdrew.
 *
 * ── ROLLS CARRY SHADOWS (kapae#/rolls) ────────────────────────────────────────────────────────────────────
 * Citation alone orders acts: an act cites its parents by content id, and a parent may root on ANY epoch. The
 * epoch names the roster a quorum act counts under and ranks nothing. Every seal roll writes an EDGE ROLL
 * ANCHOR, signed by the quorum of the epoch the roll opens: the closed epoch's id, its seated key-set, and the
 * causal heads of the quorum acts that counted there. A quorum act at an earlier epoch counts only when it
 * sits in the causal past of an anchor that closed its epoch — so a retired key-set mints nothing after its
 * roll, neither a raise nor a lift. One more road serves a RAISE alone: a vessel that counted it while its
 * epoch still stood as that vessel's head keeps counting it, whether or not the roller ever read the board.
 *
 * ── ONLY A FRONTIER OF LOWERS LIFTS ───────────────────────────────────────────────────────────────────────
 * A lower that causally follows every raise of its hand takes that hand's marker down. A raise beside a lower
 * with no causal order between them stays UP (remove-wins); so does a frontier that cites a parent the reader
 * cannot count. An act that does not count DROPS before the fold, and an edge no counted act names reads
 * ABSENT, which never shadows (a kāpae shadows; absent falls through).
 *
 * Platform-blind: rides ./crypto + ./base-doc + the quorum and seal-lineage types. NO node: imports.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */

import { EDGE_KAPAE_DOMAIN, EDGE_ROLL_ANCHOR_DOMAIN } from "./domains.js";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import { storedLarRecord } from "./stored-record.js";
import type { StoredLarRecord } from "./stored-value.js";
import type { KahuQuorumSeats, QuorumSignature } from "./kapae-antigen.js";
import { sealKeySetHash, verifySealLineage, type SealEpoch } from "./wax-stamp.js";
import { verifyEd25519 } from "./ed25519-door.js";

export { EDGE_KAPAE_DOMAIN, EDGE_ROLL_ANCHOR_DOMAIN } from "./domains.js";
/** The tiddler-key prefix every kāpae act rides under. */
export const EDGE_KAPAE_PREFIX = "lar:///ha.ka.ba/dreamnet/edge-kapae/" as const;
/** The tiddler-key prefix an edge roll anchor rides under — its own sub-namespace beside the acts. */
export const EDGE_ROLL_ANCHOR_PREFIX = `${EDGE_KAPAE_PREFIX}roll/` as const;

const CID_RE = /^[0-9a-f]{64}$/;
/** How many signature records one signer may hold on one act or anchor. A true signer needs one. */
const MAX_SIGNATURES_PER_SIGNER = 4;
/** How many signature records one act or anchor may carry at all; a longer record reads as torn. */
const MAX_SIGNATURES_PER_RECORD = 256;

/** Which hand signs an act: the one key the edge id names, or the seat quorum of the realm's charter. */
export type EdgeHand = "holder" | "quorum";

/**
 * One act on one relationship — a hand raising the marker, or a hand taking it back down.
 *
 * `raised` carries the gesture rather than a state, because the board holds ACTS and the fold holds state.
 */
export interface EdgeKapae {
  readonly kind:       typeof EDGE_KAPAE_DOMAIN;
  /** The relationship this act concerns — a dyad id, a vouch edge id, a member edge id. */
  readonly edgeId:     string;
  /** true → raise the shadow (set aside); false → lower it (a deliberate re-admission). */
  readonly raised:     boolean;
  /** The hand that signs. It rides the signed bytes, so an act never moves from one hand's reading to the other's. */
  readonly hand:       EdgeHand;
  /** Content identity of the semantic act, 64-hex (signatures stay outside this identity). */
  readonly actCid:     string;
  /** Causal parents: acts of the SAME edge and hand, at any epoch. An empty set founds a line. */
  readonly parents:    readonly string[];
  /** The seal epoch a QUORUM act names: it selects that act's roster and ranks nothing. A HOLDER act names no
   *  epoch, since its hand signs with the one key the edge id names and holds no roster: a holder act that names
   *  one, and a quorum act that names none, read as no act. */
  readonly epochCid?:  string;
  /** A holder act: one signature by the edge's holder. A quorum act: the seats' signatures. */
  readonly signatures: readonly QuorumSignature[];
}

type UnsignedAct = Omit<EdgeKapae, "signatures" | "actCid">;

/** The semantic bytes an act signs and hashes. Signatures never enter the act identity. An epoch enters the bytes
 *  exactly where the act names one. */
export function edgeKapaeBytes(a: UnsignedAct): Uint8Array {
  return canonicalJsonBytes({
    kind: a.kind, edgeId: a.edgeId, raised: a.raised, hand: a.hand,
    parents: [...new Set(a.parents)].sort(), ...(a.epochCid === undefined ? {} : { epochCid: a.epochCid }),
  });
}

/** Does the act name an epoch exactly where its hand takes one: a quorum act names one, a holder act none? */
export function edgeActEpochFits(a: Pick<EdgeKapae, "hand" | "epochCid">): boolean {
  return a.hand === "quorum" ? typeof a.epochCid === "string" && a.epochCid.length > 0 : a.epochCid === undefined;
}

export function edgeKapaeActCid(a: UnsignedAct): string {
  return sha256HexBytesSync(edgeKapaeBytes(a));
}

/** One signer of an act: its verifying key and a function that signs bytes with the matching secret. */
export interface EdgeSigner {
  readonly signer: string;
  readonly sign:   (bytes: Uint8Array) => Promise<string>;
}

/** Mint an act. The caller supplies the signers; this module holds no key and grades no authority. */
export async function signEdgeKapae(
  parts: Omit<EdgeKapae, "kind" | "signatures" | "actCid">,
  signers: readonly EdgeSigner[],
): Promise<EdgeKapae> {
  const base: UnsignedAct = { ...parts, kind: EDGE_KAPAE_DOMAIN, parents: [...new Set(parts.parents)].sort() };
  if (!edgeActEpochFits(base)) {
    throw new Error(base.hand === "quorum" ? "edge-kapae: a quorum act names the seal epoch its roster reads at" : "edge-kapae: a holder act names no epoch");
  }
  const bytes = edgeKapaeBytes(base);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
  return { ...base, actCid: edgeKapaeActCid(base), signatures };
}

/**
 * The key one act rides under — edge, HAND, GESTURE and act CID together, so a raise and a lower written from
 * one frontier land on distinct keys and both survive a merge. The fold adjudicates; the write never does.
 */
export function edgeKapaeKey(a: Pick<EdgeKapae, "edgeId" | "hand" | "raised" | "actCid">): string {
  return `${EDGE_KAPAE_PREFIX}${a.edgeId}/${a.hand}/${a.raised ? "raised" : "lowered"}/${a.actCid}`;
}

/** Distinct signature records, by signer AND bytes: a bad signature under a seat's name never displaces a good one. */
function gatherSignatures(have: readonly QuorumSignature[], more: readonly QuorumSignature[]): QuorumSignature[] {
  const seen = new Set<string>();
  const perSigner = new Map<string, number>();
  const out: QuorumSignature[] = [];
  for (const s of [...have, ...more]) {
    const signer = s.signer.toLowerCase();
    const key = `${signer}:${s.sig.toLowerCase()}`;
    if (seen.has(key)) continue;
    // A FEW candidates per signer, and no more: a hand that floods one seat's name with false records buys a
    // bounded number of verifies and displaces nothing a reader already kept (`have` reads first).
    const n = perSigner.get(signer) ?? 0;
    if (n >= MAX_SIGNATURES_PER_SIGNER) continue;
    perSigner.set(signer, n + 1);
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * One act per id, its signatures gathered. An act's id leaves its signatures out, so two hands that sign the
 * same gesture from the same frontier mint ONE act: a second signature JOINS the first and never replaces it.
 * A quorum gathers its seats' signatures this way across separate writes. A stranger who signs the bytes of a
 * holder's act, and a hand that writes a false signature under a true signer's name, each add a record no reader
 * counts and remove none: the counting fold reads every record and keeps the ones that verify.
 */
export function mergeEdgeActs(acts: Iterable<EdgeKapae>): EdgeKapae[] {
  const out = new Map<string, EdgeKapae>();
  for (const a of acts) {
    // Only an act whose id derives from its own body joins a merge: a forged body that wears a true act's id
    // must never become the record the true signatures land on.
    const { signatures: _s, actCid, ...body } = a;
    if (actCid !== edgeKapaeActCid(body)) continue;
    const have = out.get(a.actCid);
    if (!have) { out.set(a.actCid, a); continue; }
    const signatures = gatherSignatures(have.signatures, a.signatures);
    if (signatures.length > have.signatures.length) out.set(a.actCid, { ...have, signatures });
  }
  return [...out.values()];
}

/** One anchor per id, its signatures gathered — the same law `mergeEdgeActs` holds for acts. */
export function mergeEdgeRollAnchors(anchors: Iterable<EdgeRollAnchor>): EdgeRollAnchor[] {
  const out = new Map<string, EdgeRollAnchor>();
  for (const a of anchors) {
    const cid = edgeRollAnchorCid(a);
    const have = out.get(cid);
    if (!have) { out.set(cid, a); continue; }
    const signatures = gatherSignatures(have.signatures, a.signatures);
    if (signatures.length > have.signatures.length) out.set(cid, { ...have, signatures });
  }
  return [...out.values()];
}

/** The signatures of a roster's seats that verify over `bytes`, one per seat. Every other record drops. */
function seatSignatures(bytes: Uint8Array, signatures: readonly QuorumSignature[], roster: KahuQuorumSeats): QuorumSignature[] {
  const seats = new Set(roster.keys.map((k) => k.toLowerCase()));
  const out = new Map<string, QuorumSignature>();
  for (const s of signatures) {
    const signer = s.signer.toLowerCase();
    if (out.has(signer) || !seats.has(signer)) continue;
    let ok = false;
    try { ok = verifyEd25519(s.sig, bytes, signer); } catch { ok = false; }
    if (ok) out.set(signer, s);
  }
  return [...out.values()];
}

/** Does a quorum of `roster` hold among these signatures? Returns the verified seats' signatures, or null. */
function quorumOf(bytes: Uint8Array, signatures: readonly QuorumSignature[], roster: KahuQuorumSeats): QuorumSignature[] | null {
  if (roster.threshold < 1 || roster.keys.length < roster.threshold) return null;
  const verified = seatSignatures(bytes, signatures, roster);
  return verified.length >= roster.threshold ? verified : null;
}

/** Land an act on a board draft, joining its signatures to any the board already holds for the same act.
 *  Call INSIDE a `handle.change()` callback. */
export function writeEdgeKapae(draft: LarDoc, act: EdgeKapae): void {
  const key = edgeKapaeKey(act);
  const standing = edgeKapaeActsFromRecords(draft.tiddlers[key] !== undefined ? [draft.tiddlers[key]!] : []);
  const [merged] = mergeEdgeActs([...standing.filter((a) => a.actCid === act.actCid), act]);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(merged) }, act.epochCid ?? act.hand);
}

function coerceSignatures(v: unknown): QuorumSignature[] | null {
  if (!Array.isArray(v) || v.length > MAX_SIGNATURES_PER_RECORD) return null;
  const out: QuorumSignature[] = [];
  for (const s of v) {
    if (typeof s !== "object" || s === null) return null;
    const r = s as Record<string, unknown>;
    if (typeof r["signer"] !== "string" || r["signer"].length === 0) return null;
    if (typeof r["sig"] !== "string" || r["sig"].length === 0) return null;
    out.push({ signer: r["signer"], sig: r["sig"] });
  }
  return out;
}

/** A parsed payload reads as an act only at the exact FLOOR shape — extra fields drop. */
function coerceAct(parsed: unknown): EdgeKapae | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== EDGE_KAPAE_DOMAIN) return null;
  if (typeof p["edgeId"] !== "string" || p["edgeId"].length === 0) return null;
  if (typeof p["raised"] !== "boolean") return null;
  if (p["hand"] !== "holder" && p["hand"] !== "quorum") return null;
  if (typeof p["actCid"] !== "string" || !CID_RE.test(p["actCid"])) return null;
  if (!Array.isArray(p["parents"]) || p["parents"].some((x) => typeof x !== "string")) return null;
  // A quorum act names its epoch; a holder act names none, and a holder act that carries one reads as no act.
  if (p["hand"] === "quorum" ? typeof p["epochCid"] !== "string" || p["epochCid"].length === 0 : "epochCid" in p) return null;
  const signatures = coerceSignatures(p["signatures"]);
  if (signatures === null || signatures.length === 0) return null;
  return {
    kind: EDGE_KAPAE_DOMAIN, edgeId: p["edgeId"], raised: p["raised"], hand: p["hand"],
    actCid: p["actCid"], parents: [...new Set(p["parents"] as string[])].sort(),
    ...(p["hand"] === "quorum" ? { epochCid: p["epochCid"] as string } : {}), signatures,
  };
}

type BoardRecord = StoredLarRecord;

function parsedOf(records: Iterable<BoardRecord>): unknown[] {
  const out: unknown[] = [];
  for (const record of records) {
    const text = tiddlerText(record);
    if (text === null) continue;
    try { out.push(JSON.parse(text)); } catch { /* a non-JSON tiddler carries no act */ }
  }
  return out;
}

/** Every well-formed act among some stored records. A torn or foreign record drops in silence. Shape only. */
export function edgeKapaeActsFromRecords(records: Iterable<BoardRecord>): EdgeKapae[] {
  const out: EdgeKapae[] = [];
  for (const parsed of parsedOf(records)) { const act = coerceAct(parsed); if (act !== null) out.push(act); }
  return out;
}

/** Every well-formed act among some parsed JSON values: acts a verb carried as plain data. Shape only. */
export function edgeKapaeActsFromJson(values: Iterable<unknown>): EdgeKapae[] {
  const out: EdgeKapae[] = [];
  for (const v of values) { const act = coerceAct(v); if (act !== null) out.push(act); }
  return out;
}

/** Every well-formed act a document carries. Shape only. */
export function edgeKapaeActsFromBoard(doc: LarDoc | undefined | null): EdgeKapae[] {
  return edgeKapaeActsFromRecords(Object.values(doc?.tiddlers ?? {}));
}

// ── the edge roll anchor ─────────────────────────────────────────────────────────────────────────────────

/**
 * EdgeRollAnchor — one seal roll, recorded on an edge board. The carriage board's `RollAnchor` in shape and
 * law, under its own domain and bound to one board's `scope`, so an anchor never verifies on another board.
 *
 *   · `prevEpochCid` / `sealEpochCid` — the epoch the roll closes and the epoch it opens.
 *   · `prevKeys` / `prevThreshold`    — the CLOSED epoch's seated key-set, which the charter lineage binds.
 *   · `parents`                       — the causal heads, at the roll, of the quorum acts that counted at the
 *                                       closed epoch (`edgeRollAnchorParents`).
 *   · `signatures`                    — the OPENED epoch's quorum. The closed keys never sign an anchor.
 */
export interface EdgeRollAnchor {
  readonly kind:          typeof EDGE_ROLL_ANCHOR_DOMAIN;
  /** The board this anchor stands on (a realm id). */
  readonly scope:         string;
  readonly prevEpochCid:  string;
  readonly sealEpochCid:  string;
  readonly prevKeys:      readonly string[];
  readonly prevThreshold: number;
  readonly parents:       readonly string[];
  readonly signatures:    readonly QuorumSignature[];
}

export function edgeRollAnchorBytes(anchor: Omit<EdgeRollAnchor, "signatures">): Uint8Array {
  return canonicalJsonBytes({
    kind: anchor.kind, scope: anchor.scope,
    prevEpochCid: anchor.prevEpochCid, sealEpochCid: anchor.sealEpochCid,
    prevKeys: [...new Set(anchor.prevKeys.map((k) => k.toLowerCase()))].sort(),
    prevThreshold: anchor.prevThreshold,
    parents: [...new Set(anchor.parents)].sort(),
  });
}

/** The anchor's content id, 64-hex. Signatures stand as evidence, never as identity. */
export function edgeRollAnchorCid(anchor: Omit<EdgeRollAnchor, "signatures">): string {
  return sha256HexBytesSync(edgeRollAnchorBytes(anchor));
}

function coerceAnchor(parsed: unknown): EdgeRollAnchor | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p["kind"] !== EDGE_ROLL_ANCHOR_DOMAIN) return null;
  for (const f of ["scope", "prevEpochCid", "sealEpochCid"]) if (typeof p[f] !== "string" || (p[f] as string).length === 0) return null;
  if (!Array.isArray(p["prevKeys"]) || p["prevKeys"].some((k) => typeof k !== "string")) return null;
  if (typeof p["prevThreshold"] !== "number" || !Number.isInteger(p["prevThreshold"]) || p["prevThreshold"] < 1) return null;
  if (!Array.isArray(p["parents"]) || p["parents"].some((x) => typeof x !== "string" || !CID_RE.test(x))) return null;
  const signatures = coerceSignatures(p["signatures"]);
  if (signatures === null) return null;
  return {
    kind: EDGE_ROLL_ANCHOR_DOMAIN, scope: p["scope"] as string,
    prevEpochCid: p["prevEpochCid"] as string, sealEpochCid: p["sealEpochCid"] as string,
    prevKeys: [...(p["prevKeys"] as string[])], prevThreshold: p["prevThreshold"],
    parents: [...new Set(p["parents"] as string[])].sort(), signatures,
  };
}

/** Sign an edge roll anchor with the OPENED epoch's quorum. */
export async function signEdgeRollAnchor(
  parts: Omit<EdgeRollAnchor, "kind" | "signatures">,
  signers: readonly EdgeSigner[],
): Promise<EdgeRollAnchor> {
  const unsigned: Omit<EdgeRollAnchor, "signatures"> = {
    ...parts, kind: EDGE_ROLL_ANCHOR_DOMAIN,
    prevKeys: [...parts.prevKeys], parents: [...new Set(parts.parents)].sort(),
  };
  const bytes = edgeRollAnchorBytes(unsigned);
  const signatures: QuorumSignature[] = [];
  for (const s of signers) signatures.push({ signer: s.signer, sig: await s.sign(bytes) });
  return { ...unsigned, signatures };
}

/** Does the anchor count under `opened`, the roster of the epoch it OPENS? */
export async function edgeRollAnchorCounts(anchor: EdgeRollAnchor, opened: KahuQuorumSeats): Promise<boolean> {
  if (anchor.sealEpochCid !== opened.sealEpochCid) return false;
  return quorumOf(edgeRollAnchorBytes(anchor), anchor.signatures, opened) !== null;
}

export function edgeRollAnchorKey(anchor: EdgeRollAnchor): string {
  return `${EDGE_ROLL_ANCHOR_PREFIX}${edgeRollAnchorCid(anchor)}`;
}

/** Land an anchor on a board draft. Call INSIDE a `handle.change()` callback. */
export function writeEdgeRollAnchor(draft: LarDoc, anchor: EdgeRollAnchor): void {
  const key = edgeRollAnchorKey(anchor);
  const standing = edgeRollAnchorsFromRecords(draft.tiddlers[key] !== undefined ? [draft.tiddlers[key]!] : []);
  const [merged] = mergeEdgeRollAnchors([...standing.filter((a) => edgeRollAnchorCid(a) === edgeRollAnchorCid(anchor)), anchor]);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(merged) }, anchor.sealEpochCid);
}

/** Every well-formed anchor among some stored records. Shape only. */
export function edgeRollAnchorsFromRecords(records: Iterable<BoardRecord>): EdgeRollAnchor[] {
  const out: EdgeRollAnchor[] = [];
  for (const parsed of parsedOf(records)) { const a = coerceAnchor(parsed); if (a !== null) out.push(a); }
  return out;
}

/** Every well-formed anchor a document carries. Shape only. */
export function edgeRollAnchorsFromBoard(doc: LarDoc | undefined | null): EdgeRollAnchor[] {
  return edgeRollAnchorsFromRecords(Object.values(doc?.tiddlers ?? {}));
}

// ── counting: which acts carry authority ─────────────────────────────────────────────────────────────────

/** Which hands hold one edge. Read off what the reader itself holds about the edge, never off an act. */
export interface EdgeAuthority {
  /** The one key the edge's id names, when this edge takes a holder hand. */
  readonly holder?: string;
  /** True when the seat quorum of the realm's charter may act on this edge. */
  readonly quorum?: boolean;
}

/** The reader's own charter view for one board: the head roster and the lineage that leads to it. */
export interface EdgeCharter {
  /** The board the anchors must name. */
  readonly scope:       string;
  /** The seats at the charter head this reader holds. */
  readonly head:        KahuQuorumSeats;
  /** The charter's epoch lineage, genesis first, its last epoch the head. */
  readonly sealLineage: readonly SealEpoch[];
}

/** The acts that carry authority at this reader, and the anchors that counted on the way. */
export interface CountedEdgeBoard {
  readonly acts:    readonly EdgeKapae[];
  readonly anchors: readonly EdgeRollAnchor[];
}

/**
 * The rosters a reader can stand behind, keyed by epoch, and the counted anchors that close each epoch.
 *
 * A roster reads off the charter lineage itself: every rolled epoch carries its seated key-set in its own
 * signed roll, and the genesis key-set reads off any anchor that carries a preimage of the genesis epoch's
 * `keySetHash` (a hash binds it; no signature adds anything).
 *
 * AN ANCHOR COUNTS when it names this board, links two adjacent epochs of the lineage, carries the key-set the
 * closed epoch committed, holds the quorum of the epoch it opens — and, where that epoch has itself rolled,
 * sits in the causal past of a counted anchor that closed it. So the anchors chain from the head down, each
 * cited by the next: a key-set that retired can sign no anchor after its own roll, exactly as it can sign no
 * act. The walk stops at the first roll no counted anchor carries, and nothing behind it reads as anchored.
 */
async function resolveRosters(
  charter: EdgeCharter | null | undefined, anchors: readonly EdgeRollAnchor[],
): Promise<{ rosters: Map<string, KahuQuorumSeats>; closing: Map<string, EdgeRollAnchor[]>; counted: EdgeRollAnchor[] }> {
  const rosters = new Map<string, KahuQuorumSeats>();
  const closing = new Map<string, EdgeRollAnchor[]>();
  const counted: EdgeRollAnchor[] = [];
  if (!charter) return { rosters, closing, counted };
  rosters.set(charter.head.sealEpochCid, charter.head);
  const lineage = charter.sealLineage;
  if (lineage.length === 0 || !verifySealLineage(lineage)) return { rosters, closing, counted };
  const last = lineage.length - 1;
  if (lineage[last]!.epochCid !== charter.head.sealEpochCid) return { rosters, closing, counted };
  for (let j = 1; j < last; j++) {
    const roll = lineage[j]!.roll!;
    rosters.set(lineage[j]!.epochCid, { keys: [...roll.keys], threshold: roll.threshold, sealEpochCid: lineage[j]!.epochCid });
  }
  const genesis = lineage[0]!;
  if (last > 0) {
    const preimage = anchors.find((a) => a.prevEpochCid === genesis.epochCid && sealKeySetHash(a.prevKeys, a.prevThreshold) === genesis.keySetHash);
    if (preimage) rosters.set(genesis.epochCid, { keys: [...preimage.prevKeys], threshold: preimage.prevThreshold, sealEpochCid: genesis.epochCid });
  }
  // The anchors' own ancestry: an anchor's id binds its parents, so a walk needs no signature to trust a link.
  const anchorParents = new Map(anchors.map((a) => [edgeRollAnchorCid(a), a.parents] as const));
  let later: EdgeRollAnchor[] | null = null;   // the counted anchors that closed the epoch this step opens
  for (let j = last; j > 0; j--) {
    const opened = rosters.get(lineage[j]!.epochCid);
    const closed = lineage[j - 1]!;
    if (!opened) break;
    const good: EdgeRollAnchor[] = [];
    for (const a of anchors) {
      if (a.scope !== charter.scope) continue;
      if (a.sealEpochCid !== opened.sealEpochCid || a.prevEpochCid !== closed.epochCid) continue;
      if (sealKeySetHash(a.prevKeys, a.prevThreshold) !== closed.keySetHash) continue;
      const seats = quorumOf(edgeRollAnchorBytes(a), a.signatures, opened);
      if (seats === null) continue;
      // Below the head, the anchor must stand in the past of an anchor that closed the epoch it opens.
      const cid = edgeRollAnchorCid(a);
      if (later !== null && !later.some((next) => inPastOf(next.parents, cid, anchorParents))) continue;
      good.push({ ...a, signatures: seats });
    }
    if (good.length === 0) break;
    closing.set(closed.epochCid, good);
    counted.push(...good);
    later = good;
  }
  return { rosters, closing, counted };
}

function inPastOf(start: readonly string[], target: string, parentsOf: ReadonlyMap<string, readonly string[]>): boolean {
  const seen = new Set<string>();
  const stack = [...start];
  while (stack.length > 0) {
    const cid = stack.pop()!;
    if (cid === target) return true;
    if (seen.has(cid)) continue;
    seen.add(cid);
    for (const p of parentsOf.get(cid) ?? []) stack.push(p);
  }
  return false;
}

/**
 * Keep the acts that carry authority at this reader; drop the rest. Every reader of an edge board passes
 * through here, so no fold ever sees an act nobody could answer for.
 *
 *   · an act whose id fails its own bytes drops (a relabeled copy of a signed act);
 *   · a HOLDER act counts under exactly the one key `authorityFor` names for its edge;
 *   · a QUORUM act counts under the roster of the epoch it names. At the charter head that suffices. At an
 *     earlier epoch the act must also show it stood BEFORE that epoch rolled: it sits in the causal past of a
 *     counted anchor that closed its epoch — or, for a RAISE alone, this vessel's own ledger kept it while
 *     that epoch still stood as this vessel's head (`seenAtHead`). A lower never rides the ledger's word: a
 *     vessel that lagged behind a roll must never hold a lift the rest of the realm dropped.
 */
export async function countEdgeActs(
  acts: readonly EdgeKapae[],
  anchors: readonly EdgeRollAnchor[],
  authorityFor: (edgeId: string) => EdgeAuthority | undefined,
  charter?: EdgeCharter | null,
  seenAtHead?: ReadonlyMap<string, string>,
): Promise<CountedEdgeBoard> {
  const { rosters, closing, counted } = await resolveRosters(charter, mergeEdgeRollAnchors(anchors));
  const parentsOf = new Map<string, readonly string[]>();
  // The ancestry an anchor's past walks holds only acts whose id derives from their own bytes: an id binds
  // its parents, so no relabeled copy can splice a stale act into an anchor's past.
  for (const a of acts) {
    if (a.hand !== "quorum") continue;
    const { signatures: _s, actCid, ...u } = a;
    if (actCid === edgeKapaeActCid(u)) parentsOf.set(actCid, a.parents);
  }
  const out: EdgeKapae[] = [];
  for (const a of mergeEdgeActs(acts)) {
    const { signatures, actCid, ...unsigned } = a;
    if (actCid !== edgeKapaeActCid(unsigned) || !edgeActEpochFits(a)) continue;
    const authority = authorityFor(a.edgeId);
    if (!authority) continue;
    const bytes = edgeKapaeBytes(unsigned);
    // What counts carries the signatures that VERIFIED and no other: the ledger keeps exactly these, and a
    // board copy that lacks one of them reads as missing it.
    let verified: QuorumSignature[];
    if (a.hand === "holder") {
      const holder = authority.holder?.replace(/^0x/, "").toLowerCase();
      if (!holder) continue;
      const signed = signatures.find((s) => s.signer.replace(/^0x/, "").toLowerCase() === holder && verifyEd25519(s.sig, bytes, holder));
      if (!signed) continue;
      verified = [signed];
    } else {
      if (authority.quorum !== true) continue;
      const roster = rosters.get(a.epochCid!);
      const seats = roster ? quorumOf(bytes, signatures, roster) : null;
      if (seats === null) continue;
      verified = seats;
      if (charter && a.epochCid !== charter.head.sealEpochCid) {
        const closers = closing.get(a.epochCid!) ?? [];
        const anchored = closers.some((anchor) => inPastOf(anchor.parents, a.actCid, parentsOf));
        const keptAsHead = a.raised && seenAtHead?.get(a.actCid) === a.epochCid;
        if (!anchored && !keptAsHead) continue;
      }
    }
    out.push({ ...a, signatures: verified });
  }
  return { acts: out, anchors: counted };
}

/**
 * The parents a roll's anchor cites: the causal heads, at the roll, of the quorum acts that count at the
 * CLOSING epoch and of the anchors that opened it. `counted` holds what already passed `countEdgeActs` under
 * the closing charter. Citing the earlier anchor chains this one to it, so a later reader walks every roll from
 * its head down. Sorted.
 */
export function edgeRollAnchorParents(counted: CountedEdgeBoard, closingEpochCid: string): string[] {
  const nodes = new Map<string, readonly string[]>();
  for (const a of counted.acts) if (a.hand === "quorum" && a.epochCid === closingEpochCid) nodes.set(a.actCid, a.parents);
  for (const a of counted.anchors) if (a.sealEpochCid === closingEpochCid) nodes.set(edgeRollAnchorCid(a), a.parents);
  const cited = new Set([...nodes.values()].flat());
  return [...nodes.keys()].filter((cid) => !cited.has(cid)).sort();
}

// ── the fold ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 *   · `held`        — every causal head raises.
 *   · `withdrawn`   — every causal head lowers: the ONE reading that lifts a shadow.
 *   · `unsettled`   — a raise and a lower both stand as heads, with no causal order between them.
 *   · `unavailable` — some act cites a parent this reader cannot count.
 *   · `rejected`    — some act's id fails to derive from its own bytes (the bare fold alone; counting drops it).
 *
 * An edge no act names carries NO verdict: it reads ABSENT, which never shadows.
 */
export type EdgeKapaeVerdict = "held" | "withdrawn" | "unsettled" | "unavailable" | "rejected";

/**
 * Does a shadow STAND over an edge that reads this verdict? The one rule every gate shares.
 * ONLY `withdrawn` LIFTS; no verdict (`undefined`) reads ABSENT, and absent never shadows.
 */
export function edgeShadowStands(verdict: EdgeKapaeVerdict | undefined): boolean {
  return verdict !== undefined && verdict !== "withdrawn";
}

/** What one edge reads: each hand's own verdict, whether the shadow stands, and the raises that counted. */
export interface EdgeReading {
  /** The reading a door shows: the gravest of the two hands' verdicts. */
  readonly verdict:   EdgeKapaeVerdict;
  readonly holder?:   EdgeKapaeVerdict;
  readonly quorum?:   EdgeKapaeVerdict;
  /** True while either hand's shadow stands. */
  readonly stands:    boolean;
  /** Every raise among the acts folded, sorted. Each one owes a roll of the seat its edge names (kapae#/keys). */
  readonly raiseCids: readonly string[];
}

function foldOneHand(group: readonly EdgeKapae[]): EdgeKapaeVerdict {
  const ids = new Set(group.map((a) => a.actCid));
  if (group.some((a) => a.parents.some((p) => !ids.has(p)))) return "unavailable";
  if (group.some((a) => { const { signatures: _s, actCid, ...u } = a; return actCid !== edgeKapaeActCid(u); })) return "rejected";
  const covered = new Set(group.flatMap((a) => a.parents));
  const heads = group.filter((a) => !covered.has(a.actCid));
  if (heads.length === 0) return "unavailable";
  if (heads.some((a) => a.raised) && heads.some((a) => !a.raised)) return "unsettled";
  return heads[0]!.raised ? "held" : "withdrawn";
}

const GRAVITY: readonly EdgeKapaeVerdict[] = ["withdrawn", "unavailable", "rejected", "unsettled", "held"];

/**
 * Fold acts into one reading per edge. Each hand folds its own causal heads; a parent in the other hand's
 * line, or on another edge, reads as a parent this line lacks. The caller hands in COUNTED acts
 * (`countEdgeActs`): this fold decides standing, and an uncounted act would let anyone move anyone's shadow.
 */
export function foldEdgeReadings(acts: readonly EdgeKapae[]): Map<string, EdgeReading> {
  const byEdge = new Map<string, { holder: EdgeKapae[]; quorum: EdgeKapae[] }>();
  for (const a of acts) {
    const slot = byEdge.get(a.edgeId) ?? { holder: [], quorum: [] };
    byEdge.set(a.edgeId, slot);
    slot[a.hand].push(a);
  }
  const out = new Map<string, EdgeReading>();
  for (const [edge, hands] of byEdge) {
    const holder = hands.holder.length > 0 ? foldOneHand(hands.holder) : undefined;
    const quorum = hands.quorum.length > 0 ? foldOneHand(hands.quorum) : undefined;
    const both = [holder, quorum].filter((v): v is EdgeKapaeVerdict => v !== undefined);
    const verdict = both.reduce((a, b) => (GRAVITY.indexOf(b) > GRAVITY.indexOf(a) ? b : a));
    const raiseCids = [...hands.holder, ...hands.quorum].filter((a) => a.raised).map((a) => a.actCid).sort();
    out.set(edge, {
      verdict, stands: both.some(edgeShadowStands), raiseCids,
      ...(holder !== undefined ? { holder } : {}), ...(quorum !== undefined ? { quorum } : {}),
    });
  }
  return out;
}

/** What a vessel's own ledger holds for one board. */
export interface KeptEdgeRows {
  readonly acts:        readonly EdgeKapae[];
  readonly anchors:     readonly EdgeRollAnchor[];
  /** act id → the epoch that stood as this vessel's charter head when it kept an act of that same epoch. */
  readonly seenAtHead?: ReadonlyMap<string, string>;
}

/** What a reader hands in to read one edge board: its replica, its own ledger, and whose hands hold what. */
export interface EdgeBoardInput {
  /** The board replica this vessel holds. */
  readonly board:        LarDoc | undefined | null;
  /** This vessel's own ledger of acts and anchors it has counted for this board (`edge-ledger`). */
  readonly kept?:        KeptEdgeRows;
  readonly authorityFor: (edgeId: string) => EdgeAuthority | undefined;
  /** The charter the board's quorum hand answers to. Absent → no quorum act counts. */
  readonly charter?:     EdgeCharter | null;
}

/** One read of an edge board: the reading per edge, what counted, and what the board no longer carries. */
export interface EdgeBoardRead {
  readonly readings: ReadonlyMap<string, EdgeReading>;
  /** Every act and anchor that counted — what the vessel keeps in its ledger. */
  readonly counted:  CountedEdgeBoard;
  /** Kept acts and anchors the board replica lacks — what the vessel writes back onto the board. */
  readonly missing:  CountedEdgeBoard;
}

/**
 * Read an edge board: union the replica with the vessel's own ledger, count, fold. THE ONE READ every door
 * takes, so no door folds a board it never checked, and none forgets an act it once counted
 * (kapae#/accretion): a raise deleted from the board still stands here, and rides back in `missing`.
 */
export async function readEdgeBoard(input: EdgeBoardInput): Promise<EdgeBoardRead> {
  const boardActs = edgeKapaeActsFromBoard(input.board);
  const boardAnchors = edgeRollAnchorsFromBoard(input.board);
  const sigKey = (s: QuorumSignature): string => `${s.signer.toLowerCase()}:${s.sig.toLowerCase()}`;
  const boardActSigs = new Map(mergeEdgeActs(boardActs).map((a) => [a.actCid, new Set(a.signatures.map(sigKey))] as const));
  const boardAnchorSigs = new Map(mergeEdgeRollAnchors(boardAnchors).map((a) => [edgeRollAnchorCid(a), new Set(a.signatures.map(sigKey))] as const));
  const lacks = (have: ReadonlySet<string> | undefined, want: readonly QuorumSignature[]): boolean =>
    have === undefined || want.some((s) => !have.has(sigKey(s)));
  const acts = new Map(mergeEdgeActs([...(input.kept?.acts ?? []), ...boardActs]).map((a) => [a.actCid, a] as const));
  const anchors = mergeEdgeRollAnchors([...(input.kept?.anchors ?? []), ...boardAnchors]);
  const counted = await countEdgeActs([...acts.values()], anchors, input.authorityFor, input.charter, input.kept?.seenAtHead);
  return {
    readings: foldEdgeReadings(counted.acts),
    counted,
    missing: {
      // A counted act or anchor the board lacks — or holds without every signature that verified here. A copy
      // whose signatures a hand swapped for false ones lacks them all, and takes the true ones back.
      acts:    counted.acts.filter((a) => lacks(boardActSigs.get(a.actCid), a.signatures)),
      anchors: counted.anchors.filter((a) => lacks(boardAnchorSigs.get(edgeRollAnchorCid(a)), a.signatures)),
    },
  };
}

/** The edges a reading map leaves SHADOWED. */
export function shadowedEdges(readings: ReadonlyMap<string, EdgeReading>): Set<string> {
  const shadowed = new Set<string>();
  for (const [edgeId, reading] of readings) if (reading.stands) shadowed.add(edgeId);
  return shadowed;
}

/** The causal heads of one edge's line under one hand, among counted acts — what the next act cites. Sorted. */
export function edgeLineHeads(counted: readonly EdgeKapae[], edgeId: string, hand: EdgeHand): string[] {
  let line = counted.filter((a) => a.edgeId === edgeId && a.hand === hand);
  // Close the ancestry to a fixed point: an act with a missing grandparent heads nothing.
  for (;;) {
    const ids = new Set(line.map((a) => a.actCid));
    const closed = line.filter((a) => a.parents.every((p) => ids.has(p)));
    if (closed.length === line.length) break;
    line = closed;
  }
  const covered = new Set(line.flatMap((a) => a.parents));
  return line.map((a) => a.actCid).filter((cid) => !covered.has(cid)).sort();
}

/**
 * What one relationship reads for a door that seats or binds its far end (kapae#/reach · #/re-admission):
 *   · `clear`    — no shadow stands and no counted raise ever named it;
 *   · `aside`    — a shadow stands: the door answers as though the relation never stood;
 *   · `owing`    — a counted raise once set it aside, its lift stands, and this vessel has not yet seen the
 *                  seat leave for every raise: an earlier seat still owes its roll;
 *   · `returned` — the lift stands and every raise got answered. Standing holds again, and the seat that
 *                  follows stands FRESH: no key and no content of the span it missed returns with it.
 *   · `unknown`  — no signed frontier of the board's raising hands qualifies (`readWideningFrontier`): absence
 *                  proves no clean history, so a widening act waits and the door seats nobody.
 */
export type EdgeStanding = "clear" | "aside" | "owing" | "returned" | "unknown";

/** `unknown` is the reading of a relation no qualifying signed frontier covers: it widens nothing and waits. */

/**
 * Read one edge's standing off its fold. An edge no counted act names reads `clear`: absent never shadows.
 * `rolled` names the raises whose seat this vessel saw LEAVE: revoked here, or gone already (`raisesSeenThrough`).
 * A raise it answered with no authority over the seat stays out, since that seat may still stand. A reader
 * that holds no ledger passes none, and reads every lifted raise as answered.
 */
export function edgeStandingOf(reading: EdgeReading | undefined, rolled?: ReadonlySet<string>): EdgeStanding {
  if (reading === undefined) return "clear";
  if (reading.stands) return "aside";
  if (reading.raiseCids.length === 0) return "clear";
  return rolled !== undefined && reading.raiseCids.some((cid) => !rolled.has(cid)) ? "owing" : "returned";
}

/** The standing as of the board's signed frontier: where none qualifies the relation reads `unknown`, never `clear`. */
export function edgeStandingAsOf(reading: EdgeReading | undefined, rolled: ReadonlySet<string> | undefined, frontierKnown: boolean): EdgeStanding {
  if (reading?.stands) return "aside";                       // a shadow narrows at once, frontier or none
  return frontierKnown ? edgeStandingOf(reading, rolled) : "unknown";
}
