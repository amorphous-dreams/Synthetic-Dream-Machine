/**
 * CompositeStore — recipe-ordered overlay of LarTiddlerStore layers.
 *
 * Layers ordered lowest → highest priority (room overrides corpus overrides core).
 * Standard TW5 recipe law: same title in multiple bags → highest priority bag wins.
 *
 * Put/tombstone always route to the designated writable store (room bag by default).
 * Read paths (get, listVisible) fan out across all layers; highest priority wins.
 * Subscribe fans out to all layers; callers must check origin to avoid echo loops.
 *
 * Layers may be added dynamically after construction — corpus islands arrive async.
 * Callers should subscribe BEFORE addLayer to ensure no change events are missed,
 * or trigger a refresh after addLayer returns.
 */

import type {
  LarTiddlerStore,
  LarTiddlerRecord,
  LarTiddlerChange,
  ChangeOrigin,
} from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
import {
  LARARIUM_DOC_URI,
  CATALOG_DOC_URI,
  LARES_DOC_URI,
  IDENTITIES_DOC_URI,
  GROUPS_DOC_URI,
  SESSIONS_DOC_URI,
  corpusLarUri,
  roomLarUri,
} from "./lararium-doc.js";
import type { RecipeTiddler } from "./recipe.js";
import { parseBagStack, parsePlugins } from "./recipe.js";

// Re-export so callers get bag IDs and URI helpers from a single import.
export { corpusLarUri as corpusBagId, roomLarUri as roomBagId };

// ---------------------------------------------------------------------------
// Well-known bag slot IDs — six root docs (two planes) + corpus leaves + room
//
// Bag ID = lar: URI of the owning Automerge doc. One doc = one bag = one URI.
//
// Recipe order (add lowest-priority first → highest-priority last):
//
//   CONTENT PLANE (Tiga)
//   LARARIUM_DOC_URI   ha: engine, grammar, oracle tiddlers
//   CATALOG_DOC_URI    ka: corpus discovery, room oracle tiddlers
//   LARES_DOC_URI      ba: persona/doctrine system memes
//
//   SOCIAL PLANE
//   IDENTITIES_DOC_URI principals: operators, agents, services
//   GROUPS_DOC_URI     collective authority + durable membership
//   SESSIONS_DOC_URI   live operator-agent session docs
//
//   LEAVES (added dynamically)
//   corpusLarUri(slug) lar:///ha.ka.ba/@catalog/@{slug}  corpus child-docs
//   roomLarUri(slug)   lar:///ha.ka.ba/@lararium/rooms/{slug}  room leaf
//   "draft"            high-churn drafts — stable lar: URI pending (M22)
//   "projection"       derived tiddlers / search indexes — in-memory only
//
// Meme: lar:///ha.ka.ba/@lararium/core/v0.1/automerge-tiga
// ---------------------------------------------------------------------------

export const BAG_IDS = {
  lararium:   LARARIUM_DOC_URI,
  catalog:    CATALOG_DOC_URI,
  lares:      LARES_DOC_URI,
  identities: IDENTITIES_DOC_URI,
  groups:     GROUPS_DOC_URI,
  sessions:   SESSIONS_DOC_URI,
  draft:      "draft",
  projection: "projection",
} as const;

export interface CompositeLayer {
  readonly bagId:        string;
  readonly store:        LarTiddlerStore;
  readonly writable:     boolean;
  /**
   * Optional read-access policy expression from the bag's BagTiddler descriptor.
   * Carried here so callers can inspect policy without another tiddler lookup.
   * Default interpretation: "public" when absent.
   */
  readonly readPolicy?:  string;
  /**
   * Optional write-access policy expression from the bag's BagTiddler descriptor.
   * Default interpretation: derived from `writable` flag when absent.
   */
  readonly writePolicy?: string;
}

export class CompositeStore implements LarTiddlerStore {
  // Ordered lowest-priority → highest-priority.
  private readonly layers:      CompositeLayer[] = [];
  private readonly listeners:   Set<(change: LarTiddlerChange) => void> = new Set();
  private readonly unsubs:      Map<LarTiddlerStore, () => void> = new Map();
  /** Active projections — fanned to every layer and to layers added in the future. */
  private readonly projections: Map<MemeProjection, Array<() => void>> = new Map();

  /** The single writable store — must be registered via addLayer with writable:true. */
  private writableStore: LarTiddlerStore | null = null;

  hasBag(bagId: string): boolean {
    return this.layers.some((l) => l.bagId === bagId);
  }

  addLayer(layer: CompositeLayer): void {
    if (this.hasBag(layer.bagId)) throw new Error(`CompositeStore: bag "${layer.bagId}" already registered`);
    this.layers.push(layer);
    if (layer.writable) this.writableStore = layer.store;

    // Forward future change events from this layer to our subscribers.
    const unsub = layer.store.subscribe((change) => {
      this.listeners.forEach((fn) => fn(change));
    });
    this.unsubs.set(layer.store, unsub);

    // Fan any active projections to this new layer (dynamic registration law).
    for (const [projection, unsubs] of this.projections) {
      const layerUnsub = typeof layer.store.addProjection === "function"
        ? layer.store.addProjection(projection)
        : layer.store.subscribe((change) => projection.onUriChanged(change));
      unsubs.push(layerUnsub);
    }

    // Emit synthetic "put" events for tiddlers already in the arriving layer
    // so subscribers (e.g. LarariumCrdtSyncAdaptor) see existing content.
    if (this.listeners.size > 0) {
      layer.store.listVisible().then((titles) => {
        for (const title of titles) {
          layer.store.get(title).then((rec) => {
            if (!rec) return;
            const change: LarTiddlerChange = { title, record: rec, origin: { kind: "canon-hydrate", receipt: layer.bagId } };
            this.listeners.forEach((fn) => fn(change));
          });
        }
      });
    }
  }

  removeLayer(bagId: string): void {
    const idx = this.layers.findIndex((l) => l.bagId === bagId);
    if (idx === -1) return;
    const removed = this.layers.splice(idx, 1)[0];
    if (!removed) return;
    this.unsubs.get(removed.store)?.();
    this.unsubs.delete(removed.store);
    if (this.writableStore === removed.store) this.writableStore = null;
  }

  // ---------------------------------------------------------------------------
  // LarTiddlerStore impl
  // ---------------------------------------------------------------------------

  async listVisible(): Promise<string[]> {
    // Iterate from highest to lowest priority, deduplicating by title.
    const seen = new Set<string>();
    const result: string[] = [];
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const titles = await this.layers[i]!.store.listVisible();
      for (const t of titles) {
        if (!seen.has(t)) { seen.add(t); result.push(t); }
      }
    }
    return result;
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    // Highest priority first.
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const rec = await this.layers[i]!.store.get(title);
      if (rec !== null) return rec;
    }
    return null;
  }

  async put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> {
    // Route to the layer whose bagId matches record.bag (if that layer is writable).
    // Falls back to writableStore (last registered writable) for unbagged records.
    if (record.bag) {
      const bagLayer = this.layers.find((l) => l.bagId === record.bag && l.writable);
      if (bagLayer) return bagLayer.store.put(record, origin);
    }
    if (!this.writableStore) throw new Error("CompositeStore: no writable layer registered");
    return this.writableStore.put(record, origin);
  }

  async tombstone(title: string, origin: ChangeOrigin): Promise<void> {
    if (!this.writableStore) throw new Error("CompositeStore: no writable layer registered");
    return this.writableStore.tombstone(title, origin);
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /**
   * Register a MemeProjection across all layers.
   *
   * Fans the projection to each layer's `addProjection?` (AutomergeDocStore
   * routes through MemeProvider — debounce, changeset, onSyncComplete).
   * Layers without `addProjection` fall back to their plain `subscribe()`.
   *
   * Returns a combined unsubscribe function.
   *
   * Causal-islands law: each island (doc) delivers changes through its own
   * MemeProvider so debounce and onSyncComplete remain per-island — a slow
   * corpus island cannot gate a fast room island.
   */
  addProjection(p: MemeProjection): () => void {
    const unsubs: Array<() => void> = this.layers.map((layer) =>
      typeof layer.store.addProjection === "function"
        ? layer.store.addProjection(p)
        : layer.store.subscribe((change) => p.onUriChanged(change)),
    );
    // Store so future addLayer() calls fan this projection to new layers.
    this.projections.set(p, unsubs);
    return () => {
      for (const u of unsubs) u();
      this.projections.delete(p);
    };
  }

  get layerCount(): number { return this.layers.length; }
  get layerIds(): string[] { return this.layers.map((l) => l.bagId); }

  // ---------------------------------------------------------------------------
  // Recipe helpers — topology-derived VM support
  // ---------------------------------------------------------------------------

  /**
   * Read a RecipeTiddler from the composite store by its lar: URI.
   *
   * Returns null if the tiddler does not exist, was tombstoned, or has no
   * parseable bagStack field.  Reads from the highest-priority layer that
   * holds the tiddler (standard CompositeStore read semantics).
   *
   * Recipe tiddlers arrive via MemeSyncAdaptor from the ha island.  Call this
   * method after the peer boot sequence completes so ha is already in the store.
   *
   * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/recipe
   */
  async getRecipe(uri: string): Promise<RecipeTiddler | null> {
    const rec = await this.get(uri);
    if (!rec || rec.deleted) return null;
    const bagStack = parseBagStack(rec.fields["bagStack"]);
    if (bagStack.length === 0) return null;
    const writableBag = rec.fields["writableBag"] as string | undefined;
    const plugins = parsePlugins(rec.fields["plugins"]);
    return {
      title:     rec.title,
      label:     (rec.fields["label"] as string) ?? rec.title,
      bagStack,
      ...(writableBag !== undefined ? { writableBag } : {}),
      ...(plugins.length > 0 ? { plugins } : {}),
      updatedAt: (rec.fields["updatedAt"] as string) ?? new Date().toISOString(),
      authority: (rec.fields["authority"] as string) ?? "unknown",
      bag:       (rec.fields["bag"] as string) ?? "",
    };
  }

  /**
   * Return the subset of registered layers whose bagId appears in the recipe's
   * bagStack, ordered lowest → highest priority (bagStack order).
   *
   * Layers not yet registered (corpus docs arriving async) are silently omitted.
   * Callers may call this again after corpus bags attach to get the full set.
   *
   * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/recipe
   */
  buildLayersFromRecipe(recipe: RecipeTiddler): CompositeLayer[] {
    const result: CompositeLayer[] = [];
    for (const bagId of recipe.bagStack) {
      const layer = this.layers.find((l) => l.bagId === bagId);
      if (layer) result.push(layer);
    }
    return result;
  }

  /**
   * Route a put() through the recipe's declared `writableBag`.
   *
   * TW5 Bags and Recipes law: writes in a recipe target the designated writable
   * bag, not an arbitrary registered layer.  This method enforces that law.
   *
   * Falls back to `this.put(record, origin)` (default writable store) when the
   * recipe declares no `writableBag` — safe for read-only recipes like "default".
   *
   * Throws if `writableBag` is declared but the layer is not registered or is not
   * marked writable — indicating a boot-sequence ordering error.
   *
   * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/recipe
   */
  async putViaRecipe(recipe: RecipeTiddler, record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> {
    if (!recipe.writableBag) {
      return this.put(record, origin);
    }
    const layer = this.layers.find((l) => l.bagId === recipe.writableBag && l.writable);
    if (!layer) {
      throw new Error(
        `CompositeStore: recipe writableBag "${recipe.writableBag}" not registered or not writable`,
      );
    }
    return layer.store.put(record, origin);
  }
}
