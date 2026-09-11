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
import { CompositeStore, bagUri, recipeUri, wikiSlotUri, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, makeMemeProjectReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { placeMeme } from "../src/place-meme.js";
import { storeMemeSink } from "../src/meme-sinks.js";
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
    getTiddlerText: (t: string, d = ""): string => (typeof store.get(t)?.["text"] === "string" ? String(store.get(t)!["text"]) : d),
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
  /** The instance-slot stores THE ONE resolver would hand back, keyed `${slug}/${kind}`. */
  readonly slots: Map<string, MemoryTiddlerStore>;
  readonly recipes: Map<string, LarTiddlerRecord>;
}

function rig(): Rig {
  const wiki = fakeWiki();
  const composite = new CompositeStore();
  composite.addLayer({ bagId: bagUri("sdm"), store: new MemoryTiddlerStore(bagUri("sdm")), writable: true, defaultWritable: false });
  composite.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true });
  const reached = new Map<string, MemoryTiddlerStore>();
  const slots = new Map<string, MemoryTiddlerStore>();
  const recipes = new Map<string, LarTiddlerRecord>();
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki } } as unknown as MemeVerbOptions["tw5"],
    recipeOf: async (slug) => recipes.get(recipeUri("catalog", slug)) ?? null,
    reach: async (key): Promise<LarTiddlerStore | null> => reached.get(key) ?? null,
    slotStore: async (slug, kind): Promise<LarTiddlerStore | null> => slots.get(`${slug}/${kind}`) ?? null,
  };
  return { opts, wiki, composite, reached, slots, recipes };
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

  test("★ the anchor's cap seat is the bag the CASCADE lands in, never the last-registered writable layer ★", async () => {
    const r = rig();
    // A live island registers its volatile temp layer LAST — the cap gate holds no registration for it.
    r.composite.addLayer({ bagId: "lar:///ha.ka.ba/wikis/daemon/temp", store: new MemoryTiddlerStore("lar:///ha.ka.ba/wikis/daemon/temp"), writable: true });
    r.wiki.store.set("lar:///ha.ka.ba/lararium/config/current-wiki-bag", { title: "lar:///ha.ka.ba/lararium/config/current-wiki-bag", text: bagUri("daemon") });
    capCalls.length = 0;
    await makeMemePutReactor(r.opts)({ uri: URI, text: meme(["a"]) }, ctx());
    expect(capCalls[0]).toEqual({ access: "admin", bag: bagUri("daemon") });
  });

  test("CONTROL: with no cascade config the anchor's cap seat falls to the daemon bag", async () => {
    const r = rig();
    r.composite.addLayer({ bagId: "lar:///ha.ka.ba/wikis/daemon/temp", store: new MemoryTiddlerStore("lar:///ha.ka.ba/wikis/daemon/temp"), writable: true });
    capCalls.length = 0;
    await makeMemePutReactor(r.opts)({ uri: URI, text: meme(["a"]) }, ctx());
    expect(capCalls[0]?.bag).toBe(bagUri("daemon"));
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
  test("★ resolves slug → recipe → its designated writable bag → that bag's own store, through the ONE slot resolver ★", async () => {
    const r = rig();
    const working = wikiSlotUri("elyncia", "working");
    r.recipes.set(recipeUri("catalog", "elyncia"), {
      tiddler: { title: recipeUri("catalog", "elyncia"), "bag-stack": `${bagUri("lares")} ${bagUri("elyncia")}`, "writable-bag": working },
    });
    // The wiki's working doc is the one THE resolver names — the doc the wiki island mounts.
    const store = new MemoryTiddlerStore(working);
    r.slots.set("elyncia/working", store);
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
    const draft = wikiSlotUri("far", "draft");
    r.recipes.set(recipeUri("catalog", "far"), { tiddler: { title: recipeUri("catalog", "far"), "writable-bag": draft } });
    await expect(makeMemePutReactor(r.opts)({ recipe: "far", uri: URI, text: meme(["a"]) }, ctx()))
      .rejects.toThrow(draft);
  });
});

describe("meme-get — a named recipe READS THE STACK", () => {
  /** A wiki whose recipe names lares as a library; its working slot the resolver hands back. */
  const stacked = (r: Rig) => {
    const working = wikiSlotUri("garden", "working");
    r.recipes.set(recipeUri("catalog", "garden"), {
      tiddler: { title: recipeUri("catalog", "garden"), "bag-stack": `${bagUri("lares")} ${bagUri("garden")}`, "writable-bag": working },
    });
    const canon = new MemoryTiddlerStore(bagUri("garden"));
    r.reached.set(bagUri("garden"), canon);
    const draft = new MemoryTiddlerStore(wikiSlotUri("garden", "draft"));
    r.slots.set("garden/draft", draft);
    r.slots.set("garden/working", new MemoryTiddlerStore(working));
    return { canon, draft };
  };

  /** Place a meme into one store the way every placement lands — root + slot records. */
  const land = (store: MemoryTiddlerStore, bag: string, slots: readonly string[]) =>
    placeMeme({ uri: URI, text: meme(slots) }, storeMemeSink(store, bag, { kind: "canon-hydrate", receipt: "t" }));

  test("★ a meme in canon reads through --recipe when the draft holds nothing ★", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(got["meme"], "the read stopped at the designated bag and never walked the stack").not.toBeNull();
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu #/a>>");
  });

  test("★ the draft shadows canon when both hold it ★", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await land(draft, wikiSlotUri("garden", "draft"), ["b"]);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu #/b>>");
    expect((got["meme"] as { text: string }).text).not.toContain("<<~ ahu #/a>>");
  });

  test("CONTROL: an absent meme reads null through the stack, never a refusal", async () => {
    const r = rig();
    stacked(r);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(got["meme"]).toBeNull();
  });

  test("CONTROL: put still writes the designated bag alone, never the stack", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await makeMemePutReactor(r.opts)({ recipe: "garden", uri: URI, text: meme(["a"]) }, ctx());
    expect(await r.slots.get("garden/working")!.get(URI)).not.toBeNull();
    expect(await canon.get(URI)).toBeNull();
    expect(await draft.get(URI)).toBeNull();
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
    expect(got.text).toContain("<<~ ahu #/a>>");
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

describe("meme-project — the daemon skin of the projection", () => {
  const projectCalls: Array<[string, string]> = [];
  const rigWithFace = (): Rig => {
    const r = rig();
    // The anchor's in-VM face (meme-face startup), as the daemon's live wiki would publish it.
    (r.opts.tw5.$tw as unknown as { lares: unknown }).lares = {
      meme: { project: (uri: string, to: string) => { projectCalls.push([uri, to]); return { uri, to, text: `<face:${to}>`, contentType: "x/face" }; } },
    };
    return r;
  };

  test("★ the anchor path calls $tw.lares.meme.project — the same in-VM law the wiki side gets ★", async () => {
    const r = rigWithFace();
    projectCalls.length = 0;
    capCalls.length = 0;
    const out = await makeMemeProjectReactor(r.opts)({ uri: URI, to: "html" }, ctx());
    expect(out).toEqual({ uri: URI, to: "html", text: "<face:html>", contentType: "x/face" });
    expect(projectCalls).toEqual([[URI, "html"]]);
    expect(capCalls).toEqual([{ access: "read", bag: bagUri("daemon") }]);
  });

  test("a named bag projects mem and md over that bag's records, through the text laws", async () => {
    const r = rigWithFace();
    projectCalls.length = 0;
    await makeMemePutReactor(r.opts)({ bag: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    const project = makeMemeProjectReactor(r.opts);
    const mem = await project({ bag: "sdm", uri: URI, to: "mem" }, ctx());
    expect(mem["contentType"]).toBe("text/memetic-wikitext+tiddlywiki");
    expect(mem["text"]).toContain("<<~ ahu #/a>>");
    const get = await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: URI }, ctx());
    expect(mem["text"]).toBe((get["meme"] as { text: string }).text);
    const md = await project({ bag: "sdm", uri: URI, to: "md" }, ctx());
    expect(md["contentType"]).toBe("text/markdown");
    expect(md["text"]).toContain("# a");
    expect(typeof md["meta"]).toBe("string");
    // A store-backed target never reaches the anchor's face.
    expect(projectCalls).toEqual([]);
  });

  test("★ refusals are loud: an unknown target names the targets; a wiki render on a bag names the anchor; an absent meme names the URI ★", async () => {
    const r = rigWithFace();
    const project = makeMemeProjectReactor(r.opts);
    await expect(project({ uri: URI, to: "docx" }, ctx())).rejects.toThrow(/docx.*mem · md · html · tid · json/);
    await expect(project({ bag: "sdm", uri: URI, to: "html" }, ctx())).rejects.toThrow(/anchor/);
    await expect(project({ bag: "sdm", uri: URI, to: "mem" }, ctx())).rejects.toThrow(URI);
    await expect(project({ uri: URI }, ctx())).rejects.toThrow(/args\.to/);
  });
});
