/**
 * The Drain's waiters stay bounded on the PRODUCTION save path: a receipt stays pending while many edits of one title arrive, and the
 * adaptor holds one live waiter for that title, never one per generation.
 */
import { describe, expect, test } from "vitest";
import { ManualBoundary, shoreRig, turns } from "./wiki-shore-rig.js";

describe("drain waiters on the save path", () => {
  test("many edits of one title under a pending receipt retain one waiter", async () => {
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
    for (let i = 1; i <= 300; i++) saves.push(r.adaptor.saveTiddler({ fields: { title, text: `v${i}` } }));
    await turns(8);
    const drain = (r.adaptor as unknown as { drain: { waiters(title?: string): number } }).drain;
    expect(drain.waiters(title), "one live waiter per title however many edits").toBe(1);
    release();
    boundary.fire();
    await turns(48);
    await Promise.all(saves);
    await r.stop();
  }, 120_000);
});
