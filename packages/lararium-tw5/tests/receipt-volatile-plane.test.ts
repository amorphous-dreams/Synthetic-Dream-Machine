/**
 * An act's receipt hold names only the bags the island holds a replica of. A confirm whose dispatch also marks a title on the volatile
 * plane (the temp slot, a memory store the vessel never holds) writes that title through the store call alone, and the store call already
 * answered: the hold asks no heads for it. Naming the temp slot to the capability would refuse the whole act (`receipt-refused`), since the
 * island holds no handle to name heads from — the refusal a veil floor's projection met on its second edit (golden-whole-road W6).
 * `_ackDurably` already filters by `receipt.holds`; the act's hold reads the same law.
 */
import { describe, expect, test } from "vitest";
import { makeReceiptCapability } from "../src/receipt.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, ManualBoundary, openDraft, remote, saveSequence, shoreRig, tempBag, turns } from "./wiki-shore-rig.js";
import type { LarTiddlerRecord } from "@lararium/mesh";

describe.skipIf(wikiSkip)(`an act's receipt hold beside the volatile plane${skipNote}`, () => {
  test("RED: a confirm that marks a temp-plane title in the same dispatch receipts — CONTROL: the temp title rests in the memory store and the hold names a bag the island holds", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary, upperSlots: true });
    const target = "lar:///t/volatile/target";
    await r.working.put({ tiddler: { title: target, text: "landed" } } as LarTiddlerRecord, remote);
    await turns();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const asked: string[][] = [];
    const verdicts: Array<Promise<boolean>> = [];
    const named: Array<readonly string[] | null> = [];
    const receipt = makeReceiptCapability({
      post: (m) => { if (m.type === "receipt:request") { asked.push([...m.documentIds]); queueMicrotask(() => receipt.answer({ type: "receipt:issued", requestId: m.requestId, issued: true })); } },
      handles: () => new Map(Object.entries(r.handles)),
    });
    const begin = receipt.begin.bind(receipt);
    receipt.begin = () => { const hold = begin(); return { done: (slots, end) => { named.push(slots); const v = hold.done(slots, end); verdicts.push(v); return v; } }; };
    r.adaptor.caps = { receipt };
    const draft = openDraft(r, target, "edited");
    await afterDispatch();
    boundary.fire();
    await turns(16);
    saveSequence(r, draft);
    r.wiki.addTiddler(new r.Tiddler({ title: "$:/temp/volatile/beside", text: "a state the act's dispatch marked" }));
    await afterDispatch();
    boundary.fire();
    for (let turn = 0; turn < 8 && verdicts.length === 0; turn++) await turns(16);
    expect(verdicts.length, "control: the act released its hold").toBeGreaterThan(0);
    expect(r.calls.some((c) => c.bag === tempBag && c.puts.includes("$:/temp/volatile/beside")), "control: the temp title went to the memory store").toBe(true);
    expect(named.flatMap((n) => n ?? []).some((bag) => Object.hasOwn(r.handles, bag)), `control: the hold names a bag the island holds (${JSON.stringify(named)})`).toBe(true);
    expect(named.flatMap((n) => n ?? []), "the hold names no bag the island holds no replica of").not.toContain(tempBag);
    expect(await Promise.all(verdicts), "the act's verdict reads kept").toEqual(verdicts.map(() => true));
    receipt.close();
    await r.stop();
  }, 60_000);
});
