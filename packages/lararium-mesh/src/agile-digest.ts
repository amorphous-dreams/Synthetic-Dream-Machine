/**
 * agile-digest — the algorithm-tagged content-digest grammar (`algorithm:hex`, multihash-style).
 *
 * Every content digest the house writes names its own algorithm, so a `sha256` value and a future
 * scheme sit side by side with no re-key. A digest WITHOUT a tag names no algorithm and is refused:
 * a bare hex string is malformed here, never read as an implied `sha256`.
 *
 *   - `parseDigest`   — `algo:hex` (canonical), the `algo-hex` SRI/`sourceCidOf` spelling, and the
 *                       RFC 9530 `Repr-Digest` field value `sha-256=:<base64>:` all read as one
 *                       `(algo, hex)`. A bare hex, or anything else, throws a named error.
 *   - `digestsEqual`  — parses BOTH sides and compares `(algo, hex)`; a side that does not parse
 *                       reads NOT-equal (never throws on a hot path).
 *   - `formatDigest`  — emits the canonical tagged form `algo:hex`.
 *   - `tagDigest`     — re-spells any accepted form as canonical `algo:hex`.
 *   - `reprDigestOf`  — emits the RFC 9530 `Repr-Digest` field value for the HTTP skins.
 *
 * A stored anchor holding a bare hex therefore matches nothing: the gates that compare against it
 * read it as moved, and the next projection that finds the disk in step records the tagged form.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/agile-digest
 */

/** A parsed content-digest: a non-empty lowercase algorithm tag + its lowercase hex. */
export interface ParsedDigest {
  readonly algo: string;
  readonly hex: string;
}

/** The algorithm tag of the house's sha256 digests — the one RFC 9530 `Repr-Digest` maps to. */
export const SHA256_ALGO = "sha256" as const;

/** A 32-byte (SHA-256) digest's hex: exactly 64 hex chars. */
const SHA256_HEX = /^[0-9a-fA-F]{64}$/;
/** A digest's hex part (even length ≥ 2) — another algorithm may carry another width. */
const HEX_BYTES = /^(?:[0-9a-fA-F]{2})+$/;
/** A valid algorithm tag: lowercase alnum + dashes (blake3, sha512, sha2-256…). */
const ALGO_TAG = /^[a-z0-9][a-z0-9-]*$/;
/** The RFC 9530 `Repr-Digest` field value: `sha-256=:<base64>:` (one member, the sf-binary item). */
const REPR_DIGEST = /^(sha-256)=:([A-Za-z0-9+/]+={0,2}):$/;

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** The lowercase hex of a base64 byte string, or null where the base64 reads torn. Hand-rolled so
 *  the law runs the same in a browser, a plugin VM and node — no `Buffer`, no `atob`. */
function hexOfBase64(b64: string): string | null {
  const body = b64.replace(/=+$/, "");
  if (body.length % 4 === 1) return null;
  let bits = 0;
  let acc = 0;
  let hex = "";
  for (const ch of body) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      hex += ((acc >> bits) & 0xff).toString(16).padStart(2, "0");
    }
  }
  return hex;
}

/** The base64 of a lowercase hex byte string. */
function base64OfHex(hex: string): string {
  let out = "";
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < hex.length; i += 2) {
    acc = (acc << 8) | parseInt(hex.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64[(acc >> bits) & 0x3f];
    }
  }
  if (bits > 0) out += B64[(acc << (6 - bits)) & 0x3f];
  while (out.length % 4 !== 0) out += "=";
  return out;
}

/**
 * Parse a digest string into `(algo, hex)`.
 *
 *   "sha256:ab…"      → { algo: "sha256", hex: "ab…" }   (canonical tagged, `:`)
 *   "sha256-ab…"      → { algo: "sha256", hex: "ab…" }   (SRI / sourceCidOf, `-`)
 *   "sha-256=:q80…=:" → { algo: "sha256", hex: "ab…" }   (RFC 9530 Repr-Digest)
 *   "blake3:cd…"      → { algo: "blake3", hex: "cd…" }   (another scheme rides free)
 *   "ab…64…"          → throws — a bare hex names no algorithm
 *
 * The hex and the algo lowercase. Throws a NAMED error on anything else.
 *
 * The separator split is FIRST-delimiter only, and accepted only when the head reads as an
 * algorithm tag and the tail as hex — hex holds neither `:` nor `-`, so no value mis-splits.
 */
export function parseDigest(digest: string): ParsedDigest {
  if (typeof digest !== "string" || digest.length === 0) {
    throw new TypeError(`parseDigest: empty or non-string digest`);
  }

  // RFC 9530 form: `sha-256=:<base64>:` — the `Repr-Digest` field value an HTTP skin emits.
  const repr = REPR_DIGEST.exec(digest);
  if (repr) {
    const hex = hexOfBase64(repr[2]!);
    if (hex === null || !SHA256_HEX.test(hex)) {
      throw new TypeError(`parseDigest: malformed tagged digest "${digest}"`);
    }
    return { algo: SHA256_ALGO, hex };
  }

  const sepIndex = firstSeparator(digest);
  if (sepIndex > 0) {
    const algo = digest.slice(0, sepIndex).toLowerCase();
    const hex = digest.slice(sepIndex + 1).toLowerCase();
    if (ALGO_TAG.test(algo) && HEX_BYTES.test(hex)) {
      return { algo, hex };
    }
    throw new TypeError(`parseDigest: malformed tagged digest "${digest}"`);
  }

  if (HEX_BYTES.test(digest)) {
    throw new TypeError(`parseDigest: bare hex "${digest.slice(0, 16)}…" names no algorithm — write it tagged (\`sha256:<hex>\`)`);
  }
  throw new TypeError(`parseDigest: not a tagged digest "${digest}"`);
}

/** The index of the first `:` or `-` separator, or -1 when the value carries neither. */
function firstSeparator(s: string): number {
  const colon = s.indexOf(":");
  const dash = s.indexOf("-");
  if (colon < 0) return dash;
  if (dash < 0) return colon;
  return Math.min(colon, dash);
}

/** Emit the canonical tagged form `algo:hex`. Lowercases both; validates the
 *  algo tag and the hex so a producer never writes a malformed value. */
export function formatDigest(algo: string, hex: string): string {
  const a = algo.toLowerCase();
  const h = hex.toLowerCase();
  if (!ALGO_TAG.test(a)) throw new TypeError(`formatDigest: bad algorithm tag "${algo}"`);
  if (!HEX_BYTES.test(h)) throw new TypeError(`formatDigest: bad hex "${hex}"`);
  return `${a}:${h}`;
}

/**
 * The RFC 9530 `Repr-Digest` field value for a sha256 digest in any of its tagged spellings —
 * `sha-256=:<base64>:`. An HTTP skin emits it beside the `ETag`, so a client that speaks the
 * standard field verifies the body without learning the house's tag grammar. Only sha256 carries a
 * registered RFC 9530 algorithm key here; another algorithm refuses loud.
 */
export function reprDigestOf(digest: string): string {
  const { algo, hex } = parseDigest(digest);
  if (algo !== SHA256_ALGO) throw new TypeError(`reprDigestOf: only sha-256 carries a Repr-Digest key here (got "${algo}")`);
  return `sha-256=:${base64OfHex(hex)}:`;
}

/** Re-spell a digest in any accepted form as canonical `algo:hex` (idempotent on canonical input).
 *  A bare hex throws, as `parseDigest` does. */
export function tagDigest(digest: string): string {
  const { algo, hex } = parseDigest(digest);
  return formatDigest(algo, hex);
}

/**
 * Two digests name the SAME content iff both parse and carry the same algorithm and the same hex,
 * whichever accepted spelling each rides in. A side that does not parse — a bare hex among them —
 * reads NOT-equal and never throws: a comparator on a hot path surfaces a mismatch, it does not crash
 * ingest. A caller that wants the refusal named calls `parseDigest`.
 */
export function digestsEqual(a: string, b: string): boolean {
  let pa: ParsedDigest;
  let pb: ParsedDigest;
  try { pa = parseDigest(a); } catch { return false; }
  try { pb = parseDigest(b); } catch { return false; }
  return pa.algo === pb.algo && pa.hex === pb.hex;
}
