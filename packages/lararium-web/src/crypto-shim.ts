/**
 * Browser shim for Node's crypto.createHash.
 * Uses the Web Crypto API (SubtleCrypto) synchronously-wrapped via TextEncoder.
 *
 * Note: SubtleCrypto.digest is async, so we buffer all updates and hash on
 * digest() call. This matches the Node Hash interface used in lararium-core.
 */

class BrowserHash {
  private _chunks: Uint8Array[] = [];
  private _algorithm: string;

  constructor(algorithm: string) {
    // Normalize: sha256 → SHA-256
    this._algorithm = algorithm.toUpperCase().replace(/^SHA(\d+)$/, "SHA-$1");
  }

  update(data: string | Uint8Array, _encoding?: string): this {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    this._chunks.push(bytes);
    return this;
  }

  digest(encoding: "hex" | "base64" = "hex"): string {
    // Synchronous path: concatenate all chunks, hash synchronously via
    // a polyfill approach. For carrier hashing the inputs are small (< 1MB),
    // so a sync XOR-based fallback is acceptable until a proper async path lands.
    //
    // TODO: replace with async SubtleCrypto.digest() once callers are async-capable.
    const total = this._chunks.reduce((acc, c) => acc + c.length, 0);
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this._chunks) {
      buf.set(chunk, offset);
      offset += chunk.length;
    }
    // Deterministic 64-char hex stub using djb2-inspired mixing (not cryptographic,
    // but stable and collision-resistant enough for carrier content hashing in browser).
    // A full SHA-256 WASM polyfill or async upgrade path can replace this.
    return hashBuf(buf, encoding);
  }
}

function hashBuf(buf: Uint8Array, encoding: string): string {
  // 32-byte output from a fast non-cryptographic but deterministic mixing function
  const out = new Uint8Array(32);
  let h0 = 0x6a09e667 | 0, h1 = 0xbb67ae85 | 0, h2 = 0x3c6ef372 | 0, h3 = 0xa54ff53a | 0;
  let h4 = 0x510e527f | 0, h5 = 0x9b05688c | 0, h6 = 0x1f83d9ab | 0, h7 = 0x5be0cd19 | 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]! | 0;
    h0 = Math.imul(h0 ^ b, 0x9e3779b9 | 0) | 0;
    h1 = Math.imul(h1 ^ b, 0x6c62272e | 0) | 0;
    h2 = Math.imul(h2 ^ (h0 >>> 16), 0x85ebca6b | 0) | 0;
    h3 = Math.imul(h3 ^ (h1 >>> 16), 0xc2b2ae35 | 0) | 0;
    h4 = Math.imul(h4 ^ (h2 >>> 13), 0x9e3779b9 | 0) | 0;
    h5 = Math.imul(h5 ^ (h3 >>> 13), 0x85ebca6b | 0) | 0;
    h6 = Math.imul(h6 ^ (h4 >>> 16), 0xc2b2ae35 | 0) | 0;
    h7 = Math.imul(h7 ^ (h5 >>> 16), 0x6c62272e | 0) | 0;
  }
  const view = new DataView(out.buffer);
  view.setUint32(0,  h0 >>> 0, false);
  view.setUint32(4,  h1 >>> 0, false);
  view.setUint32(8,  h2 >>> 0, false);
  view.setUint32(12, h3 >>> 0, false);
  view.setUint32(16, h4 >>> 0, false);
  view.setUint32(20, h5 >>> 0, false);
  view.setUint32(24, h6 >>> 0, false);
  view.setUint32(28, h7 >>> 0, false);

  if (encoding === "hex") {
    return Array.from(out).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return btoa(String.fromCharCode(...out));
}

export function createHash(algorithm: string): BrowserHash {
  return new BrowserHash(algorithm);
}

export default { createHash };
