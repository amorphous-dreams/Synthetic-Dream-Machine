/**
 * fleet-lineage — a fleet root's roster per epoch, read the way a gate reads it: from the persona KEL beneath the prefix
 * this vessel's custody anchors name, on the first island board that carries a chain for it.
 *
 * Custody names the prefix (never a document); the board carries the events; the KEL's own verification decides the
 * lineage. A vessel at the floor holds no key to open its anchors, so it reads no lineage and every fleet frontier
 * stands unknown.
 */
import type { Repo } from "@automerge/automerge-repo";
import { materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix, readFace, type FaceAnchor, type FaceReading, type HandLineage, type PersonaKelEvent } from "@lararium/mesh";
import { CustodyLocked } from "./custody-holder.js";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { nodeNexusIsland, nodeNexusIslandsBelow } from "./nexus-standing.js";
import { loadVesselVerifyingKey } from "./node-vessel-identity.js";

const bare = (root: string): string => root.trim().toLowerCase().replace(/^0x/, "");

export async function fleetFaceChainOf(repo: Repo, fleetRoot: string, islands: readonly string[], anchor?: FaceAnchor | null): Promise<{ face: FaceReading; chain: readonly PersonaKelEvent[] } | null> {
  let prefix: string | null = null;
  try {
    for (const index of await listAnchoredPersonas()) {
      // A malformed sibling row leaves its own face unread and no other: only a locked custody ends the walk.
      let anchors: Awaited<ReturnType<typeof loadIdentityAnchors>>;
      try { anchors = await loadIdentityAnchors(index); }
      catch (e) { if (e instanceof CustodyLocked) throw e; continue; }
      if (anchors?.deviceEdge && bare(anchors.deviceEdge.personaRootDid) === bare(fleetRoot)) { prefix = anchors.personaKelPrefix ?? null; break; }
    }
  } catch (e) { if (e instanceof CustodyLocked) return null; throw e; }
  if (!prefix) return null;
  for (const island of islands) {
    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(island), "board:persona-kel");
    const chain = personaKelChainForPrefix(board.doc(), prefix);
    const face = readFace(chain, anchor);
    if (face && chain) return { face, chain };
  }
  return null;
}

export async function fleetFaceOf(repo: Repo, fleetRoot: string, islands: readonly string[], anchor?: FaceAnchor | null): Promise<FaceReading | null> {
  return (await fleetFaceChainOf(repo, fleetRoot, islands, anchor))?.face ?? null;
}

/** The islands this vessel's boot resolves: its own, then those below it. */
async function vesselIslands(): Promise<string[]> {
  const ownVesselKey = await loadVesselVerifyingKey();
  return [nodeNexusIsland({ ownVesselKey }), ...nodeNexusIslandsBelow({ ownVesselKey })];
}

export async function fleetFaceChainForVessel(repo: Repo, fleetRoot: string, anchor?: FaceAnchor | null) {
  return fleetFaceChainOf(repo, fleetRoot, await vesselIslands(), anchor);
}

/** The fleet root's lineage, for the readers that take the roster alone. */
export async function fleetLineageOf(repo: Repo, fleetRoot: string, islands: readonly string[]): Promise<HandLineage | null> {
  return (await fleetFaceOf(repo, fleetRoot, islands))?.lineage ?? null;
}

/** The same read from a CLI door: the islands are the ones this vessel's boot resolves (the island, then those below it). */
export async function fleetFaceForVessel(repo: Repo, fleetRoot: string, anchor?: FaceAnchor | null): Promise<FaceReading | null> {
  return fleetFaceOf(repo, fleetRoot, await vesselIslands(), anchor);
}

export async function fleetLineageForVessel(repo: Repo, fleetRoot: string): Promise<HandLineage | null> {
  return (await fleetFaceForVessel(repo, fleetRoot))?.lineage ?? null;
}
