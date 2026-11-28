import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { VESSEL_STATE_ID } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { fileWardRefusal } from "../src/worker-data-verbs.js";

describe("ward alert placement", () => {
  test("a refusal writes neither state nor mirrored working records", async () => {
    const working = wikiSlotUri("daemon", "working");
    const workingStore = new MemoryTiddlerStore(working);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: working, store: workingStore, writable: true, defaultWritable: true });
    const controlStore = new MemoryTiddlerStore(VESSEL_STATE_ID);
    const state = new CompositeStore();
    state.addLayer({ bagId: VESSEL_STATE_ID, store: controlStore, writable: true, defaultWritable: true });
    await fileWardRefusal(composite, () => {}, { bagId: "mirror", uri: "lar:///ward/x", reason: "refused" });
    const audits = (await controlStore.listVisible()).filter((title) => title.includes("/ledger/ward/"));
    expect(audits).toEqual([]);
    expect(await workingStore.listVisible(), "an audit row reached the mirrored working layer").toEqual([]);
  });
});
