/**
 * daemon-behavior-seed-order — no daemon writer fires before the working layer stands.
 *
 * The daemon protocol seed writes the wiki as a hand. Its saves route through the write-layer pointer,
 * which the daemon's working-layer attach re-seeds; a seed that runs ahead of the attach routes through an
 * empty pointer and refuses as unrouted. Driven over a real wiki and the real recipe, with the attach
 * released by hand after the hand gate's trailing window has elapsed.
 */
import { describe, expect, test } from "vitest";
import { AutomergeDocStore, CompositeStore, HULLS_TS_ONLY, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import type { DocHandle, LarDoc } from "@lararium/mesh";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { makeDaemonBehavior } from "../src/daemon-behavior.js";
import type { IslandContext } from "../src/island-context.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

function fakeHandle(): DocHandle<LarDoc> {
  const doc = { tiddlers: {} } as unknown as LarDoc;
  return {
    url: "automerge:fake", doc: () => doc, heads: () => [], view: () => ({ doc: () => doc }),
    on: () => {}, change: (fn: (d: LarDoc) => void) => fn(doc),
  } as unknown as DocHandle<LarDoc>;
}
const held = (h: DocHandle<LarDoc>): string[] => Object.keys((h.doc() as unknown as { tiddlers: Record<string, unknown> }).tiddlers);

type WikiEvents = {
  addEventListener(type: string, l: (c: Record<string, unknown>) => void): void;
  removeEventListener(type: string, l: (c: Record<string, unknown>) => void): void;
  addTiddler(t: unknown): void;
};
let barrierSeq = 0;
/** Resolves once every change raised before this call has reached every earlier listener (the bridge among them). */
function eventsDelivered(engine: { $tw: { wiki: unknown; Tiddler: unknown } }): Promise<void> {
  const wiki = engine.$tw.wiki as WikiEvents;
  const Tiddler = engine.$tw.Tiddler as new (f: unknown) => unknown;
  const title = `$:/test/barrier-${++barrierSeq}`;
  return new Promise<void>((resolve) => {
    const onChange = (changes: Record<string, unknown>): void => {
      if (title in changes) { wiki.removeEventListener("change", onChange); resolve(); }
    };
    wiki.addEventListener("change", onChange);
    wiki.addTiddler(new Tiddler({ title, text: "barrier" }));
  });
}
const markedHands = (adaptor: unknown): string[] => (adaptor as { gate: { titles(): string[] } }).gate.titles().filter((t) => !t.startsWith("$:/test/barrier"));

async function rig(releaseAttach: Promise<void>, attach: boolean) {
  const engine = await bootTestWiki();
  const slug = "daemon";
  const composite = new CompositeStore();
  const canon = fakeHandle();
  const working = fakeHandle();
  const { adaptor } = buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: wikiBagUri(slug), handle: canon }] });
  const stop = bridgeWikiToAdaptor(engine, adaptor);
  await seedDrained(engine);
  const workingSlot = wikiSlotUri(slug, "working");
  const behavior = makeDaemonBehavior({
    runnableHulls: HULLS_TS_ONLY,
    verifierFactory: async () => {
      await releaseAttach;
      if (attach) {
        composite.addLayer({ bagId: workingSlot, store: new AutomergeDocStore(working, workingSlot), writable: true, defaultWritable: true }, composite.layerIndexOf(wikiBagUri(slug)) + 1);
        await composite.put({ tiddler: { title: POINTER, text: workingSlot } }, { kind: "canon-hydrate", receipt: "test-attach" }, { bag: wikiSlotUri(slug, "temp") });
      }
      return undefined;
    },
  });
  const ctx = {
    wikiUri: "lar:///ha.ka.ba/wikis/daemon", composite, tw5: engine, handles: new Map(), post: () => {},
    repo: undefined, catalogUrl: null, oracleUrl: null, engine: { sha256: "", version: "" }, recipe: { wikiSlug: slug },
  } as unknown as IslandContext;
  return { engine, composite, canon, working, behavior, ctx, stop, adaptor };
}

describe.skipIf(wikiSkip)(`daemon behavior boot order${skipNote}`, () => {
  test("no seed write is owed while the attach is pending; after it, every seed saves into the working document", async () => {
    let release!: () => void;
    const r = await rig(new Promise<void>((resolve) => { release = resolve; }), true);
    const booting = r.behavior.onEa(r.ctx);
    await eventsDelivered(r.engine);
    expect(markedHands(r.adaptor), "a seed write was owed before the working layer stood").toEqual([]);
    release();
    await booting;
    await eventsDelivered(r.engine);
    await r.adaptor.stop();
    const wiki = r.engine.$tw.wiki as never as { filterTiddlers(f: string): string[]; getTiddlerText(t: string, d?: string): string };
    expect(wiki.getTiddlerText(POINTER, "")).toBe(wikiSlotUri("daemon", "working"));
    expect(wiki.filterTiddlers("[all[tiddlers]tag[$:/tags/Alert]field:alert-kind[unrouted-save]]")).toEqual([]);
    expect(held(r.working).length, "no seed tiddler reached the working document").toBeGreaterThan(0);
    expect(held(r.canon), "a seed tiddler fell into the daemon bag").toEqual([]);
    r.stop();
  }, 60_000);

  test("CONTROL: with no attach the pointer stays empty and the seed saves refuse as unrouted", async () => {
    const r = await rig(Promise.resolve(), false);
    await r.behavior.onEa(r.ctx);
    await eventsDelivered(r.engine);
    expect(markedHands(r.adaptor).length, "the seed owed no write").toBeGreaterThan(0);
    await r.adaptor.stop();
    const wiki = r.engine.$tw.wiki as never as { filterTiddlers(f: string): string[] };
    expect(wiki.filterTiddlers("[all[tiddlers]tag[$:/tags/Alert]field:alert-kind[unrouted-save]]").length).toBeGreaterThan(0);
    r.stop();
  }, 60_000);
});
