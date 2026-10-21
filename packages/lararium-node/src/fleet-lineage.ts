/**
 * fleet-lineage — a fleet root's roster per epoch, read the way a gate reads it: from the persona KEL beneath the prefix
 * this vessel's custody anchors name, on the first island board that carries a chain for it.
 *
 * Custody names the prefix (never a document); the board carries the events; the KEL's own verification decides the
 * lineage. A vessel at the floor holds no key to open its anchors, so it reads no lineage and every fleet frontier
 * stands unknown.
 */
import type { Repo } from "@automerge/automerge-repo";
import { materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, personaLineageFromKel, type HandLineage } from "@lararium/mesh";
import { CustodyLocked } from "./custody-holder.js";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { nodeNexusIsland, nodeNexusIslandsBelow } from "./nexus-standing.js";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";

const bare = (root: string): string => root.trim().toLowerCase().replace(/^0x/, "");

export async function fleetLineageOf(repo: Repo, fleetRoot: string, islands: readonly string[]): Promise<HandLineage | null> {
  let prefix: string | null = null;
  try {
    for (const index of await listAnchoredPersonas()) {
      const anchors = await loadIdentityAnchors(index);
      if (anchors?.deviceEdge && bare(anchors.deviceEdge.personaRootDid) === bare(fleetRoot)) { prefix = anchors.personaKelPrefix ?? null; break; }
    }
  } catch (e) { if (e instanceof CustodyLocked) return null; throw e; }
  if (!prefix) return null;
  for (const island of islands) {
    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel");
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    const lineage = chain ? personaLineageFromKel(chain) : null;
    if (lineage) return lineage;
  }
  return null;
}

/** The same read from a CLI door: the islands are the ones this vessel's boot resolves (the island, then those below it). */
export async function fleetLineageForVessel(repo: Repo, fleetRoot: string): Promise<HandLineage | null> {
  const ownVesselKey = await loadVesselVerifyingKey();
  return fleetLineageOf(repo, fleetRoot, [nodeNexusIsland({ ownVesselKey }), ...nodeNexusIslandsBelow({ ownVesselKey })]);
}
