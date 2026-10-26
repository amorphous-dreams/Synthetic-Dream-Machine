/**
 * tree-key — the tree key: the 32-byte key a slot tree wraps, and the S seal it keys over the node's hot and cold carriers at rest.
 *
 * The tree key rests only inside keyslots (`keyslot.ts`): a human route — a passphrase, a paper sheet — opens a slot, the
 * slot yields the tree key, and the tree key opens the carriers. Changing a passphrase re-wraps one slot and touches no carrier;
 * rotating the tree key re-seals every carrier (`sealed-writer.ts`).
 *
 * THE BRAND TYPES; THE TREE PROVES. A `TreeKey` types from two places: `mintTreeKey` at founding or rotation, and a
 * slot that opens (`adoptUnwrappedTreeKey`, which only `keyslot.ts` calls). The brand stops a floor key, a seed or a test
 * literal reaching the sealer BY ACCIDENT, and no further: at runtime a cast mints one. What a writer trusts is the
 * slot tree's CHECK (`keyCheck`): the sealed writer proves every tree key in hand against the check the standing tree
 * carries before any byte moves, so a tree key the tree does not commit to seals nothing.
 *
 * THE SEAL. XChaCha20-Poly1305 under the tree key, a fresh 24-byte nonce every seal, and the AAD binding the magic and the
 * CARRIER NAME: bytes moved from one carrier's path to another's do not open there.
 *
 * TWO USES OF THE TREE KEY, EACH UNDER ITS OWN NAME. The tree key keys the carrier AEAD, and it keys the tree's check: HKDF-SHA256
 * with the tree key as input and `tree-key-check` as info, a pseudorandom digest that names one tree key and reveals nothing of it. The
 * slot wraps derive their own keys under `slot-wrap` from the slot key and the pins, never from the tree key.
 *
 * OPEN WITHHOLDS WHICH CHECK FAILED, BUT NEVER FOLDS A READING. `openUnderS` returns the frame reading
 * (`s-envelope.ts`) for bytes it cannot try, and `key-fails` for a sealed frame the AEAD refuses; a tampered
 * ciphertext and a wrong tree key both draw `key-fails`, because an AEAD cannot tell them apart.
 */

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { defaultCryptoProvider, hex, type RandomProvider } from "./crypto.js";
import { TREE_CHECK_INFO } from "./domains.js";
import {
  readSCarrier, splitSFrame, joinSFrame, S_SEAL_MAGIC, S_SEAL_NONCE_LENGTH, type SCarrierReading,
} from "./s-envelope.js";

declare const treeKeyBrand: unique symbol;
/** A tree key: 32 bytes, minted or opened from a slot, never built from other bytes. */
export type TreeKey = Uint8Array & { readonly [treeKeyBrand]: true };

export const TREE_KEY_LENGTH = 32;

/** Mint a fresh tree key from the CSPRNG — at founding, and at a tree key rotation. */
export function mintTreeKey(rng: RandomProvider = defaultCryptoProvider): TreeKey {
  return rng.getRandomValues(new Uint8Array(TREE_KEY_LENGTH)) as TreeKey;
}

/** The slot unwrap's door: the bytes a slot's AEAD just opened become the tree key. `keyslot.ts` alone calls it. */
export function adoptUnwrappedTreeKey(bytes: Uint8Array): TreeKey {
  if (bytes.length !== TREE_KEY_LENGTH) throw new Error(`treeKey: a tree key rides ${TREE_KEY_LENGTH} bytes`);
  return Uint8Array.from(bytes) as TreeKey;
}

/** Do two TreeKeys hold the same bytes? */
export function treeKeyEquals(a: TreeKey, b: TreeKey): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

/** The check a slot tree carries for `treeKey`: 32 bytes of HKDF-SHA256 under `tree-key-check`, as lowercase hex. */
export function treeKeyCheckOf(treeKey: TreeKey): string {
  return hex(hkdf(sha256, treeKey, new Uint8Array(0), new TextEncoder().encode(TREE_CHECK_INFO), 32));
}

/** Does `treeKey` answer to `check`? Compared in constant time over the hex. */
export function treeKeyAnswersCheck(treeKey: TreeKey, check: string): boolean {
  const mine = treeKeyCheckOf(treeKey);
  if (typeof check !== "string" || check.length !== mine.length) return false;
  let d = 0;
  for (let i = 0; i < mine.length; i++) d |= mine.charCodeAt(i) ^ check.charCodeAt(i);
  return d === 0;
}

function aadFor(carrier: string): Uint8Array {
  if (carrier.length === 0) throw new Error("treeKey: a seal names its carrier; an empty carrier name binds nothing");
  const name = new TextEncoder().encode(carrier);
  const aad = new Uint8Array(S_SEAL_MAGIC.length + name.length);
  aad.set(S_SEAL_MAGIC, 0);
  aad.set(name, S_SEAL_MAGIC.length);
  return aad;
}

/** Seal `plaintext` as the carrier named `carrier`. A fresh nonce every call. */
export function sealUnderS(treeKey: TreeKey, carrier: string, plaintext: Uint8Array, rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  const aad = aadFor(carrier);
  const nonce = rng.getRandomValues(new Uint8Array(S_SEAL_NONCE_LENGTH));
  return joinSFrame(nonce, xchacha20poly1305(treeKey, nonce, aad).encrypt(plaintext));
}

/** What opening a carrier under a tree key finds. Every reading but `opens` carries no plaintext. */
export type TreeKeyOpening =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "key-fails" }
  | { readonly reading: Exclude<SCarrierReading, "sealed"> };

/** Open the bytes standing at the carrier named `carrier`. `null` means nothing stands. */
export function openUnderS(treeKey: TreeKey, carrier: string, bytes: Uint8Array | null): TreeKeyOpening {
  const reading = readSCarrier(bytes);
  if (reading !== "sealed") return { reading };
  const aad = aadFor(carrier);
  const { nonce, ciphertext } = splitSFrame(bytes!);
  try {
    return { reading: "opens", plaintext: xchacha20poly1305(treeKey, nonce, aad).decrypt(ciphertext) };
  } catch {
    return { reading: "key-fails" };
  }
}
