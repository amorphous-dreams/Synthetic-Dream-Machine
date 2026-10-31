/**
 * protected-doc-guard-liveness — RECOUNT BEFORE SERVE HOLDS UNDER A SUSTAINED WRITER (P26 held row, folded into lane `ralias`).
 *
 * The guard waits, before it classes an ask, until no recount stands queued. Sol measured a 10,001-recount burst draining in
 * 466 ms, but a producer that queues a fresh recount from every recount held an ask past 3 s: the wait had no bound, so a
 * self-replenishing classification writer could hold every ask forever. The cure bounds the wait by ROUNDS (never a clock):
 * an ask waits a fixed number of settle rounds and, still pending past them, withholds (fail closed). The holder coalesces
 * recounts, so any finite burst drains within the bound.
 *
 *   L1  RED: a source that is pending after every settle round answers the ask (withhold), never holds it.
 *   L2  RED (Sonnet cold read, Q5): a bound that trips fires `onBound`, so the composer re-asks its cached verdicts once the
 *       queue drains (a document withheld at the bound never stays withheld in the Repo's cache); CONTROL: an ask that
 *       settles within the bound fires nothing.
 *   L1c CONTROL: a source that drains after a few rounds classes the ask normally (an admitted peer reads, an unclassed doc falls through).
 */
import { describe, expect, test } from "vitest";
import { protectedDocGuard } from "../src/protected-doc-guard.js";

const race = <T,>(p: Promise<T>, ms: number): Promise<T | "held"> =>
  Promise.race([p, new Promise<"held">((r) => setTimeout(() => r("held"), ms))]);

describe("the guard's recount wait is bounded", () => {
  test("L1 — RED: a self-replenishing recount source never holds an ask; past the bound it withholds", async () => {
    let rounds = 0;
    let writing = true;                                          // the test stops the writer once it has read, so a red ends
    const guard = protectedDocGuard({
      ids: () => new Map([["doc-a", "kahu-canon"]]),
      settled: async () => { rounds++; await new Promise<void>((r) => setImmediate(r)); },
      pending: () => writing,                                    // every recount queues another
      decide: { "kahu-canon": () => true },
    });
    try {
      expect(await race(guard.withholds("hand", "doc-a"), 2_000), "the ask answers").toBe(true);
      expect(rounds, "a bounded number of rounds").toBeLessThanOrEqual(64);
      // An unclassed document under the same writer still withholds: no document stands proven unprotected mid-count.
      expect(await race(guard.withholds("hand", "doc-unclassed"), 2_000)).toBe(true);
    } finally { writing = false; }
  });

  test("L1c — CONTROL: a source that drains within the bound classes the ask as before", async () => {
    let left = 3;
    const guard = protectedDocGuard({
      ids: () => new Map([["doc-a", "kahu-canon"]]),
      settled: async () => { if (left > 0) left--; },
      pending: () => left > 0,
      decide: { "kahu-canon": (peer) => peer === "hand" },
    });
    expect(await guard.withholds("hand", "doc-a")).toBe(false);
    left = 3;
    expect(await guard.withholds("stranger", "doc-a")).toBe(true);
    left = 3;
    expect(await guard.withholds("stranger", "doc-unclassed")).toBe(false);
  });

  test("L2 — RED: a bound that trips fires onBound; CONTROL: a settled ask fires nothing", async () => {
    let writing = true, bound = 0, left = 0;
    const guard = protectedDocGuard({
      ids: () => new Map([["doc-a", "kahu-canon"]]),
      settled: async () => { if (left > 0) left--; await new Promise<void>((r) => setImmediate(r)); },
      pending: () => writing || left > 0,
      decide: { "kahu-canon": () => true },
      ...({ onBound: () => { bound++; } } as object),
    } as Parameters<typeof protectedDocGuard>[0]);
    try {
      expect(await race(guard.withholds("hand", "doc-a"), 2_000)).toBe(true);
      expect(bound, "the trip re-asks").toBe(1);
    } finally { writing = false; }
    left = 2;
    expect(await guard.withholds("hand", "doc-a")).toBe(false);
    expect(bound, "CONTROL: a settled ask re-asks nothing").toBe(1);
  });
});
