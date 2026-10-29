/**
 * hosting-face — WHICH FACE A HEARTH'S HOSTING RESTS IN.
 *
 * A hearth hosts walkers in a Nexus under a hosting leaf that one face authorizes, so the state, the spend rows and the carriage
 * rest in that face: `faces/<fcid>/hosting-h<N>/<aid digest>/...`, sealed under the face's own key. The Nexus AID names a service and
 * proves no face, so the binding rests in the face's own subtree and nowhere in the floor index: the face that holds a directory
 * for an AID IS the hosting face of that AID. A reader finds it by the directory name alone (names, never bytes); the first
 * roll founds it under the face it names (`--face N`), else the one face standing open, and refuses by name where several
 * stand and it named none (`FaceNotNamed`).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sha256HexSync } from "@lararium/mesh";
import { faceDir, listFaceFiles, readFaceIndexSync } from "./face-index.js";
import { resolveFace } from "./face-selector.js";
import { larIdentityDir } from "./vessel-paths.js";

const HOSTING_ROOT = /^hosting-h(0|[1-9]\d*)$/;

/** A refusal: hosting needs a face to rest in, and none is named. */
export class HostingFaceAbsent extends Error {
  override readonly name = "HostingFaceAbsent";
  constructor() { super("a hearth's hosting rests in the face that authorizes it, and the floor index names no such face here: unlock the face (`lares vault unlock --face <N>`)"); }
}

/** The digest an AID's hosting directory is named by. */
export const hostingDigest = (nexusAid: string): string => sha256HexSync(nexusAid.trim().toLowerCase()).slice(0, 32);

/** The root directory name one face's hosting rests under. */
export const hostingRoot = (face: number): string => `hosting-h${face}`;

/** One Nexus's hosting directory in face `face`, as the logical name the custody rows resolve (identity home). */
export const hostingRowDir = (face: number, nexusAid: string): string => `${hostingRoot(face)}/${hostingDigest(nexusAid)}`;

/** The face that holds hosting for `nexusAid`, by directory name; null where none does. Reads names alone. */
export function hostingFaceHolding(nexusAid: string): number | null {
  const want = hostingDigest(nexusAid);
  const identity = larIdentityDir();
  for (const [fcid, name] of listFaceFiles(identity, readFaceIndexSync(identity))) {
    const m = HOSTING_ROOT.exec(name);
    if (m && existsSync(join(faceDir(identity, fcid), name, want))) return Number(m[1]);
  }
  return null;
}

/** The hosting face for `nexusAid`: the one holding it, else (where `create`) the face the act names, else the one face standing open. */
export async function hostingFaceOf(nexusAid: string, create: boolean, face?: number): Promise<number | null> {
  const held = hostingFaceHolding(nexusAid);
  if (held !== null || !create) return held;
  return resolveFace(face);
}

/** The directory (a file-system path) one Nexus's hosting rests in, inside face `face`'s own subtree. Null where the floor index names no such face. */
export function hostingDirPath(face: number, nexusAid: string): string | null {
  const identity = larIdentityDir();
  const entry = readFaceIndexSync(identity).faces[face];
  return entry && "fcid" in entry ? join(faceDir(identity, entry.fcid), hostingRoot(face), hostingDigest(nexusAid)) : null;
}
