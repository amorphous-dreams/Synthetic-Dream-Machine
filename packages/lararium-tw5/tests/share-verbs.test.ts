/**
 * share-verbs — the share rows rest in the vessel's control document: `share-set` writes or removes one row (its filters read
 * as a title list of pet-names), `share-list` answers them; a filter operator or a torn slug refuses by name.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, CONTROL_HOME_ID, type Verb } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeShareListReactor, makeShareSetReactor } from "../src/share-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const ctx = (composite: CompositeStore): VerbContext => ({ daemon: composite, invocation: { requestId: "r", action: "share-set", args: {} } as unknown as Verb, cap: async () => ({ ok: true }) }) as VerbContext;

describe("the share rows in the control document", () => {
  test("set, list, replace and remove one row; a filter operator and a torn slug refuse", async () => {
    const control = new CompositeStore();
    control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
    const set = makeShareSetReactor({ control: () => control }), list = makeShareListReactor({ control: () => control });
    await set({ slug: "notes", read: "reader [[the referee]]", write: "owner", note: "why" }, ctx(control));
    expect((await control.get("$:/config/lares/share/notes"))?.tiddler["read"]).toBe("reader [[the referee]]");
    expect((await list({}, ctx(control)))["rows"]).toEqual([{ slug: "notes", kind: "bag", read: "reader [[the referee]]", write: "owner", note: "why" }]);
    await set({ slug: "notes", kind: "wiki", read: "*", write: "" }, ctx(control));
    expect((await list({}, ctx(control)))["rows"]).toEqual([{ slug: "notes", kind: "wiki", read: "*", write: "" }]);
    await expect(set({ slug: "notes", read: "[tag[x]]" }, ctx(control))).rejects.toMatchObject({ code: "share-filter-unsupported" });
    await expect(set({ slug: "Not A Slug", read: "*" }, ctx(control))).rejects.toMatchObject({ code: "share-slug-malformed" });
    await set({ slug: "notes", remove: true }, ctx(control));
    expect((await list({}, ctx(control)))["rows"]).toEqual([]);
  });
});
