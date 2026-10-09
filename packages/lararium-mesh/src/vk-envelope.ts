/**
 * vk-envelope — the frame of a carrier sealed under the vessel's VK, and the readings a writer keeps apart.
 *
 * THE FRAME: `magic ‖ nonce(24) ‖ ciphertext‖tag(16)`. The magic NAMES the scheme ("lares-vk-seal") and no version
 * byte follows it. One scheme, one mode, fixed widths: nothing in the frame negotiates. A change of scheme mints a
 * new magic, the way a change of protocol mints a new domain name, because a version byte invites the shredder this
 * frame exists to end — a vessel that cannot decode version N+1 reading it as "not sealed" and writing over it.
 *
 * THE READINGS. A writer asks what stands before it replaces anything, and each answer names one fact:
 *
 *  · `absent`     — nothing stands. A write may found the carrier.
 *  · `sealed`     — the house magic over a frame long enough to hold a nonce and a tag. A VK may be tried.
 *  · `torn`       — the house magic over a frame too short to hold them. The bytes never framed, so no key is at
 *                   fault; the route out is a backup, never a re-typed credential.
 *  · `old-shape`  — the `LARK` magic of the passphrase envelope, at any version. The custody it belongs to is
 *                   gone; the fresh-start runbook answers it, and no write here replaces it.
 *  · `unopenable` — a seal stands that this build cannot frame: the house magic with damaged bytes, or another
 *                   scheme of the house family (`lares-…`). No key can be judged against it, so none may replace it.
 *  · `bare`       — nothing frames as a seal: cleartext, or bytes of no seal this house writes.
 *
 * Only `absent`, and a `sealed` carrier the current VK OPENS, earn a write (`sealed-writer`). Pure codec: no key,
 * no crypto; `vk.ts` holds the AEAD.
 */

import { carriesSealMagic } from "./archive-envelope.js";

/** The magic that names the VK seal scheme. */
export const VK_SEAL_MAGIC: Uint8Array = new TextEncoder().encode("lares-vk-seal");
/** The house family prefix: a magic that opens with it names a house seal scheme, known to this build or not. */
const HOUSE_FAMILY_PREFIX = new TextEncoder().encode("lares-");
/** XChaCha20-Poly1305 nonce and tag widths. */
export const VK_SEAL_NONCE_LENGTH = 24;
export const VK_SEAL_TAG_LENGTH = 16;
/** The shortest frame that holds a magic, a nonce and a tag (an empty plaintext). */
export const VK_SEAL_MIN_LENGTH = VK_SEAL_MAGIC.length + VK_SEAL_NONCE_LENGTH + VK_SEAL_TAG_LENGTH;
/** A damaged magic still testifies to a house seal while at most this many of its bytes differ. */
const DAMAGED_MAGIC_TOLERANCE = 3;

export type VkCarrierReading = "absent" | "sealed" | "torn" | "old-shape" | "unopenable" | "bare";

const startsWith = (bytes: Uint8Array, prefix: Uint8Array): boolean =>
  bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);

function magicDistance(bytes: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < VK_SEAL_MAGIC.length; i++) if (bytes[i] !== VK_SEAL_MAGIC[i]) d++;
  return d;
}

/** Read what stands at a carrier, before any key is judged against it. `null` means nothing stands. */
export function readVkCarrier(bytes: Uint8Array | null): VkCarrierReading {
  if (bytes === null) return "absent";
  if (startsWith(bytes, VK_SEAL_MAGIC)) return bytes.length >= VK_SEAL_MIN_LENGTH ? "sealed" : "torn";
  if (carriesSealMagic(bytes)) return "old-shape";
  if (bytes.length >= VK_SEAL_MIN_LENGTH) {
    if (startsWith(bytes, HOUSE_FAMILY_PREFIX)) return "unopenable";
    if (magicDistance(bytes) <= DAMAGED_MAGIC_TOLERANCE) return "unopenable";
  }
  return "bare";
}

/** The parts of a `sealed` frame. Call only on bytes `readVkCarrier` reads `sealed`. */
export function splitVkFrame(bytes: Uint8Array): { readonly nonce: Uint8Array; readonly ciphertext: Uint8Array } {
  if (readVkCarrier(bytes) !== "sealed") throw new Error("vk-envelope: these bytes do not read sealed");
  const at = VK_SEAL_MAGIC.length;
  return { nonce: bytes.subarray(at, at + VK_SEAL_NONCE_LENGTH), ciphertext: bytes.subarray(at + VK_SEAL_NONCE_LENGTH) };
}

/** Frame a nonce and its ciphertext under the magic. */
export function joinVkFrame(nonce: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  if (nonce.length !== VK_SEAL_NONCE_LENGTH) throw new Error(`vk-envelope: a nonce rides ${VK_SEAL_NONCE_LENGTH} bytes`);
  if (ciphertext.length < VK_SEAL_TAG_LENGTH) throw new Error("vk-envelope: a ciphertext carries at least its tag");
  const out = new Uint8Array(VK_SEAL_MAGIC.length + nonce.length + ciphertext.length);
  out.set(VK_SEAL_MAGIC, 0);
  out.set(nonce, VK_SEAL_MAGIC.length);
  out.set(ciphertext, VK_SEAL_MAGIC.length + nonce.length);
  return out;
}
