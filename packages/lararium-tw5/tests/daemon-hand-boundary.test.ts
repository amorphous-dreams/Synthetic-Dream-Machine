/**
 * daemon-hand-boundary — a hand in the daemon surface lands on the next island boundary, as it does in every pool wiki.
 *
 * The hand gate gathers a title's hands until an island boundary or eight marks (`hand-gate.ts`). A pool wiki island
 * fires that boundary on every control event, resend, placed verb and port signal (`wiki-hand-boundary`); the daemon
 * island must fire it on the same cues, or a tiddler the person saves in the daemon surface (one save, one mark) stays
 * in the wiki alone: the composite never holds it, and a `kahua-propose` over it answers `kahua-proposal-no-draft`
 * (lararium-web e2e/stage-walk, S4). Driven over a real wiki, the real recipe and the real bridge.
 */
import { describe, expect, test } from "vitest";
import { AutomergeDocStore, CompositeStore, HULLS_TS_ONLY, LAR_CONTROL_EVENT, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import type { DocHandle, LarDoc } from "@lararium/mesh";
import { buildIslandRecipe, seedDrained } from "../src/island-recipe.js";
import { bridgeWikiToAdaptor } from "../src/outbound-bridge.js";
import { makeDaemonBehavior } from "../src/daemon-behavior.js";
import { makeWikiBehavior } from "../src/wiki-behavior.js";
import { composeIsland, type IslandCap } from "../src/island-caps.js";
import { hasHandBoundary } from "../src/has-island-watches.js";
import type { IslandBehavior, IslandContext } from "../src/island-context.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const HAND = "L4/page-new";

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
const turns = async (n = 16): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
const gated = (adaptor: unknown): string[] => (adaptor as { gate: { titles(): string[] } }).gate.titles().filter((t) => !t.startsWith("$:/test/barrier"));

/** A one-top island (working over the wiki's own bag), the shape the daemon surface mounts, under `behavior`. */
async function rig(slug: string, make: (attach: () => Promise<void>) => IslandBehavior) {
  const engine = await bootTestWiki();
  const composite = new CompositeStore();
  const canon = fakeHandle();
  const working = fakeHandle();
  const workingSlot = wikiSlotUri(slug, "working");
  const { adaptor } = buildIslandRecipe({ tw5: engine, composite, recipe: { wikiSlug: slug }, ready: [{ slot: wikiBagUri(slug), handle: canon }] });
  const stop = bridgeWikiToAdaptor(engine, adaptor);
  await seedDrained(engine);
  const attach = async (): Promise<void> => {
    if (composite.hasBag(workingSlot)) return;
    composite.addLayer({ bagId: workingSlot, store: new AutomergeDocStore(working, workingSlot), writable: true, defaultWritable: true }, composite.layerIndexOf(wikiBagUri(slug)) + 1);
    await composite.put({ tiddler: { title: POINTER, text: workingSlot } }, { kind: "canon-hydrate", receipt: "test-attach" }, { bag: wikiSlotUri(slug, "temp") });
  };
  const behavior = make(attach);
  const ctx = {
    wikiUri: `lar:///ha.ka.ba/wikis/${slug}`, composite, tw5: engine, handles: new Map(), post: () => {},
    repo: undefined, catalogUrl: null, oracleUrl: null, engine: { sha256: "", version: "" }, recipe: { wikiSlug: slug },
  } as unknown as IslandContext;
  // The working layer stands before the seeds run, as the daemon's attach precedes its protocol seed.
  await attach();
  await behavior.onEa(ctx);
  await eventsDelivered(engine);
  // The seed's own hands rest before the probe, so the gate reads the probe's mark alone.
  await adaptor.boundary().catch(() => {});
  await turns(64);
  const Tiddler = engine.$tw.Tiddler as new (f: unknown) => unknown;
  // NO BARRIER TIDDLER HERE: a barrier's own landing fires the adaptor's inbound boundary and would flush the probe.
  const hand = async (): Promise<void> => {
    (engine.$tw.wiki as WikiEvents).addTiddler(new Tiddler({ title: HAND, text: "NEW FROM THE PAGE" }));
    await turns(64);
  };
  const signal = async (type: string): Promise<void> => {
    behavior.onSignal?.(type, {}, ctx);
    const deadline = Date.now() + 2_000;
    while (!held(working).includes(HAND) && Date.now() < deadline) await turns(8);
  };
  return { engine, composite, working, adaptor, behavior, ctx, stop, hand, signal };
}

describe.skipIf(wikiSkip)(`a hand in the daemon surface lands on the island boundary${skipNote}`, () => {
  test("RED: one saved tiddler stays marked until a control event; the daemon island's boundary then lands it in working", async () => {
    const r = await rig("daemon", () => makeDaemonBehavior({ runnableHulls: HULLS_TS_ONLY, verifierFactory: async () => undefined }));
    await r.hand();
    expect(gated(r.adaptor), "the save marks the hand; one mark flushes on no timer").toEqual([HAND]);
    expect(held(r.working)).not.toContain(HAND);
    await r.signal(LAR_CONTROL_EVENT);
    expect(gated(r.adaptor), "the control event never fired the daemon island's hand boundary").toEqual([]);
    expect(held(r.working), "the hand never reached the working document").toContain(HAND);
    expect((await r.composite.resolveLayered(HAND))?.bagId).toBe(wikiSlotUri("daemon", "working"));
    await r.adaptor.stop();
    r.stop();
  }, 60_000);

  test("CONTROL: a pool wiki island lands the same hand on the same signal", async () => {
    const r = await rig("lares", () => makeWikiBehavior({}));
    await r.hand();
    expect(gated(r.adaptor)).toEqual([HAND]);
    await r.signal(LAR_CONTROL_EVENT);
    expect(gated(r.adaptor)).toEqual([]);
    expect(held(r.working)).toContain(HAND);
    await r.adaptor.stop();
    r.stop();
  }, 60_000);
  // THE SAVE RIDES THE ACT ITSELF (stage walk S6): the person's click on the edit frame's save arrives as ONE control
  // event, and the event's owner applies it to the wiki after the boundary cap has already fired. The hand that act
  // made lands on that same act, never on the next one, which may never come.
  const ownerSaves = (engine: { $tw: { wiki: unknown; Tiddler: unknown } }): IslandCap => ({
    name: "owner-saves",
    onSignal(type) {
      if (type !== LAR_CONTROL_EVENT) return false;
      const Tiddler = engine.$tw.Tiddler as new (f: unknown) => unknown;
      (engine.$tw.wiki as WikiEvents).addTiddler(new Tiddler({ title: HAND, text: "SAVED BY THE ACT" }));
      return true;
    },
  });

  for (const slug of ["daemon", "lares"]) {
    test(`RED: a save the control event itself carries lands on that event, with no second act (${slug})`, async () => {
      let owner: IslandCap | null = null;
      const r = await rig(slug, () => composeIsland([hasHandBoundary(), { name: "owner", onSignal: (type, raw, ctx) => owner!.onSignal!(type, raw, ctx) }]));
      owner = ownerSaves(r.engine);
      expect(gated(r.adaptor)).toEqual([]);
      await r.signal(LAR_CONTROL_EVENT);
      expect(held(r.working), "the act's own save waited for a later act").toContain(HAND);
      expect(gated(r.adaptor)).toEqual([]);
      await r.adaptor.stop();
      r.stop();
    }, 60_000);
  }
});
