/**
 * slot-wait — an island's bounded wait for one slot document, as a pure function over what it asks and measures.
 *
 * An island's Repo reaches its slot documents through ONE peer: the vessel's main thread, over the sync port. The
 * Repo settles a find "unavailable" the moment it holds NO connected peer, and a port whose far end has not yet
 * answered the handshake reads to it as no peer at all. The main thread stalls for whole seconds in synchronous
 * work (a corpus load, a key derivation at an unlock), so an island that asks during such a stall draws an
 * "unavailable" that no peer ever spoke.
 *
 * THE LAW. A rejection with no peer connected says nothing about the document. A rejection a connected peer gave
 * says only that the RELAY holds no copy yet: the main thread answers for the sources it hears at that instant (its
 * store, its dials), asks again as a source arrives, and pushes the document on once one brings it. Either way the
 * wait asks again and stays inside the same two budgets that bound a document still in flight (port silence, and a
 * hard cap). The outcomes:
 *   · the handle, once a find resolves;
 *   · `verdict`: a connected peer answered that it holds no such document, and still answered so when the budget ran
 *     out;
 *   · `refused`: the Repo turned the ask itself away (an address it cannot read); no wait cures that, so it ends at once;
 *   · `never-arrived`: the port stayed silent past its budget, or traffic flowed past the hard cap, with no document.
 */

export interface SlotWaitBudgets {
  readonly silenceMs: number;
  readonly hardCapMs: number;
  readonly pollMs:    number;
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
  /** One turn of the event loop, so queued port messages land before a fault fires. */
  readonly defer:     () => Promise<void>;
  readonly budgets:   SlotWaitBudgets;
}

export type SlotWaitOutcome<H> =
  | { readonly outcome: "ready"; readonly handle: H }
  | { readonly outcome: "verdict" }
  | { readonly outcome: "refused"; readonly why: string }
  | { readonly outcome: "never-arrived"; readonly silentMs: number; readonly elapsedMs: number };

/** Wait for one slot document inside the island's budgets ({@link SlotWaitDeps}). */
export async function waitForSlotDocument<H>(deps: SlotWaitDeps<H>): Promise<SlotWaitOutcome<H>> {
  const { budgets } = deps;
  const started = deps.now();
  // undefined = an ask stands unanswered · "verdict" = a connected peer answered without it · "no-peer" = the Repo
  // settled with no peer connected, which carries no word about the document.
  let settled: { handle: H } | { refused: string } | "verdict" | "no-peer" | undefined;
  const ask = (): void => {
    settled = undefined;
    // A peer gave the verdict only when one stood connected BEFORE the ask and still stands at the rejection: a
    // peer that joins after the Repo already settled never saw this ask.
    const peerAtAsk = deps.peerCount() > 0;
    void deps.find().then(
      (handle) => { settled = { handle }; },
      (rejection) => {
        if (!deps.absence(rejection)) { settled = { refused: rejection instanceof Error ? rejection.message : String(rejection) }; return; }
        settled = peerAtAsk && deps.peerCount() > 0 ? "verdict" : "no-peer";
      },
    );
  };
  // The silence budget clocks from max(last inbound message, THIS wait's start): a slot that resolves from the
  // island's own storage moves no port traffic, so quiet accrued before the ask says nothing about this document.
  const silence = (): number => deps.now() - Math.max(deps.lastHeard(), started);
  const within = (): boolean => silence() < budgets.silenceMs && deps.now() - started < budgets.hardCapMs;
  // A verdict ends the wait only once the budget is spent: until then it is the relay's word for this instant.
  const done = (final: boolean): SlotWaitOutcome<H> | null => {
    if (settled === undefined || settled === "no-peer") return null;
    if (settled === "verdict") return final ? { outcome: "verdict" } : null;
    return "refused" in settled ? { outcome: "refused", why: settled.refused } : { outcome: "ready", handle: settled.handle };
  };
  ask();
  for (;;) {
    await deps.sleep(budgets.pollMs);
    const early = done(false);
    if (early) return early;
    if (within()) {
      // No peer spoke, or the relay holds no copy yet: ask again, inside the same budgets.
      if (settled === "no-peer" || settled === "verdict") ask();
      continue;
    }
    // Verdict deferral: queued port messages get one turn to land (and move the silence clock or settle the
    // find) before the fault fires.
    await deps.defer();
    const late = done(!within());
    if (late) return late;
    if (within()) continue;
    return { outcome: "never-arrived", silentMs: Math.round(silence()), elapsedMs: Math.round(deps.now() - started) };
  }
}
