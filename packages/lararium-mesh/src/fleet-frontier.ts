/**
 * fleet-frontier — K17 board frontier doors for a named raising hand.
 * A hand commits the raises it counts; a widening reader waits for a qualifying signed head.
 * Fleet wrappers seat the root alone, while realm wrappers seat a charter quorum.
 */
import type { LarDoc } from "./base-doc.js";
import { deviceEdgeId } from "./dyad.js";
import type { EdgeKapae, EdgeReading } from "./edge-kapae.js";
import { foldHandFrontiers, frontierSnapshotCid, readWideningFrontier, signGenesisFrontier, signNextFrontier, type EdgeFrontier, type HandReading, type WideningRead } from "./edge-frontier.js";
import { edgeFrontierRecords, frontierSnapshots, writeEdgeFrontier, writeFrontierSnapshot } from "./edge-frontier-board.js";
import { currentRoster, type HandLineage } from "./hand-lineage.js";
import { actCid } from "./signed-act.js";

export const FLEET_HAND = "fleet" as const;
const bare = (root: string): string => root.trim().toLowerCase().replace(/^0x/, "");
type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
export type RegisteredFrontier = { readonly frontier: EdgeFrontier; readonly raises: readonly string[] };
export type HandFrontierCarriage = { readonly hand: string; readonly records: readonly unknown[]; readonly snapshots: readonly (readonly [string, readonly string[]])[] };

/** The holder's raises among counted fleet acts. */
export function fleetRaiseCids(counted: readonly Pick<EdgeKapae, "actCid" | "raised" | "hand">[]): string[] {
  return counted.filter((a) => a.raised && a.hand === "holder").map((a) => a.actCid).sort();
}

/** Read one hand's board as of its qualifying frontier. */
export function readHandFrontier(input: {
  readonly board: LarDoc | undefined | null; readonly boardId: string; readonly hand: string; readonly lineage: HandLineage;
  readonly seenRaises: readonly string[]; readonly pinned: { readonly seq: number; readonly cid: string } | null;
  readonly carried?: readonly HandFrontierCarriage[];
}): WideningRead {
  const carried = input.carried?.filter((entry) => entry.hand === input.hand) ?? [];
  const snapshots = frontierSnapshots(input.board);
  // Carried snapshots join the reader's set by content address. They add no SEEN raise: a head that counts a raise
  // this reader holds no act for waits (`counts-unseen-raise`) until the act itself arrives, with the bundle or by sync.
  for (const entry of carried) for (const [cid, raises] of entry.snapshots) if (frontierSnapshotCid(raises) === cid) snapshots.set(cid, raises);
  const byCid = new Map<string, EdgeFrontier>();
  for (const raw of [...edgeFrontierRecords(input.board, input.boardId, input.hand), ...carried.flatMap((entry) => entry.records)]) {
    if (typeof raw !== "object" || raw === null || !Object.hasOwn(raw, "body") || !Object.hasOwn(raw, "signatures")) continue;
    const candidate = raw as EdgeFrontier;
    if (!Array.isArray(candidate.signatures)) continue;
    try {
      const cid = actCid(candidate.body), prior = byCid.get(cid);
      byCid.set(cid, prior ? { body: prior.body, signatures: [...prior.signatures, ...candidate.signatures] } : candidate);
    } catch { /* torn carriage receives no vote */ }
  }
  const readings = new Map<string, HandReading>([[input.hand, {
    frontiers: [...byCid.values()], snapshots,
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

/**
 * Each link of the fleet's verified frontier chain this reader holds, by its cid: the raises that link counts. A forked chain holds
 * none, and the chain ends at the first link whose snapshot the reader lacks. Unlike the widening read it asks no head to stand at
 * the current epoch, so a ward act's frozen spend reads at the link its outcome cites however far the chain has moved since.
 */
export function fleetFrontierLinks(input: { readonly fleetRoot: string; readonly board: LarDoc | undefined | null; readonly lineage: HandLineage }): ReadonlyMap<string, readonly string[]> {
  const boardId = bare(input.fleetRoot), out = new Map<string, readonly string[]>();
  const fold = foldHandFrontiers(boardId, { hand: FLEET_HAND, lineage: input.lineage }, edgeFrontierRecords(input.board, boardId, FLEET_HAND));
  if (fold.fork) return out;
  const snapshots = frontierSnapshots(input.board);
  for (const link of fold.chain) {
    const counted = snapshots.get(link.act.body.snapshot);
    if (!counted || frontierSnapshotCid(counted) !== link.act.body.snapshot) break;
    out.set(link.cid, counted);
  }
  return out;
}

/** Whether a device stood at one link of the fleet's frontier chain: the reader holds that link, and no raise it counts names the device's edge. */
export function fleetStoodAt(input: {
  readonly links: ReadonlyMap<string, readonly string[]>; readonly readings: ReadonlyMap<string, Pick<EdgeReading, "raiseCids">>;
  readonly fleetRoot: string; readonly atom: string; readonly frontier: string;
}): boolean {
  const counted = input.links.get(input.frontier);
  if (!counted) return false;
  const raises = input.readings.get(deviceEdgeId(input.fleetRoot, input.atom))?.raiseCids ?? [];
  return !raises.some((cid) => counted.includes(cid));
}
