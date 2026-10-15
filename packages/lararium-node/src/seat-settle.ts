/**
 * seat-settle — THE SETTLE ON EVERY FOLD: a vessel answers, on the key side, each raise it counts on its own
 * fleet's edge board, with no person typing a verb (kapae#/keys).
 *
 * ── WHAT TRIGGERS IT ────────────────────────────────────────────────────────────────────────────
 * A FOLD of an edge board, and nothing else. No timer runs here, and no wall clock decides whether a settle
 * runs. The standing vessel calls `onFold` after each fold lands (and once when its daemon island stands, for a
 * raise counted before a restart); a fold that arrives while a settle runs sets off exactly one more.
 *
 * ── WHAT ONE SETTLE DOES ────────────────────────────────────────────────────────────────────────
 * The same three steps a person's `lares edge settle` runs, for the ONE fleet the daemon island's face belongs
 * to (the island answers its own face's seats alone):
 *   1. read the fold: which raises this vessel counts on that fleet's board and has not yet seen through. When
 *      none stays owed, or a shadow stands over this vessel's own edge, the settle ends here and places nothing;
 *   2. read the facts (`runEdgeSeatFacts`) and place the island's `seat-duties` verb, awaiting its answer;
 *   3. keep the signed rolls the island answered in this vessel's own ledger (`runEdgeSeatMarks`), then let the
 *      ring read the marks.
 *
 * ── ONCE FOR EACH RAISE ─────────────────────────────────────────────────────────────────────────
 * A raise whose seat this vessel saw leave gets marked, and a marked raise owes nothing at any later fold. A
 * raise answered with no revoke authority keeps its roll in the ledger and stays owed: the next fold tries it
 * again, and no loop spins between folds, since a mark moves the ledger and never a board.
 *
 * A settle that faults names itself once in the log and leaves the raise owed for the next fold.
 *
 * ── AN ISLAND THAT NEVER ANSWERS HOLDS NOTHING BACK ─────────────────────────────────────────────
 * The ask of the island waits on the island's own outcome, with no timer. A first fold that lands while an ask
 * waits sets off one more settle behind it. A SECOND fold that lands while that same ask still waits abandons the
 * ask: the settler takes the fold's word that the board moved twice with no answer, starts again from the facts,
 * and an answer the island gives late moves nothing. Every roll stays safe to plan twice: the key shore reads a
 * seat that already left as gone.
 */
import type { EdgeSeatFacts } from "./commands/edge-seats.js";
import type { EdgeShadowFold } from "./edge-shadow-ring.js";

/** What the island's `seat-duties` verb answers, read for shape and never trusted for it. */
export interface SeatDutiesAnswer {
  readonly ran:       boolean;
  readonly reason?:   string;
  readonly outcomes?: readonly { readonly did?: string }[];
  readonly rolls?:    readonly unknown[];
}

export interface SeatSettleDeps {
  /** The fleet root the daemon island's own device edge pins, bare 64-hex; null where the island wears no face. */
  readonly wornFleetRoot: () => string | null;
  /** The ring's last fold, or null while its reading stands dark. */
  readonly fold: () => EdgeShadowFold | null;
  /** The facts for one fleet, read through the vessel's ledger. */
  readonly facts: (fleetRoot: string) => Promise<EdgeSeatFacts | null>;
  /** Place the island's `seat-duties` verb with these facts: its awaited answer, and a way to stop waiting for it. */
  readonly answer: (facts: Pick<EdgeSeatFacts, "fleetRoot" | "acts" | "rolled">) => { readonly answer: Promise<SeatDutiesAnswer>; abandon(): void };
  /** Keep the island's signed rolls in the vessel's own ledger; answers the raises it marked. */
  readonly mark: (fleetRoot: string, rolls: readonly unknown[]) => Promise<{ readonly marked: readonly string[] }>;
  /** Let every gate read the marks that just landed (the ring folds again; no board moved). */
  readonly afterMarks: () => Promise<void>;
  readonly onLog: (line: string) => void;
}

export interface SeatSettler {
  /** A fold landed: settle what it owes. Returns at once; settles never overlap. */
  onFold(): void;
  /** Resolves once no settle runs and none waits. */
  idle(): Promise<void>;
  /** Stop: a settle in flight finishes its step and starts no other. */
  dispose(): void;
}

/** The raises a fold counts on one fleet's board that this vessel has not yet seen through. */
export function raisesOwed(fold: EdgeShadowFold | null, fleetRoot: string): { readonly owed: readonly string[]; readonly selfAside: boolean } | null {
  const at = fold?.fleets.find((f) => f.fleetRoot === fleetRoot);
  if (!at) return null;
  const owed = new Set<string>();
  for (const reading of at.readings.values()) for (const cid of reading.raiseCids) if (!at.rolled.has(cid)) owed.add(cid);
  return { owed: [...owed].sort(), selfAside: at.selfAside };
}

export function makeSeatSettler(deps: SeatSettleDeps): SeatSettler {
  let running: Promise<void> | null = null;
  let again = false;
  let disposed = false;
  /** The ask in flight, and how many folds landed since it went out. */
  let asking: { abandon(): void; folds: number } | null = null;

  const settleOnce = async (): Promise<void> => {
    const fleetRoot = deps.wornFleetRoot();
    if (fleetRoot === null) return;
    const read = raisesOwed(deps.fold(), fleetRoot);
    // A dark reading owes nothing here: the fold that lands next calls again.
    if (read === null || read.owed.length === 0) return;
    // A vessel under a shadow of its own performs no key act in that scope.
    if (read.selfAside) return;
    const facts = await deps.facts(fleetRoot);
    if (facts === null || disposed) return;
    const ask = deps.answer({ fleetRoot: facts.fleetRoot, acts: facts.acts, rolled: facts.rolled });
    asking = { abandon: () => ask.abandon(), folds: 0 };
    let answered: SeatDutiesAnswer;
    try { answered = await ask.answer; } finally { asking = null; }
    // A composition that left while the island answered marks nothing: the next standing reads the board again.
    if (disposed) return;
    if (answered.ran !== true) { deps.onLog(`${read.owed.length} raise(s) stay owed: the key shore did not run (${answered.reason ?? "no reason given"})`); return; }
    const rolls = Array.isArray(answered.rolls) ? answered.rolls : [];
    const kept = rolls.length > 0 ? (await deps.mark(fleetRoot, rolls)).marked.length : 0;
    const did = (answered.outcomes ?? []).map((o) => o.did ?? "?");
    const held = did.filter((d) => d === "no-authority" || d === "undelivered" || d === "forked").length;
    deps.onLog(`settled on a fold: ${read.owed.length} raise(s) owed, ${kept} marked${held > 0 ? `, ${held} row(s) stay owed (${[...new Set(did.filter((d) => d === "no-authority" || d === "undelivered" || d === "forked"))].join(", ")})` : ""}`);
    if (kept > 0) await deps.afterMarks();
  };

  const run = async (): Promise<void> => {
    do {
      again = false;
      try { await settleOnce(); }
      catch (err) { deps.onLog(`a settle faulted and its raises stay owed for the next fold: ${err instanceof Error ? err.message : String(err)}`); }
    } while (again && !disposed);
  };

  return {
    onFold() {
      if (disposed) return;
      if (running) {
        again = true;
        // The second fold behind one waiting ask stops the wait; the settle that follows starts from the facts.
        if (asking && ++asking.folds >= 2) asking.abandon();
        return;
      }
      running = run().finally(() => { running = null; });
    },
    idle: async () => { while (running) await running; },
    dispose() { disposed = true; asking?.abandon(); },
  };
}
