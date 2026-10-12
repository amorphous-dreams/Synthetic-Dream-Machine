export interface ShoreTimers {
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

const systemTimers: ShoreTimers = {
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface GateEntry {
  trailing: unknown;
  cap: unknown;
  flush: () => Promise<void>;
  waiters: Array<{ resolve: () => void; reject: (error: Error) => void }>;
}

/** The cap is five trailing windows: continuous typing still reaches storage within two seconds. Timers pace absolute writes only. */
export class HandGate {
  static readonly TRAILING_MS = 400;
  static readonly CAP_MS = 2_000;
  private readonly entries = new Map<string, GateEntry>();

  constructor(private readonly timers: ShoreTimers = systemTimers) {}

  mark(title: string, flush: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let entry = this.entries.get(title);
      if (!entry) {
        const created: GateEntry = { trailing: undefined, cap: undefined, flush, waiters: [] };
        created.cap = this.timers.setTimer(() => { void this.flush(title).catch(() => {}); }, HandGate.CAP_MS);
        this.entries.set(title, entry = created);
      }
      entry.flush = flush;
      entry.waiters.push({ resolve, reject });
      if (entry.trailing !== undefined) this.timers.clearTimer(entry.trailing);
      entry.trailing = this.timers.setTimer(() => { void this.flush(title).catch(() => {}); }, HandGate.TRAILING_MS);
    });
  }

  async flush(title: string): Promise<void> {
    const entry = this.entries.get(title);
    if (!entry) return;
    this.entries.delete(title);
    this.timers.clearTimer(entry.trailing);
    this.timers.clearTimer(entry.cap);
    try {
      await entry.flush();
      entry.waiters.forEach((waiter) => waiter.resolve());
    } catch (error) {
      const fault = error instanceof Error ? error : new Error(String(error));
      entry.waiters.forEach((waiter) => waiter.reject(fault));
      throw fault;
    }
  }

  async flushAll(): Promise<void> {
    const results = await Promise.allSettled([...this.entries.keys()].map((title) => this.flush(title)));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) throw failed.reason;
  }

  has(title: string): boolean { return this.entries.has(title); }
  titles(): string[] { return [...this.entries.keys()]; }
}
