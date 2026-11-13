import { describe, expect, test } from "vitest";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { afterDispatch, canonBag, draftBag, ManualBoundary, openDraft, remote, shoreRig, turns, typeInto, type Rig } from "./wiki-shore-rig.js";

const seedCanon = async (r: Rig, title: string, text: string): Promise<void> => {
  await r.canon.put({ tiddler: { title, text } }, remote);
  await turns();
};

describe.skipIf(wikiSkip)(`draft content comparison ignores envelope fields${skipNote}`, () => {
  test("an untouched cross-bag draft reads unmodified while content and title edits read modified", async () => {
    const boundary = new ManualBoundary();
    const r = await shoreRig({ boundary });
    const title = "lar:///t/draft-compare/cross-bag";
    const text = "unchanged target text";
    await seedCanon(r, title, text);
    await r.adaptor.armSeedCheckpoint();

    const draft = openDraft(r, title, text);
    await afterDispatch();
    boundary.fire();
    await turns(24);
    await r.adaptor.landingIdle();

    const draftFields = r.wiki.getTiddler(draft)!.fields;
    const targetFields = r.wiki.getTiddler(title)!.fields;
    expect(draftFields["$origin-bag"]).toBe(draftBag);
    expect(targetFields["$origin-bag"]).toBe(canonBag);
    // The navigator confirms only when this predicate reads true, so this direct assertion covers its cancel road.
    expect((r.engine.$tw.wiki as never as { isDraftModified(title: string): boolean }).isDraftModified(draft)).toBe(false);

    typeInto(r, draft, `${text}!`);
    expect((r.engine.$tw.wiki as never as { isDraftModified(title: string): boolean }).isDraftModified(draft)).toBe(true);
    typeInto(r, draft, text, { "draft.title": `${title}-renamed` });
    expect((r.engine.$tw.wiki as never as { isDraftModified(title: string): boolean }).isDraftModified(draft)).toBe(true);
    await r.stop();
  }, 120_000);
});
