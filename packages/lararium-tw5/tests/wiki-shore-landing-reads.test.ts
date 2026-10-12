/**
 * A landed wave reads its layer's standing document.
 *
 * The shore lands each wave from the emitting layer at that layer's current heads. A bulk feed (a directory
 * LOAD, a seed replay) lands thousands of records one at a time, so a read that built a whole-document view
 * per record would cost the document's size per record and stall every reader behind the landing queue, the
 * disk projection first. Real TiddlyWiki, real Automerge layers, a real `CompositeStore`.
 */
import { describe, expect, test, vi } from "vitest";
import { shoreRig, canonBag, workingBag, remote, turns } from "./wiki-shore-rig.js";
import { wikiSkip, skipNote } from "./test-wiki.js";

describe.skipIf(wikiSkip)(`wiki shore landing reads${skipNote}`, () => {
  test("a bulk feed into a canon layer lands every record and builds no document view", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    const canonViews = vi.spyOn(r.canonHandle, "view");
    const workingViews = vi.spyOn(r.workingHandle, "view");
    const titles = Array.from({ length: 120 }, (_, i) => `lar:///t/landing-reads/${i}`);
    for (const [i, title] of titles.entries()) {
      await r.canon.writeFamily([{ tiddler: { title, text: `body ${i}` } }], [], remote, { bag: canonBag });
      if (i % 25 === 24) await turns(1);
    }
    for (let turn = 0; turn < 400 && titles.some((title) => !r.adaptor.ledger.landedOf(title)); turn++) await turns(1);
    expect(titles.filter((title) => r.wiki.getTiddler(title)?.fields.text === undefined)).toEqual([]);
    expect(titles.map((title) => r.adaptor.ledger.landedOf(title)?.bag)).toEqual(titles.map(() => canonBag));
    expect({ canon: canonViews.mock.calls.length, working: workingViews.mock.calls.length }).toEqual({ canon: 0, working: 0 });
    await r.stop();
  }, 120_000);

  test("control: the landed base still answers a hand's copy-up, and the ledger names the layer's heads", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/landing-reads/control";
    await r.canon.writeFamily([{ tiddler: { title, text: "canon" } }], [], remote, { bag: canonBag });
    for (let turn = 0; turn < 400 && !r.adaptor.ledger.landedOf(title); turn++) await turns(1);
    expect(r.adaptor.ledger.landedOf(title)).toMatchObject({ bag: canonBag, heads: r.canon.headsNow() });
    expect(r.wiki.getTiddler(title)?.fields["$origin-bag"]).toBe(canonBag);
    expect(r.doc(workingBag).tiddlers[title]).toBeUndefined();
    await r.stop();
  }, 120_000);
});
