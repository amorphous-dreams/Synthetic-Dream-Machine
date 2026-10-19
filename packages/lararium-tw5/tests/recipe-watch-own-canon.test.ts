import { describe, test, expect, vi } from "vitest";
import { CompositeStore, TEMP_BAG, LARES_BAG, LARARIUM_BAG, ORACLE_BAG, wikiBagUri, recipeUri, type DocHandle, type LarDoc, type LarTiddlerRecord, type Repo } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { startRecipeWatch } from "../src/recipe-watch.js";
import type { IslandContext } from "../src/island-context.js";

const SLUG = "lares";
const OWN = wikiBagUri(SLUG);
const RECIPE = recipeUri("oracle", SLUG);
type Records = Record<string, LarTiddlerRecord>;
const rec = (title: string, fields: Record<string, string> = {}): LarTiddlerRecord => ({ tiddler: { title, ...fields } });

function fakeHandle(url: string, tiddlers: Records = {}) {
  const listeners = new Set<(p: { patches: unknown[] }) => void>();
  const handle = { url, doc: () => ({ tiddlers }), whenReady: async () => {}, isUnavailable: () => false,
    on: (_e: string, f: (p: { patches: unknown[] }) => void) => listeners.add(f),
    off: (_e: string, f: (p: { patches: unknown[] }) => void) => listeners.delete(f) } as unknown as DocHandle<LarDoc>;
  const set = (title: string, value: LarTiddlerRecord) => { tiddlers[title] = value; for (const f of [...listeners]) f({ patches: [] }); };
  return { handle, tiddlers, set };
}

function harness() {
  const lares = fakeHandle("automerge:lares-A");
  const library = fakeHandle("automerge:lararium-1");
  const oracle = fakeHandle("automerge:oracle", {
    [LARES_BAG]: rec(LARES_BAG, { text: lares.handle.url }),
    [LARARIUM_BAG]: rec(LARARIUM_BAG, { text: library.handle.url }),
    [RECIPE]: rec(RECIPE, { "bag-stack": `${ORACLE_BAG} ${LARARIUM_BAG} ${LARES_BAG}` }),
  });
  const byUrl = new Map<string, DocHandle<LarDoc>>([["automerge:oracle", oracle.handle], [lares.handle.url, lares.handle], [library.handle.url, library.handle]]);
  const repo = { find: async (url: string) => { const found = byUrl.get(url); if (!found) throw new Error(`no fake doc at ${url}`); return found; } } as unknown as Repo;
  const composite = new CompositeStore();
  for (const [bagId, writable] of [[ORACLE_BAG, false], [LARARIUM_BAG, true], [LARES_BAG, true]] as const) {
    const store = new MemoryTiddlerStore(bagId);
    composite.addLayer({ bagId, store, writable, defaultWritable: false });
  }
  composite.addLayer({ bagId: TEMP_BAG, store: new MemoryTiddlerStore(TEMP_BAG), writable: true, defaultWritable: true });
  const handles = new Map<string, DocHandle<LarDoc>>([[LARARIUM_BAG, library.handle], [LARES_BAG, lares.handle]]);
  const events: unknown[] = [];
  const ctx = { composite, handles, repo, oracleUrl: "automerge:oracle", catalogUrl: null, recipe: { wikiSlug: SLUG },
    post: (event: unknown) => events.push(event), engine: { sha256: "x", version: "0" } } as unknown as IslandContext;
  return { ctx, composite, handles, oracle, lares, library, events, register: (url: string, h: ReturnType<typeof fakeHandle>) => byUrl.set(url, h.handle) };
}

/** The own canon's move SETTLES when the watch either holds it (it says so) or acts on it (the layer leaves, or its handle
 *  re-points): the one predicate reads both the faulty shape and the held one, so neither waits on a timeout. */
const ownCanonSettled = (h: ReturnType<typeof harness>, log: ReturnType<typeof vi.spyOn>) => vi.waitFor(() => {
  const held = log.mock.calls.some((c) => String(c[0]).includes("[recipe-watch] lares: layer lar:///ha.ka.ba/bags/lares held at"));
  const acted = !h.composite.hasBag(LARES_BAG) || h.ctx.handles.get(LARES_BAG)?.url !== "automerge:lares-A";
  expect(held || acted).toBe(true);
});

const unresolvedEvent = (h: ReturnType<typeof harness>, bag: string) => vi.waitFor(() => {
  expect(h.events.some((e) => JSON.stringify(e).includes(`recipe-watch:bag-unresolved`) && JSON.stringify(e).includes(bag))).toBe(true);
});

describe("recipe-watch: own canon and unresolved oracle moves", () => {
  test("own canon remains resident when its moved oracle pointer cannot resolve", async () => {
    const h = harness(); const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const stop = await startRecipeWatch(h.ctx);
    h.oracle.set(LARES_BAG, rec(LARES_BAG, { text: "automerge:lares-C" }));
    await ownCanonSettled(h, log);
    expect(h.composite.hasWritableBag(LARES_BAG)).toBe(true);
    expect(h.ctx.handles.get(LARES_BAG)?.url).toBe("automerge:lares-A");
    stop?.(); log.mockRestore();
  });

  test("own canon holds its URL when the shared oracle points elsewhere", async () => {
    const h = harness(); const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const moved = fakeHandle("automerge:lares-C"); h.register(moved.handle.url, moved);
    const stop = await startRecipeWatch(h.ctx);
    h.oracle.set(LARES_BAG, rec(LARES_BAG, { text: moved.handle.url }));
    await ownCanonSettled(h, log);
    expect(h.composite.hasWritableBag(LARES_BAG)).toBe(true);
    expect(h.ctx.handles.get(LARES_BAG)?.url).toBe("automerge:lares-A");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[recipe-watch] lares: layer lar:///ha.ka.ba/bags/lares held at automerge:lares-A"));
    stop?.(); log.mockRestore();
  });

  test("library layer survives an unresolved pointer move", async () => {
    const h = harness(); const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const stop = await startRecipeWatch(h.ctx);
    h.oracle.set(LARARIUM_BAG, rec(LARARIUM_BAG, { text: "automerge:lararium-C" }));
    await unresolvedEvent(h, LARARIUM_BAG);
    expect(h.composite.hasBag(LARARIUM_BAG)).toBe(true);
    expect(h.ctx.handles.get(LARARIUM_BAG)?.url).toBe("automerge:lararium-1");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[recipe-watch] lares: layer lar:///ha.ka.ba/bags/lararium kept at automerge:lararium-1"));
    stop?.(); log.mockRestore();
  });

  test("control: a resolvable library move swaps at its existing layer index", async () => {
    const h = harness(); const replacement = fakeHandle("automerge:lararium-2"); h.register(replacement.handle.url, replacement);
    const before = h.composite.layerIndexOf(LARARIUM_BAG); const stop = await startRecipeWatch(h.ctx);
    h.oracle.set(LARARIUM_BAG, rec(LARARIUM_BAG, { text: replacement.handle.url }));
    await vi.waitFor(() => expect(h.ctx.handles.get(LARARIUM_BAG)?.url).toBe(replacement.handle.url));
    expect(h.composite.layerIndexOf(LARARIUM_BAG)).toBe(before);
    stop?.();
  });
});
