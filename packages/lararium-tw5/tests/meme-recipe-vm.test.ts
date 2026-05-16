/**
 * meme-recipe-vm — unit tests for DirectMemeRecipeVm priority-correct behaviour.
 *
 * TW5 Bags and Recipes law: "the tiddler from the highest priority bag will be
 * used as the recipe tiddler."  DirectMemeRecipeVm must honour this when
 * CRDT delta events arrive out of priority order.
 *
 * These tests use a minimal stub of TW5Engine — no real TW5 boot required.
 * The stub tracks setTiddler / removeTiddler calls and exposes getTiddlerField
 * so the priority gate can query the current wiki state.
 */

import { describe, test, expect } from "vitest";
import { DirectMemeRecipeVm } from "../src/meme-recipe-vm.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LarTiddlerChange, ChangeOrigin } from "@lararium/mesh";

// ---------------------------------------------------------------------------
// Minimal TW5Engine stub — only the surface used by DirectMemeRecipeVm
// ---------------------------------------------------------------------------

type TiddlerRecord = Record<string, string | string[]>;

class FakeWiki {
  private _store = new Map<string, TiddlerRecord>();

  set(fields: TiddlerRecord): void {
    this._store.set(String(fields["title"] ?? ""), fields);
  }

  remove(title: string): void {
    this._store.delete(title);
  }

  field(title: string, field: string): string | undefined {
    return this._store.get(title)?.[field] as string | undefined;
  }

  has(title: string): boolean {
    return this._store.has(title);
  }

  get(title: string): TiddlerRecord | undefined {
    return this._store.get(title);
  }
}

function makeEngine(): { engine: TW5Engine; wiki: FakeWiki } {
  const wiki = new FakeWiki();
  class FakeTiddler {
    fields: TiddlerRecord;
    constructor(fields: TiddlerRecord) { this.fields = fields; }
  }
  const engine = {
    $tw: {
      Tiddler: FakeTiddler,
      wiki: {
        addTiddler: (tiddler: { fields: TiddlerRecord } | TiddlerRecord) => {
          wiki.set("fields" in tiddler ? tiddler.fields : tiddler);
        },
        deleteTiddler: (title: string) => wiki.remove(title),
        getTiddler: (title: string) => {
          const fields = wiki.get(title);
          return fields ? { fields } : undefined;
        },
        filterTiddlers: () => [],
      },
    },
    setTiddler: (fields: TiddlerRecord) => wiki.set(fields),
    removeTiddler: (title: string) => wiki.remove(title),
    getTiddlerField: (title: string, field: string) => wiki.field(title, field),
    filterTiddlers: () => [],
    renderMeme: async () => null,
    dispose: () => undefined,
  } as unknown as TW5Engine;
  return { engine, wiki };
}

function putChange(title: string, bag: string, text = "v1"): LarTiddlerChange {
  const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: bag };
  return {
    title,
    record: { title, fields: { bag }, text },
    origin,
  };
}

function tombstoneChange(title: string): LarTiddlerChange {
  return {
    title,
    record: null,
    origin: { kind: "canon-hydrate", receipt: "test" },
  };
}

// ---------------------------------------------------------------------------
// bagStack ordering: index 0 = lowest, length-1 = highest
// ---------------------------------------------------------------------------

const LOW_BAG  = "lar:///ha.ka.ba/@lararium";   // priority index 0
const HIGH_BAG = "lar:///ha.ka.ba/@catalog";     // priority index 1

describe("DirectMemeRecipeVm — priority-correct conflict resolution", () => {
  test("higher-priority bag update is applied", () => {
    const { engine, wiki } = makeEngine();
    const vm = new DirectMemeRecipeVm(engine, [LOW_BAG, HIGH_BAG]);
    vm.onUriChanged(putChange("foo", HIGH_BAG, "high-version"));
    expect(wiki.has("foo")).toBe(true);
    expect(wiki.field("foo", "bag")).toBe(HIGH_BAG);
  });

  test("lower-priority bag update does NOT overwrite an existing higher-priority version", () => {
    const { engine, wiki } = makeEngine();
    const vm = new DirectMemeRecipeVm(engine, [LOW_BAG, HIGH_BAG]);
    // High-priority version arrives first
    vm.onUriChanged(putChange("foo", HIGH_BAG, "high-version"));
    expect(wiki.field("foo", "bag")).toBe(HIGH_BAG);
    // Low-priority update arrives later (e.g. async CRDT delta)
    vm.onUriChanged(putChange("foo", LOW_BAG, "low-version"));
    // High-priority version must survive
    expect(wiki.field("foo", "bag")).toBe(HIGH_BAG);
  });

  test("higher-priority bag CAN overwrite an existing lower-priority version", () => {
    const { engine, wiki } = makeEngine();
    const vm = new DirectMemeRecipeVm(engine, [LOW_BAG, HIGH_BAG]);
    // Low-priority lands first
    vm.onUriChanged(putChange("bar", LOW_BAG, "low-first"));
    expect(wiki.field("bar", "bag")).toBe(LOW_BAG);
    // High-priority arrives — should overwrite
    vm.onUriChanged(putChange("bar", HIGH_BAG, "high-wins"));
    expect(wiki.field("bar", "bag")).toBe(HIGH_BAG);
  });

  test("tiddler from bag outside the configured stack is rejected", () => {
    const { engine, wiki } = makeEngine();
    const OTHER_BAG = "lar:///ha.ka.ba/@lares"; // not in stack
    const vm = new DirectMemeRecipeVm(engine, [LOW_BAG, HIGH_BAG]);
    vm.onUriChanged(putChange("baz", OTHER_BAG));
    expect(wiki.has("baz")).toBe(false);
  });

  test("tombstone removes tiddler regardless of bag", () => {
    const { engine, wiki } = makeEngine();
    const vm = new DirectMemeRecipeVm(engine, [LOW_BAG, HIGH_BAG]);
    vm.onUriChanged(putChange("qux", HIGH_BAG));
    expect(wiki.has("qux")).toBe(true);
    vm.onUriChanged(tombstoneChange("qux"));
    expect(wiki.has("qux")).toBe(false);
  });

  test("no bagStack configured — all puts pass through", () => {
    const { engine, wiki } = makeEngine();
    const vm = new DirectMemeRecipeVm(engine); // no bagStack
    vm.onUriChanged(putChange("any", "lar:///ha.ka.ba/@arbitrary"));
    expect(wiki.has("any")).toBe(true);
  });

  test("same-priority bag same title — last update wins (CRDT last-write semantics)", () => {
    const { engine, wiki } = makeEngine();
    // Only one bag — no priority conflict possible
    const vm = new DirectMemeRecipeVm(engine, [LOW_BAG]);
    vm.onUriChanged(putChange("same", LOW_BAG, "v1"));
    vm.onUriChanged(putChange("same", LOW_BAG, "v2"));
    // v2 overwrites v1 — same bag, same priority
    expect(wiki.get("same")?.["text"]).toBe("v2");
  });
});
