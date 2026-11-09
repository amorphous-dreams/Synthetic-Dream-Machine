import { describe, expect, test } from "vitest";
import { CompositeStore, WARD_AUDIT_URI_PREFIX, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { fileWardRefusal } from "../src/worker-data-verbs.js";

describe("ward audit placement", () => {
  test("the audit rests in the selected working layer and keeps its refusal facts", async () => {
    const working = wikiSlotUri("daemon", "working");
    const store = new MemoryTiddlerStore(working);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: working, store, writable: true, defaultWritable: true });
    await fileWardRefusal(composite, () => {}, { bagId: "mirror", uri: "lar:///ward/x", reason: "refused" });
    const audits = (await store.listVisible()).filter((title) => title.startsWith(WARD_AUDIT_URI_PREFIX));
    expect(audits).toHaveLength(1);
    expect((await store.get(audits[0]!))?.tiddler).toMatchObject({ uri: "lar:///ward/x", reason: "refused", bag: "mirror" });
  });
});
