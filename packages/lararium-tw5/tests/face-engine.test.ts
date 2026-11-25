/**
 * face-engine — EACH HAT REACHED BY NAME: a lit sibling face's own TiddlyWiki engine, the anchor composition over THAT face's
 * own daemon documents (its daemon canon and its working slot), so the tiddler door answers a sibling from its own wiki and
 * never from the mount's.
 *
 *   E1  RED: a face engine's tiddler door reads its own canon and lands a put in its OWN working document
 *   E2  RED: two faces' engines stand apart: one face's put never reads in the other's wiki
 *   E3  RED: the engines cache one engine per face; a drop closes it and the next ask composes afresh; a face with no source
 *       composes nothing
 *   E4  RED: an engine composed before its face recorded a working slot rebuilds over the slot on its arrival, and lands a put there
 *   E4b RED: the rebuild says itself aloud: `rebuilding` resolves before the old engine closes, and `rebuilt` names the new one
 *   E5  RED (a lit face receives visits): the CROSS-FACE VIEW of a face reads its daemon canon and working layer, and its
 *       personal layer never appears: a title only there reads absent to a get, a filter and a transclusion, and a title
 *       there that shadows a working record reads the working record; the view never asks for a private slot
 *   E6  RED: the view refuses a source that binds a private layer (`cross-face-private`) before any engine boots, and takes
 *       no write: a put through it lands nothing
 *   E7  RED (Sol H3): the view classifies the DOCUMENT each binding resolves to: a binding labelled as a library or the
 *       working layer whose document a private slot names refuses `cross-face-private`, another wiki's draft laid as a library
 *       refuses, and a binding whose document cannot be named refuses; nothing boots
 *   E8  RED (Sol M2): no layer of the view takes a write, its temp layer included, and the stores it hands out refuse a put
 *   E9  RED (fail closed): a deny set that could not read whole (`unread`) refuses `cross-face-private-unread`; nothing boots
 *
 * A real engine boots here (`bootTestWiki`), with the real recipe, adaptor and bridge.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { daemonFaceCanonBag, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { type DocHandle, type Repo as RepoType } from "@lararium/mesh/automerge";
import { composeCrossFaceView, composeFaceEngine, crossFaceViewSource, faceEngines, type FaceEngineSource } from "../src/face-engine.js";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, makeWikiFilterReactor, makeWikiRenderReactor } from "../src/tiddler-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;

const WORKING = wikiSlotUri("daemon", "working");
const R1 = "11111111-1111-4111-8111-111111111111", R2 = "22222222-2222-4222-8222-222222222222";
const downs: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const down of downs.splice(0).reverse()) await down(); });

const turns = async (n = 16): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
const ctx = (): VerbContext => ({ daemon: {} as never, invocation: { requestId: `r-${Math.random()}` } as VerbContext["invocation"], cap: async () => ({ ok: true }) });
const holds = (h: DocHandle<LarDoc>, title: string): boolean => Object.prototype.hasOwnProperty.call(h.doc()!.tiddlers, title);

function faceDocs(repo: RepoType, relation: string, canonTitle: string) {
  const canon = repo.create<LarDoc>(emptyLarDoc());
  canon.change((d) => { (d.tiddlers as Record<string, unknown>)[canonTitle] = { tiddler: { title: canonTitle, text: `canon of ${relation}` } }; });
  const working = repo.create<LarDoc>(emptyLarDoc());
  const source: FaceEngineSource = {
    boot: () => bootTestWiki(),
    recipe: { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(relation) },
    ready: [{ slot: daemonFaceCanonBag(relation), handle: canon }, { slot: WORKING, handle: working }],
  };
  return { canon, working, source };
}

async function putAndLand(engine: { tw5: never; composite: never }, working: DocHandle<LarDoc>, title: string): Promise<Record<string, unknown>> {
  const answer = await makeTiddlerPutReactor(engine)({ recipe: "default", title, text: "by the face" }, ctx());
  const deadline = Date.now() + 5_000;
  while (!holds(working, title) && Date.now() < deadline) await turns(8);
  return answer;
}

describe.skipIf(wikiSkip)(`a lit face's own engine answers the tiddler door${skipNote}`, () => {
  test("E1 RED: its tiddler door reads its own canon and lands a put in its own working document", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const h1 = faceDocs(repo, R1, "Canon of h1");
    const engine = await composeFaceEngine(h1.source); downs.push(() => engine.close());
    const got = await makeTiddlerGetReactor(engine as never)({ recipe: "default", title: "Canon of h1" }, ctx());
    expect((got["tiddler"] as { bag: string } | null)?.bag, "the face's canon answers in its own wiki").toBe(daemonFaceCanonBag(R1));
    const put = await putAndLand(engine as never, h1.working, "Note of h1");
    expect(put).toMatchObject({ decision: "put", bag: WORKING });
    expect(holds(h1.working, "Note of h1"), "the put lands in the face's own working document").toBe(true);
    expect(holds(h1.canon, "Note of h1"), "and never in its canon").toBe(false);
  }, 60_000);

  test("E2 RED: two faces' engines stand apart", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const h1 = faceDocs(repo, R1, "Canon of h1"), h2 = faceDocs(repo, R2, "Canon of h2");
    const one = await composeFaceEngine(h1.source); downs.push(() => one.close());
    const two = await composeFaceEngine(h2.source); downs.push(() => two.close());
    expect(one.tw5).not.toBe(two.tw5);
    await putAndLand(one as never, h1.working, "Note of h1");
    const seen = await makeWikiFilterReactor(two as never)({ recipe: "default", filter: "[[Note of h1]is[tiddler]] [[Canon of h1]is[tiddler]] [[Canon of h2]is[tiddler]]" }, ctx());
    expect(seen["titles"], "h2's wiki reads its own canon alone").toEqual(["Canon of h2"]);
    expect(holds(h2.working, "Note of h1")).toBe(false);
  }, 60_000);

  test("E3 RED: one engine per face, a drop closes it, and a face with no source composes nothing", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const h1 = faceDocs(repo, R1, "Canon of h1");
    let composed = 0;
    const engines = faceEngines(async (face) => { if (face !== 1) return null; composed++; return h1.source; });
    downs.push(() => engines.dropAll());
    const a = await engines.of(1);
    expect(await engines.of(1), "the cache answers one engine per face").toBe(a);
    expect(composed).toBe(1);
    expect(await engines.of(2), "a face with no source composes nothing").toBeNull();
    await engines.drop(1);
    const b = await engines.of(1);
    expect(b).not.toBe(a);
    expect(composed).toBe(2);
  }, 60_000);

  test("E4 RED: an engine started before its face recorded a working slot rebuilds on the slot's arrival", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const h1 = faceDocs(repo, R1, "Canon of h1");
    const bare: FaceEngineSource = { ...h1.source, ready: h1.source.ready.filter((r) => r.slot !== WORKING) };
    let slotRecorded = false, composed = 0;
    const engines = faceEngines(async () => { composed++; return slotRecorded ? h1.source : bare; });
    downs.push(() => engines.dropAll());
    const before = await engines.of(1);
    expect(await engines.of(1), "while no working slot stands, the engine answers as it stood").toBe(before);
    slotRecorded = true;
    const after = await engines.of(1);
    expect(after, "the slot's arrival rebuilds the engine").not.toBe(before);
    expect(await engines.of(1), "and the rebuilt one stands as the cache answers").toBe(after);
    const put = await putAndLand(after as never, h1.working, "Note of h1");
    expect(put).toMatchObject({ decision: "put", bag: WORKING });
    expect(holds(h1.working, "Note of h1"), "the put lands in the working document the slot named").toBe(true);
    expect(composed).toBeGreaterThanOrEqual(3);
  }, 60_000);
});

describe.skipIf(wikiSkip)(`a face engine's rebuild reaches its readers${skipNote}`, () => {
  test("E4b RED: rebuilding resolves before the old engine closes, and rebuilt follows once the new one composed", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const h1 = faceDocs(repo, R1, "Canon of h1");
    const bare: FaceEngineSource = { ...h1.source, ready: h1.source.ready.filter((r) => r.slot !== WORKING) };
    let slotRecorded = false;
    const said: string[] = [];
    let old: { close(): Promise<void> } | null = null;
    const engines = faceEngines(async () => slotRecorded ? h1.source : bare, {
      rebuilding: async (face) => { said.push(`rebuilding h${face}`); },
      rebuilt: (face) => { said.push(`rebuilt h${face}`); },
    });
    downs.push(() => engines.dropAll());
    const before = await engines.of(1);
    old = before;
    const close = before!.close.bind(before);
    (before as { close: () => Promise<void> }).close = async () => { said.push("old closes"); await close(); };
    expect(await engines.of(1)).toBe(before);
    expect(said, "no rebuild while the slot stands absent").toEqual([]);
    slotRecorded = true;
    const after = await engines.of(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(after).not.toBe(old);
    expect(said).toEqual(["rebuilding h1", "old closes", "rebuilt h1"]);
    await engines.of(1);
    expect(said, "a rebuild says itself once").toHaveLength(3);
  }, 60_000);
});

describe.skipIf(wikiSkip)(`a lit face receives visits: its cross-face view${skipNote}`, () => {
  const PERSONAL = wikiSlotUri("daemon", "personal"), DRAFT = wikiSlotUri("daemon", "draft");
  /** Face h1's daemon documents: canon and working as the face engine binds them, and a personal and a draft layer beside. */
  function visited(repo: RepoType) {
    const h1 = faceDocs(repo, R1, "Canon of h1");
    const write = (h: DocHandle<LarDoc>, title: string, text: string): void => {
      h.change((d) => { (d.tiddlers as Record<string, unknown>)[title] = { tiddler: { title, text } }; });
    };
    write(h1.working, "Note of h1", "the working word");
    write(h1.working, "Shadowed", "the working text");
    const personal = repo.create<LarDoc>(emptyLarDoc());
    write(personal, "Private of h1", "the private word");
    write(personal, "Shadowed", "the private text");
    const draft = repo.create<LarDoc>(emptyLarDoc());
    write(draft, "Draft of Note", "the unsaved word");
    const docs = new Map<string, DocHandle<LarDoc>>([[daemonFaceCanonBag(R1), h1.canon], [WORKING, h1.working], [PERSONAL, personal], [DRAFT, draft]]);
    return { h1, personal, docs };
  }

  test("E5 RED: the view reads h1's canon and working layer, and its personal layer never appears", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const { docs } = visited(repo);
    const asked: string[] = [];
    const source = await crossFaceViewSource({
      boot: () => bootTestWiki(), recipe: { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(R1) },
      bind: async (slot) => { asked.push(slot); const handle = docs.get(slot); return handle ? { slot, handle } : null; },
    });
    expect(asked, "the view never asks for a private slot or a draft").not.toContain(PERSONAL);
    expect(asked).not.toContain(DRAFT);
    const view = await composeCrossFaceView(source, { privateDocs: new Set([docs.get(PERSONAL)!.documentId, docs.get(DRAFT)!.documentId]) }); downs.push(() => view.close());
    const get = makeTiddlerGetReactor(view as never);
    expect(((await get({ recipe: "default", title: "Note of h1" }, ctx()))["tiddler"] as { fields: Record<string, string> } | null)?.fields["text"]).toBe("the working word");
    expect(((await get({ recipe: "default", title: "Canon of h1" }, ctx()))["tiddler"] as { bag: string } | null)?.bag).toBe(daemonFaceCanonBag(R1));
    expect((await get({ recipe: "default", title: "Private of h1" }, ctx()))["tiddler"], "a title only in the personal layer reads absent").toBeNull();
    expect((await get({ recipe: "default", title: "Draft of Note" }, ctx()))["tiddler"], "a draft never composes").toBeNull();
    expect(((await get({ recipe: "default", title: "Shadowed" }, ctx()))["tiddler"] as { fields: Record<string, string> } | null)?.fields["text"], "a private record shadows nothing").toBe("the working text");
    const filtered = await makeWikiFilterReactor(view as never)({ recipe: "default", filter: "[[Private of h1]is[tiddler]] [[Note of h1]is[tiddler]] [search:text:literal[the private word]]" }, ctx());
    expect(filtered["titles"]).toEqual(["Note of h1"]);
    const rendered = await makeWikiRenderReactor(view as never)({ recipe: "default", text: "[{{Private of h1}}] [{{Note of h1}}] [{{Shadowed}}]" }, ctx());
    expect(rendered["text"]).toBe("[] [the working word] [the working text]");
  }, 60_000);

  test("E6 RED: a source binding a private layer refuses before any engine boots, and the view takes no write", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const { h1, personal, docs } = visited(repo);
    let booted = 0;
    const leaking = { boot: () => { booted++; return bootTestWiki(); }, recipe: { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(R1) },
      ready: [{ slot: WORKING, handle: h1.working }, { slot: PERSONAL, handle: personal }] };
    await expect(composeCrossFaceView(leaking, { privateDocs: new Set() })).rejects.toMatchObject({ reason: "cross-face-private" });
    expect(booted, "nothing boots over a private layer").toBe(0);
    const view = await composeCrossFaceView(await crossFaceViewSource({
      boot: () => bootTestWiki(), recipe: { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(R1) },
      bind: async (slot) => { const handle = docs.get(slot); return handle ? { slot, handle } : null; },
    }), { privateDocs: new Set([personal.documentId]) });
    downs.push(() => view.close());
    // A visit reads by the target's standing read alone: its door's admin ask refuses, and the put refuses with it.
    const readOnly: VerbContext = { ...ctx(), cap: async (access) => (access === "read" ? { ok: true } : { ok: false, reason: "cross-face read" }) };
    await expect(makeTiddlerPutReactor(view as never)({ recipe: "default", title: "Visitor note", text: "x" }, readOnly)).rejects.toThrow(/cap-denied/);
    // And the view's layers take no write even where a door would pass one: the save lands nowhere.
    await makeTiddlerPutReactor(view as never)({ recipe: "default", title: "Visitor note", text: "x" }, ctx()).catch(() => null);
    const deadline = Date.now() + 2_000;
    while (!holds(h1.working, "Visitor note") && Date.now() < deadline) await turns(8);
    expect(holds(h1.working, "Visitor note"), "a visit writes nothing into the face's working document").toBe(false);
  }, 60_000);

  test("E7 RED: a private document under a visitable label refuses, as does another wiki's draft laid as a library", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const { h1, personal } = visited(repo);
    let booted = 0;
    const boot = () => { booted++; return bootTestWiki(); };
    const LIB = "lar:///ha.ka.ba/bags/shared-lib";
    const recipe = { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(R1), libraryBags: [LIB] };
    const guard = { privateDocs: new Set([personal.documentId]) };
    // The personal document, bound under a library's label and under the working layer's.
    await expect(composeCrossFaceView({ boot, recipe, ready: [{ slot: LIB, handle: personal }] }, guard)).rejects.toMatchObject({ reason: "cross-face-private" });
    await expect(composeCrossFaceView({ boot, recipe, ready: [{ slot: WORKING, handle: personal }] }, guard)).rejects.toMatchObject({ reason: "cross-face-private" });
    // Another wiki's draft laid as a library reads private by its address, whatever recipe lays it.
    const garden = { ...recipe, libraryBags: [wikiSlotUri("garden", "draft")] };
    await expect(composeCrossFaceView({ boot, recipe: garden, ready: [{ slot: wikiSlotUri("garden", "draft"), handle: h1.working }] }, guard)).rejects.toMatchObject({ reason: "cross-face-private" });
    // A binding whose document no id names cannot be checked, and refuses.
    const anonymous = { listVisible: async () => [], get: async () => null, put: async () => {}, tombstone: async () => {}, remove: async () => {}, subscribe: () => () => {} };
    await expect(composeCrossFaceView({ boot, recipe, ready: [{ slot: LIB, store: anonymous as never }] }, guard)).rejects.toMatchObject({ reason: "cross-face-view-unidentified" });
    expect(booted, "nothing boots over a refused binding").toBe(0);
  }, 60_000);

  test("E8 RED: no layer of the view takes a write, temp included, and a store it hands out refuses a put", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const { h1, docs } = visited(repo);
    const view = await composeCrossFaceView(await crossFaceViewSource({
      boot: () => bootTestWiki(), recipe: { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(R1) },
      bind: async (slot) => { const handle = docs.get(slot); return handle ? { slot, handle } : null; },
    }), { privateDocs: new Set() });
    downs.push(() => view.close());
    for (const bag of [WORKING, daemonFaceCanonBag(R1), wikiSlotUri("daemon", "temp")]) expect(view.composite.hasWritableBag(bag), bag).toBe(false);
    const handed = view.composite.storeForBag(WORKING)!;
    await expect(handed.put({ tiddler: { title: "Through the store", text: "x" } } as never, { kind: "lares-verb", requestId: "r" } as never)).rejects.toThrow(/cross-face-view-reads/);
    await turns(16);
    expect(holds(h1.working, "Through the store")).toBe(false);
    // The view still reads.
    expect(((await makeTiddlerGetReactor(view as never)({ recipe: "default", title: "Note of h1" }, ctx()))["tiddler"] as { fields: Record<string, string> } | null)?.fields["text"]).toBe("the working word");
  }, 60_000);
  test("E9 RED (fail closed): a deny set that could not read whole refuses the view before any binding is weighed, and nothing boots", async () => {
    const repo = new Repo({ network: [] }); downs.push(() => repo.shutdown());
    const { h1 } = visited(repo);
    let booted = 0;
    const source = { boot: () => { booted++; return bootTestWiki(); }, recipe: { wikiSlug: "daemon", canonBag: daemonFaceCanonBag(R1) }, ready: [{ slot: WORKING, handle: h1.working }] };
    await expect(composeCrossFaceView(source, { privateDocs: new Set(), unread: ["b/torn names no document"] }))
      .rejects.toMatchObject({ reason: "cross-face-private-unread" });
    expect(booted, "nothing boots over a deny set that could not read whole").toBe(0);
    // CONTROL: the same source over a whole deny set composes.
    const view = await composeCrossFaceView(source, { privateDocs: new Set(), unread: [] });
    downs.push(() => view.close());
    expect(booted).toBe(1);
  }, 60_000);
});
