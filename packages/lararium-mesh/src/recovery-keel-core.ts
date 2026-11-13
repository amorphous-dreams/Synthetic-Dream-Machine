/**
 * recovery-keel-core — the founding-split + recover-readmit FLOWS (platform-blind).
 *
 * The lone-citizen truth: the device-share dies WITH the device, so recovery cannot ride it. A founding
 * split is 2-of-3 {device, recorded-code, escrow-peer} — normal life uses any two, but a drowned device
 * recovers from {recorded-code (the citizen wrote it down) + escrow (a peer relays it)}. Neither party
 * recovers alone: the recovery quorum IS the impersonation quorum, and it needs both (recovery-share
 * enforces this at the TYPE wall — a single-custodian set can never construct a Quorum).
 *
 * The crypto primitives already sit in mesh (recovery-share: splitToShares / assembleQuorum /
 * reconstructFromQuorum / encodeShareBytes). Only the FLOW lifts here, over two injected shores:
 *   · the PersonaVault — supplies the root seed to split + the sealed device-share store,
 *   · the readmit runner — the keyhive edge-signing step, injected because keyhive DEPENDS ON mesh
 *     (mesh importing keyhive would cycle). The core reconstructs the branded ReadmissionSecret and hands
 *     it to the runner; the platform binds the concrete `runReadmitEdge`. Dependency inversion keeps the
 *     recovery flow keyhive-blind while the branded secret stays the one door into re-admission.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/recovery-keel-core
 */

import { canonicalJsonBytes, type RandomProvider } from "./crypto.js";
import { RECOVERY_CONTACT_POSSESSION_DOMAIN } from "./domains.js";
import { verifyEd25519 } from "./ed25519-door.js";
import {
  splitToShares, assembleQuorum, reconstructFromQuorum, encodeShareBytes,
  type RecoveryShare, type CustodianTag, type ReadmissionSecret,
} from "./recovery-share.js";
import { splitToCustodianCards, type CustodianCard, type CustodianCardSplit } from "./custodian-card.js";
import { assertHandleIndex, loadPersonaRootSeed, type PersonaVault } from "./persona-vault.js";
import { sealKeySetHash } from "./wax-stamp.js";
import type { RecoveryContactRegistration } from "./recovery-registration.js";
import type { QuorumSignature } from "./kapae-antigen.js";
import {
  RECOVERY_CONTACT_COUNT, RECOVERY_CONTACT_THRESHOLD, mintRecoveryContactEnrolment, mintPersonaInception, mintPersonaRotation, personaRotationSigningBytes,
  type PersonaKelEvent, type PersonaRotateResult, type SealedEnrolment,
} from "./persona-kel.js";

/**
 * How a runtime persists the DEVICE recovery-share, keyed by handle-index (one persona's quorum never
 * reconstructs another's root). The device-share is share material of the PersonaGroup root — self-only
 * secret — so the platform SEALS it at rest; the seal lives in the adapter, never in this core shore. Both moves
 * answer asynchronously: a store that rests its share behind a custody door opens it for the one act that asks.
 */
export interface RecoveryShareStore {
  /** Read the device-share for ONE persona, or null when none has landed. A share that stands and does not open refuses. */
  load(handleIndex: number): Promise<RecoveryShare | null>;
  /** Persist (sealed) the device-share for ONE persona. Resolves once the share rests. */
  save(handleIndex: number, share: RecoveryShare): Promise<void>;
}

/** The three shares a founding split produces. Any two DISTINCT custodians recover — so a lost device
 *  (its share gone) still recovers from {recorded-code, escrow-peer}. */
export interface FoundingShares {
  readonly deviceShare:       RecoveryShare;   // sealed on the device (dies with it — never the recovery path)
  readonly recordedCodeShare: RecoveryShare;   // the citizen writes it down (the one external factor)
  readonly escrowShare:       RecoveryShare;   // a peer/kahu holds it (≤1 share, cannot recover alone)
  /** The recorded-code share encoded for transcription (hex payload + checksum). */
  readonly recordedCode:      string;
  /** The escrow-peer share encoded for a peer to hold (relayed, never openable into a solo recovery). */
  readonly escrowCarrier:     string;
}

/**
 * Split the PersonaGroup root at founding into a 2-of-3 {device, recorded-code, escrow-peer}. The floor's
 * real job runs HERE, at onboarding: it forces one external factor (the recorded code) to exist before the
 * Handle carries standing — because no crypto recovers a secret from nothing. The caller seals the
 * device-share, surfaces the recorded code for the citizen to write down, and relays the escrow share.
 */
/** `recoveryEpoch` is a ROTATION GENERATION — carrier-A shaped (a monotone integer that rolls when the
 *  shares re-split), never a wall-clock and never Keyhive's CGKA epoch. See
 *  lar:///ha.ka.ba/lararium/mesh/epoch-binding-surfaces#/the-five */
export function splitRootAtFounding(rootSeed: Uint8Array, rng: RandomProvider, recoveryEpoch = 1): FoundingShares {
  const custodians: CustodianTag[] = ["device", "recorded-code", "escrow-peer"];
  const shares = splitToShares(rootSeed, 2, custodians, recoveryEpoch, rng);
  const byTag = (t: CustodianTag): RecoveryShare => shares.find((s) => s.custodian === t)!;
  const recordedCodeShare = byTag("recorded-code");
  const escrowShare = byTag("escrow-peer");
  return {
    deviceShare: byTag("device"),
    recordedCodeShare, escrowShare,
    recordedCode:  encodeShareBytes(recordedCodeShare.bytes),
    escrowCarrier: encodeShareBytes(escrowShare.bytes),
  };
}

/**
 * Reconstruct the root from a recovery quorum (≥ 2 distinct custodians) and re-admit a fresh device via the
 * INJECTED runner. The device-share is ABSENT after device loss; recovery rides {recorded-code, escrow}.
 * The reconstructed root zeroizes the instant re-admission returns — the reconstruction window kept as
 * narrow as the floor allows.
 *
 * `runReadmit` receives the branded ReadmissionSecret (never a bare Uint8Array) — the type gate the
 * platform's keyhive edge-signer already demands. The core stays keyhive-blind; the adapter binds it.
 */
export async function reconstructAndReadmit<Readmit, Payload>(
  quorumShares: readonly RecoveryShare[],
  readmit: Readmit,
  runReadmit: (reconstructedRoot: ReadmissionSecret, readmit: Readmit) => Promise<Payload>,
): Promise<Payload> {
  const reconstructedRoot = reconstructFromQuorum(assembleQuorum(quorumShares, 2));
  try {
    return await runReadmit(reconstructedRoot, readmit);
  } finally {
    reconstructedRoot.fill(0);   // close the reconstruction window immediately
  }
}

/**
 * Provision recovery at FOUNDING: split the freshly-minted PersonaGroup root at `handleIndex`, SEAL the
 * device-share into the vault's recovery store, and return the two shares the citizen carries OFF the
 * device — the recorded code (write it down) and the escrow carrier (hand to a peer). The floor's real
 * work runs here, because no crypto recovers a secret from nothing. The root seed zeroizes the instant it
 * is split.
 *
 * PER-PERSONA: a vessel wearing several personas provisions recovery per persona — each root splits into
 * its own 2-of-3 quorum and seals its own device-share, keyed by handle-index. (POLICY fork surfaced to
 * the operator: whether N personas on ONE disk constitute distinct-enough custodians for a real quorum is
 * NOT decided here; this splits the shore so either resolution stands.)
 */
export async function provisionRecoveryAtFounding(
  vault: PersonaVault,
  rng: RandomProvider,
  recoveryEpoch = 1,
  handleIndex = 0,
  /**
   * Hand the two off-device shares to the person BEFORE the device share seals. A provision that stops after the
   * hand-out and before the seal leaves no device share, so the same provision run again splits afresh; one that
   * sealed first and stopped would leave a share whose two partners nobody ever received.
   */
  handOut?: (off: { readonly recordedCode: string; readonly escrowCarrier: string }) => void | Promise<void>,
): Promise<{ recordedCode: string; escrowCarrier: string }> {
  assertHandleIndex(handleIndex);
  if (!vault.recovery) {
    throw new Error("[recovery-keel-core] this vault provisions no recovery store — cannot seal a device-share");
  }
  const rootSeed = await loadPersonaRootSeed(vault, handleIndex);
  try {
    const shares = splitRootAtFounding(rootSeed, rng, recoveryEpoch);
    await handOut?.({ recordedCode: shares.recordedCode, escrowCarrier: shares.escrowCarrier });
    await vault.recovery.save(handleIndex, shares.deviceShare);
    return { recordedCode: shares.recordedCode, escrowCarrier: shares.escrowCarrier };
  } finally {
    rootSeed.fill(0);   // the root never lingers after the split
  }
}

/** The founding card issue for personal identity recovery — the three shared custodian cards + a flag that
 *  the "mine" (device) share sealed on this vessel. The two custodian cards leave the device by hand. */
export interface RecoveryCardsAtFounding {
  /** All three cards, the SHARED shape: "Recovery-card mine" + "custodian-A" + "custodian-B". */
  readonly cards:      CustodianCard[];
  /** True once the "mine" (device) share seals into the vault's recovery store. */
  readonly mineSealed: boolean;
}

/**
 * Provision identity recovery at FOUNDING as CUSTODIAN CARDS — the pattern-integrity twin of the charter
 * reserve's `splitReserveSeed`. It splits the PersonaGroup root 2-of-3 into the SHARED card shape
 * (custodian-card: mine→device, custodian-a→custodian, custodian-b→escrow-peer), SEALS the "mine" (device)
 * share into the vault's recovery store, and returns all three cards — so the operator places "Recovery-card
 * mine" (its share sealed here) + two custodian cards by hand, IDENTICAL to the reserve ceremony. The
 * custodians who hold a citizen's reserve cards hold this same card shape for their identity.
 *
 * SEMANTICS (per canon, unchanged): the shares reconstruct the root TRANSIENTLY at recovery to sign a
 * re-admit edge for a FRESH device, then zeroize it (reconstructAndReadmit). The card SHAPE + handshake
 * share with the reserve; the recovery quorum IS the impersonation quorum (accepted priced/social) exactly
 * as `provisionRecoveryAtFounding` already stands — this path only re-shapes the surface into cards.
 *
 * The two custodian cards recover WITHOUT "mine" (distinct-custodian quorum); one card alone reconstructs
 * nothing (recovery-share's type wall). The root seed zeroizes the instant it is split.
 */
export async function provisionRecoveryCardsAtFounding(
  vault: PersonaVault,
  custodianA: string | null,
  custodianB: string | null,
  rng: RandomProvider,
  recoveryEpoch = 1,
  handleIndex = 0,
): Promise<RecoveryCardsAtFounding> {
  assertHandleIndex(handleIndex);
  if (!vault.recovery) {
    throw new Error("[recovery-keel-core] this vault provisions no recovery store — cannot seal a device-share");
  }
  const rootSeed = await loadPersonaRootSeed(vault, handleIndex);
  try {
    const split: CustodianCardSplit = splitToCustodianCards(rootSeed, custodianA, custodianB, recoveryEpoch, rng);
    await vault.recovery.save(handleIndex, split.mineShare);   // seal the "mine" (device) share at rest
    return { cards: split.cards, mineSealed: true };
  } finally {
    rootSeed.fill(0);   // the root never lingers after the split
  }
}

// ── FORK B — THRESHOLD-ATTEST recovery (identity-classes#the-two-forks) ────────────────────────────────
// The strictest never-reconstruct: each recovery contact holds their OWN recovery keypair; inception pre-commits
// the k-of-n DIGEST of their recovery PUBLIC keys; a rotation carries k recovery contact SIGNATURES verified against
// that pre-commit. Recovery ROTATES a fresh op-key rather than resurrecting the old (the ruling, 2026-07-20).
// NOTHING reconstructs — no seed, no share, no `reconstructFromQuorum`. This path shares NOTHING with the
// Shamir/recovery-share machinery above; it is a genuine k-of-n multisig over the persona-KEL rotation.

/** The default recovery threshold — k in a k-of-n recovery contact quorum (2-of-3 at founding, the reserve rhyme). */
export const THRESHOLD_RECOVERY_DEFAULT = 2;

/** What a Fork-B founding provisions: the persona-KEL INCEPTION (the stable identifier prefix) + the
 *  pre-committed recovery-set digest over the recovery contacts' recovery PUBLIC keys. NO secret splits — the
 *  recovery contacts already hold their own recovery keypairs; the founding only COMMITS to their public set. */
export interface ThresholdRecoveryAtFounding {
  /** The persona-KEL inception event — its `prefix` IS the stable identifier the Binding-Gate pins. */
  readonly inception:       PersonaKelEvent;
  /** The pre-committed k-of-n digest of the recovery contacts' recovery pubkeys (folded into the prefix). */
  readonly recoverySetHash: string;
  /** k — the quorum threshold committed at founding. */
  readonly recoveryThreshold: number;
}

/**
 * Provision Fork-B recovery at FOUNDING: pre-commit the recovery contacts' recovery PUBLIC keys (their k-of-n
 * digest) and seat the persona-KEL inception over (founding op-key + that digest). The digest folds into
 * the identifier prefix, so no attacker incepts a DIFFERENT recovery set under the same identity.
 *
 * The recovery keys NEVER sign until a rotation reveals them, so a compromise of the operational present
 * cannot forge the recovery future (the independence rule — identity-classes#the-honest-edges). The three
 * recovery contact keys MUST sit in three domains that do not fall together (the online-identity + co-location
 * traps); this function commits the set, it does not custody the recovery contacts' secrets (each recovery contact does).
 *
 * ADDITIVE / not-yet-wired: the live founding ceremony still pins the raw op-key `signerDid`; moving the
 * Binding-Gate pin to `inception.prefix` rides the SURFACED pin-move plan (identity-classes#the-continuity-anchor).
 */
export function provisionThresholdRecoveryAtFounding(input: {
  readonly foundingOpKeyDid:  string;              // "0x"+hex — the founding operational key the inception seats
  /** TYPED registrations, never bare hex — the pre-commit derives from cards a ceremony rendered,
   *  so a share code cannot arrive where a registration belongs (the IdenTrust wrong-object cure). */
  readonly recoveryContacts:          readonly RecoveryContactRegistration[];
  readonly recoveryThreshold?: number;             // k (default 2-of-3)
}): ThresholdRecoveryAtFounding {
  const recoveryThreshold = input.recoveryThreshold ?? THRESHOLD_RECOVERY_DEFAULT;
  if (input.recoveryContacts.length < recoveryThreshold) {
    throw new Error("[recovery-keel-core] fewer recovery contact registrations than the threshold — cannot pre-commit an unmeetable quorum");
  }
  const recoverySetHash = sealKeySetHash(input.recoveryContacts.map((g) => g.recoveryPubKey), recoveryThreshold);
  const inception       = mintPersonaInception(input.foundingOpKeyDid, recoverySetHash);
  return { inception, recoverySetHash, recoveryThreshold };
}

/** One recovery contact's recovery signer — its recovery PUBLIC key + a sign fn over the rotation bytes. The module
 *  holds NO recovery contact key; each recovery contact supplies its own signer (mirrors `signAntigenEntry` / wax-stamp). */
export interface RecoveryContactSigner {
  readonly signer: string;                                   // the recovery contact's recovery pubkey (64-hex)
  readonly sign:   (bytes: Uint8Array) => Promise<string>;   // ed25519 sig hex over `personaRotationSigningBytes`
}

/**
 * ATTEST-AND-ROTATE — the Reading-B recovery move (identity-classes#reading-b-recovery), replacing
 * reconstruct-then-resurrect. Gather ≥ k recovery contact SIGNATURES over the rotation event, verify them against
 * the pre-committed recovery set, and seat a FRESH operational key via a persona-KEL rotation. The old key
 * SUPERSEDES (the head advances past it); the caller kapae-shadows its membership resurrection (evict runs
 * forward-only). NOTHING reconstructs — the recovery contacts each sign independently; no seed or share assembles,
 * so no transient impersonation-of-the-recovery-authority window opens (the Fork-A tradeoff, closed).
 *
 * FAILS CLOSED: fewer than k valid DISTINCT-recovery-contact signatures REFUSE; a signer outside the pre-committed
 * set does NOT count; a revealed roster whose digest misses the pre-commit REFUSES (mintPersonaRotation).
 * The `freshOpKeyDid` is the op-key the recovering vessel just minted and holds SOLELY — no quorum, no
 * recovery contact, no recovery root ever holds it post-rotation.
 */
export async function attestAndRotate(input: {
  readonly head:                 PersonaKelEvent;                 // the current KEL head
  readonly freshOpKeyDid:        string;                          // the fresh op-key the recovering vessel minted
  readonly recoveryContactKeys: readonly string[];               // the REVEALED n recovery contact recovery pubkeys
  readonly recoveryThreshold:    number;                          // k
  readonly recoveryContactSigners:      readonly RecoveryContactSigner[]; // ≥ k independent recovery contact signers
  /** The NEXT recovery contact set this rotation GRAFTS — TYPED registrations, never bare hex (the wrong-object
   *  cure holds at the ceremony door). Absent, the standing commitment carries forward unchanged. */
  readonly next?: { readonly recoveryContacts: readonly RecoveryContactRegistration[]; readonly threshold: number };
  /** A contest-window entry (Fork C): the rotation lands PROVISIONAL — kapae-reversible authority
   *  until an observer hardens it, the standing op-key's veto killing it at any causal distance. */
  readonly provisional?: boolean;
  /** The devices this rotation RE-ENROLS, sealed by the fresh op-key (`rollEnrolments`). The recovery contacts sign their
   *  digest with the rotation, so rotation and re-enrolment land as one act. Absent, the rotation enrols no one. */
  readonly enrolments?: readonly SealedEnrolment[];
}): Promise<PersonaRotateResult> {
  const nextRecoverySetHash = input.next
    ? sealKeySetHash(input.next.recoveryContacts.map((g) => g.recoveryPubKey), input.next.threshold)
    : input.head.nextRecoverySetHash;
  const bytes = personaRotationSigningBytes(input.head, input.freshOpKeyDid, nextRecoverySetHash, input.provisional ?? false, input.enrolments ?? []);
  const rotationSigs: QuorumSignature[] = [];
  for (const g of input.recoveryContactSigners) {
    rotationSigs.push({ signer: g.signer, sig: await g.sign(bytes) });
  }
  return mintPersonaRotation({
    head:              input.head,
    freshOpKeyDid:     input.freshOpKeyDid,
    recoveryRoster:    input.recoveryContactKeys,
    recoveryThreshold: input.recoveryThreshold,
    rotationSigs,
    nextRecoverySetHash,
    ...(input.provisional ? { provisional: true } : {}),
    ...(input.enrolments ? { enrolments: input.enrolments } : {}),
  });
}

// ── RECOVERY CONTACT ENROLMENT — the verb's core (stable-founding-road#/rulings, "Recovery contact enrolment's shape") ──────────
// A face founds one-of-one; its first recovery contact set lands by ONE typed event its own current op-key signs
// (`mintRecoveryContactEnrolment`), and every later change takes the recovery contacts' quorum (`attestAndRotate`). The core below
// checks what the vessel and the recovery contacts owe before that event mints: each recovery contact proves it holds its key, no
// key repeats, the threshold meets the set, and no key serves another face this vessel holds
// (persona-policy#/distinct-recovery). The count and the threshold stand ruled: three recovery contacts, two of whom
// restore the Handle (operator, 2026-10-31), and the face's own self-recovery key counts as none of the three. Request
// authentication, the veto and succession stay the person's and the operator's (kahu#/seed-and-nexus, OPEN).

/** The bytes a recovery contact signs to prove it holds the private half of `recoveryPubKey`, offered to the face `prefix`. */
export function recoveryContactPossessionBytes(prefix: string, recoveryPubKey: string): Uint8Array {
  return canonicalJsonBytes({ domain: RECOVERY_CONTACT_POSSESSION_DOMAIN, prefix, key: recoveryPubKey.toLowerCase() });
}

/** One recovery contact's offer to one face: its registration card and its possession proof over that face's prefix. */
export interface RecoveryContactEnrolmentOffer {
  readonly registration:  RecoveryContactRegistration;
  /** The recovery contact's signature over `recoveryContactPossessionBytes(prefix, registration.recoveryPubKey)`. */
  readonly possessionSig: string;
}

/** The recovery contact keys this vessel already holds in ANOTHER face's set, per face. */
export interface RecoveryContactKeysOfFace {
  readonly handleIndex: number;
  readonly keys:        readonly string[];
}

/** The compartment check's answer: every offered key stands apart, or the first that serves another face. */
export type RecoveryContactCompartmentVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly key: string; readonly handleIndex: number };

/**
 * NO RECOVERY CONTACT KEY EVER SERVES TWO FACES (persona-policy#/distinct-recovery): a key offered to one face that this
 * vessel already holds in another face's set refuses, naming that face. One vault sees every face it holds, so the
 * check stays local and reads only this vessel's own faces: it builds no roster.
 */
export function recoveryContactCompartmentCheck(input: {
  readonly offered:          readonly string[];
  readonly heldByOtherFaces: readonly RecoveryContactKeysOfFace[];
}): RecoveryContactCompartmentVerdict {
  const held = new Map<string, number>();
  for (const face of input.heldByOtherFaces) for (const k of face.keys) held.set(k.toLowerCase(), face.handleIndex);
  for (const k of input.offered) {
    const key = k.toLowerCase();
    const handleIndex = held.get(key);
    if (handleIndex !== undefined) return { ok: false, key, handleIndex };
  }
  return { ok: true };
}

/** Why an enrolment refused, by name. */
export type RecoveryContactEnrolRefusal =
  | "face-holds-recovery-contacts"              // the face's rolling set already left its genesis set: the recovery contacts change it
  | "recovery-contacts-not-three"       // any count of recovery contacts but three
  | "threshold-not-two"                 // any threshold but two (two of the three restore the Handle)
  | "self-recovery-key-offered"         // the face's own self-recovery key stands among the offered: it counts as none of the three
  | "recovery-contact-key-repeated"             // one key offered twice
  | "possession-unproven"               // a recovery contact's proof fails over this face's prefix and its own key
  | "recovery-contact-key-serves-another-face"  // a key this vessel holds in another face's set
  | "enrolment-refused";                // the log refused the event itself (a provisional head, a bad signature)

/** An enrolment's outcome: the typed event and the digest it committed, or a refusal by name. */
export type RecoveryContactEnrolResult =
  | { readonly ok: true;  readonly event: PersonaKelEvent; readonly recoveryContactSetHash: string }
  | { readonly ok: false; readonly refusal: RecoveryContactEnrolRefusal; readonly reason: string };

/**
 * ENROL a one-of-one face's first recovery contact set. Checks in order, each refusing by name before anything mints: the face
 * still holds its genesis set alone; exactly three recovery contacts stand offered; the threshold reads two; no key repeats;
 * none is the face's own self-recovery key; every recovery contact proves
 * possession over THIS face's prefix; no key serves another face. Then the face's own current op-key signs the typed
 * event (`mintRecoveryContactEnrolment`). The caller writes the event to the face's KEL board and keeps the registrations:
 * a later rotation reveals them against the digest.
 */
export async function enrolRecoveryContacts(input: {
  readonly head:             PersonaKelEvent;
  readonly recoveryContacts:        readonly RecoveryContactEnrolmentOffer[];
  readonly threshold:        number;
  readonly heldByOtherFaces: readonly RecoveryContactKeysOfFace[];
  /** The face's own self-recovery key (its public half): it counts as none of the three, whatever shape the genesis set holds. */
  readonly selfRecoveryKey:  string;
  /** The face's CURRENT op-key's signer. */
  readonly sign:             (bytes: Uint8Array) => Promise<string>;
}): Promise<RecoveryContactEnrolResult> {
  const refuse = (refusal: RecoveryContactEnrolRefusal, reason: string): RecoveryContactEnrolResult => ({ ok: false, refusal, reason });
  const { head, recoveryContacts, threshold } = input;
  if (head.nextRecoverySetHash !== head.recoverySetHash) {
    return refuse("face-holds-recovery-contacts", "this face already holds a recovery contact set: a change to it takes the recovery contacts' quorum, by rotation");
  }
  if (recoveryContacts.length !== RECOVERY_CONTACT_COUNT) {
    return refuse("recovery-contacts-not-three", `a face enrols three recovery contacts and ${recoveryContacts.length} stand offered: two of the three, together, restore your Handle`);
  }
  if (threshold !== RECOVERY_CONTACT_THRESHOLD) {
    return refuse("threshold-not-two", `a threshold of ${threshold} is not the rule: two of the three recovery contacts, together, restore your Handle`);
  }
  const keys = recoveryContacts.map((g) => g.registration.recoveryPubKey.toLowerCase());
  if (new Set(keys).size !== keys.length) return refuse("recovery-contact-key-repeated", "one recovery contact key stands twice in the offered set");
  // The face's own self-recovery key counts as none of the three: excluded by the key itself, never by the genesis shape.
  const self = keys.find((k) => k === input.selfRecoveryKey.toLowerCase());
  if (self !== undefined) {
    return refuse("self-recovery-key-offered", `the key ${self.slice(0, 16)}… is this face's own self-recovery key: it counts as none of the three recovery contacts`);
  }
  for (const g of recoveryContacts) {
    const key = g.registration.recoveryPubKey.toLowerCase();
    let holds = false;
    try { holds = verifyEd25519(g.possessionSig, recoveryContactPossessionBytes(head.prefix, key), key); } catch { holds = false; }
    if (!holds) return refuse("possession-unproven", `the recovery contact key ${key.slice(0, 16)}… shows no proof that its holder signs for this face`);
  }
  const apart = recoveryContactCompartmentCheck({ offered: keys, heldByOtherFaces: input.heldByOtherFaces });
  if (!apart.ok) {
    return refuse("recovery-contact-key-serves-another-face", `the recovery contact key ${apart.key.slice(0, 16)}… already serves the face at handle-index ${apart.handleIndex}: a recovery contact cuts a fresh key for each face`);
  }
  const recoveryContactSetHash = sealKeySetHash(keys, threshold);
  const minted = await mintRecoveryContactEnrolment({ head, recoveryContactSetHash, sign: input.sign });
  return minted.ok ? { ok: true, event: minted.event, recoveryContactSetHash } : refuse("enrolment-refused", minted.reason);
}
