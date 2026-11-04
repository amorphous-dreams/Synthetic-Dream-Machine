/**
 * island-recipe — one-model assembly for sovereign islands.
 *
 * Canonical assembly:
 *   1) `expandRecipe(recipe)` → ordered slot URIs (top of array = highest priority)
 *   2) addLayer for each slot in cascade order (bottom-up): oracle floor first, temp last
 *   3) temp uses memory, oracle wraps its seed store with the floor read-face, the kahua slot reads the stage's fold under
 *      the face (`kahuaStageStore`), and other slots use AutomergeDocStore
 *   4) IslandAdaptor projection registers
 *   5) initial replay enters the shore landing queue; its checkpoint resolves when that queue empties
 *
 * Node and browser sovereign workers both call this helper so recipe behavior
 * stays one shape across platforms.
 */

import {
  CompositeStore,
  AutomergeDocStore,
  defaultWritableSlot,
  expandRecipe,
  slotLayerFlags,
  wikiSlotUri,
  ORACLE_BAG,
  KAHUA_BAG,
  floorReadFace,
  type KahuaStageFace,
  type LarDoc,
  type DocHandle,
  type WikiRecipe,
  type SlotUri,
  type LarTiddlerRecord,
  type LarTiddlerStore,
} from "@lararium/mesh";
import { IslandAdaptor } from "./island-adaptor.js";
import { kahuaLayerStore } from "./kahua-layer.js";
import { MemoryTiddlerStore } from "./memory-store.js";
import type { TW5Engine } from "./tw5-vm.js";

export interface RecipeReadyBinding {
  /** Slot URI from the expanded recipe. */
  slot: SlotUri;
  handle: DocHandle<LarDoc>;
}

export interface BuildIslandRecipeInput {
  tw5: TW5Engine;
  composite: CompositeStore;
  recipe: WikiRecipe;
  /** Resolved CRDT handles keyed by slot URI. temp has no entry. */
  ready: readonly RecipeReadyBinding[];
  /** Pinned system snapshots beneath the live oracle seed. */
  floorRows?: readonly Readonly<Record<string, LarTiddlerRecord>>[];
  /** The face the kahua stage reads under; absent or null, the kahua layer stands empty. */
  kahuaFace?: () => KahuaStageFace | null;
  /** Wakes the kahua layer's re-fold when the face's lineage moves (`liveKahuaFace`). */
  kahuaFaceWatch?: (fn: () => void) => () => void;
}

/**
 * Build the sovereign island recipe and return the adaptor.
 *
 * Cascade layering: walks `expandRecipe()` in reverse so the lowest-priority
 * slot (oracle, the floor) registers first via `addLayer`. CompositeStore's
 * "first wins" read order matches the slot array's top-first orientation.
 */
export function buildIslandRecipe(input: BuildIslandRecipeInput): {
  adaptor: IslandAdaptor;
  stores: Array<{ slot: SlotUri; store: LarTiddlerStore }>;
} {
  const { tw5, composite, recipe, ready, floorRows } = input;
  // The titles TW5's own startup pass already ran over the preloads: these never run again.
  const STARTUP_ACTIONS = "[all[shadows+tiddlers]tag[$:/tags/StartupAction]!has[draft.of]]";
  const ranAtBoot = new Set<string>(tw5.$tw.wiki.filterTiddlers(STARTUP_ACTIONS));

  const handleBySlot   = new Map(ready.map((r) => [r.slot, r.handle]));
  const slots          = expandRecipe(recipe);
  const slug           = recipe.wikiSlug;
  const tempSlot       = wikiSlotUri(slug, "temp");
  const stores: Array<{ slot: SlotUri; store: LarTiddlerStore }> = [];

  // Bottom-up addLayer order. Slot at index slots.length-1 (oracle, the floor) lands first.
  let tempStore: MemoryTiddlerStore | null = null;
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i]!;
    if (slot === tempSlot) {
      tempStore = new MemoryTiddlerStore();
      composite.addLayer({ bagId: slot, store: tempStore, ...slotLayerFlags(slot, slug) });
      stores.push({ slot, store: tempStore });
      continue;
    }
    const handle = handleBySlot.get(slot);
    if (!handle) continue; // CRDT slot not provided — skip (cold or unmapped)
    // THE KAHUA SLOT READS THE FOLD: any member of the face writes any tiddler into the stage doc, so the layer serves the
    // verified standing items alone, through the one seam (`kahuaLayerStore`), and never the doc's titles.
    const base: LarTiddlerStore = slot === KAHUA_BAG
      ? kahuaLayerStore(handle, input.kahuaFace ?? (() => null), input.kahuaFaceWatch)
      : new AutomergeDocStore(handle, slot);
    const store = slot === ORACLE_BAG ? floorReadFace({ rows: floorRows ?? [], base }) : base;
    // Oracle takes no writes; other CRDT slots accept writes through the in-wiki bag-paths cascade
    // (lar:///ha.ka.ba/lararium/config/bag-paths). A ceremony that names its own slot writes the
    // slot's store directly, carrying the bag on the put option — never a field on the record. The
    // default (an unbagged write or tombstone) is the working slot; without its handle no default
    // writable stands. The ONE law `slotLayerFlags` spells for the host mount and this island alike.
    composite.addLayer({ bagId: slot, store, ...slotLayerFlags(slot, slug) });
    stores.push({ slot, store });
  }

  const adaptor = new IslandAdaptor(tw5, composite, recipe.wikiSlug);
  adaptor.installLandingQueue();
  adaptor.start();

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
  // Pointer and corpus seeds share the shore queue. A `then{pointer}` rule dereferences against `$tw.wiki`, and the
  // temp store emits each put when it lands — to every registered projection. The adaptor carries the
  // pointers into the wiki on the same seed wave as the corpus, ahead of the seed checkpoint;
  // an empty write-layer pointer makes unrouted saves raise the alert-rail refusal.
  if (tempStore) {
    const writeLayer = handleBySlot.has(wikiSlotUri(slug, "working")) ? defaultWritableSlot(slug) : "";
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

  // Drive existing CRDT state through the projection bus → adaptor → shore queue.
  for (const { store } of stores) {
    const replays = store as LarTiddlerStore & { emitInitialReplay?: () => void; markSyncComplete?: () => void };
    if (store instanceof AutomergeDocStore || typeof replays.emitInitialReplay === "function") {
      replays.emitInitialReplay?.();
      replays.markSyncComplete?.();
    }
  }

  // TW5 ran `$:/tags/StartupAction` over the preloads alone, before any record landed. The seed carries
  // the bags' own startup actions, so each one the boot pass never saw runs once over the resident seed;
  // the ones that already ran stay run.
  const checkpoint = adaptor.armSeedCheckpoint().then(() => {
    const tw = tw5.$tw as unknown as { wiki: { filterTiddlers(f: string): string[]; getTiddlerText(t: string): string | undefined; getTiddler(t: string): { fields: Record<string, unknown> } | undefined }; rootWidget: { invokeActionString(actions: string, triggeringWidget: unknown, event: unknown, variables: Record<string, string>): void } };
    for (const title of tw.wiki.filterTiddlers(STARTUP_ACTIONS)) {
      if (ranAtBoot.has(title)) continue;
      // A StartupAction lifted from the kahua stage stays inert data: it carries `kahua-cid`, and only a promotion puts a rite among the
      // preloads, where the boot pass above ran it. The seed pass never runs code a hand has not promoted.
      if (tw.wiki.getTiddler(title)?.fields["kahua-cid"] !== undefined) continue;
      tw.rootWidget.invokeActionString(tw.wiki.getTiddlerText(title) ?? "", tw.rootWidget, undefined, {});
    }
  });
  seedCheckpoints.set(tw5, checkpoint);
  adaptors.set(tw5, adaptor);

  return { adaptor, stores };
}

/**
 * THE HYDRATION CHECKPOINT. Resolves once the seed wave `buildIslandRecipe` armed stands in the wiki —
 * the corpus and the slot pointers both. The kernel awaits it between the recipe and `behavior.onEa`, so
 * behavior arms over a resident seed and its first write finds every slot named. An engine no recipe was
 * built over holds no checkpoint, and asking for one refuses by name: a seed nobody queued must never
 * read as a seed that landed.
 */
export function seedDrained(tw5: TW5Engine): Promise<void> {
  const checkpoint = seedCheckpoints.get(tw5);
  if (!checkpoint) throw new Error("island-recipe: no seed checkpoint stands for this engine — build its recipe (`buildIslandRecipe`) before awaiting `seedDrained`");
  return checkpoint;
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
