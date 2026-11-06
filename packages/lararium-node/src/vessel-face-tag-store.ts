/**
 * vessel-face-tag-store — THE TAG SECRET OF EACH FACE ON A NODE VESSEL, one D row per face (`vessel-face-tag`).
 *
 *   vessel-face-tag      FACE-HOT. The face's tag secret: 32 random bytes this vessel mints the first time it asks to
 *                        join the face, or founds it, sealed under that face's custody key (FCK) in the face's own
 *                        directory. Its file names a digest of the face's PersonaGroup. A re-join on the same face reads
 *                        it and presents the same tag, so the face's fold refuses a second seat for this vessel.
 *   vessel-face-tag-ask  FACE-HOT. The same secret while a founding stands under its ask and no group binds the face
 *                        yet; the founding's settle moves it onto the group's row.
 *
 * No seed derives the secret: the place seed, the floor key and every face root stand apart from it, so a holder of
 * any of them computes no face's tag and links none of this vessel's faces (stable-founding-road#/rulings). Both rows
 * stay on this vessel: a bundle restored onto another device carries none, so a second device never wears this one's
 * tag. A place rotation leaves every row standing: the tag answers to the face, never to the place.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { vesselFaceTagFields, type VesselFaceTagDoor } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { faceStandingCustody, moveCustodyRow, readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { personaGroupDigest } from "./persona-group-file.js";
import { larIdentityDir } from "./vessel-paths.js";

/** A face's tag secret, for the carrier table: `vessel-face-tag-g<64 hex>.bin`. */
export const VESSEL_FACE_TAG_FILE = /^vessel-face-tag-g([0-9a-f]{64})\.bin$/;
/** A founding face's tag secret under its ask, for the carrier table: `vessel-face-tag-ask-<64 hex>.bin`. */
export const VESSEL_FACE_TAG_ASK_FILE = /^vessel-face-tag-ask-([0-9a-f]{64})\.bin$/;

/** The row a face's tag secret rests in, named by a digest of its PersonaGroup. */
export const vesselFaceTagFile = (personaGroup: string): string => `vessel-face-tag-g${personaGroupDigest(personaGroup)}.bin`;
/** The row a founding face's tag secret rests in while its ask names the face. */
export const vesselFaceTagAskFile = (askDigest: string): string => {
  if (!/^[0-9a-f]{64}$/.test(askDigest)) throw new RangeError("vessel-face-tag-store: an ask digest reads as 64 hex");
  return `vessel-face-tag-ask-${askDigest}.bin`;
};

/** The secret at `file`, minted at random where none stands, under one custody holder. The caller zeroes its copy. */
function standSecret(file: string): Promise<Uint8Array> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  return updateCustodyRow("identity", file, (standing) => {
    if (standing !== null) {
      if (standing.length !== 32) throw new CustodyRowUnavailable("identity", file, "malformed");
      return { plaintext: null, value: Uint8Array.from(standing) };
    }
    const fresh = new Uint8Array(randomBytes(32));
    return { plaintext: Uint8Array.from(fresh), value: fresh };
  });
}

/** The door over the row at `file`: it answers the tag and its signature, and zeroes the secret it read. */
const doorOver = (fileOf: (group: string) => Promise<string>): VesselFaceTagDoor => async (group, deviceKey) => {
  const secret = await standSecret(await fileOf(group));
  try { return await vesselFaceTagFields(secret, group, deviceKey); } finally { secret.fill(0); }
};

/**
 * THE JOIN'S TAG DOOR: the face's own row, minted on the first ask. The face's custody stands before the door asks
 * (`ensureFaceCustodyOfGroup`), so the row rests under that face's key and no other.
 */
export function vesselFaceTagDoor(): VesselFaceTagDoor {
  return doorOver(async (group) => vesselFaceTagFile(group));
}

/**
 * THE FOUNDING'S TAG DOOR: the secret the founding already rests, read where it stands (the ask's row, or the group's
 * once a settle moved it); none standing, a fresh one mints in the ask's row while the ask names the face, else in the
 * group's. A founding that stops anywhere between its first tag and its settle presents the same tag when it runs again.
 */
export function foundingVesselFaceTagDoor(askDigest: string): VesselFaceTagDoor {
  return async (group, deviceKey) => {
    const askFile = vesselFaceTagAskFile(askDigest), groupFile = vesselFaceTagFile(group);
    const askStands = await faceStandingCustody({ ask: askDigest }) !== null;
    const groupStands = await faceStandingCustody({ group: personaGroupDigest(group) }) !== null;
    const read = async (file: string): Promise<Uint8Array | null> => {
      const bytes = await readCustodyRow("identity", file);
      if (bytes !== null && bytes.length !== 32) { bytes.fill(0); throw new CustodyRowUnavailable("identity", file, "malformed"); }
      return bytes;
    };
    const standing = (askStands ? await read(askFile) : null) ?? (groupStands ? await read(groupFile) : null);
    const secret = standing ?? await standSecret(askStands ? askFile : groupFile);
    try { return await vesselFaceTagFields(secret, group, deviceKey); } finally { secret.fill(0); }
  };
}

/** The founding's settle: the ask's tag secret moves onto the group's row. An ask that holds none moves nothing. */
export async function settleFoundingVesselFaceTag(askDigest: string, personaGroup: string): Promise<void> {
  const source = vesselFaceTagAskFile(askDigest);
  const secret = await readCustodyRow("identity", source);
  if (secret === null) return;
  try { await moveCustodyRow("identity", source, vesselFaceTagFile(personaGroup), secret); } finally { secret.fill(0); }
}
