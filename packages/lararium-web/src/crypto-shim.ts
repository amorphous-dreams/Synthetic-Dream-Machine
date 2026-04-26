/**
 * Browser shim for Node's crypto.createHash — real SHA-256 in pure TypeScript.
 *
 * Implements SHA-256 per FIPS 180-4. Output is identical to Node's
 * crypto.createHash('sha256').update(data).digest('hex'), so boot receipts
 * computed server-side match browser-computed receipts exactly.
 *
 * No SubtleCrypto, no async, no WebAssembly — works synchronously at any
 * call site. Suitable for all current lararium-core callers (boot receipt,
 * carrier hash) which expect a synchronous string return from .digest().
 */

// ---------------------------------------------------------------------------
// SHA-256 constants (FIPS 180-4 §4.2.2)
// ---------------------------------------------------------------------------

// First 32 bits of fractional parts of square roots of first 8 primes
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

// First 32 bits of fractional parts of cube roots of first 64 primes
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// ---------------------------------------------------------------------------
// Core SHA-256 (processes pre-padded message as 32-bit big-endian words)
// ---------------------------------------------------------------------------

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Buf(data: Uint8Array): Uint8Array {
  // Padding: append 0x80, then zeros, then 64-bit big-endian bit length
  const bitLen = data.length * 8;
  const padLen = ((data.length + 9 + 63) & ~63); // next multiple of 64 after +9
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  // Write bit length as big-endian uint64 (we only need the low 32 bits for < 512MB)
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  // Working variables
  let h0 = H0[0]!, h1 = H0[1]!, h2 = H0[2]!, h3 = H0[3]!;
  let h4 = H0[4]!, h5 = H0[5]!, h6 = H0[6]!, h7 = H0[7]!;

  const W = new Uint32Array(64);

  for (let blockStart = 0; blockStart < padded.length; blockStart += 64) {
    const bv = new DataView(padded.buffer, blockStart, 64);

    // Prepare message schedule
    for (let i = 0; i < 16; i++) W[i] = bv.getUint32(i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(W[i-15]!, 7)  ^ rotr32(W[i-15]!, 18) ^ (W[i-15]! >>> 3);
      const s1 = rotr32(W[i-2]!,  17) ^ rotr32(W[i-2]!,  19) ^ (W[i-2]!  >>> 10);
      W[i] = (W[i-16]! + s0 + W[i-7]! + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];

    for (let i = 0; i < 64; i++) {
      const S1   = rotr32(e!, 6)  ^ rotr32(e!, 11) ^ rotr32(e!, 25);
      const ch   = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + S1 + ch + K[i]! + W[i]!) >>> 0;
      const S0   = rotr32(a!, 2)  ^ rotr32(a!, 13) ^ rotr32(a!, 22);
      const maj  = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (S0 + maj) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d! + temp1) >>> 0, c, b, a, (temp1 + temp2) >>> 0];
    }

    h0 = (h0 + a!) >>> 0; h1 = (h1 + b!) >>> 0;
    h2 = (h2 + c!) >>> 0; h3 = (h3 + d!) >>> 0;
    h4 = (h4 + e!) >>> 0; h5 = (h5 + f!) >>> 0;
    h6 = (h6 + g!) >>> 0; h7 = (h7 + h!) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => outView.setUint32(i * 4, v, false));
  return out;
}

// ---------------------------------------------------------------------------
// Node Hash-compatible interface
// ---------------------------------------------------------------------------

class BrowserHash {
  private _chunks: Uint8Array[] = [];
  private _algorithm: string;

  constructor(algorithm: string) {
    // Normalize: sha256 → SHA-256 (we only need sha256 / SHA-256 today)
    this._algorithm = algorithm.toUpperCase().replace(/^SHA(\d+)$/, "SHA-$1");
    if (this._algorithm !== "SHA-256") {
      throw new Error(`crypto-shim: unsupported algorithm ${algorithm}`);
    }
  }

  update(data: string | Uint8Array, _encoding?: string): this {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    this._chunks.push(bytes);
    return this;
  }

  digest(encoding: "hex" | "base64" = "hex"): string {
    const total = this._chunks.reduce((acc, c) => acc + c.length, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this._chunks) { buf.set(chunk, offset); offset += chunk.length; }
    const hash = sha256Buf(buf);
    if (encoding === "hex") {
      return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return btoa(String.fromCharCode(...hash));
  }
}

export function createHash(algorithm: string): BrowserHash {
  return new BrowserHash(algorithm);
}

export default { createHash };
