/**
 * vk — the Vessel KEK: one 32-byte key per vessel that seals every hot and cold carrier at rest.
 *
 * The VK rests only inside keyslots (`keyslot.ts`): a human route — a passphrase, a paper sheet — opens a slot, the
 * slot yields the VK, and the VK opens the carriers. Changing a passphrase re-wraps one slot and touches no carrier;
 * rotating the VK re-seals every carrier (`sealed-writer.ts`).
 *
 * THE BRAND. A `VesselKey` comes from exactly two places: `mintVk` at founding or rotation, and a slot that opens
 * (`adoptUnwrappedVk`, which only `keyslot.ts` calls). A byte array that came from anywhere else does not type as a
 * VK, so no caller hands a floor key, a seed or a test literal to the sealer by accident.
 *
 * THE SEAL. XChaCha20-Poly1305 under the VK, a fresh 24-byte nonce every seal, and the AAD binding the magic and the
 * CARRIER NAME: bytes moved from one carrier's path to another's do not open there. The VK keys this one AEAD and
 * nothing else — the slot wraps derive their own keys under `vk-slot-wrap` from the slot key and the pins, never from
 * the VK — so no second use of the VK needs a domain of its own.
 *
 * OPEN WITHHOLDS WHICH CHECK FAILED, BUT NEVER FOLDS A READING. `openUnderVk` returns the frame reading
 * (`vk-envelope.ts`) for bytes it cannot try, and `key-fails` for a sealed frame the AEAD refuses; a tampered
 * ciphertext and a wrong VK both draw `key-fails`, because an AEAD cannot tell them apart.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { defaultCryptoProvider, type RandomProvider } from "./crypto.js";
import {
  readVkCarrier, splitVkFrame, joinVkFrame, VK_SEAL_MAGIC, VK_SEAL_NONCE_LENGTH, type VkCarrierReading,
} from "./vk-envelope.js";

declare const vesselKeyBrand: unique symbol;
/** The vessel's VK: 32 bytes, minted or opened from a slot, never built from other bytes. */
export type VesselKey = Uint8Array & { readonly [vesselKeyBrand]: true };

export const VK_LENGTH = 32;

/** Mint a fresh VK from the CSPRNG — at founding, and at a VK rotation. */
export function mintVk(rng: RandomProvider = defaultCryptoProvider): VesselKey {
  return rng.getRandomValues(new Uint8Array(VK_LENGTH)) as VesselKey;
}

/** The slot unwrap's door: the bytes a slot's AEAD just opened become the VK. `keyslot.ts` alone calls it. */
export function adoptUnwrappedVk(bytes: Uint8Array): VesselKey {
  if (bytes.length !== VK_LENGTH) throw new Error(`vk: a VK rides ${VK_LENGTH} bytes`);
  return Uint8Array.from(bytes) as VesselKey;
}

/** Do two VKs hold the same bytes? */
export function vkEquals(a: VesselKey, b: VesselKey): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

function aadFor(carrier: string): Uint8Array {
  if (carrier.length === 0) throw new Error("vk: a seal names its carrier; an empty carrier name binds nothing");
  const name = new TextEncoder().encode(carrier);
  const aad = new Uint8Array(VK_SEAL_MAGIC.length + name.length);
  aad.set(VK_SEAL_MAGIC, 0);
  aad.set(name, VK_SEAL_MAGIC.length);
  return aad;
}

/** Seal `plaintext` as the carrier named `carrier`. A fresh nonce every call. */
export function sealUnderVk(vk: VesselKey, carrier: string, plaintext: Uint8Array, rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  const aad = aadFor(carrier);
  const nonce = rng.getRandomValues(new Uint8Array(VK_SEAL_NONCE_LENGTH));
  return joinVkFrame(nonce, xchacha20poly1305(vk, nonce, aad).encrypt(plaintext));
}

/** What opening a carrier under a VK finds. Every reading but `opens` carries no plaintext. */
export type VkOpening =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "key-fails" }
  | { readonly reading: Exclude<VkCarrierReading, "sealed"> };

/** Open the bytes standing at the carrier named `carrier`. `null` means nothing stands. */
export function openUnderVk(vk: VesselKey, carrier: string, bytes: Uint8Array | null): VkOpening {
  const reading = readVkCarrier(bytes);
  if (reading !== "sealed") return { reading };
  const aad = aadFor(carrier);
  const { nonce, ciphertext } = splitVkFrame(bytes!);
  try {
    return { reading: "opens", plaintext: xchacha20poly1305(vk, nonce, aad).decrypt(ciphertext) };
  } catch {
    return { reading: "key-fails" };
  }
}
