/** Read a device's standing from the island's own signed fleet board. */
import { DOCUMENT_HANG_BOUND_MS, deviceEdgeId, edgeStandingOf, findOrThrow, fleetEdgeAuthority, fleetEdgeBoardDocUrl, readEdgeBoard } from "@lararium/mesh";
import type { Repo } from "@lararium/mesh";
import type { DyadReader } from "./operator-daemon-behavior.js";

export function boardDyadReader(repo: Repo): DyadReader {
  return async (fleetRootDid, deviceVerifyingKey) => {
    try {
      const handle = await findOrThrow(repo, fleetEdgeBoardDocUrl(fleetRootDid), "board:edge-kapae", { timeoutMs: DOCUMENT_HANG_BOUND_MS });
      const board = handle.doc();
      if (!board) return "aside";
      const read = await readEdgeBoard({ board, authorityFor: fleetEdgeAuthority(fleetRootDid) });
      const bareDevice = deviceVerifyingKey.trim().toLowerCase().replace(/^0x/, "");
      return edgeStandingOf(read.readings.get(deviceEdgeId(fleetRootDid, bareDevice)));
    } catch { return "aside"; }
  };
}
