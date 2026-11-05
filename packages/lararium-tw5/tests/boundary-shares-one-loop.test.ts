/**
 * Repeated production boundary signals (an act's `wikiHandBoundary`, `handsRested`) under a HUNG receipt share ONE resting loop: each
 * caller joins the pending loop instead of starting another re-ask loop of its own, so ten thousand signals leave one loop asking the
 * Drain. A caller that joins after the loop's last ask makes it ask once more, so every caller's marks-so-far rest before it answers.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { ManualBoundary, shoreRig, turns } from "./wiki-shore-rig.js";

describe.skipIf(wikiSkip)(`boundaries under a hung receipt share one resting loop${skipNote}`, () => {
  test("RED: 10000 boundary signals ask the Drain once, not once each — CONTROL: when the receipt lands the one loop settles every caller", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const title = "lar:///t/boundary/one-loop";
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    r.adaptor.caps.receipt = {
      begin: () => ({ done: () => {} }), held: () => null, idle: async () => {}, answer: () => false, stalledAsks: () => 0, close: () => {},
      ack: async () => { await held; },
    } as never;
    const save = r.adaptor.saveTiddler({ fields: { title, text: "v0" } });
    boundary.fire();
    await turns(24);
    const drain = (r.adaptor as unknown as { drain: { whenAcked(generation?: number): Promise<unknown> } }).drain;
    const whenAcked = drain.whenAcked.bind(drain);
    let asks = 0;
    drain.whenAcked = (generation?: number) => { asks++; return whenAcked(generation); };
    const callers: Array<Promise<void>> = [];
    for (let i = 0; i < 10_000; i++) callers.push(r.adaptor.boundary());
    callers.push(r.adaptor.handsRested());
    await turns(16);
    expect(asks, "one resting loop asks the Drain; every later caller joins it").toBeLessThanOrEqual(2);
    release();
    boundary.fire();
    await turns(48);
    await Promise.all(callers);   // control: the one loop settles every caller
    await save;
    await r.stop();
  }, 120_000);
});
