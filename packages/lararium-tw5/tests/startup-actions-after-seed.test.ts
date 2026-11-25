/**
 * startup-actions-after-seed — the island runs a StartupAction from the floor alone (state/decisions, "Native TW5 wikis").
 * The engine's own startup pass ran the floor-admitted plugins' actions over the preloads; after the seed drains, a floor
 * plugin's shadow the boot pass never saw (a house seed laid after boot) runs once, and a record the wiki's document landed
 * rides inert on every wiki: it runs in the tab alone.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
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
const FLOOR = "$:/temp/lararium/startup-floor";

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

  test("an action the boot pass already ran never runs again after the seed, and a seeded one never runs on the island", async () => {
    const PRELOAD_COUNT = "$:/temp/lararium/startup-preload-count";
    engine = await bootTestWiki({ extraPlugins: [], tiddlers: [] });
    // A preload-borne action: it ran once at TW5's own startup pass. The vector plants it before the seed as a
    // plain tiddler the boot pass would have run, then counts.
    const wiki = engine.$tw.wiki;
    engine.setTiddler({ title: PRELOAD_COUNT, text: "1" });
    engine.setTiddler({ title: "lar:///t/startup/preloaded", tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${PRELOAD_COUNT}" text={{{ [{${PRELOAD_COUNT}}add[1]] }}}/>` });
    const slug = "startup-once";
    const working = wikiSlotUri(slug, "working");
    const records: LarTiddlerRecord[] = [
      { tiddler: { title: "lar:///t/startup/seeded", tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${PROBE}" text="seeded"/>` } },
    ];
    const composite = new CompositeStore();
    buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: working, handle: handleOver(records) }] });
    await seedDrained(engine);
    expect(wiki.getTiddler("lar:///t/startup/seeded"), "the seed landed").toBeDefined();
    expect(wiki.getTiddler(PROBE), "a seeded action rides inert on the island").toBeUndefined();
    expect(wiki.getTiddler(PRELOAD_COUNT)?.fields["text"], "the preload-borne action ran no second time").toBe("1");
  }, 120_000);

  test("a seeded StartupAction rides inert once the seed drains; CONTROL: a floor plugin's shadow the boot pass never saw runs once", async () => {
    engine = await bootTestWiki();
    const slug = "startup-road";
    const working = wikiSlotUri(slug, "working");
    const records: LarTiddlerRecord[] = [
      { tiddler: { title: "lar:///t/startup/act", tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${PROBE}" text="ran"/>` } },
      { tiddler: { title: "lar:///t/startup/untagged", text: `<$action-setfield $tiddler="${CONTROL}" text="ran"/>` } },
    ];
    const composite = new CompositeStore();
    buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: working, handle: handleOver(records) }] });
    // A house seed laid as shadows after boot (the daemon UI's road): the floor, never the wiki's document.
    engine.setShadowTiddlers("$:/temp/lararium/test-floor-seed", [{ title: "lar:///t/startup/floor", tags: "$:/tags/StartupAction", text: `<$action-setfield $tiddler="${FLOOR}" text="ran"/>` }]);
    await seedDrained(engine);
    const wiki = engine.$tw.wiki;
    expect(wiki.getTiddler("lar:///t/startup/act"), "the seed landed").toBeDefined();
    expect(wiki.getTiddler(PROBE), "the seeded action rides inert").toBeUndefined();
    expect(wiki.getTiddler(CONTROL)).toBeUndefined();
    expect(wiki.getTiddler(FLOOR)?.fields["text"], "the floor plugin's shadow ran").toBe("ran");
  }, 120_000);

  test("a StartupAction lifted from the kahua stage (it carries `kahua-cid`) stays inert after the seed drains, as the same action without the mark does", async () => {
    engine = await bootTestWiki();
    const slug = "startup-lifted";
    const working = wikiSlotUri(slug, "working");
    const LIFTED = "$:/temp/lararium/startup-lifted", PLAIN = "$:/temp/lararium/startup-plain";
    const records: LarTiddlerRecord[] = [
      { tiddler: { title: "lar:///t/startup/lifted", tags: ["$:/tags/StartupAction"], "kahua-cid": "c".repeat(64), text: `<$action-setfield $tiddler="${LIFTED}" text="ran"/>` } },
      { tiddler: { title: "lar:///t/startup/plain", tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${PLAIN}" text="ran"/>` } },
    ];
    const composite = new CompositeStore();
    buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: working, handle: handleOver(records) }] });
    await seedDrained(engine);
    const wiki = engine.$tw.wiki;
    expect(wiki.getTiddler("lar:///t/startup/lifted"), "the lifted action landed as data").toBeDefined();
    expect(wiki.getTiddler(PLAIN), "a plain seeded action rides inert too").toBeUndefined();
    expect(wiki.getTiddler(LIFTED), "a lifted action never runs without a promotion").toBeUndefined();
  }, 120_000);

  // THE LAYER GATE: the daemon island and the kahua stage run a StartupAction from the boot pass alone (genesis or the promoted
  // set, each a preload); the seed pass runs none there, not even a floor shadow laid after boot. A user's own wiki runs that
  // floor shadow, and rides every working-layer record inert as the daemon does.
  for (const slug of ["daemon", "kahua-q7k2m9x4"]) {
    test(`the ${slug} island runs a genesis StartupAction and a promoted one once, and leaves a working-layer one and a late floor shadow inert; CONTROL: a user wiki runs the late floor shadow and leaves the working-layer action inert`, async () => {
      const WORKING = "$:/temp/lararium/gate-working", FIELDED = "$:/temp/lararium/gate-fielded", GENESIS = "$:/temp/lararium/gate-genesis", PROMOTED = "$:/temp/lararium/gate-promoted";
      const act = (probe: string): string => `<$action-setfield $tiddler="${probe}" text={{{ [{${probe}}else[0]add[1]] }}}/>`;
      engine = await bootTestWiki();
      // Genesis and a promoted rite are PRELOADS: TW5's own startup pass ran each once before any record landed (this test engine runs no
      // StartupAction at boot, so the vector plants the post-boot state: each probe already reads 1). The seed pass must leave them be.
      for (const [probe, title] of [[GENESIS, "lar:///t/gate/genesis"], [PROMOTED, "lar:///t/gate/promoted"]] as const) {
        engine.setTiddler({ title: probe, text: "1" });
        engine.setTiddler({ title, tags: ["$:/tags/StartupAction"], text: act(probe) });
      }
      const working = wikiSlotUri(slug, "working");
      const workingRecords: LarTiddlerRecord[] = [
        { tiddler: { title: "lar:///t/gate/working", tags: ["$:/tags/StartupAction"], text: act(WORKING) } },
        { tiddler: { title: "lar:///t/gate/fielded", tags: ["$:/tags/StartupAction"], "kahua-cid": "d".repeat(64), text: act(FIELDED) } },
      ];
      const LATE = "$:/temp/lararium/gate-late";
      const late = [{ title: "lar:///t/gate/late", tags: "$:/tags/StartupAction", text: act(LATE) }];
      const composite = new CompositeStore();
      buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: working, handle: handleOver(workingRecords) }] });
      engine.setShadowTiddlers("$:/temp/lararium/test-late-floor", late);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try { await seedDrained(engine); } finally { warn.mockRestore(); }
      const wiki = engine.$tw.wiki;
      expect(wiki.getTiddler("lar:///t/gate/working"), "the working-layer action landed as data").toBeDefined();
      expect(wiki.getTiddler(GENESIS)?.fields["text"], "the seed pass never re-runs the genesis rite").toBe("1");
      expect(wiki.getTiddler(PROMOTED)?.fields["text"], "nor the promoted one").toBe("1");
      expect(wiki.getTiddler(WORKING), "a working-layer action stays inert").toBeUndefined();
      expect(wiki.getTiddler(FIELDED), "a working-layer action with kahua-cid stays inert").toBeUndefined();
      expect(wiki.getTiddler(LATE), "a floor shadow laid after boot stays inert here").toBeUndefined();

      // CONTROL: a user's own wiki runs the late floor shadow once, and leaves the working-layer action inert.
      const user = await bootTestWiki();
      try {
        const userWorking = wikiSlotUri("user-wiki", "working");
        buildIslandRecipe({ tw5: user, composite: new CompositeStore(), recipe: { wikiSlug: "user-wiki" }, ready: [{ slot: userWorking, handle: handleOver(workingRecords.slice(0, 1)) }] });
        user.setShadowTiddlers("$:/temp/lararium/test-late-floor", late);
        await seedDrained(user);
        expect(user.$tw.wiki.getTiddler(LATE)?.fields["text"], "the floor shadow runs on a user wiki").toBe("1");
        expect(user.$tw.wiki.getTiddler(WORKING), "a working-layer action rides inert on a user wiki too").toBeUndefined();
      } finally { user.dispose(); }
    }, 120_000);
  }
});
