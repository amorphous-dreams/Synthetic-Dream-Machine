/**
 * MEME VERBS — `meme-put` / `meme-get`, the daemon's skins of `placeMeme` / `readMeme`.
 *
 * The contract: exactly one of `recipe` / `bag` (neither, or both, refuses as `no-container`); `recipe: "default"` names the host's ANCHOR,
 * the daemon's own wiki, placed through its live `$tw.wiki` so the in-wiki cascade routes it. A named
 * recipe means an edit AS THAT WIKI: its recipe record names the designated writable bag and the
 * placement lands in that bag's own store by access — write-then-sync, never the wiki's island. A named
 * bag means a residency placement through the island's writable layer for it, and a bag the island
 * cannot write fails loud, naming the bag. `base` carries the writer's merge base; stale reads CONFLICT.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, NoWorkingLayerRefusal, bagUri, recipeUri, wikiSlotUri, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";
import { effectiveRecipe } from "../src/recipe-planes.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { memeVerbOptions, makeMemePutReactor, makeMemeGetReactor, makeMemeProjectReactor, makeMemeListReactor, makeMemeDeleteReactor, MEME_LIST_PAGE, type MemeVerbOptions } from "../src/meme-verbs.js";
import { AUDIT_ARRAY_CAP, boundOutcomeOutput } from "../src/verb-vm.js";
import { placeMeme } from "../src/place-meme.js";
import { storeMemeSink } from "../src/meme-sinks.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/x";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** The smallest live wiki: four verbs over a Map, the shape `wikiMemeSink` reads. */
function fakeWiki() {
  const store = new Map<string, Record<string, unknown>>();
  let workingPointer = bagUri("daemon");
  return {
    store,
    setWorkingPointer: (value: string) => { workingPointer = value; },
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t) } : undefined),
    getTiddlerText: (t: string, d = ""): string => t === "lar:///ha.ka.ba/lararium/config/current-wiki-bag"
      ? workingPointer
      : (typeof store.get(t)?.["text"] === "string" ? String(store.get(t)!["text"]) : d),
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
    const receipt = await put({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
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
    await makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    expect(capCalls[0]).toEqual({ access: "admin", bag: bagUri("daemon") });
  });

  test("CONTROL: a mounted working pointer names the anchor's cap seat", async () => {
    const r = rig();
    r.composite.addLayer({ bagId: "lar:///ha.ka.ba/wikis/daemon/temp", store: new MemoryTiddlerStore("lar:///ha.ka.ba/wikis/daemon/temp"), writable: true });
    capCalls.length = 0;
    await makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    expect(capCalls[0]?.bag).toBe(bagUri("daemon"));
  });

  test("a bare anchor refuses by name when its working pointer is absent", async () => {
    const r = rig();
    r.wiki.setWorkingPointer("");
    await expect(makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx()))
      .rejects.toBeInstanceOf(NoWorkingLayerRefusal);
    expect(r.wiki.store.has(URI)).toBe(false);
  });

  test("`recipe: \"default\"` resolves through a standing working pointer", async () => {
    const r = rig();
    await makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    expect(r.wiki.store.has(URI)).toBe(true);
  });

  test("★ a stale base CONFLICTS and lands nothing; the receipt carries the live base ★", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const first = await put({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    await put({ recipe: "default", uri: URI, text: meme(["a", "b"]) }, ctx());
    const stale = await put({ recipe: "default", uri: URI, text: meme(["a", "z"]), base: first["canonicalHash"] }, ctx());
    expect(stale["decision"]).toBe("conflict");
    expect(r.wiki.store.has(`${URI}#/z`)).toBe(false);
    expect(stale["canonicalHash"]).not.toBe(first["canonicalHash"]);
  });

  test("CONTROL: a live base lets the write through", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const first = await put({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    const next = await put({ recipe: "default", uri: URI, text: meme(["a", "z"]), base: first["canonicalHash"] }, ctx());
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

  /** The wiki's own delete of a canon carrier: a tombstone for the root and each slot child, in the working slot. */
  const shadow = async (r: Rig, slots: readonly string[]) => {
    const working = r.slots.get("garden/working")!;
    for (const title of [URI, ...slots.map((s) => `${URI}#/${s}`)]) await working.tombstone(title, { kind: "canon-hydrate", receipt: "t" });
  };

  test("★ a tombstone in the working layer shadows canon: the recipe read answers no meme ★", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await shadow(r, ["a"]);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(got["meme"], "the recipe read stepped over the working layer's tombstone and answered canon").toBeNull();
    // The bag beneath still holds its own record: a read of that one bag answers it.
    const beneath = await makeMemeGetReactor(r.opts)({ bag: bagUri("garden"), uri: URI }, ctx());
    expect((beneath["meme"] as { text: string }).text).toContain("<<~ ahu #/a>>");
  });

  test("★ a projection through the recipe meets the same shadow and names the absent meme ★", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await shadow(r, ["a"]);
    await expect(makeMemeProjectReactor(r.opts)({ recipe: "garden", uri: URI, to: "mem" }, ctx())).rejects.toThrow(/no meme stands/);
  });

  test("CONTROL: a tombstone BENEATH a live record shadows nothing above it", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(draft, wikiSlotUri("garden", "draft"), ["b"]);
    await canon.tombstone(URI, { kind: "canon-hydrate", receipt: "t" });
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu #/b>>");
  });

  test("CONTROL: a record a hand REMOVED from the working layer (no tombstone) lets canon read through", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const working = r.slots.get("garden/working")!;
    await land(working, wikiSlotUri("garden", "working"), ["b"]);
    for (const title of [URI, `${URI}#/b`]) await working.remove(title, { kind: "canon-hydrate", receipt: "t" });
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu #/a>>");
  });

  test("CONTROL: an absent meme reads null through the stack, never a refusal", async () => {
    const r = rig();
    stacked(r);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(got["meme"]).toBeNull();
  });

  test("★ a delete through the recipe reaches a meme that lives in canon beneath: the tombstones land in the working layer and shadow it ★", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const read = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    const base = (read["meme"] as { canonicalHash: string }).canonicalHash;
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI, base }, ctx());
    expect(gone, "the delete read the designated bag alone and answered absent").toMatchObject({ decision: "removed", readFrom: bagUri("garden"), tombstonedIn: [wikiSlotUri("garden", "working")] });
    expect([...(gone["tombstoned"] as string[])].sort()).toEqual([URI, `${URI}#/a`].sort());
    // A bag of the stack the island cannot reach shows no titles: the receipt names it.
    expect(gone["unreached"]).toContain(bagUri("lares"));
    // An instance slot with no store holds no record yet, and `temp` lives in the wiki island alone: neither stands unreached.
    expect((gone["unreached"] as string[]).filter((b) => b.startsWith("lar:///ha.ka.ba/wikis/"))).toEqual([]);
    // The wiki's own read now answers no meme; canon beneath keeps its own record.
    expect((await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx()))["meme"]).toBeNull();
    expect((await r.slots.get("garden/working")!.get(URI))?.meta?.deleted).toBe(true);
    expect(await canon.get(URI)).not.toBeNull();
    expect((await canon.get(URI))?.meta?.deleted).toBeFalsy();
  });

  test("a delete through the recipe reaches a meme in a slot above the designated bag, and tombstones it there", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await land(draft, wikiSlotUri("garden", "draft"), ["b"]);
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone).toMatchObject({ decision: "removed", readFrom: wikiSlotUri("garden", "draft") });
    expect((await draft.get(URI))?.meta?.deleted).toBe(true);
    // Canon's own slot child stays visible through the stack until a tombstone shadows it: the working layer takes one.
    expect((await r.slots.get("garden/working")!.get(`${URI}#/a`))?.meta?.deleted).toBe(true);
    expect((await canon.get(URI))?.meta?.deleted).toBeFalsy();
  });

  test("a delete through the recipe names a stale base a conflict and tombstones nothing", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI, base: "sha256:" + "0".repeat(64) }, ctx());
    expect(gone).toMatchObject({ decision: "conflict", tombstoned: [] });
    expect(await r.slots.get("garden/working")!.get(URI)).toBeNull();
  });

  test("CONTROL: a delete through the recipe of a meme already shadowed, or never held, answers absent; one in the designated bag removes there", async () => {
    const r = rig();
    const { canon } = stacked(r);
    expect(await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx())).toMatchObject({ decision: "absent" });
    await land(canon, bagUri("garden"), ["a"]);
    await shadow(r, ["a"]);
    expect(await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx())).toMatchObject({ decision: "absent" });
    const s = rig();
    stacked(s);
    const working = s.slots.get("garden/working")!;
    await land(working, wikiSlotUri("garden", "working"), ["w"]);
    const gone = await makeMemeDeleteReactor(s.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone).toMatchObject({ decision: "removed" });
    expect((await working.get(URI))?.meta?.deleted).toBe(true);
  });

  test("a delete through the recipe tombstones the slot children the working layer holds by itself, so none stands over the shadow", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const working = r.slots.get("garden/working")!;
    await working.put({ tiddler: { title: `${URI}#/extra`, text: "a child the working layer holds alone" }, meta: {} }, { kind: "canon-hydrate", receipt: "t" }, { bag: wikiSlotUri("garden", "working") });
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone["tombstoned"]).toContain(`${URI}#/extra`);
    expect((await working.get(`${URI}#/extra`))?.meta?.deleted).toBe(true);
  });

  test("a child a slot ABOVE the designated bag holds gets its tombstone in that slot; the canon root's lands in the working layer", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await draft.put({ tiddler: { title: `${URI}#/b`, text: "a draft child over canon" }, meta: {} }, { kind: "canon-hydrate", receipt: "t" }, { bag: wikiSlotUri("garden", "draft") });
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone).toMatchObject({ decision: "removed", readFrom: bagUri("garden") });
    expect([...(gone["tombstonedIn"] as string[])].sort()).toEqual([wikiSlotUri("garden", "draft"), wikiSlotUri("garden", "working")].sort());
    expect((await draft.get(`${URI}#/b`))?.meta?.deleted).toBe(true);
    expect((await r.slots.get("garden/working")!.get(URI))?.meta?.deleted).toBe(true);
    expect((await r.slots.get("garden/working")!.get(`${URI}#/b`))).toBeNull();
  });

  test("a recipe whose designated bag stands outside its own stack refuses the delete by name, and tombstones nothing", async () => {
    const r = rig();
    const { canon } = stacked(r);
    r.recipes.set(recipeUri("catalog", "garden"), { tiddler: { title: recipeUri("catalog", "garden"), "bag-stack": `${bagUri("lares")} ${bagUri("garden")}`, "writable-bag": bagUri("elsewhere") } });
    const elsewhere = new MemoryTiddlerStore(bagUri("elsewhere"));
    r.reached.set(bagUri("elsewhere"), elsewhere);
    await land(canon, bagUri("garden"), ["a"]);
    await expect(makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx())).rejects.toThrow(/recipe-unshadowed/);
    expect(await elsewhere.get(URI)).toBeNull();
  });

  test("a denied admin cap stops the recipe delete before it mints or writes the tombstoning bag", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const minted: string[] = [];
    const slotStore = r.opts.slotStore!;
    const opts = { ...r.opts, slotStore: async (...a: Parameters<typeof slotStore>) => { if (a[3]?.mint) minted.push(`${a[0]}/${a[1]}`); return slotStore(...a); } };
    const denying: VerbContext = { ...ctx(), cap: async (access) => (access === "admin" ? { ok: false, reason: "no admin" } : { ok: true }) };
    await expect(makeMemeDeleteReactor(opts)({ recipe: "garden", uri: URI }, denying)).rejects.toThrow(/cap-denied: admin/);
    expect(minted).toEqual([]);
    expect(await r.slots.get("garden/working")!.get(URI)).toBeNull();
  });

  test("RED: a bag beneath that answers a child the caller may not read refuses the delete by name, before any write and before any title rides the answer", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(draft, wikiSlotUri("garden", "draft"), ["b"]);
    await canon.put({ tiddler: { title: `${URI}#/secret`, text: "a child canon holds" }, meta: {} }, { kind: "canon-hydrate", receipt: "t" }, { bag: bagUri("garden") });
    const blind: VerbContext = { ...ctx(), cap: async (access, bag) => (access === "read" && bag === bagUri("garden") ? { ok: false, reason: "no read" } : { ok: true }) };
    await expect(makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, blind)).rejects.toThrow(new RegExp(`cap-denied: read on ${bagUri("garden").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`));
    expect((await draft.get(URI))?.meta?.deleted).toBeFalsy();
    expect(await r.slots.get("garden/working")!.get(`${URI}#/secret`)).toBeNull();
    // CONTROL: the read granted, the same delete lands and names the child.
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone["tombstoned"]).toContain(`${URI}#/secret`);
  });

  test("RED: a tombstone write that throws leaves the rest to land, and the receipt names both halves", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a", "b"]);
    const working = r.slots.get("garden/working")!;
    const real = working.tombstone.bind(working);
    working.tombstone = async (title, origin) => { if (title === `${URI}#/a`) throw new Error("disk full"); return real(title, origin); };
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone["decision"]).toBe("partial");
    expect(gone["failed"]).toEqual([{ title: `${URI}#/a`, bag: wikiSlotUri("garden", "working"), why: "disk full" }]);
    expect(gone["tombstoned"]).toContain(URI);
    expect(gone["tombstoned"]).toContain(`${URI}#/b`);
    expect((await working.get(URI))?.meta?.deleted).toBe(true);
  });

  test("RED: a bag the island cannot reach, above the one that answered, leaves the delete unconfirmed", async () => {
    const r = rig();
    stacked(r);
    r.reached.delete(bagUri("garden"));                       // the wiki's own canon, above the library, stays unreached
    const lib = new MemoryTiddlerStore(bagUri("lares"));
    r.reached.set(bagUri("lares"), lib);
    await land(lib, bagUri("lares"), ["a"]);
    const gone = await makeMemeDeleteReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(gone).toMatchObject({ decision: "unconfirmed", readFrom: bagUri("lares"), unreachedAbove: [bagUri("garden")] });
    expect((await r.slots.get("garden/working")!.get(URI))?.meta?.deleted).toBe(true);
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
      .rejects.toMatchObject({ name: "VerbRefusal", reason: "no-container" });
  });
  test("uri and text stay required", async () => {
    const r = rig();
    await expect(makeMemePutReactor(r.opts)({ recipe: "default", text: meme(["a"]) }, ctx())).rejects.toThrow(/uri/);
    await expect(makeMemePutReactor(r.opts)({ recipe: "default", uri: URI }, ctx())).rejects.toThrow(/text/);
  });
});

describe("meme-get — the read half", () => {
  test("reads the anchor back: text + the canonical hash the put reported", async () => {
    const r = rig();
    const put = await makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    const got = (await makeMemeGetReactor(r.opts)({ recipe: "default", uri: URI }, ctx()))["meme"] as { text: string; canonicalHash: string };
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
    const out = await makeMemeProjectReactor(r.opts)({ recipe: "default", uri: URI, to: "html" }, ctx());
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
    await expect(project({ recipe: "default", uri: URI, to: "docx" }, ctx())).rejects.toThrow(/docx.*mem · md · html · tid · json/);
    await expect(project({ bag: "sdm", uri: URI, to: "html" }, ctx())).rejects.toThrow(/anchor/);
    await expect(project({ bag: "sdm", uri: URI, to: "mem" }, ctx())).rejects.toThrow(URI);
    await expect(project({ recipe: "default", uri: URI }, ctx())).rejects.toThrow(/args\.to/);
  });
});

/**
 * THE LISTING VERB — `meme-list { recipe?, bag?, tree? }` → `{ bag, roots }`: every root the seat holds,
 * with its canonical hash; `tree` nests the slot tree. The same container law as `meme-get`; gates read.
 */
describe("meme-list — roots by default, the slot tree on request", () => {
  test("★ the anchor lists every root with the hash the put reported; CONTROL: a plain tiddler never lists ★", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const a = await put({ recipe: "default", uri: URI, text: meme(["a", "b"]) }, ctx());
    r.wiki.store.set("plain", { title: "plain", text: "prose" });
    capCalls.length = 0;
    const out = await makeMemeListReactor(r.opts)({ recipe: "default" }, ctx());
    expect(out["roots"]).toEqual([{ uri: URI, canonicalHash: a["canonicalHash"] }]);
    expect(capCalls[0]?.access).toBe("read");
  });

  test("★ `tree` nests `uri#/slot` under its own root; a named bag lists that bag's records alone ★", async () => {
    const r = rig();
    await makeMemePutReactor(r.opts)({ bag: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    await makeMemePutReactor(r.opts)({ recipe: "default", uri: "lar:///t/anchor", text: meme(["z"]).replaceAll("t/x", "t/anchor") }, ctx());
    const out = await makeMemeListReactor(r.opts)({ bag: "sdm", tree: true }, ctx());
    expect(out["bag"]).toBe(bagUri("sdm"));
    expect(out["roots"]).toEqual([{ uri: URI, canonicalHash: expect.stringMatching(/^sha256:/), slots: [{ slot: "#/a", uri: `${URI}#/a`, slots: [] }] }]);
  });

  test("recipe AND bag together refuse", async () => {
    const r = rig();
    await expect(makeMemeListReactor(r.opts)({ recipe: "sdm", bag: "sdm" }, ctx())).rejects.toMatchObject({ name: "VerbRefusal", reason: "no-container" });
  });
});

/**
 * THE DELETE VERB — `meme-delete { recipe?, bag?, uri, base? }` over `removeMeme`: the whole group leaves;
 * a stale base answers `conflict` and moves nothing; an absent root answers `absent`. Gates admin.
 */
/**
 * EVERY ROOT ANSWERS. A verb's outcome carries at most `AUDIT_ARRAY_CAP` rows of an array and turns a
 * longer one into a count and a sample, so a listing that named a large seat's roots in one array reached
 * its reader as no roots at all. The listing pages at that cap: each answer rides whole through the
 * outcome's bound, and `next` names the cursor of the page behind it.
 */
describe("meme-list — a seat past the outcome's cap answers every root, a page at a time", () => {
  const at = (n: number): string => `lar:///t/many/${String(n).padStart(3, "0")}`;
  const memeAt = (uri: string, slots: readonly string[] = ["a"]): string => meme(slots).replaceAll(URI, uri).replaceAll("t/x", uri.slice("lar:///".length));
  const fill = async (r: Rig, count: number) => {
    const put = makeMemePutReactor(r.opts);
    for (let i = 0; i < count; i++) await put({ bag: "sdm", uri: at(i), text: memeAt(at(i)) }, ctx());
  };
  /** Read a listing to its end the way a caller does: hand each `next` back as `after`. */
  const readAll = async (r: Rig, args: Record<string, unknown>) => {
    const list = makeMemeListReactor(r.opts);
    const uris: string[] = [];
    let pages = 0;
    for (let after: string | null = null; ;) {
      const out = await list({ ...args, ...(after ? { after } : {}) }, ctx());
      pages++;
      // The law itself: what the outcome's bound hands a reader still names every root of the page.
      const carried = boundOutcomeOutput(out)["roots"];
      expect(Array.isArray(carried), "the outcome's bound turned the page's roots into a summary").toBe(true);
      uris.push(...(carried as { uri: string }[]).map((x) => x.uri));
      after = out["next"] as string | null;
      if (after === null) return { uris, pages };
      expect(pages, "the cursor never ended").toBeLessThan(50);
    }
  };

  test("★ a bag of more roots than one outcome carries lists each of them, in title order ★", async () => {
    const r = rig();
    const count = AUDIT_ARRAY_CAP * 2 + 5;
    await fill(r, count);
    const { uris, pages } = await readAll(r, { bag: "sdm" });
    expect(uris).toEqual(Array.from({ length: count }, (_, i) => at(i)));
    expect(pages).toBe(3);
  });

  test("the first page carries the cap's worth and names its last root as the cursor", async () => {
    const r = rig();
    await fill(r, MEME_LIST_PAGE + 1);
    const out = await makeMemeListReactor(r.opts)({ bag: "sdm" }, ctx());
    expect((out["roots"] as unknown[]).length).toBe(MEME_LIST_PAGE);
    expect(out["next"]).toBe(at(MEME_LIST_PAGE - 1));
  });

  test("CONTROL: a seat within the cap answers one page and no cursor", async () => {
    const r = rig();
    await fill(r, MEME_LIST_PAGE);
    const out = await makeMemeListReactor(r.opts)({ bag: "sdm" }, ctx());
    expect((out["roots"] as unknown[]).length).toBe(MEME_LIST_PAGE);
    expect(out["next"]).toBeNull();
  });

  test("`limit` narrows a page and never widens it past the cap", async () => {
    const r = rig();
    await fill(r, MEME_LIST_PAGE + 3);
    const list = makeMemeListReactor(r.opts);
    const narrow = await list({ bag: "sdm", limit: 2 }, ctx());
    expect((narrow["roots"] as { uri: string }[]).map((x) => x.uri)).toEqual([at(0), at(1)]);
    expect(narrow["next"]).toBe(at(1));
    const wide = await list({ bag: "sdm", limit: 10_000 }, ctx());
    expect((wide["roots"] as unknown[]).length).toBe(MEME_LIST_PAGE);
  });

  test("the anchor pages the same way", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    for (let i = 0; i < MEME_LIST_PAGE + 2; i++) await put({ recipe: "default", uri: at(i), text: memeAt(at(i)) }, ctx());
    const { uris, pages } = await readAll(r, { recipe: "default" });
    expect(uris.length).toBe(MEME_LIST_PAGE + 2);
    expect(pages).toBe(2);
  });
});

/**
 * A NAMED RECIPE LISTS WHAT THE WIKI RESOLVES. `meme-get --recipe` reads the stack; the listing reads the
 * same stack, so a root the read answers also lists, and a root the read answers absent lists nowhere.
 */
describe("meme-list — a named recipe lists the roots its stack resolves", () => {
  const A = "lar:///t/stack/a", B = "lar:///t/stack/b", C = "lar:///t/stack/c";
  const memeAt = (uri: string, slots: readonly string[]): string => meme(slots).replaceAll(URI, uri).replaceAll("t/x", uri.slice("lar:///".length));
  const o = { kind: "canon-hydrate" as const, receipt: "t" };
  const stacked = (r: Rig) => {
    const working = wikiSlotUri("garden", "working");
    r.recipes.set(recipeUri("catalog", "garden"), {
      tiddler: { title: recipeUri("catalog", "garden"), "bag-stack": `${bagUri("lares")} ${bagUri("garden")}`, "writable-bag": working },
    });
    const canon = new MemoryTiddlerStore(bagUri("garden"));
    r.reached.set(bagUri("garden"), canon);
    const draft = new MemoryTiddlerStore(wikiSlotUri("garden", "draft"));
    const work = new MemoryTiddlerStore(working);
    r.slots.set("garden/draft", draft);
    r.slots.set("garden/working", work);
    return { canon, draft, work };
  };
  const land = (store: MemoryTiddlerStore, bag: string, uri: string, slots: readonly string[]) =>
    placeMeme({ uri, text: memeAt(uri, slots) }, storeMemeSink(store, bag, o));

  test("★ canon's roots list through the recipe, each row naming the bag that answered ★", async () => {
    const r = rig();
    const { canon, work } = stacked(r);
    await land(canon, bagUri("garden"), A, ["a"]);
    await land(work, wikiSlotUri("garden", "working"), B, ["b"]);
    const out = await makeMemeListReactor(r.opts)({ recipe: "garden" }, ctx());
    expect(out["recipe"]).toBe("garden");
    expect((out["roots"] as { uri: string; bag: string }[]).map((x) => [x.uri, x.bag])).toEqual([
      [A, bagUri("garden")],
      [B, wikiSlotUri("garden", "working")],
    ]);
    expect(out["next"]).toBeNull();
  });

  test("★ a root the working layer tombstoned lists nowhere, and the read agrees ★", async () => {
    const r = rig();
    const { canon, work } = stacked(r);
    await land(canon, bagUri("garden"), A, ["a"]);
    await land(canon, bagUri("garden"), C, ["c"]);
    for (const title of [C, `${C}#/c`]) await work.tombstone(title, o);
    const out = await makeMemeListReactor(r.opts)({ recipe: "garden" }, ctx());
    expect((out["roots"] as { uri: string }[]).map((x) => x.uri)).toEqual([A]);
    expect((await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: C }, ctx()))["meme"]).toBeNull();
  });

  test("a root two bags hold lists once, from the upper bag, under the hash the read hands back", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(canon, bagUri("garden"), A, ["a"]);
    await land(draft, wikiSlotUri("garden", "draft"), A, ["z"]);
    const out = await makeMemeListReactor(r.opts)({ recipe: "garden", tree: true }, ctx());
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: A }, ctx());
    expect(out["roots"]).toEqual([{
      uri: A, bag: wikiSlotUri("garden", "draft"), canonicalHash: (got["meme"] as { canonicalHash: string }).canonicalHash,
      slots: [{ slot: "#/z", uri: `${A}#/z`, slots: [] }],
    }]);
  });

  test("the stack pages under the cap, and a bag nothing reaches gets named", async () => {
    const r = rig();
    const { canon } = stacked(r);
    const at = (n: number): string => `lar:///t/stack/many/${String(n).padStart(3, "0")}`;
    for (let i = 0; i < MEME_LIST_PAGE + 4; i++) await land(canon, bagUri("garden"), at(i), ["a"]);
    const list = makeMemeListReactor(r.opts);
    const first = await list({ recipe: "garden" }, ctx());
    expect((first["roots"] as unknown[]).length).toBe(MEME_LIST_PAGE);
    expect(first["next"]).toBe(at(MEME_LIST_PAGE - 1));
    // The recipe names `lares` as a library and this rig reaches no such bag: the listing says so.
    expect(first["unreached"]).toContain(bagUri("lares"));
    const second = await list({ recipe: "garden", after: first["next"] }, ctx());
    expect((second["roots"] as { uri: string }[]).map((x) => x.uri)).toEqual([at(MEME_LIST_PAGE), at(MEME_LIST_PAGE + 1), at(MEME_LIST_PAGE + 2), at(MEME_LIST_PAGE + 3)]);
    expect(second["next"]).toBeNull();
  });

  test("★ a slot nobody registered answers no root and asks for no cap: the listing stands ★", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), A, ["a"]);
    r.slots.set("garden/personal", new MemoryTiddlerStore(wikiSlotUri("garden", "personal")));
    const personal = wikiSlotUri("garden", "personal");
    const denying: VerbContext = { ...ctx(), cap: async (_access, bag) => (bag === personal ? { ok: false, reason: `bag not registered: ${bag}` } : { ok: true }) };
    const out = await makeMemeListReactor(r.opts)({ recipe: "garden" }, denying);
    expect((out["roots"] as { uri: string }[]).map((x) => x.uri)).toEqual([A]);
    // CONTROL: a bag that ANSWERS a root the caller may not read refuses the listing by name.
    const closed: VerbContext = { ...ctx(), cap: async (_access, bag) => (bag === bagUri("garden") ? { ok: false, reason: "no" } : { ok: true }) };
    await expect(makeMemeListReactor(r.opts)({ recipe: "garden" }, closed)).rejects.toThrow(/cap-denied: read on .*bags\/garden/);
  });

  test("CONTROL: a named bag still lists that bag's records alone", async () => {
    const r = rig();
    const { canon, work } = stacked(r);
    await land(canon, bagUri("garden"), A, ["a"]);
    await land(work, wikiSlotUri("garden", "working"), B, ["b"]);
    const out = await makeMemeListReactor(r.opts)({ bag: wikiSlotUri("garden", "working") }, ctx());
    expect((out["roots"] as { uri: string }[]).map((x) => x.uri)).toEqual([B]);
    expect(out["bag"]).toBe(wikiSlotUri("garden", "working"));
  });

  test("CONTROL: an unknown recipe fails loud, naming the slug", async () => {
    await expect(makeMemeListReactor(rig().opts)({ recipe: "nowhere" }, ctx())).rejects.toThrow(/recipe "nowhere" not found/);
  });
});

describe("meme-delete — the daemon skin of removeMeme", () => {
  test("★ removes the whole group from the anchor; gates admin on the bag the cascade lands in ★", async () => {
    const r = rig();
    await makeMemePutReactor(r.opts)({ recipe: "default", uri: URI, text: meme(["a", "b"]) }, ctx());
    r.wiki.store.set("lar:///t/x-not", { title: "lar:///t/x-not", text: "a neighbour under the prefix, never a child" });
    capCalls.length = 0;
    const out = await makeMemeDeleteReactor(r.opts)({ recipe: "default", uri: URI }, ctx());
    expect(out["decision"]).toBe("removed");
    expect((out["tombstoned"] as string[]).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect([...r.wiki.store.keys()]).toEqual(["lar:///t/x-not"]);
    expect(capCalls[0]?.access).toBe("admin");
  });

  test("★ CONTROL: a stale base answers conflict and moves nothing; the receipt carries the live base ★", async () => {
    const r = rig();
    const put = makeMemePutReactor(r.opts);
    const first = await put({ recipe: "default", uri: URI, text: meme(["a"]) }, ctx());
    const moved = await put({ recipe: "default", uri: URI, text: meme(["a", "b"]) }, ctx());
    const out = await makeMemeDeleteReactor(r.opts)({ recipe: "default", uri: URI, base: first["canonicalHash"] }, ctx());
    expect(out["decision"]).toBe("conflict");
    expect(out["canonicalHash"]).toBe(moved["canonicalHash"]);
    expect(r.wiki.store.has(`${URI}#/b`)).toBe(true);
    // The live base lets the removal through.
    expect((await makeMemeDeleteReactor(r.opts)({ recipe: "default", uri: URI, base: moved["canonicalHash"] }, ctx()))["decision"]).toBe("removed");
  });

  test("an absent root answers absent; a named bag removes from that bag's writable layer", async () => {
    const r = rig();
    expect((await makeMemeDeleteReactor(r.opts)({ recipe: "default", uri: URI }, ctx()))["decision"]).toBe("absent");
    await makeMemePutReactor(r.opts)({ bag: "sdm", uri: URI, text: meme(["a"]) }, ctx());
    const out = await makeMemeDeleteReactor(r.opts)({ bag: "sdm", uri: URI }, ctx());
    expect(out["decision"]).toBe("removed");
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toEqual([]);
  });
});

/**
 * A NAMED WIKI'S LAYER BY `--bag`. `--bag lar:///ha.ka.ba/wikis/<slug>/working` names the doc THE ONE resolver
 * mints for that wiki's working layer — the same doc `--recipe <slug>` walks. The `--bag` door reached the
 * composite and the planes alone, so a wiki's own working layer read "holds no layer in this island" while a
 * LOAD --to that very bag had landed the records (measured: `tests/e2e/wikis-ingest-back.test.ts` WB1, a
 * settled mirror scanning as all-new). The daemon's own `wikis/daemon/working` rides the composite (attached
 * at boot) and never hit it — the one control that hid the gap.
 */
describe("meme-get/put --bag names a wiki's instance slot", () => {
  const WBAG = "lar:///ha.ka.ba/wikis/garden/working";
  test("get --bag wikis/garden/working reads the working slot's doc", async () => {
    const r = rig();
    const working = new MemoryTiddlerStore(WBAG);
    r.slots.set("garden/working", working);
    await placeMeme({ uri: URI, text: meme(["a"]) }, storeMemeSink(working, WBAG, { kind: "canon-hydrate", receipt: "t" }));
    const got = await makeMemeGetReactor(r.opts)({ bag: WBAG, uri: URI }, ctx());
    expect(got["meme"], "the working slot never reached by --bag").not.toBeNull();
  });
  test("put --bag wikis/garden/working lands in the working slot's doc", async () => {
    const r = rig();
    const working = new MemoryTiddlerStore(WBAG);
    r.slots.set("garden/working", working);
    const receipt = await makeMemePutReactor(r.opts)({ bag: WBAG, uri: URI, text: meme(["a"]) }, ctx());
    expect(receipt["decision"]).toBe("ingest");
    expect(await working.get(URI)).not.toBeNull();
  });
  /** CONTROL: `temp` lives in the island alone — never reached by any door. */
  test("get --bag wikis/garden/temp still refuses", async () => {
    const r = rig();
    r.slots.set("garden/temp", new MemoryTiddlerStore("lar:///ha.ka.ba/wikis/garden/temp"));
    await expect(makeMemeGetReactor(r.opts)({ bag: "lar:///ha.ka.ba/wikis/garden/temp", uri: URI }, ctx())).rejects.toThrow(/holds no layer/);
  });
});

describe("the recipe readers agree", () => {
  const mk = (title: string, stack: string): LarTiddlerRecord => ({ tiddler: { title, "bag-stack": stack } });
  const OWN = recipeUri("catalog", "lares");
  const DEFAULT = recipeUri("oracle", "lares");
  const docs: Record<string, Record<string, LarTiddlerRecord>> = {
    "automerge:cat": { [OWN]: mk(OWN, "own") },
    "automerge:ora": { [DEFAULT]: mk(DEFAULT, "default") },
  };
  const repo = { find: async (url: string) => ({ doc: () => ({ tiddlers: docs[url] }), whenReady: async () => {} }) } as never;
  const options = () => memeVerbOptions(
    { composite: new CompositeStore(), tw5: {} as never, repo, catalogUrl: "automerge:cat", oracleUrl: "automerge:ora" },
    async () => null,
  );

  test("meme get --recipe reads the record the boot mount and the live watch read: the vessel's own", async () => {
    const viaVerb = await options().recipeOf("lares");
    const viaMount = effectiveRecipe("lares", (plane, title) => docs[plane === "oracle" ? "automerge:ora" : "automerge:cat"]![title])?.record;
    expect(viaVerb).toEqual(viaMount);
    expect(viaVerb?.tiddler["bag-stack"]).toBe("own");
  });

  test("control: a slug only the oracle carries reads the default", async () => {
    delete docs["automerge:cat"]![OWN];
    expect((await options().recipeOf("lares"))?.tiddler["bag-stack"]).toBe("default");
    docs["automerge:cat"]![OWN] = mk(OWN, "own");
  });
});
