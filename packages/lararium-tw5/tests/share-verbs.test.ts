/**
 * share-verbs — the share rows rest in the vessel's state document: `share-set` writes or removes one row (its filters read
 * as a title list of pet-names), `share-list` answers them; a filter operator or a torn slug refuses by name.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { VESSEL_STATE_ID } from "@lararium/mesh/lar-uris";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeShareListReactor, makeShareSetReactor } from "../src/share-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const ctx = (composite: CompositeStore): VerbContext => ({ daemon: composite, invocation: { requestId: "r", action: "share-set", args: {} } as unknown as Verb, cap: async () => ({ ok: true }) }) as VerbContext;

describe("the share rows in the state document", () => {
  test("set, list, replace and remove one row; a filter operator and a torn slug refuse", async () => {
    const state = new CompositeStore();
    state.addLayer({ bagId: VESSEL_STATE_ID, store: new MemoryTiddlerStore(VESSEL_STATE_ID), writable: true, defaultWritable: true });
    const set = makeShareSetReactor({ state: () => state }), list = makeShareListReactor({ state: () => state });
    await set({ slug: "notes", read: "reader [[the referee]]", write: "owner", note: "why" }, ctx(state));
    expect((await state.get("$:/config/lares/share/notes"))?.tiddler["read"]).toBe("reader [[the referee]]");
    expect((await list({}, ctx(state)))["rows"]).toEqual([{ slug: "notes", kind: "bag", read: "reader [[the referee]]", write: "owner", note: "why" }]);
    await set({ slug: "notes", read: "*", write: "" }, ctx(state));
    expect((await list({}, ctx(state)))["rows"]).toEqual([{ slug: "notes", kind: "bag", read: "*", write: "" }]);
    await expect(set({ slug: "notes", read: "[tag[x]]" }, ctx(state))).rejects.toMatchObject({ reason: "share-filter-unsupported" });
    await expect(set({ slug: "Not A Slug", read: "*" }, ctx(state))).rejects.toMatchObject({ reason: "share-slug-malformed" });
    await set({ slug: "notes", remove: true }, ctx(state));
    expect((await list({}, ctx(state)))["rows"]).toEqual([]);
  });

  test("a row of another kind standing for the slug refuses share-kind-standing and writes nothing; unshared first, the other kind sets", async () => {
    const state = new CompositeStore();
    state.addLayer({ bagId: VESSEL_STATE_ID, store: new MemoryTiddlerStore(VESSEL_STATE_ID), writable: true, defaultWritable: true });
    const set = makeShareSetReactor({ state: () => state }), list = makeShareListReactor({ state: () => state });
    await set({ slug: "cold-shelf", kind: "wiki", read: "referee", write: "", owner: "steward" }, ctx(state));
    const refused = set({ slug: "cold-shelf", kind: "bag", read: "engineer referee", write: "" }, ctx(state));
    await expect(refused).rejects.toMatchObject({ reason: "share-kind-standing" });
    await expect(set({ slug: "cold-shelf", kind: "bag", read: "x", write: "" }, ctx(state))).rejects.toThrow(/stands shared as a wiki row.*unshare it first/);
    expect((await list({}, ctx(state)))["rows"], "the wiki row stands whole").toEqual([{ slug: "cold-shelf", kind: "wiki", read: "referee", write: "", owner: "steward" }]);
    await set({ slug: "cold-shelf", remove: true }, ctx(state));
    await set({ slug: "cold-shelf", kind: "bag", read: "engineer", write: "" }, ctx(state));
    expect((await list({}, ctx(state)))["rows"]).toEqual([{ slug: "cold-shelf", kind: "bag", read: "engineer", write: "" }]);
  });

  test("a row set with its owner keeps the owner by pet-name, as the file's row does", async () => {
    const state = new CompositeStore();
    state.addLayer({ bagId: VESSEL_STATE_ID, store: new MemoryTiddlerStore(VESSEL_STATE_ID), writable: true, defaultWritable: true });
    const set = makeShareSetReactor({ state: () => state }), list = makeShareListReactor({ state: () => state });
    expect(await set({ slug: "notes", kind: "wiki", read: "referee", write: "engineer", owner: " steward " }, ctx(state))).toMatchObject({ row: { owner: "steward" } });
    expect((await list({}, ctx(state)))["rows"]).toEqual([{ slug: "notes", kind: "wiki", read: "referee", write: "engineer", owner: "steward" }]);
    await set({ slug: "notes", kind: "wiki", read: "referee", write: "engineer", owner: "" }, ctx(state));
    expect((await list({}, ctx(state)))["rows"], "CONTROL: a blank owner sets none").toEqual([{ slug: "notes", kind: "wiki", read: "referee", write: "engineer" }]);
  });
});
