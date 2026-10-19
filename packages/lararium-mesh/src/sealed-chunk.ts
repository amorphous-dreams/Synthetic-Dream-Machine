/**
 * sealed-chunk — THE SEALED VALUE: the one private-byte format of the sealed store.
 *
 * Every private byte outside the live wiki and the operator's projected files rests as a sealed value: the same
 * bytes on a reader's own disk and in the hands of a carrier that holds no key. A sealed value takes RANDOMIZED
 * authenticated encryption under its bag's versioned content key and binds four facts as associated data: the
 * bag, the key version, the role and the logical reference. Its address hashes the ciphertext.
 *
 * THE BYTES
 *   0   4   the format mark: SHA-256(`sealed-chunk` name)[0..4]
 *   4   16  the version hint: the first sixteen bytes of the key version id
 *   20  32  the salt, random per value
 *   52  32  the commitment
 *   84  …   segments: up to 65,536 plaintext bytes each under ChaCha20-Poly1305, 16-byte tag
 *
 *   context digest = SHA-256(image(name, bag id, key version id, role, logical reference))
 *   body key       = HKDF-SHA-256(content key, salt, image(key name, context digest))
 *   commitment     = HKDF-SHA-256(content key, salt, image(commitment name, context digest))
 *   segment nonce  = eleven-byte big-endian counter ‖ one byte: 1 on the final segment, 0 elsewhere
 *   address        = `blake3:` + hex(BLAKE3(every sealed byte))
 *
 * WHY EACH PART STANDS
 *   · The salt makes the body key single-use, so a counter nonce never repeats under one key and writers who
 *     share a content key share no counter.
 *   · Poly1305 commits to no key. The commitment binds key, salt and context through a collision-resistant
 *     derivation, and the opener checks it BEFORE any segment opens: no sealed value opens under two keys or
 *     two contexts.
 *   · The final byte of the nonce names the last segment, so a cut sequence never opens as a whole body
 *     (the STREAM framing age uses).
 *   · The key version id commits its key, so a reader proves the key in hand against the version it named
 *     with no byte of the value.
 *
 * AN OPENER ANSWERS PLAINTEXT OR ONE NAMED REFUSAL. Never a boolean, never partial bytes, never a throw for
 * bytes of any shape. It takes an AUTHORIZED address and never a bare one: the caller states which source
 * vouched for the address.
 *
 * Pure but for the salt it draws. Platform-blind: `@noble/hashes`, `@noble/ciphers`.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-sealed-value
 */
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { digestsEqual, formatDigest } from "./agile-digest.js";
import { constantTimeBytesEqual, defaultCryptoProvider, hex, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import {
  CONTENT_KEY_ID_INFO, SEALED_CHUNK_COMMITMENT_INFO, SEALED_CHUNK_DOMAIN, SEALED_CHUNK_KEY_INFO,
} from "./domains.js";

// ── Widths ──────────────────────────────────────────────────────────────────────────────────────
export const CONTENT_KEY_LEN = 32;
export const SEALED_MARK_LEN = 4;
export const SEALED_HINT_LEN = 16;
export const SEALED_SALT_LEN = 32;
export const SEALED_COMMITMENT_LEN = 32;
export const SEALED_HEADER_LEN = SEALED_MARK_LEN + SEALED_HINT_LEN + SEALED_SALT_LEN + SEALED_COMMITMENT_LEN;
export const SEALED_TAG_LEN = 16;
/** Plaintext bytes one segment holds. Every segment but the last holds exactly this many. */
export const SEALED_SEGMENT_LEN = 65_536;
const SEALED_SEGMENT_SEALED_LEN = SEALED_SEGMENT_LEN + SEALED_TAG_LEN;
/** A sealed value holds fewer than 2^88 segments: the counter rides eleven bytes. */
const MAX_SEGMENT_INDEX = 2n ** 88n - 1n;

/** The algorithm tag a sealed address carries. */
export const SEALED_ADDRESS_ALGO = "blake3" as const;

/** The format mark, derived from the format's own name. */
export const SEALED_CHUNK_MARK: Uint8Array = sha256(utf8Bytes(SEALED_CHUNK_DOMAIN)).slice(0, SEALED_MARK_LEN);

// ── Names ───────────────────────────────────────────────────────────────────────────────────────
/** What a sealed value stands as inside its bag. */
export const CHUNK_ROLES = ["change", "checkpoint", "blob", "record"] as const;
export type ChunkRole = (typeof CHUNK_ROLES)[number];
export function isChunkRole(value: unknown): value is ChunkRole {
  return typeof value === "string" && (CHUNK_ROLES as readonly string[]).includes(value);
}

declare const CONTENT_KEY: unique symbol;
declare const KEY_VERSION_ID: unique symbol;
declare const SEALED_ADDRESS: unique symbol;
/** One bag's content key at one key version: 32 random bytes. */
export type ContentKey = Uint8Array & { readonly [CONTENT_KEY]: true };
/** A key version's id: 64 lower-case hex. It commits the content key and the bag's id. */
export type KeyVersionId = string & { readonly [KEY_VERSION_ID]: true };
/** A sealed value's address: `blake3:` and 64 lower-case hex over every sealed byte. */
export type SealedAddress = string & { readonly [SEALED_ADDRESS]: true };

const HEX64 = /^[0-9a-f]{64}$/;
const ADDRESS = /^blake3:[0-9a-f]{64}$/;

/** Read 32 bytes as a content key, or null. The copy belongs to the caller that asked. */
export function readContentKey(value: unknown): ContentKey | null {
  try { return value instanceof Uint8Array && value.length === CONTENT_KEY_LEN ? (Uint8Array.from(value) as ContentKey) : null; }
  catch { return null; }
}
/** Mint a content key from 32 fresh random bytes. */
export function mintContentKey(random: Pick<RandomProvider, "getRandomValues"> = defaultCryptoProvider): ContentKey {
  return random.getRandomValues(new Uint8Array(CONTENT_KEY_LEN)) as Uint8Array as ContentKey;
}
export function readKeyVersionId(value: unknown): KeyVersionId | null {
  return typeof value === "string" && HEX64.test(value) ? (value as KeyVersionId) : null;
}
export function readSealedAddress(value: unknown): SealedAddress | null {
  return typeof value === "string" && ADDRESS.test(value) ? (value as SealedAddress) : null;
}

/** Non-empty text that survives its own UTF-8 encoding. A lone surrogate encodes as the replacement character,
 *  so two unlike strings would share one image; such text names nothing here. */
export function isWellFormedText(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try { return new TextDecoder("utf-8", { fatal: true }).decode(utf8Bytes(value)) === value; } catch { return false; }
}

// ── The canonical image ─────────────────────────────────────────────────────────────────────────
const MAX_FIELD = 0xffff_ffff;

/** The one encoding of the sealed store: the name first, then each field as a four-byte big-endian length
 *  followed by its bytes. No two field tuples share an image. */
export function sealedImage(name: string, ...fields: readonly Uint8Array[]): Uint8Array {
  const parts = [utf8Bytes(name), ...fields];
  let size = 0;
  for (const part of parts) {
    if (part.length > MAX_FIELD) throw new RangeError("sealed-chunk: a field outgrew its length prefix");
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

/** Read an image back into its fields: the name must lead, and exactly `count` fields must follow with no
 *  byte left over. Null otherwise. An image may carry a key, so a reading that answers null zero-fills every
 *  field it cut before it returns: a refused image leaves no copy of its bytes behind. */
export function readSealedImage(name: string, bytes: unknown, count: number): Uint8Array[] | null {
  const parts: Uint8Array[] = [];
  const refuse = (): null => { for (const part of parts) part.fill(0); return null; };
  try {
    if (!(bytes instanceof Uint8Array)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 0;
    while (at < bytes.length) {
      if (at + 4 > bytes.length) return refuse();
      const size = view.getUint32(at, false);
      if (at + 4 + size > bytes.length) return refuse();
      parts.push(bytes.slice(at + 4, at + 4 + size));
      at += 4 + size;
    }
    if (parts.length !== count + 1) return refuse();
    const lead = utf8Bytes(name);
    if (!constantTimeBytesEqual(parts[0]!, lead)) return refuse();
    return parts.slice(1);
  } catch { return refuse(); }
}

/** The four facts every sealed value binds. A reader supplies all four before any byte opens. */
export interface SealContext {
  /** The bag's own id, as its readers know it. Never the carrier's locator. */
  readonly bagId:      string;
  readonly keyVersion: KeyVersionId;
  readonly role:       ChunkRole;
  /** What the value stands for inside the bag: a change id, a checkpoint id, a plaintext digest, a record id. */
  readonly logicalRef: Uint8Array;
}

function readContext(value: unknown): SealContext | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const { bagId, keyVersion, role, logicalRef } = value as SealContext;
    if (!isWellFormedText(bagId)) return null;
    if (readKeyVersionId(keyVersion) === null || !isChunkRole(role)) return null;
    if (!(logicalRef instanceof Uint8Array) || logicalRef.length === 0) return null;
    return { bagId, keyVersion, role, logicalRef: Uint8Array.from(logicalRef) };
  } catch { return null; }
}

/** The context digest: SHA-256 over the canonical image of the four facts. Throws on a malformed context. */
export function contextDigest(context: SealContext): Uint8Array {
  const read = readContext(context);
  if (read === null) throw new TypeError("sealed-chunk: a context names a bag, a key version, a role and a logical reference");
  return digestOfContext(read);
}
function digestOfContext(c: SealContext): Uint8Array {
  return sha256(sealedImage(SEALED_CHUNK_DOMAIN, utf8Bytes(c.bagId), hexToBytes(c.keyVersion), utf8Bytes(c.role), c.logicalRef));
}

/** The id of the key version `key` stands as in `bagId`. Whoever holds the key recomputes it. */
export function keyVersionIdOf(key: ContentKey, bagId: string): KeyVersionId {
  if (readContentKey(key) === null) throw new TypeError("sealed-chunk: a content key rides exactly 32 bytes");
  if (!isWellFormedText(bagId)) throw new TypeError("sealed-chunk: a key version id binds a bag id of well-formed text");
  return hex(hkdf(sha256, key, undefined, sealedImage(CONTENT_KEY_ID_INFO, utf8Bytes(bagId)), 32)) as KeyVersionId;
}

/** A sealed value's address: BLAKE3 over every sealed byte. A holder of no key recomputes it. */
export function sealedAddressOf(sealed: Uint8Array): SealedAddress {
  return formatDigest(SEALED_ADDRESS_ALGO, hex(blake3(sealed))) as SealedAddress;
}

// ── The authorized address ──────────────────────────────────────────────────────────────────────
/** The sources that may vouch for an address: a verified manifest entry; a receipt the reader wrote for a
 *  value it sealed with its own hands; and a record that carries its own sealed part, where the context
 *  binds the part to the record's id and the signature inside it answers for the rest. */
export const ADDRESS_SOURCES = ["manifest-entry", "own-receipt", "record-part"] as const;
export type AddressSource = (typeof ADDRESS_SOURCES)[number];

const AUTHORIZED = new WeakSet<object>();
/** An address some named source vouched for. Built by `authorizeAddress` alone. */
export interface AuthorizedAddress { readonly address: SealedAddress; readonly source: AddressSource }

/** State which source vouched for `address`. The caller answers for that statement; a census of the call
 *  sites keeps the answerers few. Null for a malformed address or an unknown source. */
export function authorizeAddress(address: unknown, source: AddressSource): AuthorizedAddress | null {
  const read = readSealedAddress(address);
  if (read === null || !(ADDRESS_SOURCES as readonly string[]).includes(source)) return null;
  const out = Object.freeze({ address: read, source });
  AUTHORIZED.add(out);
  return out;
}

// ── Results ─────────────────────────────────────────────────────────────────────────────────────
export const SEAL_REFUSALS = ["key-malformed", "context-malformed", "key-mismatch", "plaintext-malformed", "body-too-long"] as const;
export type SealRefusalName = (typeof SEAL_REFUSALS)[number];

export const OPEN_REFUSALS = [
  "key-malformed",          // the key in hand rides no 32 bytes
  "context-malformed",      // the reader named no whole context
  "address-unauthorized",   // no named source vouched for the address
  "envelope-malformed",     // too short to hold a header and one segment
  "address-mismatch",       // the bytes do not hash to the authorized address: altered or swapped
  "format-unknown",         // sealed bytes of a format this reader does not hold
  "key-mismatch",           // the key in hand does not belong to the key version the reader named
  "version-mismatch",       // the value's version hint names another key version
  "context-mismatch",       // the commitment fails: another bag, role or reference, or another key
  "sequence-broken",        // a segment fails its tag: altered, out of order, repeated, cut inside, trailing
  "truncated",              // the bytes end on a whole segment that names itself as not the last
] as const;
export type OpenRefusalName = (typeof OPEN_REFUSALS)[number];

export interface SealedChunk { readonly address: SealedAddress; readonly sealed: Uint8Array }
export type SealResult = { readonly chunk: SealedChunk } | { readonly refusal: SealRefusalName };
export type OpenResult = { readonly plaintext: Uint8Array } | { readonly refusal: OpenRefusalName };

// ── Derivations ─────────────────────────────────────────────────────────────────────────────────
function bodyKeyOf(key: ContentKey, salt: Uint8Array, digest: Uint8Array): Uint8Array {
  return hkdf(sha256, key, salt, sealedImage(SEALED_CHUNK_KEY_INFO, digest), 32);
}
function commitmentOf(key: ContentKey, salt: Uint8Array, digest: Uint8Array): Uint8Array {
  return hkdf(sha256, key, salt, sealedImage(SEALED_CHUNK_COMMITMENT_INFO, digest), SEALED_COMMITMENT_LEN);
}
function segmentNonce(index: bigint, final: boolean): Uint8Array {
  const nonce = new Uint8Array(12);
  let rest = index;
  for (let i = 10; i >= 0; i--) { nonce[i] = Number(rest & 0xffn); rest >>= 8n; }
  nonce[11] = final ? 1 : 0;
  return nonce;
}

// ── Seal ────────────────────────────────────────────────────────────────────────────────────────
/**
 * Seal `plaintext` as one sealed value under `key`, bound to `context`. The key must stand as the key version
 * the context names. Two seals of one body yield two unlike values under two unlike addresses.
 */
export function sealChunk(args: {
  readonly key: ContentKey; readonly context: SealContext; readonly plaintext: Uint8Array;
  readonly random?: Pick<RandomProvider, "getRandomValues">;
}): SealResult {
  const key = readContentKey(args.key);
  if (key === null) return { refusal: "key-malformed" };
  const context = readContext(args.context);
  if (context === null) return { refusal: "context-malformed" };
  if (!(args.plaintext instanceof Uint8Array)) return { refusal: "plaintext-malformed" };
  if (keyVersionIdOf(key, context.bagId) !== context.keyVersion) return { refusal: "key-mismatch" };
  const plaintext = args.plaintext;
  const segments = plaintext.length === 0 ? 1 : Math.ceil(plaintext.length / SEALED_SEGMENT_LEN);
  if (BigInt(segments) - 1n > MAX_SEGMENT_INDEX) return { refusal: "body-too-long" };

  const digest = digestOfContext(context);
  const salt = (args.random ?? defaultCryptoProvider).getRandomValues(new Uint8Array(SEALED_SALT_LEN));
  const bodyKey = bodyKeyOf(key, salt, digest);
  const sealed = new Uint8Array(SEALED_HEADER_LEN + plaintext.length + segments * SEALED_TAG_LEN);
  sealed.set(SEALED_CHUNK_MARK, 0);
  sealed.set(hexToBytes(context.keyVersion).subarray(0, SEALED_HINT_LEN), SEALED_MARK_LEN);
  sealed.set(salt, SEALED_MARK_LEN + SEALED_HINT_LEN);
  sealed.set(commitmentOf(key, salt, digest), SEALED_MARK_LEN + SEALED_HINT_LEN + SEALED_SALT_LEN);
  let at = SEALED_HEADER_LEN;
  for (let i = 0; i < segments; i++) {
    const part = plaintext.subarray(i * SEALED_SEGMENT_LEN, Math.min(plaintext.length, (i + 1) * SEALED_SEGMENT_LEN));
    const out = chacha20poly1305(bodyKey, segmentNonce(BigInt(i), i === segments - 1), digest).encrypt(part);
    sealed.set(out, at);
    at += out.length;
  }
  bodyKey.fill(0);
  return { chunk: { address: sealedAddressOf(sealed), sealed } };
}

// ── Open ────────────────────────────────────────────────────────────────────────────────────────
function tryOpen(bodyKey: Uint8Array, index: bigint, final: boolean, digest: Uint8Array, segment: Uint8Array): Uint8Array | null {
  try { return chacha20poly1305(bodyKey, segmentNonce(index, final), digest).decrypt(segment); }
  catch { return null; }
}

/**
 * Open one sealed value. The checks run in the order the refusals stand listed, and the commitment check
 * precedes every decryption. Answers the whole plaintext or exactly one named refusal.
 */
export function openChunk(args: {
  readonly key: ContentKey; readonly context: SealContext; readonly sealed: Uint8Array; readonly authorized: AuthorizedAddress;
}): OpenResult {
  try {
    const key = readContentKey(args.key);
    if (key === null) return { refusal: "key-malformed" };
    const context = readContext(args.context);
    if (context === null) return { refusal: "context-malformed" };
    if (typeof args.authorized !== "object" || args.authorized === null || !AUTHORIZED.has(args.authorized)) return { refusal: "address-unauthorized" };
    if (!(args.sealed instanceof Uint8Array) || args.sealed.length < SEALED_HEADER_LEN + SEALED_TAG_LEN) return { refusal: "envelope-malformed" };
    const sealed = args.sealed;
    if (!digestsEqual(sealedAddressOf(sealed), args.authorized.address)) return { refusal: "address-mismatch" };
    if (!constantTimeBytesEqual(sealed.subarray(0, SEALED_MARK_LEN), SEALED_CHUNK_MARK)) return { refusal: "format-unknown" };
    if (keyVersionIdOf(key, context.bagId) !== context.keyVersion) return { refusal: "key-mismatch" };
    const hintAt = SEALED_MARK_LEN, saltAt = hintAt + SEALED_HINT_LEN, commitAt = saltAt + SEALED_SALT_LEN;
    if (!constantTimeBytesEqual(sealed.subarray(hintAt, saltAt), hexToBytes(context.keyVersion).subarray(0, SEALED_HINT_LEN))) return { refusal: "version-mismatch" };
    const salt = sealed.subarray(saltAt, commitAt);
    const digest = digestOfContext(context);
    if (!constantTimeBytesEqual(sealed.subarray(commitAt, SEALED_HEADER_LEN), commitmentOf(key, salt, digest))) return { refusal: "context-mismatch" };

    const bodyKey = bodyKeyOf(key, salt, digest);
    try {
      const body = sealed.subarray(SEALED_HEADER_LEN);
      const out = new Uint8Array(body.length);
      let written = 0, at = 0, index = 0n;
      for (;;) {
        const size = Math.min(SEALED_SEGMENT_SEALED_LEN, body.length - at);
        if (size < SEALED_TAG_LEN) return { refusal: "sequence-broken" };
        const segment = body.subarray(at, at + size);
        const last = at + size === body.length;
        if (!last) {
          const part = tryOpen(bodyKey, index, false, digest, segment);
          if (part === null) return { refusal: "sequence-broken" };
          out.set(part, written); written += part.length;
          at += size; index += 1n;
          continue;
        }
        const part = tryOpen(bodyKey, index, true, digest, segment);
        if (part === null) {
          // A whole segment that opens as NOT the last one names a cut sequence; anything else names a broken one.
          return { refusal: tryOpen(bodyKey, index, false, digest, segment) !== null ? "truncated" : "sequence-broken" };
        }
        // An empty final segment stands only where the whole body holds nothing.
        if (part.length === 0 && index !== 0n) return { refusal: "sequence-broken" };
        out.set(part, written); written += part.length;
        return { plaintext: out.slice(0, written) };
      }
    } finally { bodyKey.fill(0); }
  } catch { return { refusal: "envelope-malformed" }; }
}
