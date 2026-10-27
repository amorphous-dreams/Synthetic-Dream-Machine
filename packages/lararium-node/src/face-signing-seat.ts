import { faceAtomKeyFromSeed } from "@lararium/mesh";
import { resolveFace } from "./face-selector.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";

export class FaceSigningRefused extends Error {
  constructor(readonly why: "face-not-named" | "face-atom-absent") {
    super(`[face-signing] ${why}: select and unlock a face with \`lares vault unlock --face N\``);
    this.name = "FaceSigningRefused";
  }
}

/** One selected PersonaGroup's atom signs its face relations. */
export async function faceSigningSeat(named?: number): Promise<{ readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }> {
  let handleIndex: number;
  try { handleIndex = await resolveFace(named); }
  catch { throw new FaceSigningRefused("face-not-named"); }
  const anchors = await loadIdentityAnchors(handleIndex);
  const seed = anchors ? await loadFaceAtomOfGroup(anchors.personaGroupId) : null;
  if (!seed || !anchors) throw new FaceSigningRefused("face-atom-absent");
  return faceAtomKeyFromSeed(seed, anchors.personaGroupId);
}
