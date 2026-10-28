/**
 * nexus-leaf — the key a held persona presents to ONE Nexus.
 *
 * A stamp that travels into a Nexus names its subject publicly, so it never names the PersonaGroup root: that key
 * binds one human's own devices, and publishing it names the device-group and correlates every island it appears
 * in. The stamp names the persona's PER-NEXUS KEY instead: 32 bytes minted AT RANDOM, never derived from the persona
 * seed, resting sealed and cold in the face's own row for that Nexus (`face-key-custody`, row `face-proof-key`).
 *
 *   · The same persona presents a different key to each Nexus — an observer reading two islands finds no shared
 *     key, and no seed relates them.
 *   · The same Nexus keeps receiving the key the row holds. The AID a caller passes is `nexusAidOf(doc)`, the
 *     genesis epoch CID, which a seal rotation leaves fixed. The face's lineage moves the key only by a signed
 *     hand-over (`nexus-key-reissue`), which the Nexus's gates read off its carriage board.
 *
 * A READ NEVER MINTS. `nexusLeafFor`, `heldNexusLeaves` and `faceNexusLeaf` answer the keys that stand. Only an act
 * that presents the face at a Nexus mints one (`mintNexusLeaf`, `mintFaceNexusLeaf`): a walk taken, a contract
 * signed, a hearth's hosting, a steward's seal.
 *
 * It reads the persona vault and the face's sealed rows and returns key material; it mints no root.
 */

import { listPersonaRoots, makeNodeFsPersonaVault, personaRootExists } from "./node-vessel-identity.js";
import { resolveFace } from "./face-selector.js";
import { mintNexusKey, nexusKeyPublicOf, readNexusKey, readNexusKeys } from "./face-key-custody.js";

/** One persona's key at one Nexus: the public half, and the 32-byte signing seed. */
export interface NexusLeaf {
  readonly handleIndex:  number;
  readonly verifyingKey: string;
  /** The key's signing seed. The caller signs with it and keeps it nowhere. */
  readonly seed:         Uint8Array;
}

const leafOf = (handleIndex: number, seed: Uint8Array): NexusLeaf => ({ handleIndex, verifyingKey: nexusKeyPublicOf(seed), seed });

/** The key persona `handleIndex` holds at the Nexus named by `nexusAid`, or null where none stands. Never mints. */
export async function nexusLeafFor(handleIndex: number, nexusAid: string): Promise<NexusLeaf | null> {
  const seed = await readNexusKey(handleIndex, nexusAid);
  return seed === null ? null : leafOf(handleIndex, seed);
}

/**
 * The key persona `handleIndex` presents at the Nexus named by `nexusAid`, minted at random where none stands. Throws
 * when this vessel holds no root at that index: a face this vessel does not hold presents nowhere from here.
 */
export async function mintNexusLeaf(handleIndex: number, nexusAid: string): Promise<NexusLeaf> {
  const vault = await makeNodeFsPersonaVault();
  if (!(await vault.hasRoot(handleIndex))) throw new Error(`nexus-leaf: this vessel holds no persona at h${handleIndex}`);
  return leafOf(handleIndex, await mintNexusKey(handleIndex, nexusAid));
}

/**
 * Every key this vessel's held personas may present at the Nexus named by `nexusAid`, in roster order. Never mints.
 * A face whose re-issue stands half done offers its standing key and then its successor: a caller that holds the
 * key line presents whichever heads it (`admittedKeyOf`), and a caller that reads the admitted nym alone matches
 * the standing key.
 */
export async function heldNexusLeaves(nexusAid: string): Promise<readonly NexusLeaf[]> {
  const leaves: NexusLeaf[] = [];
  for (const handleIndex of await listPersonaRoots()) {
    for (const seed of await readNexusKeys(handleIndex, nexusAid)) leaves.push(leafOf(handleIndex, seed));
  }
  return leaves;
}

/**
 * The face a command acts as (`resolveFace`: the face named, else the one face standing open), where this vessel holds
 * that face's root; null where it holds none there. Several faces and none named refuse by name (`FaceNotNamed`).
 */
async function actingIndex(named?: number): Promise<number | null> {
  const face = await resolveFace(named);
  return (await personaRootExists(face)) ? face : null;
}

/**
 * The key the acting face holds at the Nexus named by `nexusAid` — or null when this vessel holds no root for that
 * face, or the face holds no key there yet. Never mints. A walker is a person, so its key is that face's; nothing is
 * picked by roster order.
 */
export async function faceNexusLeaf(nexusAid: string, face?: number): Promise<NexusLeaf | null> {
  const acting = await actingIndex(face);
  return acting === null ? null : nexusLeafFor(acting, nexusAid);
}

/** The acting face's key at `nexusAid`, minted at random where none stands; null where this vessel holds no root for it. */
export async function mintFaceNexusLeaf(nexusAid: string, face?: number): Promise<NexusLeaf | null> {
  const acting = await actingIndex(face);
  return acting === null ? null : leafOf(acting, await mintNexusKey(acting, nexusAid));
}
