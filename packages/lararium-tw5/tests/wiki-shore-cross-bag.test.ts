/**
 * The cross-bag check of the wiki shore. A hand write that routes to a bag other than the one its base
 * names reads the source bag at the base heads and at its current heads before any copy-up: unmoved
 * lands in the destination, moved surfaces the hand as a parallel draft and re-lands the source record.
 */
import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, canonBag, draftBag, ManualBoundary, openDraft, peerWrite, remote, saveSequence, shoreRig, storeText, turns, workingBag } from "./wiki-shore-rig.js";

describe.skipIf(wikiSkip)(`wiki shore cross-bag check${skipNote}`, () => {
  test("a copy-up of an unmoved canon carrier writes once; a moved one surfaces and lands nothing", async () => {
    for (const moved of [false, true]) {
      const boundary = new ManualBoundary();
      let hold = false;
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const r = await shoreRig({ boundary, yieldHost: async () => { if (hold) await held; } });
      const x = `lar:///t/cross/copy-up-${moved}`;
      await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      expect(r.adaptor.ledger.landedOf(x)!.bag).toBe(canonBag);
      if (moved) {
        hold = true;
        await peerWrite(r, canonBag, [{ tiddler: { title: x, text: "canon moved" } }]);
        await turns(4);
      }
      const workingChanges = r.changes(workingBag);
      const mark = r.calls.length;
      r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(x)!.fields, { text: "hand text" }));
      await afterDispatch();
      boundary.fire();
      await turns(24);
      const writes = r.calls.slice(mark).filter((c) => c.bag === workingBag);
      if (!moved) {
        expect(writes, "exactly one copy-up write in working").toHaveLength(1);
        expect(writes[0]!.puts).toEqual([x]);
        expect(writes[0]!.base, "the canon heads never ride into working").toBeUndefined();
        expect(r.changes(workingBag) - workingChanges).toBe(1);
        expect(storeText(r, workingBag, x)).toBe("hand text");
      } else {
        expect(writes, "0 writes reach working").toEqual([]);
        expect(r.changes(workingBag)).toBe(workingChanges);
        expect(storeText(r, workingBag, x)).toBeUndefined();
        const drafts = Object.values(r.doc(draftBag).tiddlers).filter((rec) => rec.tiddler["draft.of"] === x && !rec.meta?.deleted);
        expect(drafts, "one parallel draft holds the hand's value in the draft layer").toHaveLength(1);
        expect(drafts[0]!.tiddler.text).toBe("hand text");
        hold = false;
        release();
        await turns(24);
        expect((r.wiki.getTiddler(x)!.fields as Record<string, unknown>).text, "the wiki ends holding canon's moved record").toBe("canon moved");
        expect(r.adaptor.holdsHand(x)).toBe(false);
      }
      await r.stop();
    }
  }, 120_000);

  test("a save act over a canon carrier copies up without canon heads; a moved canon surfaces the draft", async () => {
    for (const moved of [false, true]) {
      const boundary = new ManualBoundary();
      const r = await shoreRig({ boundary });
      const x = `lar:///t/cross/draft-copy-up-${moved}`;
      await r.canon.put({ tiddler: { title: x, text: "canon text" } }, remote);
      await turns();
      await r.adaptor.armSeedCheckpoint();
      const d = openDraft(r, x, "draft text");
      await afterDispatch();
      boundary.fire();
      await turns(24);
      if (moved) await peerWrite(r, canonBag, [{ tiddler: { title: x, text: "canon moved" } }]);
      const workingChanges = r.changes(workingBag);
      const mark = r.calls.length;
      saveSequence(r, d);
      await afterDispatch();
      const writes = r.calls.slice(mark).filter((c) => c.bag === workingBag && c.puts.includes(x));
      await turns(24);
      if (!moved) {
        expect(writes).toHaveLength(1);
        expect(writes[0]!.base, "canon heads never ride into working").toBeUndefined();
        expect(storeText(r, workingBag, x)).toBe("draft text");
        expect(r.changes(workingBag) - workingChanges).toBe(1);
      } else {
        expect(writes, "no copy-up lands over a moved canon").toEqual([]);
        expect(storeText(r, workingBag, x)).toBeUndefined();
        const kept = Object.values(r.doc(draftBag).tiddlers).filter((rec) => rec.tiddler["draft.of"] === x && !rec.meta?.deleted && rec.tiddler["lar-conflict-fields"] !== undefined);
        expect(kept, "the draft's value surfaces in the draft layer").toHaveLength(1);
        expect(kept[0]!.tiddler.text).toBe("draft text");
        expect(String(r.wiki.getTiddler(x)!.fields.text), "the wiki ends holding canon's moved record").toBe("canon moved");
      }
      await r.stop();
    }
  }, 120_000);
});

describe.skipIf(wikiSkip)(`a foreign family takes a waiting hand${skipNote}`, () => {
  test("an inbound family flushes the prior save, while a lone mark rests", async () => {
    const r = await shoreRig({ boundary: new ManualBoundary() });
    try {
      await r.adaptor.armSeedCheckpoint();
      const hand = "lar:///t/cross/waiting-hand";
      r.wiki.addTiddler(new r.Tiddler({ title: hand, text: "typed" }));
      await afterDispatch();
      expect(r.calls.filter((call) => call.puts.includes(hand))).toEqual([]);
      await peerWrite(r, workingBag, [{ tiddler: { title: "lar:///t/cross/foreign", text: "peer" } }]);
      await turns(24);
      expect(r.calls.filter((call) => call.puts.includes(hand))).toHaveLength(1);
    } finally {
      await r.stop();
    }
  });
});
