/**
 * island-seed — WAVE ZERO: the seed lands as the first nalu, delivered before TiddlyWiki starts.
 *
 * The composition a recipe laid (`layIslandComposition`) stands before the engine boots, so the island reads it once and hands
 * its records to `bootTw5` beside the boot set: TW5's boot adds them while its change queue still sleeps (its
 * `enqueueTiddlerEvent` arrives with the wiki methods, after the preloads), so they raise ZERO `change` dispatches, where the
 * same records landed one wave at a time after boot raised a dispatch per slice and a tracker pass each.
 *
 * EVERYTHING THE COMPOSITION RESOLVES preloads, a module, a plugin and a startup action included: TiddlyWiki defines, unpacks and
 * runs them at boot as it does any store's. Only ground the boot set carries stays out (`boot-census.ts`): those records wait in
 * `waves` and land after boot through the shore's queue, overriding the boot set's shadow text as any later wave does.
 *
 * ONE BOOT SHAPE, the glass mirror's: census partition (`boot-census.ts`) -> nalu form
 * (`nalu-form.ts`, the applier's own builder) -> `$tw.preloadTiddlers`. One form above and below.
 *
 * THE SEED TEACHES THE SHORE WHAT STANDS. The same read keeps, per preloaded title, the bag, the heads and the record it resolved
 * (`stands`, a tombstoned title's row included) and each layer's heads at the read (`layerHeads`). The shore names each seed
 * title's bag from them at mount (`IslandAdaptor.standFromSeed`) and stands a row for every other synced title, the way TW5's
 * syncer reads every tiddler in memory as synced when it stands after the boot pass (`Syncer.readTiddlerInfo`): no replay
 * re-lands a title the wiki already holds, so a startup action's write over a preload stands in the VM, unsaved, as native TW5
 * keeps it.
 *
 * THE KAHUA SHADOW STAMPS BOOT BESIDE THE RECORDS. Where the composition lays the kahua stage, a title whose topmost record
 * covers a kahua twin casts a "local draft over shared" stamp (`kahua-shadow.ts`). The stamp lives as a wiki tiddler on the
 * temp plane, so it rides the preloads in the form the shore writes it (`kahuaShadowTitle`), and joins `titles` beside the
 * record it marks.
 *
 * PER TITLE, ONE ANSWER: the composition's topmost record (`resolveLayered`, kāpae honoured). A title whose topmost record
 * stands as a tombstone preloads nothing, so a lower live copy never shows.
 *
 * THE GAP: TW5's boot runs between this read and the shore's start. The seed starts hearing the composition ahead of its read,
 * until the shore mounts (`release`), and hands back every change it heard, a title that arrived during the boot included; the
 * shore lands those afresh, so a record that left every layer during boot leaves the wiki too, and one that arrived lands.
 *
 * A BOOTED ENGINE (`booted`): an engine that stood before its composition laid preloads nothing, so every record the composition
 * resolves rides `waves` and lands through the shore's queue: wave zero arriving as a wave, one envelope per title.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/nalu#/the-wave-shape
 */
import type { CompositeStore } from "@lararium/mesh/composite-store";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { KAHUA_BAG } from "@lararium/mesh/wiki-recipe";
import { bootCensusOf, islandSeedPreloadable } from "./boot-census.js";
import { kahuaShadowOf, kahuaShadowTitle, type KahuaShadow } from "./kahua-shadow.js";
import { neverPersists } from "./island-adaptor.js";
import { naluFieldsOf, naluLands } from "./nalu-form.js";

/** What the seed read resolved for one title the wiki boots holding (or, for a tombstone, boots without). */
export interface SeedStand {
  readonly bag: string;
  readonly record: LarTiddlerRecord;
  readonly heads?: readonly string[];
}

/** Wave zero: the records the engine boots with, what the shore learns from them, and the changes the composition told during the boot. */
export interface IslandSeed {
  /** The nalu-form fields of each preloaded record (each kahua shadow stamp after the record it marks), in the composite's title order: hand these to `bootTw5` as `seedTiddlers`. */
  readonly preloads: readonly Record<string, unknown>[];
  readonly titles: ReadonlySet<string>;
  /** Per title the boot store took (or a tombstone kept out of it): the composition's answer, for the shore's books. */
  readonly stands: ReadonlyMap<string, SeedStand>;
  /** The records that land after boot through the shore's queue: boot-set ground, or every record where the engine booted first. */
  readonly waves: readonly LarTiddlerChange[];
  /** Each layer's heads, read before the enumeration: what the shore holds as landed per bag once its books stand. */
  readonly layerHeads: ReadonlyMap<string, readonly string[]>;
  /** Stop hearing the composition and answer the last change heard per title since the read began. Idempotent. */
  release(): LarTiddlerChange[];
}

/** The stamp a shadowed title casts, in the fields the shore writes it with (`IslandAdaptor._applyKahuaShadow`). */
function stampFieldsOf(title: string, shadow: KahuaShadow): { title: string } & Record<string, unknown> {
  return { title: kahuaShadowTitle(title), text: shadow.shared, "draft-bag": shadow.draftBag, "shadow-of": title };
}

/**
 * Read wave zero off a laid composition. `bootPreloads` names the boot set the engine boots with (the census keeps every record
 * off ground it owns). `booted` reads for an engine that already stands: nothing preloads, every record rides `waves`. The read
 * awaits per title where a layer reads only through `get` (the kahua stage); a pre-boot await costs the engine no tick.
 */
export async function readIslandSeed(composite: CompositeStore, bootPreloads: readonly Record<string, unknown>[], opts: { booted?: boolean } = {}): Promise<IslandSeed> {
  const heard = new Map<string, LarTiddlerChange>();
  const off = composite.subscribe((change) => { heard.set(change.title, change); });
  const census = bootCensusOf(bootPreloads);
  const preloads: Record<string, unknown>[] = [];
  const titles = new Set<string>();
  const stands = new Map<string, SeedStand>();
  const waves: LarTiddlerChange[] = [];
  const layerHeads = new Map<string, readonly string[]>();
  try {
    // The heads come first: a change after them reaches `heard`, so the shore never holds a bag as landed past what it lands.
    for (const bag of composite.layerIds) {
      const heads = (composite.storeForBag(bag) as { headsNow?: () => readonly string[] | null } | null)?.headsNow?.();
      if (heads && heads.length > 0) layerHeads.set(bag, heads);
    }
    const kahua = composite.layerIndexOf(KAHUA_BAG) !== -1;
    for (const title of await composite.listVisible()) {
      const top = await composite.resolveLayered(title);
      if (!top) continue;
      const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: top.bagId };
      const change: LarTiddlerChange = { title, record: top.record, origin, bag: top.bagId, ...(top.heads !== undefined ? { heads: top.heads } : {}) };
      if (opts.booted || !islandSeedPreloadable(title, census)) { waves.push(change); continue; }
      stands.set(title, { bag: top.bagId, record: top.record, ...(top.heads !== undefined ? { heads: top.heads } : {}) });
      if (naluLands(change)) {
        preloads.push(naluFieldsOf(change));
        titles.add(title);
      }
      const shadow = kahua && !neverPersists(title) ? await kahuaShadowOf(composite, title, top) : null;
      if (shadow) {
        const stamp = stampFieldsOf(title, shadow);
        preloads.push(stamp);
        titles.add(stamp.title);
      }
    }
  } catch (error) {
    off();
    throw error;
  }
  let released = false;
  return {
    preloads,
    titles,
    stands,
    waves,
    layerHeads,
    release() {
      if (!released) { released = true; off(); }
      return [...heard.values()];
    },
  };
}
