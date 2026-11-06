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
 * THE WARD KEY RIDES BESIDE IT: the admission names the device's per-face ward key (`wardKey`, the public half of the key a fresh
 * ward unlock of this face on that device opens, `ward-answer.ts`), so a reader knows which key that device's ward signs with.
 * The tag key's signature covers it too (group, device atom, ward key). It is per face like the tag, never vessel-wide, so it
 * links no two faces either. Beside it rides `wardPop`, the ward key's own signature over (group, device atom, ward key) under
 * `ward-key-pop`: the device proves it holds the key it names, so a device that copies another's public half seats nothing.
 *
 * The tag cannot prove the secret belongs to a distinct metal: it separates keys held apart, the way the ward's device count
 * does, and a host compromised below the vessel mints new secrets as it pleases.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8Bytes, canonicalJsonBytes } from "./crypto.js";
import { VESSEL_FACE_TAG_PROOF_DOMAIN, VESSEL_FACE_TAG_SEED_DOMAIN } from "./domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyEd25519 } from "./ed25519-door.js";
import { isWardKey, wardKeyPopImage } from "./ward-answer.js";

const proofImage = (group: string, deviceKey: string, wardKey: string): Uint8Array =>
  canonicalJsonBytes({ domain: VESSEL_FACE_TAG_PROOF_DOMAIN, group, deviceKey: deviceKey.toLowerCase(), wardKey });

/** What an admission act carries for its vessel: the blinded tag, the device's per-face ward key, the tag key's signature over
 *  (group, device atom, ward key), and the ward key's own proof of possession (`wardPop`). */
export interface VesselFaceTagFields { readonly vesselTag: string; readonly vesselSig: string; readonly wardKey: string; readonly wardPop: string }

/**
 * A vessel's tag door: the fields for one device atom in one face. The face's tag secret and its ward stay behind the door, which
 * answers only the tag, the ward key's public half and the tag's signature; a founding and a join each ask it for the atom they admit.
 */
export type VesselFaceTagDoor = (group: string, deviceKey: string) => Promise<VesselFaceTagFields>;

/** The fields an admission act carries for its vessel: the blinded tag, the ward key, the tag key's signature over (group, device
 *  atom, ward key), and `wardSign`'s pop over the same (the ward key signing, inside the act that opened it). */
export async function vesselFaceTagFields(tagSecret: Uint8Array, group: string, deviceKey: string, wardKey: string,
  wardSign: (bytes: Uint8Array) => Promise<string>): Promise<VesselFaceTagFields> {
  if (tagSecret.length !== 32) throw new RangeError("vessel-face-tag: a face's tag secret is 32 bytes");
  if (group.length === 0) throw new RangeError("vessel-face-tag: a tag names its face");
  if (!isWardKey(wardKey)) throw new RangeError("vessel-face-tag: an admission names its device's ward key as 64 hex");
  const wardPop = await wardSign(wardKeyPopImage(group, deviceKey, wardKey));
  const seed = hmac(sha256, tagSecret, utf8Bytes(`${VESSEL_FACE_TAG_SEED_DOMAIN}\n${group}`));
  try {
    return { vesselTag: await ed25519VerifyingKeyFromSeed(seed), vesselSig: await ed25519SignerFromSeed(seed)(proofImage(group, deviceKey, wardKey)), wardKey, wardPop };
  } finally { seed.fill(0); }
}

/** True where the tag's own signature covers this face, this device atom and this ward key. */
export function vesselFaceTagHolds(group: string, deviceKey: string, fields: { readonly vesselTag?: unknown; readonly vesselSig?: unknown; readonly wardKey?: unknown }): boolean {
  if (typeof fields.vesselTag !== "string" || typeof fields.vesselSig !== "string" || !isWardKey(fields.wardKey)) return false;
  try { return verifyEd25519(fields.vesselSig, proofImage(group, deviceKey, fields.wardKey), fields.vesselTag); } catch { return false; }
}
