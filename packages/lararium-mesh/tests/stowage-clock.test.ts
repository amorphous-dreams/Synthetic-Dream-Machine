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
});
