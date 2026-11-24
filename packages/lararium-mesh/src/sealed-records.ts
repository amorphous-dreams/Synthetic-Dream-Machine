/**
 * sealed-records — the records that name and order sealed values: the key version, the manifest, the
 * checkpoint, the hand-over, the memory-import, the re-seal, and the lockbox payload.
 *
 * EACH SIGNED RECORD HOLDS A CLEAR PART AND A SEALED PART. The clear part carries what a carrier needs to
 * index and nothing that names a person: opaque ids, addresses and links. The sealed part carries the record's
 * private fields, its writer's session certificate and the signature, as a sealed value of role `record` under
 * the record's own key version, bound to the record's id. A record's id hashes its clear part under the record
 * kind's own name, so a carrier recomputes an id and verifies no signature.
 *
 * A CAPABLE WRITER SIGNS. A session signs the record's kind, id and private fields with its session key under
 * the `act` purpose. A reader trusts a record only after, in order: its clear part reads whole and names the
 * reader's bag locator and key version; the sealed part opens; the session certificate reads whole; the
 * signature covers the record; the certificate's face holds write standing by the reader's own reading; and the
 * kind's own shape rules hold. The lineage (`content-key-lineage`) then judges a key version's transition.
 *
 * A VERIFIED MANIFEST ENTRY AUTHORIZES ITS ADDRESS for exactly the context whose keyed locator matched.
 *
 * THE LOCKBOX PAYLOAD carries the bag's id, its locator, the key version id and the content key. The key
 * version id commits the key, so the payload needs no signature; the wrap to a bag's readers rides Keyhive's
 * own encryption and belongs to the lockbox store.
 *
 * Pure but for the salt a seal draws. Called by `content-key-holder`, `sealed-store-rest` and `lockbox-wrap`; the
 * package barrel names it.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson, hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import {
  CONTENT_KEY_JOIN_PROOF_INFO, CONTENT_KEY_VERSION_DOMAIN, SEALED_BAG_LOCATOR_INFO, SEALED_CHECKPOINT_DOMAIN,
  SEALED_ENTRY_LOCATOR_INFO, SEALED_HAND_OVER_DOMAIN, SEALED_LOCKBOX_CHAIN_DOMAIN, SEALED_LOCKBOX_DOMAIN, SEALED_MANIFEST_DOMAIN, SEALED_MEMORY_IMPORT_DOMAIN,
  SEALED_RECORD_AUTHORSHIP_DOMAIN, SEALED_RESEAL_DOMAIN,
} from "./domains.js";
import {
  faceProofSubjectRef, own, placeProofSubjectRef, readPlaceSessionCertificate, readPlaceSessionSignature, readSessionCertificate, readSessionSignature,
  type FaceProofRefusalName, type KeysHeldApart, type PlaceSessionCertificate, type Read, type SessionCertificate, type Signature,
} from "./face-proof-subjects.js";
import { readActs, type HistoryDeclaration, type KeyCause, type KeyLineage, type KeyVersionFact } from "./content-key-lineage.js";
import {
  CONTENT_KEY_LEN, authorizeAddress, contextDigest, isChunkRole, isWellFormedText, keyVersionIdOf, openChunk, readContentKey,
  readKeyVersionId, readSealedAddress, readSealedImage, sealChunk, sealedAddressOf, sealedImage,
  type AuthorizedAddress, type ChunkRole, type ContentKey, type KeyVersionId, type OpenRefusalName,
  type SealContext, type SealedAddress,
} from "./sealed-chunk.js";

// ── Names ───────────────────────────────────────────────────────────────────────────────────────
declare const BAG_LOCATOR: unique symbol;
declare const RECORD_ID: unique symbol;
/** A bag's opaque name for a carrier: a keyed digest of the bag's id under its founding content key. */
export type BagLocator = string & { readonly [BAG_LOCATOR]: true };
/** A record's id: SHA-256 over its clear part under its kind's own name. */
export type RecordId = string & { readonly [RECORD_ID]: true };

const HEX64 = /^[0-9a-f]{64}$/;
const isHex64 = (value: unknown): value is string => typeof value === "string" && HEX64.test(value);
export const readBagLocator = (value: unknown): BagLocator | null => (isHex64(value) ? (value as BagLocator) : null);
export const readRecordId = (value: unknown): RecordId | null => (isHex64(value) ? (value as RecordId) : null);

export const RECORD_KINDS = ["key-version", "manifest", "checkpoint", "hand-over", "memory-import", "re-seal"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
const KIND_DOMAINS: Readonly<Record<RecordKind, string>> = Object.freeze({
  "key-version": CONTENT_KEY_VERSION_DOMAIN, manifest: SEALED_MANIFEST_DOMAIN, checkpoint: SEALED_CHECKPOINT_DOMAIN,
  "hand-over": SEALED_HAND_OVER_DOMAIN, "memory-import": SEALED_MEMORY_IMPORT_DOMAIN, "re-seal": SEALED_RESEAL_DOMAIN,
});

// ── Keyed derivations ───────────────────────────────────────────────────────────────────────────
const keyed = (key: ContentKey, info: Uint8Array): string => hex(hkdf(sha256, key, undefined, info, 32));

/** A bag's locator, from its FOUNDING content key and its id. A reader admitted later takes it from its lockbox. */
export function bagLocatorOf(foundingKey: ContentKey, bagId: string): BagLocator {
  if (readContentKey(foundingKey) === null || !isWellFormedText(bagId)) throw new TypeError("sealed-records: a locator derives from a content key and a bag id");
  return keyed(foundingKey, sealedImage(SEALED_BAG_LOCATOR_INFO, utf8Bytes(bagId))) as BagLocator;
}
/** A manifest entry's locator: a keyed digest of the entry's context. A holder of no key reads an opaque value. */
export function entryLocatorOf(key: ContentKey, context: SealContext): string {
  if (readContentKey(key) === null) throw new TypeError("sealed-records: an entry locator derives under a content key");
  return keyed(key, sealedImage(SEALED_ENTRY_LOCATOR_INFO, contextDigest(context)));
}
/** A join's proof that its minter held one parent's key: a keyed digest of the joining version's id. */
export function joinProofOf(parentKey: ContentKey, joining: KeyVersionId): string {
  if (readContentKey(parentKey) === null || readKeyVersionId(joining) === null) throw new TypeError("sealed-records: a join proof derives under a parent key over the joining version's id");
  return keyed(parentKey, sealedImage(CONTENT_KEY_JOIN_PROOF_INFO, hexToBytes(joining)));
}

// ── The clear parts ─────────────────────────────────────────────────────────────────────────────
export interface KeyVersionBody {
  readonly bag:        BagLocator;
  readonly keyVersion: KeyVersionId;
  /** Parent versions: unique, sorted ascending. Empty on the founding version alone. */
  readonly parents:    readonly KeyVersionId[];
  /** The span this version belongs to: the id of the version that opened it. */
  readonly span:       KeyVersionId;
}
/** A manifest entry: one sealed value a writer added. */
export interface ManifestEntry {
  readonly role:    ChunkRole;
  readonly address: SealedAddress;
  /** The keyed locator of the entry's context: the bag's map from logical reference to address. */
  readonly locator: string;
  /** A change: the values that hold its causal parents. A checkpoint: the values it covers. A blob: none. */
  readonly parents: readonly SealedAddress[];
}
export interface ManifestBody {
  readonly bag:        BagLocator;
  readonly keyVersion: KeyVersionId;
  /** The manifests its writer had read: unique, sorted ascending. No counter orders two writers. */
  readonly parents:    readonly RecordId[];
  readonly entries:    readonly ManifestEntry[];
}
export const CHECKPOINT_BASES = ["fresh", "continuation"] as const;
export type CheckpointBase = (typeof CHECKPOINT_BASES)[number];
export interface CheckpointBody {
  readonly bag:        BagLocator;
  readonly keyVersion: KeyVersionId;
  readonly span:       KeyVersionId;
  /** `fresh`: a new document founded from present values. `continuation`: the same document's history runs on. */
  readonly base:       CheckpointBase;
  /** The sealed value of role `checkpoint` this record names. */
  readonly address:    SealedAddress;
  /** The values whose changes the state includes: unique, sorted ascending. */
  readonly covers:     readonly SealedAddress[];
}
/** A hand-over: one holder handed one span's keys to one reader. It rides under the head the holder held. */
export interface HandOverBody {
  readonly bag:        BagLocator;
  /** The head the record seals under: every reader of that head verifies it. */
  readonly keyVersion: KeyVersionId;
  readonly span:       KeyVersionId;
  /** The versions handed: unique, sorted ascending, never empty. */
  readonly versions:   readonly KeyVersionId[];
}
/** A memory-import: one seat came to hold one key version by recovery. It rides under the version it names. */
export interface MemoryImportBody {
  readonly bag:        BagLocator;
  /** The version imported, and the version the record seals under: every reader of it verifies the record. */
  readonly keyVersion: KeyVersionId;
}
/**
 * A re-seal: one replacement a roll's successor re-sealed (the road's #/rulings, the re-seal proof). The face session that
 * writes the replacement signs it, one record per replacement, so a reader offline through the roll learns which value
 * replaced which and whose hand re-sealed it. It rides under the successor it seals under.
 */
export interface ResealBody {
  readonly bag:        BagLocator;
  /** The removal successor the replacement seals under, and the version the record rides under. */
  readonly keyVersion: KeyVersionId;
  /** The version the replaced value sealed under. */
  readonly replaced:   KeyVersionId;
  /** The replaced value's ciphertext address. */
  readonly from:       SealedAddress;
  /** The replacement's ciphertext address. */
  readonly to:         SealedAddress;
  /** The logical entry it replaces: the entry locator the replaced version's manifest names the value by. */
  readonly entry:      string;
}
export interface RecordBodies { "key-version": KeyVersionBody; manifest: ManifestBody; checkpoint: CheckpointBody; "hand-over": HandOverBody; "memory-import": MemoryImportBody; "re-seal": ResealBody }

// ── The private parts ───────────────────────────────────────────────────────────────────────────
export interface KeyVersionPrivate {
  readonly cause:      KeyCause;
  readonly history:    HistoryDeclaration;
  /** One proof per parent on a `join`, in the parents' order; empty otherwise. */
  readonly joinProofs: readonly string[];
  /** The readers this version's mint could not serve, by their identifiers on the key shore: unique, sorted
   *  ascending. Sealed, so every reader of the version reads the debt and no carrier does. */
  readonly unserved:   readonly string[];
}
export interface ManifestPrivate {
  /** The writer of the batch's change: `session:<session key>` where the signing session made it, `peer:<actor>` where a
   *  peer's change rests as received under the session that holds the rest. Sealed, since it names a party. */
  readonly writer: string;
}
export interface CheckpointPrivate {
  /** The causal frontier in the document engine's own ids: unique, sorted ascending. */
  readonly frontier: readonly string[];
}
export interface HandOverPrivate {
  /** The reader that received the span: its identifier on the key shore. Sealed, since it names a party. */
  readonly reader: string;
}
export interface MemoryImportPrivate {
  /** The seat that holds the version by recovery: its identifier on the key shore. Sealed, since it names a party. */
  readonly seat: string;
}
export interface ResealPrivate {
  /** The removal acts that authorized the roll: raises the nearest removal within the successor's span answers, unique,
   *  sorted, never empty. Sealed, as the key version's own cause rests. */
  readonly acts: readonly string[];
  /** The replaced entry's role and logical reference: a reader holding either key recomputes that key's entry locator
   *  from them, so `from` and `to` bind one logical entry. Sealed, since a reference hashes plaintext. */
  readonly role: ChunkRole;
  readonly ref:  string;
}
export interface RecordPrivates { "key-version": KeyVersionPrivate; manifest: ManifestPrivate; checkpoint: CheckpointPrivate; "hand-over": HandOverPrivate; "memory-import": MemoryImportPrivate; "re-seal": ResealPrivate }

/** A record as it travels and rests: the clear part and the sealed part. */
export interface SealedRecord<K extends RecordKind = RecordKind> {
  readonly kind:   K;
  readonly body:   RecordBodies[K];
  readonly sealed: Uint8Array;
}
/**
 * The certificate a record's writer carries: the session that signed it, at whichever anchor that session met its face
 * (session-contract#/the-hands). A Nexus session's certificate stands beneath the vessel's face-scoped key; a place
 * session's beneath the face's atom at the vessel's own place. The sealer reads (face, anchor) whatever the anchor.
 */
export type RecordCertificate = SessionCertificate | PlaceSessionCertificate;
/** Is this certificate a place session's? It carries no face-scoped vessel key. */
export function isPlaceCertificate(certificate: RecordCertificate): certificate is PlaceSessionCertificate {
  return !("vesselFaceKey" in certificate);
}
/** The proof subject of the face that wrote under `certificate`, at its own anchor. */
export function recordWriterSubject(certificate: RecordCertificate): string {
  return isPlaceCertificate(certificate) ? placeProofSubjectRef(certificate.scope) : faceProofSubjectRef(certificate.scope);
}
/** Read a writer's certificate at either anchor: a place certificate names an atom and a place, and no vessel key. */
function readRecordCertificate(value: unknown, apart: KeysHeldApart): Read<RecordCertificate> {
  const place = typeof value === "object" && value !== null && !("vesselFaceKey" in value);
  return place ? readPlaceSessionCertificate(value) : readSessionCertificate(value, apart);
}

/** A record a reader verified. Built by `readRecord` alone. */
export interface VerifiedRecord<K extends RecordKind = RecordKind> {
  readonly kind:        K;
  readonly id:          RecordId;
  readonly body:        RecordBodies[K];
  readonly private:     RecordPrivates[K];
  readonly certificate: RecordCertificate;
}
const VERIFIED = new WeakSet<object>();

/** Freeze a plain value through every array and record it holds. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value)) deepFreeze(member);
  }
  return value;
}

// ── Shape readers ───────────────────────────────────────────────────────────────────────────────
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Reflect.ownKeys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
/** A list whose members all read, stand unique and sit in ascending order. */
function sortedUnique<T extends string>(value: unknown, read: (member: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const member of value) {
    const one = read(member);
    if (one === null || (out.length > 0 && !(out[out.length - 1]! < one))) return null;
    out.push(one);
  }
  return out;
}
/** Well-formed text of bounded length: an id whose bytes name it alone. */
const nonEmptyText = (value: unknown): string | null => (isWellFormedText(value) && value.length <= 512 ? value : null);
/** A change's writer: `session:` or `peer:`, then well-formed text that names it. */
const readWriter = (value: unknown): string | null => {
  const text = nonEmptyText(value);
  return text !== null && /^(session|peer):./.test(text) ? text : null;
};

function readKeyVersionBody(value: unknown): KeyVersionBody | null {
  if (!isRecord(value) || !exactKeys(value, ["bag", "keyVersion", "parents", "span"])) return null;
  const bag = readBagLocator(value["bag"]), keyVersion = readKeyVersionId(value["keyVersion"]), span = readKeyVersionId(value["span"]);
  const parents = sortedUnique(value["parents"], readKeyVersionId);
  if (bag === null || keyVersion === null || span === null || parents === null || parents.includes(keyVersion)) return null;
  return { bag, keyVersion, parents, span };
}
function readEntry(value: unknown): ManifestEntry | null {
  if (!isRecord(value) || !exactKeys(value, ["role", "address", "locator", "parents"])) return null;
  const address = readSealedAddress(value["address"]);
  const parents = sortedUnique(value["parents"], readSealedAddress);
  if (!isChunkRole(value["role"]) || address === null || !isHex64(value["locator"]) || parents === null) return null;
  if (value["role"] === "blob" && parents.length > 0) return null;
  return { role: value["role"], address, locator: value["locator"], parents };
}
function readManifestBody(value: unknown): ManifestBody | null {
  if (!isRecord(value) || !exactKeys(value, ["bag", "keyVersion", "parents", "entries"])) return null;
  const bag = readBagLocator(value["bag"]), keyVersion = readKeyVersionId(value["keyVersion"]);
  const parents = sortedUnique(value["parents"], readRecordId);
  if (bag === null || keyVersion === null || parents === null || !Array.isArray(value["entries"]) || value["entries"].length === 0) return null;
  const entries: ManifestEntry[] = [];
  for (const raw of value["entries"]) {
    const entry = readEntry(raw);
    if (entry === null) return null;
    entries.push(entry);
  }
  return { bag, keyVersion, parents, entries };
}
function readCheckpointBody(value: unknown): CheckpointBody | null {
  if (!isRecord(value) || !exactKeys(value, ["bag", "keyVersion", "span", "base", "address", "covers"])) return null;
  const bag = readBagLocator(value["bag"]), keyVersion = readKeyVersionId(value["keyVersion"]), span = readKeyVersionId(value["span"]);
  const address = readSealedAddress(value["address"]);
  const covers = sortedUnique(value["covers"], readSealedAddress);
  const base = value["base"];
  if (bag === null || keyVersion === null || span === null || address === null || covers === null) return null;
  if (base !== "fresh" && base !== "continuation") return null;
  return { bag, keyVersion, span, base, address, covers };
}
function readHandOverBody(value: unknown): HandOverBody | null {
  if (!isRecord(value) || !exactKeys(value, ["bag", "keyVersion", "span", "versions"])) return null;
  const bag = readBagLocator(value["bag"]), keyVersion = readKeyVersionId(value["keyVersion"]), span = readKeyVersionId(value["span"]);
  const versions = sortedUnique(value["versions"], readKeyVersionId);
  if (bag === null || keyVersion === null || span === null || versions === null || versions.length === 0) return null;
  return { bag, keyVersion, span, versions };
}
function readMemoryImportBody(value: unknown): MemoryImportBody | null {
  if (!isRecord(value) || !exactKeys(value, ["bag", "keyVersion"])) return null;
  const bag = readBagLocator(value["bag"]), keyVersion = readKeyVersionId(value["keyVersion"]);
  return bag === null || keyVersion === null ? null : { bag, keyVersion };
}
function readResealBody(value: unknown): ResealBody | null {
  if (!isRecord(value) || !exactKeys(value, ["bag", "keyVersion", "replaced", "from", "to", "entry"])) return null;
  const bag = readBagLocator(value["bag"]), keyVersion = readKeyVersionId(value["keyVersion"]), replaced = readKeyVersionId(value["replaced"]);
  const from = readSealedAddress(value["from"]), to = readSealedAddress(value["to"]);
  if (bag === null || keyVersion === null || replaced === null || from === null || to === null || !isHex64(value["entry"])) return null;
  // A replacement moves a value to another version and another ciphertext.
  if (keyVersion === replaced || from === to) return null;
  return { bag, keyVersion, replaced, from, to, entry: value["entry"] };
}
function readBody<K extends RecordKind>(kind: K, value: unknown): RecordBodies[K] | null {
  try {
    const read = kind === "key-version" ? readKeyVersionBody(value) : kind === "manifest" ? readManifestBody(value) : kind === "checkpoint" ? readCheckpointBody(value)
      : kind === "hand-over" ? readHandOverBody(value) : kind === "memory-import" ? readMemoryImportBody(value) : kind === "re-seal" ? readResealBody(value) : null;
    return read as RecordBodies[K] | null;
  } catch { return null; }
}

function readCause(value: unknown): KeyCause | null {
  if (!isRecord(value)) return null;
  const kind = value["kind"];
  if ((kind === "founding" || kind === "join") && exactKeys(value, ["kind"])) return { kind };
  if (kind === "admission" && exactKeys(value, ["kind", "act"])) {
    const act = nonEmptyText(value["act"]);
    return act === null ? null : { kind, act };
  }
  if (kind === "removal" && exactKeys(value, ["kind", "acts"])) {
    const acts = readActs(value["acts"]);
    return acts === null || !acts.every((act) => nonEmptyText(act) !== null) ? null : { kind, acts };
  }
  return null;
}
function readKeyVersionPrivate(value: unknown, body: KeyVersionBody): KeyVersionPrivate | null {
  if (!isRecord(value) || !exactKeys(value, ["cause", "history", "joinProofs", "unserved"])) return null;
  const cause = readCause(value["cause"]);
  const history = value["history"];
  const proofs = value["joinProofs"];
  if (cause === null || (history !== "shareable" && history !== "closed") || !Array.isArray(proofs) || !proofs.every(isHex64)) return null;
  // A join carries one proof per parent; no other cause carries any.
  if (proofs.length !== (cause.kind === "join" ? body.parents.length : 0)) return null;
  const unserved = sortedUnique(value["unserved"], nonEmptyText);
  if (unserved === null) return null;
  return { cause, history, joinProofs: proofs as string[], unserved };
}
function readPrivate<K extends RecordKind>(kind: K, value: unknown, body: RecordBodies[K]): RecordPrivates[K] | null {
  try {
    if (kind === "key-version") return readKeyVersionPrivate(value, body as KeyVersionBody) as RecordPrivates[K] | null;
    if (kind === "manifest") {
      if (!isRecord(value) || !exactKeys(value, ["writer"])) return null;
      const writer = readWriter(value["writer"]);
      return (writer === null ? null : { writer }) as RecordPrivates[K] | null;
    }
    if (kind === "hand-over") {
      if (!isRecord(value) || !exactKeys(value, ["reader"])) return null;
      const reader = nonEmptyText(value["reader"]);
      return (reader === null ? null : { reader }) as RecordPrivates[K] | null;
    }
    if (kind === "memory-import") {
      if (!isRecord(value) || !exactKeys(value, ["seat"])) return null;
      const seat = nonEmptyText(value["seat"]);
      return (seat === null ? null : { seat }) as RecordPrivates[K] | null;
    }
    if (kind === "re-seal") {
      if (!isRecord(value) || !exactKeys(value, ["acts", "role", "ref"])) return null;
      const acts = readActs(value["acts"]);
      const role = value["role"], ref = value["ref"];
      if (acts === null || !acts.every((act) => nonEmptyText(act) !== null) || !isChunkRole(role) || !isHex64(ref)) return null;
      return { acts, role, ref } as RecordPrivates[K];
    }
    if (kind !== "checkpoint") return null;
    if (!isRecord(value) || !exactKeys(value, ["frontier"])) return null;
    const frontier = sortedUnique(value["frontier"], nonEmptyText);
    return (frontier === null ? null : { frontier }) as RecordPrivates[K] | null;
  } catch { return null; }
}

// ── Canonical images ────────────────────────────────────────────────────────────────────────────
/** A list as one field: its members under the one length-prefixed encoding. */
const listField = (members: readonly Uint8Array[]): Uint8Array => sealedImage("", ...members);
const hexList = (members: readonly string[]): Uint8Array => listField(members.map((m) => hexToBytes(m)));
const addressBytes = (address: SealedAddress): Uint8Array => utf8Bytes(address);

function bodyImage<K extends RecordKind>(kind: K, body: RecordBodies[K]): Uint8Array {
  if (kind === "key-version") {
    const b = body as KeyVersionBody;
    return sealedImage(KIND_DOMAINS[kind], hexToBytes(b.bag), hexToBytes(b.keyVersion), hexList(b.parents), hexToBytes(b.span));
  }
  if (kind === "manifest") {
    const b = body as ManifestBody;
    const entries = b.entries.map((e) => sealedImage("", utf8Bytes(e.role), addressBytes(e.address), hexToBytes(e.locator), listField(e.parents.map(addressBytes))));
    return sealedImage(KIND_DOMAINS[kind], hexToBytes(b.bag), hexToBytes(b.keyVersion), hexList(b.parents), listField(entries));
  }
  if (kind === "hand-over") {
    const b = body as HandOverBody;
    return sealedImage(KIND_DOMAINS[kind], hexToBytes(b.bag), hexToBytes(b.keyVersion), hexToBytes(b.span), hexList(b.versions));
  }
  if (kind === "memory-import") {
    const b = body as MemoryImportBody;
    return sealedImage(KIND_DOMAINS[kind], hexToBytes(b.bag), hexToBytes(b.keyVersion));
  }
  if (kind === "re-seal") {
    const b = body as ResealBody;
    return sealedImage(KIND_DOMAINS[kind], hexToBytes(b.bag), hexToBytes(b.keyVersion), hexToBytes(b.replaced), addressBytes(b.from), addressBytes(b.to), hexToBytes(b.entry));
  }
  const b = body as CheckpointBody;
  return sealedImage(KIND_DOMAINS[kind], hexToBytes(b.bag), hexToBytes(b.keyVersion), hexToBytes(b.span), utf8Bytes(b.base), addressBytes(b.address), listField(b.covers.map(addressBytes)));
}
function privateImage<K extends RecordKind>(kind: K, value: RecordPrivates[K]): Uint8Array {
  if (kind === "key-version") {
    const p = value as KeyVersionPrivate;
    const acts = p.cause.kind === "removal" ? p.cause.acts : p.cause.kind === "admission" ? [p.cause.act] : [];
    return sealedImage("", utf8Bytes(p.cause.kind), listField(acts.map((act) => utf8Bytes(act))), utf8Bytes(p.history), hexList(p.joinProofs), listField(p.unserved.map((reader) => utf8Bytes(reader))));
  }
  if (kind === "manifest") return sealedImage("", utf8Bytes((value as ManifestPrivate).writer));
  if (kind === "hand-over") return sealedImage("", utf8Bytes((value as HandOverPrivate).reader));
  if (kind === "memory-import") return sealedImage("", utf8Bytes((value as MemoryImportPrivate).seat));
  if (kind === "re-seal") {
    const p = value as ResealPrivate;
    return sealedImage("", listField(p.acts.map((act) => utf8Bytes(act))), utf8Bytes(p.role), hexToBytes(p.ref));
  }
  return sealedImage("", listField((value as CheckpointPrivate).frontier.map((id) => utf8Bytes(id))));
}

/** A record's id. A carrier computes it from the clear part alone. Throws on a clear part that reads malformed. */
export function recordIdOf<K extends RecordKind>(kind: K, body: RecordBodies[K]): RecordId {
  const read = readBody(kind, body);
  if (read === null) throw new TypeError(`sealed-records: a ${kind} clear part reads malformed`);
  return hex(sha256(bodyImage(kind, read))) as RecordId;
}
/** The bytes a record's writer signs, handed to the session signer as an `act`. */
function authorshipImage<K extends RecordKind>(kind: K, id: RecordId, value: RecordPrivates[K]): Uint8Array {
  return sealedImage(SEALED_RECORD_AUTHORSHIP_DOMAIN, utf8Bytes(kind), hexToBytes(id), privateImage(kind, value));
}
const recordContext = (bagId: string, keyVersion: KeyVersionId, id: RecordId): SealContext =>
  ({ bagId, keyVersion, role: "record", logicalRef: hexToBytes(id) });

// ── Sign ────────────────────────────────────────────────────────────────────────────────────────
/** What a record's writer signs with: one session's signer (`session-signer`), by its interface. */
export interface RecordSigner {
  readonly certificate: RecordCertificate;
  sign(purpose: "act", payload: Uint8Array): Promise<{ readonly signature: Signature } | { readonly refusal: string }>;
}
export const SIGN_RECORD_REFUSALS = ["record-malformed", "key-malformed", "key-mismatch", "signer-refused", "seal-refused"] as const;
export type SignRecordRefusalName = (typeof SIGN_RECORD_REFUSALS)[number];

/** Sign and seal one record under its own key version. */
export async function signRecord<K extends RecordKind>(args: {
  readonly kind: K; readonly body: RecordBodies[K]; readonly private: RecordPrivates[K];
  readonly bagId: string; readonly key: ContentKey; readonly signer: RecordSigner;
  readonly random?: Pick<RandomProvider, "getRandomValues">;
}): Promise<{ readonly record: SealedRecord<K>; readonly id: RecordId } | { readonly refusal: SignRecordRefusalName; readonly cause?: string }> {
  const body = readBody(args.kind, args.body);
  if (body === null) return { refusal: "record-malformed" };
  const secret = readPrivate(args.kind, args.private, body);
  if (secret === null) return { refusal: "record-malformed" };
  const key = readContentKey(args.key);
  if (key === null || !isWellFormedText(args.bagId)) return { refusal: "key-malformed" };
  if (keyVersionIdOf(key, args.bagId) !== body.keyVersion) return { refusal: "key-mismatch" };
  const id = hex(sha256(bodyImage(args.kind, body))) as RecordId;
  const signed = await args.signer.sign("act", authorshipImage(args.kind, id, secret));
  if (!own(signed, "signature")) return { refusal: "signer-refused", cause: signed.refusal };
  const plaintext = utf8Bytes(canonicalJson({ private: secret, certificate: args.signer.certificate, signature: signed.signature }));
  const sealed = sealChunk({ key, context: recordContext(args.bagId, body.keyVersion, id), plaintext, ...(args.random ? { random: args.random } : {}) });
  if (!own(sealed, "chunk")) return { refusal: "seal-refused", cause: sealed.refusal };
  return { record: { kind: args.kind, body, sealed: sealed.chunk.sealed }, id };
}

// ── Read ────────────────────────────────────────────────────────────────────────────────────────
/** The reader's own reading of who may write a bag. It answers for the face certificate beneath the session
 *  certificate, for the face's withdrawal history, and for the face's standing in the bag. */
export interface WriterStanding {
  /**
   * Does the certificate's face hold write standing in the bag? A record names the key version it rests under
   * (`keyVersion`), and the reader hands its own lineage's reading of that version (`followsRemoval`: does it descend from
   * a successor minted for the removal `act`?), so a standing may key a writer to the lineage: a writer a removal left out
   * stands for the versions that precede that removal and for none after it (cabal-realm#/the-workbench).
   */
  holdsWrite(args: {
    readonly certificate: RecordCertificate; readonly bagId: string;
    readonly keyVersion?: KeyVersionId; readonly followsRemoval?: (act: string) => boolean;
  }): boolean;
  /**
   * Does the certificate stand under the chain of the face that OWNS the realm keeping `bagId` (its private cabal of one)? A
   * realm's from-now admission opens a span only under its owner's hand. Absent: no certificate reads as the owner's.
   */
  signedByRealmOwner?(args: { readonly certificate: RecordCertificate; readonly bagId: string }): boolean;
  /** The chain this standing reads writers under, named, or null where none stands yet: a reading taken then counts
   *  no writer, so a holder takes no reading and settles no roll on it. Absent: the standing reads alike always. */
  readonly chainOf?: () => string | null;
  /** The bags this standing reads a writer capable over, named by their content: `holdsWrite` answers by that set, so a
   *  reading a holder took under one set gives way when the set reads otherwise (a bag the face registers after the
   *  reading founds there). Absent: the standing reads by no register set. */
  readonly registeredOf?: () => string;
}
export const READ_RECORD_REFUSALS = [
  "record-malformed",       // the carried record, or its clear part, reads as no record of this kind
  "key-malformed",
  "locator-mismatch",       // the record names another bag's locator than the reader's lockbox named
  "key-mismatch",           // the key in hand does not stand as the record's key version
  "sealed-part-refused",    // the sealed part does not open under this record's id (cause names the refusal)
  "authorship-malformed",   // the sealed part opens to no private fields, certificate and signature
  "certificate-refused",    // the session certificate fails its reading
  "signature-refused",      // the signature does not cover this record under the `act` purpose
  "writer-not-capable",     // the certificate's face holds no write standing in the bag
] as const;
export type ReadRecordRefusalName = (typeof READ_RECORD_REFUSALS)[number];
export interface ReadRecordRefusal { readonly refusal: ReadRecordRefusalName; readonly cause?: OpenRefusalName | FaceProofRefusalName }

/**
 * Read one carried record. The checks run in the order `READ_RECORD_REFUSALS` lists them, and a record that
 * passes them all stands verified: its writer held the key, a live session of a capable face signed it, and
 * its clear and private parts read whole.
 */
export function readRecord<K extends RecordKind>(kind: K, carried: unknown, reader: {
  readonly bagId: string; readonly locator: BagLocator; readonly key: ContentKey;
  readonly standing: WriterStanding; readonly apart?: KeysHeldApart;
  /** The reader's lineage: does `keyVersion` descend from a successor minted for the removal `act`? Absent: no reading. */
  readonly followsRemoval?: (keyVersion: KeyVersionId, act: string) => boolean;
}): { readonly record: VerifiedRecord<K> } | ReadRecordRefusal {
  try {
    if (!(RECORD_KINDS as readonly string[]).includes(kind) || !isRecord(carried) || !exactKeys(carried, ["kind", "body", "sealed"]) || carried["kind"] !== kind) return { refusal: "record-malformed" };
    const body = readBody(kind, carried["body"]);
    const sealed = carried["sealed"];
    if (body === null || !(sealed instanceof Uint8Array)) return { refusal: "record-malformed" };
    const key = readContentKey(reader.key);
    if (key === null || !isWellFormedText(reader.bagId)) return { refusal: "key-malformed" };
    if (body.bag !== reader.locator) return { refusal: "locator-mismatch" };
    if (keyVersionIdOf(key, reader.bagId) !== body.keyVersion) return { refusal: "key-mismatch" };
    const id = hex(sha256(bodyImage(kind, body))) as RecordId;
    const authorized = authorizeAddress(sealedAddressOf(sealed), "record-part");
    if (authorized === null) return { refusal: "record-malformed" };
    const opened = openChunk({ key, context: recordContext(reader.bagId, body.keyVersion, id), sealed, authorized });
    if (!own(opened, "plaintext")) return { refusal: "sealed-part-refused", cause: opened.refusal };
    let part: unknown;
    try { part = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(opened.plaintext)); }
    catch { return { refusal: "authorship-malformed" }; }
    if (!isRecord(part) || !exactKeys(part, ["private", "certificate", "signature"])) return { refusal: "authorship-malformed" };
    const secret = readPrivate(kind, part["private"], body);
    if (secret === null) return { refusal: "authorship-malformed" };
    const certificate = readRecordCertificate(part["certificate"], reader.apart ?? []);
    if (!own(certificate, "read")) return { refusal: "certificate-refused", cause: certificate.refusal };
    const authorship = authorshipImage(kind, id, secret);
    const signature = isPlaceCertificate(certificate.read)
      ? readPlaceSessionSignature(certificate.read, "act", authorship, part["signature"])
      : readSessionSignature(certificate.read, "act", authorship, part["signature"]);
    if (!own(signature, "read")) return { refusal: "signature-refused", cause: signature.refusal };
    const follows = reader.followsRemoval;
    const asked = { certificate: certificate.read, bagId: reader.bagId, keyVersion: body.keyVersion, ...(follows ? { followsRemoval: (act: string) => follows(body.keyVersion, act) } : {}) };
    if (reader.standing.holdsWrite(asked) !== true) return { refusal: "writer-not-capable" };
    // The readers built `body` and `secret` afresh from what they read, so no caller holds a way into them;
    // frozen through, a verified record stays as its reader verified it.
    const record = Object.freeze({ kind, id, body: deepFreeze(body), private: deepFreeze(secret), certificate: deepFreeze(certificate.read) });
    VERIFIED.add(record);
    return { record };
  } catch { return { refusal: "record-malformed" }; }
}

/** The fact a verified key version record states, for the lineage to judge. */
export function factOfRecord(record: VerifiedRecord<"key-version">): KeyVersionFact {
  if (!VERIFIED.has(record)) throw new TypeError("sealed-records: only a verified record states a fact");
  return { keyVersion: record.body.keyVersion, parents: record.body.parents, span: record.body.span, history: record.private.history, cause: record.private.cause };
}

/**
 * Check a join's proofs against the parent keys the reader holds. Every parent whose key the reader holds must
 * prove; a parent whose key it lacks stays unchecked. A reader that holds no parent key proves nothing.
 */
export function joinProven(record: VerifiedRecord<"key-version">, heldParents: ReadonlyMap<KeyVersionId, ContentKey>): boolean {
  if (!VERIFIED.has(record) || record.private.cause.kind !== "join") return false;
  let checked = 0;
  for (let i = 0; i < record.body.parents.length; i++) {
    const parent = record.body.parents[i]!;
    const key = heldParents.get(parent);
    if (key === undefined) continue;
    if (joinProofOf(key, record.body.keyVersion) !== record.private.joinProofs[i]) return false;
    checked += 1;
  }
  return checked > 0;
}

/**
 * Authorize an address from a VERIFIED manifest: the entry whose keyed locator and role match `context`. Null
 * when the manifest never passed `readRecord`, names another key version, holds no such entry, or holds two
 * entries under one locator that name unlike addresses.
 */
export function authorizeFromManifest(manifest: VerifiedRecord<"manifest">, key: ContentKey, context: SealContext): AuthorizedAddress | null {
  try {
    if (!VERIFIED.has(manifest) || manifest.kind !== "manifest") return null;
    if (context.keyVersion !== manifest.body.keyVersion || keyVersionIdOf(key, context.bagId) !== context.keyVersion) return null;
    const locator = entryLocatorOf(key, context);
    const hits = manifest.body.entries.filter((entry) => entry.locator === locator && entry.role === context.role);
    if (hits.length === 0 || hits.some((entry) => entry.address !== hits[0]!.address)) return null;
    return authorizeAddress(hits[0]!.address, "manifest-entry");
  } catch { return null; }
}

// ── The re-seal's bindings ─────────────────────────────────────────────────────────────────────
/** A binding a re-seal record makes: its successor's removal cause, the replaced version's ancestry, the replaced value's
 *  address under its entry, and the replacement's address under the successor. */
export const RESEAL_BINDINGS = ["successor", "replaced", "from", "to"] as const;
export type ResealBinding = (typeof RESEAL_BINDINGS)[number];
/**
 * What a reader judges of one verified re-seal record against the history it holds. `complete`: every binding stands on
 * a record the reader verified. `unverified`: no binding broke, and the history it lacks leaves the named ones unread (a
 * missing parent never reads as complete). `refused`: a binding the reader holds the history for does not stand.
 */
export type ResealVerdict =
  | { readonly verdict: "complete" }
  | { readonly verdict: "unverified"; readonly missing: readonly ResealBinding[] }
  | { readonly verdict: "refused"; readonly refusal: "reseal-unbound"; readonly binding: ResealBinding };

/**
 * Judge a VERIFIED re-seal record against the history a reader holds: its COUNTED lineage of the record's founding, the
 * keys it holds for counted versions, and the manifests it verified. COUNTED HISTORY ALONE: a key version record the
 * reader verified and never counted stands in no lineage, so it binds nothing here, and a key the reader holds for a
 * version its lineage never counted opens no binding; a manifest that never passed `readRecord` counts as history the
 * reader lacks.
 */
export function judgeReseal(record: VerifiedRecord<"re-seal">, held: {
  readonly bagId: string;
  /** The reader's counted lineage of the record's founding. */
  readonly lineage: KeyLineage;
  /** The keys the reader holds, by version: each opens a binding only where `lineage` counted its version. */
  readonly keys: ReadonlyMap<KeyVersionId, ContentKey>;
  readonly manifests: readonly VerifiedRecord<"manifest">[];
}): ResealVerdict {
  if (!VERIFIED.has(record) || record.kind !== "re-seal") throw new TypeError("sealed-records: only a verified re-seal record reads its bindings");
  const { bag, keyVersion, replaced, from, to, entry } = record.body;
  const factOf = (id: KeyVersionId): KeyVersionFact | null => held.lineage.fact(id);
  const manifestsUnder = (id: KeyVersionId): VerifiedRecord<"manifest">[] =>
    held.manifests.filter((m) => VERIFIED.has(m) && m.kind === "manifest" && m.body.bag === bag && m.body.keyVersion === id);
  const missing: ResealBinding[] = [];
  const unbound = (binding: ResealBinding): ResealVerdict => ({ verdict: "refused", refusal: "reseal-unbound", binding });
  // THE SUCCESSOR: the counted version the record rides under. The roll it answers stands as the nearest removal within
  // the successor's span, the successor itself first, and that removal's cause names every act the record cites; a head
  // after the removal (a join, a later write) answers the same roll.
  const successor = factOf(keyVersion);
  if (successor === null) missing.push("successor", "replaced");
  else {
    // THE SPAN FENCE (#/epochs): a replacement never carries a body across spans. A replaced version the reader counted
    // in another span than the successor's binds nothing; the span rides each version's clear part.
    const replacedFact = factOf(replaced);
    if (replacedFact !== null && replacedFact.span !== successor.span) return unbound("replaced");
    const nearest = held.lineage.nearestRemoval([keyVersion], successor.span);
    if (nearest === null) return unbound("successor");
    if (!("removal" in nearest)) missing.push("successor", "replaced");
    else {
      const roll = nearest.removal;
      const cause = roll.cause;
      if (cause.kind !== "removal" || !record.private.acts.every((act) => cause.acts.includes(act))) return unbound("successor");
      // THE REPLACED VERSION stands upstream of that removal. A walk that meets a version the reader never counted leaves
      // the binding unread, never complete.
      const seen = new Set<KeyVersionId>();
      const queue = [...roll.parents];
      let found = false, gap = false;
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        seen.add(id);
        if (id === replaced) { found = true; break; }
        const one = factOf(id);
        if (one === null) { gap = true; continue; }
        queue.push(...one.parents);
      }
      if (!found) { if (gap) missing.push("replaced"); else return unbound("replaced"); }
    }
  }
  // ONE LOGICAL ENTRY: the record's role and reference recompute each side's entry locator under that side's key, where
  // the reader holds a counted one; a key it lacks leaves that side unverified.
  const { role, ref } = record.private;
  const entryUnder = (id: KeyVersionId): string | null => {
    const key = held.lineage.has(id) ? held.keys.get(id) : undefined;
    return key === undefined ? null : entryLocatorOf(key, { bagId: held.bagId, keyVersion: id, role, logicalRef: hexToBytes(ref) });
  };
  // THE REPLACED VALUE: the record's entry recomputes under the replaced key, and a manifest under the replaced version
  // names the replaced address under that entry.
  const oldEntry = entryUnder(replaced);
  if (oldEntry !== null && oldEntry !== entry) return unbound("from");
  const fromEntries = manifestsUnder(replaced).flatMap((m) => m.body.entries).filter((e) => e.address === from);
  if (fromEntries.length > 0 && !fromEntries.some((e) => e.locator === entry && e.role === role)) return unbound("from");
  if (oldEntry === null || fromEntries.length === 0) missing.push("from");
  // THE REPLACEMENT: a manifest under the successor, written by the hand that signed the re-seal, names the replacement's
  // address under the same entry recomputed under the successor's key.
  const signer = recordWriterSubject(record.certificate);
  const toManifests = manifestsUnder(keyVersion).filter((m) => m.body.entries.some((e) => e.address === to));
  if (toManifests.length > 0) {
    const own = toManifests.filter((m) => recordWriterSubject(m.certificate) === signer);
    if (own.length === 0) return unbound("to");
    const newEntry = entryUnder(keyVersion);
    if (newEntry === null) missing.push("to");
    else if (!own.some((m) => m.body.entries.some((e) => e.address === to && e.locator === newEntry && e.role === role))) return unbound("to");
  } else missing.push("to");
  return missing.length === 0 ? { verdict: "complete" } : { verdict: "unverified", missing };
}

// ── The lockbox payload ─────────────────────────────────────────────────────────────────────────
export interface LockboxPayload {
  readonly bagId: string; readonly locator: BagLocator; readonly keyVersion: KeyVersionId; readonly key: ContentKey;
  /** THE CHAIN (a span declared shareable): each earlier key of the version's span, so one box opens the span's past. Each
   *  key recomputes to the version it names under the payload's bag, or the payload refuses whole. Absent: the key alone. */
  readonly chain?: readonly { readonly keyVersion: KeyVersionId; readonly key: ContentKey }[];
}
export const LOCKBOX_REFUSALS = ["lockbox-malformed", "lockbox-other-bag", "lockbox-other-locator", "lockbox-other-version", "key-mismatch"] as const;
export type LockboxRefusalName = (typeof LOCKBOX_REFUSALS)[number];

/** The bytes a lockbox wraps. The wrap itself rides Keyhive's own encryption, with no predecessor reference. */
export function encodeLockboxPayload(payload: LockboxPayload): Uint8Array {
  const key = readContentKey(payload.key);
  if (key === null || readBagLocator(payload.locator) === null || !isWellFormedText(payload.bagId)) throw new TypeError("sealed-records: a lockbox payload names a bag, a locator, a key version and a key");
  if (keyVersionIdOf(key, payload.bagId) !== payload.keyVersion) throw new TypeError("sealed-records: a lockbox payload's key stands as another key version");
  const chain = payload.chain ?? [];
  if (chain.length === 0) return sealedImage(SEALED_LOCKBOX_DOMAIN, utf8Bytes(payload.bagId), hexToBytes(payload.locator), hexToBytes(payload.keyVersion), key);
  const links = new Uint8Array(chain.length * (32 + CONTENT_KEY_LEN));
  try {
    chain.forEach((link, i) => {
      const linked = readContentKey(link.key);
      if (linked === null || keyVersionIdOf(linked, payload.bagId) !== link.keyVersion || link.keyVersion === payload.keyVersion) throw new TypeError("sealed-records: a chained key stands as another key version");
      links.set(hexToBytes(link.keyVersion), i * (32 + CONTENT_KEY_LEN));
      links.set(linked, i * (32 + CONTENT_KEY_LEN) + 32);
    });
    return sealedImage(SEALED_LOCKBOX_CHAIN_DOMAIN, utf8Bytes(payload.bagId), hexToBytes(payload.locator), hexToBytes(payload.keyVersion), key, links);
  } finally { links.fill(0); }
}
/**
 * Read an unwrapped lockbox payload against what the reader expects: the bag, the locator and the key version,
 * each where it already holds one. A reader that opens every lockbox its seat opens holds no bag to expect: it
 * expects the locator and the key version the lockbox's clear part names, and learns the bag from the payload.
 * The key must recompute to the version the payload names under the bag the payload names.
 */
export function readLockboxPayload(bytes: unknown, expect: { readonly bagId?: string; readonly locator?: BagLocator; readonly keyVersion?: KeyVersionId }): { readonly payload: LockboxPayload } | { readonly refusal: LockboxRefusalName } {
  try {
    const chained = readSealedImage(SEALED_LOCKBOX_CHAIN_DOMAIN, bytes, 5);
    const fields = chained ?? readSealedImage(SEALED_LOCKBOX_DOMAIN, bytes, 4);
    if (fields === null || fields[1]!.length !== 32 || fields[2]!.length !== 32 || fields[3]!.length !== CONTENT_KEY_LEN) return { refusal: "lockbox-malformed" };
    let bagId: string;
    try { bagId = new TextDecoder("utf-8", { fatal: true }).decode(fields[0]!); } catch { return { refusal: "lockbox-malformed" }; }
    const locator = hex(fields[1]!) as BagLocator, keyVersion = hex(fields[2]!) as KeyVersionId, key = readContentKey(fields[3]!)!;
    if (!isWellFormedText(bagId)) return { refusal: "lockbox-malformed" };
    if (expect.bagId !== undefined && bagId !== expect.bagId) return { refusal: "lockbox-other-bag" };
    if (expect.locator !== undefined && locator !== expect.locator) return { refusal: "lockbox-other-locator" };
    if (expect.keyVersion !== undefined && keyVersion !== expect.keyVersion) return { refusal: "lockbox-other-version" };
    if (keyVersionIdOf(key, bagId) !== keyVersion) return { refusal: "key-mismatch" };
    if (chained === null) return { payload: { bagId, locator, keyVersion, key } };
    // THE CHAIN: each link a version id and its key, and each key recomputes to its version under this bag.
    const links = fields[4]!;
    const width = 32 + CONTENT_KEY_LEN;
    if (links.length === 0 || links.length % width !== 0) return { refusal: "lockbox-malformed" };
    const chain: { keyVersion: KeyVersionId; key: ContentKey }[] = [];
    for (let at = 0; at < links.length; at += width) {
      const linkVersion = hex(links.subarray(at, at + 32)) as KeyVersionId;
      const linkKey = readContentKey(links.slice(at + 32, at + width))!;
      if (keyVersionIdOf(linkKey, bagId) !== linkVersion || linkVersion === keyVersion) { linkKey.fill(0); for (const l of chain) l.key.fill(0); return { refusal: "key-mismatch" }; }
      chain.push({ keyVersion: linkVersion, key: linkKey });
    }
    links.fill(0);
    return { payload: { bagId, locator, keyVersion, key, chain } };
  } catch { return { refusal: "lockbox-malformed" }; }
}

// ── Row shapes the lockbox store and the chunk index persist ────────────────────────────────────
/** One lockbox as it travels and rests: the wrapped payload, named by what a carrier may read. */
export interface LockboxRecord {
  readonly bag:        BagLocator;
  readonly keyVersion: KeyVersionId;
  /** How the payload got wrapped. Keyhive's own encryption to the bag's key group, with no predecessor. */
  readonly wrap:       "keyhive";
  readonly box:        Uint8Array;
}
/** One row of a durable chunk index: where a sealed value sits in its bag's causal shape. It holds no bag id,
 *  no logical reference and no key: a reader derives the locator from the key, and a carrier keeps the row as it stands. */
export interface SealedChunkIndexEntry {
  readonly bag:        BagLocator;
  readonly keyVersion: KeyVersionId;
  readonly role:       ChunkRole;
  readonly address:    SealedAddress;
  readonly locator:    string;
  readonly parents:    readonly SealedAddress[];
  /** The manifest that listed the value. */
  readonly manifest:   RecordId;
}
/** The index rows one verified manifest yields, in entry order. */
export function indexEntriesOf(manifest: VerifiedRecord<"manifest">): SealedChunkIndexEntry[] {
  if (!VERIFIED.has(manifest) || manifest.kind !== "manifest") throw new TypeError("sealed-records: only a verified manifest yields index rows");
  return manifest.body.entries.map((entry) => ({
    bag: manifest.body.bag, keyVersion: manifest.body.keyVersion, role: entry.role, address: entry.address,
    locator: entry.locator, parents: entry.parents, manifest: manifest.id,
  }));
}
