/**
 * hearth-aid — THE HEARTH A FACE BINDS TO: the Nexus AID of this vessel's seed charter, or, on a vessel an admit
 * joined, the AID its hearth's dial pin carries. A fleet relation (a device edge, a dyad scope, a cabal sentinel's
 * seed) commits to it, so a relation minted at one of a human's hearths names that hearth and no other.
 * Null where neither stands: a place with no seed charter holds no hearth for a face to bind to.
 */
import { nexusAidOf } from "@lararium/mesh";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { readHearthDialPin } from "./hearth-dial-pin.js";
import { readNexusDoc } from "./nexus-doc.js";
import { larBootstrapPath, larSealHome } from "./vessel-paths.js";

export function hearthAid(): string | null {
  const own = nexusAidOf(readNexusDoc(larSealHome()));
  if (own !== null) return own;
  const pin = readHearthDialPin(larBootstrapPath());
  return pin?.islandKind === "charter" ? pin.islandScope ?? null : null;
}

/**
 * Whether any face this vessel holds anchors for binds `aid` by its device edge. The faces' own sealed anchors
 * answer, never the bootstrap's pin: a re-seeded bootstrap names no face while every edge still binds.
 */
export async function aFaceBinds(aid: string | null): Promise<boolean> {
  if (aid === null) return false;
  for (const index of await listAnchoredPersonas()) {
    if ((await loadIdentityAnchors(index))?.deviceEdge?.hearthTrueName === aid) return true;
  }
  return false;
}
