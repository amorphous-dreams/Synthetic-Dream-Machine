/**
 * worldline-trajectory — the PERMAINAN SUBSTRATE: the Turn→Trajectory functor (worldline-TIME ×
 * form-SPACE = the path through the jurus). Pure, IO-free; the node-side holder feeds it.
 *
 * The QA-Lab flow-lens reads a *permainan* — a trajectory through move-space. The form-graph
 * (.formpalace) maps each turn's *jurus* (its form-vector = a position in move-space, the two-planes
 * CONTINUOUS plane). This module orders those positions by the worldline HAPPENED-BEFORE (the
 * rhythmic clock / ITC edge-DAG, mesh/worldline-clock), so a handle's turns become a PATH — the
 * thing the flow-lens instrument (CRQA · Fisher-Rao · the null test) will measure NEXT loop.
 *
 * THE FUNCTOR (Turn→Trajectory): a handle's captured turns → its worldline-ordered form-vector
 * sequence. Within ONE worldline the happened-before is TOTAL (an agent runs sequentially), so the
 * order rides the node-monotonic `tickCounter` (the WorldlineEvent order, mesh/worldline-clock);
 * the rhythmic `clock`/address rides along for display. Cross-handle concurrency is the ITC registry's
 * job (worldlineCompare) — the flow-lens reads ONE handle's path at a time.
 *
 * NULL-READY (the paper's non-negotiable): {@link shuffleTrajectory} rides cheaply alongside — a
 * scale-graded order-scramble (window-banded Fisher-Yates over a SEEDED rng) so a real trajectory can
 * be measured against a shuffled baseline. This module builds the SUBSTRATE (the measurable path +
 * the shuffle primitive), NEVER the null TEST itself (that is the flow-lens instrument, deferred).
 *
 * Also here: {@link replayWorldlineEdges} orders durable edges by parent links and handle
 * dependencies. Valid-time rides as display provenance; it never orders replay.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/time
 */

import type { FfzClock, LarTickCounter } from "./ffz-clock.js";
import { ffzAddress } from "./worldline-clock.js";
import {
  worldlineCausalSeed,
  worldlineSpawn,
  worldlineInject,
  worldlineHandback,
  worldlineStampFor,
  type WorldlineCausal,
} from "./worldline-clock.js";
import {
  PRED_DELEGATION,
  PRED_COMMUNICATION,
  type WorldlineEdgeTriple,
  type WorldlineEdgeClose,
} from "./worldline-edge.js";

// ---------------------------------------------------------------------------
// Types — the move-space position + the worldline path
// ---------------------------------------------------------------------------

/** A sparse form-vector — a turn's position in move-space (the jurus), as the formpalace stores it. */
export interface SparseFormVector {
  readonly indices: readonly number[];
  readonly values: readonly number[];
}

/**
 * One step on a worldline's path through move-space — a captured turn. `verbatimSha` is the
 * content↔form join key (the formpalace key); `tickCounter` is the within-handle happened-before
 * order (node-monotonic); `clock`/`address` carry the rhythmic position for display; `formVector`
 * is the move-space position (null until the holder joins it from the formpalace).
 */
export interface TrajectoryStep {
  readonly verbatimSha: string;
  readonly tickCounter: LarTickCounter;
  readonly clock?: FfzClock;
  readonly address?: string;
  readonly formVector?: SparseFormVector | null;
}

/**
 * THE FUNCTOR OUTPUT — a handle's worldline-ordered path through move-space. `steps` run
 * earliest→latest by happened-before; `shuffled` marks a null baseline (set by shuffleTrajectory).
 */
export interface WorldlineTrajectory {
  readonly handle: string;
  readonly steps: readonly TrajectoryStep[];
  /** present + true only on a shuffled null baseline (#null-ready). */
  readonly shuffled?: boolean;
  /** the null grading actually applied (window size), present only on a shuffle. */
  readonly shuffleWindow?: number;
}

// ---------------------------------------------------------------------------
// The Turn→Trajectory functor — order a handle's steps by happened-before
// ---------------------------------------------------------------------------

/**
 * Order a handle's captured turns into its worldline trajectory — THE functor. Sorts by the
 * within-handle happened-before (`tickCounter` ascending; `verbatimSha` as a stable tiebreak so the
 * order is total + deterministic even if two steps share a tick), and fills each step's rhythmic
 * `address` from its `clock`. PURE: returns a fresh trajectory, mutates nothing.
 */
export function orderTrajectory(handle: string, steps: readonly TrajectoryStep[]): WorldlineTrajectory {
  const ordered = [...steps]
    .sort((a, b) => (a.tickCounter - b.tickCounter) || (a.verbatimSha < b.verbatimSha ? -1 : a.verbatimSha > b.verbatimSha ? 1 : 0))
    .map((s) => (s.clock && s.address === undefined ? { ...s, address: ffzAddress(s.clock) } : s));
  return { handle, steps: ordered };
}

/**
 * Join form-vectors onto an ordered trajectory's steps — the SPACE leg of the functor. `lookup`
 * maps a step's `verbatimSha` to its move-space position (the formpalace `get`); a miss leaves the
 * step's `formVector` null (the path keeps the turn's TIME slot even when its form-vector is absent —
 * never silently drops a turn). PURE relative to `lookup`.
 */
export function joinFormVectors(
  traj: WorldlineTrajectory,
  lookup: (verbatimSha: string) => SparseFormVector | null | undefined,
): WorldlineTrajectory {
  return {
    ...traj,
    steps: traj.steps.map((s) => ({ ...s, formVector: lookup(s.verbatimSha) ?? null })),
  };
}

// ---------------------------------------------------------------------------
// Null-readiness — the scale-graded shuffle baseline (NOT the null test)
// ---------------------------------------------------------------------------

/** A small, fast, SEEDED PRNG (mulberry32) — a reproducible null baseline beats Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The NULL-READY primitive — scramble a trajectory's STEP ORDER to make a baseline (real-vs-shuffled
 * is the flow-lens's central test; this builds only the shuffle, never the test). SCALE-GRADED by
 * `window`: a window-banded Fisher-Yates shuffles within sliding blocks of `window` steps, so the
 * grading runs from coarse-order-preserved (small window) to fully random (window ≥ length). The
 * step CONTENTS (verbatimSha, formVector, clock) ride unchanged — only their ORDER scrambles, which
 * is exactly the order axis the flow-lens measures. PURE: a fresh trajectory off the SEEDED `rng`.
 *
 *   window = 1            → identity (no scramble — the degenerate floor)
 *   window = k (1<k<len)  → graded: order preserved across blocks, scrambled within each block
 *   window ≥ len (default)→ full uniform shuffle
 */
export function shuffleTrajectory(
  traj: WorldlineTrajectory,
  rng: () => number,
  window: number = Number.POSITIVE_INFINITY,
): WorldlineTrajectory {
  const steps = [...traj.steps];
  const n = steps.length;
  const w = Math.max(1, Math.floor(Math.min(window, n)));
  for (let start = 0; start < n; start += w) {
    const end = Math.min(start + w, n); // [start, end) is one band
    for (let i = end - 1; i > start; i--) {
      const j = start + Math.floor(rng() * (i - start + 1));
      const tmp = steps[i]!;
      steps[i] = steps[j]!;
      steps[j] = tmp;
    }
  }
  return { ...traj, steps, shuffled: true, shuffleWindow: w };
}

// ---------------------------------------------------------------------------
// The ITC registry projection — re-derive WorldlineCausal from the edge-DAG
// ---------------------------------------------------------------------------

/** One edge-DAG event, normalized for causal replay. */
interface CausalEvent {
  readonly op: "spawn" | "inject" | "handback";
  readonly subject: string;
  readonly object: string;
  readonly turnKey?: string;
  readonly parentKey?: string;
}

/**
 * A replay gap announces the event and the failed causal condition.
 */
export interface WorldlineReplaySkip extends CausalEvent {
  readonly reason: "child-already-spawned" | "target-unspawned" | "pair-unknown" |
    "parent-key-unknown" | "dependency-unapplied" | "cycle" | "malformed";
}

const opRank = { spawn: 0, inject: 1, handback: 2 } as const;

/** Content order resolves concurrent events without using input position or wall time. */
function compareEvent(a: CausalEvent, b: CausalEvent): number {
  if (opRank[a.op] !== opRank[b.op]) return opRank[a.op] - opRank[b.op];
  const fieldsA = [a.subject, a.object, a.turnKey ?? "", a.parentKey ?? ""];
  const fieldsB = [b.subject, b.object, b.turnKey ?? "", b.parentKey ?? ""];
  for (let i = 0; i < fieldsA.length; i++) {
    if (fieldsA[i]! < fieldsB[i]!) return -1;
    if (fieldsA[i]! > fieldsB[i]!) return 1;
  }
  return 0;
}

/** Rebuild the ITC registry in topological order and name every unapplied event. */
export function replayWorldlineEdges(
  root: string,
  opens: readonly WorldlineEdgeTriple[],
  closes: readonly WorldlineEdgeClose[] = [],
): { causal: WorldlineCausal; skipped: readonly WorldlineReplaySkip[] } {
  const events: CausalEvent[] = [];
  const skipped: WorldlineReplaySkip[] = [];
  const eventOf = (op: CausalEvent["op"], subject: string, object: string, turnKey?: string, parentKey?: string): CausalEvent => ({
    op, subject, object,
    ...(turnKey !== undefined ? { turnKey } : {}),
    ...(parentKey !== undefined ? { parentKey } : {}),
  });
  for (const e of opens) {
    const event = eventOf(e.predicate === PRED_DELEGATION ? "spawn" : "inject", e.subject, e.object, e.turnKey, e.parentKey);
    if (e.predicate === PRED_DELEGATION || e.predicate === PRED_COMMUNICATION) events.push(event);
    else skipped.push({ ...event, reason: "malformed" });
  }
  for (const c of closes) {
    const event = eventOf("handback", c.subject, c.object, undefined, c.parentKey);
    if (c.predicate === PRED_DELEGATION) events.push(event);
    else skipped.push({ ...event, reason: "malformed" });
  }
  const unique = [...new Map(events.map((e) => [JSON.stringify([e.op, e.subject, e.object, e.turnKey ?? "", e.parentKey ?? ""]), e])).values()];
  unique.sort(compareEvent);
  const byTurn = new Map<string, CausalEvent>();
  const ambiguous = new Set<string>();
  for (const e of unique) if (e.turnKey) {
    if (byTurn.has(e.turnKey)) ambiguous.add(e.turnKey);
    else byTurn.set(e.turnKey, e);
  }
  const spawns = unique.filter((e) => e.op === "spawn");
  const spawnedObjects = new Set(spawns.map((s) => s.object));
  const injectsInto = new Map<string, CausalEvent[]>();
  const handbacksFrom = new Map<string, CausalEvent[]>();
  for (const e of unique) {
    if (e.op === "inject") (injectsInto.get(e.object) ?? injectsInto.set(e.object, []).get(e.object)!).push(e);
    else if (e.op === "handback") (handbacksFrom.get(e.subject) ?? handbacksFrom.set(e.subject, []).get(e.subject)!).push(e);
  }
  const firstSpawn = new Map<string, CausalEvent>();
  for (const spawn of spawns) if (!firstSpawn.has(spawn.object)) firstSpawn.set(spawn.object, spawn);
  const dependencies = new Map<CausalEvent, Set<CausalEvent>>();
  const invalid = new Set<CausalEvent>();
  for (const e of unique) {
    const deps = new Set<CausalEvent>();
    if (e.parentKey) {
      const parent = byTurn.get(e.parentKey);
      if (!parent || ambiguous.has(e.parentKey)) {
        skipped.push({ ...e, reason: "parent-key-unknown" });
        invalid.add(e);
        continue;
      }
      deps.add(parent);
    }
    const subjectSpawn = firstSpawn.get(e.subject);
    const objectSpawn = firstSpawn.get(e.object);
    if (subjectSpawn && subjectSpawn !== e) deps.add(subjectSpawn);
    if (objectSpawn && objectSpawn !== e) deps.add(objectSpawn);
    if (e.op === "handback") {
      for (const prior of injectsInto.get(e.object) ?? []) deps.add(prior);
      for (const prior of handbacksFrom.get(e.object) ?? []) if (prior !== e) deps.add(prior);
    }
    dependencies.set(e, deps);
  }
  // Kahn's order: each event waits on its unfinished dependencies, and the ready set always yields
  // its content-first event, so the order depends on the edges alone.
  const waiting = new Map<CausalEvent, number>();
  const dependents = new Map<CausalEvent, CausalEvent[]>();
  for (const [e, deps] of dependencies) {
    let open = 0;
    for (const d of deps) {
      if (invalid.has(d)) continue;   // an unlinked event never finishes; its dependents read it failed
      open++;
      (dependents.get(d) ?? dependents.set(d, []).get(d)!).push(e);
    }
    waiting.set(e, open);
  }
  const ready: CausalEvent[] = [...dependencies.keys()].filter((e) => waiting.get(e) === 0).sort(compareEvent);
  const enqueue = (e: CausalEvent): void => {
    let lo = 0, hi = ready.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (compareEvent(ready[mid]!, e) <= 0) lo = mid + 1; else hi = mid; }
    ready.splice(lo, 0, e);
  };

  let causal = worldlineCausalSeed(root);
  const spawned = new Set<string>();
  const activePairs = new Set<string>();
  const finished = new Set<CausalEvent>(invalid);
  const failed = new Set<CausalEvent>(invalid);
  while (ready.length > 0) {
    const ev = ready.shift()!;
    const deps = dependencies.get(ev)!;
    dependencies.delete(ev);
    finished.add(ev);
    for (const next of dependents.get(ev) ?? []) {
      const left = waiting.get(next)! - 1;
      waiting.set(next, left);
      if (left === 0) enqueue(next);
    }
    if ([...deps].some((d) => failed.has(d))) {
      skipped.push({ ...ev, reason: "dependency-unapplied" });
      failed.add(ev);
      continue;
    }
    const pair = JSON.stringify([ev.subject, ev.object]);
    try {
      if (!ev.subject || !ev.object || ev.subject === ev.object) {
        skipped.push({ ...ev, reason: "malformed" });
        failed.add(ev);
        continue;
      }
      if (ev.op === "spawn") {
        if (spawned.has(ev.object) || worldlineStampFor(causal, ev.object)) {
          skipped.push({ ...ev, reason: "child-already-spawned" });
          failed.add(ev);
          continue;
        }
        if (!worldlineStampFor(causal, ev.subject) && !spawnedObjects.has(ev.subject)) causal = mergeSeed(causal, ev.subject);
        causal = worldlineSpawn(causal, ev.subject, ev.object);
        spawned.add(ev.object);
        activePairs.add(pair);
      } else if (ev.op === "inject") {
        if (!worldlineStampFor(causal, ev.object)) {
          skipped.push({ ...ev, reason: "target-unspawned" });
          failed.add(ev);
          continue;
        }
        causal = worldlineInject(causal, ev.object);
      } else {
        if (!activePairs.has(pair) || !worldlineStampFor(causal, ev.subject) || !worldlineStampFor(causal, ev.object)) {
          skipped.push({ ...ev, reason: "pair-unknown" });
          failed.add(ev);
          continue;
        }
        causal = worldlineHandback(causal, ev.subject, ev.object);
        activePairs.delete(pair);
      }
    } catch {
      skipped.push({ ...ev, reason: "malformed" });
      failed.add(ev);
    }
  }
  for (const ev of [...dependencies.keys()].sort(compareEvent)) skipped.push({ ...ev, reason: "cycle" });
  skipped.sort((a, b) => compareEvent(a, b) || (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0));
  return { causal, skipped };
}

/** Project the ITC registry from causal edge links; valid-time rides as display metadata. */
export function worldlineCausalFromEdges(
  root: string,
  opens: readonly WorldlineEdgeTriple[],
  closes: readonly WorldlineEdgeClose[] = [],
): WorldlineCausal {
  return replayWorldlineEdges(root, opens, closes).causal;
}

/** Seed an extra root-like handle into an existing registry (a fresh full-ownership stamp). */
function mergeSeed(c: WorldlineCausal, handle: string): WorldlineCausal {
  const seeded = worldlineCausalSeed(handle); // composite-keyed (`${handle}@${frontier}`)
  return { stamps: { ...c.stamps, ...seeded.stamps } };
}

// ---------------------------------------------------------------------------
// The rewind-then-fork orchestrator — kapae (valid-close) → re-project → fork
// ---------------------------------------------------------------------------

/** The output of {@link rewindThenFork} — the re-projected view and the sibling forked off it. */
export interface RewindThenForkResult {
  /** The registry AFTER the fork — the rewound frontier PLUS the new concurrent sibling. */
  readonly causal: WorldlineCausal;
  /** The registry re-projected over the FILTERED (valid) view, BEFORE the fork — the rewound frontier. */
  readonly view: WorldlineCausal;
  /** The count of open edges the kapae filter dropped (the rewound turns' Delegation/Communication). */
  readonly dropped: number;
  readonly skipped: readonly WorldlineReplaySkip[];
  readonly parent: string;
  readonly child: string;
}

/**
 * REWIND-THEN-FORK (edit-and-resubmit) — the PURE composition over the built organs: close a set of
 * turns' valid-time (the kapae move, modeled as a valid-view FILTER over the durable append-only
 * edges), re-project the ITC registry from the surviving VALID edges (the rewound-frontier stamp),
 * then fork a new concurrent sibling off it.
 *
 * The bi-temporal discipline holds by construction: the caller's `opens` are the append-only tx-rows
 * (the durable KG's `kapaeTurn` sets `valid_to`, never deletes); this function drops the rewound
 * turnKeys from the VALID VIEW only, so the row survives while the view sheds it (the TOKI/XTDB audit
 * row). The re-projected stamp is a DERIVED projection — the fork rides a re-derivable frontier, so no
 * global-now sneaks in (the guard). PURE: `opens`/`closes` are untouched; a fresh registry is built.
 *
 * The DURABLE half — actually closing `valid_to` in the mempalace KG — is `kapaeTurn` (node-side); the
 * node orchestrator fires it, then hands its surviving edges here. This is the mesh-pure re-project +
 * fork the durable path composes over (worldline-kg's kapae → these organs).
 */
export function rewindThenFork(
  root: string,
  opens: readonly WorldlineEdgeTriple[],
  closes: readonly WorldlineEdgeClose[],
  rewoundTurnKeys: Iterable<string>,
  fork: { readonly parent: string; readonly child: string },
): RewindThenForkResult {
  const rewound = new Set<string>();
  for (const k of rewoundTurnKeys) if (k) rewound.add(k);

  // The kapae VALID-VIEW filter: drop every open edge keyed to a rewound turn. The tx-row survives in
  // the durable KG (append-only); only the projected view sheds it (valid-time non-monotone).
  const validOpens = rewound.size === 0 ? opens : opens.filter((e) => !(e.turnKey && rewound.has(e.turnKey)));
  const dropped = opens.length - validOpens.length;

  // Re-project the ITC registry over the surviving VALID edges → the rewound-frontier stamp.
  const replay = replayWorldlineEdges(root, validOpens, closes);
  const view = replay.causal;

  // Fork the new concurrent sibling off the rewound frontier (itcFork, via worldlineSpawn).
  const causal = worldlineSpawn(view, fork.parent, fork.child);

  return { causal, view, dropped, skipped: replay.skipped, parent: fork.parent, child: fork.child };
}
