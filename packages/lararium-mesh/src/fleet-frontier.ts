/**
 * fleet-frontier — K17 on a fleet's board: the fleet root signs its own stream's frontier, alone (k = 1).
 *
 * The fleet board carries the root's raises on its devices' edges. The root's lineage is its persona KEL; its
 * frontier commits the raises it counts. Every fleet founds with a signed empty genesis; a raise registers into
 * the root's NEXT frontier; a gate widening toward a device reads the board as of a qualifying frontier and
 * answers `unknown` where none stands. One module serves node and browser.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/edge-frontier-2026
 */

import type { LarDoc } from "./base-doc.js";
import type { EdgeKapae } from "./edge-kapae.js";
import { foldHandFrontiers, readWideningFrontier, signGenesisFrontier, signNextFrontier, type EdgeFrontier, type HandReading, type WideningRead } from "./edge-frontier.js";
import { edgeFrontierRecords, frontierSnapshots, writeEdgeFrontier, writeFrontierSnapshot } from "./edge-frontier-board.js";
import { currentRoster, type HandLineage } from "./hand-lineage.js";

/** The one hand that raises on a fleet board. */
export const FLEET_HAND = "fleet" as const;

const bare = (root: string): string => root.trim().toLowerCase().replace(/^0x/, "");

/** The raise cids the fleet hand has issued among these counted acts: what its frontier must count. */
export function fleetRaiseCids(counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand">[]): string[] {
  return counted.filter((a) => a.raised && a.hand === "holder").map((a) => a.actCid).sort();
}

type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };

/** Read the fleet board as of its qualifying frontier. `board` is the fleet board replica; `seenRaises` every raise this reader counted. */
export function readFleetFrontier(input: {
  readonly fleetRoot: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly seenRaises: readonly string[]; readonly pinned: { readonly seq: number; readonly cid: string } | null;
}): WideningRead {
  const root = bare(input.fleetRoot);
  const readings = new Map<string, HandReading>([[FLEET_HAND, {
    frontiers: edgeFrontierRecords(input.board, root, FLEET_HAND), snapshots: frontierSnapshots(input.board),
    seenRaises: input.seenRaises, pinned: input.pinned,
  }]]);
  return readWideningFrontier(root, [{ hand: FLEET_HAND, lineage: input.lineage }], readings);
}

/** Found a fleet board: the root signs the EMPTY genesis frontier at its current roster, and lands it with its snapshot. Inside `change()`. */
export async function landFleetGenesis(draft: LarDoc, fleetRoot: string, lineage: HandLineage, signer: Signer): Promise<EdgeFrontier> {
  const roster = currentRoster(lineage);
  const genesis = await signGenesisFrontier({ board: bare(fleetRoot), hand: FLEET_HAND, epoch: roster.epoch, rosterHash: roster.rosterHash }, [signer]);
  writeFrontierSnapshot(draft, []);
  writeEdgeFrontier(draft, genesis);
  return genesis;
}

/**
 * Register the fleet's raises into its NEXT frontier: sign the successor of the verified head committing every raise
 * in `counted`, then land the frontier and its snapshot. Returns null where the board holds no verified head to extend
 * (the root founds the fleet first) or the head already counts exactly these raises. Pure: the caller lands the result.
 */
export async function nextFleetFrontier(input: {
  readonly fleetRoot: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signer: Signer;
}): Promise<{ readonly frontier: EdgeFrontier; readonly raises: readonly string[] } | null> {
  const root = bare(input.fleetRoot);
  const fold = foldHandFrontiers(root, { hand: FLEET_HAND, lineage: input.lineage }, edgeFrontierRecords(input.board, root, FLEET_HAND));
  const head = fold.chain[fold.chain.length - 1];
  if (fold.fork || !head) return null;
  // The successor commits everything its predecessor counted: a local board that lost a raise never signs a shrinking frontier.
  const prior = frontierSnapshots(input.board).get(head.act.body.snapshot) ?? [];
  const raises = [...new Set([...input.counted, ...prior])].sort();
  const roster = currentRoster(input.lineage);
  const next = await signNextFrontier(head.act, raises, { epoch: roster.epoch, rosterHash: roster.rosterHash }, [input.signer]);
  return { frontier: next, raises };
}

/** Land a registered frontier and its snapshot. Inside `change()`. */
export function landFleetFrontier(draft: LarDoc, registered: { readonly frontier: EdgeFrontier; readonly raises: readonly string[] }): void {
  writeFrontierSnapshot(draft, registered.raises);
  writeEdgeFrontier(draft, registered.frontier);
}
