/**
 * MEME VERBS — `meme-get` / `meme-list` / `meme-project`, the daemon's read skins of the meme laws, and the bag reach
 * they lend the tiddler door (`tiddler-put` / `tiddler-delete` over one bag's own store).
 *
 * The contract: at most one of `recipe` / `bag` (both refuse as `no-container`; neither reads `recipe: "default"`); `recipe: "default"` names the host's ANCHOR,
 * the daemon's own wiki, read through its live `$tw.wiki`. A named recipe reads AS THAT WIKI: the whole stack, top-down,
 * the first bag that holds a record answering. A named bag names that one bag's own store: a put lands a family there
 * through the Confluence gate, a delete removes it there, and a bag the island cannot write fails loud, naming the bag.
 * `base` carries the writer's merge base; a stale one answers `conflict`.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, NoWorkingLayerRefusal } from "@lararium/mesh/composite-store";
import { bagUri, recipeUri } from "@lararium/mesh/lar-uris";
import { carrierHashOf } from "@lararium/mesh/carrier-form";
import { overrideBaseOf } from "@lararium/mesh/override-base";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { effectiveRecipe } from "../src/recipe-planes.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { memeVerbOptions, makeMemeGetReactor, makeMemeProjectReactor, makeMemeListReactor, MEME_LIST_PAGE, type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeTiddlerPutReactor, makeTiddlerDeleteReactor } from "../src/tiddler-verbs.js";
import { READ_PAGE_BYTES } from "../src/read-gradient.js";
import { AUDIT_ARRAY_CAP, boundOutcomeOutput } from "../src/verb-vm.js";
import { placeMeme, wikiMemeSink } from "../src/place-meme.js";
import { storeMemeSink } from "../src/meme-sinks.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/x";
const meme = (slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

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

/** Seed a family into the rig's anchor wiki through the one placement function; the receipt names the base a reader gets back. */
const seedAnchor = (r: Rig, text: string, uri = URI) =>
  placeMeme({ uri, text, holdAnswer: true }, wikiMemeSink(r.wiki as unknown as Parameters<typeof wikiMemeSink>[0]));

/** Seed a family into one bag through the tiddler door. */
const seedBag = (r: Rig, bag: string, text: string, uri = URI) =>
  makeTiddlerPutReactor(r.opts)({ bag, title: uri, text }, ctx());

describe("meme-get — the anchor (recipes/default)", () => {
  test("★ the anchor's cap seat names the bag the CASCADE lands in, never the last-registered writable layer ★", async () => {
    const r = rig();
    // A live island registers its volatile temp layer LAST — the cap gate holds no registration for it.
    r.composite.addLayer({ bagId: "lar:///ha.ka.ba/wikis/daemon/temp", store: new MemoryTiddlerStore("lar:///ha.ka.ba/wikis/daemon/temp"), writable: true });
    await seedAnchor(r, meme(["a"]));
    capCalls.length = 0;
    const got = await makeMemeGetReactor(r.opts)({ recipe: "default", uri: URI }, ctx());
    expect(got["meme"]).not.toBeNull();
    expect(capCalls[0]).toEqual({ access: "read", bag: bagUri("daemon") });
  });

  test("a bare anchor refuses by name when its working pointer stands absent", async () => {
    const r = rig();
    await seedAnchor(r, meme(["a"]));
    r.wiki.setWorkingPointer("");
    await expect(makeMemeGetReactor(r.opts)({ recipe: "default", uri: URI }, ctx()))
      .rejects.toBeInstanceOf(NoWorkingLayerRefusal);
  });

  test("a seeded family rests in $tw.wiki, never the composite, and reads back through a standing working pointer", async () => {
    const r = rig();
    const receipt = await seedAnchor(r, meme(["a"]));
    expect(receipt.decision).toBe("ingest");
    expect(r.wiki.store.has(URI)).toBe(true);
    expect(r.wiki.store.has(`${URI}#/a`)).toBe(true);
    expect(await r.composite.storeForBag(bagUri("daemon"))!.listVisible()).toEqual([]);
    const got = (await makeMemeGetReactor(r.opts)({ recipe: "default", uri: URI }, ctx()))["meme"] as { canonicalHash: string };
    expect(got.canonicalHash).toBe(receipt.canonicalHash);
  });
});

describe("a bag put — a family lands in the named bag's own store (residency)", () => {
  test("lands into the island's writable layer for that bag, the slug bare, and the answer names the bag and no wiki", async () => {
    const r = rig();
    const answer = await seedBag(r, "sdm", meme(["a"]));
    expect(answer).toMatchObject({
      title: URI, decision: "put", bag: bagUri("sdm"), created: true, position: "root", kept: [], tombstoned: [],
      hash: expect.stringMatching(/^sha256-/), canonicalHash: expect.stringMatching(/^sha256:/),
    });
    expect(answer["landed"]).toEqual(expect.arrayContaining([URI, `${URI}#/a`]));
    expect(answer).not.toHaveProperty("recipe");
    expect(answer).not.toHaveProperty("uri");
    expect(answer).not.toHaveProperty("layer");
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toContain(URI);
    expect(r.wiki.store.size).toBe(0);
  });

  test("★ a bag the island cannot write fails loud, naming the bag ★", async () => {
    const r = rig();
    await expect(seedBag(r, "nope", meme(["a"]))).rejects.toThrow(bagUri("nope"));
    expect(await r.composite.storeForBag(bagUri("daemon"))!.listVisible()).toEqual([]);
  });

  test("the put gates admin on the bag it writes, and a denied cap lands nothing", async () => {
    const r = rig();
    capCalls.length = 0;
    await seedBag(r, "sdm", meme(["a"]));
    expect(capCalls[0]).toEqual({ access: "admin", bag: bagUri("sdm") });
    expect(capCalls.filter((c) => c.access === "admin")).toEqual([{ access: "admin", bag: bagUri("sdm") }]);
    const s = rig();
    const denying: VerbContext = { ...ctx(), cap: async (access) => (access === "admin" ? { ok: false, reason: "no admin" } : { ok: true }) };
    await expect(makeTiddlerPutReactor(s.opts)({ bag: "sdm", title: URI, text: meme(["a"]) }, denying)).rejects.toThrow(/cap-denied: admin/);
    expect(await s.composite.storeForBag(bagUri("sdm"))!.listVisible()).toEqual([]);
  });

  test("`create` lands a family where none stands, and answers `exists` over a standing one with nothing moved", async () => {
    const r = rig();
    const put = makeTiddlerPutReactor(r.opts);
    const first = await put({ bag: "sdm", title: URI, text: meme(["a"]), create: true }, ctx());
    expect(first).toMatchObject({ decision: "put", created: true });
    const again = await put({ bag: "sdm", title: URI, text: meme(["a", "b"]), create: true }, ctx());
    expect(again).toMatchObject({ decision: "exists", created: false });
    expect(await r.composite.storeForBag(bagUri("sdm"))!.get(`${URI}#/b`)).toBeNull();
  });

  test("★ a stale carrier base answers conflict and lands nothing; the answer names the live hash ★", async () => {
    const r = rig();
    const put = makeTiddlerPutReactor(r.opts);
    const first = await put({ bag: "sdm", title: URI, text: meme(["a"]) }, ctx());
    const moved = await put({ bag: "sdm", title: URI, text: meme(["a", "b"]) }, ctx());
    const stale = await put({ bag: "sdm", title: URI, text: meme(["a", "z"]), base: first["canonicalHash"] }, ctx());
    expect(stale).toMatchObject({ decision: "conflict", canonicalHash: moved["canonicalHash"] });
    expect(stale["canonicalHash"]).not.toBe(first["canonicalHash"]);
    expect(await r.composite.storeForBag(bagUri("sdm"))!.get(`${URI}#/z`)).toBeNull();
    // CONTROL: the live base lets the write through.
    const next = await put({ bag: "sdm", title: URI, text: meme(["a", "b", "z"]), base: moved["canonicalHash"] }, ctx());
    expect(next["decision"]).toBe("put");
  });

  test("★ absence never deletes: a slot the new text omits stays standing by name, and leaves only where `cut` names it ★", async () => {
    const r = rig();
    const put = makeTiddlerPutReactor(r.opts);
    const sdm = r.composite.storeForBag(bagUri("sdm"))!;
    await put({ bag: "sdm", title: URI, text: meme(["a", "b"]) }, ctx());
    expect(await put({ bag: "sdm", title: URI, text: meme(["a"]) }, ctx())).toMatchObject({ decision: "put", kept: [`${URI}#/b`], tombstoned: [] });
    expect(await sdm.listVisible()).toContain(`${URI}#/b`);
    expect(await put({ bag: "sdm", title: URI, text: meme(["a"]), cut: ["#/b"] }, ctx())).toMatchObject({ decision: "put", kept: [], tombstoned: expect.arrayContaining([`${URI}#/b`]) });
    expect(await sdm.listVisible()).not.toContain(`${URI}#/b`);
    expect(await sdm.listVisible()).toContain(`${URI}#/a`);
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
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu slot=`#/a`>>");
  });

  test("★ the draft shadows canon when both hold it ★", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await land(draft, wikiSlotUri("garden", "draft"), ["b"]);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu slot=`#/b`>>");
    expect((got["meme"] as { text: string }).text).not.toContain("<<~ ahu slot=`#/a`>>");
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
    expect((beneath["meme"] as { text: string }).text).toContain("<<~ ahu slot=`#/a`>>");
  });

  test("★ a projection through the recipe meets the same shadow and names the absent meme ★", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    await shadow(r, ["a"]);
    await expect(makeMemeProjectReactor(r.opts)({ recipe: "garden", uri: URI, to: "md" }, ctx())).rejects.toThrow(/no meme stands/);
  });

  test("CONTROL: a tombstone BENEATH a live record shadows nothing above it", async () => {
    const r = rig();
    const { canon, draft } = stacked(r);
    await land(draft, wikiSlotUri("garden", "draft"), ["b"]);
    await canon.tombstone(URI, { kind: "canon-hydrate", receipt: "t" });
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu slot=`#/b`>>");
  });

  test("CONTROL: a record a hand REMOVED from the working layer (no tombstone) lets canon read through", async () => {
    const r = rig();
    const { canon } = stacked(r);
    await land(canon, bagUri("garden"), ["a"]);
    const working = r.slots.get("garden/working")!;
    await land(working, wikiSlotUri("garden", "working"), ["b"]);
    for (const title of [URI, `${URI}#/b`]) await working.remove(title, { kind: "canon-hydrate", receipt: "t" });
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect((got["meme"] as { text: string }).text).toContain("<<~ ahu slot=`#/a`>>");
  });

  test("CONTROL: an absent meme reads null through the stack, never a refusal", async () => {
    const r = rig();
    stacked(r);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "garden", uri: URI }, ctx());
    expect(got["meme"]).toBeNull();
  });

  test("a meme the face's personal layer holds reads through the recipe: the personal layer rides above the workbench in the stack", async () => {
    const r = rig();
    const working = wikiSlotUri("elyncia", "working"), personal = wikiSlotUri("elyncia", "personal");
    r.recipes.set(recipeUri("catalog", "elyncia"), { tiddler: { title: recipeUri("catalog", "elyncia"), "bag-stack": bagUri("elyncia"), "writable-bag": working } });
    const bench = new MemoryTiddlerStore(working), personalLayer = new MemoryTiddlerStore(personal);
    r.slots.set("elyncia/working", bench); r.slots.set("elyncia/personal", personalLayer);
    await land(personalLayer, personal, ["a"]);
    const got = await makeMemeGetReactor(r.opts)({ recipe: "elyncia", uri: URI }, ctx());
    expect((got["meme"] as { text?: string } | null)?.text).toContain("! a");
    expect(await bench.get(URI), "the workbench holds no byte of it").toBeNull();
  });

  test("an unknown recipe fails loud, naming the slug", async () => {
    const r = rig();
    await expect(makeMemeGetReactor(r.opts)({ recipe: "ghost", uri: URI }, ctx())).rejects.toThrow(/ghost/);
  });

  test("a recipe whose designated bag nothing reaches fails loud, naming slug and bag", async () => {
    const r = rig();
    const draft = wikiSlotUri("far", "draft");
    r.recipes.set(recipeUri("catalog", "far"), { tiddler: { title: recipeUri("catalog", "far"), "writable-bag": draft } });
    await expect(makeMemeGetReactor(r.opts)({ recipe: "far", uri: URI }, ctx())).rejects.toThrow(draft);
  });
});

describe("the container law", () => {
  test("recipe AND bag together refuse, at the read and at the bag put alike", async () => {
    const r = rig();
    await expect(makeMemeGetReactor(r.opts)({ recipe: "sdm", bag: "sdm", uri: URI }, ctx()))
      .rejects.toMatchObject({ name: "VerbRefusal", reason: "no-container" });
    await expect(makeTiddlerPutReactor(r.opts)({ recipe: "sdm", bag: "sdm", title: URI, text: meme(["a"]) }, ctx()))
      .rejects.toMatchObject({ name: "VerbRefusal", reason: "no-container" });
  });
  test("no container at all reads the daemon wiki: the read answers what recipe default answers; a realm alone still refuses", async () => {
    const settle = (p: Promise<Record<string, unknown>>): Promise<unknown> => p.then((v) => v, (e: Error & { reason?: unknown }) => ({ refused: e.reason ?? e.message }));
    const r = rig();
    const neither = await settle(makeMemeGetReactor(r.opts)({ uri: URI }, ctx()));
    expect(neither).not.toMatchObject({ refused: "no-container" });
    expect(neither).toEqual(await settle(makeMemeGetReactor(r.opts)({ uri: URI, recipe: "default" }, ctx())));
    await expect(makeMemeGetReactor(r.opts)({ uri: URI, realm: "a".repeat(64) }, ctx())).rejects.toMatchObject({ reason: "no-container" });
  });
  test("a read needs its uri, and a bag put its title", async () => {
    const r = rig();
    await expect(makeMemeGetReactor(r.opts)({ recipe: "default" }, ctx())).rejects.toThrow(/uri/);
    await expect(makeTiddlerPutReactor(r.opts)({ bag: "sdm", text: meme(["a"]) }, ctx())).rejects.toThrow(/title/);
  });
});

describe("meme-get — the read half", () => {
  test("reads the anchor back: text + the canonical hash the placement reported", async () => {
    const r = rig();
    const placed = await seedAnchor(r, meme(["a"]));
    const got = (await makeMemeGetReactor(r.opts)({ recipe: "default", uri: URI }, ctx()))["meme"] as { text: string; canonicalHash: string };
    expect(got.canonicalHash).toBe(placed.canonicalHash);
    expect(got.text).toContain("<<~ ahu slot=`#/a`>>");
  });

  test("reads a named bag back under the hash the bag put reported, and a bag's absence reads null", async () => {
    const r = rig();
    const put = await seedBag(r, "sdm", meme(["a"]));
    const got = (await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: URI }, ctx()))["meme"] as { canonicalHash: string };
    expect(got.canonicalHash).toMatch(/^sha256:/);
    expect(got.canonicalHash).toBe(put["canonicalHash"]);
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

  test("RED: a named bag projects md over that bag's records; the carrier itself (mem) reads through the one door and refuses here by name", async () => {
    const r = rigWithFace();
    projectCalls.length = 0;
    await seedBag(r, "sdm", meme(["a"]));
    const project = makeMemeProjectReactor(r.opts);
    await expect(project({ bag: "sdm", uri: URI, to: "mem" }, ctx())).rejects.toThrow(/tiddler-get \(meme: true, grain: "whole"\)/);
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
    await expect(project({ recipe: "default", uri: URI, to: "docx" }, ctx())).rejects.toThrow(/docx.*md · html · tid · json/);
    await expect(project({ bag: "sdm", uri: URI, to: "html" }, ctx())).rejects.toThrow(/anchor/);
    await expect(project({ bag: "sdm", uri: URI, to: "md" }, ctx())).rejects.toThrow(URI);
    await expect(project({ recipe: "default", uri: URI }, ctx())).rejects.toThrow(/args\.to/);
  });
});

/**
 * THE LISTING VERB — `meme-list { recipe?, bag?, tree? }` → `{ bag, roots }`: every root the seat holds,
 * with its canonical hash; `tree` nests the slot tree. The same container law as `meme-get`; gates read.
 */
describe("meme-list — roots by default, the slot tree on request", () => {
  test("★ the anchor lists every root with the hash the placement reported; CONTROL: a plain tiddler never lists ★", async () => {
    const r = rig();
    const a = await seedAnchor(r, meme(["a", "b"]));
    r.wiki.store.set("plain", { title: "plain", text: "prose" });
    capCalls.length = 0;
    const out = await makeMemeListReactor(r.opts)({ recipe: "default" }, ctx());
    expect(String(out["has"])).toMatch(/^<<~ has name=`.*` params=`kind\/family-list /);
    expect(out["roots"]).toEqual([{ uri: URI, canonicalHash: a.canonicalHash }]);
    expect(capCalls[0]?.access).toBe("read");
  });

  test("★ `tree` nests `uri#/slot` under its own root; a named bag lists that bag's records alone ★", async () => {
    const r = rig();
    await seedBag(r, "sdm", meme(["a"]));
    await seedAnchor(r, meme(["z"]).replaceAll("t/x", "t/anchor"), "lar:///t/anchor");
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
 * EVERY ROOT ANSWERS. A verb's outcome carries at most `AUDIT_ARRAY_CAP` rows of an array and turns a
 * longer one into a count and a sample, so a listing that named a large seat's roots in one array reached
 * its reader as no roots at all. The listing pages at that cap: each answer rides whole through the
 * outcome's bound, and `next` names the cursor of the page behind it.
 */
describe("meme-list — a seat past the outcome's cap answers every root, a page at a time", () => {
  const at = (n: number): string => `lar:///t/many/${String(n).padStart(3, "0")}`;
  const memeAt = (uri: string, slots: readonly string[] = ["a"]): string => meme(slots).replaceAll(URI, uri).replaceAll("t/x", uri.slice("lar:///".length));
  const fill = async (r: Rig, count: number) => {
    for (let i = 0; i < count; i++) await seedBag(r, "sdm", memeAt(at(i)), at(i));
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
    for (let i = 0; i < MEME_LIST_PAGE + 2; i++) await seedAnchor(r, memeAt(at(i)), at(i));
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

/**
 * A FAMILY LEAVES ITS BAG THROUGH THE TIDDLER DOOR — `tiddler-delete { bag, title, family: true, base? }` over
 * `removeMeme`: the root and its slots leave as one change; a stale carrier base answers `conflict` and moves nothing;
 * an absent root answers `absent`; a slot's own title leaves by the cut of its parent's text. Gates admin.
 */
describe("a family delete — a bag's family leaves through its own store", () => {
  const del = (r: Rig, args: Record<string, unknown>, c: VerbContext = ctx()) => makeTiddlerDeleteReactor(r.opts)(args, c);

  test("a meme root answers `refused` until the call names the family act, and nothing moves", async () => {
    const r = rig();
    await seedBag(r, "sdm", meme(["a", "b"]));
    const out = await del(r, { bag: "sdm", title: URI });
    expect(out).toMatchObject({ bag: bagUri("sdm"), title: URI, decision: "refused", refusal: "tiddler-delete-in-a-family", tombstoned: [], retracted: [] });
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toEqual(expect.arrayContaining([URI, `${URI}#/a`, `${URI}#/b`]));
  });

  test("★ a family delete over nothing beneath raises no tombstone: the family retracts plainly from its layer; gates admin on the bag ★", async () => {
    const r = rig();
    await seedBag(r, "sdm", meme(["a", "b"]));
    capCalls.length = 0;
    const out = await del(r, { bag: "sdm", title: URI, family: true });
    expect(out).toMatchObject({ bag: bagUri("sdm"), title: URI, decision: "removed", mode: "plain", tombstoned: [] });
    expect(out).not.toHaveProperty("recipe");
    expect([...(out["retracted"] as string[])].sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect(capCalls[0]).toEqual({ access: "admin", bag: bagUri("sdm") });
    const sdm = r.composite.storeForBag(bagUri("sdm"))!;
    for (const title of [URI, `${URI}#/a`, `${URI}#/b`]) expect(await sdm.get(title), `${title} leaves with no kāpae`).toBeNull();
  });

  test("★ CONTROL: a family delete over a lower layer's record still tombstones, so the lower record stays hidden ★", async () => {
    const r = rig();
    await seedBag(r, "sdm", meme(["a"]));
    await seedBag(r, "daemon", meme(["a"]));
    const out = await del(r, { bag: "daemon", title: URI, family: true });
    expect(out["decision"]).toBe("removed");
    expect([...(out["tombstoned"] as string[])].sort()).toEqual([URI, `${URI}#/a`]);
    expect(out["retracted"]).toEqual([]);
    expect((await r.composite.storeForBag(bagUri("daemon"))!.get(URI))?.meta?.deleted).toBe(true);
    expect((await r.composite.storeForBag(bagUri("sdm"))!.get(URI))?.meta?.deleted, "the lower layer keeps its record").not.toBe(true);
  });

  test("★ CONTROL: a stale carrier base answers conflict and moves nothing; the answer names the live hash ★", async () => {
    const r = rig();
    const first = await seedBag(r, "sdm", meme(["a"]));
    const moved = await seedBag(r, "sdm", meme(["a", "b"]));
    const out = await del(r, { bag: "sdm", title: URI, family: true, base: first["canonicalHash"] });
    expect(out).toMatchObject({ decision: "conflict", canonicalHash: moved["canonicalHash"], tombstoned: [] });
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toContain(`${URI}#/b`);
    // The live base lets the removal through.
    expect((await del(r, { bag: "sdm", title: URI, family: true, base: moved["canonicalHash"] }))["decision"]).toBe("removed");
  });

  test("an absent root answers absent; a standing one removes from that bag's writable layer", async () => {
    const r = rig();
    expect(await del(r, { bag: "sdm", title: URI, family: true })).toMatchObject({ bag: bagUri("sdm"), decision: "absent", tombstoned: [], retracted: [] });
    await seedBag(r, "sdm", meme(["a"]));
    const out = await del(r, { bag: "sdm", title: URI, family: true });
    expect(out["decision"]).toBe("removed");
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toEqual([]);
  });

  test("a delete of `<root>#/<slot>` lands as the cut: the slot leaves by name, its sibling stays, the family reseals", async () => {
    const r = rig();
    await seedBag(r, "sdm", meme(["a", "b"]));
    const out = await del(r, { bag: "sdm", title: `${URI}#/b` });
    expect(out).toMatchObject({ bag: bagUri("sdm"), title: `${URI}#/b`, decision: "removed", mode: "cut", parent: URI, tombstoned: [`${URI}#/b`] });
    const sdm = r.composite.storeForBag(bagUri("sdm"))!;
    expect(await sdm.listVisible()).not.toContain(`${URI}#/b`);
    expect(await sdm.listVisible()).toContain(`${URI}#/a`);
    const got = (await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: URI }, ctx()))["meme"] as { text: string; canonicalHash: string };
    expect(got.text).not.toContain("<<~ ahu slot=`#/b`>>");
    expect(got.canonicalHash).toBe(out["canonicalHash"]);
  });

  test("a denied admin cap stops the family delete before anything moves", async () => {
    const r = rig();
    await seedBag(r, "sdm", meme(["a"]));
    const denying: VerbContext = { ...ctx(), cap: async (access) => (access === "admin" ? { ok: false, reason: "no admin" } : { ok: true }) };
    await expect(del(r, { bag: "sdm", title: URI, family: true }, denying)).rejects.toThrow(/cap-denied: admin/);
    expect(await r.composite.storeForBag(bagUri("sdm"))!.listVisible()).toContain(URI);
  });
});

/**
 * A NAMED WIKI'S LAYER BY `--bag`. `--bag lar:///ha.ka.ba/wikis/<slug>/working` names the doc THE ONE resolver
 * mints for that wiki's working layer — the same doc `recipe=<slug>` walks. The bag reach answers it through
 * the slot resolver, beside the composite and the planes, so a wiki's own working layer reads and takes a put
 * under its bag address, and the put's answer names the layer.
 */
describe("a wiki's instance slot answers as a bag", () => {
  const WBAG = "lar:///ha.ka.ba/wikis/garden/working";
  test("get --bag wikis/garden/working reads the working slot's doc", async () => {
    const r = rig();
    const working = new MemoryTiddlerStore(WBAG);
    r.slots.set("garden/working", working);
    await placeMeme({ uri: URI, text: meme(["a"]) }, storeMemeSink(working, WBAG, { kind: "canon-hydrate", receipt: "t" }));
    const got = await makeMemeGetReactor(r.opts)({ bag: WBAG, uri: URI }, ctx());
    expect(got["meme"], "the working slot never reached by --bag").not.toBeNull();
  });
  test("a bag put on wikis/garden/working lands in the working slot's doc, and the answer names the layer", async () => {
    const r = rig();
    const working = new MemoryTiddlerStore(WBAG);
    r.slots.set("garden/working", working);
    const answer = await seedBag(r, WBAG, meme(["a"]));
    expect(answer).toMatchObject({ decision: "put", bag: WBAG, layer: "working", created: true });
    expect(answer).not.toHaveProperty("recipe");
    expect(await working.get(URI)).not.toBeNull();
    // Residency rides the store the record sits in; the record carries no stamp of it.
    expect((await working.get(URI))?.tiddler["bag"]).toBeUndefined();
    expect(r.wiki.store.size).toBe(0);
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

describe("a bag put into a wiki's working layer — THE FORK REMEMBERS ITS BASE (override-base.ts)", () => {
  /** A wiki `garden` over its canon; its working slot the resolver hands back. */
  const garden = (r: Rig) => {
    const working = wikiSlotUri("garden", "working");
    r.recipes.set(recipeUri("catalog", "garden"), { tiddler: { title: recipeUri("catalog", "garden"), "bag-stack": `${bagUri("lares")} ${bagUri("garden")}`, "writable-bag": working } });
    const canon = new MemoryTiddlerStore(bagUri("garden"));
    r.reached.set(bagUri("garden"), canon);
    const layer = new MemoryTiddlerStore(working);
    r.slots.set("garden/working", layer);
    return { canon, layer, working };
  };
  const seedCanon = async (canon: MemoryTiddlerStore, slots: readonly string[]) =>
    placeMeme({ uri: URI, text: meme(slots) }, storeMemeSink(canon, bagUri("garden"), { kind: "canon-hydrate", receipt: "t" }));

  test("★ a bag put (--bag wikis/<slug>/working) over a title canon holds names canon's carrier identity, and a later put keeps it ★", async () => {
    const r = rig();
    const { canon, layer, working } = garden(r);
    await seedCanon(canon, ["a"]);
    const canonHash = carrierHashOf((await canon.get(URI))!.tiddler);
    await seedBag(r, working, meme(["a", "b"]));
    expect(overrideBaseOf(await layer.get(URI)), "the working copy forked from canon names no base: canon's fresher warning can never read").toBe(canonHash);
    expect(overrideBaseOf(await layer.get(`${URI}#/a`)), "a slot canon holds forks from canon's slot").toBe(carrierHashOf((await canon.get(`${URI}#/a`))!.tiddler));
    expect(overrideBaseOf(await layer.get(`${URI}#/b`)), "a slot canon holds none of names no base").toBeNull();
    // Canon moves under the copy; a re-put of the copy keeps the base it FORKED from, never canon's new identity.
    await seedCanon(canon, ["a", "moved"]);
    await makeTiddlerPutReactor(r.opts)({ bag: working, title: URI, text: meme(["a", "b", "c"]) }, ctx("r2"));
    expect(overrideBaseOf(await layer.get(URI)), "a later write of the copy dropped or re-forked the base it forked from").toBe(canonHash);
  });

  test("CONTROL: a working-only title (canon holds none) names no base", async () => {
    const r = rig();
    const { layer, working } = garden(r);
    await seedBag(r, working, meme(["a"]));
    expect(await layer.get(URI)).toBeTruthy();
    expect(overrideBaseOf(await layer.get(URI))).toBeNull();
  });
});

describe("a slot put — one slot's body, through the family's own gate", () => {
  const SEALED = /<<\^ code=`&#x0003;` bcc=`ni:\/\/\/sha-256;[A-Za-z0-9_-]+`>>/;
  const A = `${URI}#/a`, B = `${URI}#/b`;
  /** A carrier whose slot `#/a` nests a child `#/a/z` and carries a line after the child's close: the slot's `$postamble`. */
  const NESTED =
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
    "<<~ ahu slot=`#/a`>>\n\n! a\n\n<<~ ahu slot=`#/a/z`>>\n\n! z\n\n<<~/ahu>>\n\nafter the child\n\n<<~/ahu>>\n\n" +
    "<<~ ahu slot=`#/b`>>\n\n! b\n\n<<~/ahu>>\n" +
    `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
  const seeded = async (text = meme(["a", "b"])) => {
    const r = rig();
    expect(await seedBag(r, "sdm", text)).toMatchObject({ decision: "put", created: true });
    const store = r.composite.storeForBag(bagUri("sdm"))!;
    const read = async () => (await makeMemeGetReactor(r.opts)({ bag: "sdm", uri: URI }, ctx()))["meme"] as { text: string; canonicalHash: string };
    /** The text one record of the bag holds now. */
    const body = async (title: string) => String((await store.get(title))?.tiddler["text"]);
    const reactor = makeTiddlerPutReactor(r.opts);
    const put = (args: Record<string, unknown>) => reactor({ bag: "sdm", ...args }, ctx());
    return { r, store, read, body, put };
  };

  test("★ an append lands one paragraph at the end of the slot's body, resealed, and the answer carries the next base ★", async () => {
    const { read, body, put } = await seeded();
    const before = await read();
    const answer = await put({ title: A, append: "* a new bullet\n" });
    expect(answer).toMatchObject({ title: A, decision: "put", bag: bagUri("sdm"), position: "slot", family: URI, appended: "* a new bullet\n".length, appendedTo: A });
    expect(await body(A)).toBe("! a\n\n* a new bullet");
    expect(await body(B)).toBe("! b");
    const after = await read();
    expect(after.text).toMatch(SEALED);
    expect(after.canonicalHash).toBe(answer["canonicalHash"]);
    expect(after.canonicalHash).not.toBe(before.canonicalHash);
  });

  test("★ an append names no base, and the family stays sealed whole ★", async () => {
    const { read, body, put } = await seeded();
    const before = await read();
    const answer = await put({ title: A, append: "dated note" });
    expect(answer).toMatchObject({ decision: "put", appendedTo: A });
    expect(await body(A)).toBe("! a\n\ndated note");
    expect(await body(B)).toBe("! b");
    const after = await read();
    expect(after.text).toMatch(SEALED);
    expect(after.canonicalHash).toBe(answer["canonicalHash"]);
    expect(after.canonicalHash).not.toBe(before.canonicalHash);
  });

  test("★ appends racing one family both land, and a text put on a base read before them answers conflict ★", async () => {
    const { read, body, put } = await seeded();
    for (let i = 0; i < 8; i++) {
      const base = (await read()).canonicalHash;
      const words = [`north ${i}`, `south ${i}`];
      const answers = await Promise.all(words.map((append) => put({ title: A, append })));
      expect(answers.map((x) => x["decision"])).toEqual(["put", "put"]);
      const standing = await body(A);
      for (const w of words) expect(standing).toContain(w);
      const live = await read();
      expect(live.text).toMatch(SEALED);
      expect(await put({ title: A, text: `! a, late ${i}`, base })).toMatchObject({ decision: "conflict", canonicalHash: live.canonicalHash });
      expect(await body(A)).toBe(standing);
    }
  });

  test("a text put swaps the slot's whole body and leaves its siblings", async () => {
    const { read, body, put } = await seeded();
    const answer = await put({ title: B, text: "! b, rewritten\n\nnew prose", base: (await read()).canonicalHash });
    expect(answer).toMatchObject({ title: B, decision: "put", position: "slot", family: URI });
    expect(await body(B)).toBe("! b, rewritten\n\nnew prose");
    expect(await body(A)).toBe("! a");
    // CONTROL: a slot's text put needs no base.
    expect(await put({ title: B, text: "! b, again" })).toMatchObject({ decision: "put" });
    expect(await body(B)).toBe("! b, again");
    expect((await read()).text).toMatch(SEALED);
  });

  test("★ a stale carrier base answers conflict and moves nothing; the answer names the live hash ★", async () => {
    const { read, body, put } = await seeded();
    const stale = (await read()).canonicalHash;
    await put({ title: URI, text: meme(["a", "b", "c"]) });
    const live = (await read()).canonicalHash;
    expect(live).not.toBe(stale);
    const answer = await put({ title: A, text: "! a, late", base: stale });
    expect(answer).toMatchObject({ decision: "conflict", canonicalHash: live });
    expect(await body(A)).toBe("! a");
  });

  test("a partial base that names no readable span refuses before a slot write", async () => {
    const { read, body, put } = await seeded();
    await expect(put({ title: A, text: "x", base: `partial:${(await read()).canonicalHash}` })).rejects.toMatchObject({ reason: "base-outside-span" });
    expect(await body(A)).toBe("! a");
  });

  test("bare and canonical slot reads name the same span", async () => {
    const { r } = await seeded();
    const get = makeMemeGetReactor(r.opts);
    const bare = await get({ bag: "sdm", uri: URI, slot: "a" }, ctx());
    const canonical = await get({ bag: "sdm", uri: URI, slot: "#/a" }, ctx());
    expect(bare).toEqual(canonical);
  });

  test("★ a slot the family holds none of refuses by name and moves nothing: a slot joins through its parent's text ★", async () => {
    const { store, read, put } = await seeded();
    const before = (await read()).canonicalHash;
    await expect(put({ title: `${URI}#/nowhere`, text: "x" })).rejects.toMatchObject({ reason: "family-joins-by-text" });
    await expect(put({ title: `${URI}#/nowhere`, append: "x" })).rejects.toMatchObject({ reason: "append-target-missing" });
    expect(await store.get(`${URI}#/nowhere`)).toBeNull();
    expect((await read()).canonicalHash).toBe(before);
  });

  test("an append carries its words alone: a base beside it refuses, and so does an append to a family no bag holds", async () => {
    const { read, body, put } = await seeded();
    await expect(put({ title: A, append: "x", base: (await read()).canonicalHash })).rejects.toMatchObject({ reason: "append-alone" });
    await expect(put({ title: A, append: "x", text: "y" })).rejects.toMatchObject({ reason: "append-alone" });
    await expect(put({ title: "lar:///t/none#/a", append: "x" })).rejects.toMatchObject({ reason: "append-target-missing" });
    expect(await body(A)).toBe("! a");
  });

  test("CONTROL: the family's gate still judges the recomposed carrier: a body that breaks the frame refuses and lands nothing", async () => {
    const { read, body, put } = await seeded();
    const before = (await read()).canonicalHash;
    await expect(put({ title: A, append: "<<^ code=`&#x0003;`>>" })).rejects.toMatchObject({ reason: "family-gate-refused" });
    expect(await body(A)).toBe("! a");
    expect((await read()).canonicalHash).toBe(before);
  });

  test("★ a slot that carries text after its last child takes an append into that postamble ★", async () => {
    const { store, read, body, put } = await seeded(NESTED);
    const POST = `${A}/$postamble`;
    expect(String((await store.get(POST))?.tiddler["text"])).toContain("after the child");
    const own = await body(A);
    const answer = await put({ title: A, append: "more words" });
    expect(answer).toMatchObject({ title: A, decision: "put", appended: "more words".length, appendedTo: POST });
    expect(await body(A), "the slot's own record keeps its text").toBe(own);
    expect(await body(POST)).toMatch(/after the child\n\nmore words/);
    const after = await read();
    expect(after.text).toMatch(/<<~\/ahu>>\s+after the child\s+more words\s+<<~\/ahu>>/);
    expect(after.text).toMatch(SEALED);
    expect(after.canonicalHash).toBe(answer["canonicalHash"]);
  });

  test("a text put on that slot moves the slot's own record and leaves its postamble standing", async () => {
    const { store, read, body, put } = await seeded(NESTED);
    const POST = `${A}/$postamble`;
    // The slot's own text, its call to the child and all, with the heading reworded.
    const answer = await put({ title: A, text: (await body(A)).replace("! a", "! a, rewritten") });
    expect(answer).toMatchObject({ title: A, decision: "put", position: "slot" });
    expect(await body(A)).toContain("! a, rewritten");
    expect(String((await store.get(POST))?.tiddler["text"])).toContain("after the child");
    const after = await read();
    expect(after.text).toMatch(/! a, rewritten\s+<<~ ahu slot=`#\/a\/z`>>[\s\S]*?<<~\/ahu>>\s+after the child\s+<<~\/ahu>>/);
    expect(after.text).toMatch(SEALED);
  });
});

describe("meme-get — on a gradient by grain: whole within a page, the has-stack past it, never a mid-slot cut", () => {
  const words = (n: number, word = "lorem"): string => Array.from({ length: n }, () => word).join(" ");
  const carrier = (slots: ReadonlyArray<readonly [string, number]>, word = "lorem"): string =>
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
    slots.map(([s, n]) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n${words(n, word)}\n\n<<~/ahu>>\n`).join("\n") +
    `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
  const ANCHOR: Record<string, string> = { recipe: "default" };
  const BAG: Record<string, string> = { bag: "sdm" };
  /** The carrier seated in the anchor wiki, for the reads. */
  const seat = async (text: string) => {
    const r = rig();
    await seedAnchor(r, text);
    return r;
  };
  /** The carrier seated in a bag, for the writes a read's base guards. */
  const seatBag = async (text: string) => {
    const r = rig();
    await seedBag(r, "sdm", text);
    return r;
  };
  type Got = { meme: { text?: string; canonicalHash: string; bytes: number; grain: { asked: string | null; applied: string; why: string }; slots: Array<{ slot: string; bytes: number }>; page?: { page: number; pages: number }; next: { grain: string; after?: string } | null } };
  const get = async (r: Rig, extra: Record<string, unknown> = {}, from: Record<string, string> = ANCHOR): Promise<Got> =>
    (await makeMemeGetReactor(r.opts)({ ...from, uri: URI, ...extra }, ctx())) as unknown as Got;
  const put = (r: Rig, args: Record<string, unknown>) => makeTiddlerPutReactor(r.opts)({ bag: "sdm", ...args }, ctx());
  const size = (text: string): number => new TextEncoder().encode(text).length;
  const read = async (r: Rig): Promise<string> => (await get(r, { grain: "whole" })).meme.text!;

  test("one page names the gradient's edge, and a carrier within it answers whole, byte for byte", async () => {
    expect(READ_PAGE_BYTES).toBe(65_536);
    const r = await seat(carrier([["a", 40], ["b", 40]]));
    const got = await get(r);
    expect(got.meme.grain.applied).toBe("whole");
    expect(got.meme.next).toBeNull();
    expect(got.meme.text).toBe(await read(r));
    expect(got.meme.bytes).toBe(size(got.meme.text!));
    expect(got.meme.slots.map((s) => s.slot)).toEqual(["#/a", "#/b"]);
  });

  test("RED: a carrier past a page answers its has-stack (the slots, no text) and names the whole as next; no truncated carrier", async () => {
    const r = await seat(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    const got = await get(r);
    expect(got.meme.bytes).toBeGreaterThan(READ_PAGE_BYTES);
    expect(got.meme.grain.applied).toBe("skinny");
    expect(got.meme.text).toBeUndefined();
    expect(got.meme.slots.map((s) => s.slot)).toEqual(["#/a", "#/b", "#/c"]);
    expect(got.meme.next).toEqual({ grain: "whole" });
  });

  test("RED: the whole grain pages on slot boundaries; the pages join to the carrier and none ends mid-slot", async () => {
    const r = await seat(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    const first = await get(r, { grain: "whole" });
    expect(first.meme.page?.pages).toBeGreaterThan(1);
    const pages = [first.meme.text!];
    for (let page = first; page.meme.next?.after; ) {
      page = await get(r, { grain: "whole", after: page.meme.next.after });
      const bare = (h: string): string => h.replace(/^partial:(?:#\/[^:]+|p[0-9]+):/, "");
      expect(bare(page.meme.canonicalHash)).toBe(bare(first.meme.canonicalHash));
      expect(page.meme.text!.startsWith("<<~ ahu slot=")).toBe(true);
      pages.push(page.meme.text!);
    }
    expect(size(pages.join(""))).toBe(first.meme.bytes);
    for (const page of pages.slice(0, -1)) expect(page.trimEnd().endsWith("<<~/ahu>>")).toBe(true);
  });

  test("the final page's whole base supports a subsequent whole write", async () => {
    const r = await seatBag(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    let page = await get(r, { grain: "whole" }, BAG);
    const pieces = [page.meme.text!];
    while (page.meme.next?.after) {
      page = await get(r, { grain: "whole", after: page.meme.next.after }, BAG);
      pieces.push(page.meme.text!);
    }
    expect(page.meme.next).toBeNull();
    expect(page.meme.canonicalHash).not.toMatch(/^partial:/);
    expect(await put(r, { title: URI, text: pieces.join("").replace("lorem", "changed"), base: page.meme.canonicalHash })).toMatchObject({ decision: "put" });
  });

  test("a slot larger than a page rides its own page whole, never cut", async () => {
    const r = await seat(carrier([["a", 40], ["big", 20_000], ["c", 40]]));
    const pages: string[] = [];
    for (let page = await get(r, { grain: "whole" }); ; ) {
      pages.push(page.meme.text!);
      if (!page.meme.next?.after) break;
      page = await get(r, { grain: "whole", after: page.meme.next.after });
    }
    expect(pages.some((p) => p.startsWith("<<~ ahu slot=`#/big`") && size(p) > READ_PAGE_BYTES)).toBe(true);
  });

  test("a cursor that reads as none refuses; a carrier that moved under the cursor refuses stale; an unknown grain refuses loudly", async () => {
    const r = await seat(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    const first = await get(r, { grain: "whole" });
    await expect(get(r, { grain: "whole", after: "nonsense" })).rejects.toMatchObject({ reason: "read-cursor-malformed" });
    await expect(get(r, { grain: "thin" })).rejects.toMatchObject({ reason: "grain-unknown" });
    await seedAnchor(r, carrier([["a", 6_001], ["b", 6_000], ["c", 6_000]]));
    await expect(get(r, { grain: "whole", after: first.meme.next!.after! })).rejects.toMatchObject({ reason: "read-cursor-stale" });
  });

  test("RED M2 base-from-skinny: a has-stack answer's base names the card, so a root put or a slot put against it refuses by name", async () => {
    const r = await seatBag(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    const stack = await get(r, {}, BAG);
    expect(stack.meme.canonicalHash).toMatch(/^skinny:/);
    await expect(put(r, { title: URI, text: carrier([["a", 1]]), base: stack.meme.canonicalHash })).rejects.toMatchObject({ reason: "base-from-skinny" });
    await expect(put(r, { title: `${URI}#/a`, text: "! a\n\nmore", base: stack.meme.canonicalHash })).rejects.toMatchObject({ reason: "base-from-skinny" });
    // CONTROL: the whole carrier's base authorizes the write.
    const whole = await get(r, { grain: "whole" }, BAG);
    expect(whole.meme.canonicalHash).not.toMatch(/^skinny:/);
  });

  test("RED partial-base: a root put refuses a partial base (a page short of the end) by name; a slot put within the page takes it", async () => {
    const r = await seatBag(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    const first = await get(r, { grain: "whole" }, BAG);
    expect(first.meme.canonicalHash).toMatch(/^partial:/);
    await expect(put(r, { title: URI, text: carrier([["a", 1]]), base: first.meme.canonicalHash })).rejects.toMatchObject({ reason: "base-from-partial" });
    expect(await put(r, { title: `${URI}#/a`, text: "! a\n\nmore", base: first.meme.canonicalHash })).toMatchObject({ decision: "put" });
  });

  test("RED span: a slot answer's partial base names its slot, and a put on another slot refuses base-outside-span", async () => {
    const r = await seatBag(carrier([["a", 40], ["b", 40]]));
    const slot = await get(r, { slot: "#/a" }, BAG);
    expect(slot.meme.canonicalHash).toMatch(/^partial:#\/a:/);
    await expect(put(r, { title: URI, text: carrier([["a", 1]]), base: slot.meme.canonicalHash })).rejects.toMatchObject({ reason: "base-from-partial" });
    await expect(put(r, { title: `${URI}#/b`, text: "! b\n\nmore", base: slot.meme.canonicalHash })).rejects.toMatchObject({ reason: "base-outside-span" });
    expect(await put(r, { title: `${URI}#/a`, text: "! a\n\nmore", base: slot.meme.canonicalHash })).toMatchObject({ decision: "put" });
  });

  test("RED span: a page's partial base names its page, and a put on a slot of another page refuses base-outside-span", async () => {
    const r = await seatBag(carrier([["a", 6_000], ["b", 6_000], ["c", 6_000]]));
    const first = await get(r, { grain: "whole" }, BAG);
    expect(first.meme.canonicalHash).toMatch(/^partial:p1:/);
    await expect(put(r, { title: `${URI}#/c`, text: "! c\n\nmore", base: first.meme.canonicalHash })).rejects.toMatchObject({ reason: "base-outside-span" });
    expect(await put(r, { title: `${URI}#/a`, text: "! a\n\nmore", base: first.meme.canonicalHash })).toMatchObject({ decision: "put" });
  });

  test("RED M1: a stay-home title answers no read through the internal meme-get either (`tiddler-withheld`)", async () => {
    const r = rig();
    r.wiki.store.set("$:/temp/lares/alert/x", { title: "$:/temp/lares/alert/x", text: "device-local" });
    await expect(makeMemeGetReactor(r.opts)({ recipe: "default", uri: "$:/temp/lares/alert/x" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeMemeProjectReactor(r.opts)({ recipe: "default", uri: "$:/temp/lares/alert/x", to: "md" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
  });

  test("an absent meme still answers null", async () => {
    const r = rig();
    const out = await makeMemeGetReactor(r.opts)({ recipe: "default", uri: URI }, ctx());
    expect(out["meme"]).toBeNull();
  });
});
