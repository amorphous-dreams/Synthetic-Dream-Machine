/**
 * stowage-clock — A REALM'S IDLE READS ITS OWN CLOCK, NEVER THE WALL.
 *
 * `BagStowage` cooled a wela bag when `Date.now() - lastTouched` passed `idleMs` — a local wall clock
 * deciding a realm's liveness, which the lamplighters ban: a logical epoch cannot accrue silence at all.
 * The stowage now reads an injectable `clock` (the realm's roll count, as the CAS sweep does); a day of
 * wall-silence ages nothing while rolls age. Wall time stays only as the named floor when no clock rides in.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/scale-stories-basket-one#/grace-and-pin
 */
import { describe, expect, test, vi } from "vitest";
import { BagStowage } from "../src/bag-residency.js";

const URL_A = "automerge:stowage-clock-a" as never;

describe("the stowage idle clock", () => {
  test("a day of wall-silence ages nothing while the realm's clock stands", async () => {
    let rolls = 0;
    const mgr = new BagStowage({ idle: 3, clock: () => rolls });
    await mgr.touch(URL_A);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 86_400_000);
    const r = await mgr.sweepOnce();
    vi.useRealTimers();
    expect(r.cooled).toBe(0);
    expect(mgr.tier(URL_A)).toBe("wela");
  });

  test("three rolls in one instant cool it", async () => {
    let rolls = 0;
    const mgr = new BagStowage({ idle: 3, clock: () => rolls });
    await mgr.touch(URL_A);
    rolls = 4;
    const r = await mgr.sweepOnce();
    expect(r.cooled).toBe(1);
    expect(mgr.tier(URL_A)).toBe("anu");
  });

  /** CONTROL: no clock named → the wall floor, and it reads as the floor by name. */
  test("no clock → the wall floor, named", async () => {
    const mgr = new BagStowage({ idleMs: 1 });
    expect(mgr.clockKind).toBe("wall-floor");
    await mgr.touch(URL_A);
    await new Promise((r) => setTimeout(r, 5));
    expect((await mgr.sweepOnce()).cooled).toBe(1);
  });

  // SET-BACK/SET-FORWARD PROOF — the wall-floor fallback never leaves process memory (never
  // persisted, never compared across a restart), so it now reads `performance.now()` rather
  // than `Date.now()`: an adversarial or operator wall-clock jump must change neither real
  // eviction timing nor whether a still-fresh bag gets evicted early.
  test("SET-BACK/SET-FORWARD: the wall floor reads monotonic — a Date.now() jump moves nothing real", async () => {
    const realNow = Date.now;
    const realMono = performance.now;
    let wallOffsetMs = 0;
    // The vector steps the monotonic clock by hand, so "inside the idle window" and "past it" read off that clock
    // alone and the machine's own pace decides neither.
    let mono = 1_000;
    Date.now = () => realNow() + wallOffsetMs;
    performance.now = () => mono;
    try {
      const mgr = new BagStowage({ idleMs: 50 });
      await mgr.touch(URL_A);
      // A forward jump of a year: a reverted Date.now()-based idle clock would read the bag as
      // ancient and evict it at once, with none of its 50ms idle window spent.
      wallOffsetMs = 365 * 24 * 60 * 60 * 1000;
      const tooSoon = await mgr.sweepOnce();
      expect(tooSoon.cooled).toBe(0);
      expect(mgr.tier(URL_A)).toBe("wela");
      // A set-back of a year: a reverted Date.now()-based idle clock would never read the bag as
      // idle again (lastTouched would sit "in the future"). The monotonic clock passes the idle window.
      wallOffsetMs = -365 * 24 * 60 * 60 * 1000;
      mono += 80;
      const nowIdle = await mgr.sweepOnce();
      expect(nowIdle.cooled).toBe(1);
      expect(mgr.tier(URL_A)).toBe("anu");
    } finally {
      Date.now = realNow;
      performance.now = realMono;
    }
  });
});

describe("the stowage answers its own idleness", () => {
  test("a realm clock: stats carries idleFor in rolls and the clock's kind, never lastTouched", async () => {
    let rolls = 10;
    const mgr = new BagStowage({ idle: 30, clock: () => rolls });
    await mgr.touch(URL_A);
    rolls = 13;
    const stats = mgr.stats();
    expect(stats.clockKind).toBe("realm");
    expect(stats.wela).toHaveLength(1);
    expect(stats.wela[0]!.idleFor).toBe(3);
    expect(stats.wela[0]).not.toHaveProperty("lastTouched");
  });

  test("stats reads the clock once, so every entry derives from one reading", async () => {
    let rolls = 0;
    const mgr = new BagStowage({ idle: 30, clock: () => rolls });
    const URL_B = "automerge:stowage-clock-b" as never;
    await mgr.touch(URL_A);
    rolls = 2;
    await mgr.touch(URL_B);
    rolls = 5;
    let reads = 0;
    const counting = new BagStowage({ idle: 30, clock: () => { reads++; return rolls; } });
    await counting.touch(URL_A);
    await counting.touch(URL_B);
    reads = 0;
    counting.stats();
    expect(reads).toBe(1);
    expect(mgr.stats().wela.map((e) => e.idleFor)).toEqual([3, 5]);
  });

  test("no clock named: the wall floor, named, with a non-negative idleFor in milliseconds", async () => {
    const mgr = new BagStowage({});
    await mgr.touch(URL_A);
    const stats = mgr.stats();
    expect(stats.clockKind).toBe("wall-floor");
    expect(stats.wela[0]!.idleFor).toBeGreaterThanOrEqual(0);
  });

  test("the idleFor reading is the local clock's: a year's wall jump moves it not at all", async () => {
    let rolls = 0;
    const mgr = new BagStowage({ idle: 3, clock: () => rolls });
    await mgr.touch(URL_A);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 365 * 86_400_000);
    const idle = mgr.stats().wela[0]!.idleFor;
    vi.useRealTimers();
    expect(idle).toBe(0);
  });
});
