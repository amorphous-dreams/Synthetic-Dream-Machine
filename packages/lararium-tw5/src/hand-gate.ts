interface GateEntry {
  marks: number;
  flush: () => Promise<void>;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

/** A title's hands gather until an island boundary or eight marks. */
export class HandGate {
  static readonly COALESCE_CAP = 8;
  private readonly entries = new Map<string, GateEntry>();

  mark(title: string, flush: () => Promise<void>, draft = false): Promise<void> {
    let entry = this.entries.get(title);
    if (!entry) {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
      entry = { marks: 0, flush, promise, resolve, reject };
      this.entries.set(title, entry);
    }
    entry.flush = flush;
    entry.marks++;
    if (!draft && entry.marks >= HandGate.COALESCE_CAP) void this.flush(title).catch(() => {});
    return entry.promise;
  }

  async flush(title: string): Promise<void> {
    const entry = this.entries.get(title);
    if (!entry) return;
    this.entries.delete(title);
    try {
      await entry.flush();
      entry.resolve();
    } catch (error) {
      const fault = error instanceof Error ? error : new Error(String(error));
      entry.reject(fault);
      throw fault;
    }
  }

  /** A boundary takes the entries already marked when it began. */
  boundary(): Promise<void> { return this.flushAll(); }

  /** A discrete act takes its own titles before any store call. */
  consume(titles: readonly string[]): { settle(error?: Error): void } {
    const entries: GateEntry[] = [];
    for (const title of new Set(titles)) {
      const entry = this.entries.get(title);
      if (!entry) continue;
      this.entries.delete(title);
      entries.push(entry);
    }
    return { settle: (error) => entries.forEach((entry) => error ? entry.reject(error) : entry.resolve()) };
  }

  async flushAll(): Promise<void> {
    const results = await Promise.allSettled([...this.entries.keys()].map((title) => this.flush(title)));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) throw failed.reason;
  }

  has(title: string): boolean { return this.entries.has(title); }
  titles(): string[] { return [...this.entries.keys()]; }
}
