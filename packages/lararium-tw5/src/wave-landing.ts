import { yieldToHost, type HostTaskYield } from "@lararium/mesh";
import type { LarTiddlerChange } from "@lararium/mesh";

export interface LandingQueueDoor {
  enqueue(change: LarTiddlerChange): void;
}

/** The shore owns the ordered wave queue, 200-item slices, and seed checkpoint. */
export class WaveLanding {
  static readonly QUOTA = 200;
  private readonly queue: LarTiddlerChange[] = [];
  private draining = false;
  private stopped = false;
  private drainTask: Promise<void> | null = null;
  private readonly external = new Set<Promise<unknown>>();
  private seeded = false;
  private seedWait: Promise<void> | null = null;
  private seedResolve: (() => void) | null = null;
  private seedReject: ((error: Error) => void) | null = null;
  private seedCompleted = false;
  private seedFailure: Error | null = null;

  constructor(
    private readonly landOne: (change: LarTiddlerChange) => Promise<void>,
    private readonly yieldHost: HostTaskYield = yieldToHost,
  ) {}

  enqueue(change: LarTiddlerChange): void {
    if (this.stopped) return;
    this.queue.push(change);
    this.kick();
  }

  enqueueSeed(change: LarTiddlerChange): void { this.enqueue(change); }

  checkpoint(): Promise<void> {
    if (!this.seedWait) this.seedWait = new Promise<void>((resolve, reject) => { this.seedResolve = resolve; this.seedReject = reject; });
    if (this.seedFailure) return Promise.reject(this.seedFailure);
    this.seeded = true;
    this.kick();
    return this.seedWait;
  }

  pending(): number { return this.queue.length; }

  /** Resolves at every quiescent edge; each call observes the queue and current drain afresh. */
  idle(): Promise<void> {
    if (!this.draining && this.queue.length === 0 && this.external.size === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.idleWaiters.add(resolve));
  }

  private readonly idleWaiters = new Set<() => void>();

  private settleIdle(): void {
    if (this.draining || this.queue.length || this.external.size) return;
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }

  isStopped(): boolean { return this.stopped; }

  track(promise: Promise<unknown>): void {
    this.external.add(promise);
    void promise.finally(() => {
      this.external.delete(promise);
      this.settleSeedIfIdle();
      this.settleIdle();
    }).catch(() => {});
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.queue.length = 0;
    await this.drainTask;
  }

  private kick(): void {
    if (this.draining) return;
    this.draining = true;
    this.drainTask = this.drain();
  }

  private async drain(): Promise<void> {
    // Always begin on a host task. Marks during this yield join this same drain.
    await this.yieldHost();
    while (!this.stopped && this.queue.length) {
      const count = Math.min(WaveLanding.QUOTA, this.queue.length);
      const failed: Array<{ item: LarTiddlerChange; error: unknown }> = [];
      for (let i = 0; i < count; i++) {
        const item = this.queue.shift()!;
        try { await this.landOne(item); }
        catch (error) { failed.push({ item, error }); }
      }
      for (const failure of failed) {
        try { await this.landOne(failure.item); }
        catch (cause) {
          const error = new Error(`wave landing for "${failure.item.title}" failed twice: ${String(cause)}`, { cause });
          if (this.seedCompleted) console.error(`[wave-landing] ${error.message}`);
          else {
            this.seedFailure = error;
            this.seedReject?.(error);
          }
        }
      }
      if (this.queue.length) await this.yieldHost();
    }
    // Clear only at the empty observation. No await separates this from the queue check.
    this.draining = false;
    this.settleSeedIfIdle();
    this.settleIdle();
    if (!this.stopped && this.queue.length) this.kick();
    else this.drainTask = null;
  }

  private settleSeedIfIdle(): void {
    if (!this.seeded || this.draining || this.queue.length || this.external.size) return;
    this.seeded = false;
    this.seedCompleted = true;
    this.seedResolve?.();
    this.seedResolve = null;
    this.seedReject = null;
  }
}
