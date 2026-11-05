/**
 * The Drain's waiters stay bounded on the PRODUCTION save path: a receipt hangs while many edits of one title and repeated boundaries
 * arrive. The adaptor holds at most the generation in flight plus the latest for the title (plus the whole-drain targets), every
 * displaced save's returned promise has SETTLED (so its reaction chain is released), and a superseded save never reads as saved:
 * the latest write acks only after its receipt.
 */
import { describe, expect, test } from "vitest";
import { ManualBoundary, shoreRig, turns } from "./wiki-shore-rig.js";

const isPending = async (p: Promise<unknown>): Promise<boolean> => { let done = false; void p.then(() => { done = true; }, () => { done = true; }); await turns(2); return !done; };

describe("drain waiters on the save path", () => {
  test("many edits under a hung receipt hold at most two waiters for the title; displaced saves settle; the latest acks only after its receipt", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const title = "lar:///t/drain/waiters-bounded";
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let asks = 0;
    r.adaptor.caps.receipt = {
      begin: () => ({ done: () => {} }), held: () => null, idle: async () => {}, answer: () => false, stalledAsks: () => 0, close: () => {},
      ack: async () => { asks++; await held; },
    } as never;
    const saves: Array<Promise<void>> = [];
    saves.push(r.adaptor.saveTiddler({ fields: { title, text: "v0" } }));
    boundary.fire();
    await turns(24);
    expect(asks, "control: the first receipt is pending").toBeGreaterThan(0);
    for (let i = 1; i <= 300; i++) {
      saves.push(r.adaptor.saveTiddler({ fields: { title, text: `v${i}` } }));
      if (i % 25 === 0) { boundary.fire(); void r.adaptor.boundary().catch(() => {}); }
    }
    await turns(16);
    const drain = (r.adaptor as unknown as { drain: { waiters(title?: string): number } }).drain;
    expect(drain.waiters(title), "the generation in flight plus the latest").toBeLessThanOrEqual(2);
    expect(drain.waiters(), "plus the whole-drain targets").toBeLessThanOrEqual(5);
    let live = 0;
    for (const save of saves) if (await isPending(save)) live++;
    expect(live, "every displaced save has settled, so its reactions are released").toBeLessThanOrEqual(2);
    release();
    boundary.fire();
    await turns(48);
    await Promise.all(saves);
    await r.stop();
  }, 120_000);
});
