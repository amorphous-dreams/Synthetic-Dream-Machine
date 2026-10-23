/** Read a device's standing from the island's own signed fleet board. */
import { DOCUMENT_HANG_BOUND_MS, deviceEdgeId, edgeStandingAsOf, readFleetFrontier, fleetRaiseCids, readFrontierPins, writeFrontierPin, FLEET_HAND, findOrThrow, fleetEdgeAuthority, fleetEdgeBoardDocUrl, readEdgeBoard, keptFromLedger, keepInLedger, restoreToBoard, raisesSeenThrough } from "@lararium/mesh";
import type { Repo, LarDoc, DocHandle, HandLineage } from "@lararium/mesh";
import type { DyadReader } from "./operator-daemon-behavior.js";

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
