/**
 * seal-ceremony — what a persona root signs for the seal ceremony, and the two rows the growth rite keeps.
 *
 * A persona root signs two things for a charter: a ROLL (the revealed key-set's hands sign the step from the
 * standing head) and a CROSSING RECORD (the outgoing and incoming sets cross-sign a handoff, and witnesses mark
 * it). Both signatures come from seeds that rest sealed, so both run behind the custody door. This module holds
 * the law that decides WHETHER a root signs: the door reads the charter that stands and the crossing that stands
 * open, and signs only what that standing state licenses. A caller names an act and a hand; it never hands in a
 * well-formed image and gets a signature back for it.
 *
 * ── A ROLL THE STANDING HEAD LICENSES ───────────────────────────────────────────────────────────
 * `licenseSealRoll` reads a roll image against the charter at this vessel's seal home:
 *   · a sealed charter stands, and the roll steps from ITS head (`prevEpochCid` names the standing head's cid);
 *   · the head pre-committed a next key-set, and the roll seats exactly that set (its keys and threshold hash to
 *     the head's commitment);
 *   · every seated key passes the Ed25519 door, and the signing root sits in the seated set;
 *   · the roll's own forward commitment does not name the charter reserve's key-set, which no verb reveals.
 * Any other roll refuses by name, however well formed.
 *
 * ── THE GROWTH RITE'S TWO ROWS (the `nexus seal` writer family) ─────────────────────────────────
 * Both rest HOT under the vessel key in the seal home:
 *   · `transition-pending.json` PREPARES: the crossing that stands open, its two key-sets, and the signatures and
 *     witness marks gathered so far.
 *   · `transitions.json` COMMITS: every sealed crossing record this vessel keeps, in order.
 * `sealCrossing` verifies the pending crossing whole, appends its record to `transitions.json` (the commit point),
 * then removes the pending row. A rite that stops after the commit and before the removal resumes: the same seal
 * finds its record already kept, keeps one copy, and removes the pending row. A pending row with no commit simply
 * stands open; kept records with no pending row read as a clean state.
 *
 * Every step reads the standing row, decides and seals under one custody holder, and a row that stands and does
 * not open, or opens to another shape, refuses by name.
 *
 * Node-main only: a worker never imports this module.
 */
import {
  SEAL_ROLL_DOMAIN, canonicalJsonBytes, charterSealState, ed25519SignerFromSeed, foundingRoster, sealKeySetHash, sealLineageHead, weakSeatOf,
  type NexusDoc, type QuorumSignature, type SealEpoch,
} from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { nexusCharterStands, readNexusDoc } from "./nexus-doc.js";
import { listPersonaRosterLines, loadPersonaGroupRootSeed } from "./node-vessel-identity.js";
import {
  reserveTransitionBytes, reserveTransitionCidOf, verifyReserveTransition, witnessSignBytes,
  type ReserveTransition, type ReserveTransitionCore, type TransitionWitness,
} from "./reserve-transition.js";
import { readCharterReserveState } from "./seal-reserve-store.js";
import { larSealHome } from "./vessel-paths.js";

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

// ── the roll ────────────────────────────────────────────────────────────────────────────────────

/**
 * Sign one charter ROLL as the persona root at `handleIndex`, when the charter that stands licenses it. `image`
 * holds the roll's bytes; they must spell, in the one canonical form, a `seal-roll` record of exactly its five
 * fields. Answers the signer's key and the signature. Every refusal names its reason and signs nothing.
 */
export async function signLicensedSealRoll(handleIndex: number, image: Uint8Array): Promise<{ readonly signer: string; readonly sig: string }> {
  const signer = await heldRoot(handleIndex);
  let record: unknown;
  try { record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(image)); } catch { record = null; }
  const f = record !== null && typeof record === "object" && !Array.isArray(record) ? record as Record<string, unknown> : null;
  const keys = f?.["keys"];
  const shaped = f !== null && Object.keys(f).length === 5 && f["kind"] === SEAL_ROLL_DOMAIN
    && typeof f["prevEpochCid"] === "string" && typeof f["next"] === "string"
    && typeof f["threshold"] === "number" && Number.isInteger(f["threshold"]) && f["threshold"] >= 1
    && Array.isArray(keys) && keys.length > 0 && keys.every((k): k is string => typeof k === "string" && HEX64.test(k));
  if (!shaped || Buffer.compare(Buffer.from(canonicalJsonBytes(f)), Buffer.from(image)) !== 0) {
    throw refuse("not-a-roll", "this door signs a charter roll in its canonical spelling, and no other image");
  }
  const roll = { prevEpochCid: f["prevEpochCid"] as string, next: f["next"] as string, threshold: f["threshold"] as number, keys: keys as string[] };
  const { head } = standingHead("roll from");
  // THE STANDING STATE LICENSES THE ROLL, or nothing signs.
  if (roll.prevEpochCid !== head.epochCid) {
    throw refuse("roll-off-the-standing-head", "the roll steps from another epoch than the head this charter stands at; a root signs a roll from the standing head alone");
  }
  if (head.nextKeyCommit.length === 0) {
    throw refuse("rotation-unarmed", "the standing head pre-committed no next key-set, so no roll from it stands licensed");
  }
  const weak = weakSeatOf(roll.keys);
  if (weak !== null) throw refuse("roll-holds-a-weak-key", `the roll seats a key the Ed25519 door refuses (${weak.refusal})`);
  if (sealKeySetHash(roll.keys, roll.threshold) !== head.nextKeyCommit) {
    throw refuse("reveal-mismatch", "the roll seats another key-set than the one the standing head pre-committed");
  }
  if (!roll.keys.some((k) => lower(k) === signer)) {
    throw refuse("signer-unseated", `the root at h${handleIndex} holds no seat in the roll's key-set, so it signs no part of it`);
  }
  const reserve = await readCharterReserveState();
  if (roll.next.length > 0 && reserve !== null && lower(roll.next) === lower(reserve.nextKeyCommit)) {
    throw refuse("reserve-commit-unrevealable", "the roll pre-commits the charter reserve's key-set, which no verb reveals: the chain would freeze at the head it opens");
  }
  return { signer, sig: await signAsRoot(handleIndex, image) };
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

/** SIGN the bound crossing as the persona root at `handleIndex`: a hand of the outgoing set, the incoming set, or both. */
export async function signCrossing(handleIndex: number): Promise<{ readonly as: string; readonly old: boolean; readonly new: boolean }> {
  const { pending, core } = await boundCrossing("no bound crossing stands — `grow open`, rotate, `grow bind` first");
  const signer = await heldRoot(handleIndex);
  const inOld = pending.oldKeys.some((k) => lower(k) === signer);
  const inNew = (pending.newKeys ?? []).some((k) => lower(k) === signer);
  if (!inOld && !inNew) throw refuse("hand-in-neither-set", "this hand sits in neither set — it may `grow witness`, never sign");
  const sig: QuorumSignature = { signer, sig: await signAsRoot(handleIndex, reserveTransitionBytes(core)) };
  const keep = (list: readonly QuorumSignature[]): QuorumSignature[] => [...list.filter((x) => lower(x.signer) !== signer), sig];
  return keepCrossingMark(core, (p) => ({
    next: { ...p, oldSigs: inOld ? keep(p.oldSigs) : p.oldSigs, newSigs: inNew ? keep(p.newSigs) : p.newSigs }, value: { as: signer, old: inOld, new: inNew },
  }));
}

/** WITNESS the bound crossing as the persona root at `handleIndex`: a key seated in NEITHER set, with a note of what it observed. */
export async function witnessCrossing(handleIndex: number, note: string): Promise<{ readonly by: string }> {
  const { pending, core } = await boundCrossing("no bound crossing stands — a witness attests a closed byte-image");
  if (note.length === 0) throw refuse("no-note", "a witness mark carries a note — what stood observed (--note)");
  const witness = await heldRoot(handleIndex);
  if ([...pending.oldKeys, ...(pending.newKeys ?? [])].some((k) => lower(k) === witness)) {
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
 * the removal resumes here: the record already kept stays one copy, and the pending row leaves (`resumed`).
 */
export async function sealCrossing(): Promise<{ readonly transitionCid: string; readonly independentWitnesses: number; readonly resumed: boolean }> {
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
  return { transitionCid: record.transitionCid, independentWitnesses: verdict.independentWitnesses, resumed };
}
