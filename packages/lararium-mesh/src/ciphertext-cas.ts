/**
 * ciphertext-cas — a PRIVATE BODY on the content-addressed store: sealed, addressed over its ciphertext.
 *
 * A private body leaves the CRDT as one sealed value (`sealed-chunk`): randomized authenticated encryption
 * under its bag's versioned content key, bound to the bag, the key version, the role `blob` and the body's own
 * plaintext digest. The pointer in the wiki names that plaintext digest and never a ciphertext address; the
 * bag's manifest leads from the digest to the address.
 *
 * VERIFY ⊥ READ. The address reads `blake3:` over every sealed byte, so a carrier that holds no key recomputes
 * it from the bytes alone (`verifyCiphertextCid`). That check proves the bytes match the address and nothing
 * more. Reading takes the content key, an AUTHORIZED address, and the plaintext digest the pointer names: the
 * opener answers the whole plaintext or one named refusal, and it refuses a body whose opened bytes hash to
 * another digest than the one asked for.
 *
 * NO CONVERGENT SEAL. Sealing one body twice yields two unlike values under two unlike addresses. No key
 * derives from content or from a Nexus secret, so no holder confirms a guessed body against a held address.
 *
 * Platform-blind: `@noble/hashes`, `@noble/ciphers`.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store · lar:///ha.ka.ba/lararium/mesh/content-resolution#/cad-storage
 */
import { blake3 } from "@noble/hashes/blake3.js";
import { digestsEqual } from "./agile-digest.js";
import { hexToBytes, sha256HexBytesSync, type RandomProvider } from "./crypto.js";
import {
  SEALED_ADDRESS_ALGO, isWellFormedText, keyVersionIdOf, openChunk, readContentKey, sealChunk, sealedAddressOf,
  type AuthorizedAddress, type ContentKey, type KeyVersionId, type OpenRefusalName, type SealContext,
  type SealRefusalName, type SealedAddress,
} from "./sealed-chunk.js";

/** The multihash algorithm tag a ciphertext address carries (agile-digest canonical form `blake3:<hex>`). */
export const CIPHERTEXT_CID_ALGO = SEALED_ADDRESS_ALGO;

/** A per-Nexus convergence secret rides exactly 32 bytes. */
export const CONVERGENCE_SECRET_LEN = 32 as const;

/**
 * Guard a 32-byte secret: a stray width never passes (fail-closed at the boundary). A per-Nexus convergence
 * keyring guards every epoch secret through this ONE width check, never two drifting copies.
 */
export function require32(bytes: Uint8Array, what: string): Uint8Array {
  if (!(bytes instanceof Uint8Array) || bytes.length !== CONVERGENCE_SECRET_LEN) {
    throw new TypeError(`ciphertext-cas: ${what} MUST be exactly ${CONVERGENCE_SECRET_LEN} bytes, got ${bytes?.length}`);
  }
  return bytes;
}

/**
 * A keyed digest of a body under a per-Nexus convergence secret: `BLAKE3(plaintext, key = nexusSecret)`.
 * NOTHING SEALS OR OPENS WITH IT. No sealed value derives from a convergence secret; this digest stands for
 * the convergence keyring's own `readCapForEpoch` alone and leaves the tree with that reader.
 */
export function deriveMessageKey(plaintext: Uint8Array, nexusSecret: Uint8Array): Uint8Array {
  require32(nexusSecret, "nexusSecret");
  return blake3(plaintext, { key: nexusSecret, dkLen: CONVERGENCE_SECRET_LEN });
}

/** The address of ciphertext bytes: `blake3:<hex>` over every byte. A carrier recomputes it holding no key. */
export function ciphertextCid(ciphertext: Uint8Array): string {
  return sealedAddressOf(ciphertext);
}

/**
 * THE BLIND VERIFY. Recompute the address and compare it to the claimed one: the check a carrier runs over a
 * body it can never read. False, never a throw, on a malformed or untagged address. It proves the bytes match
 * the address; it proves nothing about whether the address belongs where a reader found it.
 */
export function verifyCiphertextCid(ciphertext: Uint8Array, cid: string): boolean {
  try { return digestsEqual(ciphertextCid(ciphertext), cid); } catch { return false; }
}

/** One bag's content key at one key version, with the bag it serves. */
export interface PrivateBodyKey {
  readonly bagId: string;
  readonly key:   ContentKey;
}

/** A sealed private body: what a carrier holds (`cid`, `ciphertext`) and what its pointer and manifest name. */
export interface SealedPrivateBody {
  /** `blake3:<hex>` over the ciphertext: the address a carrier stores, serves and verifies by. */
  readonly cid:        SealedAddress;
  readonly ciphertext: Uint8Array;
  /** The key version the body sealed under. */
  readonly keyVersion: KeyVersionId;
  /** The body's logical reference: lower-case hex SHA-256 of the plaintext, the digest its pointer names. */
  readonly ref:        string;
}

const REF = /^[0-9a-f]{64}$/;
const blobContext = (under: PrivateBodyKey, keyVersion: KeyVersionId, ref: string): SealContext =>
  ({ bagId: under.bagId, keyVersion, role: "blob", logicalRef: hexToBytes(ref) });

export type SealPrivateBodyResult = { readonly body: SealedPrivateBody } | { readonly refusal: SealRefusalName };

/** Seal one private body under its bag's content key. Two seals of one body share no byte past the header's
 *  version hint and no address. */
export function sealPrivateBody(plaintext: Uint8Array, under: PrivateBodyKey, random?: Pick<RandomProvider, "getRandomValues">): SealPrivateBodyResult {
  const key = readContentKey(under?.key);
  if (key === null) return { refusal: "key-malformed" };
  if (!isWellFormedText(under.bagId)) return { refusal: "context-malformed" };
  if (!(plaintext instanceof Uint8Array)) return { refusal: "plaintext-malformed" };
  const keyVersion = keyVersionIdOf(key, under.bagId);
  const ref = sha256HexBytesSync(plaintext);
  const sealed = sealChunk({ key, context: blobContext(under, keyVersion, ref), plaintext, ...(random ? { random } : {}) });
  if (!("chunk" in sealed)) return sealed;
  return { body: { cid: sealed.chunk.address, ciphertext: sealed.chunk.sealed, keyVersion, ref } };
}

export const OPEN_PRIVATE_BODY_REFUSALS = [
  "reference-malformed",    // the pointer's digest reads as no SHA-256
  "plaintext-mismatch",     // the body opened, and its bytes hash to another digest than the pointer names
] as const;
export type OpenPrivateBodyRefusalName = OpenRefusalName | (typeof OPEN_PRIVATE_BODY_REFUSALS)[number];
export type OpenPrivateBodyResult = { readonly plaintext: Uint8Array } | { readonly refusal: OpenPrivateBodyRefusalName };

/**
 * Open one private body: the content key, the plaintext digest its pointer names, and an authorized address.
 * Answers the whole plaintext or one named refusal; altered, swapped, truncated and re-ordered bytes all
 * refuse, and so does a body that opens to other bytes than the pointer names.
 */
export function openPrivateBody(args: {
  readonly ciphertext: Uint8Array; readonly under: PrivateBodyKey; readonly ref: string; readonly authorized: AuthorizedAddress;
}): OpenPrivateBodyResult {
  const key = readContentKey(args.under?.key);
  if (key === null) return { refusal: "key-malformed" };
  if (!isWellFormedText(args.under.bagId)) return { refusal: "context-malformed" };
  if (typeof args.ref !== "string" || !REF.test(args.ref)) return { refusal: "reference-malformed" };
  const opened = openChunk({ key, context: blobContext(args.under, keyVersionIdOf(key, args.under.bagId), args.ref), sealed: args.ciphertext, authorized: args.authorized });
  if (!("plaintext" in opened)) return opened;
  if (sha256HexBytesSync(opened.plaintext) !== args.ref) return { refusal: "plaintext-mismatch" };
  return opened;
}
