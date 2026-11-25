import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { CONTROL_HOME_ID } from "@lararium/mesh/lar-uris";
import { WARD_AUDIT_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { fileWardRefusal } from "../src/worker-data-verbs.js";

describe("ward audit placement", () => {
  test("the audit rests in the control document, never in the mirrored working layer, and keeps its refusal facts", async () => {
    const working = wikiSlotUri("daemon", "working");
    const workingStore = new MemoryTiddlerStore(working);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: working, store: workingStore, writable: true, defaultWritable: true });
    const controlStore = new MemoryTiddlerStore(CONTROL_HOME_ID);
    const control = new CompositeStore();
    control.addLayer({ bagId: CONTROL_HOME_ID, store: controlStore, writable: true, defaultWritable: true });
    await fileWardRefusal(composite, control, () => {}, { bagId: "mirror", uri: "lar:///ward/x", reason: "refused" });
    const audits = (await controlStore.listVisible()).filter((title) => title.startsWith(WARD_AUDIT_URI_PREFIX));
    expect(audits).toHaveLength(1);
    expect((await controlStore.get(audits[0]!))?.tiddler).toMatchObject({ uri: "lar:///ward/x", reason: "refused", bag: "mirror" });
    expect(await workingStore.listVisible(), "an audit row reached the mirrored working layer").toEqual([]);
  });
});
