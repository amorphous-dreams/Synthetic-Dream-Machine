/**
 * A ward audit carries `disk-projection: "no"` where it gets written: it lands in the working layer like any
 * bagless write, stands at a never-projected address, and so reaches no disk mirror and ingests from none.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, WARD_AUDIT_URI_PREFIX, neverProjects, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { fileWardRefusal } from "../src/worker-data-verbs.js";

describe("a ward audit never projects", () => {
  test("the audit record carries the opt-out at a never-projected address in the working layer", async () => {
    const working = wikiSlotUri("daemon", "working");
    const store = new MemoryTiddlerStore(working);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: working, store, writable: true, defaultWritable: true });
    await fileWardRefusal(composite, () => {}, { bagId: "mirror", uri: "lar:///ward/x", reason: "refused" });
    const audits = (await store.listVisible()).filter((title) => title.startsWith(WARD_AUDIT_URI_PREFIX));
    expect(audits).toHaveLength(1);
    const record = await store.get(audits[0]!);
    expect(record?.tiddler["disk-projection"]).toBe("no");
    expect(neverProjects(audits[0]!)).toBe(true);
    // CONTROL: the audit names what the ward refused.
    expect(record?.tiddler).toMatchObject({ uri: "lar:///ward/x", reason: "refused", bag: "mirror" });
  });
});
