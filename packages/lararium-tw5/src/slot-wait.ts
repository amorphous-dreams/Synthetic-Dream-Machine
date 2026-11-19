/**
 * slot-wait — an island's wait for one slot document, as a pure function over what it asks and measures.
 *
 * An island's Repo reaches its slot documents through ONE peer: the vessel's main thread, over the sync port. A wiki
 * island keeps no store of its own, so every slot document arrives from there. The Repo settles a find "unavailable"
 * the moment it holds NO connected peer, and a port whose far end has not yet answered the handshake reads to it as no
 * peer at all.
 *
 * THE LAW (road C16): NO CLOCK DECIDES AN ARRIVAL. The wait ends on events:
 *   · the handle, once a find resolves (the document arrived);
 *   · `refused`: the Repo turned the ask itself away (an address it cannot read); no wait cures that, so it ends at once;
 *   · `verdict`: the connected vessel answered that it holds no such document. Its answer names the sources it hears at
 *     that instant (its store, its dials), so the wait asks again whenever a source moves (inbound sync, a peer), and the
 *     verdict ends the wait once it has stood a grace window with nothing moving on the port.
 * A silent port while an ask stands unanswered says only that the vessel still works (a big load, a key derivation):
 * the wait keeps waiting. A rejection with no peer connected says nothing about the document: the wait asks again when a
 * peer arrives.
 *   · `hard-cap`: the ONE last-resort bound, for a wait no event ended. It names itself and the phase the wait stood in:
 *     `store` (the island's own store still read: the daemon island's, whose reads may wait on the vessel's rest answer),
 *     `asked` (the vessel connected, the ask unanswered), `no-peer` (no vessel connected), or `verdict` (the vessel's
 *     "unavailable" kept being re-asked as traffic flowed).
 */

export interface SlotWaitBudgets {
  /** How long the vessel's verdict stands, with nothing moving on the port, before it ends the wait. */
  readonly verdictGraceMs: number;
  /** The last-resort bound on the whole wait. */
  readonly hardCapMs:      number;
  /** Re-ask cadence where no wake subscription stands. */
  readonly pollMs:         number;
}

export interface SlotWaitDeps<H> {
  /** Ask the Repo for the document. Resolves its handle; rejects when the Repo settles it unavailable. */
  readonly find:      () => Promise<H>;
  /** Whether a rejection states that the Repo settled the document unavailable. Any other rejection reads `refused`. */
  readonly absence:   (rejection: unknown) => boolean;
  /** How many peers the Repo holds connected right now. */
  readonly peerCount: () => number;
  /** A monotonic reading, in milliseconds. */
  readonly now:       () => number;
  /** The monotonic reading at the last inbound sync message. */
  readonly lastHeard: () => number;
  readonly sleep:     (ms: number) => Promise<void>;
  /** One turn of the event loop, so queued port messages land before a verdict or the hard cap ends the wait. */
  readonly defer:     () => Promise<void>;
  /**
   * THE ISLAND'S OWN STORE, read for the Repo (`store-liveness`): the daemon island's, the one island that keeps a store.
   * The Repo reads it before it asks the port, and a read may wait on the vessel's rest answer (`islandRestGuard`). A
   * wait the hard cap ends while a read stands in flight names the store, never a port it never asked. Absent: no store.
   */
  readonly store?:    () => { readonly inFlight: number; readonly lastSettled: number | null };
  /** Subscribe to inbound sync and peer arrivals; returns the listener cleanup. */
  readonly onWake?:   (wake: () => void) => () => void;
  readonly budgets:   SlotWaitBudgets;
}

/** The phase a wait stood in when the hard cap ended it. */
export type SlotWaitPhase = "store" | "asked" | "no-peer" | "verdict";

export type SlotWaitOutcome<H> =
  | { readonly outcome: "ready"; readonly handle: H }
  | { readonly outcome: "verdict" }
  | { readonly outcome: "refused"; readonly why: string }
  /** `storeReads`: the reads the island's own store still held in flight at the cap (0 where none, or no store). */
  | { readonly outcome: "hard-cap"; readonly phase: SlotWaitPhase; readonly elapsedMs: number; readonly storeReads: number };

/** Wait for one slot document until an event ends the wait ({@link SlotWaitDeps}). */
export async function waitForSlotDocument<H>(deps: SlotWaitDeps<H>): Promise<SlotWaitOutcome<H>> {
  const { budgets } = deps;
  const started = deps.now();
  // undefined = an ask stands unanswered · "verdict" = the connected vessel answered without it · "no-peer" = the Repo
  // settled with no peer connected, which carries no word about the document.
  let settled: { handle: H } | { refused: string } | "verdict" | "no-peer" | undefined;
  // When the vessel's verdict first stood, through every re-ask that drew it again; a no-peer reading clears it.
  let verdictSince: number | null = null;
  let changed = false;
  let resolveSignal: (() => void) | undefined;
  const signal = (): void => { changed = true; resolveSignal?.(); };
  let live = true;
  const ask = (): void => {
    settled = undefined;
    // A peer gave the verdict only when one stood connected BEFORE the ask and still stands at the rejection: a
    // peer that joins after the Repo already settled never saw this ask.
    const peerAtAsk = deps.peerCount() > 0;
    void deps.find().then(
      (handle) => { if (!live) return; settled = { handle }; signal(); },
      (rejection) => {
        if (!live) return;
        if (!deps.absence(rejection)) { settled = { refused: rejection instanceof Error ? rejection.message : String(rejection) }; signal(); return; }
        if (peerAtAsk && deps.peerCount() > 0) { settled = "verdict"; verdictSince ??= deps.now(); }
        else { settled = "no-peer"; verdictSince = null; }
        signal();
      },
    );
  };
  const final = (): SlotWaitOutcome<H> | null => {
    if (settled === undefined || settled === "verdict" || settled === "no-peer") return null;
    return "refused" in settled ? { outcome: "refused", why: settled.refused } : { outcome: "ready", handle: settled.handle };
  };
  const elapsed = (): number => deps.now() - started;
  const capped = (): boolean => elapsed() >= budgets.hardCapMs;
  // The grace runs from the later of the verdict and the last inbound message: a vessel still moving traffic may yet
  // bring the document, so its verdict waits for the port to fall still.
  const graceLeft = (): number => verdictSince === null ? Infinity : budgets.verdictGraceMs - (deps.now() - Math.max(verdictSince, deps.lastHeard()));
  const storeReads = (): number => deps.store?.().inFlight ?? 0;
  const phase = (): SlotWaitPhase => storeReads() > 0 ? "store" : settled === "no-peer" ? "no-peer" : settled === "verdict" ? "verdict" : "asked";

  // With a wake subscription, a moved source re-asks; without one, each poll that comes round does.
  let reaskDue = false;
  const unsubscribe = deps.onWake?.(() => { reaskDue = true; signal(); }) ?? (() => {});
  // One outstanding timer, renewed only when the next wake must come sooner than the one it holds.
  let deadline: { readonly at: number; readonly done: Promise<void> } | undefined;
  try {
    ask();
    for (;;) {
      const done = final();
      if (done) return done;
      if (settled === "verdict" && graceLeft() <= 0) {
        await deps.defer();
        const late = final();
        if (late) return late;
        if (settled === "verdict" && graceLeft() <= 0) return { outcome: "verdict" };
        continue;
      }
      if (reaskDue && (settled === "verdict" || settled === "no-peer")) { reaskDue = false; ask(); continue; }
      if (capped()) {
        await deps.defer();
        const late = final();
        if (late) return late;
        return { outcome: "hard-cap", phase: phase(), elapsedMs: Math.round(elapsed()), storeReads: storeReads() };
      }
      if (changed) { changed = false; continue; }
      const toCap = budgets.hardCapMs - elapsed();
      const wait = Math.max(0, deps.onWake
        ? Math.min(toCap, settled === "verdict" ? graceLeft() : toCap)
        : Math.min(budgets.pollMs, toCap));
      const at = deps.now() + wait;
      if (!deadline || at < deadline.at) {
        const mine = { at, done: deps.sleep(wait).then(() => { if (deadline === mine) deadline = undefined; if (!deps.onWake) reaskDue = true; }) };
        deadline = mine;
      }
      await Promise.race([deadline.done, new Promise<void>((resolve) => { resolveSignal = resolve; })]);
      resolveSignal = undefined;
    }
  } finally { live = false; unsubscribe(); }
}
