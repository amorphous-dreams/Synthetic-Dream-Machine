/**
 * place-floor-pin — the FLOOR PIN CLAIM: a place claims one exact gate pin at one head of its own KEL, and the place's own
 * presentation at that Nexus's floor gates.
 *
 * ONE RELATION. A place claims THIS gate pin at one (place AID, place-KEL seq, event digest, Nexus, tier, route), signed through
 * the place's scoped signer under the place floor pin duty (`frameFloorDuty`, `len(D) ‖ D ‖ preimage`; no sixth domain). The
 * verifier resolves the signer at the NAMED head through `verifyPlaceDutyAtHead`: a claim signed by an older signer after the
 * KEL rotated refuses. The claim names no release head: W26's release tracks floor CONTENT, the claim tracks the place's KEY
 * STATE, and nothing signs a release pointer into pin succession. The Nexus AID anchors the carrying relation and never signs
 * as the place.
 *
 * WHAT A READER FILES. A claim files only when
 *
 *   1. the statement reads whole, its pin reads whole, at floor tier, at the Nexus the reader asked, on the route asked;
 *   2. the reader's KEL rows fold to the named head (`foldClaimHead`: a walk from the head digest to the inception that is
 *      the AID, every digest, sequence, reveal and cold signature verified), and the head sits on no forked branch;
 *   3. the place's signer AT THAT HEAD signed this exact image (`verifyPlaceDutyAtHead`);
 *   4. the place stands: the signer at the head is a counted `carry` of the reader's own replica of the Nexus (a CARRIER
 *      standing), or the AID is the anchor the reader was handed apart from the card (an ANCHORED standing: the founder's own
 *      genesis, an authenticated admit, or a deliberate person-to-person transfer; a card alone never anchors).
 *
 * KEL DESCENT ORDERS THE PIN. A floor route's keys derive from the place floor key, tier, Nexus and route
 * (`gate-bundle`), so a pin changes on its route only when the place key rotates. The pair index (`admit-gate-pin`) takes the
 * claim with the lineage this reader folded: a descendant claim replaces, a known ancestor refuses (rollback), two claims at one
 * head and a forked KEL surface as a fork, and arrival order never selects. An offline reader holds its last accepted head
 * ("as of my last sync"); node and browser run this one fold.
 *
 * The sovereign tier's pins follow custody-key changes by their own signed relation; a place-KEL claim never orders them,
 * and the index refuses a claim over a sovereign pin by name.
 *
 * The statement rides the Nexus's carriage board beside the acts (a sidecar keyed by the place AID and the head, which the act
 * extractor skips), so any replica writer may carry it and none can forge it; the place's KEL rows ride the same board
 * (`place-kel-board`) and the carry bundle carries both (lar:///ha.ka.ba/lararium/mesh/place-floor-pin, whose status line names
 * its standing).
 *
 * THE PLACE ARM. A place presents the quorum's counted `carry` act over its own key at the gate's Nexus, with every
 * counted act of that relation in its causal past as the lineage the gate's reader walks (`verifyPresentedCarry`). The
 * head is the counted `carry` no other counted act of this place descends from; a counted `uncarry` that descends from it
 * leaves the place with no arm to present.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/place-floor-pin
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { CARRIAGE_ENTRY_PREFIX } from "./carriage-board.js";
import { carriageEntryActCid, foldCarriageDetails, isCarriageDescendant, resolveAnchoredChain, rollAnchorCid, type CarriageAncestry, type CarriageEntry, type RollAnchor } from "./carriage-registry.js";
import { canonicalJsonBytes, hex } from "./crypto.js";
import { frameFloorDuty, verifyPlaceDutyAtHead } from "./place-signer.js";
import { PLACE_FLOOR_PIN_DOMAIN } from "./domains.js";
import { gateBundleDigest, readGateBundlePin, type GateBundlePin } from "./gate-bundle.js";
import { PLACE_LINEAGE_BOUND, type PlaceArm } from "./gate-exchange.js";
import type { PlaceClaimStand, PlaceKelForkNote } from "./admit-gate-pin.js";
import type { KahuQuorumSeats } from "./kapae-antigen.js";
import { storedLarRecord } from "./stored-record.js";
import { PLACE_KEL_ROWS_PER_AID, decodePlaceKelEvent, foldPlaceKel, placeKelEventDigest, verifyPlaceKel, type PlaceKelEvent, type PlaceKelHead } from "./vessel-kel.js";

/** The statement's domain: a place's floor pin, and nothing any other seal signs (`domains`). */
export const PLACE_FLOOR_PIN_KIND = PLACE_FLOOR_PIN_DOMAIN;
/** The board sidecar's prefix: one tiddler per (place AID, head, route), apart from the acts. */
export const PLACE_FLOOR_PIN_PREFIX = `${CARRIAGE_ENTRY_PREFIX}place-floor-pin/` as const;

const HEX64 = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;

/** A place's signed claim of one floor pin at one head of its KEL. */
export interface PlaceFloorPinStatement {
  readonly kind: typeof PLACE_FLOOR_PIN_KIND;
  /** The place AID: the digest of its KEL inception. */
  readonly aid:  string;
  /** The sequence of the KEL head the claim names, and the digest of that head's event. */
  readonly seq:  number;
  readonly head: string;
  readonly pin:  GateBundlePin;
  readonly sig:  string;
}

export const PLACE_FLOOR_PIN_REFUSALS = [
  "statement-malformed", "pin-unreadable", "pin-not-floor", "pin-other-nexus", "pin-other-route", "head-unreadable", "kel-forked",
  "signature-refused", "place-uncarried", "place-unanchored",
] as const;
export type PlaceFloorPinRefusal = (typeof PLACE_FLOOR_PIN_REFUSALS)[number];

/** The exact bytes a place signs over its floor pin claim: the domain, its AID and head, and the pin's coordinates and digest. */
export function placeFloorPinImage(claim: { readonly aid: string; readonly seq: number; readonly head: string }, pin: GateBundlePin): Uint8Array {
  return frameFloorDuty(PLACE_FLOOR_PIN_KIND, canonicalJsonBytes({
    kind: PLACE_FLOOR_PIN_KIND, aid: claim.aid, seq: claim.seq, head: claim.head,
    nexus: pin.nexus, route: pin.route, tier: pin.tier, digest: gateBundleDigest(pin),
  }));
}

/**
 * Sign a place's floor pin claim at the head `at` (a KEL fold that verified) with the place's own signing door. The signer
 * the door holds must be the head's: a door of any other key throws, since the claim would refuse at every reader.
 */
export async function signPlaceFloorPin(args: {
  readonly at:   PlaceKelHead;
  readonly pin:  GateBundlePin;
  readonly sign: (image: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}): Promise<PlaceFloorPinStatement> {
  const { at } = args;
  if (!at || at.ok !== true) throw new Error("signPlaceFloorPin: the head does not read");
  const read = readGateBundlePin(args.pin);
  if (!("pin" in read)) throw new Error("signPlaceFloorPin: the pin does not read whole");
  const claim = { aid: at.aid, seq: at.seq, head: at.headDigest };
  const sig = hex(await args.sign(placeFloorPinImage(claim, read.pin)));
  if (!verifyPlaceDutyAtHead({ kel: at, domain: PLACE_FLOOR_PIN_KIND, image: placeFloorPinImage(claim, read.pin), sig })) {
    throw new Error("signPlaceFloorPin: the signing door does not hold the signer at the named head");
  }
  return Object.freeze({ kind: PLACE_FLOOR_PIN_KIND, ...claim, pin: read.pin, sig });
}

const ROWS_EXAMINED = PLACE_KEL_ROWS_PER_AID * 8;

/** The reading `foldClaimHead` answers: the chain to the named head, or the refusal (a fork also names its trunk). */
export type ClaimHeadReading =
  | { readonly ok: true;  readonly head: PlaceKelHead; readonly lineage: readonly string[] }
  | { readonly ok: false; readonly refusal: "head-unreadable" }
  | { readonly ok: false; readonly refusal: "kel-forked"; readonly fork: PlaceKelForkNote };

/**
 * Fold a reader's unordered KEL rows to the head a claim names: walk from the head digest back through `prev` to the
 * inception, check that inception is the AID, and verify the whole chain (`verifyPlaceKel`). Work is bounded by
 * `PLACE_KEL_ROWS_PER_AID`. A row of another AID or a torn row is noise. A head on a branch past the first fork the rows
 * show (`foldPlaceKel` reads the whole set) refuses `kel-forked` and names the trunk both branches share; a head at or before the fork's
 * common ancestor reads whole, since every branch descends from it.
 */
export function foldClaimHead(rows: readonly unknown[], aid: string, headDigest: string): ClaimHeadReading {
  if (!HEX64.test(aid) || !HEX64.test(headDigest)) return { ok: false, refusal: "head-unreadable" };
  const byDigest = new Map<string, PlaceKelEvent>();
  const decoded: PlaceKelEvent[] = [];
  for (const raw of rows.slice(0, ROWS_EXAMINED)) {
    const event = decodePlaceKelEvent(raw);
    if (event === null) continue;
    decoded.push(event);
    byDigest.set(placeKelEventDigest(event), event);
  }
  const walked: PlaceKelEvent[] = [];
  let cursor = headDigest;
  for (let step = 0; step <= PLACE_KEL_ROWS_PER_AID + 1; step++) {
    const event = byDigest.get(cursor);
    if (event === undefined) return { ok: false, refusal: "head-unreadable" };
    walked.push(event);
    if (event.t === "icp") break;
    cursor = event.prev;
  }
  if (walked[walked.length - 1]!.t !== "icp") return { ok: false, refusal: "head-unreadable" };
  const chain = walked.reverse();
  const reading = verifyPlaceKel(chain);
  if (!reading.ok || reading.aid !== aid || reading.headDigest !== headDigest) return { ok: false, refusal: "head-unreadable" };
  const lineage = chain.map(placeKelEventDigest);
  const whole = foldPlaceKel(decoded, { aid });
  if (!whole.ok && whole.refusal === "fork" && whole.commonAncestor !== undefined) {
    const at = lineage.indexOf(whole.commonAncestor);
    if (at >= 0 && at < lineage.length - 1) return { ok: false, refusal: "kel-forked", fork: { aid, trunk: lineage.slice(0, at + 1) } };
  }
  return { ok: true, head: reading, lineage };
}

/**
 * What stands a claim's place: the carriers a reader's replica of the Nexus counts (the signer AT THE HEAD must be one), or
 * the AID the reader was handed apart from the card.
 */
export type ClaimStanding =
  | { readonly via: "carrier"; readonly carriers: ReadonlySet<string> }
  | { readonly via: "anchor";  readonly aid: string };

/** One claim, read and verified: the place, the head it names, the name a dial carries for the place, and the pin. */
export interface PlaceFloorPinReading {
  readonly aid:       string;
  readonly seq:       number;
  readonly head:      string;
  /** The signer key at the head: the key a carriage peer's dial and a flow pointer's publisher name. */
  readonly signerKey: string;
  readonly pin:       GateBundlePin;
  readonly stand:     PlaceClaimStand;
}

export interface ClaimReadAt {
  readonly nexusHex: string;
  readonly route:    string;
  /** The KEL rows the reader holds for this place, unordered and unread (the carriage board's rows, a card's, a bundle's). */
  readonly kelRows:  readonly unknown[];
  readonly standing: ClaimStanding;
}

/**
 * Read one statement for a reader at `at.nexusHex` (the Nexus as a pin carries it), on `at.route`. Never throws. A
 * `kel-forked` refusal names the fork the reader met, so the caller may note it in the index.
 */
export function readPlaceFloorPin(raw: unknown, at: ClaimReadAt):
  PlaceFloorPinReading | { readonly refusal: PlaceFloorPinRefusal; readonly fork?: PlaceKelForkNote } {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { refusal: "statement-malformed" };
    const keys = Object.keys(raw).sort();
    if (keys.join(",") !== "aid,head,kind,pin,seq,sig") return { refusal: "statement-malformed" };
    const s = raw as Record<string, unknown>;
    if (s["kind"] !== PLACE_FLOOR_PIN_KIND || typeof s["aid"] !== "string" || !HEX64.test(s["aid"]) || typeof s["head"] !== "string" || !HEX64.test(s["head"])
      || typeof s["seq"] !== "number" || !Number.isSafeInteger(s["seq"]) || s["seq"] < 0
      || typeof s["sig"] !== "string" || !SIG_RE.test(s["sig"])) return { refusal: "statement-malformed" };
    const read = readGateBundlePin(s["pin"]);
    if (!("pin" in read)) return { refusal: "pin-unreadable" };
    const pin = read.pin;
    if (pin.tier !== "floor") return { refusal: "pin-not-floor" };
    if (pin.nexus !== at.nexusHex) return { refusal: "pin-other-nexus" };
    if (pin.route !== at.route) return { refusal: "pin-other-route" };
    const aid = s["aid"], head = s["head"], seq = s["seq"];
    const folded = foldClaimHead(at.kelRows, aid, head);
    if (!folded.ok) return folded.refusal === "kel-forked" ? { refusal: "kel-forked", fork: folded.fork } : { refusal: "head-unreadable" };
    if (folded.head.seq !== seq) return { refusal: "head-unreadable" };
    const claim = { aid, seq, head };
    if (!verifyPlaceDutyAtHead({ kel: folded.head, domain: PLACE_FLOOR_PIN_KIND, image: placeFloorPinImage(claim, pin), sig: s["sig"] })) {
      return { refusal: "signature-refused" };
    }
    // Last: the relation. A place the reader's own replica does not count, and no anchor names, authenticates nothing.
    if (at.standing.via === "carrier") { if (!at.standing.carriers.has(folded.head.signerKey)) return { refusal: "place-uncarried" }; }
    else if (at.standing.aid !== aid) return { refusal: "place-unanchored" };
    return Object.freeze({ aid, seq, head, signerKey: folded.head.signerKey, pin,
      stand: Object.freeze({ aid, seq, head, lineage: folded.lineage }) });
  } catch { return { refusal: "statement-malformed" }; }
}

/** The board tiddler one claim rides under: the place AID, the head digest and the route (a claim per route per head). */
export function placeFloorPinKey(statement: Pick<PlaceFloorPinStatement, "aid" | "head" | "pin">): string {
  return `${PLACE_FLOOR_PIN_PREFIX}${statement.aid}/${statement.head}/${gateBundleDigest(statement.pin)}`;
}

/** Land a statement onto a carriage board draft. Call INSIDE a `handle.change()` callback. Writes no trust: the reader decides. */
export function writePlaceFloorPin(draft: LarDoc, statement: PlaceFloorPinStatement): void {
  const key = placeFloorPinKey(statement);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(statement) }, PLACE_FLOOR_PIN_KIND);
}

/** Every statement-shaped payload a carriage board carries under the sidecar prefix, unread. */
export function placeFloorPinsFromBoard(doc: LarDoc | undefined | null): unknown[] {
  const out: unknown[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(PLACE_FLOOR_PIN_PREFIX)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try { out.push(JSON.parse(text) as unknown); } catch { /* a torn sidecar files nothing */ }
  }
  return out;
}

/** The index door a claim files through: `HearthPinIndex.fileClaim` and `noteKelFork`. */
export interface ClaimIndex {
  fileClaim(hearth: string, pin: unknown, stand: PlaceClaimStand): { readonly filed: boolean; readonly refusal?: string };
  noteKelFork(fork: PlaceKelForkNote): void;
}

/** What one filing pass did: the names that filed, the claims the reader refused, and the index's own refusals (rollback, fork). */
export interface ClaimFilingReport {
  readonly filed:   readonly string[];
  readonly refused: readonly PlaceFloorPinRefusal[];
  readonly held:    readonly string[];
}

/**
 * File every statement that reads at `at` into a pair index, each under the signer key at its head (the name a carriage
 * peer's dial carries). A claim past a KEL fork notes the fork in the index. Returns what filed, what the reader refused and
 * what the index held back (`rollback`, `fork`).
 */
export function filePlaceFloorPins(
  index: ClaimIndex,
  statements: readonly unknown[],
  at: ClaimReadAt,
  nameFor: (reading: PlaceFloorPinReading) => string = (reading) => reading.signerKey,
): ClaimFilingReport {
  const filed: string[] = [];
  const refused: PlaceFloorPinRefusal[] = [];
  const held: string[] = [];
  for (const raw of statements) {
    const read = readPlaceFloorPin(raw, at);
    if ("refusal" in read) { refused.push(read.refusal); if (read.fork) index.noteKelFork(read.fork); continue; }
    const result = index.fileClaim(nameFor(read), read.pin, read.stand);
    if (result.filed) filed.push(nameFor(read)); else held.push(result.refusal ?? "refused");
  }
  return { filed, refused, held };
}

/**
 * The place arm `placeKey` presents at a Nexus whose held root reads `roster` over `entries` (its carriage board): the
 * counted head `carry` and its counted causal past, or null where none stands, an `uncarry` closes it, or the past runs
 * past the lineage bound.
 */
export async function placeArmFor(entries: readonly CarriageEntry[], roster: KahuQuorumSeats, placeKey: string, ancestry?: CarriageAncestry): Promise<PlaceArm | null> {
  const nym = placeKey.toLowerCase();
  const counted: CarriageEntry[] = [];
  const folded = await foldCarriageDetails(entries, roster, ancestry);
  for (const [i, entry] of entries.entries()) {
    if (typeof entry?.nym !== "string" || entry.nym.toLowerCase() !== nym) continue;
    if (entry.action !== "carry" && entry.action !== "uncarry") continue;
    if (folded.entries[i]?.counted) counted.push(entry);
  }
  const byCid = new Map<string, CarriageEntry>(counted.map((e) => [carriageEntryActCid(e), e]));
  const carries = [...byCid].filter(([, e]) => e.action === "carry");
  // The head: a counted carry no other counted act of this place descends from.
  const heads = carries.filter(([cid]) => ![...byCid.keys()].some((other) => other !== cid && isCarriageDescendant(other, cid, byCid)));
  if (heads.length === 0) return null;
  const [, contract] = heads.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))[0]!;
  const lineage: CarriageEntry[] = [];
  const todo = [...contract.parents];
  const seen = new Set<string>();
  while (todo.length) {
    const cid = todo.pop()!;
    if (seen.has(cid)) continue;
    seen.add(cid);
    const node = byCid.get(cid);
    if (!node) return null;                     // a parent this replica cannot count: the gate would refuse the chain
    lineage.push(node);
    todo.push(...node.parents);
  }
  const seals = ancestry?.sealLineage ?? [];
  const anchors: RollAnchor[] = [];
  const earliest = [contract, ...lineage].reduce((at, act) => Math.min(at, seals.findIndex((e) => e.epochCid === act.sealEpochCid)), seals.length - 1);
  if (earliest >= 0 && earliest < seals.length - 1) {
    const from = earliest;
    if (from < 0) return null;
    const graph = new Map<string, { readonly parents: readonly string[] }>(
      [...counted.map((entry) => [carriageEntryActCid(entry), entry] as const),
        ...(ancestry?.anchors ?? []).map((anchor) => [rollAnchorCid(anchor), anchor] as const)]);
    let previous: RollAnchor | null = null;
    for (let i = from + 1; i < seals.length; i++) {
      const candidates = (ancestry?.anchors ?? []).filter((a) => a.sealEpochCid === seals[i]!.epochCid &&
        (previous === null || a.parents.includes(rollAnchorCid(previous))) &&
        (seals.findIndex((e) => e.epochCid === contract.sealEpochCid) >= i ||
          isCarriageDescendant(rollAnchorCid(a), carriageEntryActCid(contract), graph)));
      const selected = candidates.sort((a, b) => rollAnchorCid(a).localeCompare(rollAnchorCid(b)))[0];
      if (!selected) return null;
      anchors.push(selected);
      previous = selected;
    }
    const resolved = await resolveAnchoredChain(seals[from]!.epochCid, roster, seals, anchors);
    if (typeof resolved === "string" || "rejected" in resolved) return null;
  }
  if (lineage.length + anchors.length > PLACE_LINEAGE_BOUND) return null;
  return { kind: "place", contract, lineage: [...lineage, ...anchors], sealLineage: seals };
}
