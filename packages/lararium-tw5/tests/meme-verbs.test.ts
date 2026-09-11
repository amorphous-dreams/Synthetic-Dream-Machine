/**
 * MEME VERBS — `meme-put` / `meme-get`, the daemon's skins of `placeMeme` / `readMeme`.
 *
 * The contract: at most one of `recipe` / `bag`; neither names `recipe: "default"` — the host's ANCHOR,
 * the daemon's own wiki, placed through its live `$tw.wiki` so the in-wiki cascade routes it. A named
 * recipe means an edit AS THAT WIKI: its recipe record names the designated writable bag and the
 * placement lands in that bag's own store by access — write-then-sync, never the wiki's island. A named
 * bag means a residency placement through the island's writable layer for it, and a bag the island
 * cannot write fails loud, naming the bag. `base` carries the writer's merge base; stale reads CONFLICT.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, recipeUri, wikiDraftBagUri, wikiDraftDocKey, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/x";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

/** The smallest live wiki: four verbs over a Map, the shape `wikiMemeSink` reads. */
function fakeWiki() {
  const store = new Map<string, Record<string, unknown>>();
  return {
    store,
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t) } : undefined),
    addTiddler: (f: Record<string, unknown>) => { store.set(String(f["title"]), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  };
}

const capCalls: Array<{ access: string; bag: string }> = [];
const ctx = (requestId = "r1"): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId } as VerbContext["invocation"],
  cap: async (access, bag) => { capCalls.push({ access, bag }); return { ok: true }; },
});

interface Rig {
  readonly opts: MemeVerbOptions;
  readonly wiki: ReturnType<typeof fakeWiki>;
  readonly composite: CompositeStore;
  readonly reached: Map<string, MemoryTiddlerStore>;
  readonly recipes: Map<string, LarTiddlerRecord>;
}

function rig(): Rig {
  const wiki = fakeWiki();
  const composite = new CompositeStore();
  composite.addLayer({ bagId: bagUri("sdm"), store: new MemoryTiddlerStore(bagUri("sdm")), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true });
  const reached = new Map<string, MemoryTiddlerStore>();
  const recipes = new Map<string, LarTiddlerRecord>();
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki } } as unknown as MemeVerbOptions["tw5"],
    recipeOf: async (slug) => recipes.get(recipeUri("catalog", slug)) ?? null,
    reach: async (key): Promise<LarTiddlerStore | null> => reached.get(key) ?? null,
    vesselDid: () => "0xdid",
  };
  return { opts, wiki, composite, reached, recipes };
}

describe("meme-put — the anchor (recipes/default)", () => {
  test("no target names the daemon's own wiki: the records land in $tw.wiki, not the composite", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const receipt = await put({ uri: URI, text: meme(["a"]) }, ctx());
    expect(receipt["decision"]).toBe("ingest");
    expect(r.wiki.store.has(URI)).toBe(true);
    expect(r.wiki.store.has(`${URI}#/a`)).toBe(true);
    expect(await r.composite.storeForBag(bagUri("daemon"))!.listVisible()).toEqual([]);
  });

  test("`recipe: \"default\"` reads the same as no target", async () => {
    const r = rig();
    await makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    expect(r.wiki.store.has(URI)).toBe(true);
  });

  test("★ a stale base CONFLICTS and lands nothing; the receipt carries the live base ★", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const first = await put({ uri: URI, text: meme(["a"]) }, ctx());
    await put({ uri: URI, text: meme(["a", "b"]) }, ctx());
    const stale = await put({ uri: URI, text: meme(["a", "z"]), base: first["canonicalHash"] }, ctx());
    expect(stale["decision"]).toBe("conflict");
    expect(r.wiki.store.has(`${URI}#/z`)).toBe(false);
    expect(stale["canonicalHash"]).not.toBe(first["canonicalHash"]);
  });

  test("CONTROL: a live base lets the write through", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const first = await put({ uri: URI, text: meme(["a"]) }, ctx());
    const next = await put({ uri: URI, text: meme(["a", "z"]), base: first["canonicalHash"] }, ctx());
    expect(next["decision"]).toBe("ingest");
  });
});

describe("meme-put — a named bag (residency)", () => {
  test("lands into the island's writable layer for that bag, the slug bare", async () => {
    const r = rig();
    const receipt = await makeMemePutReactor(r.opts)({ bag: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    expect(receipt["decision"]).toBe("ingest");
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toContain(URI);
    expect(r.wiki.store.size).toBe(0);
  });

  test("★ a bag the island cannot write fails loud, naming the bag ★", async () => {
    const r = rig();
    await expect(makeMemePutReactor(r.opts)({ bag: "nope", uri: URI, text: meme(["a"]) }, ctx()))
      .rejects.toThrow(bagUri("nope"));
    expect(await r.composite.storeForBag(bagUri("daemon"))!.listVisible()).toEqual([]);
  });

  test("the put gates admin on the bag it writes", async () => {
    const r = rig();
    capCalls.length = 0;
    await makeMemePutReactor(r.opts)({ bag: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    expect(capCalls).toEqual([{ access: "admin", bag: bagUri("sdm") }]);
  });
});

describe("meme-put — a named recipe (an edit AS that wiki)", () => {
  test("★ resolves slug → recipe → its designated writable bag → that bag's own store, by access ★", async () => {
    const r = rig();
    const draft = wikiDraftBagUri("elyncia");
    r.recipes.set(recipeUri("catalog", "elyncia"), {
      tiddler: { title: recipeUri("catalog", "elyncia"), "bag-stack": `${bagUri("lares")} ${bagUri("elyncia")} ${draft}`, "writable-bag": draft },
    });
    // The wiki's draft doc keys per DID in the registry — the reach answers under that key.
    const store = new MemoryTiddlerStore(draft);
    r.reached.set(wikiDraftDocKey("elyncia", "0xdid"), store);
    const receipt = await makeMemePutReactor(r.opts)({ recipe: "elyncia", uri: URI, text: meme(["a"]) }, ctx());
    expect(receipt["decision"]).toBe("ingest");
    expect(await store.listVisible()).toContain(URI);
    // Residency rides the store the record sits in; the record carries no stamp of it.
    expect(await store.get(URI)).toBeTruthy();
    expect((await store.get(URI))?.tiddler["bag"]).toBeUndefined();
    expect(r.wiki.store.size).toBe(0);
  });

  test("a recipe whose writable bag the island mounts writable lands through the composite", async () => {
    const r = rig();
    r.recipes.set(recipeUri("catalog", "sdm"), {
      tiddler: { title: recipeUri("catalog", "sdm"), "bag-stack": `${bagUri("lares")} ${bagUri("sdm")}` },
    });
    await makeMemePutReactor(r.opts)({ recipe: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toContain(URI);
  });

  test("an unknown recipe fails loud, naming the slug", async () => {
    const r = rig();
    await expect(makeMemePutReactor(r.opts)({ recipe: "ghost", uri: URI, text: meme(["a"]) }, ctx()))
      .rejects.toThrow(/ghost/);
  });

  test("a recipe whose designated bag nothing reaches fails loud, naming slug and bag", async () => {
    const r = rig();
    const draft = wikiDraftBagUri("far");
    r.recipes.set(recipeUri("catalog", "far"), { tiddler: { title: recipeUri("catalog", "far"), "writable-bag": draft } });
    await expect(makeMemePutReactor(r.opts)({ recipe: "far", uri: URI, text: meme(["a"]) }, ctx()))
      .rejects.toThrow(draft);
  });
});

describe("meme-put — the argument law", () => {
  test("recipe AND bag together refuse", async () => {
    const r = rig();
    await expect(makeMemePutReactor(r.opts)({ recipe: "sdm", bag: "sdm", uri: URI, text: meme(["a"]) }, ctx()))
      .rejects.toThrow(/at most one/);
  });
  test("uri and text stay required", async () => {
    const r = rig();
    await expect(makeMemePutReactor(r.opts)({ text: meme(["a"]) }, ctx())).rejects.toThrow(/uri/);
    await expect(makeMemePutReactor(r.opts)({ uri: URI }, ctx())).rejects.toThrow(/text/);
  });
});

describe("meme-get — the read half", () => {
  test("reads the anchor back: text + the canonical hash the put reported", async () => {
    const r = rig();
    const put = await makeMemePutReactor(r.opts)({ uri: URI, text: meme(["a"]) }, ctx());
    const got = (await makeMemeGetReactor(r.opts)({ uri: URI }, ctx()))["meme"] as { text: string; canonicalHash: string };
    expect(got.canonicalHash).toBe(put["canonicalHash"]);
    expect(got.text).toContain("<<~ ahu #a>>");
  });

  test("reads a named bag back, and a bag's absence reads null", async () => {
    const r = rig();
    await makeMemePutReactor(r.opts)({ bag: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    const got = (await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: URI }, ctx()))["meme"] as { canonicalHash: string };
    expect(got.canonicalHash).toMatch(/^sha256:/);
    expect(await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: "lar:///t/absent" }, ctx())).toEqual({ uri: "lar:///t/absent", meme: null });
  });

  test("CONTROL: the get gates read, never admin", async () => {
    const r = rig();
    capCalls.length = 0;
    await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: URI }, ctx());
    expect(capCalls).toEqual([{ access: "read", bag: bagUri("sdm") }]);
  });
});
