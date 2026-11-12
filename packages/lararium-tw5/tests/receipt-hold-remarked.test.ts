/**
 * An act's verdict reads its OWN generations, never a later act's. A save leaves its draft's removal owed behind the target's ack; when
 * the person opens the next new tiddler at once, the editor writes a fresh draft under the same draft title (`Draft of 'New Tiddler'`)
 * before that rest returns. Once every generation the first act marked rests, the drain still owes the draft title for the second act's
 * write: the first act's verdict must read kept, not `receipt-refused` (seen as `receipt-refused@3` on quick successive new tiddlers).
 */
import { describe, expect, test } from "vitest";
import { type LarTiddlerRecord } from "@lararium/mesh";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualBoundary, openDraft, remote, saveSequence, shoreRig, turns } from "./wiki-shore-rig.js";

describe.skipIf(wikiSkip)(`an act's verdict over a draft title the next act re-marks${skipNote}`, () => {
  test("RED: the first act reads kept while the next act's draft under the same title still owes — CONTROL: the next draft stands in the wiki", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const first = "lar:///t/remark/first";
    await r.working.put({ tiddler: { title: first, text: "landed" } } as LarTiddlerRecord, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    let release!: () => void;
    let held = new Promise<void>((resolve) => { release = resolve; });
    const verdicts: Array<{ slots: readonly string[] | null; refused: boolean }> = [];
    r.adaptor.caps.receipt = {
      begin: () => ({ done: (slots: readonly string[] | null, end?: { refused?: boolean }) => { verdicts.push({ slots, refused: end?.refused === true }); return Promise.resolve(end?.refused !== true); } }),
      held: () => null, idle: async () => {}, answer: () => false, stalledAsks: () => 0, close: () => {}, holds: () => true,
      ack: async () => { await held; },
    } as never;
    const draft = openDraft(r, first, "edited");
    await afterDispatch();
    boundary.fire();
    await turns(8);
    release(); held = new Promise<void>((resolve) => { release = resolve; });
    saveSequence(r, draft);
    await afterDispatch();
    boundary.fire();
    await turns(4);
    // The next act's draft lands under the same draft title while the first act's rest still waits.
    r.wiki.addTiddler(new r.Tiddler({ title: draft, "draft.title": first, "draft.of": first, text: "next" }));
    await afterDispatch();
    // The person keeps typing into the next draft: each keystroke marks the draft title again while the rests return.
    for (let turn = 0; turn < 12 && verdicts.length === 0; turn++) {
      release(); held = new Promise<void>((resolve) => { release = resolve; });
      boundary.fire(); await turns(2);
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(draft)!.fields, { text: `next ${turn}` }));
      await afterDispatch();
    }
    release();
    expect(r.wiki.getTiddler(draft), "CONTROL: the next draft stands").toBeDefined();
    expect(verdicts.length, "the first act released its hold").toBeGreaterThan(0);
    expect(verdicts[0]!.refused, `the first act reads kept (${JSON.stringify(verdicts)})`).toBe(false);
    await r.stop().catch(() => undefined);
  }, 60_000);
});
