/**
 * startup-actions-after-seed — a tiddler tagged `$:/tags/StartupAction` that arrives with the seed runs once
 * the seed drains, so a bag's own startup actions take effect on an island whose records land after the
 * engine's own startup pass ran over the preloads alone.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CompositeStore, emptyLarDoc, wikiSlotUri, type DocHandle, type LarDoc, type LarTiddlerRecord } from "@lararium/mesh";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const PROBE = "$:/temp/lararium/startup-probe";
const CONTROL = "$:/temp/lararium/startup-control";

function handleOver(records: readonly LarTiddlerRecord[]): DocHandle<LarDoc> {
  const doc = emptyLarDoc();
  for (const r of records) (doc.tiddlers as Record<string, LarTiddlerRecord>)[r.tiddler.title] = r;
  return {
    url: "automerge:startup-seed",
    doc: () => doc,
    heads: () => [],
    view: () => ({ doc: () => doc }),
    on: () => {},
    change: (fn: (d: LarDoc) => void) => fn(doc),
  } as unknown as DocHandle<LarDoc>;
}

describe.skipIf(wikiSkip)(`startup actions after the seed drains${skipNote}`, () => {
  let engine: TW5Engine | undefined;
  afterEach(() => { engine?.dispose(); engine = undefined; });

  test("RED: a seeded StartupAction runs once the seed drains; CONTROL: the same action without the tag never runs", async () => {
    engine = await bootTestWiki();
    const slug = "startup-road";
    const working = wikiSlotUri(slug, "working");
    const records: LarTiddlerRecord[] = [
      { tiddler: { title: "lar:///t/startup/act", tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${PROBE}" text="ran"/>` } },
      { tiddler: { title: "lar:///t/startup/untagged", text: `<$action-setfield $tiddler="${CONTROL}" text="ran"/>` } },
    ];
    const composite = new CompositeStore();
    buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: working, handle: handleOver(records) }] });
    await seedDrained(engine);
    const wiki = engine.$tw.wiki;
    expect(wiki.getTiddler("lar:///t/startup/act"), "the seed landed").toBeDefined();
    expect(wiki.getTiddler(PROBE)?.fields["text"]).toBe("ran");
    expect(wiki.getTiddler(CONTROL)).toBeUndefined();
  }, 120_000);
});
