import { yieldToHost, type HostTaskYield } from "@lararium/mesh";
import type { LarTiddlerChange } from "@lararium/mesh";

export interface LandingQueueDoor {
  enqueue(change: LarTiddlerChange): void;
}

/**
 * The shore owns the ordered wave queue, its slices, and the seed checkpoint.
 *
 * THE GRAIN: the queue holds FAMILIES. A family names the envelopes of one or more whole store changes
 * (`enqueueFamily`); a lone envelope stands as a family of one. A slice gathers whole families up to the
 * quota and lands them with no turn handed to the host in between, so the wiki dispatches its `change`
 * for a root and its children together and no reader of the wiki meets half a carrier. A family larger
 * than the quota lands whole in a slice of its own.
 */
export class WaveLanding {
  static readonly QUOTA = 200;
  private readonly queue: LarTiddlerChange[][] = [];
  private readonly owed = new Map<string, LarTiddlerChange>();
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
    private readonly onLandingFailed: (title: string, error: Error) => void = () => {},
    private readonly onLandingRecovered: (title: string) => void = () => {},
  ) {}

  enqueue(change: LarTiddlerChange): void { this.enqueueFamily([change]); }

  /** Queue the envelopes of whole store changes as one grain: a slice never cuts between them. */
  enqueueFamily(changes: readonly LarTiddlerChange[]): void {
    if (this.stopped || changes.length === 0) return;
    for (const change of changes) if (this.owed.has(change.title)) this.owed.set(change.title, change);
    this.queue.push([...changes]);
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

  pending(): number { return this.queue.reduce((count, family) => count + family.length, 0); }

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
    this.owed.clear();
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
    if (!this.stopped && this.seedCompleted && this.owed.size) {
      for (const [title, change] of [...this.owed]) {
        if (this.stopped) break;
        try {
          await this.landOne(change);
          if (this.owed.get(title) === change) {
            this.owed.delete(title);
            this.onLandingRecovered(title);
          }
        } catch (error) {
          const named = error instanceof Error ? error : new Error(String(error));
          if (this.owed.get(title) === change) this.onLandingFailed(title, named);
        }
      }
    }
    while (!this.stopped && this.queue.length) {
      // Whole families up to the quota; the first family of a slice lands whatever its size.
      const slice: LarTiddlerChange[] = this.queue.shift()!;
      while (this.queue.length && slice.length + this.queue[0]!.length <= WaveLanding.QUOTA) slice.push(...this.queue.shift()!);
      const count = slice.length;
      const failed: Array<{ item: LarTiddlerChange; error: unknown; at: number }> = [];
      const landedAt = new Map<string, number>();
      for (let i = 0; i < count; i++) {
        const item = slice[i]!;
        try {
          await this.landOne(item);
          landedAt.set(item.title, i);
          if (this.owed.delete(item.title)) this.onLandingRecovered(item.title);
        }
        catch (error) { failed.push({ item, error, at: i }); }
      }
      for (const failure of failed) {
        // A later change of the same title landed in this slice: it superseded the failed one.
        if ((landedAt.get(failure.item.title) ?? -1) > failure.at) continue;
        try { await this.landOne(failure.item); }
        catch (cause) {
          const error = new Error(`wave landing for "${failure.item.title}" failed twice: ${String(cause)}`, { cause });
          if (this.seedCompleted) {
            this.owed.set(failure.item.title, failure.item);
            this.onLandingFailed(failure.item.title, error);
          }
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
