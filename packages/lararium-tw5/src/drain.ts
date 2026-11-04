/**
 * drain — the shore's ONE drain: one owner of drain state, three verbs (mark, whenAcked, close), one typed flight.
 *
 * OPERATOR RULING (2026-11-04): ONE store write in flight across the whole shore. A mark only records that a title owes the store its
 * latest state at a fresh generation; it never starts work. The pump takes ONE owed title, snapshots its generation at flight start,
 * issues ONE write, and awaits its DURABLE receipt (the write callback resolves only on the rest door's heads ack, plus the projector's
 * file-hash confirm for recovery files). The receipt raises `acked` to the snapshot; a generation marked during the flight stays owed,
 * so coalescing falls out of the generations: a title whose receipts cover its latest mark costs no write.
 *
 * A completion only moves state, then asks for the next turn through the ONE `schedule()` site, which yields to a macrotask
 * (`setImmediate` in node, a MessageChannel in a browser). A yield decides nothing, so it holds no clock. A failed write gives its waiters
 * a terminal `failed` outcome and keeps the title owed; it never re-arms itself, not even for a generation marked during its flight. The
 * next request (any later mark, or a causal `kick`) lets it try again with the title's latest state.
 *
 * An act's removal rides a dependency edge (`markAfter`): it stays parked until the target's receipts cover the act's own generation,
 * then rides as an ordinary owed title. A removal behind a refused target reads that refusal as its own terminal outcome.
 *
 * Memory stays bounded by titles: one slot per owed title, one shared waiter per title, and a slot leaves once its receipts cover it.
 * Writes stay idempotent by (title, generation): a retry after an ambiguous failure writes the title's latest state again.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

/** A waiter's terminal outcome. */
export type DrainOutcome =
  | { readonly kind: "acked" }
  | { readonly kind: "failed"; readonly error: Error }
  | { readonly kind: "superseded" }
  | { readonly kind: "abandoned" };

export interface DrainDeps {
  /** Write the title's latest state; resolves on its DURABLE receipt, rejects when none comes. */
  write(title: string, gen: number): Promise<void>;
  /** Run `run` on a later macrotask. The default yields through `setImmediate` (node) or a MessageChannel (browser). */
  schedule?(run: () => void): void;
}

interface Slot {
  readonly title: string;
  /** The latest generation marked. */
  dirty: number;
  /** The highest generation a durable receipt covers. */
  acked: number;
  /** The smallest marked generation no receipt covers yet (0: the title owes nothing). */
  owedFrom: number;
  /** The generation the write in flight carries (0: none flies for this title). */
  flying: number;
  /** The first generation marked while that write flies (0: none). */
  nextFrom: number;
  /** A failed write's error: the title waits for the next request. */
  blocked: Error | null;
  /** A request released a refusal: the retry rides behind fresh owed work. */
  retry: boolean;
  /** A write of this title was refused and none has been acknowledged since. */
  refused: boolean;
  /** The dependency edge: this title waits until `target`'s receipts cover `epoch`. */
  after: { readonly target: string; readonly epoch: number } | null;
}

interface Waiter {
  readonly title: string | null;
  epoch: number;
  readonly promise: Promise<DrainOutcome>;
  readonly resolve: (outcome: DrainOutcome) => void;
}

const ACKED: DrainOutcome = { kind: "acked" };
const SUPERSEDED: DrainOutcome = { kind: "superseded" };
const ABANDONED: DrainOutcome = { kind: "abandoned" };
const PENDING = Symbol("pending");
type Status = typeof PENDING | Error | null;

/** The default schedule() door: a macrotask yield, never a timer. */
export function macrotask(): (run: () => void) => void {
  if (typeof setImmediate === "function") return (run) => { setImmediate(run); };
  const channel = new MessageChannel();
  const queued: Array<() => void> = [];
  channel.port1.onmessage = () => { queued.shift()?.(); };
  return (run) => { queued.push(run); channel.port2.postMessage(null); };
}

export class Drain {
  readonly #write: (title: string, gen: number) => Promise<void>;
  readonly #schedule: (run: () => void) => void;
  readonly #slots = new Map<string, Slot>();
  readonly #blocked = new Set<Slot>();
  readonly #waiters = new Set<Waiter>();
  readonly #titleWaiters = new Map<string, Waiter>();
  /** THE one flight: the pump starts only when it reads null. */
  #flight: Promise<void> | null = null;
  #scheduled = false;
  /** A lifecycle request arrived while the write flew: should that write fail, the request still stands for its title. */
  #demanded = false;
  #epoch = 0;
  #closeEpoch: number | null = null;
  #abandonedFrom = 0;

  constructor(deps: DrainDeps) {
    this.#write = deps.write;
    this.#schedule = deps.schedule ?? macrotask();
  }

  /** The title owes the store its latest state at a fresh generation. Never starts a write. */
  mark(title: string): number {
    const gen = ++this.#epoch;
    if (this.#closeEpoch !== null) {
      if (this.#abandonedFrom === 0) this.#abandonedFrom = gen;
      return gen;
    }
    this.#unblock();
    let slot = this.#slots.get(title);
    if (!slot) {
      slot = { title, dirty: 0, acked: 0, owedFrom: 0, flying: 0, nextFrom: 0, blocked: null, retry: false, refused: false, after: null };
      this.#slots.set(title, slot);
    }
    slot.dirty = gen;
    if (slot.owedFrom === 0) slot.owedFrom = gen;
    if (slot.flying !== 0 && slot.nextFrom === 0) slot.nextFrom = gen;
    this.#ask();
    return gen;
  }

  /** Mark `title`, parked until `targetTitle`'s receipts cover `targetEpoch` (an act's removal behind its target). */
  markAfter(title: string, targetTitle: string, targetEpoch: number): number {
    const gen = this.mark(title);
    const slot = this.#slots.get(title);
    if (slot && this.#closeEpoch === null) slot.after = { target: targetTitle, epoch: targetEpoch };
    return gen;
  }

  /**
   * A causal boundary (an act, a lifecycle request): failed titles may try again (`retry`), and an idle pump starts now. A dispatch's
   * end passes `retry: false`, so a refusal that raises a wiki alert never retries itself through that alert's own dispatch. A
   * lifecycle request made while a write flies (`demand`, on by default with `retry`) stands for that write's title should it fail;
   * a landing wave passes `demand: false`, since a wave that met the flight asked nothing of its outcome.
   */
  kick(opts: { readonly retry?: boolean; readonly demand?: boolean } = {}): void {
    const retry = opts.retry !== false;
    if (retry) this.#unblock();
    if (retry && opts.demand !== false && this.#flight !== null) this.#demanded = true;
    this.#pump();
  }

  /** Resolves once every generation at or below `epoch` (default: now) reaches a terminal outcome. */
  whenAcked(epoch: number = this.#epoch): Promise<DrainOutcome> {
    return this.#wait(null, epoch);
  }

  /** Resolves once `title`'s generations up to `epoch` (default: now) reach a terminal outcome; one shared waiter per title. */
  whenSettled(title: string, epoch: number = this.#epoch): Promise<DrainOutcome> {
    const shared = this.#titleWaiters.get(title);
    if (shared) { shared.epoch = Math.max(shared.epoch, epoch); return shared.promise; }
    return this.#wait(title, epoch);
  }

  /** Refuse new marks (they read abandoned) and await the owed work; a failed write answers failed, never a hang. */
  close(): Promise<DrainOutcome> {
    if (this.#closeEpoch === null) this.#closeEpoch = this.#epoch;
    return this.whenAcked(this.#closeEpoch);
  }

  /** Drop a title's owed work that a later act made moot; its waiters read superseded. A write in flight keeps its own course. */
  forget(title: string): void {
    const slot = this.#slots.get(title);
    if (!slot || slot.flying !== 0) return;
    this.#slots.delete(title);
    this.#blocked.delete(slot);
    const waiter = this.#titleWaiters.get(title);
    if (waiter) { this.#titleWaiters.delete(title); waiter.resolve(SUPERSEDED); }
    this.#settle();
  }

  /** How many titles hold a slot. */
  size(): number { return this.#slots.size; }
  /** True while the title owes the store anything (a write in flight, a dirty generation, a parked edge). */
  owes(title: string): boolean { return this.#slots.has(title); }
  /** True while the title waits on a dependency edge its target has not met. */
  parked(title: string): boolean {
    const slot = this.#slots.get(title);
    return slot !== undefined && slot.after !== null && !this.#edgeMet(slot.after);
  }
  /** Every title holding a slot, in mark order. */
  titles(): string[] { return [...this.#slots.keys()]; }
  /**
   * The titles still owed a write: not parked behind an edge, and not on a first flight at their latest generation (a title whose
   * write was refused stays here until a write of it is acknowledged, its retry in flight included).
   */
  pending(): string[] {
    const out: string[] = [];
    for (const slot of this.#slots.values()) {
      if (slot.owedFrom === 0 || (!slot.refused && slot.flying !== 0 && slot.flying === slot.dirty)) continue;
      if (slot.after && !this.#edgeMet(slot.after)) continue;
      out.push(slot.title);
    }
    return out;
  }

  // ---------------------------------------------------------------------------

  #unblock(): void {
    for (const slot of this.#blocked) { slot.blocked = null; slot.retry = true; }
    this.#blocked.clear();
  }

  #edgeMet(edge: { readonly target: string; readonly epoch: number }): boolean {
    const target = this.#slots.get(edge.target);
    return target === undefined || target.acked >= edge.epoch || target.owedFrom === 0 || target.owedFrom > edge.epoch;
  }

  #pumpable(slot: Slot): boolean {
    return slot.owedFrom !== 0 && slot.blocked === null && slot.flying === 0 && (slot.after === null || this.#edgeMet(slot.after));
  }

  /** The next title to write: fresh owed work first, then a released refusal's retry, each in mark order. */
  #pick(): Slot | null {
    let retry: Slot | null = null;
    for (const slot of this.#slots.values()) {
      if (!this.#pumpable(slot)) continue;
      if (!slot.retry) return slot;
      retry ??= slot;
    }
    return retry;
  }

  /** The ONE schedule() site. */
  #ask(): void {
    if (this.#scheduled || this.#flight !== null || this.#pick() === null) return;
    this.#scheduled = true;
    this.#schedule(() => { this.#scheduled = false; this.#pump(); });
  }

  #pump(): void {
    if (this.#flight !== null) return;
    const slot = this.#pick();
    if (!slot) return;
    slot.after = null;
    slot.retry = false;
    this.#demanded = false;
    slot.flying = slot.dirty;
    slot.nextFrom = 0;
    // The guard stands BEFORE the write starts: an async body runs synchronously to its first await, and a re-entrant request must read a flight.
    this.#flight = Promise.resolve();
    this.#flight = this.#fly(slot, slot.dirty);
  }

  async #fly(slot: Slot, gen: number): Promise<void> {
    let error: Error | null = null;
    try { await this.#write(slot.title, gen); }
    catch (fault) { error = fault instanceof Error ? fault : new Error(String(fault)); }
    this.#flight = null;
    slot.flying = 0;
    if (error === null) {
      slot.acked = Math.max(slot.acked, gen);
      slot.owedFrom = slot.nextFrom;
      slot.refused = false;
    } else {
      slot.refused = true;
      // The title waits, owed, for the next request; a generation marked during the failed flight waits with it, never re-arming it.
      // A lifecycle request made during the flight already stands: the title retries once for it.
      if (!this.#demanded) { slot.blocked = error; this.#blocked.add(slot); }
      else slot.retry = true;
    }
    this.#demanded = false;
    slot.nextFrom = 0;
    if (slot.owedFrom === 0 && this.#slots.get(slot.title) === slot) this.#slots.delete(slot.title);
    this.#settle();
    this.#ask();
  }

  #status(slot: Slot, epoch: number): Status {
    if (slot.owedFrom === 0 || slot.owedFrom > epoch) return null;
    if (slot.blocked) return slot.blocked;
    if (slot.after && !this.#edgeMet(slot.after)) {
      const target = this.#slots.get(slot.after.target);
      if (target?.blocked) return target.blocked;
    }
    return PENDING;
  }

  #outcome(waiter: Waiter): DrainOutcome | null {
    let failed: Error | null = null;
    if (waiter.title !== null) {
      const slot = this.#slots.get(waiter.title);
      const status = slot ? this.#status(slot, waiter.epoch) : null;
      if (status === PENDING) return null;
      failed = status;
    } else {
      for (const slot of this.#slots.values()) {
        const status = this.#status(slot, waiter.epoch);
        if (status === PENDING) return null;
        failed ??= status;
      }
    }
    if (failed) return { kind: "failed", error: failed };
    if (this.#abandonedFrom !== 0 && waiter.epoch >= this.#abandonedFrom) return ABANDONED;
    return ACKED;
  }

  #wait(title: string | null, epoch: number): Promise<DrainOutcome> {
    let resolve!: (outcome: DrainOutcome) => void;
    const promise = new Promise<DrainOutcome>((done) => { resolve = done; });
    const waiter: Waiter = { title, epoch, promise, resolve };
    const now = this.#outcome(waiter);
    if (now) return Promise.resolve(now);
    if (title === null) this.#waiters.add(waiter); else this.#titleWaiters.set(title, waiter);
    return promise;
  }

  #settle(): void {
    for (const waiter of this.#waiters) {
      const outcome = this.#outcome(waiter);
      if (outcome) { this.#waiters.delete(waiter); waiter.resolve(outcome); }
    }
    for (const [title, waiter] of this.#titleWaiters) {
      const outcome = this.#outcome(waiter);
      if (outcome) { this.#titleWaiters.delete(title); waiter.resolve(outcome); }
    }
  }
}
