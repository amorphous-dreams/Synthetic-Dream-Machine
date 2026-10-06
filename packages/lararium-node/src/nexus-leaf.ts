/**
 * nexus-leaf — the key a held persona presents to ONE Nexus.
 *
 * A stamp that travels into a Nexus names its subject publicly, so it never names the PersonaGroup
 * root: that key binds one human's own devices, and publishing it names the device-group and correlates
 * every island it appears in. The stamp names the persona's per-Nexus LEAF,
 * `m / handle' / context' / nexus-scope'`, derived from the persona's root seed under the NEXUS scope
 * domain (`deriveNexusScopedKey`).
 *
 *   · The same persona presents a different leaf to each Nexus — an observer reading two islands finds
 *     no shared key.
 *   · The same Nexus always receives the same leaf. The AID a caller passes is `realmIdOfCharter(doc)`,
 *     the genesis epoch CID, which a seal rotation leaves fixed.
 *
 * THE CONTEXT INDEX IS THE PUBLIC FACE'S, `PERSONA_GLAMOUR_CONTEXT`. The leaf hangs one hardened level
 * beneath the face's inception rung `m / handle' / 0'`. Every level hardens, so neither the face's
 * public key nor the root's reveals which leaves descend from it. The face's rotation ladder walks
 * `m / handle' / 1'`, `2'`, … at depth two, so it never lands on a leaf and never moves one: a Nexus
 * keeps the key it was given across every rotation of the face.
 *
 * It reads the persona vault and returns key material; it writes nothing and mints no root.
 */

import { deriveNexusScopedKey, hexToBytes, PERSONA_GLAMOUR_CONTEXT } from "@lararium/mesh";
import { listPersonaRoots, loadPersonaGroupRootSeed } from "./node-vessel-identity.js";

/** One persona's leaf at one Nexus: the public half, and the 32-byte signing seed. */
export interface NexusLeaf {
  readonly handleIndex:  number;
  readonly verifyingKey: string;
  /** The leaf's signing seed. The caller signs with it and keeps it nowhere. */
  readonly seed:         Uint8Array;
}

/**
 * The leaf persona `handleIndex` presents to the Nexus named by `nexusAid`. Throws when this vessel holds
 * no root at that index — a leaf derives from a held seed or not at all.
 */
export async function nexusLeafFor(handleIndex: number, nexusAid: string): Promise<NexusLeaf> {
  const root = await loadPersonaGroupRootSeed(handleIndex);
  const kp   = await deriveNexusScopedKey(root, handleIndex, PERSONA_GLAMOUR_CONTEXT, nexusAid);
  return { handleIndex, verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
}

/** Every leaf this vessel's held personas present to the Nexus named by `nexusAid`, in roster order. */
export async function heldNexusLeaves(nexusAid: string): Promise<readonly NexusLeaf[]> {
  const leaves: NexusLeaf[] = [];
  for (const handleIndex of await listPersonaRoots()) leaves.push(await nexusLeafFor(handleIndex, nexusAid));
  return leaves;
}
