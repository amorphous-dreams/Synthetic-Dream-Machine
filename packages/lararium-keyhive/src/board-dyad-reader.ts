/** Read a device's standing from the island's own signed fleet board. */
import { DOCUMENT_HANG_BOUND_MS, deviceEdgeId, edgeStandingAsOf, readFleetFrontier, fleetRaiseCids, readFrontierPins, writeFrontierPin, FLEET_HAND, findOrThrow, fleetEdgeAuthority, fleetEdgeBoardDocUrl, readEdgeBoard, keptFromLedger, keepInLedger, restoreToBoard, raisesSeenThrough, replicaHeads } from "@lararium/mesh";
import type { Repo, LarDoc, DocHandle, HandLineage } from "@lararium/mesh";
import type { DyadReader } from "./operator-daemon-behavior.js";
import { watchHandles, witnessedStandings } from "./face-intent-door.js";
import { standingOfReading } from "./face-seat-summons.js";

export function boardDyadReader(repo: Repo, ledger?: DocHandle<LarDoc> | Promise<DocHandle<LarDoc>>, restLedger?: () => Promise<void>, _ownDevice?: string, seatLedger?: LarDoc, scope?: string, lineage?: HandLineage | null): DyadReader {
  return async (fleetRootDid, deviceVerifyingKey) => {
    try {
      const fleetScope = fleetRootDid.trim().toLowerCase().replace(/^0x/, "");
      const handle = await findOrThrow(repo, fleetEdgeBoardDocUrl(fleetRootDid), "board:edge-kapae", { timeoutMs: DOCUMENT_HANG_BOUND_MS });
      const board = handle.doc();
      if (!board) return "aside";
      const owned = await ledger;
      const kept = keptFromLedger(owned?.doc(), fleetScope);
      const read = await readEdgeBoard({ board, kept, authorityFor: fleetEdgeAuthority(fleetRootDid) });
      if (owned && read.counted.acts.length + read.counted.anchors.length > 0) {
        owned.change((draft) => { keepInLedger(draft, fleetScope, read.counted); });
        await restLedger?.();
      }
      if (read.missing.acts.length + read.missing.anchors.length > 0) {
        handle.change((draft) => { restoreToBoard(draft, read.missing); });
      }
      const bareDevice = deviceVerifyingKey.trim().toLowerCase().replace(/^0x/, "");
      const reading = read.readings.get(deviceEdgeId(fleetRootDid, bareDevice));
      const frontier = lineage ? readFleetFrontier({ fleetRoot: fleetScope, board, lineage,
        seenRaises: fleetRaiseCids(read.counted.acts),
        pinned: readFrontierPins(owned?.doc(), fleetScope)[FLEET_HAND] ?? null,
      }) : null;
      if (frontier?.status === "known" && owned) {
        owned.change((draft) => { writeFrontierPin(draft, fleetScope, FLEET_HAND, frontier.asOf[FLEET_HAND]!); });
        await restLedger?.();
      }
      return edgeStandingAsOf(reading, scope ? raisesSeenThrough(seatLedger, scope) : undefined,
        frontier?.status === "known");
    } catch { return "aside"; }
  };
}

/**
 * THE INTENT DOOR'S STANDINGS: the board fold above over the island's OWN replicas, under one witness over every document it
 * reads (the fleet's edge board, the ledger it keeps and reads its seat rolls from, and the documents the lineage reads, such as
 * the persona-KEL board). A reader on another shore (the vessel's answer across a port) carries no witness the island can check,
 * so the door never composes one: its answers stand only while these replicas read as they did when each answer was fetched, and
 * their changes wake the door.
 */
export function intentDoorStandings(input: {
  readonly repo: Repo;
  readonly fleetRoot: string;
  readonly ownKey: string;
  readonly board: DocHandle<LarDoc>;
  readonly ledger: DocHandle<LarDoc>;
  readonly lineage: () => HandLineage | null;
  /** The documents the lineage reads (the persona-KEL board): their heads join the witness, their changes wake. */
  readonly lineageDocs?: readonly DocHandle<LarDoc>[];
  readonly restLedger?: () => Promise<void>;
}) {
  const scope = input.fleetRoot.trim().toLowerCase().replace(/^0x/, "");
  const witnessedDocs = [input.board, input.ledger, ...(input.lineageDocs ?? [])];
  return witnessedStandings(
    async (device) => standingOfReading(await boardDyadReader(input.repo, input.ledger, input.restLedger, input.ownKey, input.ledger.doc(), scope, input.lineage())(input.fleetRoot, device)),
    () => witnessedDocs.map((h) => replicaHeads(h).join(",")).join("|"),
    { watch: watchHandles(witnessedDocs) });
}
