/**
 * vessel-face-tag: the blinded per-face tag that closes one vessel admitted twice into one face.
 *
 * A vessel wears many faces and holds one TAG SECRET per face: 32 random bytes the vessel mints when it founds or asks to
 * join that face, resting in that face's own custody row on that vessel alone. No seed derives it, so no place, device or
 * root seed computes any face's tag, and a holder of every seed this vessel keeps links none of its faces. Its admission
 * into a face carries a TAG, the public half of a key derived as HMAC(tag secret, face group id) under a minted domain;
 * it never equals the vessel's public key. The tag key signs the admission it rides (group and device atom), so the tag
 * proves a holder of that face's tag secret stood behind that atom, and the face's fold refuses a second admission whose
 * tag already stands (`vessel-already-admitted`): a re-join on the same face reads its row and presents the same tag.
 *
 * The tag cannot prove the secret belongs to a distinct metal: it separates keys held apart, the way the ward's device count
 * does, and a host compromised below the vessel mints new secrets as it pleases.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8Bytes, canonicalJsonBytes } from "./crypto.js";
import { VESSEL_FACE_TAG_PROOF_DOMAIN, VESSEL_FACE_TAG_SEED_DOMAIN } from "./domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyEd25519 } from "./ed25519-door.js";

const proofImage = (group: string, deviceKey: string): Uint8Array =>
  canonicalJsonBytes({ domain: VESSEL_FACE_TAG_PROOF_DOMAIN, group, deviceKey: deviceKey.toLowerCase() });

/** What an admission act carries for its vessel: the blinded tag, and the tag key's signature over (group, device atom). */
export interface VesselFaceTagFields { readonly vesselTag: string; readonly vesselSig: string }

/**
 * A vessel's tag door: the fields for one device atom in one face. The face's tag secret stays behind the door, which
 * answers only the tag and its signature; a founding and a join each ask it for the atom they admit.
 */
export type VesselFaceTagDoor = (group: string, deviceKey: string) => Promise<VesselFaceTagFields>;

/** The fields an admission act carries for its vessel: the blinded tag and the tag key's signature over (group, device atom). */
export async function vesselFaceTagFields(tagSecret: Uint8Array, group: string, deviceKey: string): Promise<VesselFaceTagFields> {
  if (tagSecret.length !== 32) throw new RangeError("vessel-face-tag: a face's tag secret is 32 bytes");
  if (group.length === 0) throw new RangeError("vessel-face-tag: a tag names its face");
  const seed = hmac(sha256, tagSecret, utf8Bytes(`${VESSEL_FACE_TAG_SEED_DOMAIN}\n${group}`));
  try {
    return { vesselTag: await ed25519VerifyingKeyFromSeed(seed), vesselSig: await ed25519SignerFromSeed(seed)(proofImage(group, deviceKey)) };
  } finally { seed.fill(0); }
}

/** True where the tag's own signature covers this face and this device atom. */
export function vesselFaceTagHolds(group: string, deviceKey: string, fields: { readonly vesselTag?: unknown; readonly vesselSig?: unknown }): boolean {
  if (typeof fields.vesselTag !== "string" || typeof fields.vesselSig !== "string") return false;
  try { return verifyEd25519(fields.vesselSig, proofImage(group, deviceKey), fields.vesselTag); } catch { return false; }
}
