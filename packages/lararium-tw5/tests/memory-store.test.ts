/**
 * MemoryTiddlerStore — in-memory LarTiddlerStore, origin taxonomy.
 *
 * Local-first model: every tiddler mutation carries a ChangeOrigin so
 * projections can distinguish causal source (canon hydration, CRDT remote,
 * canvas draft, MCP tool call, operator import, TW5 local edit).
 *
 * Tombstoned titles disappear from listVisible() but remain readable via
 * get() with deleted:true — CRDT law: data only grows; tombstones are markers.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/change-origin
 */

import { describe, test, expect } from "@jest/globals";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { ChangeOrigin } from "@lararium/core";

// ---------------------------------------------------------------------------
// All valid ChangeOrigin kinds
// ---------------------------------------------------------------------------

const ORIGINS: ChangeOrigin[] = [
  { kind: "canon-hydrate",   receipt:    "sha256:abc" },
  { kind: "mcp-draft",       toolCallId: "tool:mcp-1" },
  { kind: "operator-import", sessionId:  "sess:op-1" },
  { kind: "tw-local",        instanceId: "wiki:1" },
  { kind: "crdt-remote",     edgeIsland: "automerge" },
  { kind: "canvas-draft",    shapeId:    "shape:tldr-1" },
];

describe("MemoryTiddlerStore — origin taxonomy (exhaustive)", () => {
  for (const origin of ORIGINS) {
    test(`put() accepts ${origin.kind} origin and stores record`, async () => {
      const store = new MemoryTiddlerStore();
      await store.put({ title: `lar:///test/${origin.kind}`, fields: {}, text: "body" }, origin);
      const rec = await store.get(`lar:///test/${origin.kind}`);
      expect(rec?.text).toBe("body");
    });

    test(`subscriber receives ${origin.kind} origin on put()`, async () => {
      const store    = new MemoryTiddlerStore();
      const received: string[] = [];
      store.subscribe((c) => received.push(c.origin.kind));
      await store.put({ title: `lar:///sub/${origin.kind}`, fields: {} }, origin);
      expect(received).toContain(origin.kind);
    });
  }
});

// ---------------------------------------------------------------------------
// listVisible — CRDT tombstone law
// ---------------------------------------------------------------------------

describe("MemoryTiddlerStore — CRDT tombstone law", () => {
  const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "room" };

  test("live record appears in listVisible()", async () => {
    const store = new MemoryTiddlerStore();
    await store.put({ title: "lar:///alive", fields: {} }, origin);
    expect(await store.listVisible()).toContain("lar:///alive");
  });

  test("tombstoned record disappears from listVisible()", async () => {
    const store = new MemoryTiddlerStore();
    await store.put({ title: "lar:///dead", fields: {} }, origin);
    await store.tombstone("lar:///dead", origin);
    expect(await store.listVisible()).not.toContain("lar:///dead");
  });

  test("get() on tombstoned title returns deleted:true (data only grows)", async () => {
    const store = new MemoryTiddlerStore();
    await store.put({ title: "lar:///ghost", fields: {} }, origin);
    await store.tombstone("lar:///ghost", origin);
    const rec = await store.get("lar:///ghost");
    expect(rec).toBeDefined();
    expect(rec?.deleted).toBe(true);
  });

  test("tombstone subscriber event carries null record (deletion signal)", async () => {
    const store = new MemoryTiddlerStore();
    await store.put({ title: "lar:///t", fields: {} }, origin);

    const changes: Array<{ title: string; record: unknown }> = [];
    store.subscribe((c) => changes.push({ title: c.title, record: c.record }));
    await store.tombstone("lar:///t", origin);

    const del = changes.find((c) => c.title === "lar:///t");
    expect(del?.record).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// subscribe — unsubscribe contract
// ---------------------------------------------------------------------------

describe("MemoryTiddlerStore — unsubscribe", () => {
  test("unsubscribing stops future notifications", async () => {
    const store  = new MemoryTiddlerStore();
    const seen:  string[] = [];
    const unsub  = store.subscribe((c) => seen.push(c.title));
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: "w1" };

    await store.put({ title: "lar:///before", fields: {} }, origin);
    unsub();
    await store.put({ title: "lar:///after", fields: {} }, origin);

    expect(seen).toContain("lar:///before");
    expect(seen).not.toContain("lar:///after");
  });
});

// ---------------------------------------------------------------------------
// _seed / _snapshot test helpers
// ---------------------------------------------------------------------------

describe("MemoryTiddlerStore — test helpers", () => {
  test("_seed injects without triggering subscribers", async () => {
    const store = new MemoryTiddlerStore();
    const seen: string[] = [];
    store.subscribe((c) => seen.push(c.title));

    store._seed({ title: "lar:///injected", fields: {}, text: "seeded" });

    expect(seen).not.toContain("lar:///injected");
    expect((await store.get("lar:///injected"))?.text).toBe("seeded");
  });

  test("_snapshot returns full record map at point-in-time", async () => {
    const store = new MemoryTiddlerStore();
    const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "r1" };
    await store.put({ title: "lar:///A", fields: {} }, origin);
    await store.put({ title: "lar:///B", fields: {} }, origin);
    const snap = store._snapshot();
    expect(snap.size).toBe(2);
    expect(snap.has("lar:///A")).toBe(true);
    expect(snap.has("lar:///B")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Session-local tiddlers MUST NOT surface as heleuma sync candidates
// ---------------------------------------------------------------------------

describe("MemoryTiddlerStore — session-local guard", () => {
  test("$:/temp/* titles stored but are NOT canonical lar: URIs", async () => {
    const store  = new MemoryTiddlerStore();
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: "w1" };
    await store.put({ title: "$:/temp/StoryList", fields: {}, text: "session" }, origin);
    const rec = await store.get("$:/temp/StoryList");
    // Stored locally — but the title starts with $:/temp/; sync guards must filter.
    expect(rec?.title.startsWith("$:/temp/")).toBe(true);
  });
});
