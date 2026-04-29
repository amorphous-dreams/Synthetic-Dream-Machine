/**
 * @lararium/tw5 host tests — LarariumTW5 boot, filter, render, store binding.
 *
 * Tests: boot/filter path, renderText, MemoryTiddlerStore contract,
 * and store→TW5 binding via LarariumCrdtSyncAdaptor.start().
 */
import { describe, test, expect, beforeAll } from "@jest/globals";
import { LarariumTW5 } from "../src/lararium-tw5.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { LarariumCrdtSyncAdaptor } from "../src/sync-adaptor.js";
import type { LarTiddlerRecord } from "@lararium/core";

// ---------------------------------------------------------------------------
// Shared TW5 instance — one boot for the whole suite (~10ms)
// ---------------------------------------------------------------------------

let tw: LarariumTW5;

beforeAll(async () => {
  tw = new LarariumTW5();
  await tw.boot();
});

// ---------------------------------------------------------------------------
// Boot and filter
// ---------------------------------------------------------------------------

describe("LarariumTW5 — boot and filter", () => {
  test("boot() makes ready === true", () => {
    expect(tw.ready).toBe(true);
  });

  test("filterTiddlers on empty wiki contains only built-in lar:/// system tiddlers", () => {
    const titles = tw.filterTiddlers("[all[tiddlers]]");
    const larTitles = titles.filter((t) => t.startsWith("lar://")).sort();
    // Preloaded at boot: widget module marker + two UI preload tiddlers (iam-panel, iam-viewtemplate-tab).
    expect(larTitles).toEqual([
      "lar:///ha.ka.ba/api/v0.1/lararium/ui/iam-panel",
      "lar:///ha.ka.ba/api/v0.1/lararium/ui/iam-startup-action",
      "lar:///ha.ka.ba/api/v0.1/lararium/ui/iam-viewtemplate-tab",
      "lar:///lararium-node/tw5/widgets",
    ]);
  });

  test("setTiddler + filterTiddlers resolves the added title", () => {
    tw.setTiddler({ title: "lar:///TEST/host", text: "hello", register: "CS" });
    const found = tw.filterTiddlers("[all[tiddlers]field:register[CS]]");
    expect(found).toContain("lar:///TEST/host");
  });

  test("removeTiddler removes the title from filter results", () => {
    tw.setTiddler({ title: "lar:///TEST/remove-me", text: "gone" });
    tw.removeTiddler("lar:///TEST/remove-me");
    const found = tw.filterTiddlers("[all[tiddlers]]");
    expect(found).not.toContain("lar:///TEST/remove-me");
  });

  test("toCanonicalWikitext rewrites all[memes] → all[tiddlers]", () => {
    // If the rewrite works, filterTiddlers sees all tiddlers (not zero)
    tw.setTiddler({ title: "lar:///TEST/meme-rewrite", rating: "meme" });
    const titles = tw.filterTiddlers("[all[memes]field:rating[meme]]");
    expect(titles).toContain("lar:///TEST/meme-rewrite");
  });
});

// ---------------------------------------------------------------------------
// renderText / renderTiddler
// ---------------------------------------------------------------------------

describe("LarariumTW5 — render", () => {
  test("renderText produces HTML from wikitext", () => {
    const html = tw.renderText("Hello ''world''");
    expect(html).toContain("<strong>world</strong>");
  });

  test("renderText with link produces anchor tag", () => {
    const html = tw.renderText("[[see also]]");
    expect(html).toContain("<a");
    expect(html).toContain("see also");
  });

  test("renderTiddler produces HTML for a loaded tiddler", () => {
    tw.setTiddler({ title: "lar:///TEST/render-me", text: "''bold text''" });
    const html = tw.renderTiddler("lar:///TEST/render-me");
    expect(html).toContain("<strong>bold text</strong>");
  });

  test("renderTiddler returns empty string for unknown title", () => {
    const html = tw.renderTiddler("lar:///DOES/NOT/EXIST");
    expect(html).toBe("");
  });

  test("renderText returns empty string before boot (simulated)", () => {
    const cold = new LarariumTW5();
    expect(cold.renderText("test")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// MemoryTiddlerStore
// ---------------------------------------------------------------------------

describe("MemoryTiddlerStore", () => {
  test("listVisible returns seeded titles (non-deleted)", async () => {
    const store = new MemoryTiddlerStore();
    store._seed({ title: "lar:///A", fields: {} });
    store._seed({ title: "lar:///B", fields: {}, deleted: true });
    const visible = await store.listVisible();
    expect(visible).toContain("lar:///A");
    expect(visible).not.toContain("lar:///B");
  });

  test("put adds record and fires subscriber", async () => {
    const store = new MemoryTiddlerStore();
    const changes: string[] = [];
    store.subscribe((c) => changes.push(c.title));

    const rec: LarTiddlerRecord = { title: "lar:///PUT", fields: { text: "hello" } };
    await store.put(rec, { kind: "tw-local", instanceId: "test" });

    expect((await store.get("lar:///PUT"))?.fields["text"]).toBe("hello");
    expect(changes).toContain("lar:///PUT");
  });

  test("tombstone marks deleted and fires subscriber with record: null", async () => {
    const store = new MemoryTiddlerStore();
    store._seed({ title: "lar:///TOMB", fields: {} });

    const changes: Array<{ title: string; record: LarTiddlerRecord | null }> = [];
    store.subscribe((c) => changes.push({ title: c.title, record: c.record }));

    await store.tombstone("lar:///TOMB", { kind: "tw-local", instanceId: "test" });

    const visible = await store.listVisible();
    expect(visible).not.toContain("lar:///TOMB");
    expect(changes[0]?.record).toBeNull();
  });

  test("subscribe returns working unsubscribe function", async () => {
    const store = new MemoryTiddlerStore();
    let callCount = 0;
    const unsub = store.subscribe(() => callCount++);
    store._seed({ title: "lar:///X", fields: {} });
    await store.put({ title: "lar:///X", fields: { v: "1" } }, { kind: "tw-local", instanceId: "t" });
    unsub();
    await store.put({ title: "lar:///X", fields: { v: "2" } }, { kind: "tw-local", instanceId: "t" });
    expect(callCount).toBe(1); // only the first put
  });
});

// ---------------------------------------------------------------------------
// LarariumCrdtSyncAdaptor — store bridge
// ---------------------------------------------------------------------------

describe("LarariumCrdtSyncAdaptor — store bridge", () => {
  test("saveTiddler calls store.put exactly once with tw-local origin", async () => {
    const store = new MemoryTiddlerStore();
    const inst = new LarariumTW5();
    await inst.boot();
    const adaptor = new LarariumCrdtSyncAdaptor(inst, store, "test-instance");

    const puts: Array<{ record: LarTiddlerRecord; origin: unknown }> = [];
    const origPut = store.put.bind(store);
    store.put = async (rec, origin) => { puts.push({ record: rec, origin }); return origPut(rec, origin); };

    await new Promise<void>((resolve, reject) => {
      adaptor.saveTiddler(
        { title: "lar:///SAVE/me", text: "content", register: "CS" },
        (err, _info, _rev) => { if (err) reject(err); else resolve(); },
      );
    });

    expect(puts).toHaveLength(1);
    expect((puts[0]!.origin as { kind: string }).kind).toBe("tw-local");
    expect((puts[0]!.origin as { instanceId: string }).instanceId).toBe("test-instance");
  });

  test("saveTiddler does not write session-local titles ($:/temp/*)", async () => {
    const store = new MemoryTiddlerStore();
    const inst = new LarariumTW5();
    await inst.boot();
    const adaptor = new LarariumCrdtSyncAdaptor(inst, store, "test-instance");

    let putCalled = false;
    store.put = async () => { putCalled = true; };

    await new Promise<void>((resolve) => {
      adaptor.saveTiddler({ title: "$:/temp/draft" }, (err) => resolve());
    });
    expect(putCalled).toBe(false);
  });

  test("saveTiddler does not write 'Draft of ...' titles", async () => {
    const store = new MemoryTiddlerStore();
    const inst = new LarariumTW5();
    await inst.boot();
    const adaptor = new LarariumCrdtSyncAdaptor(inst, store, "test-instance");

    let putCalled = false;
    store.put = async () => { putCalled = true; };

    await new Promise<void>((resolve) => {
      adaptor.saveTiddler({ title: "Draft of lar:///some/meme" }, () => resolve());
    });
    expect(putCalled).toBe(false);
  });

  test("deleteTiddler calls store.tombstone (not hard delete)", async () => {
    const store = new MemoryTiddlerStore();
    store._seed({ title: "lar:///DEL/me", fields: {} });
    const inst = new LarariumTW5();
    await inst.boot();
    const adaptor = new LarariumCrdtSyncAdaptor(inst, store, "test-instance");

    await new Promise<void>((resolve, reject) => {
      adaptor.deleteTiddler("lar:///DEL/me", (err) => { if (err) reject(err); else resolve(); });
    });

    const rec = await store.get("lar:///DEL/me");
    expect(rec?.deleted).toBe(true);
    const visible = await store.listVisible();
    expect(visible).not.toContain("lar:///DEL/me");
  });

  test("crdt-remote store change applies to TW5 wiki without echo into store.put", async () => {
    const store = new MemoryTiddlerStore();
    const inst = new LarariumTW5();
    await inst.boot();
    const adaptor = new LarariumCrdtSyncAdaptor(inst, store, "test-instance");
    const stopListening = adaptor.start();

    let putCallCount = 0;
    const origPut = store.put.bind(store);
    store.put = async (rec, origin) => { putCallCount++; return origPut(rec, origin); };

    // Simulate a remote CRDT change arriving in the store
    const remote: LarTiddlerRecord = { title: "lar:///REMOTE", fields: { register: "DS" }, text: "from remote" };
    await origPut(remote, { kind: "crdt-remote", edgeIsland: "edge:a:b:1" });

    // Give the sync adaptor time to process (it's synchronous but triggered by subscribe callback)
    await new Promise((r) => setTimeout(r, 0));

    // TW5 wiki should have the tiddler
    const found = inst.filterTiddlers("[all[tiddlers]field:register[DS]]");
    expect(found).toContain("lar:///REMOTE");

    // store.put must NOT have been called by the adaptor (no echo)
    expect(putCallCount).toBe(0);

    stopListening();
  });

  test("getUpdatedTiddlers reports and clears pending modifications", async () => {
    const store = new MemoryTiddlerStore();
    const inst = new LarariumTW5();
    await inst.boot();
    const adaptor = new LarariumCrdtSyncAdaptor(inst, store, "test-instance");
    const stop = adaptor.start();

    // Remote change arrives
    await store.put(
      { title: "lar:///UPD", fields: {} },
      { kind: "crdt-remote", edgeIsland: "edge:a:b:1" },
    );
    await new Promise((r) => setTimeout(r, 0));

    const updates = await new Promise<{ modifications: string[]; deletions: string[] }>((resolve) => {
      adaptor.getUpdatedTiddlers({}, (err, u) => resolve(u));
    });
    expect(updates.modifications).toContain("lar:///UPD");

    // Second call should be empty (cleared)
    const updates2 = await new Promise<{ modifications: string[]; deletions: string[] }>((resolve) => {
      adaptor.getUpdatedTiddlers({}, (err, u) => resolve(u));
    });
    expect(updates2.modifications).toHaveLength(0);

    stop();
  });
});

// ---------------------------------------------------------------------------
// Package boundary — FilterEngineFn import from @lararium/core
// ---------------------------------------------------------------------------

describe("package boundary", () => {
  test("FilterEngineFn type round-trips correctly (functional test)", async () => {
    // Verify that filterMemesWikitext satisfies FilterEngineFn by calling it
    // with the expected signature. If types are wrong this won't compile.
    const { filterMemesWikitext } = await import("../src/lararium-tw5.js");
    const result = await filterMemesWikitext([], "[all[memes]]");
    expect(Array.isArray(result)).toBe(true);
  });
});
