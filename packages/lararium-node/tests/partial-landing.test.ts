/**
 * partial-landing — the last judgement before a two-vault door writes. It returns once a judgement reads `complete`
 * and the mark held still across it, refuses any other verdict, and refuses after a bounded count of passes that
 * each saw the mark move. No clock enters.
 */
import { describe, expect, test } from "vitest";
import type { NexusPartialJudgement } from "@lararium/mesh";
import { judgeStillBeforeWrite, LANDING_PASSES } from "../src/partial-landing.js";

const refuse = (message: string): Error => new Error(message);
const reads = (verdict: NexusPartialJudgement["verdict"], why?: string): NexusPartialJudgement => ({ verdict, signed: [], ...(why ? { why } : {}) });

describe("judgeStillBeforeWrite", () => {
  test("a still mark returns after exactly one judgement", async () => {
    let judged = 0;
    await judgeStillBeforeWrite({ mark: () => "still", judge: async () => { judged += 1; return reads("complete"); }, refuse });
    expect(judged).toBe(1);
  });

  test("a mark that moves once takes one more judgement, then returns", async () => {
    let world = 0, judged = 0;
    await judgeStillBeforeWrite({ mark: () => String(world), judge: async () => { judged += 1; if (judged === 1) world += 1; return reads("complete"); }, refuse });
    expect(judged).toBe(2);
  });

  test("RED: a mark that moves through every pass refuses after the bounded count", async () => {
    let world = 0, judged = 0;
    const run = judgeStillBeforeWrite({ mark: () => String(world), judge: async () => { judged += 1; world += 1; return reads("complete"); }, refuse });
    await expect(run).rejects.toThrow(`the board moved through ${LANDING_PASSES} judgements in a row`);
    expect(judged).toBe(LANDING_PASSES);
  });

  test("RED: a verdict that turns at the write refuses by name, on the pass it turns", async () => {
    let world = 0, judged = 0;
    const run = judgeStillBeforeWrite({
      mark: () => String(world),
      judge: async () => { judged += 1; if (judged === 1) { world += 1; return reads("complete"); } return reads("stale", "the act's line moved"); },
      refuse,
    });
    await expect(run).rejects.toThrow("the partial reads stale on this vessel at the write: the act's line moved; nothing lands.");
    expect(judged).toBe(2);
  });
});
