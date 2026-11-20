/**
 * face-engine — EACH HAT REACHED BY NAME: a lit sibling face's own TiddlyWiki engine, the anchor composition over THAT face's
 * own daemon documents (its daemon canon and its working slot), so the tiddler door answers a sibling from its own wiki and
 * never from the mount's.
 *
 *   E1  RED: a face engine's tiddler door reads its own canon and lands a put in its OWN working document
 *   E2  RED: two faces' engines stand apart: one face's put never reads in the other's wiki
 *   E3  RED: the engines cache one engine per face; a drop closes it and the next ask composes afresh; a face with no source
 *       composes nothing
 *
 * A real engine boots here (`bootTestWiki`), with the real recipe, adaptor and bridge.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { daemonFaceCanonBag, emptyLarDoc, wikiSlotUri, type DocHandle, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import { composeFaceEngine, faceEngines, type FaceEngineSource } from "../src/face-engine.js";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, makeWikiFilterReactor } from "../src/tiddler-verbs.js";
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
});
