/**
 * leaf-identity — present one selected face's atom and ContactCard at a peer gate.
 * The face's atom and veil archive open through its custody rows. A faceless
 * carriage uses the public place card and pin without a Keyhive leaf identity.
 */

import type { LeafIdentity } from "@lararium/mesh";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadVeilArchive } from "./identity-anchors.js";
import { faceAtomKeyFromSeed } from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore } from "@lararium/keyhive";

// LeafIdentity lifted to platform-blind mesh (both vessels + the isomorphic adapter share it);
// re-exported here for node consumers.
export type { LeafIdentity } from "@lararium/mesh";

/**
 * Load the selected face's light leaf identity from its atom and veil archive.
 */
export async function loadLeafIdentity(face: { handleIndex: number; personaGroupId: string }): Promise<LeafIdentity> {
  if (!face) throw new Error("a face leaf names its worn handle and PersonaGroup");
  const seed = await loadFaceAtomOfGroup(face.personaGroupId);
  if (!seed) throw new Error("this face holds no atom; re-found or re-admit it");
  const archiveBytes = await loadVeilArchive(face.personaGroupId);
  if (!archiveBytes) throw new Error("this face holds no atom archive; re-found or re-admit it");
  const atom = faceAtomKeyFromSeed(seed, face.personaGroupId);
  const provider = new KeyhiveProvider();
  try {
    await provider.init({ seed, archiveBytes, eventStore: new InMemoryEventStore() });
    const contactCard = new TextDecoder().decode(await provider.contactCard());
    return { arm: "face", contactCard, peerPubKey: atom.key, sign: atom.sign };
  } finally { await provider.dispose(); }
}
