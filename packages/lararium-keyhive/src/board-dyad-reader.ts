/** Read a device's standing from the island's own signed fleet board. */
import { DOCUMENT_HANG_BOUND_MS, deviceEdgeId, edgeStandingOf, findOrThrow, fleetEdgeAuthority, fleetEdgeBoardDocUrl, readEdgeBoard, keptFromLedger, keepInLedger, restoreToBoard, raisesSeenThrough } from "@lararium/mesh";
import type { Repo, LarDoc, DocHandle } from "@lararium/mesh";
import type { DyadReader } from "./operator-daemon-behavior.js";

export function boardDyadReader(repo: Repo, ledger?: DocHandle<LarDoc> | Promise<DocHandle<LarDoc>>, restLedger?: () => Promise<void>, ownDevice?: string, seatLedger?: LarDoc, scope?: string): DyadReader {
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
      const own = ownDevice?.trim().toLowerCase().replace(/^0x/, "");
      // A peer cannot infer clean standing from a fresh local ledger and an empty signed board.
      if (own && bareDevice !== own && kept.acts.length + kept.anchors.length === 0 && read.counted.acts.length + read.counted.anchors.length === 0) return "aside";
      return edgeStandingOf(read.readings.get(deviceEdgeId(fleetRootDid, bareDevice)), seatLedger && scope ? raisesSeenThrough(seatLedger, scope) : undefined);
    } catch { return "aside"; }
  };
}
