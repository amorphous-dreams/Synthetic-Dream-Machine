import { describe, expect, test } from "vitest";
import { layIslandComposition } from "../src/island-recipe.js";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { ORACLE_BAG, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";

const title = "lar:///ha.ka.ba/lares/api/floor-carrier";
const floorRecords: Readonly<Record<string, LarTiddlerRecord>> = {
  [title]: { tiddler: { title, text: "floor carrier" } },
};

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

describe("layIslandComposition mounts the floor under a user wiki", () => {
  test("@oracle reads a carrier and rejects writes while an edit copies into working", async () => {
    const slug = "floor-mount";
    const workingSlot = wikiSlotUri(slug, "working");
    const composite = new CompositeStore();
    const { stores } = layIslandComposition({
      composite, recipe: { wikiSlug: slug },
      ready: [
        { slot: ORACLE_BAG, handle: fakeHandle() },
        { slot: workingSlot, handle: fakeHandle() },
      ],
      floorRecords: [floorRecords],
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
    expect(floorRecords[title]?.tiddler.text).toBe("floor carrier");
  });

  test("without floor rows, @oracle cannot read the carrier", async () => {
    const composite = new CompositeStore();
    layIslandComposition({
      composite, recipe: { wikiSlug: "floor-control" },
      ready: [{ slot: ORACLE_BAG, handle: fakeHandle() }],
    });
    expect(await composite.get(title)).toBeNull();
  });
});
