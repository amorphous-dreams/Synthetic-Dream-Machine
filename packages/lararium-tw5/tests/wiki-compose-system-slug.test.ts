/**
 * A system wiki's canon doc and default recipe stand in the oracle plane. The vessel composes it
 * through its OWN catalog record: `init-wiki` mints nothing for a system slug, and `add-bag` /
 * `remove-bag` adopt the default into the catalog on the first edit. A user slug walks the
 * mint-and-append path unchanged.
 */
import { describe, test, expect } from "vitest";
import { recipeUri, wikiBagUri, type LarDoc, type LarTiddlerRecord, type Repo, type DocHandle } from "@lararium/mesh";
import { makeInitWikiReactor } from "../src/wiki-mint-handlers.js";
import { makeAddBagReactor, makeRemoveBagReactor } from "../src/wiki-compose-handlers.js";
import { makeListWikisReactor, makeWikiPinReactor, makeWikiUnpinReactor } from "../src/worker-data-verbs.js";
import type { CatalogAccessor } from "../src/catalog-accessor.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

type Tiddlers = Record<string, LarTiddlerRecord>;
const rec = (title: string, fields: Record<string, string>): LarTiddlerRecord => ({ tiddler: { title, ...fields } });

function plane(url: string, tiddlers: Tiddlers) {
  // `change` mutates a structured clone-free plain object, which is all the handlers need.
  const handle = { url, doc: () => ({ tiddlers }), change: (fn: (d: { tiddlers: Tiddlers }) => void) => fn({ tiddlers }), whenReady: async () => {} } as unknown as DocHandle<LarDoc>;
  const accessor: CatalogAccessor = {
    handle: async () => handle,
    urlOf: async (k) => (tiddlers[k]?.tiddler["text"] as string | undefined) ?? null,
    recordOf: async (t) => tiddlers[t] ?? null,
    find: async () => null,
    storeOf: async () => null,
  };
  return { accessor, tiddlers };
}

const LARES = wikiBagUri("lares");
const X = "lar:///ha.ka.ba/bags/corpus/elyncia";
const DEFAULT_STACK = "lar:///ha.ka.ba/bags/oracle lar:///ha.ka.ba/bags/lararium lar:///ha.ka.ba/bags/lares";

function rig() {
  const oracle  = plane("automerge:oracle", {
    [LARES]: rec(LARES, { text: "automerge:lares-canon" }),
    [recipeUri("oracle", "lares")]: rec(recipeUri("oracle", "lares"), { "bag-stack": DEFAULT_STACK }),
  });
  const catalog = plane("automerge:catalog", {});
  const created: string[] = [];
  const repo = {
    create: () => { created.push("create"); return { url: "automerge:minted", whenReady: async () => {} }; },
    find: async (u: string) => ({ url: u, whenReady: async () => {} }),
  } as unknown as Repo;
  const posted: unknown[] = [];
  const mint = { repo, catalog: catalog.accessor, oracle: oracle.accessor, vesselDid: () => "did:x", rootDir: "", resolveDraftDoc: async () => ({ url: "automerge:draft", reach: "floor" as never }) };
  return { oracle, catalog, created, posted, mint, post: (m: unknown) => { posted.push(m); } };
}
const ctx = {} as VerbContext;

describe("a system slug composes through the vessel's own record", () => {
  test("init-wiki on a system slug mints nothing and answers what stands in the oracle", async () => {
    const r = rig();
    const before = JSON.stringify(r.catalog.tiddlers);
    const out = await makeInitWikiReactor(r.mint)({ slug: "lares" }, ctx);
    expect(r.created).toEqual([]);
    expect(JSON.stringify(r.catalog.tiddlers)).toBe(before);
    expect(out).toMatchObject({ status: "already-exists", system: true, wikiDocUrl: "automerge:lares-canon", recipePlane: "oracle", recipeUri: recipeUri("oracle", "lares") });
  });

  test("init-wiki on a system slug with no oracle recipe refuses by name", async () => {
    const r = rig();
    await expect(makeInitWikiReactor(r.mint)({ slug: "oracle" }, ctx)).rejects.toThrow(/system-bag: "oracle" names a system bag, and no wiki stands on it/);
    await expect(makeInitWikiReactor({ ...r.mint, oracle: undefined as never })({ slug: "lares" }, ctx)).rejects.toThrow(/system-bag/);
  });

  test("add-bag adopts the default into the catalog, once; the oracle stays byte-identical", async () => {
    const r = rig();
    const oracleBefore = JSON.stringify(r.oracle.tiddlers);
    const add = makeAddBagReactor({ catalog: r.catalog.accessor, oracle: r.oracle.accessor, post: r.post });
    const first = await add({ slug: "lares", bagUrl: X }, ctx);
    const own = r.catalog.tiddlers[recipeUri("catalog", "lares")]!;
    expect(first).toMatchObject({ status: "added", adopted: true, recipePlane: "catalog" });
    expect(own.tiddler["bag-stack"]).toBe(`${DEFAULT_STACK} ${X}`);
    expect(own.tiddler["composed-from"]).toBe(recipeUri("oracle", "lares"));
    expect(own.meta?.authority).toBe("lares-cli:wiki-add-bag");
    expect(JSON.stringify(r.oracle.tiddlers)).toBe(oracleBefore);

    const snapshot = JSON.stringify(r.catalog.tiddlers);
    const again = await add({ slug: "lares", bagUrl: X }, ctx);
    expect(again).toMatchObject({ status: "already-in-stack" });
    expect(again).not.toHaveProperty("adopted");
    expect(JSON.stringify(r.catalog.tiddlers)).toBe(snapshot);
  });

  test("remove-bag returns the own stack to the default's, and list-wikis reads the composition", async () => {
    const r = rig();
    const opts = { catalog: r.catalog.accessor, oracle: r.oracle.accessor, post: r.post };
    await makeAddBagReactor(opts)({ slug: "lares", bagUrl: X }, ctx);
    const list = makeListWikisReactor(r.catalog.accessor, r.oracle.accessor);
    expect((await list({}, ctx))["wikis"]).toEqual([expect.objectContaining({ slug: "lares", kind: "system", composition: "own", defaultDiffers: true })]);
    await makeRemoveBagReactor(opts)({ slug: "lares", bagUrl: X }, ctx);
    expect(r.catalog.tiddlers[recipeUri("catalog", "lares")]!.tiddler["bag-stack"]).toBe(DEFAULT_STACK);
    expect((await list({}, ctx))["wikis"]).toEqual([expect.objectContaining({ slug: "lares", kind: "system", composition: "own", defaultDiffers: false })]);
  });

  test("a default-composed system wiki lists once as default; pin-wiki reads the effective recipe", async () => {
    const r = rig();
    const rows = (await makeListWikisReactor(r.catalog.accessor, r.oracle.accessor)({}, ctx))["wikis"];
    expect(rows).toEqual([expect.objectContaining({ slug: "lares", composition: "default" })]);
    expect(rows).toEqual([expect.not.objectContaining({ defaultDiffers: expect.anything() })]);
    const pinned = await makeWikiPinReactor(r.catalog.accessor, r.post, r.oracle.accessor)({ slug: "lares" }, ctx);
    expect((pinned["pinned"] as unknown[]).length).toBe(3);
  });

  test("a system slug with no oracle recipe refuses with advice that fits, never `wiki init`", async () => {
    const r = rig();
    delete r.oracle.tiddlers[recipeUri("oracle", "lares")];
    const err = await makeAddBagReactor({ catalog: r.catalog.accessor, oracle: r.oracle.accessor, post: r.post })({ slug: "lares", bagUrl: X }, ctx).catch((e: Error) => e);
    expect(String(err)).toMatch(/oracle plane carries no default recipe/);
    expect(String(err)).not.toMatch(/wiki init/);
  });

  test("pin-wiki and unpin-wiki on a system slug with no oracle recipe refuse with advice that fits, never `wiki init`", async () => {
    const r = rig();
    delete r.oracle.tiddlers[recipeUri("oracle", "lares")];
    for (const make of [makeWikiPinReactor, makeWikiUnpinReactor]) {
      const err = await make(r.catalog.accessor, r.post, r.oracle.accessor)({ slug: "lares" }, ctx).catch((e: Error) => e);
      expect(String(err)).toMatch(/oracle plane carries no default recipe/);
      expect(String(err)).not.toMatch(/wiki init/);
    }
  });

  test("CONTROL: pin-wiki and unpin-wiki on an unknown user slug still advise `wiki init` (pin) and refuse by name", async () => {
    const r = rig();
    const pin = await makeWikiPinReactor(r.catalog.accessor, r.post, r.oracle.accessor)({ slug: "nobody" }, ctx).catch((e: Error) => e);
    expect(String(pin)).toMatch(/wiki init nobody/);
    const unpin = await makeWikiUnpinReactor(r.catalog.accessor, r.post, r.oracle.accessor)({ slug: "nobody" }, ctx).catch((e: Error) => e);
    expect(String(unpin)).toMatch(/recipe not found for "nobody"/);
  });

  describe("control: a user slug walks the mint-and-append path", () => {
    test("init-wiki mints once and writes its catalog rows; add-bag appends with no adoption", async () => {
      const r = rig();
      const out = await makeInitWikiReactor(r.mint)({ slug: "elyncia" }, ctx);
      expect(r.created).toEqual(["create"]);
      expect(out).toMatchObject({ status: "minted" });
      expect(r.catalog.tiddlers[wikiBagUri("elyncia")]).toBeDefined();
      expect(r.catalog.tiddlers[recipeUri("catalog", "elyncia")]).toBeDefined();
      const added = await makeAddBagReactor({ catalog: r.catalog.accessor, oracle: r.oracle.accessor, post: r.post })({ slug: "elyncia", bagUrl: X }, ctx);
      expect(added).toMatchObject({ status: "added", recipePlane: "catalog" });
      expect(added).not.toHaveProperty("adopted");
      expect(String(r.catalog.tiddlers[recipeUri("catalog", "elyncia")]!.tiddler["bag-stack"]).endsWith(X)).toBe(true);
    });
  });
});
