/**
 * CompositeStore — causal island layering contracts.
 *
 * Local-first law: every read fans out across all island bags, highest-priority wins.
 * Every write routes to the designated writable layer. Layers arrive async — corpus
 * islands may attach after room is already live.
 *
 * Bag order (lowest → highest priority):
 *   system → corpus:* → room (writable) → draft (writable, user-scoped)
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/bag-ids
 */

import { describe, test, expect, beforeEach } from "@jest/globals";
import { CompositeStore, BAG_IDS, corpusBagId } from "../src/composite-store.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import type { LarTiddlerChange, ChangeOrigin } from "../src/tiddler-store.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function systemOrigin(): ChangeOrigin { return { kind: "canon-hydrate", receipt: "system" }; }
function roomOrigin():   ChangeOrigin { return { kind: "crdt-remote", edgeIsland: "room" }; }
function draftOrigin():  ChangeOrigin { return { kind: "tw-local", instanceId: "wiki:1" }; }

function record(title: string, text: string, bag?: string) {
  return { title, fields: bag ? { bag } : {}, text };
}

// ---------------------------------------------------------------------------
// Construction + layer management
// ---------------------------------------------------------------------------

describe("CompositeStore — layer management", () => {
  test("starts with zero layers", () => {
    const store = new CompositeStore();
    expect(store.layerCount).toBe(0);
    expect(store.layerIds).toEqual([]);
  });

  test("addLayer registers bag id", () => {
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.system, store: new MemoryTiddlerStore(), writable: false });
    expect(store.hasBag(BAG_IDS.system)).toBe(true);
  });

  test("addLayer with duplicate bagId throws", () => {
    const store = new CompositeStore();
    const ms = new MemoryTiddlerStore();
    store.addLayer({ bagId: BAG_IDS.room, store: ms, writable: true });
    expect(() =>
      store.addLayer({ bagId: BAG_IDS.room, store: new MemoryTiddlerStore(), writable: false }),
    ).toThrow(/already registered/);
  });

  test("removeLayer de-registers bag", () => {
    const store = new CompositeStore();
    const ms = new MemoryTiddlerStore();
    store.addLayer({ bagId: "corpus:lares", store: ms, writable: false });
    store.removeLayer("corpus:lares");
    expect(store.hasBag("corpus:lares")).toBe(false);
  });

  test("corpusBagId produces namespaced id", () => {
    expect(corpusBagId("elyncia")).toBe("corpus:elyncia");
    expect(corpusBagId("lares")).toBe("corpus:lares");
  });
});

// ---------------------------------------------------------------------------
// Read fan-out — highest-priority layer wins
// ---------------------------------------------------------------------------

describe("CompositeStore — read priority (system < corpus < room)", () => {
  let system: MemoryTiddlerStore;
  let corpus: MemoryTiddlerStore;
  let room:   MemoryTiddlerStore;
  let store:  CompositeStore;

  beforeEach(async () => {
    system = new MemoryTiddlerStore();
    corpus = new MemoryTiddlerStore();
    room   = new MemoryTiddlerStore();
    store  = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.system, store: system, writable: false });
    store.addLayer({ bagId: corpusBagId("lares"), store: corpus, writable: false });
    store.addLayer({ bagId: BAG_IDS.room, store: room, writable: true });
  });

  test("get() returns null when no layer has the title", async () => {
    expect(await store.get("lar:///missing")).toBeNull();
  });

  test("get() returns system record when only system has it", async () => {
    await system.put(record("lar:///AGENTS", "canon body"), systemOrigin());
    const rec = await store.get("lar:///AGENTS");
    expect(rec?.text).toBe("canon body");
  });

  test("room layer overrides system for same title", async () => {
    await system.put(record("lar:///AGENTS", "canon"), systemOrigin());
    await room.put(record("lar:///AGENTS", "override"), roomOrigin());
    const rec = await store.get("lar:///AGENTS");
    expect(rec?.text).toBe("override");
  });

  test("corpus overrides system but room overrides corpus", async () => {
    await system.put(record("lar:///t", "sys"), systemOrigin());
    await corpus.put(record("lar:///t", "corp"), systemOrigin());
    await room.put(record("lar:///t", "room"), roomOrigin());
    expect((await store.get("lar:///t"))?.text).toBe("room");

    // Remove room record — corpus should surface on get() (room tombstone wins over corpus)
    await room.tombstone("lar:///t", roomOrigin());
    // get() returns the highest-priority record (the tombstone from room)
    const afterTombstone = await store.get("lar:///t");
    expect(afterTombstone?.deleted).toBe(true);
    // listVisible() deduplicates from high→low; room's listVisible() omits the tombstoned title,
    // so corpus's copy surfaces. Composite does not retroactively suppress lower layers.
    const visible = await store.listVisible();
    expect(visible).toContain("lar:///t");
  });

  test("listVisible() deduplicates — each title appears once", async () => {
    await system.put(record("lar:///shared", "sys"), systemOrigin());
    await corpus.put(record("lar:///shared", "corp"), systemOrigin());
    await room.put(record("lar:///own", "room"), roomOrigin());

    const visible = await store.listVisible();
    const shared = visible.filter((t) => t === "lar:///shared");
    expect(shared).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Write routing — always routes to the writable layer
// ---------------------------------------------------------------------------

describe("CompositeStore — write routing", () => {
  test("put() without any writable layer throws", async () => {
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.system, store: new MemoryTiddlerStore(), writable: false });
    await expect(
      store.put({ title: "lar:///x", fields: {} }, systemOrigin()),
    ).rejects.toThrow(/no writable layer/);
  });

  test("put() writes to the registered writable store, not system", async () => {
    const system = new MemoryTiddlerStore();
    const room   = new MemoryTiddlerStore();
    const store  = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.system, store: system, writable: false });
    store.addLayer({ bagId: BAG_IDS.room,   store: room,   writable: true });

    await store.put(record("lar:///new", "data"), roomOrigin());

    expect(await system.get("lar:///new")).toBeNull();
    expect((await room.get("lar:///new"))?.text).toBe("data");
  });

  test("when draft is writable, put() routes to draft (last registered wins)", async () => {
    const room  = new MemoryTiddlerStore();
    const draft = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.room,  store: room,  writable: true });
    store.addLayer({ bagId: BAG_IDS.draft, store: draft, writable: true });

    await store.put(record("lar:///edit", "draft"), draftOrigin());
    expect((await draft.get("lar:///edit"))?.text).toBe("draft");
    expect(await room.get("lar:///edit")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Subscribe — fan-out and synthetic events on addLayer
// ---------------------------------------------------------------------------

describe("CompositeStore — subscribe fan-out", () => {
  test("subscriber receives changes from all layers", async () => {
    const system = new MemoryTiddlerStore();
    const room   = new MemoryTiddlerStore();
    const store  = new CompositeStore();

    const changes: LarTiddlerChange[] = [];
    store.subscribe((c) => changes.push(c));

    store.addLayer({ bagId: BAG_IDS.system, store: system, writable: false });
    store.addLayer({ bagId: BAG_IDS.room,   store: room,   writable: true });

    await system.put(record("lar:///A", "sys"), systemOrigin());
    await room.put(record("lar:///B", "room"), roomOrigin());

    expect(changes.some((c) => c.title === "lar:///A")).toBe(true);
    expect(changes.some((c) => c.title === "lar:///B")).toBe(true);
  });

  test("unsubscribe stops notifications", async () => {
    const room  = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.room, store: room, writable: true });

    const changes: LarTiddlerChange[] = [];
    const unsub = store.subscribe((c) => changes.push(c));

    await room.put(record("lar:///before", "x"), roomOrigin());
    unsub();
    await room.put(record("lar:///after", "y"), roomOrigin());

    expect(changes.some((c) => c.title === "lar:///before")).toBe(true);
    expect(changes.some((c) => c.title === "lar:///after")).toBe(false);
  });
});
