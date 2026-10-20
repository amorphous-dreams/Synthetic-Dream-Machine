/**
 * fleet-join — the SUBJECTS of the fleet-join door: one face's fleet takes a new vessel of the same human.
 *
 * Three files cross by courier, in order, and each binds the one before it:
 *
 *   OFFER    the root holder names the face (its PersonaGroup and the root's public key), a fresh nonce, and
 *            every (face key, Nexus) scope the face stands at, none where it stands at no Nexus yet. It signs
 *            nothing: the answer carries the root's word. The joinee keeps the offer, so the root key it reads
 *            the answer under came by the courier BEFORE the answer did, never out of the answer itself.
 *   REQUEST  the joining vessel mints one face-scoped key per offered scope, signs a certificate request with
 *            each, and signs the whole under its own vessel key beside a fresh X25519 key the answer seals to.
 *   ANSWER   the root holder answers ONE request: the device edge it signed, one certificate per requested
 *            key under each face key, one face-key grant per scope under the PersonaGroup root, the face's
 *            address secret sealed to the request's X25519 key, and the hearth's carriage (gate pin and canon
 *            list) with its reach. It carries everything the joinee needs to DIAL its hearth: the hearth's
 *            charter, the face's own admit at the hearth's Nexus (the admit, its lineage and the salt that opens
 *            its carriage commitment over the answer's carriage), and the hearth's floor pin set. The
 *            PersonaGroup root signs the answer's image, so the pin, the canon list, the charter, the admit and
 *            the floor pins ride INSIDE signed bytes (by digest) and never beside them.
 *
 * The invariants:
 *   · A JOINED VESSEL RECEIVES NO ROOT BYTES AND NO PRIVATE FACE KEY. It mints its own face-scoped keys; the
 *     face's address secret alone crosses, sealed to a key the request named.
 *   · ONE NONCE BINDS THE THREE FILES, AT THE JOINING VESSEL. Its request answers the offer it kept, and it lands
 *     only the answer to the request it kept: a stale or a foreign file refuses there by name. The root keeps no
 *     ledger of the nonces it offered, so it may answer an old request again; that answer opens nothing without
 *     the joinee's own seal and vessel keys.
 *   · EVERY KEY AND SIGNATURE PASSES THE ONE DOOR (`ed25519-door`), and every certificate passes the face
 *     proof's own readers (`face-proof-subjects`).
 *   · A GRANT NAMES ONE FACE KEY FOR ONE PersonaGroup AT ONE NEXUS, under the PersonaGroup root: the private
 *     record a session's face reads (`session-face` `FaceGrantReading`).
 *
 * Pure: no custody, no I/O, no clock. The secret seal draws fresh randomness through `sealed-box`.
 * `composeFleetJoinRequest` builds the joinee's request over doors the vessel hands it (a key's mint and custody,
 * its vessel key's signature), so the node's door (`commands/fleet-join`) and the browser's
 * (`browser-fleet-join`) spell one request alike.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-chain · lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings
 * (the working address: the fleet-join door delivers the face address secret).
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { admitCarriageCommit, readAdmitCarriage, type AdmitCarriage, type CarriageEntry, type PresentedLineageAct } from "./carriage-registry.js";
import { admitGatePinDigest, readAdmitGatePinAt } from "./admit-gate-pin.js";
import { canonicalJson, canonicalJsonBytes, hex, hexToBytes, utf8Bytes, webGetRandomValues } from "./crypto.js";
import { gateBundleDigest, type GateBundlePin } from "./gate-bundle.js";
import { HEARTH_FLOOR_PIN_BOUND, readHearthFloorPins } from "./hearth-floor-pins.js";
import {
  FACE_KEY_GRANT_DOMAIN, FLEET_JOIN_ANSWER_DOMAIN, FLEET_JOIN_EDGE_DOMAIN, FLEET_JOIN_REQUEST_DOMAIN,
  FLEET_JOIN_SECRET_INFO,
} from "./domains.js";
import { acceptEd25519Key, readEd25519 } from "./ed25519-door.js";
import { requestCertificate, type VesselFaceKeyCustody } from "./face-authority.js";
import {
  own, readCertificate, readCertificateRequest, readFaceScope, sameFaceScope,
  type FaceProofRefusal, type FaceScope, type KeysHeldApart, type VesselFaceCertificate,
  type VesselFaceCertificateRequest, type VesselFaceKey,
} from "./face-proof-subjects.js";
import { openFromSender, sealToRecipient } from "./sealed-box.js";

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────

export const FLEET_JOIN_REFUSALS = [
  "offer-malformed",
  "request-malformed",
  "request-other-offer",       // the request names another nonce than the offer's
  "request-scope-unoffered",   // a certificate request names a scope the offer never named
  "request-scope-twice",       // two certificate requests name one scope
  "request-key-reused",        // a face-scoped key repeats, or equals the vessel key or an offered face key, or stands held apart
  "request-unsigned",          // the vessel key's signature over the request refuses
  "certificate-request-refused",
  "answer-malformed",
  "answer-pin-other-nexus",   // the carried pin stands at another Nexus than the island the answer names
  "answer-nexus-absent",       // the answer names no Nexus: its edge names no true name and its island is no charter
  "answer-admit-other-commit", // the face's admit does not commit to the answer's carriage under the salt it carries
  "answer-admit-other-face",   // the face's admit names another key than the face key certified at the hearth's Nexus
  "answer-floor-pin-refused",  // a floor pin refuses, stands at another tier or Nexus, or repeats a route
  "answer-other-request",      // the answer names another nonce, vessel key or PersonaGroup than the request
  "answer-unsigned",           // the PersonaGroup root's signature over the answer refuses
  "answer-root-reused",        // the root key equals the joinee's vessel key, one of its face-scoped keys, or a face key
  "certificate-refused",       // a certificate refuses, or certifies no key the request asked for
  "certificate-missing",       // a requested scope carries no certificate
  "grant-refused",             // a grant refuses under the root, or names a scope no certificate carries
  "grant-missing",             // a certified scope carries no grant
  "seal-secret-other",         // the seal secret the caller holds differs from the one behind the request's seal key
  "secret-unopened",           // the sealed address secret opens to nothing under the request's key
] as const;
export type FleetJoinRefusalName = (typeof FLEET_JOIN_REFUSALS)[number];
export interface FleetJoinRefusal { readonly refusal: FleetJoinRefusalName; readonly cause?: FaceProofRefusal }

const refuse = (refusal: FleetJoinRefusalName, cause?: FaceProofRefusal): FleetJoinRefusal =>
  Object.freeze(cause === undefined ? { refusal } : { refusal, cause });

// ── Shapes ──────────────────────────────────────────────────────────────────────────────────────

/** How many (face key, Nexus) scopes one offer may name. A face standing at more joins in more than one act. */
export const FLEET_JOIN_SCOPE_BOUND = 64;
/** How many bytes of canonical JSON a carried device edge may hold. */
export const FLEET_JOIN_EDGE_BOUND = 65536;
/** How many bytes the carried charter's text may hold. */
export const FLEET_JOIN_CHARTER_BOUND = 1 << 20;
/** How many bytes of canonical JSON the carried admit and its lineage may hold. */
export const FLEET_JOIN_ADMIT_BOUND = 1 << 20;
/** How many floor pins one answer may carry. */
export const FLEET_JOIN_FLOOR_PIN_BOUND = HEARTH_FLOOR_PIN_BOUND;

export interface FleetJoinOffer {
  readonly kind:         "fleet-join-offer";
  /** The face's PersonaGroup id: lower-case hex, with the `0x` the group's own id carries where it carries one. */
  readonly personaGroup: string;
  /** The PersonaGroup root's Ed25519 verifying key: the key the answer verifies under. */
  readonly rootKey:      string;
  /** 32 fresh bytes, 64 lower-case hex: binds the request and the answer to this offer. */
  readonly nonce:        string;
  /** Every scope the face stands at, sorted by Nexus then face key; none where it stands at no Nexus yet. */
  readonly scopes:       readonly FaceScope[];
}

export interface FleetJoinRequest {
  readonly kind:      "fleet-join-request";
  readonly nonce:     string;
  /** The joining vessel's own Ed25519 verifying key: the delegate the device edge names. */
  readonly atomKey: string;
  /** A fresh X25519 public key, 64 hex: the answer seals the address secret to it. */
  readonly sealKey:   string;
  /** One certificate request per offered scope the joinee takes, each signed by its own face-scoped key. */
  readonly requests:  readonly VesselFaceCertificateRequest[];
  /** The vessel key's signature over `fleetJoinRequestImage`. */
  readonly signature: string;
}

/** The PersonaGroup's private, root-signed record that one face key speaks for it at one Nexus. */
export interface FaceKeyGrant {
  readonly personaGroup: string;
  readonly scope:        FaceScope;
  /** The PersonaGroup root's signature over `faceKeyGrantImage`. */
  readonly signature:    string;
}

/** The address secret's seal: three hex fields of one `sealed-box`. */
export interface SealedAddressSecret {
  readonly epk:        string;
  readonly nonce:      string;
  readonly ciphertext: string;
}

/** Where the joinee dials its hearth, beside the signed carriage. Each field may stand null. */
export interface FleetJoinReach {
  readonly syncUrl:     string | null;
  readonly islandKind:  string | null;
  readonly islandScope: string | null;
}

/** The face's own admit at the hearth's Nexus, as a joinee keeps it: its opening is `{ carriage, salt }`. */
export interface FleetJoinFaceAdmit {
  readonly admit:   CarriageEntry;
  readonly lineage: readonly PresentedLineageAct[];
  /** The salt that opens the admit's carriage commitment over the answer's own carriage. */
  readonly salt:    string;
}

export interface FleetJoinAnswer {
  readonly kind:         "fleet-join-answer";
  readonly nonce:        string;
  readonly atomKey:    string;
  readonly personaGroup: string;
  /** The device edge the PersonaGroup root signed, carried whole; the answer's image binds its digest. */
  readonly edge:         unknown;
  /** The hearth's gate pin and canon list. */
  readonly carriage:     AdmitCarriage;
  readonly reach:        FleetJoinReach;
  /** The hearth's charter, as its seal file's text: the joinee reads its admit at the root this charter seats. */
  readonly charter:      string;
  /** The face's own admit at the hearth's Nexus. */
  readonly admit:        FleetJoinFaceAdmit;
  /** The hearth's floor pins at its Nexus, one per floor route: the oracle's pins, held before any crossing. */
  readonly floorPins:    readonly GateBundlePin[];
  readonly certificates: readonly VesselFaceCertificate[];
  readonly grants:       readonly FaceKeyGrant[];
  readonly secret:       SealedAddressSecret;
  /** The PersonaGroup root's signature over `fleetJoinAnswerImage`. */
  readonly signature:    string;
}

/** What a verified answer hands its joinee: every field read, and the address secret opened. */
export interface VerifiedFleetJoin {
  readonly answer:        FleetJoinAnswer;
  /** The face's address secret, 32 bytes, the caller's to seal into its custody row and zero-fill. */
  readonly addressSecret: Uint8Array;
}

// ── Readers' helpers ────────────────────────────────────────────────────────────────────────────

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const HEX = /^(?:[0-9a-f]{2})+$/;
const PERSONA_GROUP = /^(?:0x)?(?:[0-9a-f]{2}){4,64}$/;
const REACH_TEXT = /^[\x21-\x7e]{1,2048}$/;

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const exactly = (v: Record<string, unknown>, keys: readonly string[]): boolean =>
  Reflect.ownKeys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const isKey = (v: unknown): v is string => typeof v === "string" && HEX64.test(v) && acceptEd25519Key(v).ok;
const compareScope = (a: FaceScope, b: FaceScope): number =>
  a.nexus < b.nexus ? -1 : a.nexus > b.nexus ? 1 : a.faceKey < b.faceKey ? -1 : a.faceKey > b.faceKey ? 1 : 0;
const scopeName = (s: FaceScope): string => `${s.nexus}\n${s.faceKey}`;

/** Run a reader; a thrown accessor or a hostile proxy reads as the named malformation. */
function guarded<T>(malformed: FleetJoinRefusalName, read: () => T | FleetJoinRefusal): T | FleetJoinRefusal {
  try { return read(); } catch { return refuse(malformed); }
}
const isRefusal = (v: unknown): v is FleetJoinRefusal => record(v) && Object.hasOwn(v, "refusal");

/** An X25519 public key a seal can reach: 64 hex, and no low-order point (whose shared secret reads all zero). */
const SEAL_PROBE = new Uint8Array(32).fill(0x5a);
function isSealKey(v: unknown): v is string {
  if (typeof v !== "string" || !HEX64.test(v)) return false;
  try { x25519.getSharedSecret(SEAL_PROBE, hexToBytes(v)); return true; } catch { return false; }
}

/** A deep-frozen copy of a value through canonical JSON, or undefined past the bound: the bytes digested match the
 *  bytes handed on, whatever accessor or `toJSON` the carried value wore. */
function snapshot(v: unknown, bound: number): unknown {
  const text = canonicalJson(v);
  if (utf8Bytes(text).length > bound) return undefined;
  const freeze = (x: unknown): unknown => {
    if (typeof x === "object" && x !== null) { for (const k of Object.keys(x)) freeze((x as Record<string, unknown>)[k]); Object.freeze(x); }
    return x;
  };
  return freeze(JSON.parse(text));
}

// ── Images ──────────────────────────────────────────────────────────────────────────────────────

const signed = (domain: string, body: Record<string, unknown>): Uint8Array => canonicalJsonBytes({ domain, ...body });

/** The digest an answer's image binds the device edge by: canonical JSON under its own name. */
export function fleetJoinEdgeDigest(edge: unknown): string {
  return hex(sha256(signed(FLEET_JOIN_EDGE_DOMAIN, { edge })));
}

/** The bytes the joining vessel's own key signs over its request. */
export function fleetJoinRequestImage(r: Omit<FleetJoinRequest, "kind" | "signature">): Uint8Array {
  return signed(FLEET_JOIN_REQUEST_DOMAIN, {
    nonce: r.nonce, atomKey: r.atomKey, sealKey: r.sealKey,
    requests: r.requests.map((q) => ({ faceKey: q.scope.faceKey, nexus: q.scope.nexus, vesselFaceKey: q.vesselFaceKey, signature: q.signature })),
  });
}

/** The bytes the PersonaGroup root signs over one face key at one Nexus. */
export function faceKeyGrantImage(personaGroup: string, scope: FaceScope): Uint8Array {
  return signed(FACE_KEY_GRANT_DOMAIN, { personaGroup, faceKey: scope.faceKey, nexus: scope.nexus });
}

/** The bytes the PersonaGroup root signs over an answer: every field but the certificates and grants, which
 *  carry their own signatures, and the edge, which rides by digest. */
export function fleetJoinAnswerImage(a: Omit<FleetJoinAnswer, "kind" | "signature" | "certificates" | "grants">): Uint8Array {
  return signed(FLEET_JOIN_ANSWER_DOMAIN, {
    nonce: a.nonce, atomKey: a.atomKey, personaGroup: a.personaGroup, edge: fleetJoinEdgeDigest(a.edge),
    gatePin: admitGatePinDigest(a.carriage.gatePin), canon: a.carriage.canon,
    syncUrl: a.reach.syncUrl, islandKind: a.reach.islandKind, islandScope: a.reach.islandScope,
    secret: { epk: a.secret.epk, nonce: a.secret.nonce, ciphertext: a.secret.ciphertext },
    charter: hex(sha256(utf8Bytes(a.charter))),
    admit: hex(sha256(canonicalJsonBytes({ admit: a.admit.admit, lineage: a.admit.lineage, salt: a.admit.salt }))),
    floorPins: a.floorPins.map(gateBundleDigest),
  });
}

/** The revision a grant reads at: the digest of its signed image. */
export function faceKeyGrantRevision(grant: FaceKeyGrant): string {
  return hex(sha256(faceKeyGrantImage(grant.personaGroup, grant.scope)));
}

// ── The address secret's seal ───────────────────────────────────────────────────────────────────

const secretSalt = (nonce: string, atomKey: string): Uint8Array[] => [hexToBytes(nonce), hexToBytes(atomKey)];

/** Seal the face's address secret to the request's X25519 key, bound to the nonce and the joining vessel. */
export function sealAddressSecret(args: { secret: Uint8Array; request: Pick<FleetJoinRequest, "nonce" | "atomKey" | "sealKey"> }): SealedAddressSecret {
  if (!(args.secret instanceof Uint8Array) || args.secret.length !== 32) throw new RangeError("fleet-join: an address secret holds exactly 32 bytes");
  const box = sealToRecipient({
    recipientPub: hexToBytes(args.request.sealKey), plaintext: args.secret, info: utf8Bytes(FLEET_JOIN_SECRET_INFO),
    extraSalt: secretSalt(args.request.nonce, args.request.atomKey),
  });
  return { epk: hex(box.senderEphemeralPub), nonce: hex(box.aeadNonce), ciphertext: hex(box.ciphertext) };
}

function openAddressSecret(sealed: SealedAddressSecret, sealSecret: Uint8Array, nonce: string, atomKey: string): Uint8Array | null {
  const opened = openFromSender({
    recipientSecret: sealSecret, senderEphemeralPub: hexToBytes(sealed.epk), aeadNonce: hexToBytes(sealed.nonce),
    ciphertext: hexToBytes(sealed.ciphertext), info: utf8Bytes(FLEET_JOIN_SECRET_INFO), extraSalt: secretSalt(nonce, atomKey),
  });
  return opened !== null && opened.length === 32 ? opened : null;
}

// ── The offer ───────────────────────────────────────────────────────────────────────────────────

/** Read an offer at its exact shape; its scopes read sorted and distinct, one face key each, none the root's. */
export function readFleetJoinOffer(value: unknown): FleetJoinOffer | FleetJoinRefusal {
  return guarded("offer-malformed", () => {
    if (!record(value) || !exactly(value, ["kind", "personaGroup", "rootKey", "nonce", "scopes"])) return refuse("offer-malformed");
    const { kind, personaGroup, rootKey, nonce, scopes } = value;
    if (kind !== "fleet-join-offer" || typeof personaGroup !== "string" || !PERSONA_GROUP.test(personaGroup) || !isKey(rootKey)) return refuse("offer-malformed");
    if (typeof nonce !== "string" || !HEX64.test(nonce) || !Array.isArray(scopes) || scopes.length > FLEET_JOIN_SCOPE_BOUND) return refuse("offer-malformed");
    const read: FaceScope[] = [];
    for (const s of scopes) {
      const scope = readFaceScope(s);
      if (!own(scope, "read")) return refuse("offer-malformed", scope);
      read.push(scope.read);
    }
    for (let i = 1; i < read.length; i++) if (compareScope(read[i - 1]!, read[i]!) >= 0) return refuse("offer-malformed");
    // One face key per Nexus: the per-Nexus nym never speaks at two.
    const faceKeys = new Set<string>(read.map((s) => s.faceKey));
    if (faceKeys.size !== read.length || faceKeys.has(rootKey)) return refuse("offer-malformed");
    return Object.freeze({ kind, personaGroup, rootKey, nonce, scopes: Object.freeze(read) });
  });
}

/** Build an offer: the scopes sorted and deduplicated. */
export function fleetJoinOffer(args: { personaGroup: string; rootKey: string; nonce: string; scopes: readonly FaceScope[] }): FleetJoinOffer {
  const seen = new Map<string, FaceScope>();
  for (const s of args.scopes) seen.set(scopeName(s), { faceKey: s.faceKey, nexus: s.nexus });
  const offer = readFleetJoinOffer({ kind: "fleet-join-offer", personaGroup: args.personaGroup, rootKey: args.rootKey, nonce: args.nonce, scopes: [...seen.values()].sort(compareScope) });
  if (isRefusal(offer)) throw new RangeError(`fleet-join: the offer refuses (${offer.refusal}${offer.cause ? `: ${offer.cause.refusal}` : ""})`);
  return offer;
}

// ── The request ─────────────────────────────────────────────────────────────────────────────────

/**
 * Read a request against the offer it answers. `apart` names the keys the reader holds for anything else; a
 * face-scoped key that repeats, equals the vessel key, the root key or an offered face key, or stands apart
 * refuses. A request takes any of the offered scopes, none included: a face standing at no Nexus yet still
 * joins the vessel, and its address secret still crosses. Each nonce answers ONE request: the root holder keeps that ledger, not this reader.
 */
export function readFleetJoinRequest(value: unknown, offer: FleetJoinOffer, apart: KeysHeldApart = []): FleetJoinRequest | FleetJoinRefusal {
  return guarded("request-malformed", () => {
    if (!record(value) || !exactly(value, ["kind", "nonce", "atomKey", "sealKey", "requests", "signature"])) return refuse("request-malformed");
    const { kind, nonce, atomKey, sealKey, requests, signature } = value;
    if (kind !== "fleet-join-request" || typeof nonce !== "string" || !HEX64.test(nonce)) return refuse("request-malformed");
    if (!isKey(atomKey) || !isSealKey(sealKey)) return refuse("request-malformed");
    if (!Array.isArray(requests) || requests.length > FLEET_JOIN_SCOPE_BOUND || typeof signature !== "string" || !HEX128.test(signature)) return refuse("request-malformed");
    if (nonce !== offer.nonce) return refuse("request-other-offer");
    const offered = new Set(offer.scopes.map(scopeName));
    const scopes = new Set<string>();
    const faceKeys = new Set<string>([...offer.scopes.map((s) => s.faceKey), offer.rootKey]);
    if (faceKeys.has(atomKey)) return refuse("request-key-reused");
    const keys = new Set<string>([atomKey]);
    const read: VesselFaceCertificateRequest[] = [];
    for (const q of requests) {
      const reading = readCertificateRequest(q, apart);
      if (!own(reading, "read")) return refuse(reading.refusal === "key-held-apart" ? "request-key-reused" : "certificate-request-refused", reading);
      const name = scopeName(reading.read.scope);
      if (!offered.has(name)) return refuse("request-scope-unoffered");
      if (scopes.has(name)) return refuse("request-scope-twice");
      if (keys.has(reading.read.vesselFaceKey) || faceKeys.has(reading.read.vesselFaceKey)) return refuse("request-key-reused");
      scopes.add(name);
      keys.add(reading.read.vesselFaceKey);
      read.push(reading.read);
    }
    if (apart.includes(atomKey)) return refuse("request-key-reused");
    const body = { nonce, atomKey, sealKey, requests: read };
    if (!readEd25519(signature, fleetJoinRequestImage(body), atomKey).ok) return refuse("request-unsigned");
    return Object.freeze({ kind, ...body, requests: Object.freeze(read), signature });
  });
}

// ── The answer ──────────────────────────────────────────────────────────────────────────────────

function readGrant(value: unknown, personaGroup: string, rootKey: string): FaceKeyGrant | null {
  if (!record(value) || !exactly(value, ["personaGroup", "scope", "signature"])) return null;
  const scope = readFaceScope(value["scope"]);
  const { signature } = value;
  if (!own(scope, "read") || value["personaGroup"] !== personaGroup || typeof signature !== "string" || !HEX128.test(signature)) return null;
  if (!readEd25519(signature, faceKeyGrantImage(personaGroup, scope.read), rootKey).ok) return null;
  return Object.freeze({ personaGroup, scope: scope.read, signature });
}

/** Read one grant alone, under the PersonaGroup root that signed it. */
export function readFaceKeyGrant(value: unknown, rootKey: string): FaceKeyGrant | null {
  try {
    if (!record(value) || typeof value["personaGroup"] !== "string" || !PERSONA_GROUP.test(value["personaGroup"])) return null;
    return isKey(rootKey) ? readGrant(value, value["personaGroup"], rootKey) : null;
  } catch { return null; }
}

function readReach(value: unknown): FleetJoinReach | null {
  if (!record(value) || !exactly(value, ["syncUrl", "islandKind", "islandScope"])) return null;
  const field = (v: unknown): string | null | undefined => (v === null ? null : typeof v === "string" && REACH_TEXT.test(v) ? v : undefined);
  const [syncUrl, islandKind, islandScope] = [field(value["syncUrl"]), field(value["islandKind"]), field(value["islandScope"])];
  if (syncUrl === undefined || islandKind === undefined || islandScope === undefined) return null;
  return Object.freeze({ syncUrl, islandKind, islandScope });
}

function readFaceAdmit(value: unknown): FleetJoinFaceAdmit | null {
  if (!record(value) || !exactly(value, ["admit", "lineage", "salt"])) return null;
  const { salt } = value;
  if (typeof salt !== "string" || !HEX64.test(salt)) return null;
  const copy = snapshot({ admit: value["admit"], lineage: value["lineage"] }, FLEET_JOIN_ADMIT_BOUND) as { admit: unknown; lineage: unknown } | undefined;
  if (copy === undefined || !record(copy.admit) || !Array.isArray(copy.lineage)) return null;
  const admit = copy.admit;
  if (typeof admit["nym"] !== "string" || typeof admit["carriageCommit"] !== "string") return null;
  return Object.freeze({ admit: admit as unknown as CarriageEntry, lineage: copy.lineage as PresentedLineageAct[], salt });
}

/**
 * Read an answer against the request this vessel sent, under the PersonaGroup root key, and open its address
 * secret with the request's X25519 secret. Every requested scope must carry exactly one certificate over the key
 * requested for it, and every certified scope one grant under the root.
 *
 * `rootKey` and `personaGroup` MUST come from outside the answer: the offer the joinee kept, or the operator's own
 * word. The answer authenticates under the key that reads it, and binds nothing to it.
 * The root key, the vessel key and every face-scoped and face key stand apart from one another here whatever
 * `apart` names.
 */
export function readFleetJoinAnswer(value: unknown, args: {
  request: FleetJoinRequest; personaGroup: string; rootKey: string; sealSecret: Uint8Array; apart?: KeysHeldApart;
}): VerifiedFleetJoin | FleetJoinRefusal {
  return guarded("answer-malformed", () => {
    const keys = ["kind", "nonce", "atomKey", "personaGroup", "edge", "carriage", "reach", "charter", "admit", "floorPins", "certificates", "grants", "secret", "signature"];
    if (!record(value) || !exactly(value, keys) || value["kind"] !== "fleet-join-answer") return refuse("answer-malformed");
    if (!isKey(args.rootKey)) return refuse("answer-unsigned");
    const { nonce, atomKey, personaGroup, signature } = value;
    const edge = value["edge"] === undefined ? undefined : snapshot(value["edge"], FLEET_JOIN_EDGE_BOUND);
    const carriage = readAdmitCarriage(value["carriage"]);
    const reach = readReach(value["reach"]);
    const secret = value["secret"];
    // THE PIN STANDS AT THE HEARTH'S NEXUS: the true name its device edge names (the Nexus its sync gate stands at), and
    // a `charter` island's genesis where the edge names none. An anchor's gate key or an explicit scope never decides it.
    const edgeNexus = record(edge) && typeof edge["hearthTrueName"] === "string" && edge["hearthTrueName"].length > 0 ? edge["hearthTrueName"] : null;
    const pinNexus = edgeNexus ?? (reach !== null && reach.islandKind === "charter" ? reach.islandScope : null);
    if (carriage !== null && pinNexus !== null && !("pin" in readAdmitGatePinAt(carriage.gatePin, pinNexus))) {
      return refuse("answer-pin-other-nexus");
    }
    if (carriage === null || reach === null || typeof signature !== "string" || !HEX128.test(signature) || edge === undefined) return refuse("answer-malformed");
    // AN ANSWER NAMES ITS NEXUS: every Nexus-bound check below (the floor pins, the admit's face) reads at it, so an answer
    // naming none refuses here rather than skip them.
    if (pinNexus === null) return refuse("answer-nexus-absent");
    const charter = value["charter"];
    if (typeof charter !== "string" || charter.length === 0 || utf8Bytes(charter).length > FLEET_JOIN_CHARTER_BOUND) return refuse("answer-malformed");
    const faceAdmit = readFaceAdmit(value["admit"]);
    if (faceAdmit === null) return refuse("answer-malformed");
    // THE ADMIT OPENS OVER THE ANSWER'S OWN CARRIAGE: the pin the joinee dials is the pin the quorum committed to.
    if (admitCarriageCommit({ carriage, salt: faceAdmit.salt }) !== faceAdmit.admit.carriageCommit) return refuse("answer-admit-other-commit");
    const floorPins = readHearthFloorPins(value["floorPins"], hex(utf8Bytes(pinNexus)));
    if (floorPins === null) return refuse("answer-floor-pin-refused");
    if (!record(secret) || !exactly(secret, ["epk", "nonce", "ciphertext"])
      || typeof secret["epk"] !== "string" || !HEX64.test(secret["epk"])
      || typeof secret["nonce"] !== "string" || !/^[0-9a-f]{48}$/.test(secret["nonce"])
      || typeof secret["ciphertext"] !== "string" || !HEX.test(secret["ciphertext"])) return refuse("answer-malformed");
    if (!Array.isArray(value["certificates"]) || !Array.isArray(value["grants"])) return refuse("answer-malformed");
    if (nonce !== args.request.nonce || atomKey !== args.request.atomKey || personaGroup !== args.personaGroup) return refuse("answer-other-request");
    const joineeKeys = [args.request.atomKey, ...args.request.requests.flatMap((q) => [q.vesselFaceKey, q.scope.faceKey])];
    if (joineeKeys.includes(args.rootKey)) return refuse("answer-root-reused");
    let sealMatches = false;
    try { sealMatches = hex(x25519.getPublicKey(args.sealSecret)) === args.request.sealKey; } catch { sealMatches = false; }
    if (!sealMatches) return refuse("seal-secret-other");

    const sealed: SealedAddressSecret = { epk: secret["epk"], nonce: secret["nonce"], ciphertext: secret["ciphertext"] };
    const body = { nonce, atomKey, personaGroup, edge, carriage, reach, charter, admit: faceAdmit, floorPins, secret: sealed } as Omit<FleetJoinAnswer, "kind" | "signature" | "certificates" | "grants">;
    if (!readEd25519(signature, fleetJoinAnswerImage(body), args.rootKey).ok) return refuse("answer-unsigned");

    const apart = [...(args.apart ?? []), args.rootKey, args.request.atomKey];
    const asked = new Map(args.request.requests.map((q) => [scopeName(q.scope), q.vesselFaceKey]));
    const certificates: VesselFaceCertificate[] = [];
    const certified = new Set<string>();
    for (const c of value["certificates"]) {
      const reading = readCertificate(c, apart);
      if (!own(reading, "read")) return refuse("certificate-refused", reading);
      const name = scopeName(reading.read.scope);
      if (asked.get(name) !== reading.read.vesselFaceKey || certified.has(name)) return refuse("certificate-refused");
      certified.add(name);
      certificates.push(reading.read);
    }
    if (certified.size !== asked.size) return refuse("certificate-missing");
    const grants: FaceKeyGrant[] = [];
    const granted = new Set<string>();
    for (const g of value["grants"]) {
      const grant = readGrant(g, personaGroup, args.rootKey);
      if (grant === null) return refuse("grant-refused");
      const name = scopeName(grant.scope);
      if (!certified.has(name) || granted.has(name)) return refuse("grant-refused");
      granted.add(name);
      grants.push(grant);
    }
    if (granted.size !== certified.size) return refuse("grant-missing");
    for (const c of certificates) if (!grants.some((g) => sameFaceScope(g.scope, c.scope))) return refuse("grant-missing");
    // THE ADMIT IS THE FACE'S OWN at the hearth's Nexus: its nym is the face key a certificate here certifies there.
    if (!certificates.some((c) => c.scope.nexus === pinNexus && c.scope.faceKey === faceAdmit.admit.nym.toLowerCase())) {
      return refuse("answer-admit-other-face");
    }

    const addressSecret = openAddressSecret(sealed, args.sealSecret, nonce, atomKey);
    if (addressSecret === null) return refuse("secret-unopened");
    const answer: FleetJoinAnswer = Object.freeze({
      kind: "fleet-join-answer", ...body, certificates: Object.freeze(certificates), grants: Object.freeze(grants), signature,
    });
    return { answer, addressSecret };
  });
}

// ── The joinee's request, composed ──────────────────────────────────────────────────────────────

/** A fresh X25519 key pair for the answer's seal: the 32-byte secret and the public key's hex. The caller keeps
 *  the secret beside its pending join and zero-fills its own copy. */
export function fleetJoinSealPair(): { readonly secret: Uint8Array; readonly key: string } {
  const secret = webGetRandomValues(new Uint8Array(32));
  return { secret, key: hex(x25519.getPublicKey(secret)) };
}

/**
 * The joining vessel's request over an offer it read, composed over the vessel's own doors.
 *
 * `mintFaceKey` mints one face-scoped key for a scope INTO the vessel's custody and answers its public half;
 * `custody` signs each certificate request under that key; `sign` signs the request's image under the vessel key.
 * The request reads back through `readFleetJoinRequest` before it answers, so a door that signed under another
 * key refuses here by name and never leaves the vessel.
 */
export async function composeFleetJoinRequest(args: {
  offer: FleetJoinOffer; atomKey: string; sealKey: string;
  mintFaceKey: (scope: FaceScope) => Promise<string>;
  custody: VesselFaceKeyCustody;
  sign: (image: Uint8Array) => Promise<string>;
}): Promise<FleetJoinRequest | FleetJoinRefusal> {
  const atomKey = args.atomKey.toLowerCase();
  const apart = [atomKey, args.offer.rootKey];
  const requests: VesselFaceCertificateRequest[] = [];
  for (const scope of args.offer.scopes) {
    const vesselFaceKey = (await args.mintFaceKey(scope)).toLowerCase() as VesselFaceKey;
    const asked = await requestCertificate({ scope, vesselFaceKey, apart, custody: args.custody });
    if (!("request" in asked)) return refuse("certificate-request-refused", asked.cause);
    requests.push(asked.request);
  }
  const body = { nonce: args.offer.nonce, atomKey, sealKey: args.sealKey, requests };
  const signature = await args.sign(fleetJoinRequestImage(body));
  return readFleetJoinRequest({ kind: "fleet-join-request", ...body, signature }, args.offer, [args.offer.rootKey]);
}
