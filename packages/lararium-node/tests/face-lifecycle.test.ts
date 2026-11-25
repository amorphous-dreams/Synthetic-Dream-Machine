import { describe, expect, test } from "vitest";
import { actCid } from "@lararium/mesh/signed-act";
import { buildIntent } from "@lararium/mesh/intent-issue";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh/ed25519-door";
import { faceIntentVerbs } from "@lararium/mesh/intent-verbs";
import { intentEntryRecordsOfGroup, intentId, writeIntentEntry } from "@lararium/mesh/intent-entry";
import { mintPersonaInception } from "@lararium/mesh/persona-kel";
import { signPersonaAct } from "@lararium/mesh/persona-act-board";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { makeFaceIntentDoor } from "@lararium/keyhive";
import { drainPlans, faceLives, type FaceLifeEffects, type FaceLit } from "../src/face-lifecycle.js";
import { taggedAdmission } from "../../lararium-mesh/tests/vessel-tag-fixture.js";

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
  const logs: string[] = [];
  const lights = new Map<number, Deferred<FaceLit> & { live: () => boolean; opening: string }>();
  const drains = new Map<number, Deferred<void>>();
  const drops = new Map<number, Deferred<void>>();
  const recomposes: Array<Deferred<void> & { litAtStart: number[] }> = [];
  let lives!: ReturnType<typeof faceLives>;
  const effects: FaceLifeEffects = {
    light(ordinal, opening, live) { events.push(`light h${ordinal} ${opening}`); const d = { ...deferred<FaceLit>(), live, opening }; lights.set(ordinal, d); return d.promise; },
    drainSaves(ordinal) { events.push(`drain h${ordinal}`); const d = deferred(); drains.set(ordinal, d); return d.promise; },
    dropWorker(ordinal, atomKey) { events.push(`drop h${ordinal} ${atomKey}`); const d = deferred(); drops.set(ordinal, d); return d.promise; },
    teardownHost(ordinal, _opening, why) { events.push(`teardown h${ordinal}${why ? ` ${why}` : ""}`); },
    onDark(ordinal) { events.push(`dark h${ordinal}`); },
    // The island's open reads the actors' lit set at its start, and answers them with it once it stands.
    recompose(reason) { const d = { ...deferred(), litAtStart: lives.lit() }; events.push(`recompose (${reason})`); recomposes.push(d); return d.promise.then(() => lives.recomposed(new Set(d.litAtStart))); },
    log: (line) => { logs.push(line); },
  };
  lives = faceLives(effects, { nonce: "boot" });
  return { lives, events, lights, drains, drops, recomposes, logs };
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
    await t.lives.close(1, "pulama closing", { custody: "p:1" });
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

  test("SOL R7 (a drain failure advances to ACK): a drain that faults holds the face closing, rejects every close waiter, tells no worker and tears nothing down; the next close drains again", async () => {
    const t = island();
    await lit(t, 1);
    const closing = t.lives.close(1, "pulama closing");
    t.drains.get(1)!.reject(new Error("seal refused"));
    await expect(closing).rejects.toThrow("seal refused");
    expect(t.lives.state(1)).toMatchObject({ kind: "closing", phase: "drain-failed" });
    expect(t.events.filter((e) => e.startsWith("drop") || e.startsWith("teardown")), "no ACK path ran").toEqual([]);
    expect(t.lives.admitWork(1)).toBeNull();
    const again = t.lives.close(1, "pulama closing");
    t.drains.get(1)!.resolve();
    await again;
    expect(t.events).toContain("drop h1 k1");
  });

  test("SOL R7 (delivery bypasses the mailbox, a second response after a close): a visit answers exactly once through the delivery turn, whatever road its answers take", async () => {
    const t = island();
    await lit(t, 1);
    const said: string[] = [];
    const visit = t.lives.admitVisit(1, (r) => said.push(`close ${r.split(":")[0]}`))!;
    visit.deliver(() => said.push("body"), (r) => said.push(`refused ${r.split(":")[0]}`));
    visit.deliver(() => said.push("body again"), (r) => said.push(`refused again ${r.split(":")[0]}`));
    // A failure answer after the body (an arbitration fault, a flush fault) writes nothing either.
    visit.deliver(() => said.push("failure"), () => said.push("failure refused"));
    expect(said).toEqual(["body"]);
    const second = t.lives.admitVisit(1, (r) => said.push(`close ${r.split(":")[0]}`))!;
    const closing = t.lives.close(1, "lock");
    second.deliver(() => said.push("late failure"), () => said.push("late refusal"));
    expect(said, "the close's refusal stands as its one answer").toEqual(["body", "close face-not-open"]);
    t.drains.get(1)!.resolve(); await closing;
  });

  test("SOL R7 (a relight lost behind a pending drop): every return to dark tells the vessel, which replays its lend", async () => {
    const t = island();
    await lit(t, 1);
    const closing = t.lives.close(1, "lock");
    t.drains.get(1)!.resolve(); await closing;
    expect(t.events).not.toContain("dark h1");
    t.drops.get(1)!.resolve(); await settle();
    expect(t.events.at(-1)).toBe("dark h1");
  });

  test("a held close refuses every light until release: a lock's close-then-lock meets no relight between", async () => {
    const t = island();
    await lit(t, 1);
    const closing = t.lives.close(1, "lock", { hold: true });
    const relight = t.lives.light(1);
    t.drains.get(1)!.resolve(); await closing;
    t.drops.get(1)!.resolve(); await settle();
    expect(await relight).toBe("refused");
    expect(await t.lives.light(1)).toBe("refused");
    expect(t.lives.state(1)).toEqual({ kind: "dark", held: true });
    t.lives.release(1);
    expect(t.events.at(-1)).toBe("dark h1");
    const answer = t.lives.light(1);
    t.lights.get(1)!.resolve({ atomKey: "k1", custody: null });
    expect(await answer).toBe("lit");
  });

  test("SOL R7 (STOP and slides skip the actor): closeAll closes every face through its actor, refusing its visits and waiting its work, before it resolves", async () => {
    const t = island();
    await lit(t, 1); await lit(t, 2);
    const refused: number[] = [];
    t.lives.admitVisit(1, () => refused.push(1));
    const work = t.lives.admitWork(2)!;
    let done = false;
    const all = t.lives.closeAll("the composition stands down").then(() => { done = true; });
    expect(refused).toEqual([1]);
    t.drains.get(1)!.resolve(); await settle();
    expect(done, "the work on h2 still holds its close").toBe(false);
    work.done(); t.drains.get(2)!.resolve();
    await all;
    expect(t.lives.lit()).toEqual([]);
  });

  test("SOL R7 (a caller timeout releases the ticket): an island restart, never a caller's wait, frees the work a close waits on", async () => {
    const t = island();
    await lit(t, 1);
    t.lives.admitWork(1);
    const closing = t.lives.close(1, "lock");
    await settle();
    expect(t.drains.has(1)).toBe(false);
    t.lives.recomposed(new Set([1]));
    expect(t.drains.has(1), "the restart ended the verb, so the drain runs").toBe(true);
    t.drains.get(1)!.resolve(); await closing;
  });

  test("a close of a face this set never knew resolves and leaves it unknown", async () => {
    const t = island();
    await t.lives.close(9, "lock", { hold: true });
    expect(t.lives.known(9)).toBe(false);
  });
  test("a WHOLE LOCK's close reads strict: a face whose drain faulted rejects closeAll by name, so the key stays open; a stand-down logs it and carries on", async () => {
    const t = island();
    await lit(t, 1); await lit(t, 2);
    const strict = t.lives.closeAll("a whole lock closes every face", { hold: true, strict: true });
    t.drains.get(1)!.resolve();
    t.drains.get(2)!.reject(new Error("seal refused"));
    await expect(strict).rejects.toThrow(/face h2 did not close whole, so the key stays open: seal refused/);
    const t2 = island();
    await lit(t2, 2);
    const loose = t2.lives.closeAll("the composition stands down");
    t2.drains.get(2)!.reject(new Error("seal refused"));
    await expect(loose, "a stand-down carries on, and says the close was not whole").resolves.toEqual({ whole: false });
  });

  test("a close naming another custody opening holds nothing: the face keeps standing and a later dark lights again", async () => {
    const t = island();
    await lit(t, 1, "p:2");
    await t.lives.close(1, "the pūlama closes it", { custody: "p:1", hold: true });
    expect(t.lives.state(1).kind).toBe("lit");
    const closing = t.lives.close(1, "lock");
    t.drains.get(1)!.resolve(); await closing;
    t.drops.get(1)!.resolve(); await settle();
    expect(t.lives.state(1), "the stale close set no hold").toEqual({ kind: "dark", held: false });
  });

  test("hold takes a face past CLOSED and refuses a lit or draining one: a lock reads it right before its key locks", async () => {
    const t = island();
    await lit(t, 1);
    expect(t.lives.hold(1), "a lit face holds not").toBe(false);
    expect(t.lives.state(1).kind).toBe("lit");
    const closing = t.lives.close(1, "lock");
    expect(t.lives.hold(1), "a face still draining holds not: its saves have not sealed").toBe(false);
    t.drains.get(1)!.resolve(); await closing;
    // Past CLOSED, before the worker's ack: the hold takes, and the dark that follows lights not.
    expect(t.lives.hold(1)).toBe(true);
    t.drops.get(1)!.resolve(); await settle();
    expect(t.lives.state(1)).toEqual({ kind: "dark", held: true });
    expect(t.lives.hold(1)).toBe(true);
    expect(await t.lives.light(1)).toBe("refused");
    expect(t.lives.hold(9), "a face never known holds nothing and stays unknown").toBe(true);
    expect(t.lives.known(9)).toBe(false);
  });

  test("a face adopted before its custody read names the opening once the read lands, and never overwrites one it holds", async () => {
    const t = island();
    t.lives.adopt(0, { atomKey: null, custody: null });
    t.lives.noteCustody(0, "p:4");
    expect(t.lives.custodyOf(0)).toBe("p:4");
    t.lives.noteCustody(0, "p:5");
    expect(t.lives.custodyOf(0)).toBe("p:4");
  });
  test("F1: a face whose saves wait with no session to seal them holds its close; with none waiting, it closes clean", async () => {
    const waiting = new Map([["doc-a", 2], ["doc-b", 0]]);
    const drain = async (): Promise<number> => 0;
    await expect(drainPlans(1, [{ session: null, docs: ["doc-a", "doc-b"] }], { drain, waiting: (id) => waiting.get(id) ?? 0 }))
      .rejects.toThrow(/face h1: 2 save\(s\) still wait unsealed and no session stands to seal them/);
    await expect(drainPlans(1, [{ session: null, docs: ["doc-b"] }], { drain, waiting: (id) => waiting.get(id) ?? 0 })).resolves.toBeUndefined();
    await expect(drainPlans(1, [{ session: "s", docs: ["doc-a"] }], { drain: async () => 1, waiting: () => 0 })).rejects.toThrow(/1 save\(s\) still wait unsealed, so/);
  });
  test("R8 (a stand-down's relight spun the vessel): a refused light replays no lend, and once a stand-down began no light runs", async () => {
    // A lend that lights every face it hears go dark, over an island that refuses every light (it stands down).
    const events: string[] = [];
    let lights = 0;
    const lit: number[] = [];
    let lives!: ReturnType<typeof faceLives>;
    lives = faceLives({
      light: async (ordinal) => { lights += 1; lit.push(ordinal); throw new Error("daemon-down"); },
      drainSaves: async () => {},
      dropWorker: async () => {},
      teardownHost: () => {},
      recompose: async () => {},
      // The lend this dark replays lights h1 (held by nothing) and h2, a face this set never knew: only `stop` refuses h2.
      onDark: (ordinal) => { events.push(`dark h${ordinal}`); void lives.light(1); void lives.light(2); },
      log: () => {},
    }, { nonce: "boot" });
    expect(await lives.light(1)).toBe("refused");
    await settle(); await settle();
    expect(lights, "a refused light lights nothing again on its own").toBe(1);
    expect(events).toEqual([]);
    // THE STAND-DOWN: the mount closes, its dark replays the lend, and the lend's light refuses without running.
    lives.adopt(0, { atomKey: null, custody: null });
    await lives.closeAll("the composition stands down", { hold: true, stop: true });
    await settle(); await settle();
    expect(events).toEqual(["dark h0"]);
    expect(lights, "no light runs once the stand-down began").toBe(1);
    expect(lit, "the face this set never knew never reached the island's light").toEqual([1]);
    expect(lives.known(2) ? lives.state(2) : { kind: "dark", held: false }).toEqual({ kind: "dark", held: false });
  });
  test("R9 SERVED BUT DARK: a face whose light refused names its cause until it lights again; a held or lit face names none", async () => {
    const t = island();
    const answer = t.lives.light(1);
    t.lights.get(1)!.reject(new Error("the island lost the recompose race"));
    expect(await answer).toBe("refused");
    expect(t.lives.refusedLights()).toEqual([{ ordinal: 1, cause: "the island lost the recompose race" }]);
    // The clearing line lights it again: the refusal clears with the new light.
    const again = t.lives.light(1);
    expect(t.lives.refusedLights(), "a light under way names no refusal").toEqual([]);
    t.lights.get(1)!.resolve({ atomKey: "k1", custody: null });
    expect(await again).toBe("lit");
    expect(t.lives.refusedLights()).toEqual([]);
  });
  // The island's first open adopts each lent face lit before the island lights it; a face the island then refused held no
  // entry there, and read lit here all the same, so the recard guard read it healthy and every act on it rode to no provider.
  const STALE = "FaceHoldsNoPrekeySecret: [daemon-keyhive] face k2 holds no prekey secret";
  // A REFUSAL IS NO CLOSE. The island refused the face its seat, so nothing could ever drain under it: a drain here would hold
  // the face closing for good and shut the recard road. It goes dark, and its host side comes down KEEPING its waiting saves.
  test("R10 COMPOSED WITHOUT IT: a face adopted lit that the island's open refused goes dark at once with the refusal's cause; no drain is asked, no worker drop, no lend replays, its host side comes down marked refused (its saves kept), and its next light runs", async () => {
    const t = island();
    t.lives.adopt(2, { atomKey: "k2", custody: null });
    const refusedVisits: string[] = [];
    expect(t.lives.admitVisit(2, (reason) => refusedVisits.push(reason.split(":")[0]!))).not.toBeNull();
    t.lives.composeRefused(2, STALE, { opening: t.lives.opening(2)! });
    expect(t.lives.state(2)).toEqual({ kind: "dark", held: false });
    expect(t.lives.refusedLights()).toEqual([{ ordinal: 2, cause: STALE }]);
    expect(t.lives.refusedCloses()).toEqual([]);
    // A LOCK'S HOLD HIDES THE REFUSED LIGHT (no recard arms over a held face), and the cause still reads for the saves it holds.
    expect(t.lives.hold(2)).toBe(true);
    expect(t.lives.refusedLights()).toEqual([]);
    expect(t.lives.refusedCause(2)).toBe(STALE);
    t.lives.release(2);
    expect(t.lives.admitWork(2), "no work admits on a face the island never held").toBeNull();
    expect(refusedVisits).toEqual(["face-not-open"]);
    expect(t.events, "the teardown names its cause, so the vessel keeps the face's waiting saves").toEqual(["teardown h2 refused", "dark h2"]);
    // THE RECARD'S LIGHT RUNS FROM HERE: the face lights as any dark face does, and the refusal clears.
    const again = t.lives.light(2);
    t.lights.get(2)!.resolve({ atomKey: "k2", custody: null });
    expect(await again).toBe("lit");
    expect(t.lives.refusedLights()).toEqual([]);
  });
  test("R11 A RESTART'S REFUSAL DROPS NO SAVE AND ANSWERS NO CLOSE: a face that lit by its own light, refused at a later open, goes dark the same way (teardown marked refused, no drain, no drop); a close asked after meets a dark face", async () => {
    const t = island();
    const opening = await lit(t, 1);
    t.lives.composeRefused(1, STALE, { opening });
    expect(t.events.filter((e) => !e.startsWith("light"))).toEqual(["teardown h1 refused"]);
    expect(t.lives.refusedLights()).toEqual([{ ordinal: 1, cause: STALE }]);
    await t.lives.close(1, "the pūlama closes it");
    expect(t.events.filter((e) => e.startsWith("drain") || e.startsWith("drop"))).toEqual([]);
  });
  test("R12 THE REFUSAL NAMES ONE LIFE: a refusal for an opening the face no longer lives under (it closed and lit again), a face still lighting, or a face this set never knew changes nothing", async () => {
    const t = island();
    t.lives.adopt(2, { atomKey: "k2", custody: null });
    const first = t.lives.opening(2)!;
    const closed = t.lives.close(2, "lock");
    t.drains.get(2)!.resolve(); await closed; t.drops.get(2)!.resolve(); await settle();
    const second = await lit(t, 2);
    expect(second).not.toBe(first);
    t.lives.composeRefused(2, STALE, { opening: first });
    expect(t.lives.state(2), "the new life keeps standing, with its island entry").toEqual({ kind: "lit", opening: second, atomKey: "k2", custody: null });
    const lighting = t.lives.light(1);
    t.lives.composeRefused(1, STALE, { opening: t.lights.get(1)!.opening });
    expect(t.lives.state(1).kind).toBe("lighting");
    t.lights.get(1)!.resolve({ atomKey: "k1", custody: null });
    expect(await lighting).toBe("lit");
    t.lives.composeRefused(7, STALE, { opening: "boot:99" });
    expect(t.lives.known(7)).toBe(false);
  });
  test("R13 A CLOSE UNDER WAY KEEPS ITS OWN LAW: the refusal resolves no waiter and tears nothing down; the drain decides, the island is asked no drop, and its dark replays no lend", async () => {
    const t = island();
    t.lives.adopt(3, { atomKey: "k3", custody: null });
    let answered = false;
    const closed = t.lives.close(3, "the pūlama closes it").then(() => { answered = true; });
    expect(t.events).toEqual(["drain h3"]);
    t.lives.composeRefused(3, STALE, { opening: t.lives.state(3).kind === "closing" ? (t.lives.state(3) as { opening: string }).opening : "" });
    await settle();
    expect(answered, "the close waits on its drain").toBe(false);
    expect(t.events).toEqual(["drain h3"]);
    t.drains.get(3)!.resolve(); await closed; await settle();
    expect(t.events, "no drop for an entry the island never held, and no lend replayed").toEqual(["drain h3", "teardown h3"]);
    expect(t.lives.refusedLights()).toEqual([{ ordinal: 3, cause: STALE }]);
  });
  test("R14 A REFUSAL ENDS WITH THE LIFE IT NAMED: a light asked during a refused close lights at its dark, and the old cause never reads again, at that light or at the next life's own dark", async () => {
    const t = island();
    t.lives.adopt(3, { atomKey: "k3", custody: null });
    const opening = t.lives.opening(3)!;
    const closed = t.lives.close(3, "the pūlama closes it");
    t.lives.composeRefused(3, STALE, { opening });
    expect(t.lives.refusedCloses()).toEqual([{ ordinal: 3, cause: STALE }]);
    const relit = t.lives.light(3);
    t.drains.get(3)!.resolve(); await closed; await settle();
    expect(t.lives.state(3).kind).toBe("lighting");
    expect(t.lives.refusedCloses()).toEqual([]);
    t.lights.get(3)!.resolve({ atomKey: "k3", custody: null });
    expect(await relit).toBe("lit");
    const again = t.lives.close(3, "lock");
    t.drains.get(3)!.resolve(); await again; t.drops.get(3)!.resolve(); await settle();
    expect(t.lives.state(3).kind).toBe("dark");
    expect(t.lives.refusedLights(), "a life that lit and closed clean carries no refusal of the life before it").toEqual([]);
  });
});

describe("the face gate feeds its intent door (vota answer on a pass the face admits)", () => {
  const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
  const plane = () => {
    const doc = { tiddlers: {} } as LarDoc, listeners = new Set<() => void>();
    const handle = { doc: () => doc, change: (edit: (draft: LarDoc) => void) => { edit(doc); for (const listener of listeners) listener(); },
      on: (_event: string, listener: () => void) => listeners.add(listener), off: (_event: string, listener: () => void) => listeners.delete(listener) } as unknown as DocHandle<LarDoc>;
    return { doc, handle };
  };
  const faceOf = async () => {
    const group = "synthetic-face", root = await signer(9), issuer = await signer(1), executor = await signer(2);
    const inception = mintPersonaInception(`0x${root.key}`, "recovery");
    const records = [] as Awaited<ReturnType<typeof signPersonaAct>>[];
    for (const [act, fields] of [["founding", { personaKelPrefix: inception.prefix, rootCommitment: "root" }],
      ["admission", { ...(await taggedAdmission(10, group, issuer.key)) }], ["admission", { ...(await taggedAdmission(11, group, executor.key)) }]] as const) {
      const last = records.at(-1);
      records.push(await signPersonaAct(last ? { seq: last.body.seq, cid: actCid(last.body) } : null, { group, act, epoch: 0, fields }, root));
    }
    return { group, issuer, executor, inception, records };
  };
  const word = async (f: Awaited<ReturnType<typeof faceOf>>, shared: ReturnType<typeof plane>, day: number) => {
    const votum = await buildIntent({ group: f.group, signer: f.issuer, verb: "ddate", args: { today: { year: 2026, month: 11, day } }, nonce: "",
      audience: { mode: "pinned", atom: f.executor.key }, verbs: faceIntentVerbs() });
    shared.handle.change((doc) => writeIntentEntry(doc, votum));
    return intentId(votum.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
  };
  const outcomes = (shared: ReturnType<typeof plane>, group: string) =>
    (intentEntryRecordsOfGroup(shared.doc, group) as { body: { entry: string; cause?: string } }[]).filter((r) => r.body.entry === "outcome").map((r) => r.body.cause);

  test("RED: a dark face answers no votum; CONTROL: its lit pass answers one votum at a time, and a close waits out the one in flight and admits no next; POSITIVE: the relight's pass answers what waited, and nothing twice", async () => {
    const t = island(), f = await faceOf(), shared = plane();
    const held: Deferred<Record<string, unknown>>[] = [];
    let inFlight = 0, most = 0;
    const effect = async (): Promise<Record<string, unknown>> => {
      inFlight++; most = Math.max(most, inFlight);
      const d = deferred<Record<string, unknown>>(); held.push(d);
      try { return await d.promise; } finally { inFlight--; }
    };
    const until = async (ready: () => boolean): Promise<void> => { for (let i = 0; i < 500 && !ready(); i++) await new Promise((r) => setImmediate(r)); };
    // The door asks the face's actor for each answer's turn (`admitWork`): a dark or closing face admits none.
    const door = makeFaceIntentDoor({ group: f.group, atom: f.executor, plane: shared.handle, personaRecords: () => f.records, kelChain: () => [f.inception],
      standing: () => "stands", verbs: faceIntentVerbs(), runDeclaredEffect: effect, admitTurn: () => t.lives.admitWork(1), log: () => {} });
    const first = await word(f, shared, 21), second = await word(f, shared, 22);
    await door.heed();
    expect(held).toHaveLength(0);
    // THE LIT PASS: the light settles, and the face gate admits a pass that heeds its door.
    await lit(t, 1);
    const pass = door.heed();
    await until(() => held.length === 1);
    expect(held).toHaveLength(1);
    const closed = t.lives.close(1, "lock");
    await settle();
    expect(t.events, "the close waits out the votum in flight").not.toContain("drain h1");
    held[0]!.resolve({ text: "one" });
    await pass;
    expect(held, "a closing face admits no next votum").toHaveLength(1);
    const [answered] = outcomes(shared, f.group);
    expect(outcomes(shared, f.group)).toHaveLength(1);
    await until(() => t.events.includes("drain h1"));
    expect(t.events).toContain("drain h1");
    t.drains.get(1)!.resolve(); await closed;
    t.drops.get(1)!.resolve(); await settle();
    expect(t.lives.state(1).kind).toBe("dark");
    // The answered votum worded again, then the relight's pass: the waiting votum answers, the answered one never twice.
    expect(await word(f, shared, 21)).toBe(first);
    expect(await word(f, shared, 22)).toBe(second);
    await lit(t, 1);
    const relit = door.heed();
    await until(() => held.length === 2);
    held[1]!.resolve({ text: "two" });
    await relit;
    await door.heed();
    expect(held).toHaveLength(2);
    expect(most, "one votum at a time").toBe(1);
    expect(outcomes(shared, f.group)).toHaveLength(2);
    expect(new Set(outcomes(shared, f.group))).toEqual(new Set([first, second]));
    expect(outcomes(shared, f.group)[0]).toBe(answered);
  });
});
