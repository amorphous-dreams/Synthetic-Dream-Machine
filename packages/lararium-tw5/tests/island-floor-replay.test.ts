/**
 * island-floor-replay — the floor's rows REACH the island's wiki: the `@oracle` read-face replays its pinned rows (and the
 * live seed rows beneath them) to every projection the recipe fans, as each doc slot replays its own. Before this, a projection
 * (the island adaptor that lands records in TW5) heard nothing from the floor, so a wiki's landing and the house palette stood
 * readable through the composite yet never reached the engine: the worker's story fell back to GettingStarted.
 *
 * The second test composes the TREE's genesis floor (seed.json's floor witness, resolved from genesis/cas) under the lares
 * recipe: the one seam node and browser islands both run (`buildIslandRecipe` over `resolveFloor`).
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildIslandRecipe } from "../src/island-recipe.js";
import {
  CompositeStore, GENESIS_FLOOR_TIDDLER, ORACLE_BAG, floorRowsInOrder, resolveFloor, wikiSlotUri,
  type DocHandle, type LarDoc, type LarTiddlerChange, type LarTiddlerRecord,
} from "@lararium/mesh";
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

/** A projection that stands on the composite before the recipe mounts: it hears what every slot replays. */
function heard(composite: CompositeStore): Map<string, LarTiddlerChange> {
  const seen = new Map<string, LarTiddlerChange>();
  composite.addProjection({ onUriChanged: (change: LarTiddlerChange) => { seen.set(change.title, change); } } as never);
  return seen;
}

const FLOOR_TITLE = "lar:///ha.ka.ba/lares/docs/floor-only";
const SEED_TITLE = "lar:///ha.ka.ba/bags/oracle/seed-only";
const SHADOWED = "lar:///ha.ka.ba/lares/docs/both";

describe("the floor replays into the island", () => {
  test("a projection hears the floor's rows and the unshadowed seed rows once; a seed row the floor shadows replays as the floor's; CONTROL: no floor rows, only the seed's", () => {
    const composite = new CompositeStore();
    const seen = heard(composite);
    buildIslandRecipe({
      tw5: fakeTw5(), composite, recipe: { wikiSlug: "floor-replay" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle({
        [SEED_TITLE]: { tiddler: { title: SEED_TITLE, text: "seed" } },
        [SHADOWED]: { tiddler: { title: SHADOWED, text: "seed copy" } },
      }) }],
      floorRows: [{
        [FLOOR_TITLE]: { tiddler: { title: FLOOR_TITLE, text: "floor", tags: ["$:/tags/lares/Landing"] } },
        [SHADOWED]: { tiddler: { title: SHADOWED, text: "floor copy" } },
      }],
    });
    expect(seen.get(FLOOR_TITLE)?.record?.tiddler.text).toBe("floor");
    expect(seen.get(FLOOR_TITLE)?.bag).toBe(ORACLE_BAG);
    expect(seen.get(SEED_TITLE)?.record?.tiddler.text).toBe("seed");
    expect(seen.get(SHADOWED)?.record?.tiddler.text).toBe("floor copy");

    const bare = new CompositeStore();
    const control = heard(bare);
    buildIslandRecipe({ tw5: fakeTw5(), composite: bare, recipe: { wikiSlug: "floor-replay-control" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle({ [SEED_TITLE]: { tiddler: { title: SEED_TITLE, text: "seed" } } }) }] });
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
    const seen = heard(composite);
    buildIslandRecipe({ tw5: fakeTw5(), composite, recipe: { wikiSlug: "lares" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle() }, { slot: wikiSlotUri("lares", "working"), handle: fakeHandle() }],
      floorRows: floorRowsInOrder(floor) });
    const welcome = seen.get("lar:///ha.ka.ba/lares/docs/welcome")?.record?.tiddler;
    expect(welcome?.tags).toContain("$:/tags/lares/Landing");
    const palette = seen.get("lar:///ha.ka.ba/lararium/tw5/palette/gruvbox-dark#/palette")?.record?.tiddler;
    expect(palette?.type).toBe("application/x-tiddler-dictionary");
    expect(String(palette?.text)).toContain("#282828");
  });
});
