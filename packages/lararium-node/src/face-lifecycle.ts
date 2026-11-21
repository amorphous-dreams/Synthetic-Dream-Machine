/**
 * face-lifecycle — EACH FACE LIVES ONE LIFE: one serialized lifecycle actor per face the vessel may light.
 *
 * One owner per face. The actor alone holds a face's lifecycle state: its OPENING, the atom key the daemon island knows it by,
 * the custody opening it lit under, the visits it admitted and the work in flight. Nothing else keeps a copy. Each actor runs
 * one mailbox, and no queue spans two faces.
 *
 *   dark ──light──▶ lighting ──light settled──▶ lit(opening)
 *    ▲                 │                          │
 *    │            light refused                 close
 *    │                 ▼                          ▼
 *    └──────────── dark ◀── worker ack / recomposed ── closing(opening)
 *
 * ── NO AWAIT SPLITS A TRANSITION ───────────────────────────────────────────────────────────────
 * A handler reads the state, decides, mutates it and only then runs its effects, all in one turn. Slow work (a light, a save
 * drain, a worker round trip, a recompose) runs outside the actor and comes back as a new message, whose handler reads the state
 * again: an answer that lands after a close finds the face `closing` or `dark`, and does nothing.
 *
 * ── EACH LIGHT A FRESH OPENING ─────────────────────────────────────────────────────────────────
 * Every `lighting` takes a new opening, `<boot nonce>:<n>`, that never repeats in this vessel's life. A relight runs a whole
 * close and then a light, so it always ends under a new opening, and nothing from an old opening matches it again.
 *
 * ── THE CLOSE RUNS IN ORDER ────────────────────────────────────────────────────────────────────
 * `close` stops admitting visits and work at once and refuses every admitted visit not yet delivered. It waits out a light still
 * in flight and the admitted work, then drains the face's queued saves while its sealing seat still stands. Then it tells the
 * worker, tears the host side down and reaches CLOSED: every `close` waiter resolves there, which is the moment a custody holder
 * may lock the key (the pūlama's `face.closed`). The worker's answer is not waited on: an ack takes the face `dark`, and a
 * refusal asks the island supervisor to compose the island again without it, which takes the face `dark` once it stands.
 *
 * ── DELIVERY RUNS IN THE ACTOR ─────────────────────────────────────────────────────────────────
 * A visit's reply never writes on its own. Its delivery reads, in one turn, the state `lit`, the opening it was admitted under
 * and its own standing, and then writes or refuses in that same turn, with no await between the check and the write.
 *
 * ── THE SUPERVISOR READS THE ACTORS ────────────────────────────────────────────────────────────
 * The island composes again (a refused drop, a restart) from the actors' own states: it lights only faces whose actor reads
 * `lit` and never asks custody, so a face `closing` stays out whether or not custody has locked it, and no cycle can form.
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */

/** What a light's slow work hands back: the atom key the island now holds the face under (null where it holds none), and the
 *  custody opening the face lit under (null where none reads). */
export interface FaceLit {
  readonly atomKey: string | null;
  readonly custody: string | null;
}

/** The slow work each transition hands off. Each runs outside the actor; its answer returns as a message. */
export interface FaceLifeEffects {
  /**
   * Light face `ordinal` under `opening`. `live()` reads true while the actor still waits on this light; work that finds it
   * false stops early. It resolves with the atom key the island holds the face under, INCLUDING a light cut short after the
   * island took the face (so the close drops that entry), or throws once nothing of the face stands in the island.
   */
  light(ordinal: number, opening: string, live: () => boolean): Promise<FaceLit>;
  /** Drain the face's queued saves under its own session, while its sealing seat in the island still stands. */
  drainSaves(ordinal: number, opening: string): Promise<void>;
  /** Tell the island to drop the face's entry: resolve = the island acknowledged, reject = it refused the drop. */
  dropWorker(ordinal: number, atomKey: string): Promise<void>;
  /** Drop the host side (its documents' waiting saves from memory, its cache, session and keepers). Synchronous. */
  teardownHost(ordinal: number, opening: string): void;
  /** Compose the island again without every face that does not read `lit` (the island supervisor). */
  recompose(reason: string): Promise<void>;
  readonly log: (line: string) => void;
}

/** A face's lifecycle state, as one read of its actor. */
export type FaceLifeState =
  | { readonly kind: "dark" }
  | { readonly kind: "lighting"; readonly opening: string }
  | { readonly kind: "lit"; readonly opening: string; readonly atomKey: string | null; readonly custody: string | null }
  | { readonly kind: "closing"; readonly opening: string; readonly phase: ClosingPhase };

/** Where a close stands: waiting out a light or work, draining saves, the worker told, or the island composing again. */
export type ClosingPhase = "settling" | "draining" | "told" | "recomposing";

/** Admitted work on a face (a session verb or act): the door dispatches only on the actor's yes, and says `done` once it settled. */
export interface WorkTicket {
  readonly opening: string;
  done(): void;
}

/** An admitted visit to a face: its reply delivers through the actor, or the actor refuses it first. */
export interface VisitTicket {
  readonly opening: string;
  /**
   * Deliver the reply in the actor: `write` runs in this same turn when the face still stands lit under the admitted opening and
   * the visit was not refused; otherwise `refuse` runs, unless the visit already answered (refused at a close, or dropped).
   */
  deliver(write: () => void, refuse: (reason: string) => void): void;
  /** The asker left: the actor forgets the visit and writes nothing for it. */
  drop(): void;
}

/** Why a light request answered as it did. */
export type LightAnswer = "lit" | "refused";

type Waiter<T> = (value: T) => void;
interface Visit { readonly refuse: (reason: string) => void }

type Life =
  | { kind: "dark" }
  | { kind: "lighting"; opening: string; waiters: Array<Waiter<LightAnswer>> }
  | { kind: "lit"; opening: string; atomKey: string | null; custody: string | null; visits: Map<number, Visit>; work: Set<number> }
  | { kind: "closing"; opening: string; atomKey: string | null; custody: string | null; phase: ClosingPhase; lightPending: boolean; work: Set<number>;
      closedWaiters: Array<Waiter<void>>; relight: Array<Waiter<LightAnswer>> | null };

type Message =
  | { t: "light"; waiter: Waiter<LightAnswer> }
  | { t: "adopt"; lit: FaceLit }
  | { t: "light-settled"; opening: string; lit: FaceLit | null; error?: unknown }
  | { t: "close"; reason: string; custody: string | null | undefined; waiter: Waiter<void> }
  | { t: "work-done"; opening: string; id: number }
  | { t: "saves-drained"; opening: string }
  | { t: "worker-ack"; opening: string }
  | { t: "worker-refused"; opening: string; error: unknown }
  | { t: "recomposed" };

/** The vessel's set of face actors and its island supervisor. */
export interface FaceLives {
  /** Light a face: dark lights under a fresh opening; lighting or lit joins; closing lights again, fresh, once it reads dark. */
  light(ordinal: number): Promise<LightAnswer>;
  /** The composition stood with this face lit (the island's manifest carried it): the actor reads lit under a fresh opening. */
  adopt(ordinal: number, lit: FaceLit): void;
  /**
   * Close a face, resolving at CLOSED (saves drained, worker told, host torn down); a dark face resolves at once. Where `custody`
   * names the custody opening a close answers (the pūlama's `closing`), a face lit under ANOTHER known custody opening keeps
   * standing and the close resolves at once: nothing serves the opening it names.
   */
  close(ordinal: number, reason: string, custody?: string | null): Promise<void>;
  /** The opening a face stands lit under now, or null. */
  opening(ordinal: number): string | null;
  /** The custody opening a lit face lit under, or null. */
  custodyOf(ordinal: number): string | null;
  /** The atom key the island holds a lit face under, or null. */
  atomKeyOf(ordinal: number): string | null;
  state(ordinal: number): FaceLifeState;
  /** Whether this vessel ever lit or adopted the face: a door gates a known face's work through its actor alone. */
  known(ordinal: number): boolean;
  /** Every ordinal whose actor reads lit, in order: the set the island composes with, and the set a visit reaches. */
  lit(): number[];
  /** Admit work on a face (a session verb or act); null where the face does not stand lit. */
  admitWork(ordinal: number): WorkTicket | null;
  /** Admit a visit to a face; `refuse` answers it if the face closes first. Null where the face does not stand lit. */
  admitVisit(ordinal: number, refuse: (reason: string) => void): VisitTicket | null;
  /** THE SUPERVISOR: the island stood again; every face it left out because its actor did not read lit now reads dark. */
  recomposed(): void;
  /** Stop: no new light; a pending waiter still resolves as its message lands. */
  stop(): void;
}

/** The never-repeating opening for one light: this vessel's boot nonce and a count across every face. */
const openingName = (nonce: string, n: number): string => `${nonce}:${n}`;

export function faceLives(effects: FaceLifeEffects, options: { readonly nonce: string }): FaceLives {
  const lives = new Map<number, { life: Life; queue: Message[]; draining: boolean }>();
  let opened = 0;
  let nextId = 1;
  let stopped = false;
  let recomposing: Promise<void> | null = null;
  /** Visits that already answered by another road (refused at a close, or their asker left): their delivery writes nothing. */
  const settledVisits = new Set<number>();

  const actorOf = (ordinal: number) => {
    let actor = lives.get(ordinal);
    if (!actor) { actor = { life: { kind: "dark" }, queue: [], draining: false }; lives.set(ordinal, actor); }
    return actor;
  };
  const fresh = (): string => openingName(options.nonce, ++opened);

  /** One mailbox per face: a message sent from inside a handler's effects waits for the turn in progress. */
  const send = (ordinal: number, message: Message): void => {
    const actor = actorOf(ordinal);
    actor.queue.push(message);
    if (actor.draining) return;
    actor.draining = true;
    try {
      while (actor.queue.length > 0) {
        const next = actor.queue.shift()!;
        // The handler mutates the state and hands back its effects; they run only after the state stands.
        const after = handle(ordinal, actor, next);
        for (const effect of after) {
          try { effect(); } catch (error) { effects.log(`[face-life] h${ordinal}: an effect faulted: ${describe(error)}`); }
        }
      }
    } finally { actor.draining = false; }
  };

  const startLight = (ordinal: number, opening: string): (() => void) => () => {
    const live = (): boolean => { const life = lives.get(ordinal)?.life; return life?.kind === "lighting" && life.opening === opening; };
    effects.light(ordinal, opening, live).then(
      (lit) => send(ordinal, { t: "light-settled", opening, lit }),
      (error: unknown) => send(ordinal, { t: "light-settled", opening, lit: null, error }),
    );
  };

  /** Take a closing face one step on where its waits allow; every step's effects return. */
  const advance = (ordinal: number, actor: { life: Life }): Array<() => void> => {
    const life = actor.life;
    if (life.kind !== "closing" || life.phase !== "settling" || life.lightPending || life.work.size > 0) return [];
    life.phase = "draining";
    const opening = life.opening;
    return [() => {
      effects.drainSaves(ordinal, opening).then(
        () => send(ordinal, { t: "saves-drained", opening }),
        (error: unknown) => {
          effects.log(`[face-life] h${ordinal}: its queued saves did not drain before it closed: ${describe(error)}`);
          send(ordinal, { t: "saves-drained", opening });
        },
      );
    }];
  };

  /** Reach dark from closing: a light asked for during the close lights again now, under a fresh opening. */
  const toDark = (ordinal: number, actor: { life: Life }): Array<() => void> => {
    const life = actor.life;
    const relight = life.kind === "closing" ? life.relight : null;
    if (relight !== null && !stopped) {
      const opening = fresh();
      actor.life = { kind: "lighting", opening, waiters: relight };
      return [startLight(ordinal, opening)];
    }
    actor.life = { kind: "dark" };
    return relight ? relight.map((w) => () => w("refused")) : [];
  };

  const handle = (ordinal: number, actor: { life: Life }, m: Message): Array<() => void> => {
    const life = actor.life;
    switch (m.t) {
      case "light": {
        if (life.kind === "lit") return [() => m.waiter("lit")];
        if (life.kind === "lighting") { life.waiters.push(m.waiter); return []; }
        if (life.kind === "closing") { (life.relight ??= []).push(m.waiter); return []; }
        if (stopped) return [() => m.waiter("refused")];
        const opening = fresh();
        actor.life = { kind: "lighting", opening, waiters: [m.waiter] };
        return [startLight(ordinal, opening)];
      }
      case "adopt": {
        if (life.kind !== "dark") return [];
        actor.life = { kind: "lit", opening: fresh(), atomKey: m.lit.atomKey, custody: m.lit.custody, visits: new Map(), work: new Set() };
        return [];
      }
      case "light-settled": {
        if (life.kind === "lighting" && life.opening === m.opening) {
          const waiters = life.waiters;
          if (m.lit === null) {
            actor.life = { kind: "dark" };
            effects.log(`[face-life] h${ordinal} did not light: ${describe(m.error)}`);
            return waiters.map((w) => () => w("refused"));
          }
          actor.life = { kind: "lit", opening: life.opening, atomKey: m.lit.atomKey, custody: m.lit.custody, visits: new Map(), work: new Set() };
          return waiters.map((w) => () => w("lit"));
        }
        if (life.kind === "closing" && life.opening === m.opening && life.lightPending) {
          life.lightPending = false;
          life.atomKey = m.lit?.atomKey ?? null;
          return advance(ordinal, actor);
        }
        return [];
      }
      case "close": {
        if (life.kind === "dark") return [() => m.waiter()];
        if (life.kind === "closing") {
          if (life.phase === "told" || life.phase === "recomposing") return [() => m.waiter()];
          life.closedWaiters.push(m.waiter);
          return [];
        }
        // A close naming a custody opening this face did not light under (one it knows) answers at once: nothing serves it.
        if (life.kind === "lit" && m.custody !== undefined && m.custody !== null && life.custody !== null && life.custody !== m.custody) return [() => m.waiter()];
        effects.log(`[face-life] h${ordinal} closes (${m.reason})`);
        const refused: Array<() => void> = [];
        if (life.kind === "lit") {
          // Every admitted visit not yet delivered refuses now; its reply, when it lands, writes nothing.
          for (const [id, visit] of life.visits) {
            settledVisits.add(id);
            refused.push(() => visit.refuse(`face-not-open: face h${ordinal} closed before this visit's answer left; nothing is delivered`));
          }
          life.visits.clear();
        }
        // A light still in flight answers refused: the close took the face first.
        if (life.kind === "lighting") for (const w of life.waiters) refused.push(() => w("refused"));
        actor.life = {
          kind: "closing", opening: life.opening, atomKey: life.kind === "lit" ? life.atomKey : null, custody: life.kind === "lit" ? life.custody : null,
          phase: "settling", lightPending: life.kind === "lighting", work: life.kind === "lit" ? new Set(life.work) : new Set(),
          closedWaiters: [m.waiter], relight: null,
        };
        return [...refused, ...advance(ordinal, actor)];
      }
      case "work-done": {
        if (life.kind === "lit" && life.opening === m.opening) { life.work.delete(m.id); return []; }
        if (life.kind === "closing" && life.opening === m.opening) { life.work.delete(m.id); return advance(ordinal, actor); }
        return [];
      }
      case "saves-drained": {
        if (life.kind !== "closing" || life.opening !== m.opening || life.phase !== "draining") return [];
        const { opening, atomKey, closedWaiters } = life;
        const out: Array<() => void> = [];
        if (atomKey !== null) {
          life.phase = "told";
          out.push(() => {
            effects.dropWorker(ordinal, atomKey).then(
              () => send(ordinal, { t: "worker-ack", opening }),
              (error: unknown) => send(ordinal, { t: "worker-refused", opening, error }),
            );
          });
        }
        out.push(() => effects.teardownHost(ordinal, opening));
        out.push(...closedWaiters.map((w) => () => w()));
        life.closedWaiters = [];
        // No island entry stands: the host side down is the whole close.
        if (atomKey === null) out.push(...toDark(ordinal, actor));
        return out;
      }
      case "worker-ack": {
        if (life.kind !== "closing" || life.opening !== m.opening || life.phase !== "told") return [];
        return toDark(ordinal, actor);
      }
      case "worker-refused": {
        if (life.kind !== "closing" || life.opening !== m.opening || life.phase !== "told") return [];
        life.phase = "recomposing";
        effects.log(`[face-life] the daemon island refused the drop of h${ordinal}: ${describe(m.error)}; it composes again without the face`);
        return [() => superviseRecompose(`face h${ordinal} refused its drop`)];
      }
      case "recomposed": {
        if (life.kind !== "closing" || (life.phase !== "told" && life.phase !== "recomposing")) return [];
        return toDark(ordinal, actor);
      }
    }
  };

  /** ONE recompose at a time: a refusal that lands while one runs joins it. Its standing takes every left-out face dark. */
  const superviseRecompose = (reason: string): void => {
    if (recomposing !== null) return;
    recomposing = effects.recompose(reason).then(
      () => { recomposing = null; release(); },
      (error: unknown) => { recomposing = null; effects.log(`[face-life] the daemon island did not compose again: ${describe(error)}; the next restart releases the closing faces`); },
    );
  };
  const release = (): void => { for (const ordinal of [...lives.keys()]) send(ordinal, { t: "recomposed" }); };

  const read = (ordinal: number): FaceLifeState => {
    const life = lives.get(ordinal)?.life ?? { kind: "dark" as const };
    switch (life.kind) {
      case "dark": return { kind: "dark" };
      case "lighting": return { kind: "lighting", opening: life.opening };
      case "lit": return { kind: "lit", opening: life.opening, atomKey: life.atomKey, custody: life.custody };
      case "closing": return { kind: "closing", opening: life.opening, phase: life.phase };
    }
  };

  return {
    light: (ordinal) => new Promise<LightAnswer>((resolve) => send(ordinal, { t: "light", waiter: resolve })),
    adopt: (ordinal, lit) => send(ordinal, { t: "adopt", lit }),
    close: (ordinal, reason, custody) => new Promise<void>((resolve) => send(ordinal, { t: "close", reason, custody, waiter: resolve })),
    opening: (ordinal) => { const life = lives.get(ordinal)?.life; return life?.kind === "lit" ? life.opening : null; },
    custodyOf: (ordinal) => { const life = lives.get(ordinal)?.life; return life?.kind === "lit" ? life.custody : null; },
    atomKeyOf: (ordinal) => { const life = lives.get(ordinal)?.life; return life?.kind === "lit" ? life.atomKey : null; },
    state: read,
    known: (ordinal) => lives.has(ordinal),
    lit: () => [...lives].filter(([, a]) => a.life.kind === "lit").map(([o]) => o).sort((a, b) => a - b),
    admitWork(ordinal) {
      const life = lives.get(ordinal)?.life;
      if (life?.kind !== "lit") return null;
      const id = nextId++, opening = life.opening;
      life.work.add(id);
      let done = false;
      return { opening, done: () => { if (done) return; done = true; send(ordinal, { t: "work-done", opening, id }); } };
    },
    admitVisit(ordinal, refuse) {
      const life = lives.get(ordinal)?.life;
      if (life?.kind !== "lit") return null;
      const id = nextId++, opening = life.opening;
      life.visits.set(id, { refuse });
      return {
        opening,
        // THE CHECK AND THE WRITE IN ONE TURN: no await stands between reading the opening and writing the reply.
        deliver(write, refuseNow) {
          // A visit that already answered (refused at a close, or its asker left) writes nothing more.
          if (settledVisits.delete(id)) return;
          const now = lives.get(ordinal)?.life;
          if (now?.kind === "lit" && now.opening === opening && now.visits.delete(id)) { write(); return; }
          refuseNow(`face-not-open: face h${ordinal} shut, or shut and lit again, before this visit's answer left; nothing is delivered`);
        },
        drop() {
          const now = lives.get(ordinal)?.life;
          if (now?.kind === "lit" && now.opening === opening) now.visits.delete(id);
          settledVisits.add(id);
        },
      };
    },
    recomposed: release,
    stop() { stopped = true; },
  };
}

function describe(error: unknown): string { return error instanceof Error ? error.message : String(error); }
