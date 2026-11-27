/**
 * wave-zero-seed — the seed lands as the first nalu, before TiddlyWiki starts (`island-seed.ts`).
 *
 * One seed of ~300 records over two layers (the wiki's canon beneath its working layer), carrying a tombstone over a lower live copy,
 * a draft with its draft base, a module record and a StartupAction record, stands two ways off the same saved documents:
 *
 *   CONTROL     the composition laid, no seed read: the engine boots bare and every record lands as a wave after boot (the road the
 *               seed took before wave zero).
 *   WAVE ZERO   the seed read off the laid composition and booted as preloads: everything the composition resolves preloads, the
 *               module defines and evaluates, the startup action runs at TW5's boot pass.
 *
 * Both then mount the same shore and await the seed checkpoint. The vectors read: (a) wave zero reaches the wiki's observers
 * as ONE `change` dispatch naming every preloaded title, once the seed stands (the nalu law: one wave, all observers, one
 * dispatch), never one per tiddler (CONTROL: the per-change road dispatches every seeded title too); (b) the landed ledger
 * holds, title for title, the row the per-change road writes (bag, heads, fields); (c) the module and the startup record preloaded
 * and ran; (d) the tombstoned title stands absent and preloads nothing.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { type DocHandle, type Repo as RepoType } from "@lararium/mesh/automerge";
import { wikiCanonOf, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { layIslandComposition, mountIslandShore, seedDrained } from "../src/island-recipe.js";
import { readIslandSeed, type IslandSeed } from "../src/island-seed.js";
import { DRAFT_BASE_BAG, DRAFT_BASE_HEADS } from "../src/draft-book.js";
import { bootTestWiki, houseSkins, skipNote, wikiSkip } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { IslandAdaptor } from "../src/island-adaptor.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
const automerge = meshRequire("@automerge/automerge") as { save(doc: LarDoc): Uint8Array };

const SLUG = "wave-zero";
const CANON = wikiCanonOf({ wikiSlug: SLUG });
const WORKING = wikiSlotUri(SLUG, "working");
const origin = { kind: "canon-hydrate", receipt: "wave-zero-test" } as const;

const PLAIN = Array.from({ length: 300 }, (_, i) => `seed/plain/${i}`);
const SHADOWED = "seed/shadowed";                   // live in canon, tombstoned in working: the composition resolves the tombstone
const DRAFT = "Draft of 'seed/plain/7'";
const MODULE = "lar:///t/seed/module.js";
const STARTUP = "lar:///t/seed/startup";
const PROBE = "$:/temp/seed/startup-ran";
const ALL = [...PLAIN, SHADOWED, DRAFT, MODULE, STARTUP];

let saved: { canon: Uint8Array; working: Uint8Array };

beforeAll(async () => {
  const repo = new Repo({ network: [] });
  const canonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const canon = new AutomergeDocStore(canonHandle, CANON);
  const working = new AutomergeDocStore(workingHandle, WORKING);
  for (const [i, title] of PLAIN.entries()) {
    await (i % 2 === 0 ? canon : working).put({ tiddler: { title, text: `value ${i}`, tags: ["seed", "wave zero"], modified: "20261126000000000" } }, origin);
  }
  // A title both layers hold: canon's live copy under working's tombstone.
  await canon.put({ tiddler: { title: SHADOWED, text: "the lower live copy" } }, origin);
  await working.put({ tiddler: { title: SHADOWED, text: "about to fall" } }, origin);
  await working.tombstone(SHADOWED, origin);
  await working.put({ tiddler: { title: DRAFT, "draft.of": "seed/plain/7", "draft.title": "seed/plain/7", text: "drafting", [DRAFT_BASE_BAG]: WORKING, [DRAFT_BASE_HEADS]: "absent h0" } }, origin);
  await working.put({ tiddler: { title: MODULE, type: "application/javascript", "module-type": "library", text: "exports.seeded = 11;" } }, origin);
  await working.put({ tiddler: { title: STARTUP, tags: ["$:/tags/StartupAction"], text: `<$action-setfield $tiddler="${PROBE}" text="ran"/>` } }, origin);
  saved = { canon: automerge.save(canonHandle.doc()), working: automerge.save(workingHandle.doc()) };
  await repo.shutdown();
}, 120_000);

interface Stood {
  readonly engine: TW5Engine;
  readonly adaptor: IslandAdaptor;
  readonly seed: IslandSeed | null;
  /** Every title a wiki `change` dispatch named, from the listener's install (right after boot) to the seed checkpoint. */
  readonly dispatched: Set<string>;
  /** Each `change` dispatch's titles, in order. */
  readonly dispatches: string[][];
  readonly repo: RepoType;
}

async function stand(run: { preload: boolean }): Promise<Stood> {
  const repo = new Repo({ network: [] });
  const ready = [
    { slot: CANON, handle: repo.import<LarDoc>(saved.canon) as DocHandle<LarDoc> },
    { slot: WORKING, handle: repo.import<LarDoc>(saved.working) as DocHandle<LarDoc> },
  ];
  const composite = new CompositeStore();
  const laid = layIslandComposition({ composite, recipe: { wikiSlug: SLUG }, ready });
  const seed = run.preload ? await readIslandSeed(composite, houseSkins()) : null;
  const engine = await bootTestWiki(seed ? { seed: seed.preloads } : {});
  const dispatched = new Set<string>();
  const dispatches: string[][] = [];
  (engine.$tw.wiki as unknown as { addEventListener(type: "change", fn: (changes: Record<string, unknown>) => void): void })
    .addEventListener("change", (changes) => { dispatches.push(Object.keys(changes)); for (const title of Object.keys(changes)) dispatched.add(title); });
  const { adaptor } = mountIslandShore(engine, laid, seed);
  await seedDrained(engine);
  // The wiki's own dispatch of the last slice runs on its next tick: let it land before reading.
  for (let i = 0; i < 2; i++) await new Promise<void>((resolve) => process.nextTick(resolve));
  return { engine, adaptor, seed, dispatched, dispatches, repo };
}

/** The landed row as a test compares it: bag, heads and the tiddler's field strings (null where the wave left no tiddler). */
function rowOf(adaptor: IslandAdaptor, title: string): unknown {
  const entry = adaptor.ledger.landedOf(title);
  if (!entry) return undefined;
  const tiddler = entry.tiddler as { getFieldStrings(): Record<string, string> } | null;
  return { bag: entry.bag, heads: entry.heads, fields: tiddler ? tiddler.getFieldStrings() : null };
}

type WikiReader = { getTiddler(title: string): { fields: Record<string, unknown> } | undefined };

describe.skipIf(wikiSkip)(`wave zero: the seed boots as preloads through the nalu form${skipNote}`, () => {
  const stood: Stood[] = [];
  afterEach(async () => {
    for (const s of stood.splice(0)) { await s.adaptor.stop(); s.engine.dispose(); await s.repo.shutdown(); }
  });

  test("every resolved record preloads and wave zero reaches observers in ONE dispatch; the ledger matches the per-change road row for row; the module defines and the startup action ran at boot; the tombstoned title stands absent", async () => {
    const control = await stand({ preload: false });
    stood.push(control);
    const zero = await stand({ preload: true });
    stood.push(zero);
    const seed = zero.seed!;

    // (c) what preloaded: everything the composition resolves, the module and the startup record included.
    expect([...seed.titles].sort()).toEqual([...PLAIN, DRAFT, MODULE, STARTUP].sort());

    // (a) one dispatch carries every preloaded title (live ones: the tombstoned title preloads nothing); CONTROL: the per-change
    // road dispatched every one.
    const naming = zero.dispatches.filter((titles) => titles.some((title) => seed.titles.has(title)));
    expect(naming.length, "wave zero reaches observers in one dispatch, never one per tiddler").toBe(1);
    expect([...seed.titles].filter((title) => !naming[0]!.includes(title)), "the one dispatch names every preloaded title").toEqual([]);
    expect([...seed.titles].filter((title) => !control.dispatched.has(title)), "CONTROL: the waves dispatched every seeded title").toEqual([]);

    // (b) the ledger holds the row the per-change road writes, title for title.
    for (const title of ALL) expect(rowOf(zero.adaptor, title), title).toEqual(rowOf(control.adaptor, title));
    expect(rowOf(zero.adaptor, PLAIN[0]!), "the ledger filled").toMatchObject({ bag: CANON });

    // The draft preloaded through the nalu form: the draft base stays on the store record.
    const wiki = zero.engine.$tw.wiki as unknown as WikiReader;
    expect(wiki.getTiddler(DRAFT)?.fields[DRAFT_BASE_BAG]).toBeUndefined();
    expect(wiki.getTiddler(DRAFT)?.fields["$origin-bag"]).toBe(WORKING);

    // (c) the module defined at boot and evaluates; the startup action ran at TW5's boot pass, once.
    expect((zero.engine.$tw as unknown as { modules: { execute(t: string): Record<string, unknown> } }).modules.execute(MODULE)["seeded"]).toBe(11);
    expect(wiki.getTiddler(PROBE)?.fields["text"]).toBe("ran");
    // CONTROL: on the per-change road the module record landed after boot as data, and the startup action ran once the seed stood.
    expect((control.engine.$tw as unknown as { modules: { titles: Record<string, unknown> } }).modules.titles[MODULE]).toBeUndefined();
    expect((control.engine.$tw.wiki as unknown as WikiReader).getTiddler(PROBE)?.fields["text"]).toBe("ran");

    // (d) the tombstone over a lower live copy: absent, never preloaded, and its row names the tombstone's bag.
    expect(seed.titles.has(SHADOWED)).toBe(false);
    expect(wiki.getTiddler(SHADOWED)).toBeUndefined();
    expect(rowOf(zero.adaptor, SHADOWED)).toMatchObject({ bag: WORKING, fields: null });
  }, 240_000);

  test("a seed title the boot set already carries stays out of the seed: the boot set's own bytes stand", async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    await new AutomergeDocStore(handle, WORKING).put({ tiddler: { title: "$:/core/modules/widgets/list.js", type: "application/javascript", "module-type": "widget", text: "exports.list = null;" } }, origin);
    await new AutomergeDocStore(handle, WORKING).put({ tiddler: { title: "seed/kept", text: "kept" } }, origin);
    const composite = new CompositeStore();
    layIslandComposition({ composite, recipe: { wikiSlug: SLUG }, ready: [{ slot: WORKING, handle: handle as DocHandle<LarDoc> }] });
    const seed = await readIslandSeed(composite, houseSkins());
    try {
      expect([...seed.titles]).toEqual(["seed/kept"]);
    } finally { seed.release(); await repo.shutdown(); }
  }, 120_000);

  test("A STARTUP WRITE STANDS: a startup action that rewrites a seeded title at TW5's boot pass keeps its write in the wiki, leaves the store's value standing (native TW5 stands its syncer after the boot pass and reads boot state as synced), and runs once", async () => {
    const COUNTER = "seed/counter", ACT = "lar:///t/seed/startup-rewrites", RUNS = "$:/temp/seed/startup-runs";
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const seeded = new AutomergeDocStore(handle, WORKING);
    await seeded.put({ tiddler: { title: COUNTER, text: "seeded" } }, origin);
    await seeded.put({ tiddler: { title: ACT, tags: ["$:/tags/StartupAction"],
      text: `<$action-setfield $tiddler="${COUNTER}" text="booted"/><$action-setfield $tiddler="${RUNS}" text={{{ [{${RUNS}}else[0]add[1]] }}}/>` } }, origin);
    const composite = new CompositeStore();
    const laid = layIslandComposition({ composite, recipe: { wikiSlug: SLUG }, ready: [{ slot: WORKING, handle: handle as DocHandle<LarDoc> }] });
    const seed = await readIslandSeed(composite, houseSkins());
    expect([...seed.titles].sort()).toEqual([ACT, COUNTER].sort());
    const engine = await bootTestWiki({ seed: seed.preloads });
    const wiki = engine.$tw.wiki as unknown as WikiReader;
    // TW5's boot pass ran the action over the preloads, before any shore stood.
    expect(wiki.getTiddler(COUNTER)?.fields["text"], "the boot pass wrote the seeded title").toBe("booted");
    const { adaptor } = mountIslandShore(engine, laid, seed);
    try {
      await seedDrained(engine);
      await adaptor.landingIdle();
      // Native TW5 (core startup.js) runs every StartupAction, then stands the syncer; Syncer.readTiddlerInfo
      // reads every tiddler in memory as already synced. A boot-pass write stands in the VM and never saves.
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      await adaptor.landingIdle();
      const store = composite.storeForBag(WORKING)!;
      expect(wiki.getTiddler(COUNTER)?.fields["text"], "the shore never paints the seed back over the boot's write").toBe("booted");
      expect((await store.get(COUNTER))?.tiddler.text, "the store keeps its own value: a boot-pass write never saves").toBe("seeded");
      expect(wiki.getTiddler(RUNS)?.fields["text"], "the action ran once: the shore never re-runs a boot-pass action").toBe("1");
    } finally { await adaptor.stop(); engine.dispose(); await repo.shutdown(); }
  }, 240_000);

  test("THE BOOT'S GAP: a preloaded record that leaves every layer while the engine boots leaves the wiki too", async () => {
    const repo = new Repo({ network: [] });
    const working = repo.import<LarDoc>(saved.working) as DocHandle<LarDoc>;
    const composite = new CompositeStore();
    const laid = layIslandComposition({ composite, recipe: { wikiSlug: SLUG }, ready: [{ slot: WORKING, handle: working }] });
    const seed = await readIslandSeed(composite, houseSkins());
    const gone = PLAIN[1]!;
    expect(seed.titles.has(gone)).toBe(true);
    // During the boot: the record leaves its only layer outright (no tombstone, so no replay names it again).
    await composite.storeForBag(WORKING)!.remove(gone, origin);
    const engine = await bootTestWiki({ seed: seed.preloads });
    const { adaptor } = mountIslandShore(engine, laid, seed);
    try {
      await seedDrained(engine);
      await adaptor.landingIdle();
      expect((engine.$tw.wiki as unknown as WikiReader).getTiddler(gone), "the preload left with its record").toBeUndefined();
      expect((engine.$tw.wiki as unknown as WikiReader).getTiddler(PLAIN[3]!), "CONTROL: a record that stayed stands").toBeDefined();
    } finally { await adaptor.stop(); engine.dispose(); await repo.shutdown(); }
  }, 240_000);
});
