/**
 * Residency Model Sprint 3 — resolveAll / resolveTopmost on CompositeStore.
 *
 * Surfaces the multi-bag residency that already runs inside CompositeStore
 * (listBagsHolding existed pre-sprint; resolveAll/resolveTopmost return
 * (bagId, record) pairs for operator-visible coordinate inspection).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model
 */

import { describe, test, expect } from "vitest";
import { CompositeStore } from "../src/composite-store.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { headsEqual } from "../src/wiki-recipe.js";
import type { LarTiddlerRecord, ChangeOrigin } from "../src/tiddler-store.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HIGH = "lar:///ha.ka.ba/bags/high";
const MID  = "lar:///ha.ka.ba/bags/mid";
const LOW  = "lar:///ha.ka.ba/bags/low";

function rec(title: string, text: string): LarTiddlerRecord {
  return { tiddler: { title, text } };
}

function origin(bagId: string): ChangeOrigin {
  return { kind: "crdt-remote", edgeIsland: bagId };
}

async function makeStoreWithLayers(): Promise<CompositeStore> {
  const composite = new CompositeStore();
  // Layers added lowest-priority → highest-priority (composite-store convention).
  // All three mark `writable: true` so the test can route explicit-bag writes
  // to any layer. `defaultWritable: false` on LOW/MID preserves HIGH as the
  // default writable for unbagged writes — matches normal recipe semantics
  // (wiki bag at top is the default writable; canon bags accept explicit
  // ceremony-routed writes but don't override the default).
  composite.addLayer({ bagId: LOW,  store: new MemoryTiddlerStore(), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: MID,  store: new MemoryTiddlerStore(), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: HIGH, store: new MemoryTiddlerStore(), writable: true });
  return composite;
}

// ---------------------------------------------------------------------------
// resolveAll
// ---------------------------------------------------------------------------

describe("CompositeStore.resolveAll", () => {
  test("returns empty when no layer holds the title", async () => {
    const store = await makeStoreWithLayers();
    expect(await store.resolveAll("missing")).toEqual([]);
  });

  test("returns one entry when only one layer holds the title", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("solo", "from-high"), origin(HIGH), { bag: HIGH });
    const result = await store.resolveAll("solo");
    expect(result).toHaveLength(1);
    expect(result[0]!.bagId).toBe(HIGH);
    expect((result[0]!.record.tiddler as Record<string, unknown>)["text"]).toBe("from-high");
  });

  test("returns multiple entries in highest-priority-first order when multiple bags hold the title", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("shared", "low-version"),  origin(LOW),  { bag: LOW });
    await store.put(rec("shared", "mid-version"),  origin(MID),  { bag: MID });
    await store.put(rec("shared", "high-version"), origin(HIGH), { bag: HIGH });
    const result = await store.resolveAll("shared");
    expect(result.map((r) => r.bagId)).toEqual([HIGH, MID, LOW]);
    expect((result[0]!.record.tiddler as Record<string, unknown>)["text"]).toBe("high-version");
    expect((result[2]!.record.tiddler as Record<string, unknown>)["text"]).toBe("low-version");
  });

  test("skips tombstoned layers (live residency only)", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("partial", "low-live"),  origin(LOW),  { bag: LOW });
    await store.put(rec("partial", "mid-live"),  origin(MID),  { bag: MID });
    await store.tombstoneInBag(MID, "partial", origin(MID));
    const result = await store.resolveAll("partial");
    // MID tombstoned; LOW remains live.
    expect(result.map((r) => r.bagId)).toEqual([LOW]);
  });
});

// ---------------------------------------------------------------------------
// resolveTopmost
// ---------------------------------------------------------------------------

describe("CompositeStore.resolveTopmost", () => {
  test("returns null when no layer holds the title", async () => {
    const store = await makeStoreWithLayers();
    expect(await store.resolveTopmost("missing")).toBeNull();
  });

  test("returns the highest-priority bag when multiple hold the title", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("shared", "low-version"),  origin(LOW),  { bag: LOW });
    await store.put(rec("shared", "high-version"), origin(HIGH), { bag: HIGH });
    const top = await store.resolveTopmost("shared");
    expect(top?.bagId).toBe(HIGH);
    expect((top?.record.tiddler as Record<string, unknown>)["text"]).toBe("high-version");
  });

  test("absent in HIGH (no put) falls through to the next live layer below", async () => {
    // Truly-absent (not tombstoned) in HIGH falls through. Distinct from the
    // tombstone-shadow case (covered in the kāpae describe block).
    const store = await makeStoreWithLayers();
    await store.put(rec("partial", "mid-live"), origin(MID), { bag: MID });
    // HIGH has no record at all for "partial".
    const top = await store.resolveTopmost("partial");
    expect(top?.bagId).toBe(MID);
  });

  test("agrees with resolveAll's first entry when one exists", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("x", "mid"), origin(MID), { bag: MID });
    await store.put(rec("x", "high"), origin(HIGH), { bag: HIGH });
    const all = await store.resolveAll("x");
    const top = await store.resolveTopmost("x");
    expect(top?.bagId).toBe(all[0]!.bagId);
  });
});

// ---------------------------------------------------------------------------
// Multi-bag residency invariants
// ---------------------------------------------------------------------------

describe("multi-bag residency invariants (residency model)", () => {
  test("same title in N bags carries N independent Manifestations", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("shared", "a"), origin(LOW),  { bag: LOW });
    await store.put(rec("shared", "b"), origin(MID),  { bag: MID });
    await store.put(rec("shared", "c"), origin(HIGH), { bag: HIGH });
    const result = await store.resolveAll("shared");
    expect(result).toHaveLength(3);
    // Each bag carries its own version — independent Manifestations.
    const texts = result.map((r) => (r.record.tiddler as Record<string, unknown>)["text"]);
    expect(texts).toEqual(["c", "b", "a"]);
  });

  test("listBagsHolding agrees with resolveAll bag ordering", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("shared", "a"), origin(LOW),  { bag: LOW });
    await store.put(rec("shared", "b"), origin(HIGH), { bag: HIGH });
    const bags = await store.listBagsHolding("shared");
    const resolved = await store.resolveAll("shared");
    expect(bags).toEqual(resolved.map((r) => r.bagId));
  });
});

// ---------------------------------------------------------------------------
// headsEqual (Spirit 1 finding: heads form a set, not an array)
// ---------------------------------------------------------------------------

describe("headsEqual (set-semantic equality)", () => {
  test("empty arrays match", () => {
    expect(headsEqual([], [])).toBe(true);
  });

  test("identical arrays match", () => {
    expect(headsEqual(["a"], ["a"])).toBe(true);
    expect(headsEqual(["a", "b"], ["a", "b"])).toBe(true);
  });

  test("differently-ordered arrays match (set-semantics)", () => {
    expect(headsEqual(["a", "b"], ["b", "a"])).toBe(true);
    expect(headsEqual(["c", "a", "b"], ["a", "b", "c"])).toBe(true);
  });

  test("different lengths never match", () => {
    expect(headsEqual(["a"], ["a", "b"])).toBe(false);
    expect(headsEqual([], ["a"])).toBe(false);
  });

  test("different members never match", () => {
    expect(headsEqual(["a"], ["b"])).toBe(false);
    expect(headsEqual(["a", "b"], ["a", "c"])).toBe(false);
  });

  test("reference equality short-circuits", () => {
    const h: readonly string[] = ["a", "b"];
    expect(headsEqual(h, h)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Kāpae semantics (S4.3 — Anti-pattern #3 defense)
// ---------------------------------------------------------------------------

describe("kāpae — tombstone in higher bag stops cascade", () => {
  test("resolveTopmost returns null when HIGH tombstones a title that MID/LOW hold live", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "low-live"), origin(LOW), { bag: LOW });
    await store.put(rec("T", "mid-live"), origin(MID), { bag: MID });
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    // Operator deaccessions T in HIGH.
    await store.tombstoneInBag(HIGH, "T", origin(HIGH));
    // Kāpae: HIGH's tombstone stops the cascade.
    const top = await store.resolveTopmost("T");
    expect(top).toBeNull();
  });

  test("getLive returns null under the same kāpae", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "low-live"), origin(LOW), { bag: LOW });
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    await store.tombstoneInBag(HIGH, "T", origin(HIGH));
    expect(await store.getLive("T")).toBeNull();
  });

  test("absent in HIGH (no record at all) falls through to MID — distinct from tombstone", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "mid-live"), origin(MID), { bag: MID });
    // HIGH has NO record for T at all (not a tombstone — truly absent).
    const top = await store.resolveTopmost("T");
    expect(top?.bagId).toBe(MID);
  });

  test("tombstone in MID with live HIGH returns HIGH (cascade not yet shadowed)", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    await store.put(rec("T", "mid-live"), origin(MID), { bag: MID });
    await store.tombstoneInBag(MID, "T", origin(MID));
    // HIGH is live; tombstone in MID does not affect HIGH-priority read.
    const top = await store.resolveTopmost("T");
    expect(top?.bagId).toBe(HIGH);
  });

  test("resolveAll stays a presence report — shows live bags even when HIGH places kāpae", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "low-live"), origin(LOW), { bag: LOW });
    await store.put(rec("T", "mid-live"), origin(MID), { bag: MID });
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    await store.tombstoneInBag(HIGH, "T", origin(HIGH));
    // resolveAll = presence report (skips tombstones, returns live versions).
    const all = await store.resolveAll("T");
    expect(all.map((r) => r.bagId).sort()).toEqual([LOW, MID].sort());
  });

  test("listKapaeBags reports which bags explicitly hide a title", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "low-live"), origin(LOW), { bag: LOW });
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    await store.tombstoneInBag(HIGH, "T", origin(HIGH));
    expect(await store.listKapaeBags("T")).toEqual([HIGH]);
  });

  test("listKapaeBags returns empty when no bag tombstones the title", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    expect(await store.listKapaeBags("T")).toEqual([]);
  });

  test("listKapaeBags orders highest-priority-first", async () => {
    const store = await makeStoreWithLayers();
    await store.put(rec("T", "mid-live"), origin(MID), { bag: MID });
    await store.put(rec("T", "high-live"), origin(HIGH), { bag: HIGH });
    await store.tombstoneInBag(MID, "T", origin(MID));
    await store.tombstoneInBag(HIGH, "T", origin(HIGH));
    expect(await store.listKapaeBags("T")).toEqual([HIGH, MID]);
  });
});
