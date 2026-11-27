/**
 * island-recipe — one-model assembly for sovereign islands.
 *
 * Canonical assembly:
 *   1) `expandRecipe(recipe)` → ordered slot URIs (top of array = highest priority)
 *   2) addLayer for each slot in cascade order (bottom-up): oracle floor first, temp last
 *   3) temp uses memory, oracle wraps its seed store with the floor read-face, the kahua slot reads the stage's fold under
 *      the face (`kahuaStageStore`), and other slots use AutomergeDocStore
 *   4) IslandAdaptor projection registers, names each seed title's bag (`standFromSeed`) and stands one row per synced title (`start`)
 *   5) the records that wait for boot (boot-set ground, the boot's gap) enter the shore landing queue; its checkpoint resolves
 *      when that queue empties
 *
 * WAVE ZERO splits the assembly at the engine: `layIslandComposition` (steps 1-3) stands before TiddlyWiki boots, the seed's
 * records join the engine's boot store through the nalu form (`island-seed.ts`), and `mountIslandShore` (steps 4-5)
 * runs once the engine stands. No layer replays at mount: the seed alone teaches the shore what already stands.
 *
 * Node and browser sovereign workers both call this helper so recipe behavior
 * stays one shape across platforms.
 */

import type { FaceActorDoor } from "@lararium/mesh/automerge-doc-store";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import {
  defaultWritableSlot,
  expandRecipe,
  slotLayerFlags,
  wikiSlotKindOf,
  wikiSlotUri,
  ORACLE_BAG,
  KAHUA_BAG,
  type WikiRecipe,
  type SlotUri,
} from "@lararium/mesh/wiki-recipe";
import { floorReadFace } from "@lararium/mesh/floor-manifest";
import { type KahuaStageFace } from "@lararium/mesh/kahua-stage-store";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { type DocHandle } from "@lararium/mesh/automerge";
import { type LarTiddlerChange, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import { IslandAdaptor } from "./island-adaptor.js";
import { kahuaLayerStore } from "./kahua-layer.js";
import { MemoryTiddlerStore } from "./memory-store.js";
import type { TW5Engine } from "./tw5-vm.js";
import { type IslandSeed } from "./island-seed.js";

/**
 * One slot's binding: a CRDT handle the recipe wraps in its own store, or a store already standing over that slot's document
 * (a named wiki's layer reached by reference, or its floor snapshot), which the recipe lays as it stands. A store handed here
 * belongs to this composition alone: the seed reads it into this engine.
 */
export type RecipeReadyBinding =
  | { /** Slot URI from the expanded recipe. */ slot: SlotUri; handle: DocHandle<LarDoc> }
  | { /** Slot URI from the expanded recipe. */ slot: SlotUri; store: LarTiddlerStore };

export interface LayIslandCompositionInput {
  composite: CompositeStore;
  recipe: WikiRecipe;
  /** Resolved CRDT handles (or stores) keyed by slot URI. temp has no entry. */
  ready: readonly RecipeReadyBinding[];
  /** Pinned system snapshots beneath the live oracle seed. */
  floorRecords?: readonly Readonly<Record<string, LarTiddlerRecord>>[];
  /** The face holds no writer's seat in the wiki's workbench: its `personal` slot takes the default write (cabal-realm#/the-workbench). */
  writeSlot?: "personal";
  /** The face the kahua stage reads under; absent or null, the kahua layer stands empty. */
  kahuaFace?: () => KahuaStageFace | null;
  /** Wakes the kahua layer's re-fold when the face's lineage moves (`liveKahuaFace`). */
  kahuaFaceWatch?: (fn: () => void) => () => void;
  /** The island Repo's actor door (`wearOf(repo)`'s door): each slot's store writes a worn face's change through it. */
  wear?: FaceActorDoor;
  /**
   * A VIEW THAT TAKES NO WRITE (a cross-face view, `face-engine`): every slot lays read-only, the engine's own temp layer
   * included, and each store the composite hands out refuses a put, a tombstone and a removal (`readOnlyStore`), so no save
   * and no caller holding a store moves a byte. The write-layer pointer still names the working slot, which the read gate
   * reads as the bag the view answers for.
   */
  readOnly?: true;
}

/** The refusal a view's store answers a write with. */
const VIEW_READS = "cross-face-view-reads";

/** A store that reads as `store` reads and refuses every write: a put, a tombstone, a family write and a removal. */
function readOnlyStore(store: LarTiddlerStore, slot: string): LarTiddlerStore {
  const refuse = (): Promise<never> => Promise.reject(Object.assign(new Error(`${VIEW_READS}: ${slot} lays in a cross-face view, which reads alone and takes no write`), { reason: VIEW_READS }));
  const writes = new Set<PropertyKey>(["put", "tombstone", "writeFamily", "remove"]);
  return new Proxy(store, {
    get(target, prop) {
      if (writes.has(prop)) return typeof Reflect.get(target, prop) === "function" ? refuse : undefined;
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/**
 * A composition laid and not yet mounted on an engine: the layers stand in the composite, and each one's store waits for the
 * shore that will mount over it (`mountIslandShore`).
 */
export interface LaidComposition {
  readonly composite: CompositeStore;
  readonly recipe: WikiRecipe;
  readonly stores: ReadonlyArray<{ slot: SlotUri; store: LarTiddlerStore }>;
  readonly tempStore: MemoryTiddlerStore | null;
  /** The slot the wiki's unrouted saves land in, "" where the composer handed no binding for it. */
  readonly writeLayer: string;
}

/**
 * Lay the composition: no engine needed, so it stands before TiddlyWiki boots and wave zero reads it there.
 *
 * Cascade layering: walks `expandRecipe()` in reverse so the lowest-priority
 * slot (oracle, the floor) registers first via `addLayer`. CompositeStore's
 * "first wins" read order matches the slot array's top-first orientation.
 */
export function layIslandComposition(input: LayIslandCompositionInput): LaidComposition {
  const { composite, recipe, ready, floorRecords, writeSlot, readOnly } = input;
  const boundBySlot    = new Map(ready.map((r) => [r.slot, r]));
  const slots          = expandRecipe(recipe);
  const slug           = recipe.wikiSlug;
  const tempSlot       = wikiSlotUri(slug, "temp");
  const flagsOf = (slot: SlotUri): { writable: boolean; defaultWritable: boolean } =>
    readOnly ? { writable: false, defaultWritable: false } : slotLayerFlags(slot, slug, writeSlot);
  /** The store a layer lays: a view's refuses every write. */
  const laid = (store: LarTiddlerStore, slot: SlotUri): LarTiddlerStore => (readOnly ? readOnlyStore(store, slot) : store);
  const stores: Array<{ slot: SlotUri; store: LarTiddlerStore }> = [];

  // Bottom-up addLayer order. Slot at index slots.length-1 (oracle, the floor) lands first.
  let tempStore: MemoryTiddlerStore | null = null;
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i]!;
    if (slot === tempSlot) {
      tempStore = new MemoryTiddlerStore();
      composite.addLayer({ bagId: slot, store: laid(tempStore, slot), ...flagsOf(slot) });
      stores.push({ slot, store: tempStore });
      continue;
    }
    const bound = boundBySlot.get(slot);
    if (!bound) continue; // CRDT slot not provided — skip (cold or unmapped)
    // THE KAHUA SLOT READS THE FOLD: any member of the face writes any tiddler into the stage doc, so the layer serves the
    // verified standing items alone, through the one seam (`kahuaLayerStore`), and never the doc's titles.
    const base: LarTiddlerStore = "store" in bound ? bound.store
      : slot === KAHUA_BAG
        ? kahuaLayerStore(bound.handle, input.kahuaFace ?? (() => null), input.kahuaFaceWatch)
        : new AutomergeDocStore(bound.handle, slot, input.wear ? { wear: input.wear } : {});
    const store = slot === ORACLE_BAG ? floorReadFace({ rows: floorRecords ?? [], base }) : base;
    // Oracle takes no writes; other CRDT slots accept writes through the in-wiki bag-paths cascade
    // (lar:///ha.ka.ba/lararium/config/bag-paths). A ceremony that names its own slot writes the
    // slot's store directly, carrying the bag on the put option — never a field on the record. The
    // default (an unbagged write or tombstone) is the working slot; without its handle no default
    // writable stands. The ONE law `slotLayerFlags` spells for the host mount and this island alike.
    composite.addLayer({ bagId: slot, store: laid(store, slot), ...flagsOf(slot) });
    stores.push({ slot, store });
  }

  // THE SLOTS THE COMPOSER SKIPPED STAND UNREAD. A slot of the recipe the composer handed no binding for (a bag this face does
  // not reach, a library the island does not hold, the kahua stage and daemon document a sibling's engine leaves out) may hold
  // any title, and another face's composition of the same recipe reads it: a delete above it raises a kāpae, never a plain
  // retract (recipe-layer-model#/the-delete). An instance slot with no binding holds no record yet, and temp lives here alone.
  composite.markUnreached(slots, slots.filter((slot) => slot !== tempSlot && !boundBySlot.has(slot) && wikiSlotKindOf(slug, slot) === null));

  // A face that holds no writer's seat in the workbench routes its saves to its own `personal` slot, where that slot stands.
  const writeLayer = boundBySlot.has(defaultWritableSlot(slug, writeSlot)) ? defaultWritableSlot(slug, writeSlot) : "";
  return { composite, recipe, stores, tempStore, writeLayer };
}

/**
 * Mount the shore on a booted engine over a laid composition: the adaptor registers and stands one row per synced title, each
 * seed title's naming its bag (`standFromSeed`, then `start`: TW5's `Syncer.readTiddlerInfo`), the slot pointers seed, the records that wait for boot land through the
 * shore's queue, and the seed checkpoint arms. `seed`, where the engine booted over wave zero, carries what the boot store
 * took; the changes the composition told during the boot (`IslandSeed.release`) land afresh.
 */
export function mountIslandShore(tw5: TW5Engine, laid: LaidComposition, seed: Pick<IslandSeed, "release" | "titles" | "stands" | "waves" | "layerHeads">): {
  adaptor: IslandAdaptor;
  stores: Array<{ slot: SlotUri; store: LarTiddlerStore }>;
} {
  const { composite, recipe, tempStore, writeLayer } = laid;
  const stores = [...laid.stores];
  const slug = recipe.wikiSlug;
  // The titles TW5's own startup pass already ran over the preloads: these never run again.
  const STARTUP_ACTIONS = "[all[shadows+tiddlers]tag[$:/tags/StartupAction]!has[draft.of]]";
  const ranAtBoot = new Set<string>(tw5.$tw.wiki.filterTiddlers(STARTUP_ACTIONS));

  const adaptor = new IslandAdaptor(tw5, composite, recipe.wikiSlug);
  adaptor.installLandingQueue();
  // The books stand before the shore hears anything: a change heard after this lands over the rows, never under them. The seed
  // names its titles' bags; `start` stands every other synced title the boot pass left as landed with no bag, so a boot write
  // to a title no layer holds reads as foam when TW5 tells it, and no hold waits on any checkpoint.
  adaptor.standFromSeed(seed);
  adaptor.start();
  // THE BOOT'S GAP closes here: the seed stops hearing as the shore starts, and hands back what the composition told meanwhile.
  const gap = seed.release();

  // Per-wiki cascade reference — the default `lar:///ha.ka.ba/lararium/config/bag-paths`
  // reads this value via `{lar:///ha.ka.ba/lararium/config/current-wiki-bag}` to
  // resolve `lar:` writes to the wiki's live WRITE LAYER: the per-wiki working slot
  // (`wikis/{slug}/working`, the saved live layer projecting to disk wikis/{slug}); its
  // bags/{slug} canon rides below, published only by a residency MOVE
  // (wiki-layer-ontology#shore-law). A recipe without a working binding has no default
  // writable and seeds an empty write-layer pointer; the daemon attach mounts the slot.
  // Volatile (lives in the per-wiki temp), shadows no writable fallback. The bag-paths cascade reads
  // these to route by prefix to the wiki's OWN per-wiki live layers — the address tells
  // the truth (no global slot names).
  //
  // Pointer and boot-wave seeds share the shore queue. A `then{pointer}` rule dereferences against `$tw.wiki`, and the
  // temp store emits each put when it lands — to every registered projection. The adaptor carries the
  // pointers into the wiki ahead of the seed checkpoint;
  // an empty write-layer pointer makes unrouted saves raise the alert-rail refusal.
  if (tempStore) {
    const configSeed: Record<string, string> = {
      "lar:///ha.ka.ba/lararium/config/current-wiki-bag":      writeLayer,
      "lar:///ha.ka.ba/lararium/config/current-wiki-temp":     wikiSlotUri(slug, "temp"),
      "lar:///ha.ka.ba/lararium/config/current-wiki-draft":    wikiSlotUri(slug, "draft"),
      "lar:///ha.ka.ba/lararium/config/current-wiki-personal": wikiSlotUri(slug, "personal"),
    };
    for (const [title, text] of Object.entries(configSeed)) {
      void tempStore.put({ tiddler: { title, text } }, { kind: "canon-hydrate", receipt: "recipe-boot" });
    }
  }

  // NO LAYER REPLAYS AT MOUNT. MemeProvider's subscribe-then-replay pattern (meme-provider.ts) taught a projection a document's
  // existing state by one replay envelope per record, then `markSyncComplete`: a projection hears only changes. Before wave zero
  // the wiki booted empty, and that replay WAS its load. Wave zero made the load a TW5 preload, and the replay stayed only to fill
  // the shore's books by re-landing every title TW5 already held, painting the seed back over the boot pass's writes on the way.
  // The seed read now stands those books (`standFromSeed`), so each store only flushes its debounces and announces its sync. A
  // layer added after mount (recipe-watch, the face canon after ea) lands its visible delta through the composite
  // (`CompositeStore.addLayer`): only the titles whose topmost record it moves reach the wiki.
  for (const { store } of stores) (store as LarTiddlerStore & { markSyncComplete?: () => void }).markSyncComplete?.();

  // THE RECORDS THAT WAIT FOR BOOT land as waves: boot-set ground the boot store never took, and THE BOOT'S GAP, every change the
  // composition told while the engine booted over wave zero (a record that left every layer leaves the wiki; one that arrived
  // lands).
  const landWaves = (waves: readonly LarTiddlerChange[]): void => { for (const change of waves) adaptor.onUriChanged(change); };
  landWaves([...seed.waves, ...gap]);
  const standing = Promise.resolve();

  // STARTUP ACTIONS RUN, as TiddlyWiki runs them. TW5's own startup pass ran `$:/tags/StartupAction` over the preloads at boot; a
  // startup record that reached the wiki after boot (landed by the seed's waves, or a floor plugin's shadow laid after boot) runs
  // here once the seed stands, the way it would have run had it stood in the boot store.
  //
  // WAVE ZERO REACHES EVERY OBSERVER, IN ONE DISPATCH (lar:///ha.ka.ba/lares/api/pono/nalu: one wave, all observers, one
  // dispatch). The preloads stood before TiddlyWiki's change queue woke, so no `change` listener ever heard them: a dispatch-marked
  // summon the store already held would never reach the reaction router. Once the seed stands, each preloaded title still in
  // the wiki joins one change event; the seed already stood each in the landed ledger, so the bridge reads it as landed, never as
  // a hand.
  const checkpoint = standing.then(() => adaptor.armSeedCheckpoint()).then(() => {
    const tw = tw5.$tw as unknown as { wiki: { filterTiddlers(f: string): string[]; getTiddlerText(t: string): string | undefined; tiddlerExists(t: string): boolean; enqueueTiddlerEvent(title: string, isDeleted?: boolean): void }; rootWidget: { invokeActionString(actions: string, triggeringWidget: unknown, event: unknown, variables: Record<string, string>): void } };
    for (const title of seed.titles) if (tw.wiki.tiddlerExists(title)) tw.wiki.enqueueTiddlerEvent(title, false);
    for (const title of tw.wiki.filterTiddlers(STARTUP_ACTIONS)) {
      if (ranAtBoot.has(title)) continue;
      tw.rootWidget.invokeActionString(tw.wiki.getTiddlerText(title) ?? "", tw.rootWidget, undefined, {});
    }
  });
  seedCheckpoints.set(tw5, checkpoint);
  adaptors.set(tw5, adaptor);

  return { adaptor, stores };
}

/**
 * THE HYDRATION CHECKPOINT. Resolves once the seed wave the shore armed stands in the wiki —
 * the corpus and the slot pointers both. The kernel awaits it between the recipe and `behavior.onEa`, so
 * behavior arms over a wiki the seed reached and its first write finds every slot named. It orders the kernel alone: the
 * shore takes hands from its start. An engine no recipe was
 * built over holds no checkpoint, and asking for one refuses by name: a seed nobody queued must never
 * read as a seed that landed. `breathe` hears each slice the shore's queue lands while the seed drains: the kernel hands
 * its progress tick, so the vessel's watchdog (which bounds the mount on PROGRESS) reads a long drain as moving and still
 * reads a drain that lands nothing as stalled.
 */
export function seedDrained(tw5: TW5Engine, breathe?: () => void): Promise<void> {
  const checkpoint = seedCheckpoints.get(tw5);
  if (!checkpoint) throw new Error("island-recipe: no seed checkpoint stands for this engine — lay, seed, boot and mount before awaiting `seedDrained`");
  if (!breathe) return checkpoint;
  // THE DRAIN BREATHES AS IT WORKS: each slice the shore lands tells `breathe` until the checkpoint settles either way.
  const stop = adaptors.get(tw5)?.onSliceLanded(() => breathe()) ?? (() => {});
  return checkpoint.finally(stop);
}

const seedCheckpoints = new WeakMap<TW5Engine, Promise<void>>();
/** The shore each engine's recipe mounted, so a behavior the island composes reads what the shore landed. */
const adaptors = new WeakMap<TW5Engine, IslandAdaptor>();

/**
 * True where the engine's shore has landed, in the wiki, every change of `bag`'s document up to the heads
 * `named`. An engine whose recipe mounted no shore answers false.
 */
export function wikiLandedCovers(tw5: TW5Engine, bag: string, named: readonly string[]): boolean {
  return adaptors.get(tw5)?.landedCovers(bag, named) ?? false;
}

/**
 * Name the face the next hand of `title` wears on the shore mounted over this engine (`IslandAdaptor.wearNext`): a tool
 * door that lands a record through `wiki.addTiddler` calls this first, so the record lands under the face's actor. An
 * engine whose recipe mounted no shore takes nothing.
 */
export function wikiWearsNext(tw5: object, title: string, face: string | null | undefined): void {
  adaptors.get(tw5 as TW5Engine)?.wearNext(title, face);
}

/** Ask the shore mounted over this engine to take an inbound act boundary. */
export function wikiHandBoundary(tw5: TW5Engine): void {
  void adaptors.get(tw5)?.boundary().catch(() => {});
}

/**
 * The boundary an act closes on: the hands it made land with it. The act's owner applies it to the wiki after the cap
 * that called this returns (the turn the signal rides), and the wiki raises its change on the next tick; the bridge marks
 * each hand inside that dispatch. So this waits out the turn, then the wiki's dispatch, then takes the boundary.
 */
export function wikiHandBoundaryAfterAct(tw5: TW5Engine): void {
  const adaptor = adaptors.get(tw5);
  if (!adaptor) return;
  queueMicrotask(() => {
    void adaptor.awaitWikiDispatch().then(() => adaptor.boundary()).catch(() => {});
  });
}

/** Bind the node-owned recovery projection receipt to this island’s drain. */
export function bindRecoveryAtRest(tw5: TW5Engine, receipt: ((bag: string, title: string, fields: Record<string, unknown> | null) => Promise<void>) | null): void {
  const adaptor = adaptors.get(tw5);
  if (adaptor) adaptor.recoveryAtRest = receipt;
}
