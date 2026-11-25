/**
 * kahu-reach-doors.test — W26 slice 6: every door that can land a byte in system canon (`bags/lares`,
 * `bags/lararium`) refuses a hand outside the Kahu cabal through the ONE predicate, BEFORE it writes. One red per
 * door, so a door left open reads red by name:
 *
 *   residency reactor  ADD · COPY · MOVE · CLEAR · DROP · LOAD · INGEST   (into canon; MOVE also out of it)
 *   meme put · meme delete · draft placement · a realm steward's write (the realm grant stands in for no check)
 *   wiki-mint          a minted wiki's recipe names no system bag as a live library, and a system slug's canon document is
 *                      named only to a hand the cabal admits
 *
 * Every stranger draws `kahu-reach` and moves no byte. CONTROLS: a Kahu hand (a counted 1-of-1 admission AND a
 * sentinel membership) lands the same act; a copy OUT of canon succeeds for a stranger; a user bag asks no source.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri, recipeUri } from "@lararium/mesh/lar-uris";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { isVerbRefusal } from "@lararium/mesh/verb-refusal";
import { plainField } from "@lararium/mesh/stored-value";
import { wikiBagUri } from "@lararium/mesh/wiki-recipe";
import { type DocHandle, type Repo as RepoType } from "@lararium/mesh/automerge";
import { type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import type { KahuReachSource } from "@lararium/mesh/kahu-canon-reach";
import { storedLarRecord } from "@lararium/mesh/stored-record";
import { makeActionReactorFor } from "../src/action-handler.js";
import { makeMemePutReactor, makeMemeDeleteReactor, makeMemeGetReactor, makeMemeListReactor, memeVerbOptions, type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeDraftReactor } from "../src/wiki-draft-handlers.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeInitWikiReactor } from "../src/wiki-mint-handlers.js";
import type { CatalogAccessor } from "../src/catalog-accessor.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { kahuHand, strangerHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";

const LARES = bagUri("lares");
const LARARIUM = bagUri("lararium");
const GARDEN = bagUri("garden");
const WORKING = "lar:///ha.ka.ba/wikis/trove/working";
const hand = { kind: "tw-local", instanceId: "test" } as const;
const live = (title: string) => ({ tiddler: { title, text: title }, meta: { changeId: `change:${title}` } });
const URI = "lar:///t/ford";
const meme = (slot: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n<<~ ahu slot=\`#${slot}\`>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const ctxOf = (composite: CompositeStore, action: string): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action, args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-20" } as unknown as Verb,
  cap: async () => ({ ok: true }),
});

async function rig() {
  const repo = new Repo({ network: [] });
  const stores = new Map<string, AutomergeDocStore>();
  const composite = new CompositeStore();
  for (const bag of [LARES, LARARIUM, GARDEN, WORKING]) {
    const store = new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    stores.set(bag, store);
    composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: bag === WORKING });
  }
  await stores.get(WORKING)!.put(live("T"), hand);
  await stores.get(LARES)!.put(live("canon"), hand);
  const heads = () => [...stores.values()].map((s) => s.headsNow());
  return { repo, stores, composite, heads };
}

const run = (composite: CompositeStore, verb: Parameters<typeof makeActionReactorFor>[0], reach: KahuReachSource | undefined, args: Record<string, unknown>) =>
  makeActionReactorFor(verb, { composite, ...(reach ? { kahuReach: reach } : {}) })(args, ctxOf(composite, verb));

const reasonOf = async (go: () => Promise<unknown>): Promise<string | null> => {
  try { await go(); return null; } catch (e) { return isVerbRefusal(e) ? e.reason : `(${e instanceof Error ? e.message : String(e)})`; }
};

const TRANSFERS = ["ADD", "COPY", "MOVE"] as const;
const into = (bag: string) => ({ title: "T", "from-bag": WORKING, "to-bag": bag, "change-id": "c1" });

describe("the residency reactor — every verb into canon", () => {
  test.each(TRANSFERS)("%s into each system bag refuses a stranger and moves no byte", async (verb) => {
    for (const bag of [LARES, LARARIUM]) {
      const r = await rig();
      try {
        const before = r.heads();
        expect(await reasonOf(async () => run(r.composite, verb, await strangerHand("joined-without-admission"), into(bag)))).toBe("kahu-reach");
        expect(await reasonOf(async () => run(r.composite, verb, undefined, into(bag)))).toBe("kahu-reach");          // fail closed
        expect(r.heads()).toEqual(before);
      } finally { await r.repo.shutdown(); }
    }
  });

  test.each(TRANSFERS)("CONTROL: %s into canon lands for a Kahu hand", async (verb) => {
    const r = await rig();
    try {
      await run(r.composite, verb, await kahuHand(), into(LARES));
      expect(await r.stores.get(LARES)!.get("T")).toMatchObject({ tiddler: { text: "T" } });
    } finally { await r.repo.shutdown(); }
  });

  test("CLEAR and DROP of a system bag refuse a stranger, and a Kahu hand clears", async () => {
    const r = await rig();
    try {
      const before = r.heads();
      const stranger = await strangerHand("admitted-not-joined");
      expect(await reasonOf(async () => run(r.composite, "CLEAR", stranger, { bag: LARES }))).toBe("kahu-reach");
      expect(await reasonOf(async () => run(r.composite, "DROP", stranger, { bag: LARARIUM }))).toBe("kahu-reach");
      expect(r.heads()).toEqual(before);
      await run(r.composite, "CLEAR", await kahuHand(), { bag: LARES });                                          // CONTROL
      expect((await r.stores.get(LARES)!.get("canon"))?.meta?.deleted).toBe(true);
    } finally { await r.repo.shutdown(); }
  });

  test("LOAD and INGEST into a system bag refuse a stranger before any carrier is read", async () => {
    const r = await rig();
    try {
      const before = r.heads();
      const stranger = await strangerHand("removed");
      const carrier = { uri: "lar:///t/x", text: meme("/x"), diskHash: "d", syncedHash: null };
      expect(await reasonOf(async () => run(r.composite, "LOAD", stranger, { "source-uri": "lar:///t/src", "to-bag": LARES, "change-id": "c", carriers: [{ text: meme("/x") }] }))).toBe("kahu-reach");
      expect(await reasonOf(async () => run(r.composite, "INGEST", stranger, { "source-uri": "lar:///t/src", "to-bag": LARES, "change-id": "c", carriers: [carrier] }))).toBe("kahu-reach");
      expect(r.heads()).toEqual(before);
      // CONTROL: the same INGEST into a user bag asks no source and draws no kahu-reach.
      expect(await reasonOf(async () => run(r.composite, "INGEST", undefined, { "source-uri": "lar:///t/src", "to-bag": GARDEN, "change-id": "c", carriers: [carrier] }))).not.toBe("kahu-reach");
    } finally { await r.repo.shutdown(); }
  });

  test("a MOVE OUT of canon tombstones the source, so it refuses a stranger; a COPY OUT succeeds (CONTROL)", async () => {
    const r = await rig();
    try {
      const stranger = await strangerHand("no-cabal");
      const before = r.heads();
      expect(await reasonOf(async () => run(r.composite, "MOVE", stranger, { title: "canon", "from-bag": LARES, "to-bag": WORKING, "change-id": "c2" }))).toBe("kahu-reach");
      expect(r.heads()).toEqual(before);
      await run(r.composite, "COPY", stranger, { title: "canon", "from-bag": LARES, "to-bag": WORKING, "change-id": "c3" });
      expect(await r.stores.get(WORKING)!.get("canon")).toMatchObject({ tiddler: { text: "canon" } });
      expect(await r.stores.get(LARES)!.get("canon")).toMatchObject({ tiddler: { text: "canon" } });             // canon unmoved
    } finally { await r.repo.shutdown(); }
  });
});

describe("meme put and meme delete", () => {
  const optsFor = (r: Awaited<ReturnType<typeof rig>>, reach?: KahuReachSource): MemeVerbOptions => ({
    composite: r.composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    ...(reach ? { kahuReach: reach } : {}),
  });

  test("meme put --bag lares refuses a stranger, fails closed, and lands for a Kahu hand (CONTROL)", async () => {
    const r = await rig();
    try {
      const before = r.heads();
      const put = (reach?: KahuReachSource) => makeMemePutReactor(optsFor(r, reach))({ uri: URI, bag: "lares", text: meme("/a") }, ctxOf(r.composite, "meme-put"));
      expect(await reasonOf(async () => put(await strangerHand("joined-without-admission")))).toBe("kahu-reach");
      expect(await reasonOf(async () => put())).toBe("kahu-reach");
      expect(r.heads()).toEqual(before);
      expect((await put(await kahuHand()))["decision"]).toBe("ingest");
      // CONTROL: a user bag asks no source.
      expect((await makeMemePutReactor(optsFor(r))({ uri: URI, bag: "garden", text: meme("/g") }, ctxOf(r.composite, "meme-put")))["decision"]).toBe("ingest");
    } finally { await r.repo.shutdown(); }
  });

  test("meme delete --bag lararium refuses a stranger and removes for a Kahu hand (CONTROL)", async () => {
    const r = await rig();
    try {
      await makeMemePutReactor(optsFor(r, await kahuHand()))({ uri: URI, bag: "lararium", text: meme("/a") }, ctxOf(r.composite, "meme-put"));
      const before = r.heads();
      const del = (reach?: KahuReachSource) => makeMemeDeleteReactor(optsFor(r, reach))({ uri: URI, bag: "lararium" }, ctxOf(r.composite, "meme-delete"));
      expect(await reasonOf(async () => del(await strangerHand("admitted-not-joined")))).toBe("kahu-reach");
      expect(await reasonOf(async () => del())).toBe("kahu-reach");
      expect(r.heads()).toEqual(before);
      await del(await kahuHand());
      // Nothing lies beneath, so the Kahu hand's delete retracts the record plainly (no kāpae).
      expect(await r.stores.get(LARARIUM)!.get(URI)).toBeNull();
    } finally { await r.repo.shutdown(); }
  });

  test("a realm steward's write into a system bag still asks the predicate: the realm grant stands in for no check", async () => {
    const r = await rig();
    try {
      const realm: LarTiddlerStore = new MemoryTiddlerStore(LARES);
      const opts = (reach?: KahuReachSource): MemeVerbOptions => ({ ...optsFor(r, reach), realmWritable: async (bag) => (bag === LARES ? realm : null) });
      const put = (reach?: KahuReachSource) => makeMemePutReactor(opts(reach))({ uri: URI, bag: "lares", text: meme("/s") }, ctxOf(r.composite, "meme-put"));
      expect(await reasonOf(async () => put(await strangerHand("removed")))).toBe("kahu-reach");
      expect(await reasonOf(async () => put())).toBe("kahu-reach");
      expect(await realm.get(URI)).toBeNull();
      expect((await put(await kahuHand()))["decision"]).toBe("ingest");                                          // CONTROL
      expect(await realm.get(URI)).not.toBeNull();
    } finally { await r.repo.shutdown(); }
  });
});

describe("draft placement", () => {
  test("a draft into a system bag refuses a stranger and lands for a Kahu hand (CONTROL)", async () => {
    const r = await rig();
    try {
      const draft = (reach?: KahuReachSource) => makeDraftReactor({ composite: r.composite, ...(reach ? { kahuReach: reach } : {}) })({ tiddler: "T", toBag: LARES }, ctxOf(r.composite, "draft"));
      const before = r.heads();
      expect(await reasonOf(async () => draft(await strangerHand("no-cabal")))).toBe("kahu-reach");
      expect(await reasonOf(async () => draft())).toBe("kahu-reach");
      expect(r.heads()).toEqual(before);
      expect(await draft(await kahuHand())).toMatchObject({ status: "drafted", toBag: LARES });
    } finally { await r.repo.shutdown(); }
  });
});

describe("wiki-mint", () => {
  type Tiddlers = Record<string, LarTiddlerRecord>;
  function catalogOf(tiddlers: Tiddlers) {
    const handle = { url: "automerge:catalog", doc: () => ({ tiddlers }), change: (fn: (d: { tiddlers: Tiddlers }) => void) => fn({ tiddlers }), whenReady: async () => {} } as unknown as DocHandle<LarDoc>;
    const accessor: CatalogAccessor = {
      handle: async () => handle, urlOf: async (k) => (tiddlers[k]?.tiddler["text"] as string | undefined) ?? null,
      recordOf: async (t) => tiddlers[t] ?? null, find: async () => null, storeOf: async () => null,
    };
    return { accessor, tiddlers };
  }
  const mintOpts = (catalog: CatalogAccessor, oracle: CatalogAccessor, extra: Record<string, unknown> = {}) => ({
    repo: { create: () => ({ url: "automerge:minted", whenReady: async () => {} }), find: async (u: string) => ({ url: u, whenReady: async () => {} }) } as unknown as RepoType,
    catalog, oracle, vesselDid: () => "did:x", rootDir: "", resolveDraftDoc: async () => ({ url: "automerge:draft", reach: "floor" as never }), ...extra,
  });
  const ctx = {} as VerbContext;

  test("a minted wiki's recipe names neither system bag as a live library: the floor carries them read-only through @oracle", async () => {
    const catalog = catalogOf({});
    const oracle = catalogOf({});
    await makeInitWikiReactor(mintOpts(catalog.accessor, oracle.accessor))({ slug: "garden" }, ctx);
    const stack = String(plainField(catalog.tiddlers[recipeUri("catalog", "garden")], "bag-stack"));
    expect(stack).not.toContain(LARES);
    expect(stack).not.toContain(LARARIUM);
  });

  test("a system slug's canon document goes to a hand holding canon alone; any other hand finds no wiki (CONTROL: the hand with canon is named it)", async () => {
    const oracle = catalogOf({ [recipeUri("oracle", "lares")]: { tiddler: { title: recipeUri("oracle", "lares"), "bag-stack": `${LARARIUM} ${LARES}` } } as LarTiddlerRecord });
    const catalog = catalogOf({});
    const naming = async (bag: string): Promise<string | null> => (bag === wikiBagUri("lares") ? "automerge:lares-live" : null);
    await expect(makeInitWikiReactor(mintOpts(catalog.accessor, oracle.accessor, { systemCanonUrl: async () => null }))({ slug: "lares" }, ctx)).rejects.toThrow(/system-bag/);
    await expect(makeInitWikiReactor(mintOpts(catalog.accessor, oracle.accessor))({ slug: "lares" }, ctx)).rejects.toThrow(/system-bag/);
    expect(await makeInitWikiReactor(mintOpts(catalog.accessor, oracle.accessor, { systemCanonUrl: naming }))({ slug: "lares" }, ctx)).toMatchObject({ system: true, wikiDocUrl: "automerge:lares-live" });
  });
});

/**
 * HOUSE CANON'S ONE DOCUMENT, AT EVERY DOOR THAT REACHES IT BY ACCESS (offering#/the-canon-offer, "One canon document"). The Kahu
 * realm's standing document carries a house canon bag wherever the vessel names one: the document the keel mounts, the mirror
 * projects, the retire and the floor cut read. A registry row that names another document for the bag (the stand-in a floor boot
 * of the `lares` wiki leaves in the catalog) answers no door once the realm names its own.
 */
describe("house canon resolves the Kahu realm's standing document at the action door and the meme door", () => {
  async function split(realmNames: boolean) {
    const repo = new Repo({ network: [] });
    const island = new CompositeStore();   // the daemon island mounts no canon layer: it reaches canon by access
    const working = new AutomergeDocStore(repo.create(emptyLarDoc()), WORKING);
    island.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    await working.put(live("T"), hand);
    const realm = repo.create<LarDoc>(emptyLarDoc()), stray = repo.create<LarDoc>(emptyLarDoc()), garden = repo.create<LarDoc>(emptyLarDoc());
    await new AutomergeDocStore(realm, LARES).put({ tiddler: { title: "where", text: "realm" } }, hand);
    await new AutomergeDocStore(stray, LARES).put({ tiddler: { title: "where", text: "stray" } }, hand);
    const catalog = repo.create<LarDoc>(emptyLarDoc());
    catalog.change((d) => {
      d.tiddlers[LARES] = storedLarRecord(LARES, { text: stray.url }, "vessel-boot");
      d.tiddlers[GARDEN] = storedLarRecord(GARDEN, { text: garden.url }, "test");
    });
    const systemCanonUrl = async (bag: string): Promise<string | null> => (realmNames && bag === LARES ? realm.url : null);
    const reach = { repo: repo as unknown as RepoType, catalogUrl: catalog.url, oracleUrl: null, systemCanonUrl };
    const textIn = async (doc: DocHandle<LarDoc>, bag: string, title: string) => (await new AutomergeDocStore(doc, bag).get(title))?.tiddler.text ?? null;
    return { repo, island, realm, stray, garden, catalog, reach, systemCanonUrl, textIn };
  }

  test("RED: a COPY into bags/lares lands in the realm's document while a catalog row names another (the seed's INGEST rides the same access)", async () => {
    const s = await split(true);
    try {
      await makeActionReactorFor("COPY", { composite: s.island, reach: s.reach, kahuReach: await kahuHand() })(into(LARES), ctxOf(s.island, "COPY"));
      expect(await s.textIn(s.realm, LARES, "T")).toBe("T");
      expect(await s.textIn(s.stray, LARES, "T")).toBeNull();                 // the stand-in takes no byte
      // CONTROL: a user bag still lands in the document its catalog row names.
      await makeActionReactorFor("COPY", { composite: s.island, reach: s.reach })(into(GARDEN), ctxOf(s.island, "COPY"));
      expect(await s.textIn(s.garden, GARDEN, "T")).toBe("T");
    } finally { await s.repo.shutdown(); }
  });

  test("CONTROL: where the realm names no document (a rig, a vessel outside every realm), the action door reaches the bag by its registry row", async () => {
    const s = await split(false);
    try {
      await makeActionReactorFor("COPY", { composite: s.island, reach: s.reach, kahuReach: await kahuHand() })(into(LARES), ctxOf(s.island, "COPY"));
      expect(await s.textIn(s.stray, LARES, "T")).toBe("T");
    } finally { await s.repo.shutdown(); }
  });

  test("RED: the meme door reads bags/lares off the realm's document while a catalog row names another (CONTROL: with no realm document, the row answers)", async () => {
    const s = await split(true);
    try {
      const ctx = { composite: s.island, tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as never, repo: s.repo as unknown as RepoType, catalogUrl: s.catalog.url, oracleUrl: null };
      const named = memeVerbOptions(ctx, async () => null, s.systemCanonUrl);
      expect((await (await named.reach!(LARES, LARES))!.get("where"))?.tiddler.text).toBe("realm");
      const unnamed = memeVerbOptions(ctx, async () => null, async () => null);
      expect((await (await unnamed.reach!(LARES, LARES))!.get("where"))?.tiddler.text).toBe("stray");
    } finally { await s.repo.shutdown(); }
  });

  /**
   * A FACE OUTSIDE THE KAHU CABAL READS HOUSE CANON FROM THE FLOOR. Its island registers no house canon bag (the live documents
   * rest in the Kahu realm), so its read cap names none; the vessel-wide realm pointer may still reach the live document. The
   * meme door answers the bag's floor snapshot, with no cap asked (the floor's blobs rest public by CID), through every read:
   * `meme list --bag`, `meme get --bag`, and a wiki's stack (`--recipe`).
   */
  async function outsideFace() {
    const repo = new Repo({ network: [] });
    const store = (bag: string) => new AutomergeDocStore(repo.create(emptyLarDoc()), bag);
    const liveLararium = store(LARARIUM), floorLararium = store(LARARIUM), liveLares = store(LARES), working = new MemoryTiddlerStore(WORKING);
    const lay = async (into: LarTiddlerStore, bag: string, uri: string, slot: string): Promise<void> => {
      const composite = new CompositeStore();
      composite.addLayer({ bagId: bag, store: into, writable: true });
      const text = meme(slot).replaceAll(URI, uri).replace('uri-path = "t/ford"', `uri-path = "${uri.slice("lar:///".length)}"`);
      await makeMemePutReactor({ composite, tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as never, kahuReach: await kahuHand() })({ uri, bag, text }, ctxOf(composite, "meme-put"));
    };
    // The floor carries the released page; live canon has moved past it, and holds a page no release carries yet.
    await lay(floorLararium, LARARIUM, "lar:///t/released", "/floor");
    await lay(liveLararium, LARARIUM, "lar:///t/released", "/live");
    await lay(liveLararium, LARARIUM, "lar:///t/unreleased", "/live");
    await lay(liveLares, LARES, "lar:///t/lares-page", "/live");
    const recipes = new Map<string, LarTiddlerRecord>([[recipeUri("catalog", "trove"), { tiddler: { title: recipeUri("catalog", "trove"), "bag-stack": `${LARARIUM} ${WORKING}`, "writable-bag": WORKING } }]]);
    const opts: MemeVerbOptions = {
      composite: new CompositeStore(),                                     // this face's daemon island mounts no canon layer
      tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
      recipeOf: async (slug) => recipes.get(recipeUri("catalog", slug)) ?? null,
      slotStore: async (_slug, kind) => (kind === "working" ? working : null),
      reach: async (key) => (key === LARARIUM ? liveLararium : key === LARES ? liveLares : null),   // the vessel-wide realm pointer
      floorCanon: (bag) => (bag === LARARIUM ? floorLararium : null),      // the floor this island mounted carries lararium; no lares snapshot here
      kahuReach: await strangerHand("joined-without-admission"),
    };
    // The face's hive registered neither house canon bag: its verifier answers as the live one does.
    const cap: VerbContext["cap"] = async (_access, bag) => (bag === LARARIUM || bag === LARES ? { ok: false, reason: `bag not registered: ${bag}` } : { ok: true });
    const ctx = (action: string): VerbContext => ({ ...ctxOf(opts.composite, action), cap });
    return { repo, opts, ctx, live: liveLararium, floor: floorLararium };
  }
  const slotsOf = (answer: Record<string, unknown>): string => JSON.stringify(answer);

  test("RED: a face whose cap names no house canon bag lists and gets bags/lararium from its floor snapshot, by bag and through a wiki's stack", async () => {
    const f = await outsideFace();
    try {
      const listed = await makeMemeListReactor(f.opts)({ bag: "lararium" }, f.ctx("meme-list"));
      expect(listed).toMatchObject({ bag: LARARIUM, floor: true });
      expect((listed["roots"] as Array<{ uri: string }>).map((r) => r.uri)).toEqual(["lar:///t/released"]);   // the floor's roots: no unreleased page
      const got = await makeMemeGetReactor(f.opts)({ uri: "lar:///t/released", bag: "lararium" }, f.ctx("meme-get"));
      expect(got).toMatchObject({ uri: "lar:///t/released", floor: true });
      expect(slotsOf(got)).toContain("/floor");
      expect(slotsOf(got)).not.toContain("/live");
      const stack = await makeMemeListReactor(f.opts)({ recipe: "trove" }, f.ctx("meme-list"));
      expect((stack["roots"] as Array<{ uri: string; bag: string; floor?: boolean }>)).toEqual([expect.objectContaining({ uri: "lar:///t/released", bag: LARARIUM, floor: true })]);
      const viaWiki = await makeMemeGetReactor(f.opts)({ uri: "lar:///t/released", recipe: "trove" }, f.ctx("meme-get"));
      expect(viaWiki).toMatchObject({ floor: true });
      expect(slotsOf(viaWiki)).toContain("/floor");
    } finally { await f.repo.shutdown(); }
  });

  test("RED: a put through a wiki that names the hash its get just answered lands as a copy-up in the working layer, though that layer held no record of the title", async () => {
    const f = await outsideFace();
    try {
      const got = await makeMemeGetReactor(f.opts)({ uri: "lar:///t/released", recipe: "trove" }, f.ctx("meme-get"));
      const read = (got["meme"] as { canonicalHash: string; text: string });
      expect(read.canonicalHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      const edited = meme("/working").replaceAll(URI, "lar:///t/released").replace('uri-path = "t/ford"', 'uri-path = "t/released"');
      const put = await makeMemePutReactor(f.opts)({ uri: "lar:///t/released", recipe: "trove", text: edited, base: read.canonicalHash }, f.ctx("meme-put"));
      expect(put, "the base the writer read still stands below, so the copy-up lands").toMatchObject({ decision: "ingest" });
      // The wiki now answers the working copy, and the floor's page never moved.
      const after = await makeMemeGetReactor(f.opts)({ uri: "lar:///t/released", recipe: "trove" }, f.ctx("meme-get"));
      expect(slotsOf(after)).toContain("/working");
      expect(after["floor"]).toBeUndefined();
      // CONTROL: a stale base (the page below moved past what the writer read) stands off, and the receipt names the hash
      // the wiki answers now, never the hash of no bytes.
      const g = await outsideFace();
      try {
        const stale = await makeMemePutReactor(g.opts)({ uri: "lar:///t/released", recipe: "trove", text: edited, base: `sha256:${"0".repeat(64)}` }, g.ctx("meme-put"));
        expect(stale).toMatchObject({ decision: "conflict", canonicalHash: read.canonicalHash });
      } finally { await g.repo.shutdown(); }
    } finally { await f.repo.shutdown(); }
  });

  test("CONTROLS: the same face writes no house canon (kahu-reach); a house canon bag the floor carries no snapshot of keeps its cap refusal; a hand whose cap holds reads the live document", async () => {
    const f = await outsideFace();
    try {
      // The write door never reads the floor: with a canon layer mounted writable the put draws the Kahu predicate's refusal, and
      // with none (this face's own island) it finds no layer to write. Either way no byte moves.
      const before = [f.live.headsNow(), f.floor.headsNow()];
      const mounted = new CompositeStore();
      mounted.addLayer({ bagId: LARARIUM, store: f.live, writable: true });
      expect(await reasonOf(async () => makeMemePutReactor({ ...f.opts, composite: mounted })({ uri: "lar:///t/released", bag: "lararium", text: meme("/x") }, f.ctx("meme-put")))).toBe("kahu-reach");
      await expect(makeMemePutReactor(f.opts)({ uri: "lar:///t/released", bag: "lararium", text: meme("/x") }, f.ctx("meme-put"))).rejects.toThrow();
      expect([f.live.headsNow(), f.floor.headsNow()]).toEqual(before);
      await expect(makeMemeListReactor(f.opts)({ bag: "lares" }, f.ctx("meme-list"))).rejects.toThrow(/cap-denied: read on lar:\/\/\/ha\.ka\.ba\/bags\/lares required \(bag not registered/);
      const held = await makeMemeListReactor(f.opts)({ bag: "lararium" }, { ...f.ctx("meme-list"), cap: async () => ({ ok: true }) });
      expect(held["floor"]).toBeUndefined();
      expect((held["roots"] as Array<{ uri: string }>).map((r) => r.uri)).toEqual(["lar:///t/released", "lar:///t/unreleased"]);
    } finally { await f.repo.shutdown(); }
  });
});
