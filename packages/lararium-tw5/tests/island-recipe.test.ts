/**
 * island-recipe.test.ts — the working-layer seed gate.
 *
 * buildIslandRecipe points config/current-wiki-bag at the wiki's working layer
 * when its binding stands. A mount without that document has no default writable,
 * seeds an empty pointer, and refuses a save until the binding attaches.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/wiki-layer-ontology#/shore-law
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { routeBag, type CascadeWiki } from "../src/bag-cascade.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { IslandAdaptor, UnroutedSaveRefusal } from "../src/island-adaptor.js";
import { HandGate } from "../src/hand-gate.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { CompositeStore, wikiSlotUri, wikiBagUri } from "@lararium/mesh";
import type { LarDoc, DocHandle, LarTiddlerRecord, SlotUri } from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";

const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/** Minimal TW5 engine — buildIslandRecipe only constructs an adaptor + flushes. */
function fakeTw5(): TW5Engine {
  class FakeTiddler {
    constructor(readonly fields: Record<string, unknown>) {}
    getFieldStrings(): Record<string, string> { return Object.fromEntries(Object.entries(this.fields).map(([key, value]) => [key, String(value)])); }
    isEqual(other: unknown, exclude: string[] = []): boolean {
      const fields = (other as FakeTiddler | null)?.fields;
      if (!fields) return false;
      const keys = new Set([...Object.keys(this.fields), ...Object.keys(fields)]);
      return [...keys].filter((key) => !exclude.includes(key)).every((key) => this.fields[key] === fields[key]);
    }
  }
  return {
    $tw: {
      Tiddler: FakeTiddler,
      // The seed checkpoint re-invokes the wiki's startup actions over the resident seed; a fake engine holds
      // a root widget with none.
      rootWidget: { invokeActionsByTag: () => {} },
      wiki: {
        getTiddlerText:      () => "",
        getTiddler:          () => undefined,
        filterTiddlers:      () => [],
        addEventListener:    () => {},
        removeEventListener: () => {},
        transact:            (fn: () => void) => fn(),
      },
      lares: {
        applyNalu:      () => {},
        isApplyingNalu: () => false,
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
    heads:  () => [],
    view:   () => ({ doc: () => doc }),
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

  test("no working binding leaves the pointer empty and refuses saves", async () => {
    const composite = new CompositeStore();
    const tw5 = fakeTw5();
    const alerts: unknown[] = [];
    const wiki = tw5.$tw.wiki as unknown as {
      addTiddler(tiddler: unknown): void;
      getTiddlerText(title: string, fallback?: string): string | undefined;
    };
    wiki.addTiddler = (tiddler) => alerts.push(tiddler);
    const { stores } = buildIslandRecipe({
      tw5,
      composite,
      recipe: { wikiSlug: "daemon" },
      ready: [{ slot: wikiBagUri("daemon"), handle: fakeHandle() }],
    });
    expect(await currentWikiBag("daemon", stores)).toBe("");
    expect(composite.defaultWritableBagId()).toBeNull();
    const adaptor = new IslandAdaptor(tw5, composite, "daemon");
    await expect(adaptor.saveTiddler({ fields: { title: "lar:///before-attach", text: "held" } }))
      .rejects.toBeInstanceOf(UnroutedSaveRefusal);
    expect((alerts[0] as { fields?: { "alert-kind"?: string } } | undefined)?.fields?.["alert-kind"]).toBe("unrouted-save");

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
    await seedDrained(engine);
    const wiki = engine.$tw.wiki as never as CascadeWiki;
    const pointer = (name: string): string | undefined => wiki.getTiddlerText!(`lar:///ha.ka.ba/lararium/config/current-wiki-${name}`, "");
    expect(pointer("bag"), "the write-layer pointer never reached the wiki").toBe(workingSlot);
    expect(pointer("temp")).toBe(wikiSlotUri(slug, "temp"));
    expect(pointer("draft")).toBe(wikiSlotUri(slug, "draft"));
    expect(pointer("personal")).toBe(wikiSlotUri(slug, "personal"));
    // The one walk every save takes answers a slot for a meme title, a draft and a volatile title.
    expect(routeBag(wiki, "lar:///t/recipe/lady-aki")).toMatchObject({ kind: "slot", uri: workingSlot });
    expect(routeBag(wiki, "$:/temp/recipe/scratch")).toMatchObject({ kind: "slot", uri: wikiSlotUri(slug, "temp") });
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
    await seedDrained(engine);
    const wiki = engine.$tw.wiki as never as CascadeWiki & { addTiddler(t: unknown): void };
    expect(wiki.getTiddlerText!(SEEDED, ""), "the canon seed never reached the wiki").toBe("canon holds this");
    await new Promise((r) => setTimeout(r, HandGate.TRAILING_MS + 150));
    const held = (h: DocHandle<LarDoc>): string[] => Object.keys((h.doc() as unknown as { tiddlers: Record<string, unknown> }).tiddlers);
    expect(held(working), "the seed wave echoed into the working layer").toEqual([]);
    expect(held(canon)).toEqual([SEEDED]);
    // CONTROL — a hand edit after the drain does leave, into the working layer the pointer names.
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    wiki.addTiddler(new Tiddler({ title: "lar:///t/recipe/hand-edit", text: "typed" }));
    await new Promise((r) => setTimeout(r, HandGate.TRAILING_MS + 150));
    expect(held(working)).toEqual(["lar:///t/recipe/hand-edit"]);
    stop();
  }, 120_000);
});

/**
 * NOTHING LEAVES BEFORE THE SEED IS RESIDENT. Between the engine's boot and the shore's seed checkpoint the
 * wiki holds the engine's own startup state: TiddlyWiki writes a default `$:/StoryList` and `$:/HistoryList`
 * there. Those are no hand's edits. Carried out, the default story would land over the person's stored one
 * before the seed brings it in; routed before the pointers arrive, it would refuse for want of a bag.
 */
describe.skipIf(wikiSkip)(`the outbound bridge holds until the seed stands${skipNote}`, () => {
  test("a change raised before the checkpoint leaves nothing and raises no refusal; the same title edited after it lands", async () => {
    const engine = await bootTestWiki();
    const slug = "resident";
    const personalSlot = wikiSlotUri(slug, "personal");
    const personal = fakeHandle();
    const { adaptor } = buildIslandRecipe({
      tw5: engine,
      composite: new CompositeStore(),
      recipe: { wikiSlug: slug },
      ready: [{ slot: wikiBagUri(slug), handle: fakeHandle() }, { slot: personalSlot, handle: personal }],
    });
    const stop = bridgeWikiToAdaptor(engine, adaptor);
    const wiki = engine.$tw.wiki as never as CascadeWiki & { addTiddler(t: unknown): void; filterTiddlers(f: string): string[] };
    const Tiddler = (engine.$tw as never as { Tiddler: new (f: unknown) => unknown }).Tiddler;
    const held = (h: DocHandle<LarDoc>): Record<string, { tiddler?: { list?: unknown } }> => (h.doc() as unknown as { tiddlers: Record<string, { tiddler?: { list?: unknown } }> }).tiddlers;
    // The engine's own startup write, standing in the wiki ahead of the paced seed.
    wiki.addTiddler(new Tiddler({ title: "$:/StoryList", list: "GettingStarted" }));
    await seedDrained(engine);
    await new Promise((r) => setTimeout(r, HandGate.TRAILING_MS + 150));
    expect(Object.keys(held(personal)), "the engine's startup story left for the personal layer").toEqual([]);
    expect(wiki.filterTiddlers("[all[tiddlers]tag[$:/tags/Alert]field:alert-kind[unrouted-save]]"), "a startup write raised a refusal").toEqual([]);
    // CONTROL — the wiki stands resident; a person opening a tiddler moves the story, and that leaves.
    wiki.addTiddler(new Tiddler({ title: "$:/StoryList", list: "GettingStarted [[Lady Aki]]" }));
    await new Promise((r) => setTimeout(r, HandGate.TRAILING_MS + 150));
    expect(Object.keys(held(personal))).toEqual(["$:/StoryList"]);
    stop();
  }, 120_000);
});

/**
 * THE HYDRATION CHECKPOINT — behavior arms over a RESIDENT seed. The seed wave drains on the paced rail,
 * so the kernel awaits `seedDrained(tw5)` between the recipe and `behavior.onEa`. A behavior that ran
 * ahead of the drain would write into a wiki whose slot pointers had not arrived, and each such write
 * would refuse for want of a bag.
 */
describe.skipIf(wikiSkip)(`seedDrained — the checkpoint the kernel awaits before behavior${skipNote}`, () => {
  test("resolves once the paced seed wave stands in the wiki: corpus and pointers, with no flush called", async () => {
    const engine = await bootTestWiki();
    const slug = "checkpoint";
    const SEEDED = "lar:///t/recipe/resident-before-behavior";
    const canon = fakeHandle();
    const working = fakeHandle();
    (canon.doc() as unknown as { tiddlers: Record<string, unknown> }).tiddlers[SEEDED] = { tiddler: { title: SEEDED, text: "resident" } };
    buildIslandRecipe({
      tw5: engine,
      composite: new CompositeStore(),
      recipe: { wikiSlug: slug },
      ready: [
        { slot: wikiBagUri(slug), handle: canon },
        { slot: wikiSlotUri(slug, "working"), handle: working },
      ],
    });
    const wiki = engine.$tw.wiki as never as CascadeWiki;
    // CONTROL — the rail is paced: straight after the recipe returns, the wiki holds neither.
    expect(wiki.getTiddlerText!(SEEDED, "")).toBe("");
    await seedDrained(engine);
    expect(wiki.getTiddlerText!(SEEDED, ""), "the checkpoint resolved over a wiki the seed had not reached").toBe("resident");
    expect(wiki.getTiddlerText!(CURRENT_WIKI_BAG, "")).toBe(wikiSlotUri(slug, "working"));
  }, 120_000);

  test("★ the kernel awaits `seedDrained(tw5)` after the recipe and before `behavior.onEa` ★", () => {
    const src = readFileSync(new URL("../src/sovereign-kernel.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const recipe = src.indexOf("buildIslandRecipe({");
    const drained = src.indexOf("await seedDrained(tw5)");
    const behavior = src.indexOf("await behavior.onEa(");
    expect(recipe, "the kernel builds no recipe").toBeGreaterThan(-1);
    expect(drained, "the kernel never awaits the shore's seed checkpoint").toBeGreaterThan(recipe);
    expect(behavior, "behavior arms ahead of the shore's seed checkpoint").toBeGreaterThan(drained);
  });
});
