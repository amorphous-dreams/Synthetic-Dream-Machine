/**
 * ack-paced-trigger — WHEN the shore's one drain fires: its own clock is the durable acknowledgement of its last write.
 *
 * OPERATOR RULING (2026-11-04, Luna's read `luna-draft-rest`): ONE write in flight per drain. On its DURABLE ack, if a newer generation
 * of any title arrived meanwhile, the latest coalesced state is written next; otherwise the drain rests. "Durable ack" is the rest door's
 * heads acknowledgement from the vessel's STORAGE-BACKED Repo (and, for recovery files, the disk projector's file-hash confirm), never the
 * worker's in-memory flush (it has no storage and returns at once). A warn-only failure is NOT an ack: the obligation stays and the next
 * request writes the latest generation. NO timer, NO idle debounce, NO soft ceiling. Lifecycle (teardown, handsRested, the page's
 * visibilitychange/pagehide signalled over its port) only REQUESTS a drain, best effort, never the guarantee.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */
import type { RecoveryTrigger } from "./hand-gate.js";

export interface AckPacedDeps {
  /** The titles the drain owes right now (every marked title, ordinary and draft alike). */
  readonly pending: () => readonly string[];
  /** Capture the pass before firing, restoring it on failure without replacing newer work. */
  readonly retryOnFailure: (titles: readonly string[]) => () => void;
  /** Resolves on the DURABLE ack of what the pass wrote; rejects when none comes. */
  readonly ack: (fired: readonly string[]) => Promise<void>;
}

export class AckPacedTrigger implements RecoveryTrigger {
  #fire: ((titles?: readonly string[]) => Promise<void>) | null = null;
  #flight: Promise<void> | null = null;
  constructor(private readonly deps: AckPacedDeps) {}

  attach(fire: (titles?: readonly string[]) => Promise<void>): () => void {
    this.#fire = fire;
    return () => { if (this.#fire === fire) this.#fire = null; };
  }

  /** The write in flight, or null at rest. */
  flight(): Promise<void> | null { return this.#flight; }

  /** Ask for a pass: starts exactly one write when none is in flight and something is owed; otherwise a no-op. */
  request(): void {
    if (this.#fire === null || this.#flight !== null) return;
    const owed = [...this.deps.pending()];
    if (owed.length === 0) return;
    this.#flight = this.#run(owed, this.deps.retryOnFailure(owed));
  }

  async #run(titles: readonly string[], restore: () => void): Promise<void> {
    let acked = false;
    try {
      await this.#fire!(titles);
      await this.deps.ack(titles);
      acked = true;
    } catch { restore(); /* the next request writes the latest generation */ }
    finally { this.#flight = null; }
    // A newer generation that arrived while this write was in flight goes next; a failed pass waits for the next request.
    if (acked) this.request();
  }
}
