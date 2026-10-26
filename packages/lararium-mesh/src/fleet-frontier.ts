/**
 * fleet-frontier — K17 board frontier doors for a named raising hand.
 * A hand commits the raises it counts; a widening reader waits for a qualifying signed head.
 * Fleet wrappers seat the root alone, while realm wrappers seat a charter quorum.
 */
import type { LarDoc } from "./base-doc.js";
import type { EdgeKapae } from "./edge-kapae.js";
import { foldHandFrontiers, readWideningFrontier, signGenesisFrontier, signNextFrontier, type EdgeFrontier, type HandReading, type WideningRead } from "./edge-frontier.js";
import { edgeFrontierRecords, frontierSnapshots, writeEdgeFrontier, writeFrontierSnapshot } from "./edge-frontier-board.js";
import { currentRoster, type HandLineage } from "./hand-lineage.js";

export const FLEET_HAND = "fleet" as const;
const bare = (root: string): string => root.trim().toLowerCase().replace(/^0x/, "");
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
export type RegisteredFrontier = { readonly frontier: EdgeFrontier; readonly raises: readonly string[] };

/** The holder's raises among counted fleet acts. */
export function fleetRaiseCids(counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand">[]): string[] {
  return counted.filter((a) => a.raised && a.hand === "holder").map((a) => a.actCid).sort();
}

/** Read one hand's board as of its qualifying frontier. */
export function readHandFrontier(input: {
  readonly board: LarDoc | undefined | null; readonly boardId: string; readonly hand: string; readonly lineage: HandLineage;
  readonly seenRaises: readonly string[]; readonly pinned: { readonly seq: number; readonly cid: string } | null;
}): WideningRead {
  const readings = new Map<string, HandReading>([[input.hand, {
    frontiers: edgeFrontierRecords(input.board, input.boardId, input.hand), snapshots: frontierSnapshots(input.board),
    seenRaises: input.seenRaises, pinned: input.pinned,
  }]]);
  return readWideningFrontier(input.boardId, [{ hand: input.hand, lineage: input.lineage }], readings);
}

/** Land a signed empty genesis inside a board change. */
export async function landHandGenesis(draft: LarDoc, boardId: string, hand: string, lineage: HandLineage, signers: readonly Signer[]): Promise<EdgeFrontier> {
  const roster = currentRoster(lineage);
  const genesis = await signGenesisFrontier({ board: boardId, hand, epoch: roster.epoch, rosterHash: roster.rosterHash }, signers);
  writeFrontierSnapshot(draft, []);
  writeEdgeFrontier(draft, genesis);
  return genesis;
}

/** Sign a successor that retains its predecessor's raises. A fork or absent verified head refuses. */
export async function nextHandFrontier(input: {
  readonly board: LarDoc | undefined | null; readonly boardId: string; readonly hand: string; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signers: readonly Signer[];
}): Promise<RegisteredFrontier | null> {
  const fold = foldHandFrontiers(input.boardId, { hand: input.hand, lineage: input.lineage }, edgeFrontierRecords(input.board, input.boardId, input.hand));
  const head = fold.chain[fold.chain.length - 1];
  if (fold.fork || !head) return null;
  const prior = frontierSnapshots(input.board).get(head.act.body.snapshot) ?? [];
  const raises = [...new Set([...input.counted, ...prior])].sort();
  const roster = currentRoster(input.lineage);
  const next = await signNextFrontier(head.act, raises, { epoch: roster.epoch, rosterHash: roster.rosterHash }, input.signers);
  return { frontier: next, raises };
}

/** Land a frontier and its snapshot inside a board change. */
export function landHandFrontier(draft: LarDoc, registered: RegisteredFrontier): void {
  writeFrontierSnapshot(draft, registered.raises);
  writeEdgeFrontier(draft, registered.frontier);
}

/** Carry one hand's unjudged frontier records and snapshots. */
export function handFrontierCarriage(board: LarDoc | undefined | null, boardId: string, hand: string): {
  readonly records: unknown[]; readonly snapshots: Array<[string, string[]]>;
} {
  return { records: edgeFrontierRecords(board, boardId, hand),
    snapshots: [...frontierSnapshots(board)].map(([cid, raises]) => [cid, [...raises]] as [string, string[]]) };
}

export function readFleetFrontier(input: {
  readonly fleetRoot: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly seenRaises: readonly string[]; readonly pinned: { readonly seq: number; readonly cid: string } | null;
}): WideningRead {
  return readHandFrontier({ ...input, boardId: bare(input.fleetRoot), hand: FLEET_HAND });
}

export function landFleetGenesis(draft: LarDoc, fleetRoot: string, lineage: HandLineage, signer: Signer): Promise<EdgeFrontier> {
  return landHandGenesis(draft, bare(fleetRoot), FLEET_HAND, lineage, [signer]);
}

export function nextFleetFrontier(input: {
  readonly fleetRoot: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage;
  readonly counted: readonly string[]; readonly signer: Signer;
}): Promise<RegisteredFrontier | null> {
  return nextHandFrontier({ ...input, boardId: bare(input.fleetRoot), hand: FLEET_HAND, signers: [input.signer] });
}

export function landFleetFrontier(draft: LarDoc, registered: RegisteredFrontier): void { landHandFrontier(draft, registered); }

export function fleetFrontierCarriage(board: LarDoc | undefined | null, fleetRoot: string) {
  return handFrontierCarriage(board, bare(fleetRoot), FLEET_HAND);
}
