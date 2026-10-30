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
import { AutomergeDocStore, CompositeStore, bagUri, emptyLarDoc, isVerbRefusal, plainField, recipeUri, wikiBagUri, type DocHandle, type LarDoc, type LarTiddlerRecord, type LarTiddlerStore, type Repo as RepoType, type Verb } from "@lararium/mesh";
import type { KahuReachSource } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import { makeMemePutReactor, makeMemeDeleteReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
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
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n<<~ ahu #${slot}>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

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
      expect((await r.stores.get(LARARIUM)!.get(URI))?.meta?.deleted).toBe(true);
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
