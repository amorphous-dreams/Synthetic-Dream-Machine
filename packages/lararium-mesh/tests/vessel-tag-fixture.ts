/**
 * vessel-tag-fixture — numbered test vessels and the tag door each one answers, for every suite that admits a device.
 *
 * A test vessel's secret reads as a numbered label hashed: synthetic, repeatable, and no key any vessel holds. The tag
 * fields come from the same `vesselFaceTagFields` the vessels' own doors call, so a fixture admission meets the fold's
 * tag law as a vessel's does: one number per vessel, and two admissions of one number into one face refuse by name.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8Bytes } from "../src/crypto.js";
import { vesselFaceTagFields, type VesselFaceTagDoor, type VesselFaceTagFields } from "../src/vessel-face-tag.js";

/** Test vessel `n`'s 32-byte secret. */
export const testVesselSecret = (n: number): Uint8Array => sha256(utf8Bytes(`lararium test vessel secret ${n}`));

/** Test vessel `n`'s tag door: the shape a vessel's own door answers, over the numbered secret. */
export const testVesselTagDoor = (n: number): VesselFaceTagDoor =>
  (group, deviceKey) => vesselFaceTagFields(testVesselSecret(n), group, deviceKey);

/** Test vessel `n`'s tag fields for one atom in one face. */
export const testVesselTag = (n: number, group: string, deviceKey: string): Promise<VesselFaceTagFields> =>
  testVesselTagDoor(n)(group, deviceKey);

/** An admission act's fields for one atom, tagged by test vessel `n`. */
export const taggedAdmission = async (n: number, group: string, deviceKey: string): Promise<{ deviceKey: string } & VesselFaceTagFields> =>
  ({ deviceKey, ...(await testVesselTag(n, group, deviceKey)) });
