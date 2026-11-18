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
import { currentRoster, rosterAt, type HandLineage } from "./hand-lineage.js";
import { actCid, foldLinked, readQuorumAct, signQuorumAct, type ActBody, type QuorumAct } from "./signed-act.js";

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

/** A frontier signs at its hand's quorum: a fleet root at k = 1, a realm's charter at its threshold of seats. */
export type EdgeFrontier = QuorumAct<EdgeFrontierBody>;

/** The content address of a counted-raise set: sorted, de-duplicated, hashed under the frontier domain. */
export function frontierSnapshotCid(raiseCids: readonly string[]): string {
  return sha256HexBytesSync(canonicalJsonBytes({ kind: EDGE_FRONTIER_DOMAIN, raises: [...new Set(raiseCids)].sort() }));
}

type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };
type Signers = readonly Signer[];

/** The signed EMPTY genesis frontier every fleet and realm founds with. */
export function signGenesisFrontier(parts: { board: string; hand: string; epoch: number; rosterHash: string }, signers: Signers): Promise<EdgeFrontier> {
  return signQuorumAct<EdgeFrontierBody>({
    kind: EDGE_FRONTIER_DOMAIN, group: parts.board, seq: 0, prior: null,
    hand: parts.hand, snapshot: frontierSnapshotCid([]), epoch: parts.epoch, rosterHash: parts.rosterHash,
  }, signers);
}

/** Register raises into the hand's NEXT frontier: the successor commits `counted` (every raise through its boundary). */
export function signNextFrontier(
  prev: EdgeFrontier, counted: readonly string[], lineage: { epoch: number; rosterHash: string }, signers: Signers,
): Promise<EdgeFrontier> {
  return signQuorumAct<EdgeFrontierBody>({
    kind: EDGE_FRONTIER_DOMAIN, group: prev.body.group, seq: prev.body.seq + 1, prior: actCid(prev.body),
    hand: prev.body.hand, snapshot: frontierSnapshotCid(counted), epoch: lineage.epoch, rosterHash: lineage.rosterHash,
  }, signers);
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
  /** The hand's roster at each epoch it has stood (`makeHandLineage`): a link verifies under its OWN epoch's roster,
   *  and only the head must stand at the lineage's current epoch. */
  readonly lineage: HandLineage;
}

export type FrontierMissing =
  | { readonly hand: string; readonly why: "no-frontier" | "below-threshold" | "fork" | "missing-snapshot" | "withholds-seen-raise" | "counts-unseen-raise" | "does-not-extend-pin" | "stale-lineage" | "snapshot-shrinks" };

export type WideningRead =
  | { readonly status: "known"; readonly asOf: Readonly<Record<string, { seq: number; cid: string }>>; readonly counted: Readonly<Record<string, readonly string[]>> }
  | { readonly status: "unknown"; readonly missing: readonly FrontierMissing[] };

/** Fold one hand's carried frontier records into its verified chain, each link read under its OWN epoch's roster. */
export function foldHandFrontiers(board: string, h: RaisingHand, records: readonly unknown[]) {
  return foldLinked<EdgeFrontier>(records, (raw) => {
    const read = readQuorumAct(raw, {
      domain: EDGE_FRONTIER_DOMAIN, group: board,
      seatsFor: (body) => {
        const fb = body as EdgeFrontierBody;
        const roster = rosterAt(h.lineage, fb.epoch);
        return fb.hand === h.hand && roster && roster.rosterHash === fb.rosterHash ? roster : null;
      },
    });
    return read.ok ? { ok: true as const, act: read.act as EdgeFrontier, cid: read.cid } : read;
  }, (body, prior) => prior === null || (body as EdgeFrontierBody).epoch >= (prior as EdgeFrontierBody).epoch);   // a closed epoch's keys sign nothing after it
}

/** Read one board's frontier for a widening act, over every raising hand. */
export function readWideningFrontier(board: string, hands: readonly RaisingHand[], readings: ReadonlyMap<string, HandReading>): WideningRead {
  const missing: FrontierMissing[] = [];
  const asOf: Record<string, { seq: number; cid: string }> = {};
  const counted: Record<string, readonly string[]> = {};
  for (const h of hands) {
    const r = readings.get(h.hand);
    const fold = foldHandFrontiers(board, h, r?.frontiers ?? []);
    if (fold.fork) { missing.push({ hand: h.hand, why: "fork" }); continue; }
    const head = fold.chain[fold.chain.length - 1];
    if (!r || !head) { missing.push({ hand: h.hand, why: fold.refused.some((x) => x.refusal === "below-threshold") ? "below-threshold" : "no-frontier" }); continue; }
    const body = head.act.body;
    // Only the HEAD must stand at the current epoch; the links behind it verified under their own.
    if (body.epoch !== currentRoster(h.lineage).epoch) { missing.push({ hand: h.hand, why: "stale-lineage" }); continue; }
    if (r.pinned && !fold.chain.some((e) => e.cid === r.pinned!.cid && e.act.body.seq === r.pinned!.seq)) {
      missing.push({ hand: h.hand, why: "does-not-extend-pin" }); continue;
    }
    const snap = r.snapshots.get(body.snapshot);
    if (!snap || frontierSnapshotCid(snap) !== body.snapshot) { missing.push({ hand: h.hand, why: "missing-snapshot" }); continue; }
    const have = new Set(snap);
    // A LINK NEVER DROPS A RAISE ITS PREDECESSOR COUNTED: every link's snapshot holds, and holds everything the link before it held.
    let shrinks = false, absent = false, before: ReadonlySet<string> | null = null;
    for (const link of fold.chain) {
      const linkSnap = r.snapshots.get(link.act.body.snapshot);
      if (!linkSnap || frontierSnapshotCid(linkSnap) !== link.act.body.snapshot) { absent = true; break; }
      if (before && [...before].some((c) => !linkSnap.includes(c))) { shrinks = true; break; }
      before = new Set(linkSnap);
    }
    if (absent) { missing.push({ hand: h.hand, why: "missing-snapshot" }); continue; }
    if (shrinks) { missing.push({ hand: h.hand, why: "snapshot-shrinks" }); continue; }
    if (r.seenRaises.some((c) => !have.has(c))) { missing.push({ hand: h.hand, why: "withholds-seen-raise" }); continue; }
    // The frontier counts a raise this reader lacks: its shadow cannot read here yet, so the board waits as unknown
    // until the act itself arrives (sync always carries acts).
    const seen = new Set(r.seenRaises);
    if (snap.some((c) => !seen.has(c))) { missing.push({ hand: h.hand, why: "counts-unseen-raise" }); continue; }
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
