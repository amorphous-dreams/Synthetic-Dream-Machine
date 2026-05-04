/**
 * CompositeStore — causal island layering contracts.
 *
 * Local-first law: every read fans out across all island bags, highest-priority wins.
 * Every write routes to the designated writable layer. Layers arrive async — corpus
 * islands may attach after room is already live.
 *
 * Bag order (lowest → highest priority):
 *   lararium (ha) → catalog (ka) → lares (ba) → corpus:* → room (writable) → draft (writable)
 *
 * Bag ID law (M21): bag ID = lar: URI of the owning Automerge doc.
 * No opaque prefixes (e.g. "corpus:") — every bag carries a stable lar:/// address.
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/automerge-tiga
 */

import { describe, test, expect, beforeEach } from "@jest/globals";
import { CompositeStore, BAG_IDS, corpusBagId } from "../src/composite-store.js";
import { roomLarUri, LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI } from "../src/lararium-doc.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import type { LarTiddlerChange, ChangeOrigin } from "../src/tiddler-store.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_ROOM_URI  = roomLarUri("test-room");
const TEST_DRAFT_URI = "draft";

function systemOrigin(): ChangeOrigin { return { kind: "canon-hydrate", receipt: "system" }; }
function roomOrigin():   ChangeOrigin { return { kind: "crdt-remote", edgeIsland: TEST_ROOM_URI }; }
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
    store.addLayer({ bagId: BAG_IDS.lararium, store: new MemoryTiddlerStore(), writable: false });
    expect(store.hasBag(BAG_IDS.lararium)).toBe(true);
  });

  test("addLayer with duplicate bagId throws", () => {
    const store = new CompositeStore();
    const ms = new MemoryTiddlerStore();
    store.addLayer({ bagId: TEST_ROOM_URI, store: ms, writable: true });
    expect(() =>
      store.addLayer({ bagId: TEST_ROOM_URI, store: new MemoryTiddlerStore(), writable: false }),
    ).toThrow(/already registered/);
  });

  test("removeLayer de-registers bag", () => {
    const store = new CompositeStore();
    const ms = new MemoryTiddlerStore();
    const corpusId = corpusBagId("lares");
    store.addLayer({ bagId: corpusId, store: ms, writable: false });
    store.removeLayer(corpusId);
    expect(store.hasBag(corpusId)).toBe(false);
  });

  test("corpusBagId produces lar: URI at pos-2 child-doc slot", () => {
    // M21 law: bag ID = full lar: URI of the owning Automerge doc.
    // Corpus docs live at pos-2 under @catalog.
    expect(corpusBagId("elyncia")).toBe("lar:///ha.ka.ba/@catalog/@elyncia");
    expect(corpusBagId("lares")).toBe("lar:///ha.ka.ba/@catalog/@lares");
  });
});

// ---------------------------------------------------------------------------
// Read fan-out — highest-priority layer wins
// ---------------------------------------------------------------------------

describe("CompositeStore — read priority (ha < corpus < room)", () => {
  let system: MemoryTiddlerStore;
  let corpus: MemoryTiddlerStore;
  let room:   MemoryTiddlerStore;
  let store:  CompositeStore;

  beforeEach(async () => {
    system = new MemoryTiddlerStore();
    corpus = new MemoryTiddlerStore();
    room   = new MemoryTiddlerStore();
    store  = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: system, writable: false });
    store.addLayer({ bagId: corpusBagId("lares"), store: corpus, writable: false });
    store.addLayer({ bagId: TEST_ROOM_URI, store: room, writable: true });
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
    store.addLayer({ bagId: BAG_IDS.lararium, store: new MemoryTiddlerStore(), writable: false });
    await expect(
      store.put({ title: "lar:///x", fields: {} }, systemOrigin()),
    ).rejects.toThrow(/no writable layer/);
  });

  test("put() writes to the registered writable store, not ha island", async () => {
    const system = new MemoryTiddlerStore();
    const room   = new MemoryTiddlerStore();
    const store  = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: system, writable: false });
    store.addLayer({ bagId: TEST_ROOM_URI,    store: room,   writable: true });

    await store.put(record("lar:///new", "data"), roomOrigin());

    expect(await system.get("lar:///new")).toBeNull();
    expect((await room.get("lar:///new"))?.text).toBe("data");
  });

  test("when draft is writable, put() routes to draft (last registered wins)", async () => {
    const room  = new MemoryTiddlerStore();
    const draft = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: TEST_ROOM_URI,    store: room,  writable: true });
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

    store.addLayer({ bagId: BAG_IDS.lararium, store: system, writable: false });
    store.addLayer({ bagId: TEST_ROOM_URI,    store: room,   writable: true });

    await system.put(record("lar:///A", "sys"), systemOrigin());
    await room.put(record("lar:///B", "room"), roomOrigin());

    expect(changes.some((c) => c.title === "lar:///A")).toBe(true);
    expect(changes.some((c) => c.title === "lar:///B")).toBe(true);
  });

  test("unsubscribe stops notifications", async () => {
    const room  = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: TEST_ROOM_URI, store: room, writable: true });

    const changes: LarTiddlerChange[] = [];
    const unsub = store.subscribe((c) => changes.push(c));

    await room.put(record("lar:///before", "x"), roomOrigin());
    unsub();
    await room.put(record("lar:///after", "y"), roomOrigin());

    expect(changes.some((c) => c.title === "lar:///before")).toBe(true);
    expect(changes.some((c) => c.title === "lar:///after")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Recipe helpers (Loop 4 — topology-derived VM)
// ---------------------------------------------------------------------------

describe("CompositeStore — getRecipe + buildLayersFromRecipe", () => {
  const RECIPE_URI = "lar:///ha.ka.ba/@lararium/recipes/default";

  test("getRecipe returns null when tiddler absent", async () => {
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: new MemoryTiddlerStore(), writable: false });
    expect(await store.getRecipe(RECIPE_URI)).toBeNull();
  });

  test("getRecipe parses space-separated bagStack string", async () => {
    const ha = new MemoryTiddlerStore();
    await ha.put(
      {
        title:  RECIPE_URI,
        fields: {
          bag:      BAG_IDS.lararium,
          label:    "Default",
          bagStack: `${LARARIUM_DOC_URI} ${CATALOG_DOC_URI} ${LARES_DOC_URI}`,
          authority: "test",
          updatedAt: "2026-05-03T00:00:00Z",
        },
        text: "",
      },
      systemOrigin(),
    );
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: ha, writable: false });

    const recipe = await store.getRecipe(RECIPE_URI);
    expect(recipe).not.toBeNull();
    expect(recipe!.bagStack).toEqual([LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI]);
    expect(recipe!.label).toBe("Default");
  });

  test("buildLayersFromRecipe returns layers in bagStack order, skipping unregistered", async () => {
    const ha = new MemoryTiddlerStore();
    const ka = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: ha, writable: false });
    store.addLayer({ bagId: BAG_IDS.catalog,  store: ka, writable: false });
    // Note: LARES_DOC_URI layer NOT registered — should be omitted silently.

    const layers = store.buildLayersFromRecipe({
      title:     RECIPE_URI,
      label:     "Default",
      bagStack:  [LARARIUM_DOC_URI, CATALOG_DOC_URI, LARES_DOC_URI],
      updatedAt: "2026-05-03T00:00:00Z",
      authority: "test",
      bag:       BAG_IDS.lararium,
    });

    expect(layers.map((l) => l.bagId)).toEqual([LARARIUM_DOC_URI, CATALOG_DOC_URI]);
  });

  test("getRecipe returns null for tombstoned tiddler", async () => {
    const ha = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: ha, writable: false });
    await ha.put({ title: RECIPE_URI, fields: { bag: BAG_IDS.lararium, bagStack: "" }, text: "" }, systemOrigin());
    await ha.tombstone(RECIPE_URI, systemOrigin());

    expect(await store.getRecipe(RECIPE_URI)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// putViaRecipe (TW5 Bags/Recipes law: writes route to writableBag)
// ---------------------------------------------------------------------------

describe("CompositeStore — putViaRecipe", () => {
  test("routes write to declared writableBag layer", async () => {
    const ha   = new MemoryTiddlerStore();
    const room = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: ha,   writable: false });
    store.addLayer({ bagId: TEST_ROOM_URI,     store: room, writable: true  });

    const recipe = {
      title:       "lar:///ha.ka.ba/@lararium/recipes/default",
      label:       "Default",
      bagStack:    [LARARIUM_DOC_URI, TEST_ROOM_URI],
      writableBag: TEST_ROOM_URI,
      updatedAt:   "2026-05-03T00:00:00Z",
      authority:   "test",
      bag:         BAG_IDS.lararium,
    };

    await store.putViaRecipe(recipe, { title: "test-tiddler", fields: { bag: TEST_ROOM_URI }, text: "hello" }, systemOrigin());

    const rec = await room.get("test-tiddler");
    expect(rec).not.toBeNull();
    expect(rec!.text).toBe("hello");

    // Should NOT appear in ha
    expect(await ha.get("test-tiddler")).toBeNull();
  });

  test("falls back to default writable store when writableBag absent", async () => {
    const room = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: TEST_ROOM_URI, store: room, writable: true });

    const recipe = {
      title:     "lar:///ha.ka.ba/@lararium/recipes/default",
      label:     "Default",
      bagStack:  [TEST_ROOM_URI],
      updatedAt: "2026-05-03T00:00:00Z",
      authority: "test",
      bag:       BAG_IDS.lararium,
    };

    await store.putViaRecipe(recipe, { title: "t", fields: {}, text: "x" }, systemOrigin());
    expect(await room.get("t")).not.toBeNull();
  });

  test("throws when writableBag is not registered as writable", async () => {
    const ha    = new MemoryTiddlerStore();
    const store = new CompositeStore();
    store.addLayer({ bagId: BAG_IDS.lararium, store: ha, writable: false });

    const recipe = {
      title:       "lar:///ha.ka.ba/@lararium/recipes/default",
      label:       "Default",
      bagStack:    [LARARIUM_DOC_URI],
      writableBag: TEST_ROOM_URI, // not registered
      updatedAt:   "2026-05-03T00:00:00Z",
      authority:   "test",
      bag:         BAG_IDS.lararium,
    };

    await expect(
      store.putViaRecipe(recipe, { title: "t", fields: {}, text: "x" }, systemOrigin()),
    ).rejects.toThrow("writableBag");
  });
});

// ---------------------------------------------------------------------------
// CompositeLayer readPolicy / writePolicy (TW5 Bags access controls model)
// ---------------------------------------------------------------------------

describe("CompositeStore — CompositeLayer access policy fields", () => {
  test("layers carry optional readPolicy and writePolicy", () => {
    const store = new CompositeStore();
    store.addLayer({
      bagId:       BAG_IDS.lararium,
      store:       new MemoryTiddlerStore(),
      writable:    false,
      readPolicy:  "public",
      writePolicy: "private",
    });
    const ids = store.layerIds;
    expect(ids).toContain(BAG_IDS.lararium);
    // Policy fields are carried on the layer object (no runtime enforcement yet;
    // this test asserts the field is accepted without type error).
  });
});
