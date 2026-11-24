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
 *
 * ── A DRAIN THAT FAILS HOLDS ───────────────────────────────────────────────────────────────────
 * A drain that faults never reaches CLOSED: the face holds `closing` (drain-failed), admitting nothing, and every close waiter
 * hears the fault, so no custody holder locks the key over saves that did not seal. The next close drains again.
 *
 * ── A HELD FACE LIGHTS NOT ─────────────────────────────────────────────────────────────────────
 * A close may HOLD the face (`hold`): once dark it refuses every light until `release`, so a lock that closes the face and then
 * locks its key never meets a relight in between. Each close's return to dark tells the vessel (`onDark`), which replays its
 * lend; a refused light tells nothing, so no lend spins on a light that keeps refusing, and a stand-down lights nothing more.
 *
 * ── EVERY WRITE OF A VISIT RUNS IN ONE DELIVERY TURN ───────────────────────────────────────────
 * A visit answers exactly once. Its reply, its failure and the close's refusal all reach the asker through the actor's mailbox:
 * the delivery message reads `lit`, the admitted opening and whether the visit already answered, and writes or refuses in that
 * same turn. A second delivery, after a close refused it or after it answered, writes nothing.
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
  /** Drain the face's queued saves under its own session, while its sealing seat in the island still stands. A fault holds the close. */
  drainSaves(ordinal: number, opening: string): Promise<void>;
  /** Tell the island to drop the face's entry: resolve = the island acknowledged, reject = it refused the drop. */
  dropWorker(ordinal: number, atomKey: string): Promise<void>;
  /** Drop the host side (its documents' waiting saves from memory, its cache, session and keepers). Synchronous. */
  teardownHost(ordinal: number, opening: string): void;
  /**
   * Compose the island again from every face whose actor reads `lit` (the island supervisor). Its open answers the actors through
   * `recomposed`, naming the faces it composed with; this promise only says the restart ran.
   */
  recompose(reason: string): Promise<void>;
  /** The face reads dark again after a close or a release: the vessel replays its lend. A refused light tells nothing. */
  onDark?(ordinal: number): void;
  readonly log: (line: string) => void;
}

/** A face's lifecycle state, as one read of its actor. */
export type FaceLifeState =
  | { readonly kind: "dark"; readonly held: boolean }
  | { readonly kind: "lighting"; readonly opening: string }
  | { readonly kind: "lit"; readonly opening: string; readonly atomKey: string | null; readonly custody: string | null }
  | { readonly kind: "closing"; readonly opening: string; readonly phase: ClosingPhase };

/** Where a close stands: waiting out a light or work, draining saves (or held by a drain that faulted), the worker told, or the island composing again. */
export type ClosingPhase = "settling" | "draining" | "drain-failed" | "told" | "recomposing";

/** Admitted work on a face (a session verb or act): the door dispatches only on the actor's yes, and says `done` once the work itself settled. */
export interface WorkTicket {
  readonly opening: string;
  done(): void;
}

/** An admitted visit to a face: every answer it gives rides the actor's one delivery turn, exactly once. */
export interface VisitTicket {
  readonly opening: string;
  /**
   * Deliver one answer through the actor's mailbox: `write` runs in the delivery turn when the face still stands lit under the
   * admitted opening and the visit has not answered; `refuse` runs when the face moved; nothing runs once the visit answered
   * (refused at a close, delivered before, or its asker left).
   */
  deliver(write: () => void, refuse: (reason: string) => void): void;
  /** The asker left: the visit answers nothing more. */
  drop(): void;
}

/** What a close of every face answers: whether each face reached CLOSED whole (its saves drained, its host side down). */
export interface FacesClosed { readonly whole: boolean }

/** Why a light request answered as it did. */
export type LightAnswer = "lit" | "refused";

type Waiter<T> = (value: T) => void;
interface Closed { readonly resolve: () => void; readonly reject: (error: unknown) => void }
/** One admitted visit, shared by the actor and its ticket: `answered` flips once, at its one answer. */
interface Visit { readonly id: number; readonly refuse: (reason: string) => void; answered: boolean }

type Life =
  | { kind: "dark" }
  | { kind: "lighting"; opening: string; waiters: Array<Waiter<LightAnswer>> }
  | { kind: "lit"; opening: string; atomKey: string | null; custody: string | null; visits: Map<number, Visit>; work: Set<number> }
  | { kind: "closing"; opening: string; atomKey: string | null; custody: string | null; phase: ClosingPhase; lightPending: boolean; work: Set<number>;
      closedWaiters: Closed[]; relight: Array<Waiter<LightAnswer>> | null };

type Message =
  | { t: "light"; waiter: Waiter<LightAnswer> }
  | { t: "adopt"; lit: FaceLit }
  | { t: "light-settled"; opening: string; lit: FaceLit | null; error?: unknown }
  | { t: "compose-refused"; cause: string }
  | { t: "close"; reason: string; custody: string | null | undefined; hold: boolean; waiter: Closed }
  | { t: "release" }
  | { t: "hold"; answer: (held: boolean) => void }
  | { t: "custody"; custody: string | null }
  | { t: "work-done"; opening: string; id: number }
  | { t: "saves-drained"; opening: string }
  | { t: "saves-failed"; opening: string; error: unknown }
  | { t: "worker-ack"; opening: string }
  | { t: "worker-refused"; opening: string; error: unknown }
  | { t: "recomposed"; composed: ReadonlySet<number> }
  | { t: "deliver"; visit: Visit; opening: string; write: () => void; refuse: (reason: string) => void }
  | { t: "drop-visit"; visit: Visit; opening: string };

/** The vessel's set of face actors and its island supervisor. */
export interface FaceLives {
  /** Light a face: dark lights under a fresh opening; lighting or lit joins; closing lights again, fresh, once it reads dark; held refuses. */
  light(ordinal: number): Promise<LightAnswer>;
  /** The composition stood with this face lit (the island's manifest carried it): the actor reads lit under a fresh opening. */
  adopt(ordinal: number, lit: FaceLit): void;
  /**
   * THE ISLAND'S OPEN REFUSED A FACE ITS MANIFEST CARRIED: the island holds no entry for it, so the face this set adopted lit
   * reads dark with the refusal's `cause` (`refusedLights`). No seat ever stood in the island to seal under, so its host side
   * drops with no drain and no worker drop, each admitted visit refuses, and (a refused light) no lend replays. A close already
   * under way ends whole the same way. A face dark, lighting or never known hears nothing.
   */
  composeRefused(ordinal: number, cause: string): void;
  /**
   * Close a face, resolving at CLOSED (saves drained, worker told, host torn down) and rejecting where its drain faulted (the
   * face holds closing); a dark or never-known face resolves at once. Where `custody` names the custody opening a close answers
   * (the pūlama's `closing`), a face lit under ANOTHER known custody opening keeps standing and the close resolves at once.
   * `hold` keeps the face from lighting once dark until `release`.
   */
  close(ordinal: number, reason: string, options?: { readonly custody?: string | null; readonly hold?: boolean }): Promise<void>;
  /** Lift a close's hold: the face may light again, and the vessel replays its lend. */
  release(ordinal: number): void;
  /**
   * Close every face this set knows through its actor (a stand-down, a stop, a slide, a whole lock): resolves once each closed or
   * faulted. A stand-down logs a face that did not close whole and carries on; under `strict` (a whole lock, whose key must not
   * drop over saves that did not seal) a face that did not close whole rejects, naming each such face. It answers whether every
   * face closed whole, so a stand-down that carried on still knows (a vessel says its clean goodbye on a whole close alone).
   */
  closeAll(reason: string, options?: { readonly hold?: boolean; readonly strict?: boolean; readonly stop?: boolean }): Promise<FacesClosed>;
  /**
   * Hold a face past CLOSED (dark, or closing with its saves drained and its host side down), so it lights not until `release`;
   * answers false (holding nothing) where the face lit, lights, or still settles or drains, and true (holding nothing) for a face
   * this set never knew. A lock reads it in its line, right before the key locks: a face its close took dark that lit again since (a new
   * composition's) answers no, and the lock leaves the key open.
   */
  hold(ordinal: number): boolean;
  /** The custody opening a lit face stands under, read after its adoption: a face that adopted none takes it. */
  noteCustody(ordinal: number, custody: string | null): void;
  /** Every ordinal this set knows (ever lit or adopted), in order. */
  ordinals(): number[];
  /** Each face dark here because its last light refused (not held), with the refusal's cause: the vessel names it served-but-dark. */
  refusedLights(): Array<{ readonly ordinal: number; readonly cause: string }>;
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
  /**
   * THE SUPERVISOR: the island stood again, composed with `composed` (the faces whose actor read lit at its open). The restart
   * ended every verb in flight, so no admitted work holds a close past it; every closing face it left out now reads dark (the
   * fresh island holds no entry for it); a face it composed keeps closing.
   */
  recomposed(composed: ReadonlySet<number>): void;
  /** Stop: no new light; a pending waiter still resolves as its message lands. */
  stop(): void;
}

/** The never-repeating opening for one light: this vessel's boot nonce and a count across every face. */
const openingName = (nonce: string, n: number): string => `${nonce}:${n}`;

/** `refused` names why the face's last light refused, while it stays dark from that refusal: the vessel names it served-but-dark. */
type Actor = { life: Life; queue: Message[]; draining: boolean; held: boolean; refused: string | null };

export function faceLives(effects: FaceLifeEffects, options: { readonly nonce: string }): FaceLives {
  const lives = new Map<number, Actor>();
  let opened = 0;
  let nextId = 1;
  let stopped = false;
  let recomposing: Promise<void> | null = null;

  const actorOf = (ordinal: number): Actor => {
    let actor = lives.get(ordinal);
    if (!actor) { actor = { life: { kind: "dark" }, queue: [], draining: false, held: false, refused: null }; lives.set(ordinal, actor); }
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

  const drain = (ordinal: number, opening: string): (() => void) => () => {
    effects.drainSaves(ordinal, opening).then(
      () => send(ordinal, { t: "saves-drained", opening }),
      (error: unknown) => send(ordinal, { t: "saves-failed", opening, error }),
    );
  };

  /** Take a closing face one step on where its waits allow; every step's effects return. */
  const advance = (ordinal: number, actor: Actor): Array<() => void> => {
    const life = actor.life;
    if (life.kind !== "closing" || life.phase !== "settling" || life.lightPending || life.work.size > 0) return [];
    life.phase = "draining";
    return [drain(ordinal, life.opening)];
  };

  const darkNow = (ordinal: number): (() => void) => () => effects.onDark?.(ordinal);

  /** Reach dark from closing: a light asked for during the close lights again now, under a fresh opening, unless the close held it. */
  const toDark = (ordinal: number, actor: Actor): Array<() => void> => {
    const life = actor.life;
    const relight = life.kind === "closing" ? life.relight : null;
    if (relight !== null && !stopped && !actor.held) {
      const opening = fresh();
      actor.life = { kind: "lighting", opening, waiters: relight };
      return [startLight(ordinal, opening)];
    }
    actor.life = { kind: "dark" };
    return [...(relight ? relight.map((w) => () => w("refused")) : []), darkNow(ordinal)];
  };

  const refusal = (ordinal: number): string => `face-not-open: face h${ordinal} closed before this visit's answer left; nothing is delivered`;

  const handle = (ordinal: number, actor: Actor, m: Message): Array<() => void> => {
    const life = actor.life;
    switch (m.t) {
      case "light": {
        if (life.kind === "lit") return [() => m.waiter("lit")];
        if (life.kind === "lighting") { life.waiters.push(m.waiter); return []; }
        if (actor.held || stopped) return [() => m.waiter("refused")];
        if (life.kind === "closing") { (life.relight ??= []).push(m.waiter); return []; }
        actor.refused = null;
        const opening = fresh();
        actor.life = { kind: "lighting", opening, waiters: [m.waiter] };
        return [startLight(ordinal, opening)];
      }
      case "adopt": {
        if (life.kind !== "dark" || actor.held) return [];
        actor.refused = null;
        actor.life = { kind: "lit", opening: fresh(), atomKey: m.lit.atomKey, custody: m.lit.custody, visits: new Map(), work: new Set() };
        return [];
      }
      case "light-settled": {
        if (life.kind === "lighting" && life.opening === m.opening) {
          const waiters = life.waiters;
          if (m.lit === null) {
            // A REFUSED LIGHT REPLAYS NO LEND: the lend would light it again at once, and a light that keeps refusing (an island
            // standing down) would spin the vessel's turn forever. The next custody event or close replays the lend.
            actor.life = { kind: "dark" };
            actor.refused = describe(m.error);
            effects.log(`[face-life] h${ordinal} did not light: ${actor.refused}`);
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
      case "compose-refused": {
        if (life.kind === "lit") {
          const out: Array<() => void> = [];
          for (const visit of life.visits.values()) {
            if (visit.answered) continue;
            visit.answered = true;
            out.push(() => visit.refuse(refusal(ordinal)));
          }
          const opening = life.opening;
          actor.life = { kind: "dark" };
          actor.refused = m.cause;
          effects.log(`[face-life] h${ordinal} did not light: the island composed without it: ${m.cause}`);
          // A REFUSED LIGHT REPLAYS NO LEND (as `light-settled` holds): the next custody event, close or recard lights it.
          return [...out, () => effects.teardownHost(ordinal, opening)];
        }
        // A CLOSE UNDER WAY ENDS WHOLE: its drain had no seat to seal under and the island holds no entry to drop.
        if (life.kind === "closing" && (life.phase === "settling" || life.phase === "draining" || life.phase === "drain-failed")) {
          const { opening, closedWaiters } = life;
          life.closedWaiters = [];
          life.atomKey = null;
          actor.refused = m.cause;
          effects.log(`[face-life] h${ordinal} closes with no island entry: the island composed without it: ${m.cause}`);
          return [() => effects.teardownHost(ordinal, opening), ...closedWaiters.map((w) => () => w.resolve()), ...toDark(ordinal, actor)];
        }
        return [];
      }
      case "close": {
        // A close naming a custody opening this face did not light under (one it knows) answers at once and holds nothing: nothing serves it.
        if (life.kind === "lit" && m.custody !== undefined && m.custody !== null && life.custody !== null && life.custody !== m.custody) return [() => m.waiter.resolve()];
        if (m.hold) actor.held = true;
        if (life.kind === "dark") return [() => m.waiter.resolve()];
        if (life.kind === "closing") {
          if (life.phase === "told" || life.phase === "recomposing") return [() => m.waiter.resolve()];
          life.closedWaiters.push(m.waiter);
          // A drain that faulted drains again at the next close.
          if (life.phase === "drain-failed") { life.phase = "draining"; return [drain(ordinal, life.opening)]; }
          return [];
        }
        effects.log(`[face-life] h${ordinal} closes (${m.reason})`);
        const refused: Array<() => void> = [];
        if (life.kind === "lit") {
          // Every admitted visit not yet answered refuses now, its one answer; its reply, when it lands, writes nothing.
          for (const visit of life.visits.values()) {
            if (visit.answered) continue;
            visit.answered = true;
            refused.push(() => visit.refuse(refusal(ordinal)));
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
      case "release": {
        if (!actor.held) return [];
        actor.held = false;
        return life.kind === "dark" ? [darkNow(ordinal)] : [];
      }
      case "hold": {
        // A face past CLOSED takes the hold: dark, or closing with its saves drained and its host side down (the worker told, or
        // the island composing again). One that lit, lights, or still settles or drains answers no, and nothing changes.
        const pastClosed = life.kind === "dark" || (life.kind === "closing" && (life.phase === "told" || life.phase === "recomposing"));
        if (!pastClosed) return [() => m.answer(false)];
        actor.held = true;
        return [() => m.answer(true)];
      }
      case "custody": {
        // The custody opening a face adopted before its read landed: the first read names it, and a later light names its own.
        if (life.kind === "lit" && life.custody === null) life.custody = m.custody;
        return [];
      }
      case "work-done": {
        if (life.kind === "lit" && life.opening === m.opening) { life.work.delete(m.id); return []; }
        if (life.kind === "closing" && life.opening === m.opening) { life.work.delete(m.id); return advance(ordinal, actor); }
        return [];
      }
      case "saves-failed": {
        if (life.kind !== "closing" || life.opening !== m.opening || life.phase !== "draining") return [];
        // THE CLOSE HOLDS: no CLOSED over saves that did not seal; each waiter hears the fault, and the next close drains again.
        life.phase = "drain-failed";
        const waiters = life.closedWaiters;
        life.closedWaiters = [];
        effects.log(`[face-life] h${ordinal}: its queued saves did not drain, so it holds closing and reaches no CLOSED: ${describe(m.error)}`);
        return waiters.map((w) => () => w.reject(m.error));
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
        out.push(...closedWaiters.map((w) => () => w.resolve()));
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
        // The restart ended every verb in flight: no admitted work holds a close past it.
        if (life.kind === "lit") life.work.clear();
        if (life.kind === "closing" && life.phase === "settling") { life.work.clear(); return advance(ordinal, actor); }
        if (life.kind !== "closing" || (life.phase !== "told" && life.phase !== "recomposing") || m.composed.has(ordinal)) return [];
        return toDark(ordinal, actor);
      }
      case "deliver": {
        // THE ONE DELIVERY TURN: read lit, the admitted opening and whether the visit answered, then write or refuse here.
        if (m.visit.answered) return [];
        m.visit.answered = true;
        if (life.kind === "lit" && life.opening === m.opening && life.visits.delete(m.visit.id)) return [m.write];
        return [() => m.refuse(`face-not-open: face h${ordinal} shut, or shut and lit again, before this visit's answer left; nothing is delivered`)];
      }
      case "drop-visit": {
        m.visit.answered = true;
        if (life.kind === "lit" && life.opening === m.opening) life.visits.delete(m.visit.id);
        return [];
      }
    }
  };

  /**
   * ONE recompose at a time. A refusal that lands while one runs asks for one more after it (that open may have composed the face
   * while it still read lit); the open's own `recomposed` takes every left-out face dark.
   */
  let again: string | null = null;
  const superviseRecompose = (reason: string): void => {
    if (recomposing !== null) { again = reason; return; }
    recomposing = effects.recompose(reason).then(
      () => {},
      (error: unknown) => { effects.log(`[face-life] the daemon island did not compose again: ${describe(error)}; the next restart releases the closing faces`); },
    ).finally(() => {
      recomposing = null;
      const next = again;
      again = null;
      if (next !== null && [...lives.values()].some((a) => a.life.kind === "closing" && a.life.phase === "recomposing")) superviseRecompose(next);
    });
  };
  const release = (composed: ReadonlySet<number>): void => { for (const ordinal of [...lives.keys()]) send(ordinal, { t: "recomposed", composed }); };

  const read = (ordinal: number): FaceLifeState => {
    const actor = lives.get(ordinal);
    const life = actor?.life ?? { kind: "dark" as const };
    switch (life.kind) {
      case "dark": return { kind: "dark", held: actor?.held === true };
      case "lighting": return { kind: "lighting", opening: life.opening };
      case "lit": return { kind: "lit", opening: life.opening, atomKey: life.atomKey, custody: life.custody };
      case "closing": return { kind: "closing", opening: life.opening, phase: life.phase };
    }
  };

  const close = (ordinal: number, reason: string, opts?: { readonly custody?: string | null; readonly hold?: boolean }): Promise<void> => {
    // A face this set never knew has nothing to close, and stays unknown (its door stays ungated).
    if (!lives.has(ordinal)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => send(ordinal, { t: "close", reason, custody: opts?.custody, hold: opts?.hold === true, waiter: { resolve, reject } }));
  };

  return {
    light: (ordinal) => new Promise<LightAnswer>((resolve) => send(ordinal, { t: "light", waiter: resolve })),
    adopt: (ordinal, lit) => send(ordinal, { t: "adopt", lit }),
    composeRefused: (ordinal, cause) => { if (lives.has(ordinal)) send(ordinal, { t: "compose-refused", cause }); },
    close,
    release: (ordinal) => { if (lives.has(ordinal)) send(ordinal, { t: "release" }); },
    async closeAll(reason, opts) {
      // A STAND-DOWN LIGHTS NOTHING MORE: every light asked from here on (a lend a close's dark replays) refuses.
      if (opts?.stop === true) stopped = true;
      const ordinals = [...lives.keys()];
      const settled = await Promise.allSettled(ordinals.map((ordinal) => close(ordinal, reason, opts)));
      const faults = settled.flatMap((r, i) => r.status === "rejected" ? [{ ordinal: ordinals[i]!, why: describe(r.reason) }] : []);
      for (const fault of faults) effects.log(`[face-life] face h${fault.ordinal} did not close whole (${reason}): ${fault.why}`);
      if (opts?.strict === true && faults.length > 0) {
        throw new Error(`${faults.map((f) => `face h${f.ordinal}`).join(", ")} did not close whole, so the key stays open: ${faults.map((f) => f.why).join("; ")}`);
      }
      return { whole: faults.length === 0 };
    },
    hold(ordinal) {
      // A face this set never knew never lit here: nothing stands to hold, and it stays unknown (its door stays ungated).
      if (!lives.has(ordinal)) return true;
      let held = false;
      // The hold answers in the caller's own turn: no handler runs here, so the mailbox drains at once.
      send(ordinal, { t: "hold", answer: (yes) => { held = yes; } });
      return held;
    },
    noteCustody: (ordinal, custody) => { if (lives.has(ordinal)) send(ordinal, { t: "custody", custody }); },
    ordinals: () => [...lives.keys()].sort((a, b) => a - b),
    refusedLights: () => [...lives].filter(([, a]) => a.life.kind === "dark" && !a.held && a.refused !== null)
      .map(([ordinal, a]) => ({ ordinal, cause: a.refused! })).sort((x, y) => x.ordinal - y.ordinal),
    opening: (ordinal) => { const life = lives.get(ordinal)?.life; return life?.kind === "lit" ? life.opening : null; },
    custodyOf: (ordinal) => { const life = lives.get(ordinal)?.life; return life?.kind === "lit" ? life.custody : null; },
    atomKeyOf: (ordinal) => { const life = lives.get(ordinal)?.life; return life?.kind === "lit" ? life.atomKey : null; },
    state: read,
    known: (ordinal) => lives.has(ordinal),
    lit: () => [...lives].filter(([, a]) => a.life.kind === "lit").map(([o]) => o).sort((a, b) => a - b),
    // An admission reads the state the last handler left (each handler mutates whole before its effects run), so it never meets
    // a half-made transition, and it answers in the caller's own turn.
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
      const visit: Visit = { id: nextId++, refuse, answered: false };
      const opening = life.opening;
      life.visits.set(visit.id, visit);
      return {
        opening,
        deliver(write, refuseNow) { if (!visit.answered) send(ordinal, { t: "deliver", visit, opening, write, refuse: refuseNow }); },
        drop() { if (!visit.answered) send(ordinal, { t: "drop-visit", visit, opening }); },
      };
    },
    recomposed: release,
    stop() { stopped = true; },
  };
}

/** One plan of a face's drain: the session that seals its saves (null where none stands) and the documents it names. */
export interface DrainPlan<S> { readonly session: S | null; readonly docs: readonly string[] }

/**
 * A CLOSING FACE'S DRAIN, plan by plan: each session drains its own documents; a plan with no session drains nothing and counts
 * what still waits. Any save left waiting throws, so the close holds (no CLOSED, no key lock, no teardown forgetting it).
 */
export async function drainPlans<S>(ordinal: number, plans: ReadonlyArray<DrainPlan<S>>, ports: {
  readonly drain: (session: S, docs: readonly string[]) => Promise<number>;
  readonly waiting: (documentId: string) => number;
}): Promise<void> {
  for (const { session, docs } of plans) {
    const left = session !== null ? await ports.drain(session, docs) : docs.reduce((n, id) => n + ports.waiting(id), 0);
    if (left > 0) throw new Error(`face h${ordinal}: ${left} save(s) still wait unsealed${session === null ? " and no session stands to seal them" : ""}, so its close holds`);
  }
}

function describe(error: unknown): string { return error instanceof Error ? error.message : String(error); }
