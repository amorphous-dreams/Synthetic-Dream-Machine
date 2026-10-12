/**
 * island-recipe.test.ts — the write-layer seed gate (working/canon split).
 *
 * buildIslandRecipe points config/current-wiki-bag at the wiki's LIVE write
 * layer. An operator content wiki (a working grant resolved) routes live edits
 * to working; a grant-less mount — the administrative daemon bag, a control
 * plane with no working/canon split — falls back to its OWN bag, keeping a
 * writable default path instead of throwing on the first cascade-routed edit
 * (the gate fix; the grant→layer→seed chain the adaptor flip witness skips).
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/wiki-layer-ontology#/shore-law
 */

import { describe, test, expect } from "vitest";
import { buildIslandRecipe } from "../src/island-recipe.js";
import { routeBag, type CascadeWiki } from "../src/bag-cascade.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { IslandAdaptor } from "../src/island-adaptor.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { CompositeStore, wikiSlotUri, wikiBagUri } from "@lararium/mesh";
import type { LarDoc, DocHandle, LarTiddlerRecord, SlotUri } from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";

const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/** Minimal TW5 engine — buildIslandRecipe only constructs an adaptor + flushes. */
function fakeTw5(): TW5Engine {
  return {
    $tw: {
      wiki: {
        getTiddlerText:      () => "",
        getTiddler:          () => undefined,
        filterTiddlers:      () => [],
        addEventListener:    () => {},
        removeEventListener: () => {},
        transact:            (fn: () => void) => fn(),
      },
      lares: {
        enqueueNalu:    () => {},
        flushNalu:      () => {},
        isApplyingNalu: () => false,
        naluPending:    () => 0,
      },
    },
  } as unknown as TW5Engine;
}

/** Minimal Automerge handle — enough for AutomergeDocStore (doc/on/change). */
function fakeHandle(): DocHandle<LarDoc> {
  const doc = { tiddlers: {} } as unknown as LarDoc;
  return {
    url:    "automerge:fake-working",
    doc:    () => doc,
    on:     () => {},
    change: (fn: (d: LarDoc) => void) => fn(doc),
  } as unknown as DocHandle<LarDoc>;
}

async function currentWikiBag(
  slug: string,
  stores: ReadonlyArray<{ slot: SlotUri; store: { get(t: string): Promise<LarTiddlerRecord | null> } }>,
): Promise<string | undefined> {
  const temp = stores.find((s) => s.slot === wikiSlotUri(slug, "temp"))?.store;
  const rec  = temp ? await temp.get(CURRENT_WIKI_BAG) : null;
  return rec?.tiddler.text as string | undefined;
}

describe("buildIslandRecipe — the write-layer seed gate", () => {
  test("a working grant present → live edits route to the working layer (operator content wiki)", async () => {
    const composite = new CompositeStore();
    const workingSlot = wikiSlotUri("myproject", "working");
    const { stores } = buildIslandRecipe({
      tw5: fakeTw5(),
      composite,
      recipe: { wikiSlug: "myproject" },
      ready: [{ slot: workingSlot, handle: fakeHandle() }],
    });
    expect(await currentWikiBag("myproject", stores)).toBe(workingSlot);
  });

  test("no working grant (the daemon bag itself) → falls back to its OWN bag, never throws", async () => {
    const composite = new CompositeStore();
    const { stores } = buildIslandRecipe({
      tw5: fakeTw5(),
      composite,
      recipe: { wikiSlug: "daemon" },
      ready: [],
    });
    // The control-plane daemon keeps its own bag as the default write path.
    expect(await currentWikiBag("daemon", stores)).toBe(wikiBagUri("daemon"));
  });
});

/**
 * THE POINTERS STAND IN THE WIKI, where the cascade dereferences them. `then{config/current-wiki-bag}`
 * is a text reference the filter engine resolves against `$tw.wiki`; a pointer resting in the temp
 * store alone routes nothing, and every save then refuses for want of a bag. Driven over the REAL
 * engine and the REAL cascade, so the read is the one a hand edit takes.
 */
describe.skipIf(wikiSkip)(`buildIslandRecipe — the slot pointers reach the wiki the cascade reads${skipNote}`, () => {
  test("after the seed drains, the wiki holds all four pointers and the shipped cascade routes by them", async () => {
    const engine = await bootTestWiki();
    const slug = "myproject";
    const workingSlot = wikiSlotUri(slug, "working");
    buildIslandRecipe({
      tw5: engine,
      composite: new CompositeStore(),
      recipe: { wikiSlug: slug },
      ready: [{ slot: workingSlot, handle: fakeHandle() }],
    });
    const lares = (engine.$tw as never as { lares: { flushNalu(): void } }).lares;
    lares.flushNalu();
    const wiki = engine.$tw.wiki as never as CascadeWiki;
    const pointer = (name: string): string | undefined => wiki.getTiddlerText!(`lar:///ha.ka.ba/lararium/config/current-wiki-${name}`, "");
    expect(pointer("bag"), "the write-layer pointer never reached the wiki").toBe(workingSlot);
    expect(pointer("temp")).toBe(wikiSlotUri(slug, "temp"));
    expect(pointer("draft")).toBe(wikiSlotUri(slug, "draft"));
    expect(pointer("personal")).toBe(wikiSlotUri(slug, "personal"));
    // The one walk every save takes answers a slot for a meme title, a draft and a volatile title.
    expect(routeBag(wiki, "lar:///t/recipe/lady-aki")).toEqual({ kind: "slot", uri: workingSlot });
    expect(routeBag(wiki, "$:/temp/recipe/scratch")).toEqual({ kind: "slot", uri: wikiSlotUri(slug, "temp") });
  }, 120_000);

  /**
   * THE SEED WAVE LEAVES NOTHING. With the pointers standing, every title the cascade reads routes — so a
   * seed title that left again through the outbound bridge would copy the canon into the working layer at
   * each boot, and the pointers themselves (`lar:` titles) into a document peers read. Stood in the
   * kernel's own order: the recipe, then the bridge, then the drain.
   */
  test("the seed wave (corpus and pointers) drains into the wiki and writes nothing back to any layer", async () => {
    const engine = await bootTestWiki();
    const slug = "seedwave";
    const canonSlot = wikiBagUri(slug);
    const workingSlot = wikiSlotUri(slug, "working");
    const SEEDED = "lar:///t/recipe/seeded-in-canon";
    const canon = fakeHandle();
    (canon.doc() as unknown as { tiddlers: Record<string, unknown> }).tiddlers[SEEDED] = { tiddler: { title: SEEDED, text: "canon holds this" } };
    const working = fakeHandle();
    const { adaptor } = buildIslandRecipe({
      tw5: engine,
      composite: new CompositeStore(),
      recipe: { wikiSlug: slug },
      ready: [{ slot: canonSlot, handle: canon }, { slot: workingSlot, handle: working }],
    });
    const stop = bridgeWikiToAdaptor(engine, adaptor);
    (engine.$tw as never as { lares: { flushNalu(): void } }).lares.flushNalu();
    const wiki = engine.$tw.wiki as never as CascadeWiki & { addTiddler(t: unknown): void };
    expect(wiki.getTiddlerText!(SEEDED, ""), "the canon seed never reached the wiki").toBe("canon holds this");
    await new Promise((r) => setTimeout(r, IslandAdaptor.DEBOUNCE_MS + 150));
    const held = (h: DocHandle<LarDoc>): string[] => Object.keys((h.doc() as unknown as { tiddlers: Record<string, unknown> }).tiddlers);
    expect(held(working), "the seed wave echoed into the working layer").toEqual([]);
    expect(held(canon)).toEqual([SEEDED]);
    // CONTROL — a hand edit after the drain does leave, into the working layer the pointer names.
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    wiki.addTiddler(new Tiddler({ title: "lar:///t/recipe/hand-edit", text: "typed" }));
    await new Promise((r) => setTimeout(r, IslandAdaptor.DEBOUNCE_MS + 150));
    expect(held(working)).toEqual(["lar:///t/recipe/hand-edit"]);
    stop();
  }, 120_000);
});
