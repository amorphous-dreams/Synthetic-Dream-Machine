/**
 * drain — the shore's ONE drain: one owner of drain state, three verbs (mark, whenAcked, close), one typed flight.
 *
 * OPERATOR RULING (2026-11-04): ONE store write in flight across the whole shore. A mark only records that a title owes the store its
 * latest state at a fresh generation; it never starts work. The pump takes ONE owed title, snapshots its generation at flight start,
 * issues ONE write, and awaits its DURABLE receipt (the write callback resolves only on the receipt capability's heads ack, plus the projector's
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
 * Memory stays bounded by titles: one slot per owed title, one live waiter per title (a newer generation settles the older ones `superseded`), and a slot leaves once its receipts cover it.
 * Writes stay idempotent by (title, generation): a retry after an ambiguous failure writes the title's latest state again.
 *
 * THE KICK RULE (operator ruling 2026-11-04): `kick()` is a REQUEST, never a write. It sets flight-eligible state (releases a standing refusal,
 * records a demand) and goes through `schedule()` or finds the flight already standing; it never starts a second write beside a flight.
 * A landing wave releases only its OWN title's standing refusal. Patience belongs to the receipt capability: the drain holds no timer, so a
 * door that gives up REJECTS its write, the generation goes terminal `failed`, and every waiter, `close` included, settles.
 * `forget(title)` drops moot owed work (its waiters read `superseded`) and ABANDONS the title's dependent edges: their removals reach
 * the terminal outcome `abandoned` and the sources stay, so nothing leaves without the ack it waited on.
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
  /** The dependency edge: this title waits until `target`'s receipts cover `generation`. */
  after: { readonly target: string; readonly generation: number } | null;
}

interface Waiter {
  readonly title: string | null;
  readonly generation: number;
  /** A terminal word a forget laid on this waiter: it reads this where the slots would read acked. */
  verdict: DrainOutcome | null;
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
  /** One waiter per (title or whole drain, generation); a call for a standing key shares it. */
  readonly #waiters = new Map<string, Waiter>();
  /** THE one flight: the pump starts only when it reads null. */
  #flight: Promise<void> | null = null;
  #scheduled = false;
  /** A lifecycle request arrived while the write flew: should that write fail, the request still stands for its title. */
  #demanded = false;
  #generation = 0;
  #closeGeneration: number | null = null;
  #abandonedFrom = 0;

  constructor(deps: DrainDeps) {
    this.#write = deps.write;
    this.#schedule = deps.schedule ?? macrotask();
  }

  /** The title owes the store its latest state at a fresh generation. Never starts a write. */
  mark(title: string): number {
    const gen = ++this.#generation;
    if (this.#closeGeneration !== null) {
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

  /** Mark `title`, parked until `targetTitle`'s receipts cover `targetGeneration` (an act's removal behind its target). */
  markAfter(title: string, targetTitle: string, targetGeneration: number): number {
    const gen = this.mark(title);
    const slot = this.#slots.get(title);
    if (slot && this.#closeGeneration === null) slot.after = { target: targetTitle, generation: targetGeneration };
    return gen;
  }

  /**
   * A causal boundary (an act, a lifecycle request): failed titles may try again (`retry`), and an idle pump starts now. A dispatch's
   * end passes `retry: false`, so a refusal that raises a wiki alert never retries itself through that alert's own dispatch. A
   * lifecycle request made while a write flies (`demand`, on by default with `retry`) stands for that write's title should it fail;
   * a landing wave passes `demand: false`, since a wave that met the flight asked nothing of its outcome.
   */
  kick(opts: { readonly retry?: boolean; readonly demand?: boolean; readonly only?: string } = {}): void {
    const retry = opts.retry !== false;
    if (retry) this.#unblock(opts.only);
    if (retry && opts.demand !== false && this.#flight !== null) this.#demanded = true;
    this.#pump();
  }

  /** Resolves once every generation at or below `generation` (default: now) reaches a terminal outcome. */
  whenAcked(generation: number = this.#generation): Promise<DrainOutcome> {
    return this.#wait(null, generation);
  }

  /** Resolves once `title`'s generations up to `generation` (default: now) reach a terminal outcome; one shared waiter per (title, generation). */
  whenSettled(title: string, generation: number = this.#generation): Promise<DrainOutcome> {
    return this.#wait(title, generation);
  }

  /** Refuse new marks (they read abandoned) and await the owed work; a failed write answers failed, never a hang. */
  close(): Promise<DrainOutcome> {
    if (this.#closeGeneration === null) this.#closeGeneration = this.#generation;
    return this.whenAcked(this.#closeGeneration);
  }

  /**
   * Drop a title's owed work that a later act made moot: its waiters read superseded. Its dependent edges are ABANDONED (their removals
   * read abandoned and the sources stay). A write in flight keeps its own course.
   */
  forget(title: string): void {
    const slot = this.#slots.get(title);
    if (!slot || slot.flying !== 0) return;
    this.#drop(slot, SUPERSEDED);
    for (const dependent of [...this.#slots.values()]) {
      if (dependent.after?.target === title && dependent.flying === 0) this.#drop(dependent, ABANDONED);
    }
    this.#settle();
  }

  #drop(slot: Slot, outcome: DrainOutcome): void {
    this.#slots.delete(slot.title);
    this.#blocked.delete(slot);
    for (const waiter of this.#waiters.values()) {
      if ((waiter.title === null || waiter.title === slot.title) && slot.owedFrom !== 0 && waiter.generation >= slot.owedFrom) waiter.verdict ??= outcome;
    }
    for (const dependent of [...this.#slots.values()]) {
      if (dependent.after?.target === slot.title && dependent.flying === 0) this.#drop(dependent, ABANDONED);
    }
  }

  /** How many waiters stand live: a title holds at most one; with no title, the whole count. */
  waiters(title?: string): number {
    if (title === undefined) return this.#waiters.size;
    let n = 0;
    for (const waiter of this.#waiters.values()) if (waiter.title === title) n++;
    return n;
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

  #unblock(only?: string): void {
    for (const slot of this.#blocked) {
      if (only !== undefined && slot.title !== only) continue;
      slot.blocked = null; slot.retry = true;
      this.#blocked.delete(slot);
    }
  }

  #edgeMet(edge: { readonly target: string; readonly generation: number }): boolean {
    const target = this.#slots.get(edge.target);
    return target === undefined || target.acked >= edge.generation || target.owedFrom === 0 || target.owedFrom > edge.generation;
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

  #status(slot: Slot, generation: number): Status {
    if (slot.owedFrom === 0 || slot.owedFrom > generation) return null;
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
      const status = slot ? this.#status(slot, waiter.generation) : null;
      if (status === PENDING) return null;
      failed = status;
    } else {
      for (const slot of this.#slots.values()) {
        const status = this.#status(slot, waiter.generation);
        if (status === PENDING) return null;
        failed ??= status;
      }
    }
    if (failed) return { kind: "failed", error: failed };
    if (waiter.verdict) return waiter.verdict;
    if (this.#abandonedFrom !== 0 && waiter.generation >= this.#abandonedFrom) return ABANDONED;
    return ACKED;
  }

  #wait(title: string | null, generation: number): Promise<DrainOutcome> {
    const key = `${title ?? "\u0000"}\u0001${generation}`;
    const standing = this.#waiters.get(key);
    if (standing) return standing.promise;
    let resolve!: (outcome: DrainOutcome) => void;
    const promise = new Promise<DrainOutcome>((done) => { resolve = done; });
    const waiter: Waiter = { title, generation, verdict: null, promise, resolve };
    const now = this.#outcome(waiter);
    if (now) return Promise.resolve(now);
    // At most ONE live waiter per title: the newest generation covers every older one (a write carries the title's latest state), so an
    // older waiter settles `superseded` and a request older than the standing waiter reads it at once. Memory stays bounded by titles.
    if (title !== null) {
      for (const [other, standing] of this.#waiters) {
        if (standing.title !== title) continue;
        if (standing.generation > generation) return Promise.resolve(SUPERSEDED);
        this.#waiters.delete(other);
        standing.resolve(SUPERSEDED);
      }
    }
    this.#waiters.set(key, waiter);
    return promise;
  }

  #settle(): void {
    for (const [key, waiter] of this.#waiters) {
      const outcome = this.#outcome(waiter);
      if (outcome) { this.#waiters.delete(key); waiter.resolve(outcome); }
    }
  }
}
