/**
 * A face custody key rests in its own slot tree. Its seal authenticates the store, owner, row name,
 * kind and complete reference supplied by the caller's authenticated row selector.
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { defaultCryptoProvider, type RandomProvider } from "./crypto.js";
import { CUSTODY_D_DOMAIN } from "./domains.js";
import { encodeCarrierContext } from "./custody-carrier-context.js";
import { FCK_SEAL_MAGIC, FCK_SEAL_NONCE_LENGTH, joinFckFrame, readFckCarrier, splitFckFrame, type FckCarrierReading } from "./fck-envelope.js";
import { mintVk, type VesselKey } from "./vk.js";
import type { KeyClass } from "./key-class.js";

export type FaceCustodyKey = VesselKey;
export const mintFck = (rng: RandomProvider = defaultCryptoProvider): FaceCustodyKey => mintVk(rng);

export interface FaceCarrier {
  readonly name: string;
  readonly path: string;
  readonly kind: string;
  readonly ref: string;
  readonly owner: string;
  readonly store: string;
  readonly keyClass?: KeyClass | null;
}

export function faceCarrierContext(c: FaceCarrier): Uint8Array {
  return encodeCarrierContext({ domain: CUSTODY_D_DOMAIN, store: c.store, owner: c.owner, row: c.name, kind: c.kind, ref: c.ref });
}

function aadFor(c: FaceCarrier): Uint8Array {
  const context = faceCarrierContext(c);
  const aad = new Uint8Array(FCK_SEAL_MAGIC.length + context.length);
  aad.set(FCK_SEAL_MAGIC);
  aad.set(context, FCK_SEAL_MAGIC.length);
  return aad;
}

export function sealUnderFck(fck: FaceCustodyKey, c: FaceCarrier, plaintext: Uint8Array, rng: RandomProvider = defaultCryptoProvider): Uint8Array {
  const nonce = rng.getRandomValues(new Uint8Array(FCK_SEAL_NONCE_LENGTH));
  return joinFckFrame(nonce, xchacha20poly1305(fck, nonce, aadFor(c)).encrypt(plaintext));
}

export type FckOpening =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "key-fails" }
  | { readonly reading: Exclude<FckCarrierReading, "sealed"> };

export function openUnderFck(fck: FaceCustodyKey, c: FaceCarrier, bytes: Uint8Array | null): FckOpening {
  const reading = readFckCarrier(bytes);
  if (reading !== "sealed") return { reading };
  const { nonce, ciphertext } = splitFckFrame(bytes!);
  try { return { reading: "opens", plaintext: xchacha20poly1305(fck, nonce, aadFor(c)).decrypt(ciphertext) }; }
  catch { return { reading: "key-fails" }; }
}
