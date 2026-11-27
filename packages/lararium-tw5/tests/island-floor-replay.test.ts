/**
 * island-floor-replay — the floor's rows REACH the island's wiki through its seed: the `@oracle` read-face answers its pinned rows
 * (and the live seed rows beneath them) to the composition's per-title read, and the island's seed (`readIslandSeed`) carries
 * each topmost record into the engine, as a preload. Before the floor reached the
 * seed, a wiki's landing and the house palette stood readable through the composite yet never reached the engine: the worker's
 * story fell back to GettingStarted.
 *
 * The second test composes the TREE's genesis floor (seed.json's floor witness, resolved from genesis/cas) under the lares
 * recipe: the one seam node and browser islands both run (`layIslandComposition` over `resolveFloor`).
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { layIslandComposition } from "../src/island-recipe.js";
import { readIslandSeed, type IslandSeed } from "../src/island-seed.js";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { GENESIS_FLOOR_TIDDLER, floorRecordsInOrder, resolveFloor } from "@lararium/mesh/floor-manifest";
import { ORACLE_BAG, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import type { TW5Engine } from "../src/tw5-vm.js";

function fakeTw5(): TW5Engine {
  return {
    $tw: {
      Tiddler: class { constructor(readonly fields: Record<string, unknown>) {} getFieldStrings() { return {}; } isEqual() { return false; } },
      rootWidget: { invokeActionsByTag: () => {} },
      wiki: { getTiddlerText: () => "", getTiddler: () => undefined, filterTiddlers: () => [], addEventListener: () => {}, removeEventListener: () => {}, transact: (fn: () => void) => fn() },
      lares: { applyNalu: () => {}, isApplyingNalu: () => false },
    },
  } as unknown as TW5Engine;
}

function fakeHandle(tiddlers: Record<string, LarTiddlerRecord> = {}): DocHandle<LarDoc> {
  const doc = { tiddlers } as unknown as LarDoc;
  return { url: "automerge:floor-replay-test", doc: () => doc, heads: () => [], view: () => ({ doc: () => doc }), on: () => {},
    change: (fn: (d: LarDoc) => void) => fn(doc) } as unknown as DocHandle<LarDoc>;
}

/** What the island's seed carries into the engine off the composition the recipe laid, by title. */
async function seeded(composite: CompositeStore): Promise<IslandSeed["stands"]> {
  const seed = await readIslandSeed(composite, []);
  seed.release();
  expect(seed.preloads.length).toBeGreaterThan(0);
  return seed.stands;
}

const FLOOR_TITLE = "lar:///ha.ka.ba/lares/docs/floor-only";
const SEED_TITLE = "lar:///ha.ka.ba/bags/oracle/seed-only";
const SHADOWED = "lar:///ha.ka.ba/lares/docs/both";

describe("the floor reaches the island through its seed", () => {
  test("the seed carries the floor's rows and the unshadowed seed rows once; a seed row the floor shadows arrives as the floor's; CONTROL: no floor rows, only the seed's", async () => {
    const composite = new CompositeStore();
    layIslandComposition({
      composite, recipe: { wikiSlug: "floor-replay" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle({
        [SEED_TITLE]: { tiddler: { title: SEED_TITLE, text: "seed" } },
        [SHADOWED]: { tiddler: { title: SHADOWED, text: "seed copy" } },
      }) }],
      floorRecords: [{
        [FLOOR_TITLE]: { tiddler: { title: FLOOR_TITLE, text: "floor", tags: ["$:/tags/lares/Landing"] } },
        [SHADOWED]: { tiddler: { title: SHADOWED, text: "floor copy" } },
      }],
    });
    const seen = await seeded(composite);
    expect(seen.get(FLOOR_TITLE)?.record?.tiddler.text).toBe("floor");
    expect(seen.get(FLOOR_TITLE)?.bag).toBe(ORACLE_BAG);
    expect(seen.get(SEED_TITLE)?.record?.tiddler.text).toBe("seed");
    expect(seen.get(SHADOWED)?.record?.tiddler.text).toBe("floor copy");

    const bare = new CompositeStore();
    layIslandComposition({ composite: bare, recipe: { wikiSlug: "floor-replay-control" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle({ [SEED_TITLE]: { tiddler: { title: SEED_TITLE, text: "seed" } } }) }] });
    const control = await seeded(bare);
    expect(control.has(FLOOR_TITLE)).toBe(false);
    expect(control.get(SEED_TITLE)?.record?.tiddler.text).toBe("seed");
  });

  test("the tree's genesis floor composes under the lares recipe: the welcome landing and the gruvbox palette slot reach the island", async () => {
    const root = fileURLToPath(new URL("../../../genesis/", import.meta.url));
    const seed = JSON.parse(readFileSync(`${root}seed.json`, "utf8")) as { tiddlers: Record<string, { tiddler: { cid?: string } }> };
    const floorCid = seed.tiddlers[GENESIS_FLOOR_TIDDLER]?.tiddler.cid;
    expect(typeof floorCid).toBe("string");
    const floor = await resolveFloor(floorCid!, async cid => { try { return new Uint8Array(readFileSync(`${root}cas/${cid}`)); } catch { return null; } });
    if ("refusal" in floor) throw new Error(`${floor.refusal}: ${floor.reason}`);
    const composite = new CompositeStore();
    layIslandComposition({ composite, recipe: { wikiSlug: "lares" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle() }, { slot: wikiSlotUri("lares", "working"), handle: fakeHandle() }],
      floorRecords: floorRecordsInOrder(floor) });
    const seen = await seeded(composite);
    const welcome = seen.get("lar:///ha.ka.ba/lares/docs/welcome")?.record?.tiddler;
    expect(welcome?.tags).toContain("$:/tags/lares/Landing");
    const palette = seen.get("lar:///ha.ka.ba/lararium/tw5/palette/gruvbox-dark#/palette")?.record?.tiddler;
    expect(palette?.type).toBe("application/x-tiddler-dictionary");
    expect(String(palette?.text)).toContain("#282828");
  });
});

describe("the composer hands the slots it skipped", () => {
  test("★ a recipe slot the composer bound nothing for stands unread beneath the working layer (a delete there raises a kāpae); an unbound instance slot holds nothing; CONTROL: every slot bound, nothing unread ★", () => {
    const slug = "skipped-slots";
    const realm = "lar:///ha.ka.ba/bags/realm-r";
    const lares = "lar:///ha.ka.ba/bags/lares";
    const working = wikiSlotUri(slug, "working");
    const recipe = { wikiSlug: slug, canonBag: realm, libraryBags: [lares] } as never;
    const own = `lar:///ha.ka.ba/bags/${slug}`;
    const skipped = new CompositeStore();
    layIslandComposition({ composite: skipped, recipe,
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle() }, { slot: working, handle: fakeHandle() }, { slot: lares, handle: fakeHandle() }, { slot: own, handle: fakeHandle() }] as never });
    expect(skipped.unknownBeneath(working), "the realm canon this face does not reach stands unread beneath").toBe(true);
    expect(skipped.unknownBeneath(lares), "nothing unread beneath the library").toBe(false);

    const whole = new CompositeStore();
    layIslandComposition({ composite: whole, recipe,
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle() }, { slot: working, handle: fakeHandle() }, { slot: realm, handle: fakeHandle() },
        { slot: lares, handle: fakeHandle() }, { slot: own, handle: fakeHandle() }] as never });
    expect(whole.unknownBeneath(working), "every slot bound (draft and personal unminted): nothing unread").toBe(false);
  });
});
