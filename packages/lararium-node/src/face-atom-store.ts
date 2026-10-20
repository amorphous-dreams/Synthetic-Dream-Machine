/** The face atom seed rests in the identity home under the seated vessel key. */
import { mkdirSync } from "node:fs";
import { larIdentityDir } from "./vessel-paths.js";
import { readCustodyRow, writeCustodyRow } from "./custody-seat.js";
import { faceAtomKeyFromSeed } from "@lararium/mesh";
import { loadActivePersonaIndex } from "./node-vessel-identity.js";
import { loadIdentityAnchors } from "./identity-anchors.js";

export const FACE_ATOM_FILE = /^face-atom-h(\d+)\.bin$/;

export function faceAtomFile(handleIndex: number): string {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) throw new Error("face atom handle index must be a nonnegative integer");
  return `face-atom-h${handleIndex}.bin`;
}

export async function persistFaceAtom(handleIndex: number, seed: Uint8Array): Promise<void> {
  if (seed.length !== 32) throw new Error("face atom seed must hold 32 bytes");
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  await writeCustodyRow("identity", faceAtomFile(handleIndex), seed);
}

export function loadFaceAtom(handleIndex: number): Promise<Uint8Array | null> {
  return readCustodyRow("identity", faceAtomFile(handleIndex));
}

/** The active face's atom key names its local realm and edge ledgers. */
export async function loadWornFaceAtomKey(): Promise<string> {
  const index = (await loadActivePersonaIndex()) ?? 0;
  const anchors = await loadIdentityAnchors(index);
  const seed = await loadFaceAtom(index);
  if (!anchors || !seed) throw new Error("this face holds no atom; re-found or re-admit it");
  return faceAtomKeyFromSeed(seed, anchors.personaGroupId).key;
}
