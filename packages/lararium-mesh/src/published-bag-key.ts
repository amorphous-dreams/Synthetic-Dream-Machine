/**
 * published-bag-key — a public or crossroads bag's content key, which rides the bag's published lookup.
 *
 * R1 (operator, 2026-10-12): every store besides the live wiki in memory rests sealed, "and public/crossroads, etc,
 * available as invitees have the 'public keys or lookups'". A public bag publishes ONE lookup beside its charter: 32
 * random bytes, read as text by `publishedLookupText`. Its content key derives from that lookup and the bag's own id
 * alone, so whoever holds the lookup opens every value of the bag, and a holder of no lookup opens nothing. The bag
 * rests sealed under that key in the one sealed-value format (`sealed-chunk`), so a disk taken off the shelf reads no
 * clear byte of it, while every reader the bag published to reads it with no lockbox, no session and no face.
 *
 * A published key grants reading, never writing: it signs nothing and mints no record. Who may write a public bag
 * stays the bag's own write law. A lookup leaves only with the bag's publication; a private bag never names one.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64UrlDecode, base64UrlEncode, defaultCryptoProvider, hexToBytes, utf8Bytes, type RandomProvider } from "./crypto.js";
import {
  authorizeAddress, keyVersionIdOf, openChunk, readContentKey, sealChunk, sealedAddressOf, sealedImage,
  type ChunkRole, type ContentKey, type OpenResult, type SealResult,
} from "./sealed-chunk.js";

export const PUBLISHED_LOOKUP_LEN = 32;
const LOOKUP_PREFIX = "lares-published-lookup:";
const PUBLISHED_KEY_INFO = "lares-published-bag-key";

declare const PUBLISHED_LOOKUP: unique symbol;
/** A public bag's published lookup: 32 bytes its publication hands every reader. */
export type PublishedLookup = Uint8Array & { readonly [PUBLISHED_LOOKUP]: true };

/** Mint a fresh lookup for a bag about to publish. */
export function mintPublishedLookup(random: Pick<RandomProvider, "getRandomValues"> = defaultCryptoProvider): PublishedLookup {
  return random.getRandomValues(new Uint8Array(PUBLISHED_LOOKUP_LEN)) as PublishedLookup;
}

/** The lookup as its charter publishes it. */
export function publishedLookupText(lookup: Uint8Array): string { return LOOKUP_PREFIX + base64UrlEncode(lookup); }

/** Read a published lookup off its text (or its bytes); null: no lookup of this format. */
export function readPublishedLookup(value: unknown): PublishedLookup | null {
  try {
    const bytes = typeof value === "string"
      ? (value.startsWith(LOOKUP_PREFIX) ? base64UrlDecode(value.slice(LOOKUP_PREFIX.length)) : null)
      : value instanceof Uint8Array ? Uint8Array.from(value) : null;
    return bytes !== null && bytes.length === PUBLISHED_LOOKUP_LEN ? (bytes as PublishedLookup) : null;
  } catch { return null; }
}

/** The public bag's content key: HKDF-SHA-256 over the lookup, bound to the bag's own id. */
export function publishedBagKey(bagId: string, lookup: Uint8Array): ContentKey {
  const read = readPublishedLookup(lookup);
  if (read === null) throw new TypeError("published-bag-key: a lookup rides exactly 32 bytes");
  const key = readContentKey(hkdf(sha256, read, undefined, sealedImage(PUBLISHED_KEY_INFO, utf8Bytes(bagId)), 32));
  if (key === null) throw new TypeError("published-bag-key: the derived key reads malformed");
  return key;
}

const contextOf = (bagId: string, key: ContentKey, role: ChunkRole, ref: string) =>
  ({ bagId, keyVersion: keyVersionIdOf(key, bagId), role, logicalRef: hexToBytes(ref) });

/** Seal one value of a public bag under its published key. */
export function sealPublished(args: { readonly bagId: string; readonly lookup: Uint8Array; readonly role: ChunkRole; readonly ref: string; readonly plaintext: Uint8Array;
  readonly random?: Pick<RandomProvider, "getRandomValues"> }): SealResult {
  const key = publishedBagKey(args.bagId, args.lookup);
  return sealChunk({ key, context: contextOf(args.bagId, key, args.role, args.ref), plaintext: args.plaintext, ...(args.random ? { random: args.random } : {}) });
}

/** Open one value of a public bag with its published lookup alone. The value's address reads off its own bytes, as
 *  the rest this reader holds hands them. */
export function openPublished(args: { readonly bagId: string; readonly lookup: Uint8Array; readonly role: ChunkRole; readonly ref: string; readonly sealed: Uint8Array }): OpenResult {
  const key = publishedBagKey(args.bagId, args.lookup);
  const authorized = authorizeAddress(sealedAddressOf(args.sealed), "own-receipt");
  if (authorized === null) return { refusal: "address-unauthorized" } as OpenResult;
  return openChunk({ key, context: contextOf(args.bagId, key, args.role, args.ref), sealed: args.sealed, authorized });
}
