/**
 * seal-ceremony — what a SEAT signs for the seal ceremony, how the rite arms a head, and the two rows the growth
 * rite keeps.
 *
 * A seat holds its own key (`seat-key-store`): it mints at random on this vessel, apart from every persona root
 * and every dialing leaf, and it signs what a chair signs. A seat signs two things for a charter: a ROLL (the
 * revealed key-set's hands sign the step from the standing head) and a CROSSING RECORD (the outgoing and incoming
 * sets cross-sign a handoff, and witnesses mark it). Both signatures come from keys that rest sealed, so both run
 * behind the custody door. This module holds the law that decides WHETHER a seat signs: the door reads the charter
 * that stands and the crossing that stands open, and signs only what that standing state licenses. A caller names
 * an act and a hand; it never hands in a well-formed image and gets a signature back for it.
 *
 * ── THE RITE ARMS ITSELF, AND A CHAIR'S NEXT KEY RESTS ON PAPER ──────────────────────────────────
 * `armGenesis` gives each chair that stands a seat key of its own, a sealed row of the face whose seat claim
 * stood for the chair, and answers the roster. The rite mints each chair's NEXT key in its own process as a COLD
 * key on a card, and the charter commits one digest per seat (`nextKeyDigests`, positional over the sorted
 * seated keys). `armRoll` takes the cards a person typed back, checks each revealed key against the digest the
 * standing head committed for that chair's seat, and ADOPTS it as that chair's seat key; a chair that joins
 * mints a fresh seat key and signs by possession; a chair that left drops. No caller names a key the head did
 * not commit, and no next key rests on this vessel.
 *   · A SUPERSEDED KEY RETIRES ONCE NOTHING NEEDS IT. `retireSeats` removes a seat row only when no held charter
 *     seats its key and no open crossing names it. A crossing that stands open keeps the outgoing keys until its
 *     seal, since the outgoing hands still owe it their marks. An arming settles the faces it touches first.
 *
 * ── A ROLL THE STANDING HEAD LICENSES ───────────────────────────────────────────────────────────
 * `signLicensedSealRoll` reads a roll image against the charter at this vessel's seal home:
 *   · a sealed charter stands, and the roll steps from ITS head (its one predecessor names the standing head's cid);
 *   · the head committed its seats' next keys, and the roll reveals at least the head's count of them;
 *   · every seated key passes the Ed25519 door, rests here as a seat row, and the signing seat sits among them;
 *   · the roll re-arms every seat it seats: one digest per seat, distinct, under the roll's own threshold.
 * Any other roll refuses by name, however well formed.
 *
 * Every step reads the standing row, decides and seals under one custody holder, and a row that stands and does
 * not open, or opens to another shape, refuses by name.
 *
 * Node-main only: a worker never imports this module.
 */
import {
  CHARTER_SEAT_ROLL_DOMAIN, canonicalJsonBytes, charterInceptionBytes, readCharterInceptionImage, coldKeyFromSeed, seatNextDigest, charterSealState, ed25519SignerFromSeed, emptyFoundingCharterDoc, foundingRoster,
  majorityThreshold, nexusAidOf, personasStandingForSeat, sealKeySetHash, sealLineageHead, seatFingerprint, seatedKahuKeys, weakSeatOf,
  type NexusCharterKahu, type NexusDoc, type QuorumSignature, type SealEpoch,
} from "@lararium/mesh";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { primaryNexusAid, readCarriedCharters } from "./carried-set.js";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openedCustody, readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { nexusCharterStands, readNexusDoc } from "./nexus-doc.js";
import { heldNexusLeaves } from "./nexus-leaf.js";
import { listPersonaRosterLines, loadPersonaGroupRootSeed, makeNodePersonaDeclarationStore } from "./node-vessel-identity.js";
import { heldSeatKey, mintSeatKey, retireSeatKey, seatKeysOfFace, signAsSeat, storeSeatKey } from "./seat-key-store.js";
import {
  reserveTransitionBytes, reserveTransitionCidOf, verifyReserveTransition, witnessSignBytes,
  type ReserveTransition, type ReserveTransitionCore, type TransitionWitness,
} from "./reserve-transition.js";
import { larSealHome } from "./vessel-paths.js";
import { aFaceBinds } from "./hearth-aid.js";

/** The row a crossing stands open in (it prepares), relative to the seal home. */
export const TRANSITION_PENDING_FILE = "transition-pending.json";
/** The row sealed crossing records rest in (it commits), relative to the seal home. */
export const TRANSITIONS_FILE = "transitions.json";
/** The ceremony script a crossing walks. */
export const GROWTH_RITE_URI = "lar:///ha.ka.ba/lararium/mesh/founding-runbook#/the-growth-rite";

/** A refusal the seal ceremony names: what stood in the way, in words the operator can act on. Nothing signed or written. */
export class SealCeremonyRefusal extends Error {
  override readonly name = "SealCeremonyRefusal";
  constructor(readonly code: string, message: string) { super(message); }
}
const refuse = (code: string, message: string): SealCeremonyRefusal => new SealCeremonyRefusal(code, message);

const utf8 = new TextEncoder();
const lower = (s: string): string => s.toLowerCase();
const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;

/** The sealed charter at this vessel's seal home and its head, or a refusal naming WHICH empty reading stood in the way. */
function standingHead(act: string): { readonly doc: NexusDoc; readonly head: SealEpoch } {
  const sealHome = larSealHome();
  const doc = readNexusDoc(sealHome);
  if (doc === null && nexusCharterStands(sealHome)) {
    throw refuse("charter-torn", `the charter stands but reads TORN — nothing can ${act} until it is repaired or moved aside.`);
  }
  const head = sealLineageHead(doc);
  if (!doc || !head || charterSealState(doc) !== "sealed") {
    throw refuse(doc ? "charter-unsealed" : "charter-absent", doc
      ? `the charter stands UNSEALED — its roster is written and no seal epoch is seated, so there is nothing to ${act} yet.`
      : `no charter stands here — nothing to ${act}. Found one first: \`lares nexus rite quorum\``);
  }
  // A HEAD COUNTS ONLY ON A LINEAGE THAT VERIFIES AND BINDS THE SEATED ROSTER (`foundingRoster`): every epoch
  // hash-links and every roll holds its quorums, and the head's key-set equals the chairs the charter seats. A
  // charter that parses and carries a forged or broken lineage licenses nothing.
  if (foundingRoster(doc).sealEpochCid !== head.epochCid) {
    throw refuse("charter-lineage-unverified", `the charter's seal lineage does not verify, or its head does not bind the seated roster — nothing can ${act} until the charter reads whole.`);
  }
  return { doc, head };
}

const seatedKeysOf = (doc: NexusDoc): string[] => doc.kahu.map((k) => k.verifyingKey).filter((k): k is string => k !== null);

/** The persona root held at `handleIndex`: its public key, or a refusal where this vessel holds none there. */
async function heldRoot(handleIndex: number): Promise<string> {
  const line = (await listPersonaRosterLines()).find((l) => l.handleIndex === handleIndex);
  if (!line) throw refuse("no-root", `this vessel holds no persona root at h${handleIndex}, so nothing signs there`);
  return lower(line.verifyingKey);
}

/** Sign `bytes` as the persona root at `handleIndex`; the seed opens for this one signature and zero-fills. */
async function signAsRoot(handleIndex: number, bytes: Uint8Array): Promise<string> {
  const seed = await loadPersonaGroupRootSeed(handleIndex);
  try { return await ed25519SignerFromSeed(seed)(bytes); } finally { seed.fill(0); }
}

/** Sign `bytes` as the seat `verifyingKey` names; its cold row opens for this one signature. Answers lower hex. */
async function signAsSeatHex(verifyingKey: string, bytes: Uint8Array): Promise<string> {
  return Buffer.from(await signAsSeat(verifyingKey, bytes)).toString("hex");
}

// ── the arming ──────────────────────────────────────────────────────────────────────────────────

/** The chairs that STAND: each face this vessel holds a root for whose declaration claims a seat, with its chair label. */
async function standingChairs(): Promise<ReadonlyArray<readonly [number, string]>> {
  const held = new Set((await listPersonaRosterLines()).map((l) => l.handleIndex));
  return (await personasStandingForSeat(await makeNodePersonaDeclarationStore())).filter(([index]) => held.has(index));
}

const normChair = (label: string): string => label.trim().toLowerCase();

/**
 * The quorum rule a roster takes: the caller's own where it names one, else the charter's own where it still fits
 * the roster, else a majority of the chairs. A rule past the roster refuses: no quorum could ever reach it.
 */
function thresholdFor(asked: number | undefined, doc: NexusDoc, chairs: number): number {
  if (asked !== undefined) {
    if (!Number.isInteger(asked) || asked < 1) throw refuse("threshold-malformed", `--threshold expects a whole number ≥ 1, got "${asked}"`);
    if (asked > chairs) throw refuse("threshold-past-the-roster", `--threshold ${asked} sits past the ${chairs} chair${chairs === 1 ? "" : "s"} that stood — no quorum could ever reach it`);
    return asked;
  }
  if (Number.isInteger(doc.threshold) && doc.threshold >= 1 && doc.threshold <= chairs) return doc.threshold;
  return majorityThreshold(chairs);
}

/**
 * A SEAT HOLDS ITS OWN KEY, or the arming refuses. A key that equals a persona root this vessel holds would let a
 * face's root sign as a chair, and one that equals a face's leaf at a Nexus this vessel holds a charter for would
 * put a dialing key in the quorum.
 */
async function refuseBorrowedSeats(keys: readonly string[]): Promise<void> {
  const seats = new Set(keys.map(lower));
  for (const line of await listPersonaRosterLines()) {
    if (seats.has(lower(line.verifyingKey))) {
      throw refuse("seat-holds-a-persona-root", `a chair holds the persona root at h${line.handleIndex} as its key — a seat holds its own key, apart from every root. Stand that chair again so it takes one.`);
    }
  }
  const sealHome = larSealHome();
  const aids = new Set<string>(readCarriedCharters(sealHome).keys());
  const primary = primaryNexusAid(sealHome);
  if (primary) aids.add(primary);
  for (const aid of aids) {
    for (const leaf of await heldNexusLeaves(aid)) {
      if (seats.has(lower(leaf.verifyingKey))) {
        throw refuse("seat-holds-a-nexus-leaf", `a chair holds the leaf the face at h${leaf.handleIndex} dials a Nexus with as its key — a seat holds its own key, apart from every leaf. Stand that chair again so it takes one.`);
      }
    }
  }
}

/** The face whose row holds each of `seated`, in order; a key that rests in no row here refuses by name. */
function facesOfSeats(seated: readonly string[]): number[] {
  return seated.map((key) => {
    const held = heldSeatKey(key);
    if (held === null) throw refuse("seat-unheld", "the charter seats a key that rests in no seat row on this vessel — a chair another vessel holds, or a charter seated under another kind of key; this vessel arms no head for it");
    return held.handleIndex;
  });
}

/** What an arming answers its rite: the roster to write, its seated keys and rule. The rite mints the next keys. */
export interface ArmedGenesis {
  readonly kahu:          readonly NexusCharterKahu[];
  readonly seatedKeys:    readonly string[];
  readonly threshold:     number;
  /** Seat keys this arming left behind: the rite retires them once the charter it writes stands. */
  readonly superseded:    readonly string[];
  /** The keys this arming minted: a rite that writes no charter after all retires them. */
  readonly minted:        readonly string[];
}

/**
 * ARM A GENESIS. Each chair that stands takes a seat key of its own: the key the charter already seats for that
 * chair where this vessel holds it under the same face, else a fresh one. A chair nobody stands for keeps what it
 * holds. The rite then mints each seated chair's NEXT key as a cold card in its own process, and the genesis
 * commits their digests: no next key rests here.
 *
 * It writes no charter. A chain that rolled past its genesis refuses: a roll advances it.
 */
export async function armGenesis(opts: { readonly threshold?: number } = {}): Promise<ArmedGenesis> {
  const sealHome = larSealHome();
  const standingDoc = readNexusDoc(sealHome);
  if (standingDoc === null && nexusCharterStands(sealHome)) {
    throw refuse("charter-torn", "the charter doc stands here but reads TORN or in an earlier shape — refusing to seat over it (a re-seat would re-genesis a chain that may already have rotated). Repair or move it, then seat.");
  }
  const doc = standingDoc ?? emptyFoundingCharterDoc();
  if ((doc.sealLineage?.length ?? 0) > 1) {
    throw refuse("charter-rolled", "the charter chain has already ROTATED past genesis — advance it with `lares nexus seal rotate`, never re-seat");
  }
  // A HEARTH'S AID NEVER MOVES. Once a face binds the seed charter's Nexus AID (its device edge, its dyad scope, its
  // cabal sentinel), a re-seat would mint another AID and orphan every relation bound to the first. The faces' own
  // anchors answer, never the bootstrap's pin: a re-seeded bootstrap names no face while every edge still binds.
  if (await aFaceBinds(nexusAidOf(doc))) {
    throw refuse("hearth-bound", "the seed charter stands and the face this hearth holds binds its Nexus AID — a re-seat would mint another AID and orphan every relation bound to it. Grow the charter by the roll its card arms: `lares nexus seal rotate`");
  }
  const priorSeated = seatedKahuKeys(doc).map(lower);
  // EVERY REFUSAL LANDS BEFORE ANY KEY MINTS. A chair that holds a root or a leaf as its key refuses by that name.
  // A SEAT NEVER BUILDS ON A CHARTER THIS VESSEL DID NOT FOUND: a seated key that rests in no seat row here belongs
  // to another vault, and seating beside it would merge that vault's quorum with this one.
  await refuseBorrowedSeats(priorSeated);
  const foreign = priorSeated.filter((key) => heldSeatKey(key) === null).map(seatFingerprint);
  if (foreign.length > 0) {
    throw refuse("foreign-seat", `the charter standing here seats ${foreign.length} chair(s) this vessel did not found — fingerprints ${foreign.join(", ")} — keys this vault cannot produce. Seating onto it would MERGE their quorum with yours: they would hold quorum over your Nexus using their own keys, with no further act by you. A partner's charter belongs beside yours, never beneath your seat.`);
  }
  const chairs = await standingChairs();
  if (chairs.length === 0) {
    throw refuse("no-chair-stands", "no persona stands for a chair — stand one first:\n  lares persona new <index> --name '<label>' --seat [--chair '<chair label>']");
  }
  const kahu: NexusCharterKahu[] = doc.kahu.map((k) => ({ ...k }));
  const chairAt = new Map<string, number>(kahu.map((k, i) => [normChair(k.chairLabel), i]));
  const mints: Array<{ readonly at: number; readonly face: number }> = [];
  for (const [index, chair] of chairs) {
    let at = chairAt.get(normChair(chair));
    if (at === undefined) { at = kahu.length; chairAt.set(normChair(chair), at); kahu.push({ chairLabel: chair, verifyingKey: null }); }
    // The chair keeps its key where this vessel holds that key as a row of the same face; any other chair mints.
    const seated = kahu[at]!.verifyingKey;
    if (seated && heldSeatKey(seated)?.handleIndex === index) kahu[at] = { chairLabel: kahu[at]!.chairLabel, verifyingKey: lower(seated) };
    else mints.push({ at, face: index });
  }
  const threshold = thresholdFor(opts.threshold, doc, kahu.length);
  await settleSeats([...chairs.map(([index]) => index), ...priorSeated.map((key) => heldSeatKey(key)?.handleIndex).filter((f): f is number => f !== undefined)]);

  const minted: string[] = [];
  for (const { at, face } of mints) {
    const key = await mintSeatKey(face);
    minted.push(key);
    kahu[at] = { chairLabel: kahu[at]!.chairLabel, verifyingKey: key };
  }
  const seatedKeys = kahu.map((k) => k.verifyingKey).filter((k): k is string => typeof k === "string" && k.length > 0).map(lower);
  return { kahu, seatedKeys, threshold, superseded: priorSeated.filter((k) => !seatedKeys.includes(k)), minted };
}

/** What a roll's arming answers its rite: the roster to seat and the hands that sign. The rite mints the next keys. */
export interface ArmedRoll {
  readonly kahu:       readonly NexusCharterKahu[];
  readonly seatedKeys: readonly string[];
  readonly threshold:  number;
  /** Every hand that signs the roll: each seated key, adopted or minted here. */
  readonly signers:    readonly string[];
  /**
   * The keys this roll spends: those the closing head seats, and the revealed keys of chairs that left. The rite
   * retires them once the rolled charter stands.
   */
  readonly spent:      readonly string[];
  /** The keys this arming adopted or minted: a rite whose roll refuses retires them. */
  readonly minted:     readonly string[];
}

/**
 * ARM A ROLL from the cards a person typed back. Each card's key must answer a digest the standing head committed,
 * and the digest's place names the chair: digest i commits the successor of the i-th sorted seated key, so the
 * revealed key becomes a seat row of that key's face. The chairs that STAND then seat: a chair whose card revealed
 * seats its revealed key, any other chair that stands seats a fresh key and signs by possession, and a chair
 * nobody stands for drops. It writes no charter and signs nothing. Every refusal lands before any row moves.
 */
export async function armRoll(opts: { readonly cards: readonly Uint8Array[]; readonly threshold?: number }): Promise<ArmedRoll> {
  const { doc, head } = standingHead("roll from");
  if (head.nextKeyDigests.length === 0) {
    throw refuse("rotation-unarmed", "rotation unarmed — the head epoch pre-committed no next keys, so no roll from it stands licensed");
  }
  const closing = [...new Set(seatedKeysOf(doc).map(lower))].sort();
  const closingFaces = facesOfSeats(closing);
  await refuseBorrowedSeats(closing);
  // THE CARDS READ BEFORE ANY ROW MOVES: each answers a committed digest, once, for a seat this vessel holds.
  const revealed = new Map<number, Uint8Array>();
  for (const card of opts.cards) {
    if (!(card instanceof Uint8Array) || card.length !== 32) throw refuse("card-unreadable", "a cold-key card holds 32 bytes");
    const digest = seatNextDigest((await coldKeyFromSeed(card)).verifyingKey);
    const slot = head.nextKeyDigests.indexOf(digest);
    if (slot < 0) throw refuse("card-not-committed", "a card answers no digest the standing head committed — a card of another chair's generation, another charter, or a slip of the pen");
    if (revealed.has(slot)) throw refuse("card-twice", "two cards answer one chair's digest");
    revealed.set(slot, card);
  }
  if (revealed.size < head.nextThreshold) {
    throw refuse("cards-short-of-the-revealed-quorum", `the head committed ${head.nextKeyDigests.length} chair(s) and a roll reveals ${head.nextThreshold} of them — ${revealed.size} card(s) answered`);
  }
  const chairs = await standingChairs();
  if (chairs.length === 0) {
    throw refuse("no-chair-stands", "no persona stands for a chair — a rotation seats the roster that STANDS, and none does. Stand them first: lares persona new <index> --name '<label>' --seat [--chair '<chair label>']");
  }
  const threshold = thresholdFor(opts.threshold, doc, chairs.length);
  await settleSeats([...closingFaces, ...chairs.map(([index]) => index)]);

  // ADOPT: each revealed key becomes a seat row of the face whose closing seat its digest committed.
  const minted: string[] = [];
  const adoptedOfFace = new Map<number, string>();
  for (const [slot, card] of revealed) {
    const face = closingFaces[slot]!;
    const key = await storeSeatKey(face, card);
    minted.push(key);
    adoptedOfFace.set(face, key);
  }
  const kahu: NexusCharterKahu[] = [];
  for (const [index, chair] of chairs) {
    let key = adoptedOfFace.get(index);
    if (key === undefined) { key = await mintSeatKey(index); minted.push(key); }
    kahu.push({ chairLabel: chair, verifyingKey: key });
  }
  const seatedKeys = kahu.map((k) => k.verifyingKey!);
  return {
    kahu, seatedKeys, threshold, signers: seatedKeys, minted,
    spent: [...closing, ...[...adoptedOfFace.values()].filter((k) => !seatedKeys.includes(k))],
  };
}

/** The marker a harness writes at a root it staged, and the route a staged root's custody founds under (both published). */
const TEST_SCRATCH_MARKER = ".lar-test-scratch";
const TEST_ROUTE_PASSPHRASE = "test-founding-passphrase";

/**
 * WHETHER A CARD'S READ-BACK STANDS IN. A person reads each cold-key card back on a terminal before the charter moves;
 * a harness can type nothing, so on a STAGED test root the read-back stands in. A marker alone proves nothing: a
 * marker copied onto a root sealed under another passphrase stands in for nothing, so the custody this vessel holds
 * must also prove under the published test route. A miss there spends one unlock attempt, as any miss does.
 */
export async function readBackStandsIn(): Promise<boolean> {
  const root = process.env["LAR_ROOT"];
  if (!root || !existsSync(join(root, TEST_SCRATCH_MARKER))) return false;
  const proof = await (await openedCustody()).proves([{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }]);
  return proof.reading === "proves";
}

/** Which seat keys this vessel holds among `keys`, lower-case, in the order asked. Reads names alone. */
export function heldSeatsAmong(keys: readonly string[]): string[] {
  return [...new Set(keys.map(lower))].filter((key) => HEX64.test(key) && heldSeatKey(key) !== null);
}

/** Why a seat key asked to retire stays. */
export type SeatKept = "seated" | "crossing-open";

/** The seat keys some standing record still needs, by why. Refuses where a record that might name one reads unwhole. */
async function neededSeats(): Promise<ReadonlyMap<string, SeatKept>> {
  const sealHome = larSealHome();
  const doc = readNexusDoc(sealHome);
  if (doc === null && nexusCharterStands(sealHome)) {
    throw refuse("charter-torn", "the charter stands but reads TORN — no seat key retires until it reads whole.");
  }
  // A carried charter that stands and reads unwhole might seat any key: nothing retires until it reads whole.
  let carriedNames: string[] = [];
  try { carriedNames = readdirSync(join(sealHome, "carried")); } catch { carriedNames = []; }
  for (const name of carriedNames) {
    const home = join(sealHome, "carried", name);
    if (nexusCharterStands(home) && readNexusDoc(home) === null) {
      throw refuse("carried-charter-torn", `a carried charter stands and reads TORN (${name.slice(0, 24)}…) — no seat key retires until it reads whole.`);
    }
  }
  const needed = new Map<string, SeatKept>();
  const pending = await readPending();
  for (const key of [...(pending?.oldKeys ?? []), ...(pending?.newKeys ?? [])]) needed.set(lower(key), "crossing-open");
  for (const carried of readCarriedCharters(sealHome).values()) {
    for (const key of seatedKahuKeys(carried)) needed.set(lower(key), "seated");
  }
  for (const key of seatedKahuKeys(doc)) needed.set(lower(key), "seated");
  return needed;
}

/**
 * RETIRE THE SEAT KEYS NOTHING NEEDS. Of `keys`, each one this vessel holds leaves unless a held charter seats
 * it (the primary or a carried one, as its doc reads) or a crossing that stands open names it. A key no row holds
 * reads as done. A charter that stands and reads torn, primary or carried, refuses the whole act: nothing tells a
 * needed key from a spent one there.
 */
export async function retireSeats(keys: readonly string[]): Promise<{ readonly retired: readonly string[]; readonly kept: ReadonlyArray<{ readonly key: string; readonly why: SeatKept }> }> {
  const needed = await neededSeats();
  const retired: string[] = [];
  const kept: Array<{ key: string; why: SeatKept }> = [];
  for (const key of heldSeatsAmong(keys)) {
    const why = needed.get(key);
    if (why !== undefined) kept.push({ key, why });
    else if (await retireSeatKey(key)) retired.push(key);
  }
  return { retired, kept };
}

/**
 * SETTLE THE FACES AN ARMING TOUCHES: every row of `faces` that nothing needs leaves before the arming reads them,
 * so a stopped arming's minted rows never pile up beside the live ones. Where a standing record reads unwhole the
 * settle retires nothing and the arming goes on: the arming then refuses by its own name where it must.
 */
async function settleSeats(faces: readonly number[]): Promise<void> {
  let needed: ReadonlyMap<string, SeatKept>;
  try { needed = await neededSeats(); } catch (err) { if (err instanceof SealCeremonyRefusal) return; throw err; }
  for (const face of new Set(faces)) {
    for (const key of await seatKeysOfFace(face)) if (!needed.has(key)) await retireSeatKey(key);
  }
}

// ── the roll ────────────────────────────────────────────────────────────────────────────────────

/**
 * Sign one charter ROLL as the seat whose public key `verifyingKey` names, when the charter that stands licenses
 * it. `image` holds the roll's bytes; they must spell, in the one canonical form, a `seal-roll` record of exactly
 * its five fields. Answers the signer's key and the signature. Every refusal names its reason and signs nothing.
 */
export async function signLicensedSealRoll(verifyingKey: string, image: Uint8Array): Promise<{ readonly signer: string; readonly sig: string }> {
  const signer = typeof verifyingKey === "string" ? lower(verifyingKey) : "";
  if (!HEX64.test(signer)) throw refuse("not-a-seat-key", "a seat names itself by its public key, 64 hex");
  // The seat answers first: a locked vessel refuses `CustodyLocked` before it says what it holds.
  await openedCustody();
  if (heldSeatKey(signer) === null) throw refuse("no-seat-key", "this vessel holds no seat key under that public key, so nothing signs there");
  let record: unknown;
  try { record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(image)); } catch { record = null; }
  const f = record !== null && typeof record === "object" && !Array.isArray(record) ? record as Record<string, unknown> : null;
  const keys = f?.["keys"];
  const digests = f?.["nextKeyDigests"];
  const shaped = f !== null && Object.keys(f).length === 6 && f["kind"] === CHARTER_SEAT_ROLL_DOMAIN
    && Array.isArray(f["predecessors"]) && f["predecessors"].length === 1 && typeof f["predecessors"][0] === "string"
    && typeof f["threshold"] === "number" && Number.isInteger(f["threshold"]) && f["threshold"] >= 1
    && typeof f["nextThreshold"] === "number" && Number.isInteger(f["nextThreshold"])
    && Array.isArray(keys) && keys.length > 0 && keys.every((k): k is string => typeof k === "string" && HEX64.test(k))
    && Array.isArray(digests) && digests.every((d): d is string => typeof d === "string" && HEX64.test(d));
  if (!shaped || Buffer.compare(Buffer.from(canonicalJsonBytes(f)), Buffer.from(image)) !== 0) {
    throw refuse("not-a-roll", "this door signs a charter roll in its canonical spelling, and no other image");
  }
  const roll = {
    predecessor: (f["predecessors"] as string[])[0]!, threshold: f["threshold"] as number, keys: keys as string[],
    nextKeyDigests: digests as string[], nextThreshold: f["nextThreshold"] as number,
  };
  const { head } = standingHead("roll from");
  // THE STANDING STATE LICENSES THE ROLL, or nothing signs.
  if (roll.predecessor !== head.epochCid) {
    throw refuse("roll-off-the-standing-head", "the roll steps from another epoch than the head this charter stands at; a root signs a roll from the standing head alone");
  }
  if (head.nextKeyDigests.length === 0) {
    throw refuse("rotation-unarmed", "the standing head pre-committed no next keys, so no roll from it stands licensed");
  }
  const weak = weakSeatOf(roll.keys);
  if (weak !== null) throw refuse("roll-holds-a-weak-key", `the roll seats a key the Ed25519 door refuses (${weak.refusal})`);
  // THE REVEAL: the seats whose next key the head committed, at least the head's count of them.
  const revealedSeats = roll.keys.filter((k) => head.nextKeyDigests.includes(seatNextDigest(lower(k))));
  if (revealedSeats.length < head.nextThreshold) {
    throw refuse("reveal-short", "the roll reveals fewer of the seats the standing head committed than that head's count");
  }
  if (!roll.keys.some((k) => lower(k) === signer)) {
    throw refuse("signer-unseated", "that seat sits outside the roll's key-set, so it signs no part of the roll");
  }
  // THE ROLL SEATS ONLY KEYS THIS VESSEL HOLDS, and re-arms every seat it seats.
  if (!roll.keys.every((k) => heldSeatKey(lower(k)) !== null)) {
    throw refuse("roll-seats-an-unheld-key", "the roll seats a key that rests in no seat row on this vessel, so this vessel's hands sign no part of it");
  }
  const following = roll.nextKeyDigests;
  if (following.length !== new Set(roll.keys.map(lower)).size || new Set(following).size !== following.length || roll.nextThreshold !== roll.threshold) {
    throw refuse("roll-unarmed-successor", "the roll re-arms its seats short of one distinct digest each under its own threshold, so the chain would stall at the head it opens");
  }
  return { signer, sig: await signAsSeatHex(signer, image) };
}

// ── the inception ───────────────────────────────────────────────────────────────────────────────

/**
 * Every successor commitment a charter this vessel holds has made: the primary's and each carried charter's. A
 * charter that stands and reads torn hides its commitments, so it refuses the reading rather than reading empty.
 */
function successorsHeldHere(): Set<string> {
  const sealHome = larSealHome();
  const homes = [sealHome];
  const carried = join(sealHome, "carried");
  if (existsSync(carried)) for (const name of readdirSync(carried).sort()) homes.push(join(carried, name));
  const used = new Set<string>();
  for (const home of homes) {
    const doc = readNexusDoc(home);
    if (doc === null && nexusCharterStands(home)) {
      throw refuse("charter-torn", "a charter this vessel holds reads TORN, so its committed successors cannot be read; nothing incepts until it is repaired or moved");
    }
    for (const e of doc?.sealLineage ?? []) for (const d of e.nextKeyDigests) used.add(d);
  }
  return used;
}

/**
 * Sign one charter INCEPTION as the seat `verifyingKey` names, when the image licenses it. `image` holds the
 * inception image's bytes in their one canonical spelling. The door signs only:
 *   · an image that reads at its exact shape, seats this signer, and arms every seat (no genesis arms itself blind);
 *   · a household seed (no founding) whose every seat this vessel holds: a seed never takes a foreign seat;
 *   · no joint founding yet: a joint inception signs only for an offer this vessel recorded and judged, and the
 *     cofound verbs that record one stand owed (`lares nexus seal cofound open|join|seal`);
 *   · an image whose every successor commitment no charter this vessel holds has made: a reused card would let
 *     two foundings share a successor, and the AID names one founding statement.
 * Every refusal names its reason and signs nothing.
 */
export async function signLicensedInception(verifyingKey: string, image: Uint8Array): Promise<{ readonly signer: string; readonly sig: string }> {
  const signer = typeof verifyingKey === "string" ? lower(verifyingKey) : "";
  if (!HEX64.test(signer)) throw refuse("not-a-seat-key", "a seat names itself by its public key, 64 hex");
  await openedCustody();
  if (heldSeatKey(signer) === null) throw refuse("no-seat-key", "this vessel holds no seat key under that public key, so nothing signs there");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(image)); } catch { parsed = null; }
  const read = readCharterInceptionImage(parsed);
  if (!read || Buffer.compare(Buffer.from(charterInceptionBytes(read)), Buffer.from(image)) !== 0) {
    throw refuse("not-an-inception", "this door signs a charter inception in its canonical spelling, and no other image");
  }
  if (!read.keys.includes(signer)) throw refuse("signer-unseated", "that seat sits outside the inception's key-set, so it signs no part of it");
  if (read.nextKeyDigests.length === 0) throw refuse("inception-unarmed", "the inception commits no successor, so the charter it founds could never roll");
  if (read.founding === null && !read.keys.every((k) => heldSeatKey(k) !== null)) {
    throw refuse("seed-takes-a-foreign-seat", "a household seed seats only keys this vessel holds; a partner founds a Nexus fresh, beside the seed");
  }
  if (read.founding !== null) {
    throw refuse("cofound-offer-unrecorded", "this vessel holds no judged offer for that joint founding, so no seat signs its inception");
  }
  const used = successorsHeldHere();
  if (read.nextKeyDigests.some((d) => used.has(d))) {
    throw refuse("successor-reused", "the inception commits a successor a charter this vessel holds already committed; each founding mints fresh cold keys");
  }
  return { signer, sig: await signAsSeatHex(signer, image) };
}

// ── the crossing ────────────────────────────────────────────────────────────────────────────────

/** A crossing that stands open: the outgoing set, the incoming set once bound, and what the hands gathered so far. */
export interface PendingCrossing {
  readonly fromEpochCid:  string;
  readonly oldKeys:       readonly string[];
  readonly oldThreshold:  number;
  readonly toEpochCid?:   string;
  readonly newKeys?:      readonly string[];
  readonly newThreshold?: number;
  readonly rite:          string;
  readonly oldSigs:       readonly QuorumSignature[];
  readonly newSigs:       readonly QuorumSignature[];
  readonly witnesses:     readonly TransitionWitness[];
}

const malformed = (file: string): CustodyRowUnavailable => new CustodyRowUnavailable("seal", file, "malformed");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isKeys = (v: unknown): v is string[] => Array.isArray(v) && v.every((k) => typeof k === "string" && /^[0-9a-fA-F]{64}$/.test(k));
const isThreshold = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1;
const isSigs = (v: unknown): v is QuorumSignature[] => Array.isArray(v) && v.every((s) =>
  isRecord(s) && Object.keys(s).length === 2 && typeof s["signer"] === "string" && HEX64.test(lower(s["signer"])) && typeof s["sig"] === "string" && HEX128.test(lower(s["sig"])));
const isWitnesses = (v: unknown): v is TransitionWitness[] => Array.isArray(v) && v.every((w) =>
  isRecord(w) && Object.keys(w).length === 3 && typeof w["witness"] === "string" && HEX64.test(lower(w["witness"]))
  && typeof w["note"] === "string" && w["note"].length > 0 && typeof w["sig"] === "string" && HEX128.test(lower(w["sig"])));

const PENDING_FIELDS: ReadonlySet<string> = new Set([
  "fromEpochCid", "oldKeys", "oldThreshold", "toEpochCid", "newKeys", "newThreshold", "rite", "oldSigs", "newSigs", "witnesses",
]);

function parsePending(bytes: Uint8Array): PendingCrossing {
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw malformed(TRANSITION_PENDING_FILE); }
  if (!isRecord(raw) || Object.keys(raw).some((k) => !PENDING_FIELDS.has(k))) throw malformed(TRANSITION_PENDING_FILE);
  const p = raw;
  const bound = p["toEpochCid"] !== undefined || p["newKeys"] !== undefined || p["newThreshold"] !== undefined;
  if (typeof p["fromEpochCid"] !== "string" || p["fromEpochCid"].length === 0 || !isKeys(p["oldKeys"]) || !isThreshold(p["oldThreshold"])
      || typeof p["rite"] !== "string" || !isSigs(p["oldSigs"]) || !isSigs(p["newSigs"]) || !isWitnesses(p["witnesses"])) throw malformed(TRANSITION_PENDING_FILE);
  // The far side stands whole or not at all: an epoch with no key-set, or a key-set with no epoch, reads malformed.
  if (bound && (typeof p["toEpochCid"] !== "string" || p["toEpochCid"].length === 0 || !isKeys(p["newKeys"]) || !isThreshold(p["newThreshold"]))) throw malformed(TRANSITION_PENDING_FILE);
  return p as unknown as PendingCrossing;
}

function parseKept(bytes: Uint8Array): ReserveTransition[] {
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw malformed(TRANSITIONS_FILE); }
  if (!Array.isArray(raw)) throw malformed(TRANSITIONS_FILE);
  for (const r of raw) {
    if (!isRecord(r) || Object.keys(r).length !== 9) throw malformed(TRANSITIONS_FILE);
    for (const field of ["fromEpochCid", "toEpochCid", "oldKeySetHash", "newKeySetHash", "rite", "transitionCid"]) {
      if (typeof r[field] !== "string" || (r[field] as string).length === 0) throw malformed(TRANSITIONS_FILE);
    }
    if (!isSigs(r["oldSigs"]) || !isSigs(r["newSigs"]) || !isWitnesses(r["witnesses"])) throw malformed(TRANSITIONS_FILE);
    if (r["transitionCid"] !== reserveTransitionCidOf(coreOfRecord(r as unknown as ReserveTransition))) throw malformed(TRANSITIONS_FILE);
  }
  return raw as ReserveTransition[];
}

const coreOfRecord = (r: ReserveTransition): ReserveTransitionCore =>
  ({ fromEpochCid: r.fromEpochCid, toEpochCid: r.toEpochCid, oldKeySetHash: r.oldKeySetHash, newKeySetHash: r.newKeySetHash, rite: r.rite });

/** The bound core of a pending crossing, or null while its far side stands open. */
export function boundCore(p: PendingCrossing): ReserveTransitionCore | null {
  if (!p.toEpochCid || !p.newKeys || p.newThreshold === undefined) return null;
  return {
    fromEpochCid: p.fromEpochCid, toEpochCid: p.toEpochCid,
    oldKeySetHash: sealKeySetHash(p.oldKeys, p.oldThreshold), newKeySetHash: sealKeySetHash(p.newKeys, p.newThreshold), rite: p.rite,
  };
}

const sealPending = (p: PendingCrossing): Uint8Array => utf8.encode(JSON.stringify(p));

/** Read the pending row, decide over it and seal the next one, under one custody holder. `null` from `decide` writes nothing. */
function updatePending<T>(decide: (standing: PendingCrossing | null) => { readonly next: PendingCrossing | null; readonly value: T }): Promise<T> {
  return updateCustodyRow("seal", TRANSITION_PENDING_FILE, (bytes) => {
    const d = decide(bytes === null ? null : parsePending(bytes));
    return { plaintext: d.next === null ? null : sealPending(d.next), value: d.value };
  });
}

/** The crossing that stands open, or null. */
async function readPending(): Promise<PendingCrossing | null> {
  const pending = await readCustodyRow("seal", TRANSITION_PENDING_FILE);
  return pending === null ? null : parsePending(pending);
}

/** The crossing that stands open (or null), and how many sealed records this vessel keeps. */
export async function readCrossing(): Promise<{ readonly pending: PendingCrossing | null; readonly kept: number }> {
  const pending = await readPending();
  const kept = await readCustodyRow("seal", TRANSITIONS_FILE);
  return { pending, kept: kept === null ? 0 : parseKept(kept).length };
}

/** OPEN a crossing from the standing head: capture the hands that stand before anything moves. One stands open at a time. */
export async function openCrossing(): Promise<{ readonly fromEpochCid: string; readonly oldHands: number }> {
  const { doc, head } = standingHead("open a crossing from");
  const oldKeys = seatedKeysOf(doc);
  return updatePending((standing) => {
    if (standing !== null) throw refuse("crossing-open", "a crossing already stands open — seal it or remove transition-pending.json deliberately");
    return {
      next: { fromEpochCid: head.epochCid, oldKeys, oldThreshold: doc.threshold, rite: GROWTH_RITE_URI, oldSigs: [], newSigs: [], witnesses: [] },
      value: { fromEpochCid: head.epochCid, oldHands: oldKeys.length },
    };
  });
}

/** BIND the open crossing's far side to the head the chain moved to, closing the byte-image the hands sign. */
export async function bindCrossing(): Promise<{ readonly toEpochCid: string }> {
  const { doc, head } = standingHead("bind a crossing to");
  return updatePending((p) => {
    if (p === null) throw refuse("no-crossing", "no crossing stands open — `grow open` before the rotate");
    if (head.epochCid === p.fromEpochCid) throw refuse("chain-unmoved", "the chain has not moved — rotate the succession in before binding the far side");
    if (p.toEpochCid) throw refuse("crossing-bound", "the crossing is already bound — sign, witness, and seal it");
    return { next: { ...p, toEpochCid: head.epochCid, newKeys: seatedKeysOf(doc), newThreshold: doc.threshold }, value: { toEpochCid: head.epochCid } };
  });
}

/** The bound crossing and its core, or the refusal that names why no hand may mark it yet. */
async function boundCrossing(why: string): Promise<{ readonly pending: PendingCrossing; readonly core: ReserveTransitionCore }> {
  // A mark reads the pending row alone: the kept records get read where a seal commits beside them.
  const pending = await readPending();
  const core = pending && boundCore(pending);
  if (!pending || !core) throw refuse("no-bound-crossing", why);
  return { pending, core };
}

/**
 * KEEP ONE MARK ON THE CROSSING IT WAS MADE FOR. `apply` runs over the pending row as it stands at the write, under
 * one custody holder, and only while that row still holds the crossing `core` names: a crossing another hand
 * replaced between a mark's read and its write takes no mark, and the mark refuses.
 */
export function keepCrossingMark<T>(core: ReserveTransitionCore, apply: (standing: PendingCrossing) => { readonly next: PendingCrossing; readonly value: T }): Promise<T> {
  return updatePending((standing) => apply(sameCrossing(standing, core)));
}

/**
 * Remove the pending row, only while it still holds the crossing whose record carries `transitionCid`: the check
 * and the removal share one custody hold, so a crossing opened after a seal's commit never leaves with it.
 * Answers whether the row left.
 */
export function dropPendingCrossing(transitionCid: string): Promise<boolean> {
  return removeCustodyRow("seal", TRANSITION_PENDING_FILE, (bytes) => {
    const core = boundCore(parsePending(bytes));
    return core !== null && reserveTransitionCidOf(core) === transitionCid;
  });
}

/** The same bound crossing still stands at the write: a crossing another hand re-opened meanwhile takes no mark. */
function sameCrossing(standing: PendingCrossing | null, core: ReserveTransitionCore): PendingCrossing {
  const now = standing && boundCore(standing);
  if (!standing || !now || reserveTransitionCidOf(now) !== reserveTransitionCidOf(core)) {
    throw refuse("crossing-moved", "the crossing moved under this mark; nothing was kept — read it again");
  }
  return standing;
}

/** The seat keys of either set that rest as rows of face `handleIndex`, lower-case, each once. Reads names alone. */
function seatsOfFaceIn(handleIndex: number, sets: readonly (readonly string[])[]): string[] {
  const out = new Set<string>();
  for (const key of sets.flat().map(lower)) if (heldSeatKey(key)?.handleIndex === handleIndex) out.add(key);
  return [...out].sort();
}

/**
 * SIGN the bound crossing as the face at `handleIndex`: each seat key that face holds in the outgoing set, the
 * incoming set, or both signs once. A face that holds a chair across the roll holds one key in each set, and both sign.
 */
export async function signCrossing(handleIndex: number): Promise<{ readonly as: readonly string[]; readonly old: boolean; readonly new: boolean }> {
  const { pending, core } = await boundCrossing("no bound crossing stands — `grow open`, rotate, `grow bind` first");
  const oldSet = new Set(pending.oldKeys.map(lower)), newSet = new Set((pending.newKeys ?? []).map(lower));
  const seats = seatsOfFaceIn(handleIndex, [pending.oldKeys, pending.newKeys ?? []]);
  if (seats.length === 0) throw refuse("hand-in-neither-set", `the face at h${handleIndex} holds no seat key in either set — it may \`grow witness\`, never sign`);
  const sigs: QuorumSignature[] = [];
  for (const signer of seats) sigs.push({ signer, sig: await signAsSeatHex(signer, reserveTransitionBytes(core)) });
  const keep = (list: readonly QuorumSignature[], set: ReadonlySet<string>): QuorumSignature[] => {
    const mine = sigs.filter((s) => set.has(s.signer));
    return [...list.filter((x) => !mine.some((m) => m.signer === lower(x.signer))), ...mine];
  };
  return keepCrossingMark(core, (p) => ({
    next: { ...p, oldSigs: keep(p.oldSigs, oldSet), newSigs: keep(p.newSigs, newSet) },
    value: { as: seats, old: seats.some((k) => oldSet.has(k)), new: seats.some((k) => newSet.has(k)) },
  }));
}

/** WITNESS the bound crossing as the persona root at `handleIndex`: a face that holds a seat in NEITHER set, with a note of what it observed. */
export async function witnessCrossing(handleIndex: number, note: string): Promise<{ readonly by: string }> {
  const { pending, core } = await boundCrossing("no bound crossing stands — a witness attests a closed byte-image");
  if (note.length === 0) throw refuse("no-note", "a witness mark carries a note — what stood observed (--note)");
  const witness = await heldRoot(handleIndex);
  // A witness stands outside both sets: its face holds no seat key in either, and its own key sits in neither.
  if (seatsOfFaceIn(handleIndex, [pending.oldKeys, pending.newKeys ?? []]).length > 0
      || [...pending.oldKeys, ...(pending.newKeys ?? [])].some((k) => lower(k) === witness)) {
    throw refuse("keyholder-witness", "a keyholder attests as a party — `grow sign`, never witness");
  }
  const mark: TransitionWitness = { witness, note, sig: await signAsRoot(handleIndex, witnessSignBytes(core, note)) };
  return keepCrossingMark(core, (p) => ({
    next: { ...p, witnesses: [...p.witnesses.filter((w) => lower(w.witness) !== witness), mark] }, value: { by: witness },
  }));
}

/**
 * SEAL the bound crossing: verify it whole, COMMIT its record to `transitions.json`, then remove the pending row.
 * A crossing that does not verify refuses, and the pending row stands. A seal that committed and stopped before
 * the removal resumes here: the record already kept stays one copy, and the pending row leaves (`resumed`). The
 * outgoing set's seat keys then retire, each one no held charter still seats (`retired`).
 */
export async function sealCrossing(): Promise<{ readonly transitionCid: string; readonly independentWitnesses: number; readonly resumed: boolean; readonly retired: number | null }> {
  const { pending, core } = await boundCrossing("no bound crossing stands — nothing to seal");
  const record: ReserveTransition = {
    ...core, transitionCid: reserveTransitionCidOf(core),
    oldSigs: [...pending.oldSigs], newSigs: [...pending.newSigs], witnesses: [...pending.witnesses],
  };
  const verdict = await verifyReserveTransition(record, {
    oldKeys: pending.oldKeys, oldThreshold: pending.oldThreshold, newKeys: pending.newKeys!, newThreshold: pending.newThreshold!,
  });
  if (!verdict.ok) throw refuse("crossing-unverified", `crossing REFUSED (fail-closed): ${verdict.reason} — the pending crossing stands; nothing written.`);
  // THE COMMIT POINT: the record rests in `transitions.json`, once.
  const resumed = await updateCustodyRow("seal", TRANSITIONS_FILE, (bytes) => {
    const kept = bytes === null ? [] : parseKept(bytes);
    if (kept.some((r) => r.transitionCid === record.transitionCid)) return { plaintext: null, value: true };
    return { plaintext: utf8.encode(JSON.stringify([...kept, record])), value: false };
  });
  await dropPendingCrossing(record.transitionCid);
  // THE OUTGOING KEYS OWE NOTHING MORE. Their marks rest in the kept record, so each one the charter no longer
  // seats retires here. A retirement that refuses leaves the record kept and the rows standing (`retired: null`).
  let retired: number | null = null;
  try { retired = (await retireSeats(pending.oldKeys)).retired.length; } catch { retired = null; }
  return { transitionCid: record.transitionCid, independentWitnesses: verdict.independentWitnesses, resumed, retired };
}
