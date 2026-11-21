import { describe, expect, test } from "vitest";
import { faceLives, type FaceLifeEffects, type FaceLit } from "../src/face-lifecycle.js";

interface Deferred<T> { readonly promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void }
function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

/** A scripted island: each effect records itself, and the test answers each one by hand. */
function island() {
  const events: string[] = [];
  const lights = new Map<number, Deferred<FaceLit> & { live: () => boolean; opening: string }>();
  const drains = new Map<number, Deferred<void>>();
  const drops = new Map<number, Deferred<void>>();
  const recomposes: Array<Deferred<void> & { litAtStart: number[] }> = [];
  let lives!: ReturnType<typeof faceLives>;
  const effects: FaceLifeEffects = {
    light(ordinal, opening, live) { events.push(`light h${ordinal} ${opening}`); const d = { ...deferred<FaceLit>(), live, opening }; lights.set(ordinal, d); return d.promise; },
    drainSaves(ordinal) { events.push(`drain h${ordinal}`); const d = deferred(); drains.set(ordinal, d); return d.promise; },
    dropWorker(ordinal, atomKey) { events.push(`drop h${ordinal} ${atomKey}`); const d = deferred(); drops.set(ordinal, d); return d.promise; },
    teardownHost(ordinal) { events.push(`teardown h${ordinal}`); },
    // The island's open reads the actors' lit set at its start, and answers them with it once it stands.
    recompose(reason) { const d = { ...deferred(), litAtStart: lives.lit() }; events.push(`recompose (${reason})`); recomposes.push(d); return d.promise.then(() => lives.recomposed(new Set(d.litAtStart))); },
    log: () => {},
  };
  lives = faceLives(effects, { nonce: "boot" });
  return { lives, events, lights, drains, drops, recomposes };
}

/** Light h<N> through to lit, under atom key `k<N>`. */
async function lit(t: ReturnType<typeof island>, ordinal: number, custody: string | null = null): Promise<string> {
  const answer = t.lives.light(ordinal);
  t.lights.get(ordinal)!.resolve({ atomKey: `k${ordinal}`, custody });
  expect(await answer).toBe("lit");
  return t.lives.opening(ordinal)!;
}

describe("each face lives one life: the lifecycle actor", () => {
  test("a light takes a fresh opening, and a relight (close then light) never repeats one", async () => {
    const t = island();
    const first = await lit(t, 1);
    expect(t.lives.state(1)).toEqual({ kind: "lit", opening: first, atomKey: "k1", custody: null });
    const closed = t.lives.close(1, "lock");
    t.drains.get(1)!.resolve(); await closed;
    t.drops.get(1)!.resolve(); await settle();
    expect(t.lives.state(1).kind).toBe("dark");
    const second = await lit(t, 1);
    expect(second).not.toBe(first);
    expect(t.lives.lit()).toEqual([1]);
  });

  test("SOL R6 H (reply after close across an await): a visit admitted while lit, whose reply lands after the close, is refused at the close and writes nothing at delivery", async () => {
    const t = island();
    await lit(t, 1);
    const written: string[] = [];
    const ticket = t.lives.admitVisit(1, (reason) => written.push(`refused ${reason.split(":")[0]}`))!;
    expect(ticket).not.toBeNull();
    // The verb's reply is still on its way (an await stands between admission and delivery) when the close lands.
    const closing = t.lives.close(1, "lock");
    expect(written).toEqual(["refused face-not-open"]);
    await Promise.resolve();
    ticket.deliver(() => written.push("WROTE THE BODY"), (reason) => written.push(`late refusal ${reason}`));
    expect(written, "the body never leaves after the close, and the asker hears one answer").toEqual(["refused face-not-open"]);
    t.drains.get(1)!.resolve(); await closing;
  });

  test("a reply delivered while the face stands lit under its admitted opening writes in the same turn", async () => {
    const t = island();
    await lit(t, 1);
    const ticket = t.lives.admitVisit(1, () => { throw new Error("no close"); })!;
    let wrote = false;
    ticket.deliver(() => { wrote = true; }, () => {});
    expect(wrote).toBe(true);
  });

  test("a visit admitted under an old opening refuses at delivery once the face relit, never answering under the new opening", async () => {
    const t = island();
    await lit(t, 1);
    const old = t.lives.admitVisit(1, () => {})!;
    old.drop();
    const answers: string[] = [];
    const closing = t.lives.close(1, "relight");
    t.drains.get(1)!.resolve(); await closing; t.drops.get(1)!.resolve(); await settle();
    await lit(t, 1);
    const stale = { ...old };
    stale.deliver(() => answers.push("wrote"), () => answers.push("refused"));
    expect(answers, "a dropped visit writes nothing at all").toEqual([]);
  });

  test("no visit and no work admits on a face that does not stand lit", async () => {
    const t = island();
    expect(t.lives.admitVisit(1, () => {})).toBeNull();
    expect(t.lives.admitWork(1)).toBeNull();
    void t.lives.light(1);
    expect(t.lives.admitWork(1), "lighting admits nothing").toBeNull();
  });

  test("SOL R6 M (writes enter during the drain): work admitted before the close holds the drain until it settles; nothing admits once closing", async () => {
    const t = island();
    await lit(t, 1);
    const work = t.lives.admitWork(1)!;
    const closing = t.lives.close(1, "lock");
    expect(t.lives.admitWork(1), "a write arriving after the close is refused by the actor").toBeNull();
    expect(t.events.filter((e) => e.startsWith("drain")), "the drain waits out the write already dispatched").toEqual([]);
    work.done();
    expect(t.events.at(-1)).toBe("drain h1");
    t.drains.get(1)!.resolve();
    await closing;
  });

  test("TWO-PHASE CLOSE: closed answers only after the saves drained, the worker was told and the host side dropped, and before the worker's ack", async () => {
    const t = island();
    await lit(t, 1);
    let closed = false;
    void t.lives.close(1, "pulama closing").then(() => { closed = true; });
    await settle();
    expect(closed, "the key may not lock while saves still drain").toBe(false);
    t.drains.get(1)!.resolve();
    await settle();
    expect(closed).toBe(true);
    expect(t.events.slice(-3)).toEqual(["drain h1", "drop h1 k1", "teardown h1"]);
    expect(t.lives.state(1)).toMatchObject({ kind: "closing", phase: "told" });
    t.drops.get(1)!.resolve(); await settle();
    expect(t.lives.state(1).kind).toBe("dark");
  });

  test("a close naming a custody opening the face did not light under answers at once and leaves the face standing", async () => {
    const t = island();
    await lit(t, 1, "p:2");
    await t.lives.close(1, "pulama closing", "p:1");
    expect(t.lives.state(1).kind).toBe("lit");
  });

  test("a close that lands while the light still runs waits the light out, then drops the entry the island took", async () => {
    const t = island();
    const light = t.lives.light(1);
    const closing = t.lives.close(1, "lock");
    expect(await light, "the light asked before the close answers refused").toBe("refused");
    expect(t.lights.get(1)!.live(), "the slow light reads itself spent").toBe(false);
    expect(t.events.some((e) => e.startsWith("drain")), "no drain while the light may still add an island entry").toBe(false);
    t.lights.get(1)!.resolve({ atomKey: "k1", custody: null });
    await settle();
    t.drains.get(1)!.resolve();
    await closing;
    expect(t.events).toContain("drop h1 k1");
  });

  test("SOL R6 M (a refused drop deadlocks restart): the supervisor composes from the actors, never custody, leaving the closing face out, and the face goes dark", async () => {
    const t = island();
    await lit(t, 1); await lit(t, 2);
    const closing = t.lives.close(1, "lock");
    t.drains.get(1)!.resolve();
    await closing;                                   // the key may lock now: the restart below never waits on it
    t.drops.get(1)!.reject(new Error("island refused"));
    await settle();
    expect(t.recomposes).toHaveLength(1);
    expect(t.recomposes[0]!.litAtStart, "the recompose lights only faces whose actor reads lit").toEqual([2]);
    expect(t.lives.state(1)).toMatchObject({ kind: "closing", phase: "recomposing" });
    t.recomposes[0]!.resolve(); await settle();
    expect(t.lives.state(1).kind).toBe("dark");
    expect(t.lives.state(2).kind, "the other face stands through the recompose").toBe("lit");
  });

  test("SOL R6 M (the watcher misses a relight): a moved custody opening closes and lights in one mailbox, so the face always lights again under a new opening", async () => {
    const t = island();
    const first = await lit(t, 1, "p:1");
    // The watcher reads the custody opening moved (p:1 -> p:2): it sends close, then light, and never waits on either.
    void t.lives.close(1, "custody opening moved");
    const relit = t.lives.light(1);
    t.drains.get(1)!.resolve(); await settle();
    t.drops.get(1)!.resolve(); await settle();
    expect(t.lives.state(1).kind, "the ack schedules the relight the close held").toBe("lighting");
    t.lights.get(1)!.resolve({ atomKey: "k1", custody: "p:2" });
    expect(await relit).toBe("lit");
    expect(t.lives.opening(1)).not.toBe(first);
    expect(t.lives.custodyOf(1)).toBe("p:2");
  });

  test("SOL R6 M (the watcher stalls on a shared queue): a face whose drop never answers holds only its own close; another face lights meanwhile", async () => {
    const t = island();
    await lit(t, 1);
    const closing = t.lives.close(1, "lock");
    t.drains.get(1)!.resolve();
    await closing;                                   // the drop to the island never answers
    const light = t.lives.light(2);
    t.lights.get(2)!.resolve({ atomKey: "k2", custody: null });
    expect(await light).toBe("lit");
    expect(t.lives.state(1)).toMatchObject({ kind: "closing", phase: "told" });
  });

  test("the supervisor's restart releases a face whose worker never answered its drop", async () => {
    const t = island();
    await lit(t, 1);
    const closing = t.lives.close(1, "lock");
    t.drains.get(1)!.resolve(); await closing;
    t.lives.recomposed(new Set([1]));
    expect(t.lives.state(1), "an open that composed the face leaves it closing").toMatchObject({ kind: "closing" });
    t.lives.recomposed(new Set());
    expect(t.lives.state(1).kind).toBe("dark");
  });

  test("a face composed lit at the island's open is adopted lit under a fresh opening; adopt never overrides a live actor", async () => {
    const t = island();
    t.lives.adopt(3, { atomKey: "k3", custody: "p:7" });
    expect(t.lives.state(3)).toMatchObject({ kind: "lit", atomKey: "k3", custody: "p:7" });
    const opening = t.lives.opening(3);
    t.lives.adopt(3, { atomKey: "other", custody: null });
    expect(t.lives.opening(3)).toBe(opening);
  });

  test("a face with no island entry (the mount) closes whole at the host side, with no worker round trip", async () => {
    const t = island();
    const answer = t.lives.light(0);
    t.lights.get(0)!.resolve({ atomKey: null, custody: null });
    await answer;
    const closing = t.lives.close(0, "pulama closing");
    t.drains.get(0)!.resolve();
    await closing;
    expect(t.events.filter((e) => e.startsWith("drop"))).toEqual([]);
    expect(t.lives.state(0).kind).toBe("dark");
  });

  test("a failed drain still closes: the saves' fault is logged and the close goes on", async () => {
    const t = island();
    await lit(t, 1);
    const closing = t.lives.close(1, "lock");
    t.drains.get(1)!.reject(new Error("seal refused"));
    await closing;
    expect(t.events).toContain("drop h1 k1");
  });
});
