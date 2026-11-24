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
 * dependencies, and applies spawns, messages, round-closing handbacks and retirements. Valid-time
 * rides as display provenance; it never orders replay.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/agent-worldline#/time
 */

import type { FfzClock, LarTickCounter } from "./ffz-clock.js";
import { ffzAddress } from "./worldline-clock.js";
import {
  worldlineCausalSeed,
  worldlineSpawn,
  worldlineDraft,
  type WorldlineCausal,
} from "./worldline-clock.js";
import {
  PRED_DELEGATION,
  PRED_COMMUNICATION,
  ROUND_CLOSE,
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
  readonly op: "spawn" | "message" | "handback" | "retire";
  readonly subject: string;
  readonly object: string;
  readonly turnKey?: string;
  readonly parentKey?: string;
}

/**
 * A replay gap announces the event and the failed causal condition. `order-unlinked` names an event the
 * links leave unordered against another event on a worldline it shares (a message, handback or retirement
 * that ticks the same handle, or a spawn that reads it): the replay never takes that order from content,
 * so it applies the first and names the second.
 */
export interface WorldlineReplaySkip extends CausalEvent {
  readonly reason: "child-already-spawned" | "target-unspawned" | "sender-retired" | "pair-unknown" |
    "parent-key-unknown" | "parent-unrecorded" | "order-unlinked" | "dependency-unapplied" | "cycle" | "malformed";
}

/**
 * A message the replay applied without its sender's past: the sender holds no recorded worldline (never
 * spawned, never the root), so the recipient takes the receive event alone and the gap stays named.
 */
export interface WorldlineReplayUnjoined extends CausalEvent {
  readonly reason: "sender-unrecorded";
}

/** What a replay rebuilt, what it refused, and which handles' histories a refusal leaves uncertain. */
export interface WorldlineReplay {
  readonly causal: WorldlineCausal;
  readonly skipped: readonly WorldlineReplaySkip[];
  readonly unjoined: readonly WorldlineReplayUnjoined[];
  /**
   * Handles whose stamps rest on an incomplete record: a skipped event touched them, or they took a
   * message, handback, spawn or retirement from such a handle. A verdict on one reads partial.
   */
  readonly uncertain: readonly string[];
}

const opRank = { spawn: 0, message: 1, handback: 2, retire: 3 } as const;

/** Content order picks among READY events whose order no shared worldline can tell; it never orders a shared one. */
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

/** The handles an event ticks (advances) and the handle a spawn reads. */
function touches(e: CausalEvent): { ticks: readonly string[]; reads: readonly string[] } {
  if (e.op === "spawn") return { ticks: [e.object], reads: [e.subject] };
  return { ticks: [e.subject, e.object], reads: [] };
}

/**
 * Rebuild the ITC registry in link order and name every unapplied event. An event applies only where its
 * parent link and the spawns of its handles came first, and where the links order it after every applied
 * event on a worldline it shares — so a replay never reverses a live verdict; it names a gap instead.
 */
export function replayWorldlineEdges(
  root: string,
  opens: readonly WorldlineEdgeTriple[],
  closes: readonly WorldlineEdgeClose[] = [],
): WorldlineReplay {
  const events: CausalEvent[] = [];
  const skipped: WorldlineReplaySkip[] = [];
  const unjoined: WorldlineReplayUnjoined[] = [];
  const eventOf = (op: CausalEvent["op"], subject: string, object: string, turnKey?: string, parentKey?: string): CausalEvent => ({
    op, subject, object,
    ...(turnKey !== undefined ? { turnKey } : {}),
    ...(parentKey !== undefined ? { parentKey } : {}),
  });
  for (const e of opens) {
    const op = e.predicate === PRED_DELEGATION ? "spawn" : e.round === ROUND_CLOSE ? "handback" : "message";
    const event = eventOf(op, e.subject, e.object, e.turnKey, e.parentKey);
    if (e.predicate === PRED_DELEGATION || e.predicate === PRED_COMMUNICATION) events.push(event);
    else skipped.push({ ...event, reason: "malformed" });
  }
  for (const c of closes) {
    const event = eventOf("retire", c.subject, c.object, c.turnKey, c.parentKey);
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
  const firstSpawn = new Map<string, CausalEvent>();
  for (const e of unique) if (e.op === "spawn" && !firstSpawn.has(e.object)) firstSpawn.set(e.object, e);
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
    dependencies.set(e, deps);
  }
  const links = new Map(dependencies);

  // One topological position per event (Kahn over the links, content breaking ties among the ready). An
  // event caught in a cycle holds no position.
  const position = new Map<CausalEvent, number>();
  {
    const open = new Map<CausalEvent, number>();
    const after = new Map<CausalEvent, CausalEvent[]>();
    for (const [e, deps] of links) {
      open.set(e, deps.size);
      for (const d of deps) (after.get(d) ?? after.set(d, []).get(d)!).push(e);
    }
    const queue = [...links.keys()].filter((e) => open.get(e) === 0).sort(compareEvent);
    while (queue.length > 0) {
      const e = queue.shift()!;
      position.set(e, position.size);
      const freed: CausalEvent[] = [];
      for (const n of after.get(e) ?? []) { const left = open.get(n)! - 1; open.set(n, left); if (left === 0) freed.push(n); }
      if (freed.length) { queue.push(...freed); queue.sort(compareEvent); }
    }
  }
  // Does `a` come before `b` by links alone? A backward walk from `b` that never descends below `a`'s
  // position (an ancestor always sits earlier), so a link to a near event answers in a few steps.
  const precedes = (a: CausalEvent, b: CausalEvent): boolean => {
    const pa = position.get(a), pb = position.get(b);
    if (pa === undefined || pb === undefined || pa >= pb) return false;
    const stack = [b];
    const seen = new Set<CausalEvent>([b]);
    while (stack.length > 0) {
      for (const d of links.get(stack.pop()!) ?? []) {
        if (d === a) return true;
        const pd = position.get(d);
        if (pd === undefined || pd < pa || seen.has(d)) continue;
        seen.add(d);
        stack.push(d);
      }
    }
    return false;
  };

  // Only an event that can apply claims a worldline: a handle the record never holds (not the root, never
  // spawned) touches nothing, and a message from such a sender ticks its recipient alone.
  const recorded = new Set<string>([root, ...firstSpawn.keys()]);
  const claims = (e: CausalEvent): { ticks: readonly string[]; reads: readonly string[] } => {
    if (e.op === "spawn") return recorded.has(e.subject) ? touches(e) : { ticks: [], reads: [] };
    if (!recorded.has(e.object)) return { ticks: [], reads: [] };
    if (e.op === "message" && !recorded.has(e.subject)) return { ticks: [e.object], reads: [] };
    return recorded.has(e.subject) ? touches(e) : { ticks: [], reads: [] };
  };
  // Each handle's events in topological order: a tick must follow the handle's last tick and every read
  // since, a read must follow the last tick, so only neighbouring events on one handle can conflict.
  const byHandle = new Map<string, { e: CausalEvent; ticks: boolean }[]>();
  for (const e of [...position.keys()].sort((x, y) => position.get(x)! - position.get(y)!)) {
    const { ticks, reads } = claims(e);
    for (const h of ticks) (byHandle.get(h) ?? byHandle.set(h, []).get(h)!).push({ e, ticks: true });
    for (const h of reads) (byHandle.get(h) ?? byHandle.set(h, []).get(h)!).push({ e, ticks: false });
  }
  const unlinked = new Set<CausalEvent>();
  const scan = (): Map<CausalEvent, Set<CausalEvent>> => {
    const conflicts = new Map<CausalEvent, Set<CausalEvent>>();
    const clash = (x: CausalEvent, y: CausalEvent): void => {
      (conflicts.get(x) ?? conflicts.set(x, new Set()).get(x)!).add(y);
      (conflicts.get(y) ?? conflicts.set(y, new Set()).get(y)!).add(x);
    };
    for (const members of byHandle.values()) {
      let last: CausalEvent | undefined;
      let reads: CausalEvent[] = [];
      for (const { e, ticks } of members) {
        if (unlinked.has(e)) continue;
        if (last && !precedes(last, e)) clash(last, e);
        if (ticks) {
          for (const r of reads) if (!precedes(r, e)) clash(r, e);
          last = e;
          reads = [];
        } else reads.push(e);
      }
    }
    return conflicts;
  };
  // Refuse one event at a time until no conflict stands: an event that names no parent link before a
  // linked one (its place rests on nothing), then the most-conflicted; content breaks a tie between
  // refusals only, never an order.
  const rank = (e: CausalEvent, degree: number): [number, number] => [e.parentKey ? 0 : 1, degree];
  for (let conflicts = scan(); conflicts.size > 0; conflicts = scan()) {
    let worst: CausalEvent | undefined;
    let best: [number, number] = [-1, -1];
    for (const [e, others] of conflicts) {
      const r = rank(e, others.size);
      if (r[0] > best[0] || (r[0] === best[0] && (r[1] > best[1] || (r[1] === best[1] && compareEvent(e, worst!) > 0)))) {
        worst = e;
        best = r;
      }
    }
    unlinked.add(worst!);
  }

  // Kahn's order over the links; the ready set yields its content-first event.
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

  const draft = worldlineDraft(worldlineCausalSeed(root));
  const spawned = new Set<string>();
  const activePairs = new Set<string>();
  const failed = new Set<CausalEvent>(invalid);
  const applied: CausalEvent[] = [];
  const lastTick = new Map<string, CausalEvent>();
  const readsSince = new Map<string, CausalEvent[]>();
  const refuse = (ev: CausalEvent, reason: WorldlineReplaySkip["reason"]): void => {
    skipped.push({ ...ev, reason });
    failed.add(ev);
  };
  // The links must order `ev` after every applied event on each worldline it shares.
  type Touch = { ticks: readonly string[]; reads: readonly string[] };
  const linkedAfterShared = (ev: CausalEvent, { ticks, reads }: Touch = touches(ev)): boolean => {
    for (const h of [...ticks, ...reads]) {
      const last = lastTick.get(h);
      if (last && !precedes(last, ev)) return false;
    }
    for (const h of ticks) for (const r of readsSince.get(h) ?? []) if (r !== ev && !precedes(r, ev)) return false;
    return true;
  };
  const record = (ev: CausalEvent, { ticks, reads }: Touch = touches(ev)): void => {
    for (const h of ticks) { lastTick.set(h, ev); readsSince.set(h, []); }
    for (const h of reads) (readsSince.get(h) ?? readsSince.set(h, []).get(h)!).push(ev);
    applied.push(ev);
  };
  while (ready.length > 0) {
    const ev = ready.shift()!;
    const deps = dependencies.get(ev)!;
    dependencies.delete(ev);
    for (const next of dependents.get(ev) ?? []) {
      const left = waiting.get(next)! - 1;
      waiting.set(next, left);
      if (left === 0) enqueue(next);
    }
    if (unlinked.has(ev)) { refuse(ev, "order-unlinked"); continue; }
    if ([...deps].some((d) => failed.has(d))) { refuse(ev, "dependency-unapplied"); continue; }
    try {
      if (!ev.subject || !ev.object || ev.subject === ev.object) { refuse(ev, "malformed"); continue; }
      if (ev.op === "spawn") {
        if (spawned.has(ev.object) || draft.stampFor(ev.object)) { refuse(ev, "child-already-spawned"); continue; }
        if (!draft.stampFor(ev.subject)) { refuse(ev, "parent-unrecorded"); continue; }
        if (!linkedAfterShared(ev)) { refuse(ev, "order-unlinked"); continue; }
        draft.spawn(ev.subject, ev.object);
        spawned.add(ev.object);
        activePairs.add(JSON.stringify([ev.subject, ev.object]));
      } else if (ev.op === "message") {
        if (!draft.stampFor(ev.object)) { refuse(ev, "target-unspawned"); continue; }
        if (draft.stampFor(ev.subject)) {
          if (!linkedAfterShared(ev)) { refuse(ev, "order-unlinked"); continue; }
          draft.inject(ev.subject, ev.object);
        } else if (spawned.has(ev.subject)) {
          refuse(ev, "sender-retired"); continue;
        } else {
          // The sender holds no recorded worldline: the recipient takes the receive alone, named unjoined.
          const alone: Touch = { ticks: [ev.object], reads: [] };
          if (!linkedAfterShared(ev, alone)) { refuse(ev, "order-unlinked"); continue; }
          draft.tick(ev.object);
          unjoined.push({ ...ev, reason: "sender-unrecorded" });
          record(ev, alone);
          continue;
        }
      } else if (ev.op === "handback") {
        // The edge runs child → parent; the spawn pair reads parent → child.
        if (!activePairs.has(JSON.stringify([ev.object, ev.subject])) || !draft.stampFor(ev.subject) || !draft.stampFor(ev.object)) {
          refuse(ev, "pair-unknown"); continue;
        }
        if (!linkedAfterShared(ev)) { refuse(ev, "order-unlinked"); continue; }
        draft.handback(ev.object, ev.subject);
      } else {
        const pair = JSON.stringify([ev.subject, ev.object]);
        if (!draft.stampFor(ev.object) && spawned.has(ev.object)) { refuse(ev, "target-unspawned"); continue; }
        if (!activePairs.has(pair) || !draft.stampFor(ev.subject) || !draft.stampFor(ev.object)) {
          refuse(ev, "pair-unknown"); continue;
        }
        if (!linkedAfterShared(ev)) { refuse(ev, "order-unlinked"); continue; }
        draft.retire(ev.subject, ev.object);
        activePairs.delete(pair);
      }
      record(ev);
    } catch {
      refuse(ev, "malformed");
    }
  }
  for (const ev of [...dependencies.keys()].sort(compareEvent)) skipped.push({ ...ev, reason: "cycle" });
  skipped.sort((a, b) => compareEvent(a, b) || (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0));

  // Uncertainty spreads from every refused event along every applied flow of history, to a fixpoint.
  const uncertain = new Set<string>();
  for (const ev of skipped) { if (ev.subject) uncertain.add(ev.subject); if (ev.object) uncertain.add(ev.object); }
  for (let grew = uncertain.size > 0; grew;) {
    grew = false;
    for (const ev of applied) {
      const from = ev.op === "retire" ? ev.object : ev.subject;
      const to = ev.op === "retire" ? ev.subject : ev.object;
      if (uncertain.has(from) && !uncertain.has(to)) { uncertain.add(to); grew = true; }
    }
  }
  return { causal: draft.freeze(), skipped, unjoined, uncertain: [...uncertain].sort() };
}

/** Project the ITC registry from causal edge links; valid-time rides as display metadata. */
export function worldlineCausalFromEdges(
  root: string,
  opens: readonly WorldlineEdgeTriple[],
  closes: readonly WorldlineEdgeClose[] = [],
): WorldlineCausal {
  return replayWorldlineEdges(root, opens, closes).causal;
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
  readonly unjoined: readonly WorldlineReplayUnjoined[];
  readonly uncertain: readonly string[];
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

  return { causal, view, dropped, skipped: replay.skipped, unjoined: replay.unjoined, uncertain: replay.uncertain, parent: fork.parent, child: fork.child };
}
