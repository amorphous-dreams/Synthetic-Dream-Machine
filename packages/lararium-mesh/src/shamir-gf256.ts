/**
 * shamir-gf256 — Shamir secret-sharing over GF(256) (the AES field, reduction poly 0x11b), pure and
 * browser-shippable (the island-of-one is the strict teacher). The recovery keel's floor primitive:
 * split the PersonaGroup-root seed into shares of which the recorded code is ONE, so no single share —
 * and no single custodian — reconstructs (the impersonation-quorum invariant, made arithmetic).
 *
 * A t-of-n sharing gives PERFECT secrecy below t: any t-1 shares reveal exactly zero bits of the secret.
 * That same wall means loss of shares below t = permanent, by-design identity loss — which is not a
 * defect but the Camenisch-Lysyanskaya invariant itself: any path that recovered from fewer than t
 * shares would BE an impersonation quorum. No crypto restores a secret from nothing.
 *
 * Rides the RandomProvider shore (crypto.ts) — injectable, so tests pin a deterministic RNG and no
 * `node:` import leaks in. Byte-wise: the secret's k bytes become k independent GF(256) sharings over
 * shared x-coordinates; a share is {x: 1..n, ys: k bytes}.
 */

import type { RandomProvider } from "./crypto.js";

/** One share: its x-coordinate (1..255, never 0 — x=0 IS the secret) and one y per secret byte. */
export interface ShareBytes {
  readonly x:  number;
  readonly ys: Uint8Array;
}

// GF(256) exp/log tables over the AES field: generator g=0x03, reduction poly 0x11b. EXP cycles all
// 255 non-zero elements (3 is a generator), so mul/inv become table lookups.
const EXP = new Uint8Array(255);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // x *= 3 in GF(256) (Russian-peasant with 0x11b reduction) — bootstraps the tables.
    let a = x, b = 3, p = 0;
    while (b > 0) {
      if ((b & 1) !== 0) p ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi !== 0) a ^= 0x1b;
      b >>= 1;
    }
    x = p;
  }
}

/** GF(256) multiply: add is XOR (in the callers); this is the field product. 0 annihilates. */
const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[(LOG[a]! + LOG[b]!) % 255]!);
/** GF(256) divide (a / b). Throws on divide-by-zero (a degenerate share set). */
const div = (a: number, b: number): number => {
  if (b === 0) throw new Error("shamir: division by zero (degenerate shares)");
  return a === 0 ? 0 : EXP[(LOG[a]! - LOG[b]! + 255) % 255]!;
};

/**
 * Split `secret` into `shareCount` shares, any `threshold` of which reconstruct it; fewer than
 * `threshold` reveal nothing. Each secret byte rides its own random degree-(threshold-1) polynomial
 * whose constant term is that byte; a share evaluates every polynomial at its own x.
 */
export function splitSecret(secret: Uint8Array, threshold: number, shareCount: number, rng: RandomProvider): ShareBytes[] {
  if (!Number.isInteger(threshold) || threshold < 2) throw new Error("shamir: threshold must be an integer ≥ 2");
  if (!Number.isInteger(shareCount) || shareCount < threshold) throw new Error("shamir: shareCount must be an integer ≥ threshold");
  if (shareCount > 255) throw new Error("shamir: shareCount must be ≤ 255 (x lives in GF(256)\\{0})");
  if (secret.length === 0) throw new Error("shamir: empty secret");

  // (threshold-1) random coefficients per secret byte — the polynomial above the constant term.
  const coeffs = new Uint8Array(secret.length * (threshold - 1));
  if (coeffs.length > 0) rng.getRandomValues(coeffs);

  const shares: ShareBytes[] = [];
  for (let s = 1; s <= shareCount; s++) {
    const ys = new Uint8Array(secret.length);
    for (let i = 0; i < secret.length; i++) {
      let acc = secret[i]!;      // constant term = the secret byte
      let xp = 1;                // s^k, built up
      for (let k = 1; k < threshold; k++) {
        xp = mul(xp, s);
        acc ^= mul(coeffs[i * (threshold - 1) + (k - 1)]!, xp);
      }
      ys[i] = acc;
    }
    shares.push({ x: s, ys });
  }
  return shares;
}

/**
 * Evaluate the share polynomials at `x` by Lagrange interpolation over the given points — THE one interpolation
 * this field module carries. `combineSecret` reads it at x=0; SLIP-39 reads it at 255 (the shared secret) and
 * 254 (its digest) and builds its member shares through it. Any x in 0..255 may serve as a point or a target,
 * because the caller's scheme, never this field, decides which coordinate holds the secret.
 *
 * A target x that names one of the points returns that point's bytes. Points need distinct x-coordinates and
 * equal-length values; fewer points than the polynomial's degree + 1 yield a wrong answer silently, so a caller
 * pairs this with its own validity check (a share checksum, SLIP-39's digest share).
 */
export function interpolateAt(points: readonly ShareBytes[], x: number): Uint8Array {
  if (points.length === 0) throw new Error("shamir: no points to interpolate");
  if (!Number.isInteger(x) || x < 0 || x > 255) throw new Error("shamir: x must be an integer in 0..255");
  const len = points[0]!.ys.length;
  if (points.some((p) => p.ys.length !== len)) throw new Error("shamir: shares differ in length");
  const xs = points.map((p) => p.x);
  if (xs.some((px) => !Number.isInteger(px) || px < 0 || px > 255)) throw new Error("shamir: a point's x must be an integer in 0..255");
  if (new Set(xs).size !== xs.length) throw new Error("shamir: duplicate x-coordinate");

  const hit = points.find((p) => p.x === x);
  if (hit !== undefined) return Uint8Array.from(hit.ys);

  const out = new Uint8Array(len);
  for (let j = 0; j < points.length; j++) {
    // Lagrange basis L_j(x) = ∏_{m≠j} (x − x_m)/(x_j − x_m) = ∏ (x ⊕ x_m)/(x_j ⊕ x_m)   (− is ⊕ in GF(2^8)).
    let num = 1, den = 1;
    for (let m = 0; m < points.length; m++) {
      if (m === j) continue;
      num = mul(num, x ^ points[m]!.x);
      den = mul(den, points[j]!.x ^ points[m]!.x);
    }
    const basis = div(num, den);
    for (let i = 0; i < len; i++) out[i]! ^= mul(points[j]!.ys[i]!, basis);
  }
  return out;
}

/**
 * Reconstruct the secret from `shares` via Lagrange interpolation at x=0. Needs ≥ the original
 * threshold of DISTINCT-x shares; passing fewer (or the wrong ones) yields a wrong secret silently —
 * Shamir carries no built-in validity check, so the caller pairs it with a share checksum (recovery-share).
 */
export function combineSecret(shares: readonly ShareBytes[]): Uint8Array {
  if (shares.length < 2) throw new Error("shamir: need ≥ 2 shares to combine");
  if (shares.some((s) => s.x === 0)) throw new Error("shamir: x=0 is the secret, never a share");
  return interpolateAt(shares, 0);
}
