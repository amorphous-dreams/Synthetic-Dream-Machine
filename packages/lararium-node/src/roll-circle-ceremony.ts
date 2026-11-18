/**
 * roll-circle-ceremony — what each holder's vessel does behind the custody door to roll a charter whose seats rest
 * in several vaults, over the pure circle of `roll-circle` (kahu#/seed-and-nexus, the roll law in `wax-stamp`).
 *
 * A Nexus founded across two vaults rolls the same way it founded: as files a person carries, and no clock. Each
 * vault speaks only for its own chairs, and every holder signs one image over the whole roll.
 *
 * ── THE FOUR STEPS ──────────────────────────────────────────────────────────────────────────────
 *   · OPEN: the first holder names the head it rolls from and the new rule, and contributes its chair: the
 *     successor key its card reveals (adopted as the face's seat key), or a seat key minted fresh for a chair the
 *     head never committed, and the digest of the fresh successor card its person printed and read back.
 *   · JOIN: each other holder contributes its chair the same way. A circle any hand signed takes no chair.
 *   · SIGN: once the chairs stand, each vault signs the exact image with every seat it contributed. A signature
 *     consents to the WHOLE image, so the person states, as heard from the other holders, the rule and every other
 *     chair's seat fingerprint first (the cofound's own guard): a chair a courier slipped in, or a rule it lowered,
 *     refuses by name. The circle must also carry this vault's own chairs exactly as its record holds them, and the
 *     rule the record read (a successor swapped in transit refuses by name).
 *   · ABANDON: a vault drops its open circle for a Nexus, and the seats it contributed retire. One circle per head
 *     stands open in each vault, so a lost or doomed circle never wedges the next roll.
 *   · FILE: a circle the roll law reads `complete` files the rolled charter under its AID, beside the seed; the seat
 *     keys the roll closed retire. A vault that sat a roll out files the newest charter later through the carried
 *     import, along the same lineage.
 *
 * The law decides every verdict (`judgeRollCircle`): a head that moved reads stale; the head's own count of its
 * committed successors must reveal; every added chair signs; no seated key returns; no digest spends twice.
 *
 * A step refuses before anything moves where it can: a card the head never committed, a successor this vault
 * already used, a face this vessel holds no root for, a circle off another head. A key a refused step minted retires.
 *
 * Callers: the custody door's rows `roll-circle.open|join|sign|file` (`sealed-acts`), which
 * `lares nexus seal roll open|join|sign|file` drives. The roll anchor follows the filed head
 * (`runNexusRollAnchorOpen` / `runNexusRollAnchorPartial`).
 *
 * Node-main only: a worker never imports this module.
 */
import {
  RollCircleRefusal, coldKeyFromSeed, foundingRoster, heardSeatFingerprint, joinRollCircle, judgeRollCircle, openRollCircle, readRollCircle,
  rollCircleBytes, seatFingerprint, signRollCircle, hex,
  type NexusDoc, type QuorumSignature, type RollChair, type RollCircle, type RollCircleVerdict, type SealEpoch,
} from "@lararium/mesh";
import { charterHomeFor, importCarriedCharter, type CarriedImportResult } from "./carried-set.js";
import { openedCustody } from "./custody-seat.js";
import { readNexusDoc, renderNexusDoc } from "./nexus-doc.js";
import { listPersonaRosterLines } from "./node-vessel-identity.js";
import { RollCircleRecordTorn, dropRollCircleRecord, readRollCircleRecord, readRollCircleRecords, writeRollCircleRecord, type RollCircleRecord } from "./roll-circle-record.js";
import { SealCeremonyRefusal, retireSeats, successorsHeldHere } from "./seal-ceremony.js";
import { heldSeatKey, mintSeatKey, retireSeatKey, signAsSeat, storeSeatKey } from "./seat-key-store.js";
import { larSealHome } from "./vessel-paths.js";

const refuse = (code: string, message: string): SealCeremonyRefusal => new SealCeremonyRefusal(code, message);

/** A pure refusal keeps its code and words; anything else passes through. */
function pure<T>(run: () => T): T {
  try { return run(); }
  catch (err) { if (err instanceof RollCircleRefusal) throw refuse(err.code, err.message); throw err; }
}

/** The joint charter one AID names on this vessel: its home, its doc and its verified lineage. A household seed
 *  rolls through `seal rotate`, never a circle. */
function jointCharterOrRefuse(aid: string): { readonly home: string; readonly doc: NexusDoc; readonly lineage: readonly SealEpoch[]; readonly head: SealEpoch } {
  const sealHome = larSealHome();
  const home = typeof aid === "string" ? charterHomeFor(sealHome, aid) : null;
  if (home === null) throw refuse("no-charter", "this vessel holds no charter for that Nexus — import it (`lares nexus seal import --carry`) first");
  if (home === sealHome) throw refuse("seed-rolls-by-rotate", "this vessel's own household seed rolls by `lares nexus seal rotate`; a circle rolls a charter whose seats rest in several vaults");
  const doc = readNexusDoc(home);
  if (!doc || foundingRoster(doc).sealEpochCid.length === 0 || !doc.sealLineage?.length) {
    throw refuse("charter-unseated", "the charter this vessel holds for that Nexus roots no verified head, so nothing rolls from it");
  }
  return { home, doc, lineage: doc.sealLineage, head: doc.sealLineage[doc.sealLineage.length - 1]! };
}

/** Refuse a face this vessel holds no persona root for: a seat rests under a face this vessel holds. */
async function heldFace(face: number): Promise<void> {
  if (!(await listPersonaRosterLines()).some((l) => l.handleIndex === face)) {
    throw refuse("no-root", `this vessel holds no persona root at h${face}, so no seat rests under it`);
  }
}

/** This vault's record for one Nexus; a torn record refuses by name. */
function recordOf(aid: string): RollCircleRecord | null {
  try { return readRollCircleRecord(aid); }
  catch (err) { if (err instanceof RollCircleRecordTorn) throw refuse("roll-circle-record-torn", err.message); throw err; }
}

/** Every successor digest this vault already used: in a charter it holds, or in a circle it contributed to. */
function usedHere(): Set<string> {
  const used = successorsHeldHere();
  let records: ReturnType<typeof readRollCircleRecords>;
  try { records = readRollCircleRecords(); }
  catch (err) { if (err instanceof RollCircleRecordTorn) throw refuse("roll-circle-record-torn", err.message); throw err; }
  for (const r of records) for (const c of r.chairs) used.add(c.next);
  return used;
}

/**
 * Contribute one chair: the seat key and the successor digest. A card reveals a successor the head committed and
 * becomes the face's seat key; without a card, a fresh seat key mints for an added chair.
 */
async function contribute(input: { readonly face: number; readonly card?: Uint8Array; readonly next: string }, head: SealEpoch):
  Promise<{ readonly chair: RollChair; readonly minted: boolean }> {
  await openedCustody();
  await heldFace(input.face);
  if (usedHere().has(input.next)) {
    throw refuse("successor-reused", "that successor digest already stands in a charter or a circle this vault holds; each roll mints fresh cold keys");
  }
  if (input.card === undefined) return { chair: { seat: await mintSeatKey(input.face), next: input.next }, minted: true };
  const cold = await coldKeyFromSeed(input.card);
  try {
    if (!head.nextKeyDigests.includes(cold.digest)) {
      throw refuse("card-not-committed", "the card answers no successor the head committed — a card of another chair, another charter or another generation");
    }
    if (cold.digest === input.next) throw refuse("successor-reused", "the fresh successor names the card it replaces");
    const fresh = heldSeatKey(cold.verifyingKey) === null;
    return { chair: { seat: await storeSeatKey(input.face, input.card), next: input.next }, minted: fresh };
  } finally { cold.seed.fill(0); }
}

/**
 * One circle per head stands open in each vault. A record from this head refuses a second circle by name (carry it
 * on, file it, or abandon it); a record from an older head names a circle the charter moved past, so it drops and
 * the seats it held retire where no charter seats them.
 */
async function clearForHead(aid: string, head: SealEpoch): Promise<void> {
  const standing = recordOf(aid);
  if (!standing) return;
  if (standing.predecessor === head.epochCid) {
    throw refuse("circle-open-here", "this vault already contributed to a circle from this head; carry that circle on, file it, or abandon it (`lares nexus seal roll abandon --nexus <aid>`)");
  }
  dropRollCircleRecord(aid);
  await retireSeats(standing.chairs.map((c) => c.seat));
}

export interface RollCircleStep {
  readonly circle:  RollCircle;
  readonly verdict: RollCircleVerdict;
  readonly signed:  readonly string[];
  readonly why?:    string;
}

const step = (circle: RollCircle, lineage: readonly SealEpoch[]): RollCircleStep => {
  const j = judgeRollCircle(circle, lineage);
  return { circle, verdict: j.verdict, signed: j.signed, ...(j.why ? { why: j.why } : {}) };
};

// ── open ──────────────────────────────────────────────────────────────────────────────────────

/** OPEN a circle on the joint charter `aid` names: the head it steps from, the new rule, and this vault's chair. */
export async function openRollCircleAct(input: { readonly aid: string; readonly face: number; readonly card?: Uint8Array;
  readonly next: string; readonly threshold: number }): Promise<RollCircleStep> {
  const { lineage, head } = jointCharterOrRefuse(input.aid);
  await clearForHead(input.aid, head);
  const { chair, minted } = await contribute(input, head);
  let circle: RollCircle;
  try {
    circle = pure(() => openRollCircle({ aid: input.aid, predecessor: head.epochCid, threshold: input.threshold, chair }));
    writeRollCircleRecord({ aid: input.aid, predecessor: head.epochCid, threshold: input.threshold, chairs: [chair] });
  } catch (err) {
    if (minted) await retireSeatKey(chair.seat).catch(() => false);
    throw err;
  }
  return step(circle, lineage);
}

// ── join ──────────────────────────────────────────────────────────────────────────────────────

/** JOIN a circle another vault opened: this vault's chair, from its own charter's head. */
export async function joinRollCircleAct(input: { readonly circle: unknown; readonly face: number; readonly card?: Uint8Array;
  readonly next: string }): Promise<RollCircleStep> {
  const read = readRollCircle(input.circle);
  if (!read) throw refuse("circle-torn", "the file does not read as a roll circle at its exact shape");
  const { lineage, head } = jointCharterOrRefuse(read.aid);
  if (read.predecessor !== head.epochCid) throw refuse("circle-stale", "the circle steps from another head than the charter this vessel holds");
  if (read.signatures.length > 0) throw refuse("circle-signed", "a hand already signed this circle, so no chair joins it: open a new circle from the head");
  if (read.chairs.some((c) => c.next === input.next)) throw refuse("successor-twice", "that successor digest already arms a chair in this circle");
  await clearForHead(read.aid, head);
  const { chair, minted } = await contribute(input, head);
  let circle: RollCircle;
  try {
    circle = pure(() => joinRollCircle(read, chair));
    writeRollCircleRecord({ aid: read.aid, predecessor: head.epochCid, threshold: read.threshold, chairs: [chair] });
  } catch (err) {
    if (minted) await retireSeatKey(chair.seat).catch(() => false);
    throw err;
  }
  return step(circle, lineage);
}

// ── sign ──────────────────────────────────────────────────────────────────────────────────────

/**
 * SIGN a circle with every seat this vault contributed to it, once the circle carries exactly those chairs. A circle
 * off another head, one the law already refuses, or one whose chairs differ from this vault's record signs nothing.
 */
export async function signRollCircleAct(input: {
  readonly circle: unknown;
  /** The rule the person heard the other holders agree to. */
  readonly heardThreshold: number;
  /** Every other chair's seat fingerprint, as the person heard it from that chair's holder. */
  readonly heard: readonly string[];
}): Promise<RollCircleStep> {
  await openedCustody();
  const read = readRollCircle(input.circle);
  if (!read) throw refuse("circle-torn", "the file does not read as a roll circle at its exact shape");
  const { lineage, head } = jointCharterOrRefuse(read.aid);
  const judged = judgeRollCircle(read, lineage);
  if (judged.verdict === "stale" || judged.verdict === "invalid") {
    throw refuse(`circle-${judged.verdict}`, `the circle reads ${judged.verdict} here${judged.why ? `: ${judged.why}` : ""}; nothing signs`);
  }
  const record = recordOf(read.aid);
  if (!record || record.predecessor !== head.epochCid) throw refuse("circle-unrecorded", "this vault contributed no chair to a circle from this head, so its hands sign none");
  for (const own of record.chairs) {
    const carried = read.chairs.find((c) => c.seat === own.seat);
    if (!carried) throw refuse("chair-dropped", "the circle dropped a chair this vault contributed; nothing signs");
    if (carried.next !== own.next) throw refuse("chair-moved", "the circle arms this vault's chair with another successor than the card its person read back; nothing signs");
  }
  if (read.threshold > read.chairs.length) throw refuse("circle-short", "the rule asks more seats than the circle holds chairs; let every chair join first");
  // THE WHOLE IMAGE, AS HEARD: a signature consents to every chair and the rule, never to this vault's chairs alone.
  if (read.threshold !== record.threshold) throw refuse("rule-moved", "the circle carries another rule than the one this vault read when it contributed; nothing signs");
  if (input.heardThreshold !== read.threshold) throw refuse("rule-unheard", "the rule typed as heard differs from the circle's; nothing signs");
  const own = new Set(record.chairs.map((c) => c.seat));
  const foreign = read.chairs.filter((c) => !own.has(c.seat));
  const unheard = foreign.filter((c) => !input.heard.some((h) => heardSeatFingerprint(h, c.seat)));
  if (unheard.length > 0 || input.heard.length !== foreign.length) {
    throw refuse("seat-unheard", `type every other chair's seat fingerprint as you heard it from its holder (${foreign.length} other chair(s)); the circle carries a chair no fingerprint you typed names, or you typed one it does not carry. Nothing signs`);
  }
  const signed = new Set(judged.signed);
  const hands = record.chairs.map((c) => c.seat).filter((s) => !signed.has(s));
  if (hands.length === 0) throw refuse("signed-here", "every chair this vault contributed already signed the circle");
  const bytes = rollCircleBytes(read);
  const signatures: QuorumSignature[] = [];
  for (const seat of hands) signatures.push({ signer: seat, sig: hex(await signAsSeat(seat, bytes)) });
  const circle = pure(() => signRollCircle(read, signatures));
  return step(circle, lineage);
}

// ── file ──────────────────────────────────────────────────────────────────────────────────────

/**
 * FILE a circle the roll law reads complete: the rolled charter files under its AID beside the seed, this vault's
 * record of the circle drops, and the seat keys the roll closed retire where no held charter still seats them.
 */
export async function fileRollCircleAct(input: { readonly circle: unknown }): Promise<{ readonly aid: string; readonly sealEpochCid: string;
  readonly outcome: CarriedImportResult["outcome"]; readonly path: string; readonly retired: readonly string[] }> {
  await openedCustody();
  const read = readRollCircle(input.circle);
  if (!read) throw refuse("circle-torn", "the file does not read as a roll circle at its exact shape");
  const { doc, lineage } = jointCharterOrRefuse(read.aid);
  const judged = judgeRollCircle(read, lineage);
  if (judged.verdict !== "complete" || !judged.epoch) {
    throw refuse(`circle-${judged.verdict}`, `the circle reads ${judged.verdict} here${judged.why ? `: ${judged.why}` : ""}; nothing files`);
  }
  const closing = foundingRoster(doc).keys;
  const rolled: NexusDoc = {
    ...doc, threshold: read.threshold, sealEpochCid: judged.epoch.epochCid, sealLineage: [...lineage, judged.epoch],
    kahu: read.chairs.map((c) => ({ chairLabel: seatFingerprint(c.seat), verifyingKey: c.seat })),
  };
  let filed: CarriedImportResult;
  try { filed = importCarriedCharter(larSealHome(), renderNexusDoc(rolled)); }
  catch (err) { throw refuse("charter-unfiled", err instanceof Error ? err.message : String(err)); }
  const record = recordOf(read.aid);
  dropRollCircleRecord(read.aid);
  const { retired } = await retireSeats([...closing, ...(record?.chairs.map((c) => c.seat) ?? [])]);
  return { aid: read.aid, sealEpochCid: filed.sealEpochCid, outcome: filed.outcome, path: filed.path, retired };
}

// ── abandon ───────────────────────────────────────────────────────────────────────────────────

/** ABANDON this vault's open circle for one Nexus: its record drops, and the seats it contributed retire where no
 *  charter seats them. A Nexus with no open circle here answers that nothing stood open. */
export async function abandonRollCircleAct(input: { readonly aid: string }): Promise<{ readonly aid: string; readonly abandoned: boolean; readonly retired: readonly string[] }> {
  await openedCustody();
  jointCharterOrRefuse(input.aid);
  const record = recordOf(input.aid);
  if (!record) return { aid: input.aid, abandoned: false, retired: [] };
  dropRollCircleRecord(input.aid);
  const { retired } = await retireSeats(record.chairs.map((c) => c.seat));
  return { aid: input.aid, abandoned: true, retired };
}

/** One card in the hex a person typed back, as the row receives it. */
export const cardOf = (cards: readonly Uint8Array[] | undefined): Uint8Array | undefined => {
  if (cards === undefined || cards.length === 0) return undefined;
  if (cards.length > 1) throw refuse("cards-many", "a holder reveals one chair's card per contribution");
  return cards[0];
};
