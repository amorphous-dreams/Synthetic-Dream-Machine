/**
 * Web Crypto provider boundary for Lararium.
 *
 * Doctrine: lararium-core/CRYPTO.md
 *   - Lararium defines needs; it does not implement primitives.
 *   - Portable code depends on CryptoProvider, never on Node crypto or hand-rolled code.
 *   - All digest operations are async (SubtleCrypto.digest is async).
 *   - Callers must supply canonical bytes, not raw objects.
 */

// ---------------------------------------------------------------------------
// Provider interfaces
// ---------------------------------------------------------------------------

export type DigestAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";

export interface DigestProvider {
  digest(algorithm: DigestAlgorithm, data: Uint8Array): Promise<Uint8Array>;
}

export interface RandomProvider {
  getRandomValues<T extends Uint8Array>(array: T): T;
  randomUUID(): string;
}

export interface CryptoProvider extends DigestProvider, RandomProvider {}

// ---------------------------------------------------------------------------
// Platform Web Crypto implementation (Node 19+ and all modern browsers)
// ---------------------------------------------------------------------------

export async function webDigest(
  algorithm: DigestAlgorithm,
  data: Uint8Array,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto SubtleCrypto unavailable in this runtime");
  return new Uint8Array(await subtle.digest(algorithm, data.buffer as ArrayBuffer));
}

export function webGetRandomValues<T extends Uint8Array>(array: T): T {
  const fn = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (!fn) throw new Error("crypto.getRandomValues unavailable in this runtime");
  return fn(array);
}

export function webRandomUUID(): string {
  const fn = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (!fn) throw new Error("crypto.randomUUID unavailable in this runtime");
  return fn();
}

/** Default platform provider — uses globalThis.crypto (Node 19+, all modern browsers). */
export const defaultCryptoProvider: CryptoProvider = {
  digest:          webDigest,
  getRandomValues: webGetRandomValues,
  randomUUID:      webRandomUUID,
};

// ---------------------------------------------------------------------------
// Canonical bytes helpers (CRYPTO.md policy)
// ---------------------------------------------------------------------------

/** Encode a string to UTF-8 bytes. Always use this, never Buffer.from(str). */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Stable JSON serialization with sorted keys.
 * Rejects undefined, functions, symbols, BigInt, non-finite numbers, and class instances
 * unless they have a well-typed JSON representation.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v === undefined) return undefined;
    if (typeof v === "function" || typeof v === "symbol" || typeof v === "bigint") {
      throw new TypeError(`canonicalJson: non-serializable value type ${typeof v}`);
    }
    if (typeof v === "number" && !isFinite(v)) {
      throw new TypeError(`canonicalJson: non-finite number ${v}`);
    }
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      // Sort object keys for stability
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      );
    }
    return v;
  });
}

/** `canonicalJson` encoded as UTF-8 bytes. */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return utf8Bytes(canonicalJson(value));
}

/** Encode a Uint8Array as a lowercase hex string. */
export function hex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 digest of bytes, returned as lowercase hex.
 * Requires a DigestProvider (use defaultCryptoProvider for platform Web Crypto).
 */
export async function sha256Hex(bytes: Uint8Array, provider: DigestProvider): Promise<string> {
  return hex(await provider.digest("SHA-256", bytes));
}
