import { describe, expect, test } from "vitest";
import { CompositeStore } from "../src/composite-store.js";
import { ORACLE_BAG, slotLayerFlags, wikiSlotUri } from "../src/wiki-recipe.js";
import { FloorWriteRefusal, floorReadFace } from "../src/floor-manifest.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import type { LarTiddlerRecord } from "../src/tiddler-store.js";

const title = "lar:///ha.ka.ba/lares/api/probe";
const laresRows: Record<string, LarTiddlerRecord> = { [title]: { tiddler: { title, text: "floor carrier" } } };
const larariumRows: Record<string, LarTiddlerRecord> = {};
const origin = { kind: "tw-local", instanceId: "floor-read-face-test" } as const;

describe("floor read-face in a wiki cascade", () => {
  test("wiki reads the floor, copies unbagged writes to working, and cannot write through the face", async () => {
    const base = new MemoryTiddlerStore();
    await base.put({ tiddler: { title: "lar:///base-only", text: "base" } }, origin);
    await base.put({ tiddler: { title, text: "base shadow" } }, origin);
    const face = floorReadFace({ rows: [laresRows, larariumRows], base });
    const composite = new CompositeStore();
    const slug = "floor-read-face";
    composite.addLayer({ bagId: ORACLE_BAG, store: face, ...slotLayerFlags(ORACLE_BAG, slug) });
    const canon = new MemoryTiddlerStore();
    composite.addLayer({ bagId: "lar:///ha.ka.ba/bags/floor-read-face", store: canon, ...slotLayerFlags("lar:///ha.ka.ba/bags/floor-read-face", slug) });
    const working = new MemoryTiddlerStore();
    const workingSlot = wikiSlotUri(slug, "working");
    composite.addLayer({ bagId: workingSlot, store: working, ...slotLayerFlags(workingSlot, slug) });
    expect((await composite.get(title))?.tiddler.text).toBe("floor carrier");
    await composite.put({ tiddler: { title, text: "wiki edit" } }, origin);
    expect((await working.get(title))?.tiddler.text).toBe("wiki edit");
    expect((await face.get(title))?.tiddler.text).toBe("floor carrier"); expect(laresRows[title]?.tiddler.text).toBe("floor carrier");
    expect(composite.writableStoreForBag(ORACLE_BAG)).toBeNull();
    await expect(face.put({ tiddler: { title, text: "no" } }, origin)).rejects.toBeInstanceOf(FloorWriteRefusal);
    await expect(face.tombstone(title, origin)).rejects.toMatchObject({ code: "floor-write" });
    await expect(face.remove(title, origin)).rejects.toMatchObject({ code: "floor-write" });
    expect((await face.get("lar:///base-only"))?.tiddler.text).toBe("base");
  });
  test("control memory oracle does not fabricate the floor carrier", async () => {
    const composite = new CompositeStore(); const slug = "floor-control";
    const emptyOracle = new MemoryTiddlerStore();
    composite.addLayer({ bagId: ORACLE_BAG, store: emptyOracle, ...slotLayerFlags(ORACLE_BAG, slug) });
    expect(await composite.get(title)).toBeNull();
  });
});
