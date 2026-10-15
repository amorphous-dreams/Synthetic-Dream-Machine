/**
 * guardian-enrolment — the face's first guardian set, enrolled on this vessel (`lares persona guardian enrol`).
 *
 * A face founds one-of-one; its first guardians land by ONE typed event its own current key signs
 * (lar:///ha.ka.ba/lararium/mesh/persona-kel#/the-enrolment). This module runs that act against this vessel's own
 * rows: it reads the face's KEL head off the local board, gathers the guardian keys every OTHER face of this vessel
 * already holds (so no key serves two faces: persona-policy#/distinct-recovery), checks each guardian's possession
 * proof, signs with the face's root, and lands two things:
 *
 *   · the face's own record of its set (`guardian-set-h<N>.json`, a sealed per-face row): the registrations a
 *     later rotation reveals against the digest, and what the next enrolment of ANOTHER face reads to refuse a
 *     shared key. It lands FIRST.
 *   · the typed event on the face's KEL board. A run that stops between the two leaves a record whose digest the
 *     head does not show yet; the same command run again with the same offers lands the event. A record that
 *     names another set while the head still stands one-of-one refuses by name (`record-names-another-set`), so
 *     no rerun commits a set the record does not hold.
 *
 * The guardian's half: `guardianOffer` mints a fresh key for ONE face, at random, and answers its card code and
 * one offer line (`lar-guardian-offer:<key>:<proof>`). The key rests with the guardian, never on this vessel.
 *
 * Count, threshold, how an offer reaches the face, the veto and succession stay open (kahu#/seed-and-nexus).
 */
import { randomBytes } from "node:crypto";
import type { Repo } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  coldKeyCode, enrolGuardians, foldPersonaContests, guardianPossessionBytes, guardianRecoveryRegistrationCard, hex,
  type GuardianEnrolmentOffer, type GuardianKeysOfFace, type GuardianRecoveryRegistration, type PersonaKelEvent,
} from "@lararium/mesh";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { listPersonaRosterLines, loadPersonaGroupRootSeed } from "./node-vessel-identity.js";
import { readLocalPersonaKelEvents, seatLocalPersonaKelChain } from "./local-persona-kel.js";

/** One face's guardian-set record: its sealed row's filename. */
export const GUARDIAN_SET_FILE = /^guardian-set-h(\d+)\.json$/;
export function guardianSetFile(handleIndex: number): string {
  return `guardian-set-h${handleIndex}.json`;
}

/** What a face's record holds: the set its typed first enrolment commits, the keys a later rotation reveals. */
export interface GuardianSetRecord {
  readonly prefix:          string;
  readonly guardianSetHash: string;
  readonly threshold:       number;
  readonly guardians:       readonly GuardianRecoveryRegistration[];
}

/** Why an enrolment on this vessel refused, by name: the core's refusals and this vessel's own. */
export type GuardianEnrolmentRefusal =
  | "face-not-held"              // no root of this face stands here, or its anchors name no KEL
  | "kel-unread"                 // the board's lineage for the face reads nothing, or forks
  | "offer-malformed"            // an offer line reads as no offer
  | "record-names-another-set"   // a record stands for another set while the head still stands one-of-one
  | "face-holds-guardians" | "threshold-unmeetable" | "guardian-key-repeated" | "possession-unproven"
  | "guardian-key-serves-another-face" | "enrolment-refused";

export class GuardianEnrolmentRefused extends Error {
  constructor(readonly refusal: GuardianEnrolmentRefusal, message: string) {
    super(message);
    this.name = "GuardianEnrolmentRefused";
  }
}
const refuse = (refusal: GuardianEnrolmentRefusal, message: string): never => { throw new GuardianEnrolmentRefused(refusal, message); };

const OFFER_RE = /^lar-guardian-offer:([0-9a-f]{64}):([0-9a-f]{128})$/;

/** One offer line as a guardian's half prints it. */
export function guardianOfferLine(recoveryPubKey: string, possessionSig: string): string {
  return `lar-guardian-offer:${recoveryPubKey.toLowerCase()}:${possessionSig.toLowerCase()}`;
}

/** Read one offer line, or refuse `offer-malformed`. The slot follows the offer's place: the first reads `guardian-a`. */
export function readGuardianOffer(line: string, at: number): GuardianEnrolmentOffer {
  const m = OFFER_RE.exec(line.trim().toLowerCase());
  if (!m) return refuse("offer-malformed", `offer ${at + 1} reads as no guardian offer (lar-guardian-offer:<key>:<proof>)`);
  return {
    registration:  guardianRecoveryRegistrationCard(at % 2 === 0 ? "guardian-a" : "guardian-b", m[1]!, null),
    possessionSig: m[2]!,
  };
}

/**
 * THE GUARDIAN'S HALF: mint a fresh recovery key for ONE face (named by its prefix) at random, and answer the card
 * code the guardian keeps and the offer line the face's holder enrols. A guardian cuts a fresh key for each face.
 */
export async function guardianOffer(prefix: string): Promise<{ readonly code: string; readonly recoveryPubKey: string; readonly offer: string }> {
  if (!/^persona-[0-9a-f]{64}$/.test(prefix)) throw new Error("a guardian offer names one face by its prefix (persona-<64 hex>)");
  const seed = new Uint8Array(randomBytes(32));
  try {
    const recoveryPubKey = hex(await ed.getPublicKeyAsync(seed));
    const proof = hex(await ed.signAsync(guardianPossessionBytes(prefix, recoveryPubKey), seed));
    return { code: coldKeyCode(seed), recoveryPubKey, offer: guardianOfferLine(recoveryPubKey, proof) };
  } finally { seed.fill(0); }
}

function readRecord(bytes: Uint8Array | null): GuardianSetRecord | null {
  if (bytes === null) return null;
  const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as GuardianSetRecord;
  if (typeof raw?.prefix !== "string" || typeof raw.guardianSetHash !== "string" || !Number.isInteger(raw.threshold) || !Array.isArray(raw.guardians)) {
    throw new Error("a guardian-set row stands and reads as no record");
  }
  return raw;
}

/** One face's guardian-set record, or null where none stands. */
export async function readGuardianSet(handleIndex: number): Promise<GuardianSetRecord | null> {
  return readRecord(await readCustodyRow("identity", guardianSetFile(handleIndex)));
}

/** The guardian keys every face of this vessel but `handleIndex` holds in its set. */
export async function guardianKeysOfOtherFaces(handleIndex: number): Promise<GuardianKeysOfFace[]> {
  const out: GuardianKeysOfFace[] = [];
  for (const line of await listPersonaRosterLines()) {
    if (line.handleIndex === handleIndex) continue;
    const record = await readGuardianSet(line.handleIndex);
    if (record) out.push({ handleIndex: line.handleIndex, keys: record.guardians.map((g) => g.recoveryPubKey) });
  }
  return out;
}

/** What an enrolment answers: public parts alone. */
export interface GuardianEnrolled {
  readonly handleIndex:     number;
  readonly prefix:          string;
  readonly guardianSetHash: string;
  readonly threshold:       number;
  readonly guardians:       number;
  readonly seq:             number;
}

/**
 * ENROL the face at `handleIndex`'s first guardian set from the guardians' offer lines, at `threshold`. The record
 * lands first, then the typed event on this vessel's board. Every refusal lands before any write.
 */
export async function runGuardianEnrolment(input: {
  readonly repo:        Repo;
  readonly handleIndex: number;
  readonly offers:      readonly string[];
  readonly threshold:   number;
}): Promise<GuardianEnrolled> {
  const { repo, handleIndex, threshold } = input;
  const line = (await listPersonaRosterLines()).find((l) => l.handleIndex === handleIndex);
  const prefix = (await loadIdentityAnchors(handleIndex))?.personaKelPrefix;
  if (!line || !prefix) return refuse("face-not-held", `this vessel holds no face at h${handleIndex} with a key history to enrol on`);
  const offers = input.offers.map(readGuardianOffer);

  const fold = foldPersonaContests(await readLocalPersonaKelEvents(repo, prefix));
  const head: PersonaKelEvent | undefined = fold.kel[fold.kel.length - 1];
  if (!head || fold.fork) return refuse("kel-unread", `the key history this vessel reads for h${handleIndex} ${fold.fork ? `forks at sequence ${fold.fork.seq}` : "holds no inception"}; nothing moved`);

  const seed = await loadPersonaGroupRootSeed(handleIndex);
  try {
    const result = await enrolGuardians({
      head, guardians: offers, threshold,
      heldByOtherFaces: await guardianKeysOfOtherFaces(handleIndex),
      sign: async (bytes) => hex(await ed.signAsync(bytes, seed)),
    });
    if (!result.ok) return refuse(result.refusal, result.reason);
    const record: GuardianSetRecord = {
      prefix, guardianSetHash: result.guardianSetHash, threshold, guardians: offers.map((o) => o.registration),
    };
    await updateCustodyRow("identity", guardianSetFile(handleIndex), (standing) => {
      const held = readRecord(standing);
      if (held && held.guardianSetHash !== record.guardianSetHash) {
        return refuse("record-names-another-set", `a record of another guardian set stands for h${handleIndex} while its key history still stands one-of-one: the same offers complete that enrolment; nothing moved`);
      }
      return { plaintext: held ? null : new TextEncoder().encode(JSON.stringify(record)), value: undefined };
    });
    await seatLocalPersonaKelChain(repo, [result.event]);
    return { handleIndex, prefix, guardianSetHash: result.guardianSetHash, threshold, guardians: offers.length, seq: result.event.seq };
  } finally { seed.fill(0); }
}

/**
 * What a face shows a guardian and its holder: the prefix a guardian's offer names, the set its record holds, and
 * whether the face's key history as this vessel reads it commits that set (`committed`). A record the head does not
 * show stands PENDING: a run stopped between its two writes, or another vessel holding this face's root enrolled
 * first. A pending record still reserves its keys against every other face, the safe side of the compartment law.
 */
export async function guardianStanding(repo: Repo, handleIndex: number): Promise<{
  readonly handleIndex: number; readonly prefix: string; readonly guardianSetHash: string | null;
  readonly threshold: number | null; readonly guardians: number; readonly committed: boolean;
  readonly headSet: string | null;
}> {
  const prefix = (await loadIdentityAnchors(handleIndex))?.personaKelPrefix;
  if (!prefix) return refuse("face-not-held", `this vessel holds no face at h${handleIndex} with a key history`);
  const record = await readGuardianSet(handleIndex);
  const fold = foldPersonaContests(await readLocalPersonaKelEvents(repo, prefix));
  const head = fold.fork ? undefined : fold.kel[fold.kel.length - 1];
  const headSet = head && head.nextRecoverySetHash !== head.recoverySetHash ? head.nextRecoverySetHash : null;
  return {
    handleIndex, prefix, guardianSetHash: record?.guardianSetHash ?? null, threshold: record?.threshold ?? null,
    guardians: record?.guardians.length ?? 0, committed: record !== null && headSet === record.guardianSetHash, headSet,
  };
}
