/**
 * edge-board — how THIS vessel reads an edge board: the board replica, the vessel's own ledger, the charter
 * it holds, in one call every door shares.
 *
 * A door never folds a board it did not check, and never forgets an act it once counted (kapae#/accretion):
 * each read keeps what counted in the vessel's own ledger and writes a kept act back onto a board that lost
 * it (`readLedgeredEdgeBoard`, in mesh, so a browser leaf composes the same read). This module adds what a
 * node alone holds: the charter on its disk.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/accretion
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  readLedgeredEdgeBoard, edgeLedgerDocUrl, materializeSharedLarDoc, noteRealm, ledgerRealms, foundingRoster,
  type EdgeCharter, type LedgeredEdgeBoardRead,
} from "@lararium/mesh";
import { readNexusDoc } from "./nexus-doc.js";

/**
 * The charter a realm's quorum hand answers to, as THIS vessel holds it: the head roster and the epoch lineage
 * of the charter at `sealHome`. Null when no seated charter stands there, and then no quorum act counts.
 */
export function vesselEdgeCharter(scope: string, sealHome: string): EdgeCharter | null {
  const doc = readNexusDoc(sealHome);
  const head = foundingRoster(doc);
  if (head.sealEpochCid.length === 0) return null;
  return { scope, head, sealLineage: doc?.sealLineage ?? [] };
}

export type VesselEdgeBoardRead = LedgeredEdgeBoardRead;

/** Read one edge board as this vessel (`readLedgeredEdgeBoard`, the read every shore shares). */
export const readVesselEdgeBoard = readLedgeredEdgeBoard;

/** Note in this vessel's own ledger that it reads one realm's boards (`noteRealm`): a door that vouches there calls this. */
export async function noteVesselRealm(repo: Repo, vesselKey: string, realm: string): Promise<void> {
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  if (!ledgerRealms(ledger.doc()).includes(realm.trim().toLowerCase())) ledger.change((d) => { noteRealm(d, realm); });
}

/** The realms this vessel's own ledger notes. */
export async function readVesselRealms(repo: Repo, vesselKey: string): Promise<readonly string[]> {
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(vesselKey), "ledger:edge");
  return ledgerRealms(ledger.doc());
}
