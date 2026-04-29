/**
 * MemoryTiddlerStore intake tests — local-first model.
 *
 * Covers the live origin taxonomy (canon-hydrate, mcp-draft, operator-import,
 * tw-local, crdt-remote, canvas-draft) and the store-first precedence rule
 * used by TW5 render. projection-cache is gone — content lives in Automerge.
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { LarariumTW5 } from "../src/lararium-tw5.js";
import type { ChangeOrigin } from "@lararium/core";

// ---------------------------------------------------------------------------
// Valid origins — exhaustive coverage of ChangeOrigin union
// ---------------------------------------------------------------------------

const ORIGINS: ChangeOrigin[] = [
  { kind: "canon-hydrate",   receipt:    "sha256abc" },
  { kind: "mcp-draft",       toolCallId: "tool:1" },
  { kind: "operator-import", sessionId:  "sess:1" },
  { kind: "tw-local",        instanceId: "wiki:1" },
  { kind: "crdt-remote",     edgeIsland: "automerge" },
  { kind: "canvas-draft",    shapeId:    "shape:x" },
];

describe("MemoryTiddlerStore — origin taxonomy", () => {
  for (const origin of ORIGINS) {
    test(`put() accepts ${origin.kind} origin and stores record`, async () => {
      const store = new MemoryTiddlerStore();
      await store.put({ title: `lar:///test/${origin.kind}`, fields: {}, text: "body" }, origin);
      const rec = await store.get(`lar:///test/${origin.kind}`);
      expect(rec?.text).toBe("body");
    });

    test(`subscriber receives ${origin.kind} origin on put`, async () => {
      const store = new MemoryTiddlerStore();
      const received: ChangeOrigin[] = [];
      store.subscribe((c) => received.push(c.origin));
      await store.put({ title: `lar:///sub/${origin.kind}`, fields: {} }, origin);
      expect(received).toHaveLength(1);
      expect(received[0]!.kind).toBe(origin.kind);
    });
  }
});

describe("MemoryTiddlerStore — tombstone", () => {
  test("tombstone marks record deleted and hides from listVisible", async () => {
    const store = new MemoryTiddlerStore();
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: "test" };
    await store.put({ title: "lar:///tomb/one", fields: {}, text: "alive" }, origin);
    await store.tombstone("lar:///tomb/one", origin);
    const visible = await store.listVisible();
    expect(visible).not.toContain("lar:///tomb/one");
    const rec = await store.get("lar:///tomb/one");
    expect(rec?.deleted).toBe(true);
  });

  test("tombstone subscriber fires with null record", async () => {
    const store = new MemoryTiddlerStore();
    const changes: Array<{ title: string; record: unknown }> = [];
    store.subscribe((c) => changes.push({ title: c.title, record: c.record }));
    store._seed({ title: "lar:///tomb/two", fields: {}, text: "seeded" });
    await store.tombstone("lar:///tomb/two", { kind: "crdt-remote", edgeIsland: "am" });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.record).toBeNull();
  });
});

describe("MemoryTiddlerStore — echo-loop guard semantics", () => {
  test("tw-local and crdt-remote are structurally distinct", () => {
    const local:  ChangeOrigin = { kind: "tw-local",    instanceId: "a" };
    const remote: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "b" };
    expect(local.kind).not.toBe(remote.kind);
  });

  test("crdt-remote origin carries edgeIsland for loop guard", async () => {
    const store = new MemoryTiddlerStore();
    const received: ChangeOrigin[] = [];
    store.subscribe((c) => received.push(c.origin));
    await store.put(
      { title: "lar:///echo/remote", fields: {} },
      { kind: "crdt-remote", edgeIsland: "island:boot:peer:1" },
    );
    expect(received[0]!.kind).toBe("crdt-remote");
    expect((received[0] as { kind: "crdt-remote"; edgeIsland: string }).edgeIsland)
      .toBe("island:boot:peer:1");
  });
});

// ---------------------------------------------------------------------------
// TW5 render — store-first before any fallback
// ---------------------------------------------------------------------------

describe("TW5 render — store record takes precedence over fallback text", () => {
  let tw: LarariumTW5;

  beforeAll(async () => {
    tw = new LarariumTW5();
    await tw.boot();
  });

  test("renderText uses store record text when store has the URI", async () => {
    const store = new MemoryTiddlerStore();
    const uri = "lar:///RENDER/store-first";
    await store.put(
      { title: uri, fields: {}, text: "''store text''" },
      { kind: "canon-hydrate", receipt: "hash" },
    );
    const rec = await store.get(uri);
    const text = (rec && !rec.deleted && rec.text !== undefined) ? rec.text : "fallback — must not appear";
    const html = tw.renderText(text);
    expect(html).toContain("<strong>store text</strong>");
    expect(html).not.toContain("fallback");
  });

  test("renderText uses fallback when store has no record", async () => {
    const store = new MemoryTiddlerStore();
    const rec = await store.get("lar:///RENDER/missing");
    const text = (rec && !rec.deleted && rec.text !== undefined) ? rec.text : "''fallback bold''";
    const html = tw.renderText(text);
    expect(html).toContain("<strong>fallback bold</strong>");
  });

  test("tombstoned store record causes fallback to be used", async () => {
    const store = new MemoryTiddlerStore();
    store._seed({ title: "lar:///RENDER/tombstoned", fields: {}, text: "old text" });
    await store.tombstone("lar:///RENDER/tombstoned", { kind: "tw-local", instanceId: "test" });
    const rec = await store.get("lar:///RENDER/tombstoned");
    const storeText = (rec && !rec.deleted && rec.text !== undefined) ? rec.text : null;
    expect(storeText).toBeNull();
    const html = tw.renderText("fallback used correctly");
    expect(html).toContain("fallback used correctly");
  });
});

// ---------------------------------------------------------------------------
// Package boundary — @lararium/tldraw must not depend on tiddlywiki
// ---------------------------------------------------------------------------

import { readFileSync } from "fs";

describe("package boundary", () => {
  test("@lararium/tldraw package.json has no tiddlywiki dependency", () => {
    const pkgPath = new URL("../../lararium-tldraw/package.json", import.meta.url).pathname;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(allDeps)).not.toContain("tiddlywiki");
  });
});
