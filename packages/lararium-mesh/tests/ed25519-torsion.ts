/**
 * ed25519-torsion — a hand whose signatures only a LENIENT verifier reads.
 *
 * `torsionHand(n)` holds a MIXED-ORDER public key: a prime-order point plus a point of order eight. The key
 * passes `acceptEd25519Key` (RFC 8032 leaves a mixed-order key standing), so it seats, admits and incepts like
 * any other. Its `sign` writes, for ANY bytes, a signature that satisfies the cofactored equation
 * `[8][S]B = [8]R + [8][k]A` and breaks the cofactorless one: the curve libraries read it true under their
 * default rule and under their own strict branch, and the house's one door refuses it `signature-mismatch`.
 *
 * So a verifier that still calls a curve library directly ACCEPTS this hand, wherever it sits and whatever
 * acceptance check stands in front of it. Each family vector signs through the module's own helpers with this
 * hand: the same construction as the honest control, with one hand swapped.
 *
 * `IDENTITY_KEY` and `NOBODYS_SIGNATURE` name the other forgery: the identity point as a key, with the
 * signature anyone can write for it. Only an acceptance check or the door's `key-small-order` refuses that.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { hex, hexToBytes } from "../src/crypto.js";

const Point = ed25519.Point;
const L = Point.Fn.ORDER;
const ORDER_EIGHT = Point.fromBytes(hexToBytes("c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a"), false);

export const IDENTITY_KEY = `01${"00".repeat(31)}`;
export const NOBODYS_SIGNATURE = `${IDENTITY_KEY}${"00".repeat(32)}`;

const le = (bytes: Uint8Array): bigint => { let n = 0n; for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]!); return n; };
const le32 = (n: bigint): Uint8Array => { const out = new Uint8Array(32); for (let i = 0; i < 32; i++) { out[i] = Number(n & 0xffn); n >>= 8n; } return out; };
const cat = (...parts: Uint8Array[]): Uint8Array => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };

export interface TorsionHand {
  /** The mixed-order public key, bare lower-case hex. */
  readonly key:  string;
  /** A signature over `bytes` that the cofactored equation reads true and the cofactorless one false. */
  readonly sign: (bytes: Uint8Array) => Promise<string>;
}

export function torsionHand(n: number): TorsionHand {
  const a = (le(sha512(new Uint8Array(32).fill(n))) % (L - 1n)) + 1n;
  const A = Point.BASE.multiply(a).add(ORDER_EIGHT);
  const keyBytes = A.toBytes();
  const sign = async (bytes: Uint8Array): Promise<string> => {
    for (let counter = 0; ; counter++) {
      const r = (le(sha512(cat(Uint8Array.of(n, counter), bytes))) % (L - 1n)) + 1n;
      const R = Point.BASE.multiply(r).toBytes();
      const k = le(sha512(cat(R, keyBytes, bytes))) % L;
      if (k % 8n === 0n) continue;                    // [k] would erase the torsion: both equations would hold
      return hex(cat(R, le32((r + k * a) % L)));
    }
  };
  return { key: hex(keyBytes), sign };
}
