/**
 * fold-gate — which stored document loads FOLDED: its history replayed in a throwaway engine (the double) and handed to
 * the live engine as one compacted snapshot, so the live engine never replays it.
 *
 * WHY A FOLD. Automerge's wasm engine keeps memory for every change it replays onto a loaded document, and gives none of
 * it back inside one engine. The cost grows with the document: the lares canon document (4,500,576 stored bytes, 430
 * changes past its snapshot) loads at 45 MiB from its snapshot alone and at 3,694 MiB once its incrementals replay, near
 * wasm32's 4 GiB ceiling; the same history saved compact loads at 48 MiB. The Repo's own compaction never fires on such a
 * document (it waits for the incremental bytes to reach the snapshot's bytes, 864 KB against 3.6 MB here) and runs inside
 * the live engine anyway.
 *
 * THE WEIGHT. What the live engine would retain rises with the changes it replays and with the size of the document it
 * replays them onto, so a document weighs `changes × bytes`: the changes its incremental records carry (counted by the
 * mesh framing walk, no engine) times its clear stored bytes. A sealed or torn record ends the weighing: such a document
 * never folds, it loads as it rests.
 *
 * THE SERVO (lar:///ha.ka.ba/lares/api/pono/servo). The bound a fold protects: one document's replay may spend at most
 * `budgetBytes` of the live engine (the set-point, `FOLD_BUDGET_BYTES`: one sixty-fourth of wasm32's address space). The
 * gate predicts a replay's spend as `cost × weight` and folds where the prediction reaches the budget. `cost` (bytes
 * retained per byte of document per replayed change) carries the tuning: each completed fold reports what its replay
 * really spent in the double, and that sample folds into an EWMA (α 0.2), clamped to `[floor, ceil]`, held inside a
 * deadband. Until `minSamples` folds land, the cold cost holds, measured on the canon document above (3,649 MiB retained
 * over 430 changes on 4,500,576 bytes ≈ 1.98). Polarity: a lossless gate shrinks under load, so a costlier replay raises
 * `cost`, the threshold weight (`budget / cost`) falls, and documents fold sooner. Only completions teach: a fold that
 * failed or timed out never reaches `teachFold`.
 *
 * Pure: no clock, no engine, no platform.
 */

import { precheckChunkBytes } from "./store-integrity.js";

/** wasm32's whole linear address space, in bytes: the ceiling every document in one engine shares. */
export const WASM32_ADDRESS_SPACE = 2 ** 32;

/** The set-point: one document's replay may spend at most this much of the live engine (a sixty-fourth of wasm32). */
export const FOLD_BUDGET_BYTES = WASM32_ADDRESS_SPACE / 64;

/** The cold cost, measured on the lares canon document: 3,649 MiB retained / (430 changes × 4,500,576 bytes). */
export const FOLD_COLD_COST = (3_649 * 2 ** 20) / (430 * 4_500_576);

/** How much one stored document weighs toward a fold. */
export interface FoldWeight {
  /** The changes its incremental records carry: what the live engine would replay past its snapshot. */
  readonly changes: number;
  /** Its clear stored bytes, snapshots and incrementals together. */
  readonly bytes: number;
}

/** The fold gate's state: the set-point, the learned cost and its guards. Immutable; `teachFold` answers the next one. */
export interface FoldGate {
  readonly budgetBytes: number;
  /** The EWMA of observed cost; it governs once `samples` reaches `minSamples`. */
  readonly cost: number;
  readonly samples: number;
  readonly coldCost: number;
  readonly minSamples: number;
  readonly floor: number;
  readonly ceil: number;
  /** A sample within this fraction of the EWMA holds it. */
  readonly deadband: number;
  readonly alpha: number;
}

/** The gate every vessel starts from. */
export const PONO_FOLD_GATE: FoldGate = {
  budgetBytes: FOLD_BUDGET_BYTES,
  cost: FOLD_COLD_COST,
  samples: 0,
  coldCost: FOLD_COLD_COST,
  minSamples: 3,
  floor: 0.25,
  ceil: 64,
  deadband: 0.25,
  alpha: 0.2,
};

/** One stored record, by the role its key names. */
export interface StoredRecord {
  readonly kind: "snapshot" | "incremental";
  readonly data: Uint8Array;
}

/** A document's weighing: its weight, or why it never folds. */
export type FoldWeighing =
  | { readonly weight: FoldWeight }
  | { readonly passes: "sealed" | "torn" | "empty" };

/** Weigh one document's stored records. A sealed or torn record passes the whole document through as it rests. */
export function foldWeightOf(records: readonly StoredRecord[]): FoldWeighing {
  if (records.length === 0) return { passes: "empty" };
  let changes = 0;
  let bytes = 0;
  for (const record of records) {
    const verdict = precheckChunkBytes(record.data);
    if (!verdict.ok) return { passes: "torn" };
    if (verdict.sealed === true) return { passes: "sealed" };
    bytes += record.data.length;
    if (record.kind === "incremental") changes += verdict.chunks;
  }
  return { weight: { changes, bytes } };
}

/** The cost the gate governs by now: the learned EWMA once enough folds landed, the cold cost before. */
export function governingCost(gate: FoldGate): number {
  return gate.samples >= gate.minSamples ? gate.cost : gate.coldCost;
}

/** What the gate predicts a replay of `weight` would spend in the live engine, in bytes. */
export function predictedSpend(gate: FoldGate, weight: FoldWeight): number {
  return governingCost(gate) * weight.changes * weight.bytes;
}

/** Whether a document of `weight` loads folded: it carries changes past its snapshot and its predicted spend reaches the budget. */
export function foldsAt(gate: FoldGate, weight: FoldWeight): boolean {
  return weight.changes > 0 && predictedSpend(gate, weight) >= gate.budgetBytes;
}

/** Teach the gate one completed fold: what its replay spent in the double. A weightless fold teaches nothing. */
export function teachFold(gate: FoldGate, weight: FoldWeight, spentBytes: number): FoldGate {
  const scale = weight.changes * weight.bytes;
  if (!(scale > 0) || !(spentBytes >= 0)) return gate;
  const sample = Math.max(gate.floor, Math.min(gate.ceil, spentBytes / scale));
  if (gate.samples === 0) return { ...gate, cost: sample, samples: 1 };
  const held = Math.abs(sample - gate.cost) <= gate.deadband * gate.cost;
  const cost = held ? gate.cost : gate.alpha * sample + (1 - gate.alpha) * gate.cost;
  return { ...gate, cost: Math.max(gate.floor, Math.min(gate.ceil, cost)), samples: gate.samples + 1 };
}
