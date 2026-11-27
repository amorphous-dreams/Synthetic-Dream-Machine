import { takeCrest, type WaveLimits } from "@lararium/mesh/wave-crest";
import { yieldToHost, type HostTaskYield } from "@lararium/mesh/host-task";
import type { LarTiddlerChange } from "@lararium/mesh/tiddler-store";

export interface LandingQueueDoor {
  enqueue(change: LarTiddlerChange): void;
}

/**
 * A prepared landing's synchronous half: true when it landed (or found nothing to land), false when the change must take the
 * lander's whole async road instead (`landOne`), e.g. a hand that has to leave before the wave can land.
 */
export type ApplyPrepared = () => boolean;

/**
 * A lander that splits each landing in two: `prepare` does every read that awaits (the composition, heads, ledgers) and
 * answers the synchronous `apply`, which re-checks whatever may have moved since and writes the wiki. `landOne` stays the
 * single-change road (the owed pass, the retry pass, and a change whose apply declines).
 */
export interface SliceLander {
  landOne(change: LarTiddlerChange): Promise<void>;
  prepare(change: LarTiddlerChange): Promise<ApplyPrepared>;
}

/**
 * The shore owns the ordered wave queue, its slices, and the seed checkpoint.
 *
 * THE GRAIN: the queue holds FAMILIES. A family names the envelopes of one or more whole store changes
 * (`enqueueFamily`); a lone envelope stands as a family of one. A slice gathers whole families up to the
 * quota and lands them with no turn handed to the host in between, so the wiki dispatches its `change`
 * for a root and its children together and no reader of the wiki meets half a carrier. A family larger
 * than the quota lands whole in a slice of its own.
 *
 * ONE TICK PER SLICE: a lander that splits its landing (`SliceLander`) has every change of a slice prepared first (each
 * await allowed), then every prepared change applied in ONE synchronous run with no await between applies, so the wiki
 * coalesces the slice into one `change` dispatch instead of one per tiddler (each dispatch re-runs the wiki's trackers, and
 * a per-tiddler dispatch costs O(N²) across a bulk feed). A change whose apply declines, and every later change of its
 * title in the slice, lands after the run through `landOne`, in slice order. A plain function lander lands one at a time.
 *
 * THE BREATH: the queue tells each slice it lands (`onSliceLanded`). A watchdog that bounds a wait on PROGRESS reads a
 * drain of many slices as moving, slice by slice, and a drain that lands nothing tells nothing and still reads as stuck.
 */
export class WaveLanding {
  static readonly QUOTA = 200;
  /** The slice bound on the one axis the landing queue weighs: changes. */
  private static readonly LIMITS: WaveLimits = { count: WaveLanding.QUOTA, bytes: Number.POSITIVE_INFINITY, ops: Number.POSITIVE_INFINITY };
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

  private readonly landOne: (change: LarTiddlerChange) => Promise<void>;
  private readonly prepare: ((change: LarTiddlerChange) => Promise<ApplyPrepared>) | null;

  constructor(
    lander: ((change: LarTiddlerChange) => Promise<void>) | SliceLander,
    private readonly yieldHost: HostTaskYield = yieldToHost,
    private readonly onLandingFailed: (title: string, error: Error) => void = () => {},
    private readonly onLandingRecovered: (title: string) => void = () => {},
    /** Told once per slice the drain landed, with the rows it landed: the drain's own evidence that it moves. */
    private readonly onSliceLanded: (landed: number) => void = () => {},
    /**
     * THE ENGINE'S CREST DOOR (`$tw.lares.applyNaluCrest`): the slice's synchronous run of applies lands inside it, so the engine,
     * not the shore, names the law that a crest lands in one dispatch. Absent, the run stands bare.
     */
    private readonly crest: <T>(run: () => T) => T = (run) => run(),
  ) {
    if (typeof lander === "function") { this.landOne = lander; this.prepare = null; }
    else { this.landOne = (change) => lander.landOne(change); this.prepare = (change) => lander.prepare(change); }
  }

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

  /** True while a wave of `bag` stays owed (its landing failed twice): the wiki has not taken that bag's change. */
  owesBag(bag: string): boolean {
    for (const change of this.owed.values()) if (change.bag === bag) return true;
    return false;
  }

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
      // Whole families up to the quota; the first family of a slice lands whatever its size (`takeCrest`, the one slice
      // rule the INGEST settle crests by too).
      const slice: LarTiddlerChange[] = takeCrest(this.queue, (family) => ({ count: family.length }), WaveLanding.LIMITS).flat();
      const count = slice.length;
      const failed: Array<{ item: LarTiddlerChange; error: unknown; at: number }> = [];
      const landedAt = new Map<string, number>();
      const landed = (item: LarTiddlerChange, at: number): void => {
        landedAt.set(item.title, at);
        if (this.owed.delete(item.title)) this.onLandingRecovered(item.title);
      };
      if (this.prepare) {
        // PREPARE every change (awaits allowed), then APPLY them all in one synchronous run: one wiki tick per slice.
        const prepared: Array<ApplyPrepared | null> = new Array(count).fill(null);
        for (let i = 0; i < count && !this.stopped; i++) {
          try { prepared[i] = await this.prepare(slice[i]!); }
          catch (error) { failed.push({ item: slice[i]!, error, at: i }); }
        }
        const deferred: number[] = [];
        const deferredTitles = new Set<string>();
        // ONE CREST: no await from here to the end of this run, which lands inside the engine's crest door, so the applies share
        // one tick and the wiki dispatches the slice once.
        this.crest(() => {
          for (let i = 0; i < count && !this.stopped; i++) {
            const item = slice[i]!, apply = prepared[i];
            if (!apply) continue;
            // A title whose earlier change waits for the async road keeps its order: every later change of it waits too.
            if (deferredTitles.has(item.title)) { deferred.push(i); continue; }
            try {
              if (apply()) landed(item, i);
              else { deferred.push(i); deferredTitles.add(item.title); }
            }
            catch (error) { failed.push({ item, error, at: i }); }
          }
        });
        for (const i of deferred) {
          const item = slice[i]!;
          try { await this.landOne(item); landed(item, i); }
          catch (error) { failed.push({ item, error, at: i }); }
        }
      }
      else {
        for (let i = 0; i < count; i++) {
          const item = slice[i]!;
          try { await this.landOne(item); landed(item, i); }
          catch (error) { failed.push({ item, error, at: i }); }
        }
      }
      // The retry pass walks the failures in slice order, whichever half (prepare, apply, or the async road) failed them.
      failed.sort((a, b) => a.at - b.at);
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
      // THE DRAIN BREATHES AS IT WORKS: each landed slice says so, so a long drain that moves never reads as stalled.
      try { this.onSliceLanded(count); } catch { /* a listener's fault never stops the drain */ }
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
