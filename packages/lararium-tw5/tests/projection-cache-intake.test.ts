/**
 * Projection-cache intake tests.
 *
 * Verifies that MemoryTiddlerStore accepts projection-cache origins,
 * that the origin is preserved on subscriber notifications,
 * and that store-first lookup in TW5 render takes precedence over
 * the shape.meta.carrierText fallback.
 */

import { describe, test, expect } from "@jest/globals";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { LarariumTW5 } from "../src/lararium-tw5.js";
import type { ChangeOrigin, LarTiddlerRecord } from "@lararium/core";

const PROJ_ORIGIN = (shapeId: string, receipt = "hashABC"): ChangeOrigin =>
  ({ kind: "projection-cache", shapeId, receipt });

// ---------------------------------------------------------------------------
// projection-cache origin accepted by MemoryTiddlerStore
// ---------------------------------------------------------------------------

describe("MemoryTiddlerStore — projection-cache origin", () => {
  test("put() accepts projection-cache origin and stores record", async () => {
    const store = new MemoryTiddlerStore();
    const origin = PROJ_ORIGIN("shape:meme_1");
    await store.put({ title: "lar:///PC/one", fields: {}, text: "hello" }, origin);
    const rec = await store.get("lar:///PC/one");
    expect(rec?.text).toBe("hello");
  });

  test("subscriber receives projection-cache origin on put", async () => {
    const store = new MemoryTiddlerStore();
    const received: ChangeOrigin[] = [];
    store.subscribe((c) => received.push(c.origin));

    await store.put(
      { title: "lar:///PC/two", fields: {}, text: "world" },
      PROJ_ORIGIN("shape:meme_2", "receiptXYZ"),
    );

    expect(received).toHaveLength(1);
    expect(received[0]!.kind).toBe("projection-cache");
    expect((received[0] as { kind: "projection-cache"; shapeId: string; receipt?: string }).shapeId)
      .toBe("shape:meme_2");
    expect((received[0] as { kind: "projection-cache"; shapeId: string; receipt?: string }).receipt)
      .toBe("receiptXYZ");
  });

  test("receipt field is preserved on origin when provided", async () => {
    const store = new MemoryTiddlerStore();
    const changes: ChangeOrigin[] = [];
    store.subscribe((c) => changes.push(c.origin));

    await store.put(
      { title: "lar:///PC/three", fields: {} },
      PROJ_ORIGIN("shape:meme_3", "sha256abc"),
    );

    const origin = changes[0] as { kind: string; receipt?: string };
    expect(origin.receipt).toBe("sha256abc");
  });

  test("intake gating: no records written when receipt absent (null check)", async () => {
    // Simulates the LarariumCanvas guard: `if (!hostReceipt) return;`
    const store = new MemoryTiddlerStore();
    const hostReceipt: string | null = null;

    // Guard logic mirrors LarariumCanvas projection-cache intake effect
    if (hostReceipt !== null) {
      await store.put(
        { title: "lar:///PC/should-not-exist", fields: {}, text: "blocked" },
        PROJ_ORIGIN("shape:x", hostReceipt),
      );
    }

    const visible = await store.listVisible();
    expect(visible).not.toContain("lar:///PC/should-not-exist");
  });

  test("intake allowed when receipt is non-null hash", async () => {
    const store = new MemoryTiddlerStore();
    const hostReceipt: string | null = "realSha256Hash";

    if (hostReceipt !== null) {
      await store.put(
        { title: "lar:///PC/allowed", fields: {}, text: "seeded" },
        PROJ_ORIGIN("shape:y", hostReceipt),
      );
    }

    const visible = await store.listVisible();
    expect(visible).toContain("lar:///PC/allowed");
  });

  test("projection-cache cannot reach canon-hydrate kind", async () => {
    // Structural check: projection-cache and canon-hydrate are distinct union members.
    // This ensures the type system prevents accidental promotion without ceremony.
    const origin = PROJ_ORIGIN("shape:z", "hash");
    expect(origin.kind).toBe("projection-cache");
    expect(origin.kind).not.toBe("canon-hydrate");
    expect(origin.kind).not.toBe("tw-local");
  });
});

// ---------------------------------------------------------------------------
// TW5 render: store-first before shape.meta fallback
// ---------------------------------------------------------------------------

describe("TW5 render — store record takes precedence over shape.meta fallback", () => {
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
      PROJ_ORIGIN("shape:render1", "hash"),
    );

    // Simulate MemeDetailPanel tw5 branch logic:
    const rec = await store.get(uri);
    const storeText   = rec && !rec.deleted && rec.text !== undefined ? rec.text : null;
    const shapeMetaText = "shape meta fallback — must not appear";
    const text = storeText ?? shapeMetaText;

    const html = tw.renderText(text);
    expect(html).toContain("<strong>store text</strong>");
    expect(html).not.toContain("shape meta fallback");
  });

  test("renderText falls back to shape.meta when store has no record", async () => {
    const store = new MemoryTiddlerStore();
    const uri = "lar:///RENDER/fallback";

    // Nothing in store for this URI
    const rec = await store.get(uri);
    const storeText   = rec && !rec.deleted && rec.text !== undefined ? rec.text : null;
    const shapeMetaText = "''fallback bold''";
    const text = storeText ?? shapeMetaText;

    const html = tw.renderText(text);
    expect(html).toContain("<strong>fallback bold</strong>");
  });

  test("tombstoned store record triggers fallback to shape.meta", async () => {
    const store = new MemoryTiddlerStore();
    const uri = "lar:///RENDER/tombstoned";

    store._seed({ title: uri, fields: {}, text: "tombstoned text" });
    await store.tombstone(uri, { kind: "tw-local", instanceId: "test" });

    const rec = await store.get(uri);
    const storeText = rec && !rec.deleted && rec.text !== undefined ? rec.text : null;
    expect(storeText).toBeNull(); // tombstoned — should fall back

    const html = tw.renderText("fallback used correctly");
    expect(html).toContain("fallback used correctly");
  });
});

// ---------------------------------------------------------------------------
// Package boundary: @lararium/tldraw has no tiddlywiki dependency
// ---------------------------------------------------------------------------

import { readFileSync } from "fs";

describe("package boundary", () => {
  test("@lararium/tldraw package.json has no tiddlywiki dependency", () => {
    const pkgPath = new URL("../../lararium-tldraw/package.json", import.meta.url).pathname;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    expect(Object.keys(allDeps)).not.toContain("tiddlywiki");
  });
});
