/**
 * vessel-face-tag: the blinded per-face tag that closes one vessel admitted twice into one face.
 *
 * A vessel holds one device secret and wears many faces. Its admission into a face carries a TAG that is the public half of a
 * key derived as HMAC(device secret, face group id) under a minted domain. The same vessel's tags in two faces differ and
 * neither equals the vessel's public key, so a reader of both faces learns nothing that links them. The tag key signs the
 * admission it rides (group and device atom), so the tag proves a holder of the vessel secret stood behind that atom, and the
 * face's fold refuses a second admission whose tag already stands (`vessel-already-admitted`).
 *
 * The tag cannot prove the secret belongs to a distinct metal: it separates keys held apart, the way the ward's device count
 * does, and a host compromised below the vessel mints new secrets as it pleases.
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8Bytes, canonicalJsonBytes } from "./crypto.js";
import { VESSEL_FACE_TAG_PROOF_DOMAIN, VESSEL_FACE_TAG_SECRET_DOMAIN, VESSEL_FACE_TAG_SEED_DOMAIN } from "./domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyEd25519 } from "./ed25519-door.js";

const proofImage = (group: string, deviceKey: string): Uint8Array =>
  canonicalJsonBytes({ domain: VESSEL_FACE_TAG_PROOF_DOMAIN, group, deviceKey: deviceKey.toLowerCase() });

/** What an admission act carries for its vessel: the blinded tag, and the tag key's signature over (group, device atom). */
export interface VesselFaceTagFields { readonly vesselTag: string; readonly vesselSig: string }

/**
 * A vessel's tag door: the fields for one device atom in one face. The vessel secret stays behind the door, which
 * answers only the tag and its signature; a founding and a join each ask it for the atom they admit.
 */
export type VesselFaceTagDoor = (group: string, deviceKey: string) => Promise<VesselFaceTagFields>;

/**
 * The vessel secret a signing seed stands behind: RFC 5869 HKDF-SHA256, empty salt, the tag secret's domain as
 * `info`, 32 bytes, the same child the node's floor key door derives. A FRESH buffer its caller overwrites.
 */
export function vesselFaceTagSecret(signingSeed: Uint8Array): Uint8Array {
  if (signingSeed.length !== 32) throw new RangeError("vessel-face-tag: a signing seed is 32 bytes");
  return hkdf(sha256, signingSeed, new Uint8Array(0), utf8Bytes(VESSEL_FACE_TAG_SECRET_DOMAIN), 32);
}

/** The fields an admission act carries for its vessel: the blinded tag and the tag key's signature over (group, device atom). */
export async function vesselFaceTagFields(vesselSecret: Uint8Array, group: string, deviceKey: string): Promise<VesselFaceTagFields> {
  if (vesselSecret.length !== 32) throw new RangeError("vessel-face-tag: a vessel secret is 32 bytes");
  if (group.length === 0) throw new RangeError("vessel-face-tag: a tag names its face");
  const seed = hmac(sha256, vesselSecret, utf8Bytes(`${VESSEL_FACE_TAG_SEED_DOMAIN}\n${group}`));
  try {
    return { vesselTag: await ed25519VerifyingKeyFromSeed(seed), vesselSig: await ed25519SignerFromSeed(seed)(proofImage(group, deviceKey)) };
  } finally { seed.fill(0); }
}

/** True where the tag's own signature covers this face and this device atom. */
export function vesselFaceTagHolds(group: string, deviceKey: string, fields: { readonly vesselTag?: unknown; readonly vesselSig?: unknown }): boolean {
  if (typeof fields.vesselTag !== "string" || typeof fields.vesselSig !== "string") return false;
  try { return verifyEd25519(fields.vesselSig, proofImage(group, deviceKey), fields.vesselTag); } catch { return false; }
}
