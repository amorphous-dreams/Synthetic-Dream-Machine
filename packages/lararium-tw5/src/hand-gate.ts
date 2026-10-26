interface GateEntry {
  marks: number;
  flush: () => Promise<void>;
  waiters: Array<{ resolve: () => void; reject: (error: Error) => void }>;
}

/** A title's hands gather until an island boundary or eight marks. */
export class HandGate {
  static readonly COALESCE_CAP = 8;
  private readonly entries = new Map<string, GateEntry>();

  mark(title: string, flush: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let entry = this.entries.get(title);
      if (!entry) {
        entry = { marks: 0, flush, waiters: [] };
        this.entries.set(title, entry);
      }
      entry.flush = flush;
      entry.marks++;
      entry.waiters.push({ resolve, reject });
      if (entry.marks === HandGate.COALESCE_CAP) void this.flush(title).catch(() => {});
    });
  }

  async flush(title: string): Promise<void> {
    const entry = this.entries.get(title);
    if (!entry) return;
    this.entries.delete(title);
    try {
      await entry.flush();
      entry.waiters.forEach((waiter) => waiter.resolve());
    } catch (error) {
      const fault = error instanceof Error ? error : new Error(String(error));
      entry.waiters.forEach((waiter) => waiter.reject(fault));
      throw fault;
    }
  }

  /** A boundary takes the entries already marked when it began. */
  boundary(): Promise<void> { return this.flushAll(); }

  /** A discrete act takes its own titles before any store call. */
  consume(titles: readonly string[]): { settle(error?: Error): void } {
    const waiters: GateEntry["waiters"] = [];
    for (const title of new Set(titles)) {
      const entry = this.entries.get(title);
      if (!entry) continue;
      this.entries.delete(title);
      waiters.push(...entry.waiters);
    }
    return { settle: (error) => waiters.forEach((waiter) => error ? waiter.reject(error) : waiter.resolve()) };
  }

  async flushAll(): Promise<void> {
    const results = await Promise.allSettled([...this.entries.keys()].map((title) => this.flush(title)));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) throw failed.reason;
  }

  has(title: string): boolean { return this.entries.has(title); }
  titles(): string[] { return [...this.entries.keys()]; }
}
