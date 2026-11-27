/**
 * pointer-address — the ONE reading of a pointer tiddler's content address.
 *
 * A POINTER TIDDLER names bytes held in the content tier and carries none of them (THE BLOB LAW,
 * content-handle.ts). An author writes the address the way TiddlyWiki already spells an external body:
 * `_canonical_uri` names the bytes and `_integrity` names their digest. The house reads three content-address
 * spellings in `_canonical_uri`, each a name for the SHA-256 of the RAW bytes:
 *
 *   · `ni:///sha-256;<base64url>`        RFC 6920, foreign-verifiable, the spelling `_integrity` itself carries;
 *   · `cid:<hex>` · `cid:sha256:<hex>`   the house CAS key under a scheme;
 *   · `lar:///ha.ka.ba/cid/<hex>`        the house's own name for a `cid/` blob (`cidUri`).
 *
 * CONTENT-ADDRESSED, NEVER VERSIONED. A pointer names bytes by their hash alone: no version name, no counter,
 * no clock rides the address, so two islands that never synced agree on what a pointer names.
 *
 * Every field that names the bytes (`_canonical_uri`, `textCid`, `_integrity`) MUST name the SAME digest. A
 * record whose names disagree answers `refused` here, by name, before any byte reads: a reader that verified
 * the bytes against one name while a second name stood beside it would hand back a body the record half denies.
 *
 * An address under another scheme (`https:`, `data:`, `blob:`) names a SOURCE: the house names it and never
 * fetches it (web3 only), and it references no blob.
 *
 * Pure: no `$tw`, no filesystem, no clock. The door, the lazy resolver, the GC reference reader and the meme
 * face all read a pointer through here.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/blob-carriage#/proposed-law
 */

import { cidFromUri } from "./lar-uris.js";
import { hex, niUriSha256FromHex } from "./crypto.js";

/** The code a pointer whose address reads under no spelling the house holds refuses under. */
export const POINTER_ADDRESS_CODE = "pointer-address-malformed";
/** The code a pointer whose names disagree about the digest refuses under. */
export const POINTER_INTEGRITY_CODE = "pointer-integrity-mismatch";
/** The code bytes that hash otherwise than the pointer names refuse under. */
export const POINTER_DIGEST_CODE = "pointer-digest-mismatch";

/** The fields that name a pointer's bytes. A put that moves none of them leaves a standing pointer as it stood. */
export const POINTER_ADDRESS_FIELDS = ["_canonical_uri", "textCid", "_integrity"] as const;

const HEX64 = /^[0-9a-fA-F]{64}$/;
const NI_SHA256 = /^ni:\/\/\/sha-256;([A-Za-z0-9_-]{43})$/;

/** Decode an unpadded base64url string to bytes; null where it holds a character outside the alphabet. */
function base64UrlBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  let bin: string;
  try { bin = atob(padded); } catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A house CAS key read as lowercase SHA-256 hex: bare hex or `sha256:<hex>`; null for any other tag. */
function sha256HexOfKey(key: string): string | null {
  const bare = key.startsWith("sha256:") ? key.slice("sha256:".length) : key;
  return HEX64.test(bare) ? bare.toLowerCase() : null;
}

/** Does this URI spell a content address (as against a web2 source the house names and never fetches)? */
export function isContentAddress(uri: string): boolean {
  return uri.startsWith("ni:") || uri.startsWith("cid:") || cidFromUri(uri) !== null;
}

/**
 * Read the lowercase SHA-256 hex a content address names: an `ni:///sha-256;…` name, a `cid:` key, a
 * `lar:///…/cid/<hash>` name, or a bare CAS key. Null where the text names no SHA-256 digest of 32 bytes
 * (another algorithm, a truncated digest, a web2 source).
 */
export function sha256HexOfAddress(address: string): string | null {
  const ni = NI_SHA256.exec(address);
  if (ni) {
    const bytes = base64UrlBytes(ni[1]!);
    // Canonical or refused: 43 base64url characters carry 258 bits, and a name whose spare bits ride non-zero
    // spells the same digest twice. The re-encoded name must read back as the name given.
    return bytes && bytes.length === 32 && niUriSha256FromHex(hex(bytes)) === address ? hex(bytes) : null;
  }
  if (address.startsWith("cid:")) return sha256HexOfKey(address.slice("cid:".length));
  const named = cidFromUri(address);
  if (named !== null) return sha256HexOfKey(named);
  return sha256HexOfKey(address);
}

/**
 * The CAS key a `_canonical_uri` names, or null where it names a source. A `lar:///…/cid/<hash>` name answers
 * its hash segment as written (a sealed `blake3:` key rides through); an `ni:` or `cid:` name answers the
 * lowercase SHA-256 hex.
 */
export function casKeyOfCanonicalUri(uri: string): string | null {
  return cidFromUri(uri) ?? (isContentAddress(uri) ? sha256HexOfAddress(uri) : null);
}

/** What a record's pointer fields read as. */
export type PointerReading =
  /** The record holds its body inline, or names no body elsewhere. */
  | { readonly kind: "inline" }
  /** A SOURCE: an address under another scheme, named and never fetched. */
  | { readonly kind: "source"; readonly uri: string }
  /** A POINTER: every name agrees on one SHA-256 digest. `cid` reads as the lowercase hex CAS key. */
  | { readonly kind: "address"; readonly cid: string; readonly integrity: string }
  /** The names read under no spelling, or disagree. `why` names the field and the cure. */
  | { readonly kind: "refused"; readonly code: typeof POINTER_ADDRESS_CODE | typeof POINTER_INTEGRITY_CODE; readonly why: string };

const SPELLINGS = "`ni:///sha-256;<base64url>`, `cid:<sha256 hex>` or `lar:///ha.ka.ba/cid/<sha256 hex>`";

/**
 * Read a record's pointer fields into ONE address. A record carrying a `text` string reads `inline` whatever
 * else it carries (the body stands in the record). Otherwise each of `_canonical_uri`, `textCid` and
 * `_integrity` that the record carries must name a SHA-256 digest, and all of them the same one.
 */
export function readPointerAddress(fields: Readonly<Record<string, unknown>>): PointerReading {
  if (typeof fields["text"] === "string") return { kind: "inline" };
  const canonical = typeof fields["_canonical_uri"] === "string" && fields["_canonical_uri"] !== "" ? (fields["_canonical_uri"] as string) : null;
  const textCid = typeof fields["textCid"] === "string" && fields["textCid"] !== "" ? (fields["textCid"] as string) : null;
  const integrity = typeof fields["_integrity"] === "string" && fields["_integrity"] !== "" ? (fields["_integrity"] as string) : null;
  const skinny = fields["_is_skinny"] !== undefined;
  if (canonical === null && textCid === null && integrity === null && !skinny) return { kind: "inline" };
  if (canonical !== null && !isContentAddress(canonical) && textCid === null) return { kind: "source", uri: canonical };

  const named: Array<readonly [field: string, value: string]> = [];
  if (canonical !== null && isContentAddress(canonical)) named.push(["_canonical_uri", canonical]);
  if (textCid !== null) named.push(["textCid", textCid]);
  if (integrity !== null) named.push(["_integrity", integrity]);
  if (named.length === 0) {
    return { kind: "refused", code: POINTER_ADDRESS_CODE, why: `the record marks itself a pointer and names no bytes; name them in \`_canonical_uri\` as ${SPELLINGS}` };
  }
  const read = named.map(([field, value]) => [field, value, sha256HexOfAddress(value)] as const);
  const unread = read.find(([, , digest]) => digest === null);
  if (unread) {
    return { kind: "refused", code: POINTER_ADDRESS_CODE, why: `\`${unread[0]}\` reads "${unread[1]}", which names no SHA-256 digest of 32 bytes; spell the address as ${SPELLINGS}` };
  }
  const cid = read[0]![2]!;
  const other = read.find(([, , digest]) => digest !== cid);
  if (other) {
    return { kind: "refused", code: POINTER_INTEGRITY_CODE, why: `\`${read[0]![0]}\` names ${cid} and \`${other[0]}\` names ${other[2]}; one pointer names one digest, so hash the bytes (\`sha256sum <file>\`) and write that digest in both` };
  }
  return { kind: "address", cid, integrity: niUriSha256FromHex(cid) };
}
