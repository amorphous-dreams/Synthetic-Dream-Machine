import { describe, expect, test } from "vitest";
import { buildIslandRecipe } from "../src/island-recipe.js";
import {
  CompositeStore, ORACLE_BAG, wikiSlotUri,
  type DocHandle, type LarDoc, type LarTiddlerRecord,
} from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";

const title = "lar:///ha.ka.ba/lares/api/floor-carrier";
const floorRows: Readonly<Record<string, LarTiddlerRecord>> = {
  [title]: { tiddler: { title, text: "floor carrier" } },
};

function fakeTw5(): TW5Engine {
  return {
    $tw: {
      Tiddler: class {
        constructor(readonly fields: Record<string, unknown>) {}
        getFieldStrings(): Record<string, string> {
          return Object.fromEntries(Object.entries(this.fields).map(([key, value]) => [key, String(value)]));
        }
        isEqual(other: unknown, exclude: string[] = []): boolean {
          const fields = (other as { fields?: Record<string, unknown> } | null)?.fields;
          if (!fields) return false;
          const keys = new Set([...Object.keys(this.fields), ...Object.keys(fields)]);
          return [...keys].filter((key) => !exclude.includes(key)).every((key) => this.fields[key] === fields[key]);
        }
      },
      rootWidget: { invokeActionsByTag: () => {} },
      wiki: {
        getTiddlerText: () => "",
        getTiddler: () => undefined,
        filterTiddlers: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        transact: (fn: () => void) => fn(),
      },
      lares: { applyNalu: () => {}, isApplyingNalu: () => false },
    },
  } as unknown as TW5Engine;
}

function fakeHandle(): DocHandle<LarDoc> {
  const doc = { tiddlers: {} } as unknown as LarDoc;
  return {
    url: "automerge:floor-mount-test",
    doc: () => doc,
    heads: () => [],
    view: () => ({ doc: () => doc }),
    on: () => {},
    change: (fn: (d: LarDoc) => void) => fn(doc),
  } as unknown as DocHandle<LarDoc>;
}

describe("buildIslandRecipe mounts the floor under a user wiki", () => {
  test("@oracle reads a carrier and rejects writes while an edit copies into working", async () => {
    const slug = "floor-mount";
    const workingSlot = wikiSlotUri(slug, "working");
    const composite = new CompositeStore();
    const { stores } = buildIslandRecipe({
      tw5: fakeTw5(), composite, recipe: { wikiSlug: slug },
      ready: [
        { slot: ORACLE_BAG, handle: fakeHandle() },
        { slot: workingSlot, handle: fakeHandle() },
      ],
      floorRows: [floorRows],
    });

    const oracle = stores.find(({ slot }) => slot === ORACLE_BAG)?.store;
    const working = stores.find(({ slot }) => slot === workingSlot)?.store;
    expect(oracle).toBeDefined();
    expect(working).toBeDefined();
    expect(composite.writableStoreForBag(ORACLE_BAG)).toBeNull();
    expect((await composite.get(title))?.tiddler.text).toBe("floor carrier");
    expect((await oracle!.get(title))?.tiddler.text).toBe("floor carrier");
    await composite.put(
      { tiddler: { title, text: "wiki edit" } },
      { kind: "tw-local", instanceId: "floor-mount-test" },
    );
    expect((await working!.get(title))?.tiddler.text).toBe("wiki edit");
    expect((await oracle!.get(title))?.tiddler.text).toBe("floor carrier");
    expect(floorRows[title]?.tiddler.text).toBe("floor carrier");
  });

  test("without floor rows, @oracle cannot read the carrier", async () => {
    const composite = new CompositeStore();
    buildIslandRecipe({
      tw5: fakeTw5(), composite, recipe: { wikiSlug: "floor-control" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle() }],
    });
    expect(await composite.get(title)).toBeNull();
  });
});
