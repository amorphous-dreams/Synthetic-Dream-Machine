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
import { vesselFaceTagHolds, type VesselFaceTagDoor } from "./vessel-face-tag.js";
import { wardKeyPopHolds } from "./ward-answer.js";

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────

export const FLEET_JOIN_REFUSALS = [
  "offer-malformed",
  "request-malformed",
  "request-other-offer",       // the request names another nonce than the offer's
  "request-scope-unoffered",   // a certificate request names a scope the offer never named
  "request-scope-twice",       // two certificate requests name one scope
  "request-key-reused",        // a face-scoped key repeats, or equals the vessel key or an offered face key, or stands held apart
  "request-unsigned",          // the vessel key's signature over the request refuses
  "request-vessel-tag-absent", // the request carries no blinded vessel tag for this face
  "request-ward-key-absent", // the request names no per-face ward key for its device
  "request-ward-key-unproven", // the request's ward key signs no proof over (group, atom, ward key): the device does not hold the key it names
  "request-vessel-tag-invalid", // the tag's signature covers another face, atom or ward key, or reads malformed
  "certificate-request-refused",
  "answer-malformed",
  "answer-pin-other-nexus",   // the carried pin stands at another Nexus than the island the answer names
  "answer-nexus-absent",       // the answer names no Nexus: its edge names no true name and its island is no charter
  "answer-hearth-partial",     // the answer carries part of a hearth's dial: its carriage, charter and admit stand together or not at all
  "answer-hearthless-names-nexus", // an answer carrying no hearth's dial names a hearth true name, an island or a floor pin
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
  "request-scope-household-absent", // the request asks no certificate at the hearth's Nexus for the face's admitted key
  "no-address-secret",         // the face holds no address secret for the answer to seal
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
  /** The joining vessel's blinded tag for this face, and the tag key's signature over (group, atom, ward key): what the hearth's
   *  admission act carries, so one vessel never takes two seats in one face. */
  readonly vesselTag: string;
  readonly vesselSig: string;
  /** The joining device's per-face ward key: the key its ward unlock for this face signs a co-sign answer with. */
  readonly wardKey: string;
  /** That ward key's own signature over (group, atom, ward key) under `ward-key-pop`: the device holds the key it names. */
  readonly wardPop: string;
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
  /** The hearth's gate pin and canon list; null where the root holder stands no gate (`FleetJoinHearthDial`). */
  readonly carriage:     AdmitCarriage | null;
  readonly reach:        FleetJoinReach;
  /** The hearth's charter, as its seal file's text: the joinee reads its admit at the root this charter seats. Null with the carriage. */
  readonly charter:      string | null;
  /** The face's own admit at the hearth's Nexus. Null with the carriage. */
  readonly admit:        FleetJoinFaceAdmit | null;
  /** The hearth's floor pins at its Nexus, one per floor route: the oracle's pins, held before any crossing. None with no carriage. */
  readonly floorPins:    readonly GateBundlePin[];
  readonly certificates: readonly VesselFaceCertificate[];
  readonly grants:       readonly FaceKeyGrant[];
  readonly secret:       SealedAddressSecret;
  /** The PersonaGroup root's signature over `fleetJoinAnswerImage`. */
  readonly signature:    string;
}

/**
 * THE HEARTH'S DIAL an answer carries: the gate pin and canon list, the charter, the face's admit there and the floor
 * pins. ONE CAPABILITY DECIDES IT: a root holder that stands an inbound gate carries its dial whole; a root holder that
 * stands none (a browser, a phone: a leaf) carries none, and its answer names no hearth true name, no island and no
 * floor pin. The four fields stand together or not at all, inside the root's signature either way.
 */
export interface FleetJoinHearthDial {
  readonly carriage:  AdmitCarriage;
  readonly charter:   string;
  readonly admit:     FleetJoinFaceAdmit;
  readonly floorPins: readonly GateBundlePin[];
}

/** The hearth's dial a read answer carries, or null where its root holder stood no gate. */
export function fleetJoinHearthOf(answer: Pick<FleetJoinAnswer, "carriage" | "charter" | "admit" | "floorPins">): FleetJoinHearthDial | null {
  if (answer.carriage === null || answer.charter === null || answer.admit === null) return null;
  return { carriage: answer.carriage, charter: answer.charter, admit: answer.admit, floorPins: answer.floorPins };
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
    nonce: r.nonce, atomKey: r.atomKey, sealKey: r.sealKey, vesselTag: r.vesselTag, vesselSig: r.vesselSig, wardKey: r.wardKey, wardPop: r.wardPop,
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
    gatePin: a.carriage === null ? null : admitGatePinDigest(a.carriage.gatePin), canon: a.carriage === null ? null : a.carriage.canon,
    syncUrl: a.reach.syncUrl, islandKind: a.reach.islandKind, islandScope: a.reach.islandScope,
    secret: { epk: a.secret.epk, nonce: a.secret.nonce, ciphertext: a.secret.ciphertext },
    charter: a.charter === null ? null : hex(sha256(utf8Bytes(a.charter))),
    admit: a.admit === null ? null : hex(sha256(canonicalJsonBytes({ admit: a.admit.admit, lineage: a.admit.lineage, salt: a.admit.salt }))),
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
    const base = ["kind", "nonce", "atomKey", "sealKey", "requests", "signature"];
    if (!record(value)) return refuse("request-malformed");
    // A request standing at its exact shape short of a tag field or its ward key names that field absent; any other shape reads malformed.
    const keysOf = Object.keys(value), tagFields = ["vesselTag", "vesselSig", "wardKey", "wardPop"];
    if (!base.every((k) => keysOf.includes(k)) || keysOf.some((k) => !base.includes(k) && !tagFields.includes(k))) return refuse("request-malformed");
    const tagged = keysOf.includes("vesselTag") && keysOf.includes("vesselSig");
    const { kind, nonce, atomKey, sealKey, requests, signature, vesselTag, vesselSig, wardKey, wardPop } = value;
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
    // THE SIGNATURE READS FIRST: the atom's signature judges the bytes as they arrive (an absent tag field drops out of the
    // image, as it does from the signer's), so bytes no vessel signed refuse request-unsigned before any tag or ward key
    // reads against this face, and a forger learns nothing of the face's checks.
    const body = { nonce, atomKey, sealKey, vesselTag: vesselTag as string, vesselSig: vesselSig as string, wardKey: wardKey as string, wardPop: wardPop as string, requests: read };
    if (!readEd25519(signature, fleetJoinRequestImage(body), atomKey).ok) return refuse("request-unsigned");
    if (!tagged) return refuse("request-vessel-tag-absent");
    if (wardKey === undefined) return refuse("request-ward-key-absent");
    if (!vesselFaceTagHolds(offer.personaGroup, atomKey, { vesselTag, vesselSig, wardKey })) return refuse("request-vessel-tag-invalid");
    if (!wardKeyPopHolds(offer.personaGroup, atomKey, { wardKey, wardPop })) return refuse("request-ward-key-unproven");
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
  const signed = readAnswerSigned(value, args);
  if (isRefusal(signed)) return signed;
  const addressSecret = openAddressSecret(signed.secret, args.sealSecret, signed.nonce, signed.atomKey);
  if (addressSecret === null) return refuse("secret-unopened");
  return { answer: signed, addressSecret };
}

/** Read an answer's every signed field against its request under the root key. With a seal secret it must stand behind
 *  the request's seal key; with none (the root holder reading back what it composed) the seal stays shut. */
function readAnswerSigned(value: unknown, args: {
  request: FleetJoinRequest; personaGroup: string; rootKey: string; sealSecret: Uint8Array | null; apart?: KeysHeldApart;
}): FleetJoinAnswer | FleetJoinRefusal {
  return guarded("answer-malformed", () => {
    const keys = ["kind", "nonce", "atomKey", "personaGroup", "edge", "carriage", "reach", "charter", "admit", "floorPins", "certificates", "grants", "secret", "signature"];
    if (!record(value) || !exactly(value, keys) || value["kind"] !== "fleet-join-answer") return refuse("answer-malformed");
    if (!isKey(args.rootKey)) return refuse("answer-unsigned");
    const { nonce, atomKey, personaGroup, signature } = value;
    // THE HEARTH'S DIAL STANDS WHOLE OR NOT AT ALL (`FleetJoinHearthDial`): a null carriage, charter and admit name a root
    // holder with no gate; one of them null beside another standing refuses by name.
    const nulls = [value["carriage"], value["charter"], value["admit"]].filter((v) => v === null).length;
    if (nulls !== 0 && nulls !== 3) return refuse("answer-hearth-partial");
    const hearthless = nulls === 3;
    const edge = value["edge"] === undefined ? undefined : snapshot(value["edge"], FLEET_JOIN_EDGE_BOUND);
    const carriage = hearthless ? null : readAdmitCarriage(value["carriage"]);
    const reach = readReach(value["reach"]);
    const secret = value["secret"];
    // THE PIN STANDS AT THE HEARTH'S NEXUS: the true name its device edge names (the Nexus its sync gate stands at), and
    // a `charter` island's genesis where the edge names none. An anchor's gate key or an explicit scope never decides it.
    const edgeNexus = record(edge) && typeof edge["hearthTrueName"] === "string" && edge["hearthTrueName"].length > 0 ? edge["hearthTrueName"] : null;
    const pinNexus = edgeNexus ?? (reach !== null && reach.islandKind === "charter" ? reach.islandScope : null);
    if (carriage !== null && pinNexus !== null && !("pin" in readAdmitGatePinAt(carriage.gatePin, pinNexus))) {
      return refuse("answer-pin-other-nexus");
    }
    if ((!hearthless && carriage === null) || reach === null || typeof signature !== "string" || !HEX128.test(signature) || edge === undefined) return refuse("answer-malformed");
    let faceAdmit: FleetJoinFaceAdmit | null = null;
    let floorPins: readonly GateBundlePin[] = Object.freeze([]);
    let charter: string | null = null;
    if (carriage === null) {
      // NO HEARTH, NO NEXUS: the edge names no true name, the reach no island, and no floor pin rides.
      if (edgeNexus !== null || reach.islandKind !== null || reach.islandScope !== null) return refuse("answer-hearthless-names-nexus");
      if (!Array.isArray(value["floorPins"]) || value["floorPins"].length !== 0) return refuse("answer-hearthless-names-nexus");
    } else {
      // AN ANSWER NAMES ITS NEXUS: every Nexus-bound check below (the floor pins, the admit's face) reads at it, so an answer
      // naming none refuses here rather than skip them.
      if (pinNexus === null) return refuse("answer-nexus-absent");
      const text = value["charter"];
      if (typeof text !== "string" || text.length === 0 || utf8Bytes(text).length > FLEET_JOIN_CHARTER_BOUND) return refuse("answer-malformed");
      charter = text;
      faceAdmit = readFaceAdmit(value["admit"]);
      if (faceAdmit === null) return refuse("answer-malformed");
      // THE ADMIT OPENS OVER THE ANSWER'S OWN CARRIAGE: the pin the joinee dials is the pin the quorum committed to.
      if (admitCarriageCommit({ carriage, salt: faceAdmit.salt }) !== faceAdmit.admit.carriageCommit) return refuse("answer-admit-other-commit");
      const pins = readHearthFloorPins(value["floorPins"], hex(utf8Bytes(pinNexus)));
      if (pins === null) return refuse("answer-floor-pin-refused");
      floorPins = pins;
    }
    if (!record(secret) || !exactly(secret, ["epk", "nonce", "ciphertext"])
      || typeof secret["epk"] !== "string" || !HEX64.test(secret["epk"])
      || typeof secret["nonce"] !== "string" || !/^[0-9a-f]{48}$/.test(secret["nonce"])
      || typeof secret["ciphertext"] !== "string" || !HEX.test(secret["ciphertext"])) return refuse("answer-malformed");
    if (!Array.isArray(value["certificates"]) || !Array.isArray(value["grants"])) return refuse("answer-malformed");
    if (nonce !== args.request.nonce || atomKey !== args.request.atomKey || personaGroup !== args.personaGroup) return refuse("answer-other-request");
    const joineeKeys = [args.request.atomKey, ...args.request.requests.flatMap((q) => [q.vesselFaceKey, q.scope.faceKey])];
    if (joineeKeys.includes(args.rootKey)) return refuse("answer-root-reused");
    if (args.sealSecret !== null) {
      let sealMatches = false;
      try { sealMatches = hex(x25519.getPublicKey(args.sealSecret)) === args.request.sealKey; } catch { sealMatches = false; }
      if (!sealMatches) return refuse("seal-secret-other");
    }

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
    if (faceAdmit !== null) {
      const nym = faceAdmit.admit.nym.toLowerCase();
      if (!certificates.some((c) => c.scope.nexus === pinNexus && c.scope.faceKey === nym)) return refuse("answer-admit-other-face");
    }
    return Object.freeze({
      kind: "fleet-join-answer", ...body, certificates: Object.freeze(certificates), grants: Object.freeze(grants), signature,
    }) as FleetJoinAnswer;
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
 * `custody` signs each certificate request under that key; `sign` signs the request's image under the vessel key;
 * `vesselTag` answers the vessel's blinded tag for this face and atom and the device's per-face ward key, the secrets held behind the door.
 * The request reads back through `readFleetJoinRequest` before it answers, so a door that signed under another
 * key refuses here by name and never leaves the vessel.
 */
export async function composeFleetJoinRequest(args: {
  offer: FleetJoinOffer; atomKey: string; sealKey: string;
  mintFaceKey: (scope: FaceScope) => Promise<string>;
  custody: VesselFaceKeyCustody;
  sign: (image: Uint8Array) => Promise<string>;
  vesselTag: VesselFaceTagDoor;
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
  const tag = await args.vesselTag(args.offer.personaGroup, atomKey);
  const body = { nonce: args.offer.nonce, atomKey, sealKey: args.sealKey, vesselTag: tag.vesselTag, vesselSig: tag.vesselSig, wardKey: tag.wardKey, wardPop: tag.wardPop, requests };
  const signature = await args.sign(fleetJoinRequestImage(body));
  return readFleetJoinRequest({ kind: "fleet-join-request", ...body, signature }, args.offer, [args.offer.rootKey]);
}

// ── The root holder's offer and answer, composed ────────────────────────────────────────────────

/** A root holder's act refused by name: a reader's refusal over the request or the composed answer, or the composer's own. */
export class FleetJoinRootRefused extends Error {
  override readonly name = "FleetJoinRootRefused";
  constructor(readonly refusal: FleetJoinRefusalName, readonly under?: FaceProofRefusal) {
    super(`fleet-join: ${refusal}${under ? ` (${under.refusal})` : ""}`);
  }
}

/**
 * The root holder's offer over the scopes the face stands at now, under a fresh nonce. The vessel reads its own face
 * (its PersonaGroup, its root's public key, its standing scopes) and hands them here, so a node and a browser spell one
 * offer alike.
 */
export function composeFleetJoinOffer(args: { personaGroup: string; rootKey: string; scopes: readonly FaceScope[] }): FleetJoinOffer {
  return fleetJoinOffer({ ...args, nonce: hex(webGetRandomValues(new Uint8Array(32))) });
}

/** What seating the joinee answers: the device edge the root signed, where the joinee dials, and the hearth's dial
 *  (null where this root holder stands no gate). */
export interface FleetJoinSeat {
  readonly edge:   unknown;
  readonly reach:  FleetJoinReach;
  readonly hearth: FleetJoinHearthDial | null;
}

/** The doors a root holder's vessel hands the answer's composer: its custody and its stores, each behind one act. */
export interface FleetJoinRootDoors {
  /** Seat the joining vessel in the face: sign its device edge and read this holder's hearth. It runs once the request
   *  has read against the face's offer; a refusal thrown here leaves no certificate, grant or answer signed. */
  seat(request: FleetJoinRequest): Promise<FleetJoinSeat>;
  /** Issue one certificate over a requested face-scoped key, under that scope's face key. */
  certify(request: VesselFaceCertificateRequest, apart: KeysHeldApart): Promise<VesselFaceCertificate>;
  /** Note every certificate this answer issues beside the device it names, before the answer leaves. */
  noteIssued(issued: { readonly device: string; readonly certificates: readonly VesselFaceCertificate[] }): Promise<void>;
  /** Open the PersonaGroup root for ONE act: `sign` answers the root's signature over an image, 128 hex. The door asks
   *  its ward as its vessel does, and closes the key when the act settles, whatever it answered. */
  withRoot<T>(act: (sign: (image: Uint8Array) => Promise<string>) => Promise<T>): Promise<T>;
  /** The face's address secret, 32 bytes, the composer's own copy to zero-fill; null where the face holds none. */
  addressSecret(): Promise<Uint8Array | null>;
}

/**
 * The root holder's answer to ONE request, composed over the vessel's own doors: the request reads against the offer
 * rebuilt over the scopes that stand now and the request's own nonce; the joinee takes its seat; each requested key
 * takes a certificate, noted before anything leaves; then, inside one opening of the root, each scope takes a grant,
 * the address secret seals to the request, and the root signs the whole. The answer reads back under the root key
 * before it returns, so a door that signed under another key refuses here by name and nothing leaves the vessel.
 *
 * The node's door (`commands/fleet-join`) and the browser's (`browser-fleet-root`) both answer through here. A refusal
 * throws `FleetJoinRootRefused`; a door's own error passes through untouched.
 */
export async function composeFleetJoinAnswer(args: {
  request: unknown; personaGroup: string; rootKey: string; scopes: readonly FaceScope[]; apart?: KeysHeldApart;
  doors: FleetJoinRootDoors;
}): Promise<FleetJoinAnswer> {
  const nonce = record(args.request) ? args.request["nonce"] : undefined;
  if (typeof nonce !== "string" || !HEX64.test(nonce)) throw new FleetJoinRootRefused("request-malformed");
  const offer = fleetJoinOffer({ personaGroup: args.personaGroup, rootKey: args.rootKey, nonce, scopes: args.scopes });
  const apart = [...new Set([args.rootKey, ...(args.apart ?? [])])];
  const request = readFleetJoinRequest(args.request, offer, apart);
  if (isRefusal(request)) throw new FleetJoinRootRefused(request.refusal, request.cause);

  const seat = await args.doors.seat(request);
  const hearth = seat.hearth;
  if (hearth !== null) {
    // THE ADMIT'S KEY TAKES A CERTIFICATE: the joinee asks one at the hearth's Nexus for the key the face's admit names,
    // or its landing reads an admit no certificate of its own answers.
    const nym = hearth.admit.admit.nym.toLowerCase();
    if (!request.requests.some((q) => q.scope.faceKey === nym)) throw new FleetJoinRootRefused("request-scope-household-absent");
  }
  const certificates: VesselFaceCertificate[] = [];
  for (const q of request.requests) certificates.push(await args.doors.certify(q, apart));
  await args.doors.noteIssued({ device: request.atomKey, certificates });

  const answer = await args.doors.withRoot(async (sign) => {
    const grants: FaceKeyGrant[] = [];
    for (const q of request.requests) grants.push({ personaGroup: args.personaGroup, scope: q.scope, signature: await sign(faceKeyGrantImage(args.personaGroup, q.scope)) });
    const secret = await args.doors.addressSecret();
    if (secret === null) throw new FleetJoinRootRefused("no-address-secret");
    let sealed: SealedAddressSecret;
    try { sealed = sealAddressSecret({ secret, request }); } finally { secret.fill(0); }
    const body = {
      nonce, atomKey: request.atomKey, personaGroup: args.personaGroup, edge: seat.edge,
      carriage: hearth === null ? null : { gatePin: hearth.carriage.gatePin, canon: { ...hearth.carriage.canon } },
      reach: seat.reach,
      charter: hearth === null ? null : hearth.charter,
      admit: hearth === null ? null : hearth.admit,
      floorPins: hearth === null ? [] : hearth.floorPins,
      secret: sealed,
    };
    return { kind: "fleet-join-answer" as const, ...body, certificates, grants, signature: await sign(fleetJoinAnswerImage(body)) };
  });
  // THE READ-BACK, through canonical JSON as a courier carries it: the bytes that leave equal the bytes that read.
  const back = readAnswerSigned(JSON.parse(JSON.stringify(answer)), { request, personaGroup: args.personaGroup, rootKey: args.rootKey, sealSecret: null, apart: args.apart ?? [] });
  if (isRefusal(back)) throw new FleetJoinRootRefused(back.refusal, back.cause);
  return answer;
}
