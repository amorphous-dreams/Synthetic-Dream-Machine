/**
 * A face carrier has one fixed frame: magic, a 24-byte nonce, and ciphertext with a 16-byte tag.
 * A house seal under another magic remains occupied and cannot enter the face writer as cleartext.
 */
import { LARK_MAGIC, S_SEAL_MAGIC } from "./s-envelope.js";

export const FCK_SEAL_MAGIC = new TextEncoder().encode("lares-fck-seal");
export const FCK_SEAL_NONCE_LENGTH = 24;
export const FCK_SEAL_TAG_LENGTH = 16;
export const FCK_SEAL_MIN_LENGTH = FCK_SEAL_MAGIC.length + FCK_SEAL_NONCE_LENGTH + FCK_SEAL_TAG_LENGTH;
export type FckCarrierReading = "absent" | "sealed" | "torn" | "old-shape" | "unopenable" | "bare";

const family = new TextEncoder().encode("lares-");
const starts = (b: Uint8Array, p: Uint8Array): boolean => b.length >= p.length && p.every((v, i) => b[i] === v);
const prefix = (b: Uint8Array, p: Uint8Array): boolean => b.length > 0 && b.length < p.length && b.every((v, i) => p[i] === v);

/** Preserve the distinction between a damaged face frame and another house scheme. */
export function readFckCarrier(bytes: Uint8Array | null): FckCarrierReading {
  if (bytes === null) return "absent";
  if (starts(bytes, FCK_SEAL_MAGIC)) return bytes.length >= FCK_SEAL_MIN_LENGTH ? "sealed" : "torn";
  if (starts(bytes, S_SEAL_MAGIC)) return "unopenable";
  if (prefix(bytes, FCK_SEAL_MAGIC)) return "torn";
  if (starts(bytes, LARK_MAGIC)) return "old-shape";
  if (starts(bytes, family)) return "unopenable";
  if (bytes.length >= FCK_SEAL_MIN_LENGTH) {
    let distance = 0;
    for (let i = 0; i < FCK_SEAL_MAGIC.length; i++) if (bytes[i] !== FCK_SEAL_MAGIC[i]) distance++;
    if (distance <= 3) return "unopenable";
  }
  return "bare";
}

/** Split only a complete face frame. */
export function splitFckFrame(bytes: Uint8Array): { readonly nonce: Uint8Array; readonly ciphertext: Uint8Array } {
  if (readFckCarrier(bytes) !== "sealed") throw new Error("fck-envelope: these bytes do not read sealed");
  const at = FCK_SEAL_MAGIC.length;
  return { nonce: bytes.subarray(at, at + FCK_SEAL_NONCE_LENGTH), ciphertext: bytes.subarray(at + FCK_SEAL_NONCE_LENGTH) };
}

/** Frame a face seal under its own magic. */
export function joinFckFrame(nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  if (nonce.length !== FCK_SEAL_NONCE_LENGTH) throw new Error("fck-envelope: a nonce rides 24 bytes");
  if (ciphertext.length < FCK_SEAL_TAG_LENGTH) throw new Error("fck-envelope: a ciphertext carries a tag");
  const out = new Uint8Array(FCK_SEAL_MAGIC.length + nonce.length + ciphertext.length);
  out.set(FCK_SEAL_MAGIC);
  out.set(nonce, FCK_SEAL_MAGIC.length);
  out.set(ciphertext, FCK_SEAL_MAGIC.length + nonce.length);
  return out;
}
