/**
 * edge-frontier — K17: the signed frontier a board's raising hands keep, and the reader that widens only against one.
 *
 * Nothing signed today lets a reader tell a device never set aside from a raise erased or withheld. Every hand that
 * can raise on a board signs its OWN stream's frontier: one `signed-act` image under `EDGE_FRONTIER_DOMAIN`, whose
 * body commits the counted raises through its boundary as a content-addressed snapshot, its parent (`prior`), and
 * its roster and epoch lineage. A raise shadows its target at once for every reader that sees it, and counts toward
 * widening once its hand registers it into the next frontier.
 *
 * THE WIDENING READER (admit, grant, a content key sealed to a reader) acts as of a frontier of EVERY raising hand
 * that extends each head the reader pinned, carries a snapshot the reader holds, includes every raise the reader has
 * seen, and stands at the roster's current epoch. Where none qualifies it answers `unknown`, naming what is missing,
 * and never reads absence as clear. It runs on node and browser alike: platform-blind, no clock.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/edge-frontier-2026
 */

import { sha256HexBytesSync, canonicalJsonBytes } from "./crypto.js";
import { EDGE_FRONTIER_DOMAIN } from "./domains.js";
import { actCid, foldActs, signAct, type ActBody, type SignedAct } from "./signed-act.js";

export interface EdgeFrontierBody extends ActBody {
  readonly kind: typeof EDGE_FRONTIER_DOMAIN;
  /** The raising hand whose stream this frontier closes (a device fleet root, or a realm charter quorum id). */
  readonly hand: string;
  /** `frontierSnapshotCid` over the raise cids this hand counts through this frontier. */
  readonly snapshot: string;
  /** The roster lineage the hand's signer is read at: epoch number and the roster's hash. */
  readonly epoch: number;
  readonly rosterHash: string;
}

export type EdgeFrontier = SignedAct<EdgeFrontierBody>;

/** The content address of a counted-raise set: sorted, de-duplicated, hashed under the frontier domain. */
export function frontierSnapshotCid(raiseCids: readonly string[]): string {
  return sha256HexBytesSync(canonicalJsonBytes({ kind: EDGE_FRONTIER_DOMAIN, raises: [...new Set(raiseCids)].sort() }));
}

type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };

/** The signed EMPTY genesis frontier every fleet and realm founds with. */
export function signGenesisFrontier(parts: { board: string; hand: string; epoch: number; rosterHash: string }, signer: Signer): Promise<EdgeFrontier> {
  return signAct<EdgeFrontierBody>({
    kind: EDGE_FRONTIER_DOMAIN, group: parts.board, seq: 0, prior: null,
    hand: parts.hand, snapshot: frontierSnapshotCid([]), epoch: parts.epoch, rosterHash: parts.rosterHash,
  }, signer);
}

/** Register raises into the hand's NEXT frontier: the successor commits `counted` (every raise through its boundary). */
export function signNextFrontier(
  prev: EdgeFrontier, counted: readonly string[], lineage: { epoch: number; rosterHash: string }, signer: Signer,
): Promise<EdgeFrontier> {
  return signAct<EdgeFrontierBody>({
    kind: EDGE_FRONTIER_DOMAIN, group: prev.body.group, seq: prev.body.seq + 1, prior: actCid(prev.body),
    hand: prev.body.hand, snapshot: frontierSnapshotCid(counted), epoch: lineage.epoch, rosterHash: lineage.rosterHash,
  }, signer);
}

/** What a reader holds of one hand's stream. */
export interface HandReading {
  /** Carried frontier records of this hand (any order). */
  readonly frontiers: readonly unknown[];
  /** Snapshots the reader holds: snapshot cid -> the counted raise cids. */
  readonly snapshots: ReadonlyMap<string, readonly string[]>;
  /** Raise cids from this hand the reader has seen on the board. */
  readonly seenRaises: readonly string[];
  /** The head this reader pinned for the hand (its highest accepted), or null before any. */
  readonly pinned: { readonly seq: number; readonly cid: string } | null;
}

export interface RaisingHand {
  readonly hand: string;
  /** Verifying keys that may sign this hand's frontier at the roster's current epoch. */
  readonly signers: readonly string[];
  readonly epoch: number;
  readonly rosterHash: string;
}

export type FrontierMissing =
  | { readonly hand: string; readonly why: "no-frontier" | "fork" | "missing-snapshot" | "withholds-seen-raise" | "wrong-epoch" | "does-not-extend-pin" | "stale-lineage" };

export type WideningRead =
  | { readonly status: "known"; readonly asOf: Readonly<Record<string, { seq: number; cid: string }>>; readonly counted: Readonly<Record<string, readonly string[]>> }
  | { readonly status: "unknown"; readonly missing: readonly FrontierMissing[] };

/** Read one board's frontier for a widening act, over every raising hand. */
export function readWideningFrontier(board: string, hands: readonly RaisingHand[], readings: ReadonlyMap<string, HandReading>): WideningRead {
  const missing: FrontierMissing[] = [];
  const asOf: Record<string, { seq: number; cid: string }> = {};
  const counted: Record<string, readonly string[]> = {};
  for (const h of hands) {
    const r = readings.get(h.hand);
    const fold = foldActs(r?.frontiers ?? [], {
      domain: EDGE_FRONTIER_DOMAIN, group: board,
      authorize: (signer, body) => (body as EdgeFrontierBody).hand === h.hand && h.signers.includes(signer),
    });
    if (fold.fork) { missing.push({ hand: h.hand, why: "fork" }); continue; }
    const head = fold.chain[fold.chain.length - 1];
    if (!r || !head) { missing.push({ hand: h.hand, why: "no-frontier" }); continue; }
    const body = head.act.body as EdgeFrontierBody;
    if (body.epoch !== h.epoch || body.rosterHash !== h.rosterHash) {
      missing.push({ hand: h.hand, why: body.epoch < h.epoch ? "stale-lineage" : "wrong-epoch" }); continue;
    }
    if (r.pinned && !fold.chain.some((e) => e.cid === r.pinned!.cid && e.act.body.seq === r.pinned!.seq)) {
      missing.push({ hand: h.hand, why: "does-not-extend-pin" }); continue;
    }
    const snap = r.snapshots.get(body.snapshot);
    if (!snap || frontierSnapshotCid(snap) !== body.snapshot) { missing.push({ hand: h.hand, why: "missing-snapshot" }); continue; }
    const have = new Set(snap);
    if (r.seenRaises.some((c) => !have.has(c))) { missing.push({ hand: h.hand, why: "withholds-seen-raise" }); continue; }
    asOf[h.hand] = { seq: body.seq, cid: head.cid };
    counted[h.hand] = [...have].sort();
  }
  return missing.length > 0 ? { status: "unknown", missing } : { status: "known", asOf, counted };
}

/** The reader's pins after it accepted a known read: each hand's highest accepted head, never lowered. */
export function raiseFrontierPins(
  pins: Readonly<Record<string, { seq: number; cid: string }>>, read: WideningRead,
): Record<string, { seq: number; cid: string }> {
  const out = { ...pins };
  if (read.status !== "known") return out;
  for (const [hand, head] of Object.entries(read.asOf)) if (!out[hand] || head.seq > out[hand]!.seq) out[hand] = head;
  return out;
}
