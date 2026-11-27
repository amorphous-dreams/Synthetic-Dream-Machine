/**
 * island-seed — WAVE ZERO: the seed lands as the first nalu, delivered before TiddlyWiki starts.
 *
 * The composition a recipe laid (`layIslandComposition`) stands before the engine boots, so the island reads it once and hands
 * its records to `bootTw5` beside the boot set: TW5's boot adds them while its change queue still sleeps (its
 * `enqueueTiddlerEvent` arrives with the wiki methods, after the preloads), so they raise ZERO `change` dispatches, where the
 * same records landed one wave at a time after boot raised a dispatch per slice and a tracker pass each.
 *
 * EVERYTHING THE COMPOSITION RESOLVES preloads, a module, a plugin and a startup action included: TiddlyWiki defines, unpacks and
 * runs them at boot as it does any store's. Only ground the boot set carries stays out (`boot-census.ts`).
 *
 * ONE BOOT SHAPE, the glass mirror's: census partition (`boot-census.ts`) -> nalu form
 * (`nalu-form.ts`, the applier's own builder) -> `$tw.preloadTiddlers`. One form above and below: the seed replay that still runs
 * after boot (`mountIslandShore`) lands each preloaded title through `_applyLanding`, which reads the seed's own form as already
 * landed (`IslandAdaptor.countSeedAsLanded`, TW5's `Syncer.readTiddlerInfo`) and writes nothing, so a startup action's write over
 * a preload stands in the VM, unsaved, as native TW5 keeps it; the ledger, the landed heads, the draft book and the kahua shadow
 * stamps fill through that road unchanged.
 *
 * PER TITLE, ONE ANSWER: the composition's topmost record (`resolveLayered`, kāpae honoured). A title whose topmost record
 * stands as a tombstone preloads nothing, so a lower live copy never shows. The enumeration reads the composite's visible titles,
 * a superset of every title a replay could land live.
 *
 * THE GAP: TW5's boot runs between this read and the shore's start. The seed starts hearing the composition ahead of its read, until
 * the shore mounts (`release`), and hands back every change it heard for a preloaded title; the shore lands those afresh, so a
 * record that left every layer during boot (where no replay names it again) leaves the wiki too.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/nalu#/the-wave-shape
 */
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { LarTiddlerChange } from "@lararium/mesh/tiddler-store";
import { bootCensusOf, islandSeedPreloadable } from "./boot-census.js";
import { naluFieldsOf, naluLands } from "./nalu-form.js";

/** Wave zero: the records the engine boots with, their titles, and the changes the composition told during the boot. */
export interface IslandSeed {
  /** The nalu-form fields of each preloaded record, in the composite's title order: hand these to `bootTw5` as `seedTiddlers`. */
  readonly preloads: readonly Record<string, unknown>[];
  readonly titles: ReadonlySet<string>;
  /** Stop hearing the composition and answer the last change heard for each preloaded title since the read began. Idempotent. */
  release(): LarTiddlerChange[];
}

/**
 * Read wave zero off a laid composition. `bootPreloads` names the boot set the engine boots with (the census keeps every record
 * off ground it owns). The read awaits per title where a layer reads only through `get` (the kahua stage); a pre-boot await costs
 * the engine no tick.
 */
export async function readIslandSeed(composite: CompositeStore, bootPreloads: readonly Record<string, unknown>[]): Promise<IslandSeed> {
  const heard = new Map<string, LarTiddlerChange>();
  const off = composite.subscribe((change) => { heard.set(change.title, change); });
  const census = bootCensusOf(bootPreloads);
  const preloads: Record<string, unknown>[] = [];
  const titles = new Set<string>();
  try {
    for (const title of await composite.listVisible()) {
      const top = await composite.resolveLayered(title);
      if (!top) continue;
      const change = { title, record: top.record, bag: top.bagId };
      if (!naluLands(change)) continue;
      if (!islandSeedPreloadable(title, census)) continue;
      preloads.push(naluFieldsOf(change));
      titles.add(title);
    }
  } catch (error) {
    off();
    throw error;
  }
  let released = false;
  return {
    preloads,
    titles,
    release() {
      if (!released) { released = true; off(); }
      return [...heard.values()].filter((change) => titles.has(change.title));
    },
  };
}
