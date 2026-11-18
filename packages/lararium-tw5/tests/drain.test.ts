/**
 * The shore Drain: one owner of drain state, three verbs (mark / whenAcked / close), one typed single flight.
 * Red-first: this file pins the module's contract before src/drain.ts exists.
 *
 * Spec: ~/.lares-scratch/drain-scout/drain-spec.md. Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */
import { describe, expect, test } from "vitest";
import { Drain, type DrainOutcome } from "../src/drain.js";

/** A controllable store: each write parks until the test settles it, and the rig counts concurrent writes. */
function rig(opts: { schedule?: (run: () => void) => void } = {}) {
  const writes: Array<{ title: string; gen: number; resolve: () => void; reject: (e: Error) => void }> = [];
  let live = 0;
  let maxLive = 0;
  const drain = new Drain({
    write: (title, gen) => new Promise<void>((resolve, reject) => {
      live++; maxLive = Math.max(maxLive, live);
      writes.push({
        title, gen,
        resolve: () => { live--; resolve(); },
        reject: (e) => { live--; reject(e); },
      });
    }),
    ...(opts.schedule ? { schedule: opts.schedule } : {}),
  });
  return { drain, writes, maxLive: () => maxLive };
}
const macrotask = (): Promise<void> => new Promise((r) => setImmediate(r));
const settle = async (): Promise<void> => { await macrotask(); await macrotask(); };
const kind = (o: DrainOutcome): string => o.kind;

describe("Drain", () => {
  test("mark never starts a write; the pump runs on a later macrotask", async () => {
    const { drain, writes } = rig();
    drain.mark("a");
    expect(writes).toHaveLength(0);
    await Promise.resolve();
    expect(writes).toHaveLength(0);
    await settle();
    expect(writes).toHaveLength(1);
    expect(writes[0]!.title).toBe("a");
  });

  test("one write in flight across titles: three marks run strictly one after another", async () => {
    const { drain, writes, maxLive } = rig();
    drain.mark("a"); drain.mark("b"); drain.mark("c");
    await settle();
    expect(writes).toHaveLength(1);
    writes[0]!.resolve(); await settle();
    expect(writes).toHaveLength(2);
    writes[1]!.resolve(); await settle();
    writes[2]!.resolve(); await settle();
    expect(writes.map((w) => w.title).sort()).toEqual(["a", "b", "c"]);
    expect(maxLive()).toBe(1);
  });

  test("coalescing: marks of one title during its flight leave exactly ONE follow-up carrying the latest generation", async () => {
    const { drain, writes } = rig();
    const first = drain.mark("t");
    await settle();
    expect(writes).toHaveLength(1);
    expect(writes[0]!.gen).toBe(first);
    drain.mark("t"); drain.mark("t");
    const last = drain.mark("t");
    writes[0]!.resolve(); await settle();
    expect(writes).toHaveLength(2);
    expect(writes[1]!.gen).toBe(last);
    writes[1]!.resolve(); await settle();
    expect(writes).toHaveLength(2);
  });

  test("the write snapshots its generation at flight start; a newer mark during the flight stays dirty", async () => {
    const { drain, writes } = rig();
    const g1 = drain.mark("t");
    await settle();
    const g2 = drain.mark("t");
    writes[0]!.resolve();
    expect(kind(await drain.whenAcked(g1))).toBe("acked");
    await settle();
    expect(writes[1]!.gen).toBe(g2);
    const acked = drain.whenAcked(g2);
    writes[1]!.resolve();
    expect(kind(await acked)).toBe("acked");
  });

  test("whenAcked with nothing owed resolves acked at once, and a clean title costs no write", async () => {
    const { drain, writes } = rig();
    expect(kind(await drain.whenAcked())).toBe("acked");
    const g = drain.mark("t");
    await settle();
    writes[0]!.resolve();
    await drain.whenAcked(g);
    await settle();
    expect(writes).toHaveLength(1);
  });

  test("completion yields through ONE schedule() site: no next write before the scheduled callback runs", async () => {
    const queued: Array<() => void> = [];
    const { drain, writes } = rig({ schedule: (run) => { queued.push(run); } });
    drain.mark("a"); drain.mark("b");
    expect(queued.length).toBeGreaterThan(0);
    while (queued.length) queued.shift()!();
    expect(writes).toHaveLength(1);
    writes[0]!.resolve();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(writes).toHaveLength(1);          // microtasks alone never advance the pump
    expect(queued).toHaveLength(1);          // exactly one reschedule per completion
    queued.shift()!();
    expect(writes).toHaveLength(2);
  });

  test("an instantly-acking store never starves the event loop: a macrotask interleaves before the backlog ends", async () => {
    let done = 0;
    const drain = new Drain({ write: async () => { done++; } });
    for (let i = 0; i < 200; i++) drain.mark(`t${i}`);
    let seenMid = -1;
    setImmediate(() => { seenMid = done; });
    const outcome = await drain.whenAcked();
    expect(kind(outcome)).toBe("acked");
    expect(done).toBe(200);
    expect(seenMid).toBeGreaterThanOrEqual(0);
    expect(seenMid).toBeLessThan(200);
  });

  test("a failed write gives its waiters a terminal failed outcome, keeps the title dirty, and never self-retries", async () => {
    const { drain, writes } = rig();
    const g = drain.mark("t");
    await settle();
    const waiting = drain.whenAcked(g);
    writes[0]!.reject(new Error("no ack"));
    const out = await waiting;
    expect(out.kind).toBe("failed");
    expect((out as Extract<DrainOutcome, { kind: "failed" }>).error).toBeInstanceOf(Error);
    for (let i = 0; i < 5; i++) await settle();
    expect(writes).toHaveLength(1);          // no spin
    const g2 = drain.mark("t");              // the next request writes the latest generation
    await settle();
    expect(writes).toHaveLength(2);
    expect(writes[1]!.gen).toBe(g2);
    writes[1]!.resolve();
    expect(kind(await drain.whenAcked(g2))).toBe("acked");
  });

  test("a dirty title left by a failure rides the next pump turn when a different title is marked", async () => {
    const { drain, writes } = rig();
    drain.mark("a");
    await settle();
    writes[0]!.reject(new Error("x"));
    await settle();
    drain.mark("b");
    await settle();
    writes[1]!.resolve(); await settle();
    expect(writes.map((w) => w.title)).toContain("a");
    expect(writes.length).toBeGreaterThanOrEqual(3);
  });

  test("close refuses new marks as abandoned, awaits the owed work, and is safe to call twice", async () => {
    const { drain, writes } = rig();
    const g = drain.mark("t");
    const closing = drain.close();
    const late = drain.mark("u");
    await settle();
    expect(writes).toHaveLength(1);
    writes[0]!.resolve();
    expect(kind(await closing)).toBe("acked");
    expect(kind(await drain.whenAcked(late))).toBe("abandoned");
    expect(kind(await drain.whenAcked(g))).toBe("acked");
    await settle();
    expect(writes.map((w) => w.title)).toEqual(["t"]);
    expect(kind(await drain.close())).toBe("acked");
  });

  test("close over a failing write returns the failed outcome rather than hanging", async () => {
    const { drain, writes } = rig();
    drain.mark("t");
    const closing = drain.close();
    await settle();
    writes[0]!.reject(new Error("down"));
    expect(kind(await closing)).toBe("failed");
  });

  test("dependency edge: a removal waits on its target's ack, then rides as an ordinary mark", async () => {
    const { drain, writes } = rig();
    const target = drain.mark("target");
    const removal = drain.markAfter("source", "target", target);
    await settle();
    expect(writes.map((w) => w.title)).toEqual(["target"]);
    writes[0]!.resolve(); await settle();
    expect(writes.map((w) => w.title)).toEqual(["target", "source"]);
    writes[1]!.resolve();
    expect(kind(await drain.whenAcked(removal))).toBe("acked");
  });

  test("dependency edge: a failed target keeps the removal parked; the retried target releases it; no second retry track", async () => {
    const { drain, writes } = rig();
    const target = drain.mark("target");
    drain.markAfter("source", "target", target);
    await settle();
    writes[0]!.reject(new Error("refused"));
    await settle();
    for (let i = 0; i < 3; i++) await settle();
    expect(writes.map((w) => w.title)).toEqual(["target"]);   // the removal never writes ahead of its target
    const again = drain.mark("target");
    await settle();
    writes[1]!.resolve(); await settle();
    expect(writes.map((w) => w.title)).toEqual(["target", "target", "source"]);
    writes[2]!.resolve();
    expect(kind(await drain.whenAcked())).toBe("acked");
    expect(again).toBeGreaterThan(target);
  });

  test("memory stays bounded by titles: ten thousand marks of one title hold one slot and cost two writes at most", async () => {
    const { drain, writes } = rig();
    drain.mark("t");
    await settle();
    for (let i = 0; i < 10_000; i++) drain.mark("t");
    expect(drain.size()).toBe(1);
    writes[0]!.resolve(); await settle();
    writes[1]!.resolve(); await settle();
    expect(writes).toHaveLength(2);
    expect(drain.size()).toBeLessThanOrEqual(1);
  });

  test("the write is keyed by title and generation, so an ambiguous failure retried at the same generation stays safe", async () => {
    const { drain, writes } = rig();
    const g = drain.mark("t");
    await settle();
    writes[0]!.reject(new Error("ambiguous"));
    await settle();
    drain.mark("other");
    await settle();
    const retried = writes.find((w, i) => i > 0 && w.title === "t");
    if (retried) expect(retried.gen).toBeGreaterThanOrEqual(g);
    expect(writes[0]!.gen).toBe(g);
  });

  test("KICK RULE: a kick during a flight starts no second write; it only requests", async () => {
    const { drain, writes, maxLive } = rig();
    drain.mark("a"); drain.mark("b");
    await settle();
    expect(writes).toHaveLength(1);
    for (let i = 0; i < 5; i++) drain.kick();
    drain.kick({ demand: false, only: "b" });
    await settle();
    expect(writes).toHaveLength(1);
    writes[0]!.resolve(); await settle();
    expect(writes).toHaveLength(2);
    writes[1]!.resolve(); await settle();
    expect(maxLive()).toBe(1);
  });

  test("a kick releases a standing refusal for a request, and `only` releases that title alone", async () => {
    const { drain, writes } = rig();
    drain.mark("a"); drain.mark("b"); await settle();
    writes[0]!.reject(new Error("no")); await settle();
    writes[1]!.reject(new Error("no")); await settle();
    expect(writes).toHaveLength(2);
    drain.kick({ only: "b" }); await settle();
    expect(writes).toHaveLength(3);
    expect(writes[2]!.title).toBe("b");
  });

  test("forget of a target ABANDONS its dependent edge: the removal never runs, its waiter reads abandoned, the target's read superseded", async () => {
    const { drain, writes } = rig();
    drain.mark("blocker");
    await settle();                                   // a flight stands, so nothing else starts
    const target = drain.mark("target");
    const removal = drain.markAfter("source", "target", target);
    const targetWait = drain.whenSettled("target", target);
    const removalWait = drain.whenSettled("source", removal);
    drain.forget("target");
    expect(kind(await targetWait)).toBe("superseded");
    expect(kind(await removalWait)).toBe("abandoned");
    writes[0]!.resolve(); await settle();
    for (let i = 0; i < 3; i++) await settle();
    expect(writes.map((w) => w.title)).toEqual(["blocker"]);
    expect(drain.owes("source")).toBe(false);
  });

  test("a whole-drain waiter over a forgotten title reads superseded, never a silent acked", async () => {
    const { drain, writes } = rig();
    drain.mark("blocker");
    await settle();
    const g = drain.mark("moot");
    const all = drain.whenAcked(g);
    drain.forget("moot");
    writes[0]!.resolve();
    expect(kind(await all)).toBe("superseded");
  });

  test("no timer in the drain: a door that gives up REJECTS after its patience, and every waiter settles failed", async () => {
    const { drain, writes } = rig();
    const g = drain.mark("t");
    await settle();
    const all = drain.whenAcked(g);
    const one = drain.whenSettled("t", g);
    const closing = drain.close();
    for (let i = 0; i < 6; i++) await macrotask();   // the receipt stays silent
    let settled = false;
    void Promise.race([all, one, closing]).then(() => { settled = true; });
    await macrotask();
    expect(settled).toBe(false);
    writes[0]!.reject(new Error("the vessel issued no receipt for the written documents"));  // the receipt's own patience ends
    expect([kind(await all), kind(await one), kind(await closing)]).toEqual(["failed", "failed", "failed"]);
  });

  const pending = async (p: Promise<unknown>): Promise<boolean> => { let done = false; void p.then(() => { done = true; }); await macrotask(); return !done; };

  test("a generation a newer mark displaces settles `superseded` AT ONCE, a non-ack; the generation in flight and the latest stay live and ack only after their receipt", async () => {
    const { drain, writes } = rig();
    const g1 = drain.mark("t");
    await settle();                                   // g1 flies
    const flying = drain.whenSettled("t", g1);
    const g2 = drain.mark("t");
    const middle = drain.whenSettled("t", g2);
    const g3 = drain.mark("t");                       // displaces g2 (not carried by the flight)
    const latest = drain.whenSettled("t", g3);
    expect(kind(await middle), "g2 never writes on its own").toBe("superseded");
    expect(await pending(flying), "the flight's own generation waits for its receipt").toBe(true);
    expect(await pending(latest), "the latest waits for its receipt").toBe(true);
    expect(kind(await drain.whenSettled("t", g2)), "a late request for a displaced generation reads superseded at once").toBe("superseded");
    writes[0]!.resolve(); await settle();
    expect(kind(await flying)).toBe("acked");
    expect(await pending(latest), "g1 durable does not ack g3").toBe(true);
    writes[1]!.resolve();
    expect(kind(await latest)).toBe("acked");
    expect(writes[1]!.gen).toBe(g3);
  });

  test("steady edits under SUCCESSFUL receipts: every earlier caller settles (superseded or acked), none starves", async () => {
    const { drain, writes } = rig();
    const calls: Array<Promise<DrainOutcome>> = [];
    for (let i = 0; i < 200; i++) {
      calls.push(drain.whenSettled("t", drain.mark("t")));
      await settle();
      const live = writes.filter((w, idx) => idx === writes.length - 1 && w.gen > 0);
      for (const w of live) w.resolve();               // each flight lands while the next edit arrives
    }
    await settle();
    for (const w of writes) w.resolve();
    await settle();
    for (const w of writes) w.resolve();
    const outcomes = await Promise.all(calls);
    expect(outcomes.every((o) => o.kind === "superseded" || o.kind === "acked")).toBe(true);
    expect(outcomes.some((o) => o.kind === "acked")).toBe(true);
  });

  test("HUNG receipt, ten thousand edits and boundaries: live waiters stay at two per title plus the whole-drain targets, every displaced caller has settled", async () => {
    const { drain, writes } = rig();
    drain.mark("t");
    await settle();                                   // the write hangs: its receipt never comes
    const titled: Array<Promise<DrainOutcome>> = [];
    const whole: Array<Promise<DrainOutcome>> = [];
    for (let i = 0; i < 10_000; i++) {
      titled.push(drain.whenSettled("t", drain.mark("t")));
      whole.push(drain.whenAcked());
    }
    expect(drain.waiters("t"), "the generation in flight plus the latest").toBeLessThanOrEqual(2);
    expect(drain.waiters(), "plus the in-flight whole-drain target and the newest").toBeLessThanOrEqual(4);
    for (const old of titled.slice(0, -1)) expect(kind(await old)).toBe("superseded");
    for (const old of whole.slice(1, -1)) expect(kind(await old)).toBe("superseded");
    expect(await pending(titled[titled.length - 1]!), "the latest still waits").toBe(true);
    writes[0]!.resolve(); await settle();
    writes[1]!.resolve();
    expect(kind(await titled[titled.length - 1]!)).toBe("acked");
    expect(drain.waiters()).toBe(0);
  });

  test("superseded never produces an ack: a displaced caller reads no `acked` while the latest write is unresolved", async () => {
    const { drain, writes } = rig();
    drain.mark("t"); await settle();
    const early = drain.whenSettled("t", drain.mark("t"));
    drain.mark("t");
    expect(kind(await early)).toBe("superseded");
    expect(writes).toHaveLength(1);                   // nothing but the hung flight ever wrote
    writes[0]!.reject(new Error("refused"));
    await settle();
  });

  test("FAIRNESS: a title re-marked during every one of its flights never starves another owed title; the oldest owed generation flies first — CONTROL: with no re-marks the two leave in mark order", async () => {
    // CONTROL
    const control = rig();
    control.drain.mark("A"); await settle(); control.drain.mark("B");
    control.writes[0]!.resolve(); await settle();
    expect(control.writes.map((w) => w.title)).toEqual(["A", "B"]);
    // RED: B owes an OLDER generation than any A re-mark, so B's turn comes before A's follow-up.
    const { drain, writes } = rig();
    drain.mark("A");
    await settle();                                   // A flies
    const b = drain.mark("B");                        // B owed, behind A's flight
    const whole = drain.whenAcked();
    for (let round = 0; round < 20; round++) {
      drain.mark("A");                                // an edit of A lands during every flight
      writes[writes.length - 1]!.resolve();           // each receipt succeeds
      await settle();
    }
    expect(writes.map((w) => w.title), "B leaves right after the flight it waited behind").toContain("B");
    expect(writes[1]!.title).toBe("B");
    expect(kind(await drain.whenSettled("B", b))).toBe("acked");
    for (const w of writes) w.resolve();
    await settle();
    expect(kind(await whole), "the whole-drain target acks once every title's receipts cover it").toBe("acked");
  });

  test("a late request for a generation the FLIGHT carries waits on the flight's own waiter: two live waiters per title at most", async () => {
    const { drain, writes } = rig();
    const g1 = drain.mark("t"); const g2 = drain.mark("t"); const g3 = drain.mark("t");
    await settle();                                   // the flight at g3 carries g1..g3
    const asked = [drain.whenSettled("t", g1), drain.whenSettled("t", g2), drain.whenSettled("t", g3)];
    expect(drain.waiters("t"), "the generation in flight (carrying the earlier two) and nothing else").toBeLessThanOrEqual(2);
    expect(await pending(asked[0]!), "the carried generation still waits for the receipt").toBe(true);
    writes[0]!.resolve(); await settle();
    expect((await Promise.all(asked)).map(kind)).toEqual(["acked", "acked", "acked"]);
  });
});

describe("Drain: SUBMIT then SETTLE (L29)", () => {
  /** A store whose write submits at once and hands back its receipt, which the test answers. */
  function settlingRig() {
    const receipts: Array<{ title: string; resolve: () => void; reject: (e: Error) => void }> = [];
    const submitted: string[] = [];
    const drain = new Drain({
      write: async (title) => {
        submitted.push(title);
        let resolve!: () => void; let reject!: (e: Error) => void;
        const settled = new Promise<void>((y, n) => { resolve = y; reject = n; });
        receipts.push({ title, resolve, reject });
        return { settled };
      },
    });
    return { drain, receipts, submitted };
  }

  test("independent titles submit before either receipt answers; one title never carries two writes at once", async () => {
    const { drain, receipts, submitted } = settlingRig();
    drain.mark("a"); drain.mark("b");
    await settle(); await settle();
    expect(submitted, "both store writes leave while both receipts wait").toEqual(["a", "b"]);
    drain.mark("a");
    await settle(); await settle();
    expect(submitted, "a's second write waits on a's first receipt").toEqual(["a", "b"]);
    receipts[0]!.resolve();
    await settle(); await settle();
    expect(submitted).toEqual(["a", "b", "a"]);
    receipts[1]!.resolve(); receipts[2]!.resolve();
    expect(kind(await drain.whenAcked())).toBe("acked");
  });

  test("whenSubmitted waits for a removal behind its target's receipt, never for the receipts themselves — CONTROL: an open drain never answers", async () => {
    const { drain, receipts, submitted } = settlingRig();
    let done = false;
    void drain.whenSubmitted().then(() => { done = true; });
    const target = drain.mark("target");
    drain.markAfter("removal", "target", target);
    await settle(); await settle();
    expect(done, "control: an open drain is never submitted").toBe(false);
    const closing = drain.close();
    void drain.whenSubmitted().then(() => { done = true; });
    await settle(); await settle();
    expect(submitted).toEqual(["target"]);
    expect(done, "the removal still has to ask").toBe(false);
    receipts[0]!.resolve();
    await settle(); await settle();
    expect(submitted).toEqual(["target", "removal"]);
    expect(done, "every write has asked; its receipt still waits").toBe(true);
    receipts[1]!.reject(new Error("closed"));
    expect(kind(await closing)).toBe("failed");
  });

  test("a refused target frees its removal from the submit wait without a write", async () => {
    const { drain, receipts, submitted } = settlingRig();
    const target = drain.mark("target");
    drain.markAfter("removal", "target", target);
    const closing = drain.close();
    await settle(); await settle();
    let done = false;
    void drain.whenSubmitted().then(() => { done = true; });
    receipts[0]!.reject(new Error("refused"));
    await settle(); await settle();
    expect(done).toBe(true);
    expect(submitted).toEqual(["target"]);
    expect(kind(await closing)).toBe("failed");
  });
});
