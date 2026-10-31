/**
 * persona-kel — the per-PersonaGroup KEY-EVENT-LOG: a stable identifier PREFIX the operational signing
 * key rotates BENEATH. Reading-B (identity-classes#reading-b-recovery) rotates the op-key rather than
 * resurrecting it, so continuity CANNOT ride the op-key — it rides this log. The module lifts the charter's
 * proven epoch-chain machinery (wax-stamp: SealEpoch / verifySealLineage / rotateSealEpoch) DOWN to
 * persona scale; it invents nothing structural, it re-sites what stands.
 *
 * The invariant (identity-classes#the-continuity-anchor):
 *   · the IDENTIFIER PREFIX — a content-address over the inception op-key + the pre-committed recovery-set
 *     digest — stays FIXED across every rotation (the KERI autonomic-identifier / AID),
 *   · each event SEATS one operational key (`opKeyDid`); the LATEST head carries the authoritative key,
 *   · a rotation ADVANCES the head, hash-linked onto its predecessor; the old op-key SUPERSEDES, never
 *     revives (evict runs forward-only — identity-classes#reading-b-recovery §4).
 *
 * FORK B — threshold-attest (identity-classes#the-two-forks): inception pre-commits the k-of-n DIGEST of
 * the recovery contacts' recovery PUBLIC keys (`sealKeySetHash`); a rotation carries k recovery contact SIGNATURES over
 * the event bytes, verified against that pre-commit. NOTHING reconstructs — no secret ever assembles. The
 * recovery authority signs ONLY rotations, never content; a thief of today's op-key learns nothing of it.
 *
 * RECOVERY CONTACT ENROLMENT (stable-founding-road#/rulings, "Recovery contact enrolment's shape"): a face founds one-of-one, its
 * genesis set naming its own recovery alone. Its first recovery contact set arrives by ONE typed event, `recovery-contact-enrolment`,
 * that the face's own CURRENT op-key signs: it keeps the prefix and the op-key and commits the set and threshold as
 * the rolling commitment. Every later change to the set takes the recovery contacts' quorum, by rotation.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/persona-kel
 */

import { PERSONA_KEL_DOMAIN, SEALED_ENROLMENT_DOMAIN } from "./domains.js";
import { sha256HexSync, canonicalJson, canonicalJsonBytes } from "./crypto.js";
import { sealKeySetHash } from "./wax-stamp.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import { verifyDeviceDelegation, type DeviceDelegationTiddler } from "./device-delegation.js";
import { verifyingKeyFromDid } from "./lar-did.js";
import { acceptEd25519Key, verifyEd25519 } from "./ed25519-door.js";

const KEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const HEX_RE = /^[0-9a-f]+$/;
const DIGEST_RE = /^[0-9a-f]{64}$/;

/** The domain the persona-KEL prefix + event bytes tag — separates a persona AID from every other hash. */
export { PERSONA_KEL_DOMAIN } from "./domains.js";

/**
 * A rotation's ENROLMENT of one remaining device, as the persona-KEL carries it: one box sealed to that device's
 * key, holding its re-delegated edge and the next secret together, and the fresh op-key's signature over the box.
 * It names no device. The box's sender key is fresh, its salt binds the group, the op-key and the device, and only
 * that device's own key opens it, so a board reader learns how many boxes ride an event and nothing of whom they
 * address. The device finds its own by trial-open (`GroupSecretOpener.enrolment`).
 */
export interface SealedEnrolment {
  readonly kind: "sealed-enrolment";
  /** The box, hex: the sender's fresh ephemeral X25519 key, the AEAD nonce, the ciphertext. */
  readonly e: string;
  readonly n: string;
  readonly c: string;
  /** The event's op-key's signature over the box (`sealedEnrolmentBytes`). */
  readonly sig: string;
}

/** The bytes the event's op-key signs over one sealed enrolment: the group, the op-key and the whole box. */
export function sealedEnrolmentBytes(prefix: string, opKeyDid: string, box: Pick<SealedEnrolment, "e" | "n" | "c">): Uint8Array {
  return canonicalJsonBytes({
    domain:   SEALED_ENROLMENT_DOMAIN,
    prefix,
    opKeyDid: opKeyDid.toLowerCase(),
    e: box.e, n: box.n, c: box.c,
  });
}

/** True when `raw` reads as a sealed enrolment the op-key `opKeyDid` signed for the group `prefix`. */
export async function verifySealedEnrolment(raw: unknown, prefix: string, opKeyDid: string): Promise<boolean> {
  return sealedEnrolmentVerifies(raw, prefix, opKeyDid);
}

function sealedEnrolmentVerifies(raw: unknown, prefix: string, opKeyDid: string): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const s = raw as Partial<Record<keyof SealedEnrolment, unknown>>;
  if (s.kind !== "sealed-enrolment") return false;
  if (typeof s.e !== "string" || !KEY_RE.test(s.e)) return false;
  if (typeof s.n !== "string" || !HEX_RE.test(s.n) || typeof s.c !== "string" || !HEX_RE.test(s.c)) return false;
  if (typeof s.sig !== "string" || !SIG_RE.test(s.sig)) return false;
  return signatureHolds(s.sig, sealedEnrolmentBytes(prefix, opKeyDid, s as SealedEnrolment), verifyingKeyFromDid(opKeyDid));
}

/** One Ed25519 signature over `bytes` under the hex key `keyHex`; a malformed signature or key holds nothing. */
function signatureHolds(sigHex: string, bytes: Uint8Array, keyHex: string): boolean {
  const key = keyHex.replace(/^0x/, "").toLowerCase();
  if (!KEY_RE.test(key) || !SIG_RE.test(sigHex)) return false;
  try { return verifyEd25519(sigHex, bytes, key); }
  catch { return false; }
}

/**
 * The digest of an event's enrolment list, in order — what its content address commits, so the list the board
 * carries is the list the rotation's quorum attested. A stripped, added, swapped or reordered enrolment moves it.
 * An event that enrols no one commits the empty list's digest.
 */
export function enrolmentDigestOf(enrolments: readonly SealedEnrolment[]): string {
  return sha256HexSync(canonicalJson({
    domain:     PERSONA_KEL_DOMAIN,
    part:       "enrolments",
    enrolments: enrolments.map((x) => ({ e: x.e, n: x.n, c: x.c, sig: x.sig })),
  }));
}

/** True when the enrolments an event carries match the digest its content address commits. */
export function enrolmentsAttested(event: Pick<PersonaKelEvent, "enrolments" | "enrolmentDigest">): boolean {
  const list = event.enrolments ?? [];
  if (!Array.isArray(list)) return false;
  try { return enrolmentDigestOf(list) === event.enrolmentDigest; } catch { return false; }
}

/**
 * One event in a persona's pre-rotated, hash-linked key-event-log. Content-addressed by `eventCid`.
 *
 * At INCEPTION (seq 0): `recoveryRoster` stays EMPTY and `recoveryThreshold` reads 0 — inception commits
 * only the recovery DIGEST (`recoverySetHash`), never the roster (the KERI pre-rotation reveal happens at
 * the rotation, never before). At a ROTATION (seq > 0): the roster REVEALS (its digest MUST recompute to
 * the carried `recoverySetHash`) and `rotationSigs` carries ≥ threshold DISTINCT recovery contact signatures.
 */
export interface PersonaKelEvent {
  readonly seq:               number;              // monotonic sequence; inception = 0
  readonly eventCid:          string;             // content-address of THIS event (its own hash)
  readonly prefix:            string;             // the STABLE identifier (AID) — fixed across every rotation
  readonly opKeyDid:          string;             // "0x"+hex — the operational key this event SEATS (head = authoritative)
  readonly recoverySetHash:   string;             // the GENESIS recovery digest — folded into the prefix, fixed for life (anti-swap)
  readonly nextRecoverySetHash: string;           // the ROLLING commitment — the set that authorizes the NEXT rotation; grafts per event
  readonly recoveryRoster:    readonly string[];  // the n recovery contact recovery pubkeys — EMPTY at inception, REVEALED at a rotation
  readonly recoveryThreshold: number;             // k — REVEALED at a rotation (0 at inception; folded into recoverySetHash)
  readonly prevEventCid:      string | null;      // hash-link to the predecessor (null at inception)
  readonly provisional:       boolean;            // a recovery rotation NOT yet hardened — kapae-reversible authority only
  readonly vetoOfCid:         string | null;      // a VETO names the provisional it kills; null on every other kind
  readonly rotationSigs:      readonly QuorumSignature[]; // [] at inception; ≥ threshold recovery contact sigs on a rotation
  readonly vetoSig?:          string | null;      // the standing op-key's signature over a veto's bytes (outside the cid, like rotationSigs)
  /** The event's type where it names one: `recovery-contact-enrolment` alone. A rotation and a veto carry none, so their
   *  bytes read as they always read; a kind rides the cid and every signature over it. */
  readonly kind?:             typeof RECOVERY_CONTACT_ENROLMENT_KIND;
  /** The standing op-key's signature over an enrolment's bytes (outside the cid, like `vetoSig`). */
  readonly enrolSig?:         string | null;
  /** An enrolment's count of recovery contacts and its threshold, in the signed bytes: the KEL verifier refuses any
   *  enrolment that is not three at two (operator, 2026-10-31, "2 of 3"). Absent on every other kind. */
  readonly enrolCount?:       number;
  readonly enrolThreshold?:   number;
  /** The digest of the enrolment list this event carries (`enrolmentDigestOf`) — bound into the cid and the
   *  rotation's quorum bytes, so the list is attested as one with the rotation. */
  readonly enrolmentDigest:   string;
  /** The devices this event's op-key RE-ENROLS — one sealed box per device, holding its edge and the next
   *  PersonaGroup secret, signed by the event's own op-key and naming no device (`SealedEnrolment`). A device left
   *  out finds no box that opens for it, which is how a rotation revokes. */
  readonly enrolments?:       readonly SealedEnrolment[];
}

/** The authority fields an event's content-address + the recovery contact signatures BOTH bind — the fields a
 *  rotation attests over. The revealed roster/threshold ride OUTSIDE (verified against `recoverySetHash`,
 *  which IS bound here), so re-carrying an event never re-signs it (the kapae-antigen sig-outside pattern). */
type PersonaEventCore = Pick<
  PersonaKelEvent,
  "seq" | "prefix" | "opKeyDid" | "recoverySetHash" | "nextRecoverySetHash" | "prevEventCid" | "provisional" | "vetoOfCid"
  | "enrolmentDigest" | "kind" | "enrolCount" | "enrolThreshold"
>;

/** The law of the set (operator ruling, 2026-10-31, "2 of 3"): three recovery contacts, any two of whom restore the Handle. */
export const RECOVERY_CONTACT_COUNT = 3;
export const RECOVERY_CONTACT_THRESHOLD = 2;

/** The one typed event kind: a one-of-one face's first recovery contact set, signed by its own current op-key. */
export const RECOVERY_CONTACT_ENROLMENT_KIND = "recovery-contact-enrolment" as const;

/** The canonical bytes an event's cid commits AND each recovery contact rotation-signature signs over. Binding the
 *  seq + prefix + the seated op-key + the recovery-commit + the prev-link ties a recovery contact attestation to
 *  the EXACT rotation context — a signature never replays onto a different head, op-key, or fork. */
export function personaEventBytes(core: PersonaEventCore): Uint8Array {
  return canonicalJsonBytes({
    domain:          PERSONA_KEL_DOMAIN,
    seq:             core.seq,
    prefix:          core.prefix,
    opKeyDid:        core.opKeyDid,
    recoverySetHash: core.recoverySetHash,
    nextRecoverySetHash: core.nextRecoverySetHash,
    prevEventCid:    core.prevEventCid,
    provisional:     core.provisional,
    vetoOfCid:       core.vetoOfCid,
    enrolmentDigest: core.enrolmentDigest,
    ...kindPart(core),
  });
}

/** The kind as the bound bytes carry it: present on a typed event, absent on a rotation and a veto. */
function kindPart(core: Pick<PersonaEventCore, "kind" | "enrolCount" | "enrolThreshold">): { readonly kind?: string; readonly enrolCount?: number; readonly enrolThreshold?: number } {
  return {
    ...(core.kind === undefined ? {} : { kind: core.kind }),
    ...(core.enrolCount === undefined ? {} : { enrolCount: core.enrolCount }),
    ...(core.enrolThreshold === undefined ? {} : { enrolThreshold: core.enrolThreshold }),
  };
}

/** The content-address of a persona-KEL event — a hash BINDING its authority core. A single bit-flip in any
 *  bound field yields a different cid, so the `eventCid` the next event hash-links against is tamper-evident. */
export function personaEventCidOf(core: PersonaEventCore): string {
  return `pkel${core.seq}-${sha256HexSync(canonicalJson({
    domain:          PERSONA_KEL_DOMAIN,
    seq:             core.seq,
    prefix:          core.prefix,
    opKeyDid:        core.opKeyDid,
    recoverySetHash: core.recoverySetHash,
    nextRecoverySetHash: core.nextRecoverySetHash,
    prevEventCid:    core.prevEventCid,
    provisional:     core.provisional,
    vetoOfCid:       core.vetoOfCid,
    enrolmentDigest: core.enrolmentDigest,
    ...kindPart(core),
  }))}`;
}

/**
 * The persona identifier PREFIX (AID) — a content-address over the INCEPTION op-key + the pre-committed
 * recovery-set digest. It stays FIXED for the persona's whole life; every rotation carries it unchanged.
 * Binding the recovery digest INTO the prefix walls off a swap: no attacker incepts a DIFFERENT recovery
 * set under the same identifier (identity-classes#the-continuity-anchor).
 */
export function personaPrefixOf(inceptionOpKeyDid: string, recoverySetHash: string): string {
  return `persona-${sha256HexSync(canonicalJson({
    domain:          PERSONA_KEL_DOMAIN,
    op:              inceptionOpKeyDid,
    recoverySetHash,
  }))}`;
}

/**
 * Seat the INCEPTION event (seq 0, no predecessor) from the founding op-key + a PRE-COMMITMENT to the
 * recovery contacts' recovery key-set (its digest, `sealKeySetHash`). The founding op-key seats itself here
 * self-authorized — exactly as today's founder edge self-signs; the recovery keys never sign until a
 * rotation reveals them, so a compromise of the operational PRESENT cannot forge the recovery FUTURE.
 *
 * The caller derives `recoverySetHash` from the recovery PUBLIC keys via `sealKeySetHash` (order-blind,
 * threshold-folded): a face founds one-of-one, its own self-recovery key alone (identity-classes#the-two-forks).
 * NO PREFIX INCEPTS UNARMED: an empty digest names a face no recovery can ever rotate, so the mint refuses it, and
 * so does every reader (`inceptionStructureFault`).
 */
export function mintPersonaInception(opKeyDid: string, recoverySetHash: string): PersonaKelEvent {
  const weak = weakKeyFault("the inception's op-key", opKeyDid);
  if (weak) throw new Error(`persona inception — ${weak}`);
  if (recoverySetHash.length === 0) throw new Error("persona inception — unarmed: the inception commits no recovery set");
  const prefix = personaPrefixOf(opKeyDid, recoverySetHash);
  // The genesis set fills BOTH slots: it is the prefix's anti-swap wall AND the first rotation's authority.
  const core: PersonaEventCore = {
    seq: 0, prefix, opKeyDid, recoverySetHash, nextRecoverySetHash: recoverySetHash, prevEventCid: null, provisional: false, vetoOfCid: null,
    enrolmentDigest: enrolmentDigestOf([]),   // inception enrols no one on the KEL: each device's seal rides its enrolment
  };
  return {
    ...core,
    eventCid:          personaEventCidOf(core),
    recoveryRoster:    [],   // inception commits only the DIGEST — the reveal rides a rotation
    recoveryThreshold: 0,
    rotationSigs:      [],
  };
}

/**
 * The exact bytes each recovery contact SIGNS to attest a rotation — the (head, fresh-op-key) rotation request,
 * bound to the next seq + the stable prefix + the recovery-commit + the prev-link. The recovering vessel
 * hands THESE bytes to each recovery contact; each signs with their OWN recovery key and returns a signature, and
 * NOTHING assembles (no seed, no share). `mintPersonaRotation` recomputes the identical bytes to verify.
 */
export function personaRotationSigningBytes(
  head: PersonaKelEvent, freshOpKeyDid: string, nextRecoverySetHash: string = head.nextRecoverySetHash,
  provisional = false, enrolments: readonly SealedEnrolment[] = [],
): Uint8Array {
  return personaEventBytes({
    seq:             head.seq + 1,
    prefix:          head.prefix,
    opKeyDid:        freshOpKeyDid,
    recoverySetHash: head.recoverySetHash,          // the genesis wall, carried unchanged
    nextRecoverySetHash,                            // the graft rides INSIDE the signed bytes
    prevEventCid:    head.eventCid,
    provisional,                                    // the marker rides the signed bytes too
    vetoOfCid:       null,
    enrolmentDigest: enrolmentDigestOf(enrolments), // the recovery contacts attest the re-enrolments with the rotation
    ...lawPart(head),                               // the standing law rides the signed bytes of every rotation
  });
}

/** A rotation attempt's outcome — the advanced event, or a fail-closed REFUSAL naming the mismatch. */
export type PersonaRotateResult =
  | { readonly ok: true;  readonly event: PersonaKelEvent }
  | { readonly ok: false; readonly reason: string };

/**
 * Advance the KEL: REVEAL the pre-committed recovery contact recovery roster and seat a FRESH operational key,
 * authorized by ≥ threshold DISTINCT recovery contact signatures over the event bytes. FAILS CLOSED five ways —
 * an unarmed head (empty `recoverySetHash`) refuses; a revealed roster whose digest does not match the
 * head's `recoverySetHash` refuses (a forged / wrong-threshold reveal); below-threshold DISTINCT valid
 * signers refuses; a signer absent from the revealed roster does not count; a signature that does not
 * verify over the event bytes does not count. The minted event hash-links to `head.eventCid`, so
 * `verifyPersonaKel` walks an unbroken lineage through it.
 *
 * NOTHING reconstructs — the recovery contacts each SIGN their own attestation; no seed or share ever assembles.
 * The prefix + `recoverySetHash` carry forward UNCHANGED (the identifier survives; the op-key turns over).
 */
export async function mintPersonaRotation(input: {
  readonly head:              PersonaKelEvent;
  readonly freshOpKeyDid:     string;               // the operational key the recovering vessel just minted
  readonly recoveryRoster:    readonly string[];    // the REVEALED n recovery contact recovery pubkeys
  readonly recoveryThreshold: number;               // k — the reveal must hash to the HEAD's rolling commitment
  readonly rotationSigs:      readonly QuorumSignature[]; // the gathered recovery contact signatures over the event bytes
  /** The NEXT recovery-set digest this rotation commits — the graft. Absent, the standing commitment
   *  carries forward: a set change is always an explicit act, never a silent drop. */
  readonly nextRecoverySetHash?: string;
  /** A recovery rotation entering the contest window (Fork C) — kapae-reversible authority until an
   *  observer hardens it; the standing op-key's veto kills it at any causal distance. */
  readonly provisional?: boolean;
  /** The devices this rotation RE-ENROLS (`rollEnrolments`), each sealed and signed by the fresh op-key. Their
   *  digest rides the cid and the quorum bytes, so rotation and enrolment land as ONE act. */
  readonly enrolments?: readonly SealedEnrolment[];
}): Promise<PersonaRotateResult> {
  const { head, freshOpKeyDid, recoveryRoster, recoveryThreshold, rotationSigs } = input;
  const enrolments = input.enrolments ?? [];
  const nextRecoverySetHash = input.nextRecoverySetHash ?? head.nextRecoverySetHash;
  if (head.nextRecoverySetHash.length === 0) {
    return { ok: false, reason: "rotation unarmed — the head event carries no rolling recovery commitment" };
  }
  const weak = weakKeyFault("the fresh op-key", freshOpKeyDid);
  if (weak) return { ok: false, reason: weak };
  if (sealKeySetHash(recoveryRoster, recoveryThreshold) !== head.nextRecoverySetHash) {
    return { ok: false, reason: "reveal mismatch — the revealed recovery roster does not match the head's rolling commitment" };
  }
  const core: PersonaEventCore = {
    seq:             head.seq + 1,
    prefix:          head.prefix,          // the identifier stays FIXED
    opKeyDid:        freshOpKeyDid,
    recoverySetHash: head.recoverySetHash, // the GENESIS wall carries forward unchanged
    nextRecoverySetHash,                   // the graft: the set that authorizes the NEXT rotation
    prevEventCid:    head.eventCid,
    provisional:     input.provisional ?? false,
    vetoOfCid:       null,
    enrolmentDigest: enrolmentDigestOf(enrolments),
    ...lawPart(head),                      // a log that holds an enrolment keeps its law on every rotation
  };
  for (const sealed of enrolments) {
    if (!(await verifySealedEnrolment(sealed, head.prefix, freshOpKeyDid))) {
      return { ok: false, reason: "an enrolment the fresh op-key did not seal — only the key a rotation seats re-enrols on it" };
    }
  }
  if (head.enrolCount !== undefined) {
    const shape = revealedSetFault(head, { recoveryRoster, recoveryThreshold } as PersonaKelEvent);
    if (shape) return { ok: false, reason: shape };
  }
  const quorum = await verifyRotationQuorum(core, recoveryRoster, recoveryThreshold, rotationSigs, head.nextRecoverySetHash);
  if (!quorum.ok) return { ok: false, reason: quorum.reason ?? "rotation quorum unsatisfied" };
  return {
    ok: true,
    event: {
      ...core, eventCid: personaEventCidOf(core), recoveryRoster: [...recoveryRoster], recoveryThreshold, rotationSigs: [...rotationSigs],
      ...(enrolments.length > 0 ? { enrolments: [...enrolments] } : {}),
    },
  };
}

// ── RECOVERY CONTACT ENROLMENT (stable-founding-road#/rulings, "Recovery contact enrolment's shape") ─────────────

/** The bound core of the enrolment `head`'s op-key would sign to commit `recoveryContactSetHash`. */
function enrolmentCore(head: PersonaKelEvent, recoveryContactSetHash: string): PersonaEventCore {
  return {
    seq:             head.seq + 1,
    prefix:          head.prefix,               // the identifier stays FIXED
    opKeyDid:        head.opKeyDid,             // and so does the face's key: an enrolment rotates nothing
    recoverySetHash: head.recoverySetHash,      // the genesis wall carries forward unchanged
    nextRecoverySetHash: recoveryContactSetHash,       // the recovery contacts' set, the authority of every later change
    prevEventCid:    head.eventCid,
    provisional:     false,
    vetoOfCid:       null,
    enrolmentDigest: enrolmentDigestOf([]),     // every device keeps its standing: no box rides it
    kind:            RECOVERY_CONTACT_ENROLMENT_KIND,
    enrolCount:      RECOVERY_CONTACT_COUNT,    // the law rides the signed bytes, so the verifier decides it
    enrolThreshold:  RECOVERY_CONTACT_THRESHOLD,
  };
}

/** The exact bytes a face's current op-key signs to enrol the recovery contact set `recoveryContactSetHash` over `head`. */
export function personaEnrolmentSigningBytes(head: PersonaKelEvent, recoveryContactSetHash: string): Uint8Array {
  return personaEventBytes(enrolmentCore(head, recoveryContactSetHash));
}

/**
 * Mint a one-of-one face's FIRST recovery contact enrolment: the face's own current op-key signs one typed event that commits
 * `recoveryContactSetHash` (`sealKeySetHash` over the recovery contacts' recovery public keys and the threshold) as the rolling
 * recovery commitment. The prefix and the op-key stay as they stand, so every device edge and every device's
 * secret stand too. FAILS CLOSED where the reader would refuse the event: a provisional head, a face whose rolling
 * set already moved off its genesis set (the recovery contacts' quorum changes it, by rotation), a set that is no digest or
 * the genesis set again, and a signature that does not verify under the head's op-key.
 *
 * The event carries the law's count and threshold in its signed bytes (three at two): the verifier refuses any enrolment that does not, and the enrolment verb (`enrolRecoveryContacts`) is the friendly front that refuses first, by name.
 */
export async function mintRecoveryContactEnrolment(input: {
  readonly head:            PersonaKelEvent;
  readonly recoveryContactSetHash: string;
  /** The face's CURRENT op-key's signer over `personaEnrolmentSigningBytes`. */
  readonly sign:            (bytes: Uint8Array) => Promise<string>;
}): Promise<PersonaRotateResult> {
  const core = enrolmentCore(input.head, input.recoveryContactSetHash);
  const event: PersonaKelEvent = {
    ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [],
    enrolSig: await input.sign(personaEventBytes(core)),
  };
  const fault = personaSuccessorFault(input.head, event);
  return fault === null ? { ok: true, event } : { ok: false, reason: fault };
}

// ── The CONTEST (Fork C, the walked hardening rule — identity-classes#the-two-forks) ────────────

/** The bytes a STANDING op-key signs to kill a provisional — the veto's core, binding the contested
 *  cid so a veto never floats onto another contest. */
export function personaVetoSigningBytes(contested: PersonaKelEvent, standing: PersonaKelEvent): Uint8Array {
  return personaEventBytes(vetoCore(contested, standing));
}

function vetoCore(contested: PersonaKelEvent, standing: PersonaKelEvent): PersonaEventCore {
  return {
    seq:             contested.seq,                    // the veto COMPETES at the contested seq
    prefix:          contested.prefix,
    opKeyDid:        standing.opKeyDid,                // the standing holder re-asserts itself
    recoverySetHash: standing.recoverySetHash,         // the genesis wall
    nextRecoverySetHash: standing.nextRecoverySetHash, // the standing rolling commitment restores
    prevEventCid:    contested.prevEventCid,           // both link the same predecessor
    provisional:     false,
    vetoOfCid:       contested.eventCid,
    enrolmentDigest: enrolmentDigestOf([]),          // a veto restores the standing key; it enrols no one
    ...lawPart(standing),
  };
}

/**
 * Mint the VETO — one signature by the standing op-key, no quorum: the holder's own hand is the whole
 * authority the contest exists to protect. The chain continues FROM the veto; the provisional and
 * every descendant of it fall at the fold, their state to kapae cleanup (which the provisional's
 * kapae-reversible authority kept clean).
 */
export async function mintVeto(input: {
  readonly contested: PersonaKelEvent;                       // the provisional under contest
  readonly standing:  PersonaKelEvent;                       // the head the holder still holds
  readonly sign:      (bytes: Uint8Array) => Promise<string>; // the STANDING op-key's signer
}): Promise<PersonaKelEvent> {
  const core = vetoCore(input.contested, input.standing);
  return {
    ...core,
    eventCid: personaEventCidOf(core),
    recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [],
    vetoSig: await input.sign(personaEventBytes(core)),
  };
}

/**
 * Verify a rotation's THRESHOLD-ATTEST quorum — the strictest never-reconstruct gate. FAILS CLOSED:
 *   · the revealed roster's digest MUST equal the pre-committed `recoverySetHash` (a swapped roster fails),
 *   · a signer ABSENT from the revealed roster does not count (a stranger cannot pad the quorum),
 *   · a signer counted TWICE counts once (a replayed signature cannot pad the quorum),
 *   · a signature that does not verify over the event bytes does not count (tamper-evident),
 *   · below `recoveryThreshold` distinct valid signers → REFUSE.
 * Mirrors `makeMultiSigQuorumVerifier` (kapae-antigen), bound over the persona-event bytes.
 */
export async function verifyRotationQuorum(
  core:              PersonaEventCore,
  recoveryRoster:    readonly string[],
  recoveryThreshold: number,
  rotationSigs:      readonly QuorumSignature[],
  /** The commitment this rotation reveals against — the PREDECESSOR's rolling commitment. Defaults to
   *  the genesis wall for a caller verifying an inception-adjacent rotation in isolation. */
  authorizingSetHash: string = core.recoverySetHash,
): Promise<{ ok: boolean; reason?: string }> {
  return rotationQuorum(core, recoveryRoster, recoveryThreshold, rotationSigs, authorizingSetHash);
}

function rotationQuorum(
  core: PersonaEventCore, recoveryRoster: readonly string[], recoveryThreshold: number,
  rotationSigs: readonly QuorumSignature[], authorizingSetHash: string,
): { ok: boolean; reason?: string } {
  if (!Number.isInteger(recoveryThreshold) || recoveryThreshold < 1) return { ok: false, reason: "recovery threshold below 1" };
  if (recoveryRoster.length < recoveryThreshold) return { ok: false, reason: "revealed roster shorter than the threshold" };
  if (sealKeySetHash(recoveryRoster, recoveryThreshold) !== authorizingSetHash) {
    return { ok: false, reason: "revealed roster digest does not match the authorizing commitment" };
  }
  for (const recoveryContact of recoveryRoster) {
    const weak = weakKeyFault("a revealed recovery contact key", recoveryContact);
    if (weak) return { ok: false, reason: weak };
  }
  const rosterSet = new Set(recoveryRoster.map((k) => k.toLowerCase()));
  const bytes     = personaEventBytes(core);
  const counted   = new Set<string>();
  for (const s of rotationSigs) {
    const signer = s.signer.toLowerCase();
    if (counted.has(signer))     continue;   // a signer pads the quorum at most once
    if (!rosterSet.has(signer))  continue;   // a non-roster signer never counts
    if (signatureHolds(s.sig, bytes, signer)) counted.add(signer);   // a malformed sig/key counts as no signature
    if (counted.size >= recoveryThreshold) return { ok: true };
  }
  return { ok: false, reason: `below-threshold quorum: ${counted.size}/${recoveryThreshold} distinct valid recovery contact signatures` };
}

/**
 * Why a key may not stand in this log, in the Ed25519 door's own name, or null when it may. An op-key and every
 * revealed recovery contact key read through it the moment an event names them: a small-order key holds no secret, so
 * everyone signs as that persona or as that recovery contact. An event that names one refuses, and the log with it.
 */
function weakKeyFault(what: string, keyHex: unknown): string | null {
  const read = acceptEd25519Key(typeof keyHex === "string" ? keyHex.replace(/^0x/, "").toLowerCase() : keyHex);
  return read.ok ? null : `${what} refuses at the Ed25519 door (${read.refusal})`;
}

/** The bound core of an event — the fields its cid and every signature over it commit. */
function coreOf(e: PersonaKelEvent): PersonaEventCore {
  return {
    seq: e.seq, prefix: e.prefix, opKeyDid: e.opKeyDid, recoverySetHash: e.recoverySetHash,
    nextRecoverySetHash: e.nextRecoverySetHash, prevEventCid: e.prevEventCid,
    provisional: e.provisional, vetoOfCid: e.vetoOfCid, enrolmentDigest: e.enrolmentDigest,
    ...(e.kind === undefined ? {} : { kind: e.kind }),
    ...(e.enrolCount === undefined ? {} : { enrolCount: e.enrolCount }),
    ...(e.enrolThreshold === undefined ? {} : { enrolThreshold: e.enrolThreshold }),
  };
}

/** Why `e` fails as an inception, structurally, or null when it stands as one. */
function inceptionStructureFault(e: PersonaKelEvent): string | null {
  if (e.seq !== 0 || e.prevEventCid !== null) return "an inception carries seq 0 and no predecessor";
  const weak = weakKeyFault("the inception's op-key", e.opKeyDid);
  if (weak) return weak;
  if (e.prefix !== personaPrefixOf(e.opKeyDid, e.recoverySetHash)) return "the prefix does not derive from the inception's op-key and recovery set";
  if (e.recoverySetHash.length === 0) return "unarmed: the inception commits no recovery set";
  if (e.nextRecoverySetHash !== e.recoverySetHash) return "an inception seats one recovery set in both slots";
  if (e.provisional || e.vetoOfCid !== null) return "an inception never contests";
  if (e.kind !== undefined) return "an inception carries no kind";
  if (e.eventCid !== personaEventCidOf(e)) return "the cid does not recompute over the bound core";
  if (!enrolmentsAttested(e)) return "the enrolment list is not the one the cid commits";
  return null;
}

/** Why `e` fails as the successor of `prev`, structurally (no signature read), or null when it links. */
function successorStructureFault(prev: PersonaKelEvent, e: PersonaKelEvent): string | null {
  if (e.seq !== prev.seq + 1)                     return "the seq does not follow its predecessor's";
  if (e.prevEventCid !== prev.eventCid)           return "the hash-link names another predecessor";
  if (e.prefix !== prev.prefix)                   return "the identifier prefix moved";
  if (e.recoverySetHash !== prev.recoverySetHash) return "the genesis recovery wall moved";
  if (e.eventCid !== personaEventCidOf(e))        return "the cid does not recompute over the bound core";
  if (!enrolmentsAttested(e))                     return "the enrolment list is not the one the cid commits";
  const weak = weakKeyFault("the event's op-key", e.opKeyDid);
  if (weak) return weak;
  if (e.kind !== undefined) return enrolmentStructureFault(prev, e);
  if (e.vetoOfCid !== null) {
    // A veto competes AT its contested seq: it links the same predecessor and restores the standing head's
    // op-key and rolling commitment.
    if (e.opKeyDid !== prev.opKeyDid)                       return "a veto seats another op-key than the standing one";
    if (e.nextRecoverySetHash !== prev.nextRecoverySetHash) return "a veto moves the rolling recovery commitment";
    if (e.provisional)                                      return "a veto never reads provisional";
  }
  // THE LAW TRAVELS: once a log holds an enrolment, every later rotation and veto carries its signed count and threshold forward.
  if (prev.enrolCount !== undefined && (e.enrolCount !== prev.enrolCount || e.enrolThreshold !== prev.enrolThreshold)) {
    return "an event on a log that holds an enrolment carries the enrolment's count and threshold forward";
  }
  return null;
}

/**
 * Why a typed event fails as the successor of `prev`, structurally, or null when it stands as a recovery contact enrolment:
 * it keeps the face's op-key and commits a new set as the rolling commitment, over a head that stands hardened and
 * still names the genesis set (one-of-one). It carries no reveal, no quorum and no device box: the op-key's own
 * signature (`enrolSig`) stands as its whole authority, checked beside the link.
 */
function enrolmentStructureFault(prev: PersonaKelEvent, e: PersonaKelEvent): string | null {
  if (e.kind !== RECOVERY_CONTACT_ENROLMENT_KIND)                  return "an event kind the reader knows not";
  if (e.vetoOfCid !== null || e.provisional)               return "an enrolment never contests";
  if (prev.provisional)                                    return "an enrolment over a provisional head: a contested key signs no authority change";
  if (prev.nextRecoverySetHash !== prev.recoverySetHash)   return "the face already holds recovery contacts: a later change takes their quorum";
  if (e.opKeyDid !== prev.opKeyDid)                        return "an enrolment keeps the face's op-key";
  if (!DIGEST_RE.test(e.nextRecoverySetHash))              return "an enrolment commits a recovery-contact-set digest";
  if (e.nextRecoverySetHash === prev.nextRecoverySetHash)  return "an enrolment commits a set other than the genesis set";
  if (e.enrolCount !== RECOVERY_CONTACT_COUNT || e.enrolThreshold !== RECOVERY_CONTACT_THRESHOLD) {
    return "an enrolment commits three recovery contacts at a threshold of two";
  }
  if (e.enrolmentDigest !== enrolmentDigestOf([]))         return "an enrolment re-enrols no device";
  if (e.recoveryRoster.length !== 0 || e.recoveryThreshold !== 0 || e.rotationSigs.length !== 0) {
    return "an enrolment carries no reveal and no quorum";
  }
  return null;
}

/** The enrolment's signed count and threshold, as a later event on the same log carries them forward. */
function lawPart(from: PersonaKelEvent): { readonly enrolCount?: number; readonly enrolThreshold?: number } {
  return from.enrolCount === undefined ? {} : { enrolCount: from.enrolCount, enrolThreshold: from.enrolThreshold as number };
}

/** Why a rotation's revealed set fails the standing law (three distinct keys at two): not three distinct keys at two, or a count or threshold off the enrolment's signed fields. */
function revealedSetFault(enrolment: PersonaKelEvent, e: PersonaKelEvent): string | null {
  const distinct = new Set(e.recoveryRoster.map((k) => k.toLowerCase())).size;
  if (e.recoveryRoster.length !== RECOVERY_CONTACT_COUNT || distinct !== RECOVERY_CONTACT_COUNT || e.recoveryThreshold !== RECOVERY_CONTACT_THRESHOLD) {
    return "a revealed recovery contact set holds exactly three distinct keys at a threshold of two";
  }
  if (e.recoveryRoster.length !== enrolment.enrolCount || e.recoveryThreshold !== enrolment.enrolThreshold) {
    return "the revealed set disagrees with the count and threshold the enrolment signed";
  }
  return null;
}

/**
 * Why `e` fails as the successor of `prev`, or null when it stands: the structural link, every sealed enrolment's
 * signature under the event's op-key, and the event's authority — a rotation's recovery contact quorum against the
 * predecessor's rolling commitment, or a veto's signature under the standing op-key. It reads `prev`'s bound core
 * alone, so a herm that holds only the predecessor event checks a successor exactly as a reader walking the chain.
 */
export function personaSuccessorFault(prev: PersonaKelEvent, e: PersonaKelEvent): string | null {
  const structural = successorStructureFault(prev, e);
  if (structural) return structural;
  for (const sealed of e.enrolments ?? []) {
    if (!sealedEnrolmentVerifies(sealed, e.prefix, e.opKeyDid)) return "an enrolment its op-key did not seal";
  }
  if (e.kind !== undefined) {
    if (!e.enrolSig) return "the recovery contact enrolment is unsigned";
    return signatureHolds(e.enrolSig, personaEventBytes(coreOf(e)), verifyingKeyFromDid(prev.opKeyDid))
      ? null : "the recovery contact enrolment's signature does not verify against the face's op-key";
  }
  if (e.vetoOfCid !== null) {
    if (!e.vetoSig) return "the veto is unsigned";
    return signatureHolds(e.vetoSig, personaEventBytes(coreOf(e)), prev.opKeyDid)
      ? null : "the veto's signature does not verify against the standing op-key";
  }
  // THE REVEAL DECIDES: the first rotation over an enrolment opens the set its digest committed, and the set must be
  // exactly the three distinct keys at threshold two the enrolment signed (the digest alone shows no count).
  if (prev.enrolCount !== undefined) {
    const shape = revealedSetFault(prev, e);
    if (shape) return shape;
  }
  const q = rotationQuorum(coreOf(e), e.recoveryRoster, e.recoveryThreshold, e.rotationSigs, prev.nextRecoverySetHash);
  return q.ok ? null : (q.reason ?? "rotation quorum unsatisfied");
}

/**
 * Verify the KEL's STRUCTURAL integrity: monotonic sequence + hash-links + a STABLE prefix and STABLE
 * recovery-commit across every event, each event's cid recomputing over its bound core. Inception (seq 0)
 * carries no predecessor and its prefix MUST derive from its own op-key + recovery-set (the AID binding).
 * PURE — it verifies no signatures (a rotation's quorum rides `verifyRotationQuorum` / `verifyPersonaKelFull`,
 * which need the revealed roster). Mirrors `verifySealLineage`.
 */
export function verifyPersonaKel(chain: readonly PersonaKelEvent[]): boolean {
  if (chain.length === 0 || inceptionStructureFault(chain[0]!) !== null) return false;
  for (let i = 1; i < chain.length; i++) if (successorStructureFault(chain[i - 1]!, chain[i]!) !== null) return false;
  return true;
}

/**
 * Verify the KEL structurally AND every event's authority — the full assurance a gate needs before trusting the
 * head op-key. Each rotation (seq > 0) MUST carry a ≥ threshold distinct recovery contact quorum over its own bytes, each
 * veto the standing op-key's signature, each enrolment its op-key's seal; inception carries none
 * (self-authorized). FAILS CLOSED on the first event that does not verify, and names it.
 */
export async function verifyPersonaKelFull(chain: readonly PersonaKelEvent[]): Promise<{ ok: boolean; reason?: string }> {
  if (chain.length === 0) return { ok: false, reason: "an empty chain heads nothing" };
  const genesis = inceptionStructureFault(chain[0]!);
  if (genesis) return { ok: false, reason: `structural integrity failed at the inception: ${genesis}` };
  for (let i = 1; i < chain.length; i++) {
    const fault = personaSuccessorFault(chain[i - 1]!, chain[i]!);
    if (fault) return { ok: false, reason: `${eventNoun(chain[i]!)} seq ${chain[i]!.seq}: ${fault}` };
  }
  return { ok: true };
}

/** What an event names itself in a refusal: a recovery contact enrolment, a veto or a rotation. */
function eventNoun(e: PersonaKelEvent): string {
  return e.kind !== undefined ? "recovery contact enrolment" : e.vetoOfCid !== null ? "veto" : "rotation";
}

/**
 * The authoritative operational key — the LATEST head's `opKeyDid`, IFF every step of the KEL verifies: the
 * structural walk AND each rotation's recovery contact quorum, each veto's signature, each enrolment's seal. Null on
 * anything less (a gate MUST NOT trust a head off an unverified lineage). EVERY read verifies: a rotation
 * carries its own proof (the revealed roster against the predecessor's commitment, and the recovery contacts'
 * signatures), and a junk rotation reads structurally whole, so structure alone never seats a head.
 * `verifyQuorums` selects nothing and stands only while callers still name it.
 */
export async function headOpKey(
  chain: readonly PersonaKelEvent[],
  opts: { verifyQuorums?: boolean; acceptProvisional?: boolean } = {},
): Promise<string | null> {
  if (!(await verifyPersonaKelFull(chain)).ok) return null;
  // A provisional head confers nothing by default (the walked clause ①): the prior key stays head
  // until THE OBSERVER accepts — its own silence-across-K-local-epochs policy, passed here as a
  // verdict, never computed from a clock. NOT accepting is the resting state (clause ④).
  for (let i = chain.length - 1; i >= 0; i--) {
    const e = chain[i]!;
    if (e.provisional && !opts.acceptProvisional) continue;
    return e.opKeyDid;
  }
  return null;
}

// ── THE ONE READER: verify, then fold ───────────────────────────────────────────────────────────

/** Two or more events that each verify against one predecessor and compete for its successor seat. */
export interface PersonaKelFork {
  /** The seq they compete at. */
  readonly seq: number;
  /** The competing events, each verified against the lineage's head. */
  readonly events: readonly PersonaKelEvent[];
}

/** One event the fold set aside at a seat of the lineage, and why. */
export interface PersonaKelSetAside {
  readonly event: PersonaKelEvent;
  readonly reason: string;
}

/** What the one reader reads off a heap of KEL events. */
export interface PersonaKelFold {
  /** The lineage that verifies, in full, up to the last seat one event alone holds. */
  readonly kel: readonly PersonaKelEvent[];
  /** Every event that competed for a seat of that lineage and does not verify, or a veto that yields: one naming a
   *  hardened rotation, or one naming no provisional beside a rotation that stands. None of them moves the head. */
  readonly setAside: readonly PersonaKelSetAside[];
  /** Two verified events at one seat — a quorum that signed twice, or two recoveries that raced. Null when no
   *  seat forks. The lineage stops before it. */
  readonly fork: PersonaKelFork | null;
}

/**
 * THE ONE READER every KEL source folds through — the board, a herm's drops, a chain a caller hands. VERIFY, THEN
 * FOLD: at each seat of the lineage only the events that verify against the head already folded may compete (a
 * rotation by its recovery contact quorum against the head's rolling commitment, a veto by the head's own op-key, every
 * enrolment by its op-key's seal). An event that does not verify never enters the pick, so a board writer, a herm or
 * a sibling who plants one moves nothing and revokes no one; the fold names it (`setAside`).
 *
 * Among the verified: a veto that names a provisional competing at its seat kills that provisional and takes the
 * seat; a veto that names a hardened rotation is set aside, so no op-key holder vetoes one. A veto whose provisional
 * the reader never met re-seats the standing op-key and commitment, so it holds the seat only where no rotation
 * competes for it. One survivor advances the lineage. Two or more survivors are a FORK: two quorum-signed events at one seq, which
 * only duplicity mints. The fold never picks between them — by board order, by herm order or by any other — and
 * stops before the seat, naming the fork for its reader to surface.
 *
 * Two copies of one event (one cid) differ only in what rides outside the core; the copy that verifies stands for
 * the cid, and a copy that does not is set aside. Events off the lineage (a vetoed provisional's descendants, an
 * orphan) are neither folded nor set aside. NO CLOCK: the fold follows KEL event order alone.
 */
export function foldPersonaContests(events: readonly PersonaKelEvent[]): PersonaKelFold {
  const setAside: PersonaKelSetAside[] = [];
  const byPrev = new Map<string | null, PersonaKelEvent[]>();
  const seen = new Set<string>();
  for (const e of events) {
    let key: string;
    try { key = canonicalJson(e); } catch { continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byPrev.get(e.prevEventCid) ?? [];
    list.push(e);
    byPrev.set(e.prevEventCid, list);
  }
  /** The verified candidates for one seat, one per cid; every copy that fails is set aside. */
  const judge = (candidates: readonly PersonaKelEvent[], fault: (e: PersonaKelEvent) => string | null): PersonaKelEvent[] => {
    const byCid = new Map<string, PersonaKelEvent[]>();
    for (const e of candidates) byCid.set(e.eventCid, [...(byCid.get(e.eventCid) ?? []), e]);
    const verified: PersonaKelEvent[] = [];
    for (const copies of byCid.values()) {
      let stood = false;
      for (const e of copies) {
        const why = fault(e);
        if (why !== null) setAside.push({ event: e, reason: why });
        else if (!stood) { verified.push(e); stood = true; }
      }
    }
    return verified;
  };

  const inceptions = judge(byPrev.get(null) ?? [], inceptionStructureFault);
  if (inceptions.length !== 1) {
    return { kel: [], setAside, fork: inceptions.length > 1 ? { seq: 0, events: inceptions } : null };
  }
  const kel: PersonaKelEvent[] = [inceptions[0]!];
  for (;;) {
    const head = kel[kel.length - 1]!;
    const verified = judge(byPrev.get(head.eventCid) ?? [], (e) => personaSuccessorFault(head, e));
    const rotations = verified.filter((e) => e.vetoOfCid === null);
    const vetoes: PersonaKelEvent[] = [];
    const orphans: PersonaKelEvent[] = [];
    for (const v of verified) {
      if (v.vetoOfCid === null) continue;
      const named = rotations.find((r) => r.eventCid === v.vetoOfCid);
      if (named?.provisional) vetoes.push(v);
      else if (named) setAside.push({ event: v, reason: "a veto that names a hardened rotation — a veto kills a provisional alone" });
      else orphans.push(v);
    }
    const killed = new Set(vetoes.map((v) => v.vetoOfCid));
    let survivors = [...vetoes, ...rotations.filter((r) => !killed.has(r.eventCid))];
    // A veto whose provisional this reader never met re-seats the standing op-key and commitment: it holds the seat
    // only where no rotation competes, and yields to one that does.
    if (survivors.length === 0) survivors = orphans;
    else for (const v of orphans) setAside.push({ event: v, reason: "a veto that names no provisional at its seat, beside a rotation that stands" });
    if (survivors.length === 0) return { kel, setAside, fork: null };
    if (survivors.length > 1) return { kel, setAside, fork: { seq: head.seq + 1, events: survivors } };
    kel.push(survivors[0]!);
  }
}

/** One line naming what a fold set aside and where it forks, or null when it read every event it met. */
export function personaKelFoldSaid(fold: PersonaKelFold): { readonly unreadable?: string; readonly fork?: string } {
  const head = fold.kel.length > 0 ? `seq ${fold.kel[fold.kel.length - 1]!.seq}` : "nothing";
  return {
    ...(fold.setAside.length > 0 ? {
      unreadable: `${fold.setAside.length} persona-KEL event(s) do not verify and move nothing (${fold.setAside.map((x) => `seq ${x.event.seq} ${x.event.eventCid.slice(0, 16)}…: ${x.reason}`).join("; ")}) — the lineage stands at ${head}`,
    } : {}),
    ...(fold.fork ? {
      fork: `the persona-KEL forks at seq ${fold.fork.seq}: ${fold.fork.events.length} events that each verify compete for one seat (${fold.fork.events.map((e) => `${e.eventCid.slice(0, 16)}…`).join(", ")}) — duplicity, which no reader settles by order`,
    } : {}),
  };
}

/**
 * THE GATE-WALK — THE CONTINUITY ANCHOR THE LIVE GATES RUN. Three doors present an edge through it: the
 * Binding Gate a vessel passes at boot (`boot-daemon-keyhive`), the daemon's live admission path
 * (`operator-daemon-behavior`), and the face-grant record's own verifier. Fold the persona-KEL it is handed through
 * the one reader (`foldPersonaContests`) to its CURRENT authoritative op-key, then verify a device-delegation edge
 * against THAT head — the pin moves from a raw op-key to the identifier's live head. A rotated key still verifies (a
 * fresh edge re-issued under the new head passes); an edge signed by a SUPERSEDED op-key rejects.
 *
 * WHAT A BOARD WRITER REACHES. The chain rides a board any relay peer or sibling writes. An event that does not
 * verify — a junk rotation, a junk veto, a torn quorum, a stripped enrolment — never competes for a seat, so it
 * neither rolls a revocation back nor holds a lawful rotation off the head: only an event that verifies moves the
 * head, and only a head that moved past the edge refuses it. The gate names what it set aside (`unreadable`) for
 * its caller to surface.
 *
 * FAIL-CLOSED where nothing verifies, and where the KEL forks: a chain whose inception does not verify, an edge that
 * does not chain to the head, or two verified events at one seat (`fork`) denies — the gate admits under no head
 * that duplicity leaves in doubt. The edge's `deviceDid`-binding + freshness stay the caller's concern (the existing
 * Binding-Gate checks).
 */
export async function verifyEdgeAgainstPersonaKel(
  edge:  DeviceDelegationTiddler,
  chain: readonly PersonaKelEvent[],
  opts?: { expectedEpoch?: number },
): Promise<{ ok: boolean; reason?: string; headOpKey?: string; unreadable?: string; fork?: string }> {
  const fold = foldPersonaContests(chain);
  const said = personaKelFoldSaid(fold);
  if (said.fork) return { ok: false, reason: said.fork, ...said };
  const head = fold.kel.length > 0 ? await headOpKey(fold.kel) : null;
  if (head === null) return { ok: false, reason: "persona-KEL failed structural or rotation-quorum verification", ...said };
  const innerOpts = opts?.expectedEpoch !== undefined ? { expectedEpoch: opts.expectedEpoch } : undefined;
  const r = await verifyDeviceDelegation(edge, head, innerOpts);
  return r.ok
    ? { ok: true, headOpKey: head, ...said }
    : { ok: false, reason: r.reason ?? "edge does not chain to the KEL head op-key", headOpKey: head, ...said };
}
