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
});
