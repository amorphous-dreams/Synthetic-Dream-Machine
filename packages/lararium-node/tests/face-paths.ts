/** Where a face's sealed rows rest on disk, for a suite that reads their bytes: `faces/<fcid>/<file>`. */
import { faceFileNames, faceFilePathSync } from "../src/face-index.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { larIdentityDir } from "../src/vessel-paths.js";

/** The path of a file that rests in the face of `group`. */
export const groupRowPath = (group: string, file: string): string => faceFilePathSync(larIdentityDir(), { group: personaGroupDigest(group) }, file);
/** The path of a file that rests in the face founded under `askDigest`. */
export const askRowPath = (askDigest: string, file: string): string => faceFilePathSync(larIdentityDir(), { ask: askDigest }, file);
/** Every file name resting in any face's directory, sorted and de-duplicated. */
export const faceRowNames = (): string[] => faceFileNames(larIdentityDir());

/** The path of a handle-index row (`anchors-h2.json`, `seat-key-h0-<hex>.bin`, ...): in the face at the ordinal its file name carries. */
export const handleRowPath = (file: string): string => {
  const m = /-h(\d+)(?=[-.])/.exec(file);
  if (!m) throw new Error(`${file} names no handle index`);
  return faceFilePathSync(larIdentityDir(), { ordinal: Number(m[1]) }, file);
};
/** As {@link handleRowPath}, over an identity home the caller names (a suite that holds its own homes). */
export const handleRowPathIn = (identityDir: string, file: string): string => {
  const m = /-h(\d+)(?=[-.])/.exec(file);
  if (!m) throw new Error(`${file} names no handle index`);
  return faceFilePathSync(identityDir, { ordinal: Number(m[1]) }, file);
};
