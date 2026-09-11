/**
 * agile-digest — the algorithm-tagged content-digest grammar (`algorithm:hex`,
 * multihash-style), the migration shore that lets a stored bare-hex `sha256`
 * digest COEXIST with a future tagged scheme — no flag-day, no mass re-key.
 *
 * The stack already content-addresses (crypto.ts `carrierHash`, `cidV1Sha256`,
 * `sourceCidOf`'s `sha256-<hex>`, the CAS `cid`); what it lacks is AGILITY — the
 * digests emit BARE hex with no algorithm tag, so an old `sha256` value can never
 * sit beside a new scheme. This module supplies the one narrow grammar every
 * carrier digest can adopt incrementally:
 *
 *   - `parseDigest`   — a bare 64-char hex reads as implicit `sha256` (back-compat
 *                       with every stored value); `algo:hex` OR the legacy
 *                       `algo-hex` (SRI/`sourceCidOf` form) reads TAGGED; the RFC 9530
 *                       `Repr-Digest` field value `sha-256=:<base64>:` reads as the
 *                       same `sha256` digest — one digest, three spellings.
 *   - `digestsEqual`  — normalizes BOTH sides to `(algo, hex)` and compares, so a
 *                       stored bare `ab…` equals a freshly-computed `sha256:ab…`.
 *                       THIS is the dual-read shore: readers route their
 *                       `stored === computed` checks through it and stay correct
 *                       across the tag boundary.
 *   - `formatDigest`  — emits the canonical tagged form `algo:hex`.
 *   - `reprDigestOf`  — emits the RFC 9530 `Repr-Digest` field value for the HTTP skins.
 *
 * The Confluence ingest gate needs ZERO change — it compares opaque strings and
 * never computes; a caller that wants tag-agnostic comparison passes
 * `digestsEqual` as its comparator, or keeps the raw `===` while both sides stay
 * bare. Convergence is LAZY: read-accepts-both lands first (pure widening); a
 * carrier's stored value rewrites tagged only the next time it is touched.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/agile-digest
 */

/** A parsed content-digest: a non-empty lowercase algorithm tag + its lowercase hex. */
export interface ParsedDigest {
  readonly algo: string;
  readonly hex: string;
}

/** The implicit algorithm a bare (untagged) hex digest carries — every stored
 *  value in the pre-agile era is a full-hex SHA-256, so a bare 64-char hex reads
 *  as `sha256` with no data loss. */
export const IMPLICIT_ALGO = "sha256" as const;

/** A bare 32-byte (SHA-256) digest: exactly 64 lowercase/uppercase hex chars, no tag. */
const BARE_SHA256_HEX = /^[0-9a-fA-F]{64}$/;
/** Any bare hex digest (even length ≥ 2) — a future algorithm may carry a different width. */
const BARE_HEX = /^(?:[0-9a-fA-F]{2})+$/;
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
 *   "ab…64…"          → { algo: "sha256", hex: "ab…" }   (bare → implicit sha256)
 *   "sha256:ab…"      → { algo: "sha256", hex: "ab…" }   (canonical tagged, `:`)
 *   "sha256-ab…"      → { algo: "sha256", hex: "ab…" }   (legacy SRI / sourceCidOf, `-`)
 *   "blake3:cd…"      → { algo: "blake3", hex: "cd…" }   (a future scheme rides free)
 *
 * The hex normalizes to lowercase; the algo lowercases too. Throws a NAMED error
 * on a malformed digest — a caller passes an already-shaped value (a stored tree
 * entry or a fresh hash), never arbitrary text.
 *
 * The separator split is FIRST-delimiter only, and only when the head reads as a
 * known algorithm tag — so a bare hex (which contains neither `:` nor, mid-value,
 * a `-`) never mis-splits, and a value like `sha256-ab…` splits at the `-` while a
 * hypothetical hex-with-dashes never would (hex holds no `-`).
 */
export function parseDigest(digest: string): ParsedDigest {
  if (typeof digest !== "string" || digest.length === 0) {
    throw new TypeError(`parseDigest: empty or non-string digest`);
  }

  // RFC 9530 form: `sha-256=:<base64>:` — the `Repr-Digest` field value an HTTP skin emits.
  const repr = REPR_DIGEST.exec(digest);
  if (repr) {
    const hex = hexOfBase64(repr[2]!);
    if (hex === null || !BARE_SHA256_HEX.test(hex)) {
      throw new TypeError(`parseDigest: malformed tagged digest "${digest}"`);
    }
    return { algo: IMPLICIT_ALGO, hex };
  }

  // Tagged form: split on the FIRST `:` or `-`, but only accept the split when the
  // head is a legal algo tag AND the tail is bare hex. A bare hex digest holds
  // neither delimiter, so it falls through to the bare branch untouched.
  const sepIndex = firstSeparator(digest);
  if (sepIndex > 0) {
    const algo = digest.slice(0, sepIndex).toLowerCase();
    const hex = digest.slice(sepIndex + 1).toLowerCase();
    if (ALGO_TAG.test(algo) && BARE_HEX.test(hex)) {
      return { algo, hex };
    }
    // A head that is not a clean algo tag, or a non-hex tail, is malformed — never
    // silently treated as a bare digest (that would fuse a corrupt value in).
    throw new TypeError(`parseDigest: malformed tagged digest "${digest}"`);
  }

  // Bare form: a full-hex value with no tag → implicit sha256.
  const bare = digest.toLowerCase();
  if (BARE_SHA256_HEX.test(bare)) {
    return { algo: IMPLICIT_ALGO, hex: bare };
  }
  throw new TypeError(`parseDigest: not a bare sha256 hex nor a tagged digest "${digest}"`);
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
  if (!BARE_HEX.test(h)) throw new TypeError(`formatDigest: bad hex "${hex}"`);
  return `${a}:${h}`;
}

/**
 * The RFC 9530 `Repr-Digest` field value for a sha256 digest in any of its spellings —
 * `sha-256=:<base64>:`. An HTTP skin emits it beside the `ETag`, so a client that speaks the
 * standard field verifies the body without learning the house's tag grammar. Only sha256 carries a
 * registered RFC 9530 algorithm key here; another algorithm refuses loud.
 */
export function reprDigestOf(digest: string): string {
  const { algo, hex } = parseDigest(digest);
  if (algo !== IMPLICIT_ALGO) throw new TypeError(`reprDigestOf: only sha-256 carries a Repr-Digest key here (got "${algo}")`);
  return `sha-256=:${base64OfHex(hex)}:`;
}

/** Re-tag a possibly-bare digest into canonical `algo:hex` form (idempotent for an
 *  already-tagged value). The one-line producer helper: `tag(carrierHash(...))`. */
export function tagDigest(digest: string): string {
  const { algo, hex } = parseDigest(digest);
  return formatDigest(algo, hex);
}

/**
 * THE DUAL-READ SHORE. Two digests name the SAME content iff they carry the same
 * algorithm and the same hex — regardless of whether either side rode bare
 * (implicit sha256) or tagged. A stored bare `ab…` therefore equals a computed
 * `sha256:ab…`, which is exactly what lets readers widen to accept-both BEFORE any
 * producer starts emitting tags (the no-flag-day law).
 *
 * A malformed digest on either side reads as NOT-equal (never throws) — a
 * comparator on a hot path surfaces a mismatch, it does not crash ingest; the
 * caller that wants the strict parse calls `parseDigest` directly.
 */
export function digestsEqual(a: string, b: string): boolean {
  let pa: ParsedDigest;
  let pb: ParsedDigest;
  try { pa = parseDigest(a); } catch { return false; }
  try { pb = parseDigest(b); } catch { return false; }
  return pa.algo === pb.algo && pa.hex === pb.hex;
}
