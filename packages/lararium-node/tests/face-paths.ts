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
