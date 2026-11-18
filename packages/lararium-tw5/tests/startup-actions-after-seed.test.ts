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

  test("an action the boot pass already ran never runs again after the seed; CONTROL: a seeded one runs once", async () => {
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
    expect(wiki.getTiddler(PROBE)?.fields["text"]).toBe("seeded");
    expect(wiki.getTiddler(PRELOAD_COUNT)?.fields["text"], "the preload-borne action ran no second time").toBe("1");
  }, 120_000);

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

  test("RED: a StartupAction lifted from the kahua stage (it carries `kahua-cid`) stays inert after the seed drains; CONTROL: the same action without the mark runs", async () => {
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
    expect(wiki.getTiddler(PLAIN)?.fields["text"], "a plain seeded action runs").toBe("ran");
    expect(wiki.getTiddler(LIFTED), "a lifted action never runs without a promotion").toBeUndefined();
  }, 120_000);

  // THE LAYER GATE (operator ruling 2026-11-04): the daemon island and the kahua stage run a StartupAction only from genesis (the
  // oracle floor) or the promoted set (a preload, which TW5's own boot pass ran); every other layer's StartupAction rides inert. A
  // user's own wiki keeps full caps: its StartupActions run as before.
  for (const slug of ["daemon", "kahua-q7k2m9x4"]) {
    test(`RED: the ${slug} island runs a genesis StartupAction and a promoted one once, and leaves a working-layer one inert with or without kahua-cid; CONTROL: a user wiki runs the same working-layer action`, async () => {
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
      const composite = new CompositeStore();
      buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: working, handle: handleOver(workingRecords) }] });
      await seedDrained(engine);
      const wiki = engine.$tw.wiki;
      expect(wiki.getTiddler("lar:///t/gate/working"), "the working-layer action landed as data").toBeDefined();
      expect(wiki.getTiddler(GENESIS)?.fields["text"], "the seed pass never re-runs the genesis rite").toBe("1");
      expect(wiki.getTiddler(PROMOTED)?.fields["text"], "nor the promoted one").toBe("1");
      expect(wiki.getTiddler(WORKING), "a working-layer action stays inert").toBeUndefined();
      expect(wiki.getTiddler(FIELDED), "a working-layer action with kahua-cid stays inert").toBeUndefined();

      // CONTROL: the same working-layer action over a user's own wiki runs.
      const user = await bootTestWiki();
      try {
        const userWorking = wikiSlotUri("user-wiki", "working");
        buildIslandRecipe({ tw5: user, composite: new CompositeStore(), recipe: { wikiSlug: "user-wiki" }, ready: [{ slot: userWorking, handle: handleOver(workingRecords.slice(0, 1)) }] });
        await seedDrained(user);
        expect(user.$tw.wiki.getTiddler(WORKING)?.fields["text"], "a user wiki keeps full caps").toBe("1");
      } finally { user.dispose(); }
    }, 120_000);
  }
});
