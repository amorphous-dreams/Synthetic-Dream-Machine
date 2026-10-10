/**
 * vk — the Vessel KEK: one 32-byte key per vessel that seals every hot and cold carrier at rest.
 *
 * The VK rests only inside keyslots (`keyslot.ts`): a human route — a passphrase, a paper sheet — opens a slot, the
 * slot yields the VK, and the VK opens the carriers. Changing a passphrase re-wraps one slot and touches no carrier;
 * rotating the VK re-seals every carrier (`sealed-writer.ts`).
 *
 * THE BRAND TYPES; THE TREE PROVES. A `VesselKey` types from two places: `mintVk` at founding or rotation, and a
 * slot that opens (`adoptUnwrappedVk`, which only `keyslot.ts` calls). The brand stops a floor key, a seed or a test
 * literal reaching the sealer BY ACCIDENT, and no further: at runtime a cast mints one. What a writer trusts is the
 * slot tree's CHECK (`vkCheck`): the sealed writer proves every VK in hand against the check the standing tree
 * carries before any byte moves, so a VK the tree does not commit to seals nothing.
 *
 * THE SEAL. XChaCha20-Poly1305 under the VK, a fresh 24-byte nonce every seal, and the AAD binding the magic and the
 * CARRIER NAME: bytes moved from one carrier's path to another's do not open there.
 *
 * TWO USES OF THE VK, EACH UNDER ITS OWN NAME. The VK keys the carrier AEAD, and it keys the tree's check: HKDF-SHA256
 * with the VK as input and `vk-check` as info, a pseudorandom digest that names one VK and reveals nothing of it. The
 * slot wraps derive their own keys under `vk-slot-wrap` from the slot key and the pins, never from the VK.
 *
 * OPEN WITHHOLDS WHICH CHECK FAILED, BUT NEVER FOLDS A READING. `openUnderVk` returns the frame reading
 * (`vk-envelope.ts`) for bytes it cannot try, and `key-fails` for a sealed frame the AEAD refuses; a tampered
 * ciphertext and a wrong VK both draw `key-fails`, because an AEAD cannot tell them apart.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import { VK_CHECK_INFO } from "./custody-domain-names.js";
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

/** The check a slot tree carries for `vk`: 32 bytes of HKDF-SHA256 under `vk-check`, as lowercase hex. */
export function vkCheckOf(vk: VesselKey): string {
  return hex(hkdf(sha256, vk, new Uint8Array(0), new TextEncoder().encode(VK_CHECK_INFO), 32));
}

/** Does `vk` answer to `check`? Compared in constant time over the hex. */
export function vkAnswersCheck(vk: VesselKey, check: string): boolean {
  const mine = vkCheckOf(vk);
  if (typeof check !== "string" || check.length !== mine.length) return false;
  let d = 0;
  for (let i = 0; i < mine.length; i++) d |= mine.charCodeAt(i) ^ check.charCodeAt(i);
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
