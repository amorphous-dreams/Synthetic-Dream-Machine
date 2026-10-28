/**
 * face-proof-subjects — the SUBJECTS of the face proof, their canonical signed images, and their readers.
 *
 * A session proves ONE face at a gate and names no vessel. The chain a gate reads:
 *
 *     face key (the admitted nym)  →  the vessel's face-scoped key  →  session key
 *
 * This module holds what each link carries, the exact bytes each signature covers, and the readers that
 * check one link. It decides nothing about a chain as a whole: `face-authority` folds the withdrawal history
 * and reads a chain's verdict, and `session-signer` holds a session's key.
 *
 * The invariants:
 *   · A SCOPE NAMES ONE FACE AT ONE NEXUS. Every signed image and every digest carries the face key and the
 *     Nexus, so nothing signed for one face or one Nexus verifies under another.
 *   · NO VESSEL STANDS IN A PROOF. No subject carries a vessel root, a device key, a PersonaGroup id, a
 *     session id or an owner epoch. Every reader takes EXACT keys, so one extra field refuses the whole
 *     subject, and the three keys of a chain read pairwise distinct.
 *   · ONE IMAGE, ONE PURPOSE. An image reads as length-prefixed fields in a fixed order, and its first field
 *     names its purpose from the domain table. No two purposes share a first field, and a length prefix
 *     leaves no two field lists one encoding.
 *   · EVERY KEY AND EVERY SIGNATURE PASSES THE ONE DOOR (`ed25519-door`).
 *   · A SUBJECT HOLDS STRINGS AND COUNTS. Keys, digests and signatures read as bare lower-case hex; no
 *     subject holds a secret.
 *
 * Pure: no key custody, no I/O, no timer, no clock, no randomness.
 * Called by the gate, the dial, the join door, the removal door and the sealed store's records; the package barrel names it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes, utf8Bytes } from "./crypto.js";
import {
  FACE_CERTIFICATE_DOMAIN, FACE_CERTIFICATE_REQUEST_DOMAIN, FACE_PROOF_SUBJECT_DOMAIN, FACE_WITHDRAWAL_DOMAIN,
  FACE_WITHDRAWAL_GENESIS_DOMAIN, FACE_WITHDRAWN_KEY_DOMAIN, SESSION_ACT_DOMAIN, SESSION_AUTHORITY_DOMAIN,
  SESSION_CERTIFICATE_DOMAIN, SESSION_FINISH_DOMAIN,
  PLACE_PROOF_SUBJECT_DOMAIN, PLACE_SESSION_ACT_DOMAIN, PLACE_SESSION_AUTHORITY_DOMAIN, PLACE_SESSION_CERTIFICATE_DOMAIN,
} from "./domains.js";
import { acceptEd25519Key, readEd25519, type Ed25519KeyRefusal, type Ed25519Refusal } from "./ed25519-door.js";
import { CAPABILITY_PROFILES, isCapabilityProfile, type CapabilityProfile } from "./session-contract.js";

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────

/** Every named refusal a subject reader answers. */
export const FACE_PROOF_REFUSALS = [
  "subject-malformed",        // a wrong shape, a missing or an extra field, a value of the wrong kind
  "key-refused",              // a key the one door refuses; `door` names the door's own reason
  "keys-not-distinct",        // two links of one chain name one key
  "key-held-apart",           // a key the caller holds for anything else (a vessel root, another face's key) stands in a proof
  "signature-refused",        // a signature the one door refuses; `door` names the door's own reason
  "purpose-beyond-profile",   // a session signature under a purpose its certificate's profile never signs
] as const;
export type FaceProofRefusalName = (typeof FACE_PROOF_REFUSALS)[number];

export interface FaceProofRefusal {
  readonly refusal: FaceProofRefusalName;
  /** The one door's own word, where the door refused. */
  readonly door?:   Ed25519KeyRefusal | Ed25519Refusal;
}
/** What a reader answers: the subject, frozen, or a named refusal. Never a boolean. */
export type Read<T> = { readonly read: T } | FaceProofRefusal;

/**
 * Does `value` carry `key` as its OWN property? Every answer in the face proof gets told apart by this and
 * never by `in`: a refusal carries no `read`, whatever a prototype holds.
 */
export function own<T extends object, K extends PropertyKey>(value: T, key: K): value is Extract<T, Record<K, unknown>> {
  return Object.hasOwn(value, key);
}

const refuse = (refusal: FaceProofRefusalName, door?: Ed25519KeyRefusal | Ed25519Refusal): FaceProofRefusal =>
  Object.freeze(door === undefined ? { refusal } : { refusal, door });

// ── The typed strings ───────────────────────────────────────────────────────────────────────────

declare const FACE_KEY: unique symbol;
declare const VESSEL_FACE_KEY: unique symbol;
declare const SESSION_KEY: unique symbol;
declare const NEXUS_AID: unique symbol;
declare const DIGEST: unique symbol;
declare const SIGNATURE: unique symbol;

/** The face proof key of one (PersonaGroup, Nexus): the nym a Nexus admits. Bare lower-case hex. */
export type FaceKey = string & { readonly [FACE_KEY]: true };
/** One vessel's face-scoped key under one face at one Nexus. Never a vessel root, never derived from one. */
export type VesselFaceKey = string & { readonly [VESSEL_FACE_KEY]: true };
/** One session's key at one Nexus. */
export type SessionKey = string & { readonly [SESSION_KEY]: true };
/** A Nexus's own identifier, read as the exact string its charter names. */
export type NexusAid = string & { readonly [NEXUS_AID]: true };
/** A SHA-256 digest, bare lower-case hex. */
export type Digest = string & { readonly [DIGEST]: true };
/** An Ed25519 signature, bare lower-case hex. */
export type Signature = string & { readonly [SIGNATURE]: true };

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
/** A Nexus identifier: printable ASCII with no space, bounded. One spelling: no trim and no case fold. */
const NEXUS = /^[\x21-\x7e]{1,256}$/;

function readKey<K extends string>(value: unknown): Read<K> {
  // Hex alone: a subject holds strings, so bytes the door would accept still read as no key here.
  if (typeof value !== "string" || !HEX64.test(value)) return refuse("key-refused", "key-malformed");
  const reading = acceptEd25519Key(value);
  if (!reading.ok) return refuse("key-refused", reading.refusal);
  return { read: value as K };
}
export const readFaceKey = (value: unknown): Read<FaceKey> => readKey<FaceKey>(value);
export const readVesselFaceKey = (value: unknown): Read<VesselFaceKey> => readKey<VesselFaceKey>(value);
export const readSessionKey = (value: unknown): Read<SessionKey> => readKey<SessionKey>(value);

export function readNexusAid(value: unknown): Read<NexusAid> {
  return typeof value === "string" && NEXUS.test(value) ? { read: value as NexusAid } : refuse("subject-malformed");
}
export function readDigest(value: unknown): Read<Digest> {
  return typeof value === "string" && HEX64.test(value) ? { read: value as Digest } : refuse("subject-malformed");
}
function readSignature(value: unknown): Read<Signature> {
  return typeof value === "string" && HEX128.test(value) ? { read: value as Signature } : refuse("subject-malformed");
}

// ── The subjects ────────────────────────────────────────────────────────────────────────────────

/** ONE face at ONE Nexus: what every image and every digest binds. */
export interface FaceScope {
  readonly faceKey: FaceKey;
  readonly nexus:   NexusAid;
}

/** A joining vessel's request: its own face-scoped key signs for itself. */
export interface VesselFaceCertificateRequest {
  readonly scope:         FaceScope;
  readonly vesselFaceKey: VesselFaceKey;
  readonly signature:     Signature;       // by the vessel's face-scoped key
}

/** The certificate the face key signs ONCE, at the join. */
export interface VesselFaceCertificate {
  readonly scope:         FaceScope;
  readonly vesselFaceKey: VesselFaceKey;
  readonly signature:     Signature;       // by the face key
}

/** How much withdrawal history a party holds: a position, and the head at that position. Position 0 names
 *  the genesis head. */
export interface WithdrawalFrontier {
  readonly position: number;
  readonly head:     Digest;
}

/** One event of a face's deny-only withdrawal history. */
export interface FaceWithdrawal {
  readonly scope:     FaceScope;
  readonly position:  number;              // 1 for the first event; each event stands one past its predecessor
  readonly previous:  Digest;              // the head before this event; the genesis head for the first
  readonly withdrawn: Digest;              // `withdrawnKeyDigest` of the denied key
  readonly signature: Signature;           // by the face key
}

/** A session's certificate: the vessel's face-scoped key signs one session key and its hand's profile. */
export interface SessionCertificate {
  readonly scope:         FaceScope;
  readonly vesselFaceKey: VesselFaceKey;
  readonly sessionKey:    SessionKey;
  readonly profile:       CapabilityProfile;
  readonly signature:     Signature;       // by the vessel's face-scoped key
}

/** The field names of every subject, each exact. A subject's reader refuses any other key, so no vessel
 *  root, device key, PersonaGroup id, session id or owner epoch can ride one. */
export const FACE_PROOF_SUBJECT_FIELDS = Object.freeze({
  scope:              Object.freeze(["faceKey", "nexus"] as const),
  certificateRequest: Object.freeze(["scope", "vesselFaceKey", "signature"] as const),
  certificate:        Object.freeze(["scope", "vesselFaceKey", "signature"] as const),
  frontier:           Object.freeze(["position", "head"] as const),
  withdrawal:         Object.freeze(["scope", "position", "previous", "withdrawn", "signature"] as const),
  sessionCertificate: Object.freeze(["scope", "vesselFaceKey", "sessionKey", "profile", "signature"] as const),
});

// ── Canonical images ────────────────────────────────────────────────────────────────────────────

const MAX_FIELD = 0xffff_ffff;

/** The one encoding: each field as a four-byte big-endian length, then its bytes; the purpose leads. */
function image(domain: string, ...fields: readonly Uint8Array[]): Uint8Array {
  const parts = [utf8Bytes(domain), ...fields];
  let size = 0;
  for (const part of parts) {
    if (part.length > MAX_FIELD) throw new RangeError("face-proof-subjects: a field outgrew its length prefix");
    size += 4 + part.length;
  }
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let at = 0;
  for (const part of parts) {
    view.setUint32(at, part.length, false);
    out.set(part, at + 4);
    at += 4 + part.length;
  }
  return out;
}

/** A position as eight big-endian bytes. */
function positionBytes(position: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(position), false);
  return out;
}

const scopeFields = (scope: FaceScope): Uint8Array[] => [hexToBytes(scope.faceKey), utf8Bytes(scope.nexus)];
const digestOf = (bytes: Uint8Array): Digest => hex(sha256(bytes)) as Digest;

/** The bytes a joining vessel's own face-scoped key signs. */
export function certificateRequestImage(scope: FaceScope, vesselFaceKey: VesselFaceKey): Uint8Array {
  return image(FACE_CERTIFICATE_REQUEST_DOMAIN, ...scopeFields(scope), hexToBytes(vesselFaceKey));
}
/** The bytes the face key signs over one vessel's face-scoped key. */
export function certificateImage(scope: FaceScope, vesselFaceKey: VesselFaceKey): Uint8Array {
  return image(FACE_CERTIFICATE_DOMAIN, ...scopeFields(scope), hexToBytes(vesselFaceKey));
}
/** The bytes the face key signs for one withdrawal event. */
export function withdrawalImage(scope: FaceScope, position: number, previous: Digest, withdrawn: Digest): Uint8Array {
  return image(FACE_WITHDRAWAL_DOMAIN, ...scopeFields(scope), positionBytes(position), hexToBytes(previous), hexToBytes(withdrawn));
}
/** The bytes the vessel's face-scoped key signs over one session key and its profile. */
export function sessionCertificateImage(scope: FaceScope, vesselFaceKey: VesselFaceKey, sessionKey: SessionKey, profile: CapabilityProfile): Uint8Array {
  return image(SESSION_CERTIFICATE_DOMAIN, ...scopeFields(scope), hexToBytes(vesselFaceKey), hexToBytes(sessionKey), utf8Bytes(profile));
}

/** The digest a denial names a key by. It binds the scope, so no two histories share a value and a reader
 *  that never met the key learns nothing of it. */
export function withdrawnKeyDigest(scope: FaceScope, vesselFaceKey: VesselFaceKey): Digest {
  return digestOf(image(FACE_WITHDRAWN_KEY_DOMAIN, ...scopeFields(scope), hexToBytes(vesselFaceKey)));
}
/** The frontier of a history that holds no event. */
export function genesisFrontier(scope: FaceScope): WithdrawalFrontier {
  return Object.freeze({ position: 0, head: digestOf(image(FACE_WITHDRAWAL_GENESIS_DOMAIN, ...scopeFields(scope))) });
}
/** The head a withdrawal event stands as: the digest of its signed image. */
export function withdrawalHead(event: FaceWithdrawal): Digest {
  return digestOf(withdrawalImage(event.scope, event.position, event.previous, event.withdrawn));
}
/** The reference a local session carries for its face's proof subject. One per (face key, Nexus). */
export function faceProofSubjectRef(scope: FaceScope): string {
  return digestOf(image(FACE_PROOF_SUBJECT_DOMAIN, ...scopeFields(scope)));
}

// ── A place-anchored session: the face's atom at its own vessel's place ────────────────────────────

/**
 * ONE face at ONE place: the face's atom presented to its own vessel, which dials no Nexus. `place` names the vessel's
 * W29 place KEL prefix. A place scope shares no image with a Nexus scope: every place image leads with a place name.
 */
export interface PlaceScope {
  readonly atomKey: FaceKey;
  readonly place:   string;
}
/** A place session's certificate: the face's atom signs one session key and its hand's profile at one place. */
export interface PlaceSessionCertificate {
  readonly scope:      PlaceScope;
  readonly sessionKey: SessionKey;
  readonly profile:    CapabilityProfile;
  readonly signature:  Signature;       // by the face's atom
}
/** What a place session signs: an ordinary act, and an act that changes who holds authority. A place dials no gate,
 *  so no place session signs a dial's finish. */
export const PLACE_SIGNING_PURPOSES = ["act", "authority"] as const;
export type PlaceSigningPurpose = (typeof PLACE_SIGNING_PURPOSES)[number];
const PLACE_PURPOSE_DOMAINS: Readonly<Record<PlaceSigningPurpose, string>> = Object.freeze({
  act: PLACE_SESSION_ACT_DOMAIN, authority: PLACE_SESSION_AUTHORITY_DOMAIN,
});
export function isPlaceSigningPurpose(value: unknown): value is PlaceSigningPurpose {
  return typeof value === "string" && (PLACE_SIGNING_PURPOSES as readonly string[]).includes(value);
}
/** A place: printable ASCII with no space, as a KEL prefix spells it. */
const PLACE = /^[\x21-\x7e]{1,256}$/;
const placeFields = (scope: PlaceScope): Uint8Array[] => [hexToBytes(scope.atomKey), utf8Bytes(scope.place)];

/** Read a place scope: exact keys, an atom key the door accepts, a place in its one spelling. */
export function readPlaceScope(value: unknown): Read<PlaceScope> {
  return guarded(() => {
    if (!isRecord(value) || !exactKeys(value, ["atomKey", "place"])) return refuse("subject-malformed");
    const atomKey = readFaceKey(value["atomKey"]);
    if (refused(atomKey)) return atomKey;
    const place = value["place"];
    if (typeof place !== "string" || !PLACE.test(place)) return refuse("subject-malformed");
    return { read: Object.freeze({ atomKey: atomKey.read, place }) };
  });
}
/** The reference a place session carries for its face's proof subject. One per (atom, place). */
export function placeProofSubjectRef(scope: PlaceScope): string {
  return digestOf(image(PLACE_PROOF_SUBJECT_DOMAIN, ...placeFields(scope)));
}
/** The bytes the face's atom signs over one place session's key and its profile. */
export function placeSessionCertificateImage(scope: PlaceScope, sessionKey: SessionKey, profile: CapabilityProfile): Uint8Array {
  return image(PLACE_SESSION_CERTIFICATE_DOMAIN, ...placeFields(scope), hexToBytes(sessionKey), utf8Bytes(profile));
}
/** The bytes a place session's key signs under one purpose over one payload. */
export function placeSessionSignatureImage(purpose: PlaceSigningPurpose, scope: PlaceScope, sessionKey: SessionKey, payload: Uint8Array): Uint8Array {
  return image(PLACE_PURPOSE_DOMAINS[purpose], ...placeFields(scope), hexToBytes(sessionKey), payload);
}
/** Read a place session's certificate: its shape, two distinct keys, a known profile, and the atom's signature over it. */
export function readPlaceSessionCertificate(value: unknown): Read<PlaceSessionCertificate> {
  return guarded(() => {
    if (!isRecord(value) || !exactKeys(value, ["scope", "sessionKey", "profile", "signature"])) return refuse("subject-malformed");
    const scope = readPlaceScope(value["scope"]);
    if (refused(scope)) return scope;
    const sessionKey = readSessionKey(value["sessionKey"]);
    if (refused(sessionKey)) return sessionKey;
    const profile = value["profile"];
    if (!isCapabilityProfile(profile)) return refuse("subject-malformed");
    const signature = readSignature(value["signature"]);
    if (refused(signature)) return signature;
    if ((scope.read.atomKey as string) === sessionKey.read) return refuse("keys-not-distinct");
    return checked(signature.read, placeSessionCertificateImage(scope.read, sessionKey.read, profile), scope.read.atomKey)
      ?? { read: Object.freeze({ scope: scope.read, sessionKey: sessionKey.read, profile, signature: signature.read }) };
  });
}
/** Read one signature of a place session's key: a purpose within the certificate's profile, over exactly `payload`. */
export function readPlaceSessionSignature(certificate: PlaceSessionCertificate, purpose: unknown, payload: unknown, signature: unknown): Read<PlaceSigningPurpose> {
  return guarded(() => {
    if (!isPlaceSigningPurpose(purpose) || !(payload instanceof Uint8Array)) return refuse("subject-malformed");
    const sig = readSignature(signature);
    if (refused(sig)) return sig;
    if (!profileSigns(certificate.profile, purpose)) return refuse("purpose-beyond-profile");
    return checked(sig.read, placeSessionSignatureImage(purpose, certificate.scope, certificate.sessionKey, payload), certificate.sessionKey)
      ?? { read: purpose };
  });
}

// ── What a session signer signs ─────────────────────────────────────────────────────────────────

/** The purposes a session signer signs under: the dial's signed finish, an ordinary act, and an act that
 *  changes who holds authority. */
export const SESSION_SIGNING_PURPOSES = ["finish", "act", "authority"] as const;
export type SessionSigningPurpose = (typeof SESSION_SIGNING_PURPOSES)[number];

const PURPOSE_DOMAINS: Readonly<Record<SessionSigningPurpose, string>> = Object.freeze({
  finish: SESSION_FINISH_DOMAIN, act: SESSION_ACT_DOMAIN, authority: SESSION_AUTHORITY_DOMAIN,
});

/**
 * What each hand's profile may sign. Every hand dials and acts. A person's tab and a person's CLI run sign
 * acts that change who holds authority; the disk watcher and a spirit's seat never do.
 */
export const PROFILE_SIGNING_PURPOSES: Readonly<Record<CapabilityProfile, readonly SessionSigningPurpose[]>> = Object.freeze({
  face:   Object.freeze(["finish", "act", "authority"] as const),
  verb:   Object.freeze(["finish", "act", "authority"] as const),
  ingest: Object.freeze(["finish", "act"] as const),
  seat:   Object.freeze(["finish", "act"] as const),
});

export function isSessionSigningPurpose(value: unknown): value is SessionSigningPurpose {
  return typeof value === "string" && (SESSION_SIGNING_PURPOSES as readonly string[]).includes(value);
}
/** May a session of `profile` sign under `purpose`? */
export function profileSigns(profile: CapabilityProfile, purpose: SessionSigningPurpose): boolean {
  return PROFILE_SIGNING_PURPOSES[profile]?.includes(purpose) ?? false;
}

/** The bytes a session key signs under one purpose over one payload. */
export function sessionSignatureImage(purpose: SessionSigningPurpose, scope: FaceScope, sessionKey: SessionKey, payload: Uint8Array): Uint8Array {
  return image(PURPOSE_DOMAINS[purpose], ...scopeFields(scope), hexToBytes(sessionKey), payload);
}

// ── Readers: shape first, then the keys, then the signature ─────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  // EVERY own key counts: a symbol or a non-enumerable field rides no subject either.
  return Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
const refused = <T>(reading: Read<T>): reading is FaceProofRefusal => !own(reading, "read");

/** A value that throws while a reader reads it holds no subject. */
function guarded<T>(read: () => Read<T>): Read<T> {
  try { return read(); } catch { return refuse("subject-malformed"); }
}

/** Read a scope: exact keys, a face key the door accepts, a Nexus in its one spelling. */
export function readFaceScope(value: unknown): Read<FaceScope> {
  return guarded(() => {
    if (!isRecord(value) || !exactKeys(value, FACE_PROOF_SUBJECT_FIELDS.scope)) return refuse("subject-malformed");
    const faceKey = readFaceKey(value["faceKey"]);
    if (refused(faceKey)) return faceKey;
    const nexus = readNexusAid(value["nexus"]);
    if (refused(nexus)) return nexus;
    return { read: Object.freeze({ faceKey: faceKey.read, nexus: nexus.read }) };
  });
}

/** Do two scopes name one face at one Nexus? */
export function sameFaceScope(a: FaceScope, b: FaceScope): boolean {
  return a.faceKey === b.faceKey && a.nexus === b.nexus;
}

/**
 * Keys a caller holds APART from this proof: its vessel's roots, and its other faces' keys. A proof built
 * over one of them refuses by name. A gate holds none and passes an empty list; a vessel passes every key
 * it could confuse with a face-scoped one. No reader can tell a reused key from a fresh one by its bytes, so
 * this list carries the law that no key serves two faces or two Nexuses: the join door and the issuer MUST
 * fill it.
 */
export type KeysHeldApart = readonly string[];

function standsApart(key: string, apart: KeysHeldApart): boolean {
  return !apart.includes(key);
}

interface CertificateShape { scope: FaceScope; vesselFaceKey: VesselFaceKey; signature: Signature }

function readCertificateShape(value: unknown, keys: readonly string[], apart: KeysHeldApart): Read<CertificateShape> {
  if (!isRecord(value) || !exactKeys(value, keys)) return refuse("subject-malformed");
  const scope = readFaceScope(value["scope"]);
  if (refused(scope)) return scope;
  const vesselFaceKey = readVesselFaceKey(value["vesselFaceKey"]);
  if (refused(vesselFaceKey)) return vesselFaceKey;
  const signature = readSignature(value["signature"]);
  if (refused(signature)) return signature;
  if ((vesselFaceKey.read as string) === scope.read.faceKey) return refuse("keys-not-distinct");
  if (!standsApart(vesselFaceKey.read, apart) || !standsApart(scope.read.faceKey, apart)) return refuse("key-held-apart");
  return { read: { scope: scope.read, vesselFaceKey: vesselFaceKey.read, signature: signature.read } };
}

function checked(signature: Signature, message: Uint8Array, key: string): FaceProofRefusal | null {
  const reading = readEd25519(signature, message, key);
  return reading.ok ? null : refuse("signature-refused", reading.refusal);
}

/** Read a joining vessel's request: its shape, its keys, and the vessel's own signature over it. */
export function readCertificateRequest(value: unknown, apart: KeysHeldApart = []): Read<VesselFaceCertificateRequest> {
  return guarded(() => {
    const shape = readCertificateShape(value, FACE_PROOF_SUBJECT_FIELDS.certificateRequest, apart);
    if (refused(shape)) return shape;
    const { scope, vesselFaceKey, signature } = shape.read;
    return checked(signature, certificateRequestImage(scope, vesselFaceKey), vesselFaceKey)
      ?? { read: Object.freeze({ scope, vesselFaceKey, signature }) };
  });
}

/** Read a certificate: its shape, its keys, and the face key's signature over it. */
export function readCertificate(value: unknown, apart: KeysHeldApart = []): Read<VesselFaceCertificate> {
  return guarded(() => {
    const shape = readCertificateShape(value, FACE_PROOF_SUBJECT_FIELDS.certificate, apart);
    if (refused(shape)) return shape;
    const { scope, vesselFaceKey, signature } = shape.read;
    return checked(signature, certificateImage(scope, vesselFaceKey), scope.faceKey)
      ?? { read: Object.freeze({ scope, vesselFaceKey, signature }) };
  });
}

function readPosition(value: unknown, least: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= least;
}

/** Read a frontier: a counting position and a digest. */
export function readFrontier(value: unknown): Read<WithdrawalFrontier> {
  return guarded(() => {
    if (!isRecord(value) || !exactKeys(value, FACE_PROOF_SUBJECT_FIELDS.frontier)) return refuse("subject-malformed");
    const position = value["position"];
    if (!readPosition(position, 0)) return refuse("subject-malformed");
    const head = readDigest(value["head"]);
    if (refused(head)) return head;
    return { read: Object.freeze({ position, head: head.read }) };
  });
}

/** Read one withdrawal event: its shape and the face key's signature over it. Its place in a history
 *  belongs to the fold. */
export function readWithdrawal(value: unknown): Read<FaceWithdrawal> {
  return guarded(() => {
    if (!isRecord(value) || !exactKeys(value, FACE_PROOF_SUBJECT_FIELDS.withdrawal)) return refuse("subject-malformed");
    const scope = readFaceScope(value["scope"]);
    if (refused(scope)) return scope;
    const position = value["position"];
    if (!readPosition(position, 1)) return refuse("subject-malformed");
    const previous = readDigest(value["previous"]);
    if (refused(previous)) return previous;
    const withdrawn = readDigest(value["withdrawn"]);
    if (refused(withdrawn)) return withdrawn;
    const signature = readSignature(value["signature"]);
    if (refused(signature)) return signature;
    return checked(signature.read, withdrawalImage(scope.read, position, previous.read, withdrawn.read), scope.read.faceKey)
      ?? { read: Object.freeze({ scope: scope.read, position, previous: previous.read, withdrawn: withdrawn.read, signature: signature.read }) };
  });
}

/** Read a session's certificate: its shape, three distinct keys, a known profile, and the signature of the
 *  vessel's face-scoped key over it. */
export function readSessionCertificate(value: unknown, apart: KeysHeldApart = []): Read<SessionCertificate> {
  return guarded(() => {
    if (!isRecord(value) || !exactKeys(value, FACE_PROOF_SUBJECT_FIELDS.sessionCertificate)) return refuse("subject-malformed");
    const scope = readFaceScope(value["scope"]);
    if (refused(scope)) return scope;
    const vesselFaceKey = readVesselFaceKey(value["vesselFaceKey"]);
    if (refused(vesselFaceKey)) return vesselFaceKey;
    const sessionKey = readSessionKey(value["sessionKey"]);
    if (refused(sessionKey)) return sessionKey;
    const profile = value["profile"];
    if (!isCapabilityProfile(profile)) return refuse("subject-malformed");
    const signature = readSignature(value["signature"]);
    if (refused(signature)) return signature;
    const keys: readonly string[] = [scope.read.faceKey, vesselFaceKey.read, sessionKey.read];
    if (new Set(keys).size !== keys.length) return refuse("keys-not-distinct");
    if (!keys.every((key) => standsApart(key, apart))) return refuse("key-held-apart");
    return checked(signature.read, sessionCertificateImage(scope.read, vesselFaceKey.read, sessionKey.read, profile), vesselFaceKey.read)
      ?? { read: Object.freeze({ scope: scope.read, vesselFaceKey: vesselFaceKey.read, sessionKey: sessionKey.read, profile, signature: signature.read }) };
  });
}

/**
 * Read one signature of a session key: the purpose must lie within the certificate's profile, and the
 * signature must cover exactly `payload` under that purpose. Hand it a certificate a reader already read.
 */
export function readSessionSignature(certificate: SessionCertificate, purpose: unknown, payload: unknown, signature: unknown): Read<SessionSigningPurpose> {
  return guarded(() => {
    if (!isSessionSigningPurpose(purpose) || !(payload instanceof Uint8Array)) return refuse("subject-malformed");
    const sig = readSignature(signature);
    if (refused(sig)) return sig;
    if (!profileSigns(certificate.profile, purpose)) return refuse("purpose-beyond-profile");
    return checked(sig.read, sessionSignatureImage(purpose, certificate.scope, certificate.sessionKey, payload), certificate.sessionKey)
      ?? { read: purpose };
  });
}

/** The profiles a certificate may name: the hands' own. */
export const SESSION_CERTIFICATE_PROFILES: readonly CapabilityProfile[] = CAPABILITY_PROFILES;
