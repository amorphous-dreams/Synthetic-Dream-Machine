/**
 * ed25519-door — the ONE door every Ed25519 signature and every Ed25519 public key in the house passes.
 *
 * THE LAW (strict by construction; no option loosens it):
 *   · a public key reads as exactly 32 bytes, in its ONE canonical encoding (y below the field prime, no
 *     negative zero), on the curve, and NOT of small order. The eight small-order points refuse BY NAME
 *     (`key-small-order`): such a key holds no secret, so anyone signs for it;
 *   · a signature reads as exactly 64 bytes `R ‖ S`, with `S` below the group order (`signature-scalar-
 *     non-canonical`: one signature, one encoding), `R` canonical, on the curve and not of small order;
 *   · the equation reads COFACTORLESS, as RFC 8032 §5.1.7 states its sufficient form: `[S]B = R + [k]A`,
 *     `k = SHA-512(R ‖ A ‖ M) mod L` over the EXACT bytes handed in. No factor of eight forgives a torsion
 *     component.
 *
 * A MIXED-ORDER KEY (a prime-order point plus a torsion point) stands as RFC 8032 leaves it: it reads as a
 * key, and a signature under it verifies exactly when the cofactorless equation holds. No honest key
 * generation yields one, and its holder gains nothing over a third party by it.
 *
 * EVERY PRODUCER THE HOUSE USES (noble, Node `crypto`, WebCrypto, extractable or not) signs by RFC 8032
 * §5.1.6 and so passes: an honest `R` and `A` sit in the prime-order subgroup, canonically encoded, with
 * `S` reduced. The door changes which signatures and keys get ACCEPTED, and never what gets signed.
 *
 * TWO READINGS, ONE RULE. `acceptEd25519Key` answers at the moment a key ENTERS standing state (a charter
 * seat, an admit, a device edge, an inception, a Handle card, a guardian set); `readEd25519` answers a
 * signature with a named refusal a caller can surface; `verifyEd25519` reads the same answer as a boolean.
 * None throws: bytes or hex of any shape answer by name. Hex reads bare and lower-case alone, so one key
 * holds one spelling wherever a seat set or a signer dedup compares strings.
 *
 * The door also asks the curve library's own strict branch and requires both to agree, so a slip in this
 * file can only refuse more, never less. A census test (`tests/ed25519-door-census.test.ts`) reads red when
 * any other source file calls a curve library's `verify`.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";

/** Why a public key refuses. */
export type Ed25519KeyRefusal =
  | "key-malformed"        // not 32 bytes, or hex that names no bytes
  | "key-non-canonical"    // a second encoding of a point: y at or above the field prime, or negative zero
  | "key-off-curve"        // 32 canonical bytes that name no point
  | "key-small-order";     // one of the eight points anyone signs for

/** Why a signature refuses. A key refusal reads first: a weak key refuses whatever signature rides it. */
export type Ed25519Refusal =
  | Ed25519KeyRefusal
  | "signature-malformed"              // not 64 bytes, or hex that names no bytes
  | "signature-scalar-non-canonical"   // S at or above the group order
  | "signature-point-non-canonical"    // R in a second encoding
  | "signature-point-off-curve"        // R names no point
  | "signature-point-small-order"      // R one of the eight
  | "signature-mismatch";              // well formed, and the equation does not hold

export type Ed25519KeyReading = { readonly ok: true } | { readonly ok: false; readonly refusal: Ed25519KeyRefusal };
export type Ed25519Reading = { readonly ok: true } | { readonly ok: false; readonly refusal: Ed25519Refusal };

const Point = ed25519.Point;
type EdPoint = InstanceType<typeof Point>;
const L = Point.Fn.ORDER;
const OK = Object.freeze({ ok: true }) as { readonly ok: true };
const HEX = /^(?:[0-9a-f]{2})*$/;

/** Bytes or bare LOWER-CASE hex → a private copy, or null. One key, one spelling: a seat set and a signer
 *  dedup compare strings, so a second spelling of the same bytes names nobody. Never throws. */
function bytesOf(value: unknown, length: number): Uint8Array | null {
  try {
    if (typeof value === "string") {
      if (value.length !== length * 2 || !HEX.test(value)) return null;
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    if (value instanceof Uint8Array && value.length === length) return new Uint8Array(value);
    return null;
  } catch { return null; }
}

/** A message → a private copy, or null. A Proxy that passes `instanceof` and then throws while read answers null. */
function messageOf(value: unknown): Uint8Array | null {
  try { return value instanceof Uint8Array ? new Uint8Array(value) : null; }
  catch { return null; }
}

function leToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]!);
  return n;
}

type PointReading = { point: EdPoint } | { fault: "non-canonical" | "off-curve" | "small-order" };

/** One 32-byte point encoding → the point, or which law it breaks. */
function readPoint(bytes: Uint8Array): PointReading {
  let point: EdPoint;
  try { point = Point.fromBytes(bytes, false); }
  catch {
    // The strict decoder refuses a second encoding and an off-curve value alike; the lenient decoder
    // tells them apart, and decides nothing.
    try { Point.fromBytes(bytes, true); return { fault: "non-canonical" }; }
    catch { return { fault: "off-curve" }; }
  }
  if (point.isSmallOrder()) return { fault: "small-order" };
  return { point };
}

function readKey(bytes: Uint8Array | null): { point: EdPoint } | { refusal: Ed25519KeyRefusal } {
  if (bytes === null) return { refusal: "key-malformed" };
  const read = readPoint(bytes);
  return "point" in read ? read : { refusal: `key-${read.fault}` };
}

/**
 * May this public key ENTER standing state? Bytes, or bare lower-case hex. Call it where a key gets
 * accepted (seated, admitted, edged, incepted, carded), so a weak key refuses THERE by name and never
 * waits for a signature to expose it.
 */
export function acceptEd25519Key(publicKey: unknown): Ed25519KeyReading {
  const read = readKey(bytesOf(publicKey, 32));
  return "point" in read ? OK : { ok: false, refusal: read.refusal };
}

/** Does `signature` over `message` stand under `publicKey`? A named refusal otherwise. Never throws. */
export function readEd25519(signature: unknown, message: unknown, publicKey: unknown): Ed25519Reading {
  const keyBytes = bytesOf(publicKey, 32);
  const key = readKey(keyBytes);
  if (!("point" in key)) return { ok: false, refusal: key.refusal };
  const sig = bytesOf(signature, 64);
  const msg = messageOf(message);
  if (sig === null || msg === null) return { ok: false, refusal: "signature-malformed" };
  const rBytes = sig.subarray(0, 32);
  const s = leToBigInt(sig.subarray(32, 64));
  if (s >= L) return { ok: false, refusal: "signature-scalar-non-canonical" };
  const r = readPoint(rBytes);
  if (!("point" in r)) return { ok: false, refusal: `signature-point-${r.fault}` };
  try {
    const hashed = new Uint8Array(64 + msg.length);
    hashed.set(rBytes, 0); hashed.set(keyBytes!, 32); hashed.set(msg, 64);
    const k = leToBigInt(sha512(hashed)) % L;
    // RFC 8032 §5.1.7, cofactorless: [S]B = R + [k]A. Every input here stands public.
    const holds = Point.BASE.multiplyUnsafe(s).equals(r.point.add(key.point.multiplyUnsafe(k)));
    // The library's strict branch must agree: this file may only ever refuse more than it does.
    if (holds && ed25519.verify(sig, msg, keyBytes!, { zip215: false })) return OK;
  } catch { /* a fault while reading the equation refuses */ }
  return { ok: false, refusal: "signature-mismatch" };
}

/** The same reading as a boolean. THE verify every verifier in the house calls. */
export function verifyEd25519(signature: unknown, message: unknown, publicKey: unknown): boolean {
  return readEd25519(signature, message, publicKey).ok;
}
