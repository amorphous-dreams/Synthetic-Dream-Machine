interface GateEntry {
  flush: () => Promise<void>;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * THE ONE NAMED TRIGGER SEAM. The drain decides what leaves and in what state; WHEN a pass runs is the trigger's. The default causal
 * set (a discrete act for its own titles, handsRested, teardown, the island boundary signal, and the end of a change dispatch for
 * ordinary titles) fires `drain.fire()` directly. A trigger attached through `IslandAdaptor.setRecoveryTrigger` takes over the
 * end-of-dispatch fire: its `fire` runs exactly one pass over the named titles (or all). Unwired in production.
 */
export interface RecoveryTrigger {
  attach(fire: (titles?: readonly string[]) => Promise<void>): () => void;
}

/** One latest-state obligation and one completion per title and generation. */
export class HandGate {
  private readonly entries = new Map<string, GateEntry>();
  private readonly running = new Map<string, Promise<void>>();

  private entry(flush: () => Promise<void>): GateEntry {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    // Retried obligations may have no new caller.
    void promise.catch(() => {});
    return { flush, promise, resolve, reject };
  }

  mark(title: string, flush: () => Promise<void>, _draft = false): Promise<void> {
    let entry = this.entries.get(title);
    if (!entry) { entry = this.entry(flush); this.entries.set(title, entry); }
    entry.flush = flush;
    return entry.promise;
  }

  async flush(title: string): Promise<void> {
    // A flush already running for this title finishes first; a NEWER generation marked meanwhile then leaves in this same call, so no
    // fire strands a newer state until another fire.
    const prior = this.running.get(title);
    if (prior) { try { await prior; } catch { /* its own callers see it; the retained obligation is retried below */ } }
    const entry = this.entries.get(title);
    if (!entry) return;
    this.entries.delete(title);
    const run = (async () => {
      try {
        await entry.flush();
        entry.resolve();
      } catch (error) {
        const fault = error instanceof Error ? error : new Error(String(error));
        entry.reject(fault);
        if (!this.entries.has(title)) this.entries.set(title, this.entry(entry.flush));
        throw fault;
      }
    })();
    this.running.set(title, run);
    try { await run; } finally { this.running.delete(title); }
  }

  fire(titles?: readonly string[]): Promise<void> {
    const keys = titles ? [...new Set(titles)] : this.titles();
    return Promise.allSettled(keys.map((title) => this.flush(title))).then((results) => {
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failed) throw failed.reason;
    });
  }
  boundary(): Promise<void> { return this.fire(); }
  flushAll(): Promise<void> { return this.fire(); }

  consume(titles: readonly string[]): { settle(error?: Error): void } {
    const entries: Array<[string, GateEntry]> = [];
    for (const title of new Set(titles)) {
      const entry = this.entries.get(title);
      if (!entry) continue;
      this.entries.delete(title);
      entries.push([title, entry]);
    }
    return { settle: (error) => entries.forEach(([title, entry]) => {
      if (error) {
        entry.reject(error);
        if (!this.entries.has(title)) this.entries.set(title, this.entry(entry.flush));
      } else entry.resolve();
    }) };
  }

  /** Forget the obligation for these titles (their removal is parked behind a target's ack elsewhere): nothing re-fires them. */
  drop(titles: readonly string[]): void { for (const title of titles) this.entries.delete(title); }

  retained(): string[] { return this.titles(); }
  /** Retain this pass for a failed durable acknowledgement without replacing newer marks. */
  retryOnFailure(titles: readonly string[]): () => void {
    const saved = titles.flatMap((title) => {
      const entry = this.entries.get(title);
      return entry ? [{ title, flush: entry.flush }] : [];
    });
    return () => {
      for (const { title, flush } of saved) {
        if (!this.entries.has(title)) this.entries.set(title, this.entry(flush));
      }
    };
  }
  has(title: string): boolean { return this.entries.has(title); }
  titles(): string[] { return [...this.entries.keys()]; }
}
