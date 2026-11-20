/**
 * wiki-engine — EVERY WIKI ITS ENGINE: a registered wiki the worn face reaches (one it hosts, or one shared to it) answers the
 * tiddler door through its OWN TiddlyWiki engine, the one per-face engine machinery (`face-engine`) laid over that wiki's own
 * recipe as the face sees it: its canon by reference, the shared working layer, and the face's own personal and draft
 * layers. The engine composes on its first ask and closes when cold.
 *
 *   W1  RED: a named wiki's engine reads its canon by reference and the shared working layer, and a put lands in the working
 *       document; every answer names the wiki
 *   W2  RED: a face with no writer's seat in the workbench lands its put in its own personal layer
 *   W3  RED: a wiki no recipe names, and one none of whose layers stands for the face, refuses `wiki-unreached` by name
 *   W4  RED: a write mints the face's write layer where none stood and recomposes; a cold engine closes and the next ask
 *       composes afresh
 *   W5  RED: a rendered record keeps `rendered-derives` on a write through a named wiki's engine
 *
 * A real engine boots here (`bootTestWiki`), with the real recipe, adaptor and bridge.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { AutomergeDocStore, emptyLarDoc, wikiBagUri, wikiSlotUri, type DocHandle, type LarDoc, type LarTiddlerRecord, type Repo as RepoType, type WikiSlotKind } from "@lararium/mesh";
import { composeWikiEngineSource, wikiEngines, type WikiEngineDeps } from "../src/wiki-engine.js";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, makeWikiFilterReactor, makeWikiStatusReactor } from "../src/tiddler-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;

const SLUG = "kahu";
const CANON = wikiBagUri(SLUG);
const WORKING = wikiSlotUri(SLUG, "working");
const PERSONAL = wikiSlotUri(SLUG, "personal");
const downs: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const down of downs.splice(0).reverse()) await down(); });

const turns = async (n = 16): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
const ctx = (): VerbContext => ({ daemon: {} as never, invocation: { requestId: `r-${Math.random()}` } as VerbContext["invocation"], cap: async () => ({ ok: true }) });
const holds = (h: DocHandle<LarDoc>, title: string): boolean => Object.prototype.hasOwnProperty.call(h.doc()!.tiddlers, title);
const landIn = async (h: DocHandle<LarDoc>, title: string): Promise<void> => {
  const deadline = Date.now() + 5_000;
  while (!holds(h, title) && Date.now() < deadline) await turns(8);
};
const seed = (h: DocHandle<LarDoc>, fields: Record<string, string>): void => {
  h.change((d) => { (d.tiddlers as Record<string, unknown>)[fields["title"]!] = { tiddler: fields }; });
};

/** One shared wiki as a face sees it: its recipe record, its canon (reached by reference), the shared working document, and the
 *  face's own slots, which stand only where `standing` names them (a put mints the write slot through `slotStore`). */
function sharedWiki(opts: { writeSlot?: "working" | "personal" | null; standing?: readonly WikiSlotKind[]; recipe?: boolean; canon?: boolean } = {}) {
  const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
  const canon = repo.create<LarDoc>(emptyLarDoc());
  seed(canon, { title: "Road", text: "the road, by reference" });
  const slots = new Map<WikiSlotKind, DocHandle<LarDoc>>();
  for (const kind of opts.standing ?? ["working"]) slots.set(kind, repo.create<LarDoc>(emptyLarDoc()));
  const working = slots.get("working");
  if (working) seed(working, { title: "Shared note", text: "every member reads this" });
  let minted = 0;
  const deps: WikiEngineDeps = {
    boot: () => bootTestWiki(),
    recipeOf: async (slug) => (slug === SLUG && opts.recipe !== false ? { tiddler: { title: `lar:///ha.ka.ba/recipes/${SLUG}` } } as unknown as LarTiddlerRecord : null),
    slotStore: async (_slug, kind, bag, { mint }) => {
      let handle = slots.get(kind);
      if (!handle && mint) { handle = repo.create<LarDoc>(emptyLarDoc()); slots.set(kind, handle); minted++; }
      return handle ? new AutomergeDocStore(handle, bag) : null;
    },
    writeSlot: async () => (opts.writeSlot === undefined ? "working" : opts.writeSlot),
    reach: async (_key, bag) => (bag === CANON && opts.canon !== false ? new AutomergeDocStore(canon, bag) : null),
  };
  return { repo, canon, slots, deps, minted: () => minted };
}

describe.skipIf(wikiSkip)(`every wiki its engine${skipNote}`, () => {
  test("W1 RED: a named wiki's engine reads its canon by reference and the shared working layer, and a put lands in the working document", async () => {
    const w = sharedWiki();
    const engines = wikiEngines((slug, need) => composeWikiEngineSource(w.deps, slug, need)); downs.push(() => engines.dropAll());
    const opts = { composite: null as never, tw5: null as never, wikis: engines };
    const seen = await makeWikiFilterReactor(opts)({ recipe: SLUG, filter: "[[Road]is[tiddler]] [[Shared note]is[tiddler]]" }, ctx());
    expect(seen).toMatchObject({ recipe: SLUG, titles: ["Road", "Shared note"] });
    const got = await makeTiddlerGetReactor(opts)({ recipe: SLUG, title: "Road" }, ctx());
    expect((got["tiddler"] as { bag: string }).bag, "the canon answers by reference").toBe(CANON);
    const put = await makeTiddlerPutReactor(opts)({ recipe: SLUG, title: "Member note", text: "from this face" }, ctx());
    expect(put).toMatchObject({ recipe: SLUG, decision: "put", bag: WORKING });
    await landIn(w.slots.get("working")!, "Member note");
    expect(holds(w.slots.get("working")!, "Member note"), "the put lands in the shared working document").toBe(true);
    expect(holds(w.canon, "Member note"), "and never in the canon").toBe(false);
    const status = await makeWikiStatusReactor(opts)({ recipe: SLUG }, ctx());
    expect(status).toMatchObject({ recipe: SLUG, working: WORKING });
    expect((status["layers"] as Array<{ bag: string }>).map((l) => l.bag)).toEqual(expect.arrayContaining([WORKING, CANON]));
  }, 60_000);

  test("W2 RED: a face with no writer's seat in the workbench lands its put in its own personal layer", async () => {
    const w = sharedWiki({ writeSlot: "personal", standing: ["working", "personal"] });
    const engines = wikiEngines((slug, need) => composeWikiEngineSource(w.deps, slug, need)); downs.push(() => engines.dropAll());
    const opts = { composite: null as never, tw5: null as never, wikis: engines };
    const put = await makeTiddlerPutReactor(opts)({ recipe: SLUG, title: "Reader note", text: "mine alone" }, ctx());
    expect(put).toMatchObject({ recipe: SLUG, decision: "put", bag: PERSONAL });
    await landIn(w.slots.get("personal")!, "Reader note");
    expect(holds(w.slots.get("personal")!, "Reader note")).toBe(true);
    expect(holds(w.slots.get("working")!, "Reader note"), "the shared working layer takes none of it").toBe(false);
  }, 60_000);

  test("W3 RED: a wiki no recipe names, and one none of whose layers stands for the face, refuses wiki-unreached by name; CONTROL: the daemon anchor keeps its door", async () => {
    const none = sharedWiki({ recipe: false });
    const unknown = wikiEngines((slug, need) => composeWikiEngineSource(none.deps, slug, need)); downs.push(() => unknown.dropAll());
    await expect(makeWikiFilterReactor({ composite: null as never, tw5: null as never, wikis: unknown })({ recipe: SLUG, filter: "[all[]]" }, ctx()))
      .rejects.toMatchObject({ reason: "wiki-unreached" });
    const bare = sharedWiki({ standing: [], canon: false, writeSlot: null });
    const dark = wikiEngines((slug, need) => composeWikiEngineSource(bare.deps, slug, need)); downs.push(() => dark.dropAll());
    await expect(makeTiddlerGetReactor({ composite: null as never, tw5: null as never, wikis: dark })({ recipe: SLUG, title: "Road" }, ctx()))
      .rejects.toMatchObject({ reason: "wiki-unreached" });
    // No door to named wikis at all: the named wiki refuses by the same name, never a phase note.
    await expect(makeWikiFilterReactor({ composite: null as never, tw5: null as never })({ recipe: SLUG, filter: "[all[]]" }, ctx()))
      .rejects.toMatchObject({ reason: "wiki-unreached" });
  }, 60_000);

  test("W4 RED: a write mints the face's write layer where none stood and recomposes; a cold engine closes and the next ask composes afresh", async () => {
    const w = sharedWiki({ writeSlot: "personal", standing: ["working"] });
    let composed = 0;
    const engines = wikiEngines(async (slug, need) => { composed++; return composeWikiEngineSource(w.deps, slug, need); }, { idleMs: 50 });
    downs.push(() => engines.dropAll());
    const opts = { composite: null as never, tw5: null as never, wikis: engines };
    await makeTiddlerGetReactor(opts)({ recipe: SLUG, title: "Road" }, ctx());
    expect(w.minted(), "a read mints nothing").toBe(0);
    const put = await makeTiddlerPutReactor(opts)({ recipe: SLUG, title: "First of mine", text: "x" }, ctx());
    expect(put).toMatchObject({ decision: "put", bag: PERSONAL });
    expect(w.minted(), "the write minted the face's personal layer").toBe(1);
    await landIn(w.slots.get("personal")!, "First of mine");
    const before = composed;
    const first = await engines.of(SLUG, { write: false });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const again = await engines.of(SLUG, { write: false });
    expect(again, "a cold engine closed and the next ask composed afresh").not.toBe(first);
    expect(composed).toBeGreaterThan(before);
  }, 60_000);

  test("W5 RED: a rendered record keeps rendered-derives on a write through a named wiki's engine", async () => {
    const w = sharedWiki();
    seed(w.slots.get("working")!, { title: "Road.rendered", type: "text/plain", text: "noted", "rendered-from": "Road" });
    const engines = wikiEngines((slug, need) => composeWikiEngineSource(w.deps, slug, need)); downs.push(() => engines.dropAll());
    const opts = { composite: null as never, tw5: null as never, wikis: engines };
    await expect(makeTiddlerPutReactor(opts)({ recipe: SLUG, title: "Road.rendered", text: "hand" }, ctx())).rejects.toMatchObject({ reason: "rendered-derives" });
  }, 60_000);
});
