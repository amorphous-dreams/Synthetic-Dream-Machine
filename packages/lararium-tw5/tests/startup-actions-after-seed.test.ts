/**
 * startup-actions-after-seed — the island runs startup actions as TiddlyWiki runs them. TW5's own startup pass ran every
 * `$:/tags/StartupAction` the boot store held; a startup record that reached the wiki after boot (landed by the seed's waves, or a
 * floor plugin's shadow laid after boot) runs once the seed stands, on every island, the daemon's and a kahua stage's included.
 * One the boot pass already ran never runs twice.
 */
import { afterEach, describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
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

  const act = (probe: string): string => `<$action-setfield $tiddler="${probe}" text={{{ [{${probe}}else[0]add[1]] }}}/>`;

  test("an action the boot pass already ran never runs again after the seed; CONTROL: a seeded one runs once", async () => {
    const PRELOAD_COUNT = "$:/temp/lararium/startup-preload-count";
    engine = await bootTestWiki();
    // A preload-borne action ran once at TW5's own startup pass: the vector plants that post-boot state, then counts.
    const wiki = engine.$tw.wiki;
    engine.setTiddler({ title: PRELOAD_COUNT, text: "1" });
    engine.setTiddler({ title: "lar:///t/startup/preloaded", tags: ["$:/tags/StartupAction"], text: act(PRELOAD_COUNT) });
    const slug = "startup-once";
    const records: LarTiddlerRecord[] = [{ tiddler: { title: "lar:///t/startup/seeded", tags: ["$:/tags/StartupAction"], text: act(PROBE) } }];
    buildIslandRecipe({ tw5: engine, composite: new CompositeStore(), recipe: { wikiSlug: slug }, ready: [{ slot: wikiSlotUri(slug, "working"), handle: handleOver(records) }] });
    await seedDrained(engine);
    expect(wiki.getTiddler(PRELOAD_COUNT)?.fields["text"], "the preload-borne action ran no second time").toBe("1");
    expect(wiki.getTiddler(PROBE)?.fields["text"], "the seeded action ran once").toBe("1");
  }, 120_000);

  for (const slug of ["daemon", "kahua-q7k2m9x4", "user-wiki"]) {
    test(`the ${slug} island runs a landed StartupAction (one carrying \`kahua-cid\` too) and a floor shadow laid after boot, each once; an untagged record runs nothing`, async () => {
      const WORKING = "$:/temp/lararium/gate-working", FIELDED = "$:/temp/lararium/gate-fielded", LATE = "$:/temp/lararium/gate-late";
      engine = await bootTestWiki();
      const records: LarTiddlerRecord[] = [
        { tiddler: { title: "lar:///t/gate/working", tags: ["$:/tags/StartupAction"], text: act(WORKING) } },
        { tiddler: { title: "lar:///t/gate/fielded", tags: ["$:/tags/StartupAction"], "kahua-cid": "d".repeat(64), text: act(FIELDED) } },
        { tiddler: { title: "lar:///t/gate/untagged", text: act(CONTROL) } },
      ];
      buildIslandRecipe({ tw5: engine, composite: new CompositeStore(), recipe: { wikiSlug: slug }, ready: [{ slot: wikiSlotUri(slug, "working"), handle: handleOver(records) }] });
      engine.setShadowTiddlers("$:/temp/lararium/test-late-floor", [{ title: "lar:///t/gate/late", tags: "$:/tags/StartupAction", text: act(LATE) }]);
      await seedDrained(engine);
      const wiki = engine.$tw.wiki;
      expect(wiki.getTiddler(WORKING)?.fields["text"], "the landed action ran once").toBe("1");
      expect(wiki.getTiddler(FIELDED)?.fields["text"], "the lifted action ran once").toBe("1");
      expect(wiki.getTiddler(LATE)?.fields["text"], "the late floor shadow ran once").toBe("1");
      expect(wiki.getTiddler(CONTROL), "an untagged record runs nothing").toBeUndefined();
    }, 120_000);
  }
});
