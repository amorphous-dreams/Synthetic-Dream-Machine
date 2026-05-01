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

export interface CompositeLayer {
  readonly bagId:    string;
  readonly store:    LarTiddlerStore;
  readonly writable: boolean;
}

export class CompositeStore implements LarTiddlerStore {
  // Ordered lowest-priority → highest-priority.
  private readonly layers:   CompositeLayer[] = [];
  private readonly listeners: Set<(change: LarTiddlerChange) => void> = new Set();
  private readonly unsubs:   Map<LarTiddlerStore, () => void> = new Map();

  /** The single writable store — must be registered via addLayer with writable:true. */
  private writableStore: LarTiddlerStore | null = null;

  addLayer(layer: CompositeLayer): void {
    this.layers.push(layer);
    if (layer.writable) this.writableStore = layer.store;

    // Forward future change events from this layer to our subscribers.
    const unsub = layer.store.subscribe((change) => {
      this.listeners.forEach((fn) => fn(change));
    });
    this.unsubs.set(layer.store, unsub);

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

  get layerCount(): number { return this.layers.length; }
  get layerIds(): string[] { return this.layers.map((l) => l.bagId); }
}
