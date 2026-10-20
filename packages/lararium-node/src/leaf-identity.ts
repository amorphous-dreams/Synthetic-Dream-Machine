/**
 * leaf-identity — the LIGHT sovereign identity a short-lived leaf actor carries.
 *
 * A one-shot `lares` CLI run (or an AI-agent turn) acts as a sovereign peer
 * WITHOUT booting keyhive (operator-peer #actor-parity OP-AP5, meme
 * lar:///ha.ka.ba/lararium/mesh/operator-peer). It holds only:
 *   - the operator Ed25519 seed → a bare signer (no keyhive), and
 *   - the cached ContactCard JSON minted once at `lares vessel found`.
 * With these it presents a self-certifying identity at a peer's gate (the
 * carriage's gate-native pull reads it through `open-node-vessel`), and never
 * boots the keyhive engine.
 *
 * The ContactCard carries no expiry/nonce — re-presented forever; proof freshness
 * rides the gate's own handshake, never the cached card.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/leaf-identity
 */

import { ed25519SignerFromSeed } from "@lararium/mesh";
import type { LeafIdentity } from "@lararium/mesh";
import { loadVesselSigningSeed, loadVesselVerifyingKey, loadVesselCard } from "./node-vessel-identity.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadVeilArchive } from "./identity-anchors.js";
import { faceAtomKeyFromSeed } from "@lararium/mesh";
import { KeyhiveProvider, InMemoryEventStore } from "@lararium/keyhive";

// LeafIdentity lifted to platform-blind mesh (both vessels + the isomorphic adapter share it);
// re-exported here for node consumers.
export type { LeafIdentity } from "@lararium/mesh";

/**
 * Load the operator's light leaf identity from disk (seed + cached card). Throws
 * when either artifact is absent — the caller must run `lares vessel found` first (it
 * generates the keypair and mints + caches the ContactCard).
 */
export async function loadLeafIdentity(arm: "place" | "face" = "place", face?: { handleIndex: number; personaGroupId: string }): Promise<LeafIdentity> {
  if (arm === "face") {
    if (!face) throw new Error("a face leaf names its worn handle and PersonaGroup");
    const seed = await loadFaceAtomOfGroup(face.personaGroupId);
    if (!seed) throw new Error("this face holds no atom; re-found or re-admit it");
    const archiveBytes = await loadVeilArchive(face.handleIndex);
    if (!archiveBytes) throw new Error("this face holds no atom archive; re-found or re-admit it");
    const atom = faceAtomKeyFromSeed(seed, face.personaGroupId);
    const provider = new KeyhiveProvider();
    try {
      await provider.init({ seed, archiveBytes, eventStore: new InMemoryEventStore() });
      const contactCard = new TextDecoder().decode(await provider.contactCard());
      return { arm: "face", contactCard, peerPubKey: atom.key, sign: atom.sign };
    } finally { await provider.dispose(); }
  }
  const [seed, peerPubKey, contactCard] = await Promise.all([
    loadVesselSigningSeed(),
    loadVesselVerifyingKey(),
    loadVesselCard(),
  ]);
  return { arm: "place", contactCard, peerPubKey, sign: ed25519SignerFromSeed(seed) };
}
