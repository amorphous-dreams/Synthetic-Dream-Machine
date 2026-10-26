import { faceAtomKeyFromSeed, type FaceAtomKey } from "@lararium/mesh";
import "./found-route.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { loadActivePersonaIndex } from "../src/node-vessel-identity.js";
import { loadFaceAtom, standFaceAtom } from "../src/face-atom-store.js";
import { loadIdentityAnchors, persistIdentityAnchors } from "../src/identity-anchors.js";

/**
 * Stand one face's custody rows for a test: its random atom seed and its anchors, as a founded face rests them.
 * Call after the vessel's custody and persona root stand.
 */
export async function seedFaceAtom(handleIndex = 0, personaGroupId = `group-fixture-h${handleIndex}`): Promise<FaceAtomKey> {
  await ensureFaceCustodyOfGroup(personaGroupId);
  const seed = await standFaceAtom(personaGroupId);
  await persistIdentityAnchors({ personaGroupId, meshCabalDocIdHex: "ab".repeat(32) }, handleIndex);
  return faceAtomKeyFromSeed(seed, personaGroupId);
}

/** The standing atom's seed for one face, as the row rests it. */
export async function atomSeedOf(handleIndex = 0): Promise<Uint8Array> {
  const seed = await loadFaceAtom(handleIndex);
  if (!seed) throw new Error(`no atom stands for face h${handleIndex}`);
  return seed;
}

/** The standing atom's verifying key for one face. */
export async function atomKeyOf(handleIndex = 0): Promise<string> {
  const anchors = await loadIdentityAnchors(handleIndex);
  if (!anchors) throw new Error(`no anchors stand for face h${handleIndex}`);
  return faceAtomKeyFromSeed(await atomSeedOf(handleIndex), anchors.personaGroupId).key;
}

/** The atom key of the face the vessel wears now. */
export async function wornAtomKey(): Promise<string> {
  return atomKeyOf((await loadActivePersonaIndex()) ?? 0);
}
