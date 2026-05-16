/**
 * island-adaptor — causal-island ↔ TW5 wiki bridge for the Verse polychronous mesh.
 *
 * Architecture law — responsibility split:
 *
 *   IslandAdaptor
 *     inbound:  per-island pre-sync buffer → onSyncComplete() batch flush
 *               non-CRDT origins (tw-local echo, canon-hydrate, lares-command) apply immediately
 *               post-sync crdt-remote: returns — IslandAccumulator (separate MemeProjection) handles
 *     outbound: saveTiddler() → store.put() (direct, no syncer queue)
 *               deleteTiddler() → store.tombstone() (direct)
 *
 *   IslandAccumulator (registered separately via addProjection)
 *     post-sync crdt-remote buffering → drained per rAF frame via flushAccumulator()
 *
 * $tw.syncer does NOT run.  No tiddler in the plugin bundle carries
 * module-type:syncadaptor — $tw.syncadaptor stays undefined at boot.
 * IslandAdaptor wires directly: start() → store.addProjection() / store.subscribe().
 *
 * Preserved invariants:
 *   Echo-loop guard   — _applying Map<key, ChangeOrigin> suppresses outbound during inbound
 *   Canon guard       — lar:///ha.ka.ba/ namespace is read-only (saveTiddler rejects)
 *   Temp guard        — $:/temp/* and $:/ never reach the store
 *   Draft suppression — "Draft of …" suppressed until M-E island
 *   Island isolation  — per-island buffer; each onSyncComplete() fires one wiki.transact()
 *   Child cleanup     — deleteTiddler removes ahu fragment-parent slot children
 *
 * Callers wire:
 *   const adaptor     = new IslandAdaptor(tw5, store, instanceId, targetBag);
 *   const accumulator = new IslandAccumulator();
 *   store.addProjection(adaptor);       // handles pre-sync buffer + non-CRDT
 *   store.addProjection(accumulator);   // handles post-sync crdt-remote
 *
 *   // Per camera: wiki.addEventListener("change", tree.refresh) for widget tree refresh.
 *   // Each camera drives its own drain cycle via CameraRegistration.
 *
 *   // browser (multi-camera):
 *   tw5.startRenderLoop(
 *     [{ accumulator: storyAcc, tickMs: 0, budget: 200 },     // Story River — rAF 60fps
 *      { accumulator: canvasAcc, tickMs: 16, budget: 200 },   // TLDraw canvas — 60fps setInterval
 *      { accumulator: minimapAcc, tickMs: 200, budget: 50 }], // mini-map — 5fps
 *     adaptor,
 *   );
 *   // node:
 *   setInterval(() => adaptor.flushAll([accumulator], 200), 16);
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/island-adaptor
 */

import type {
  LarTiddlerStore,
  LarTiddlerRecord,
  LarTiddlerChange,
  ChangeOrigin,
  MemeProjection,
} from "@lararium/mesh";
import { IslandAccumulator } from "@lararium/mesh";
import type { TW5Engine } from "./tw5-vm.js";
import { buildDirectRecord } from "./meme-write.js";
import { splitBodyTiddler } from "./deserializer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTemp(title: string): boolean      { return title.startsWith("$:/temp/"); }
function isDraft(title: string): boolean     { return title.startsWith("Draft of "); }
function isTW5System(title: string): boolean { return title.startsWith("$:/"); }
function isMemeUri(title: string): boolean   { return title.startsWith("lar:"); }

/**
 * Normalise a TW5 saveTiddler argument to a flat Record<string, string>.
 * TW5 passes either a Tiddler instance (fields nested under .fields) or a plain object.
 */
function extractFields(tiddler: unknown): Record<string, string> {
  if (!tiddler || typeof tiddler !== "object") return {};
  const t = tiddler as Record<string, unknown>;
  const out: Record<string, string> = {};
  const flatten = (k: string, v: unknown) => {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = (v as unknown[]).map(String).join(" ");
  };
  for (const [k, v] of Object.entries(t)) {
    if (k === "fields" && typeof v === "object" && v !== null) {
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) flatten(fk, fv);
    } else {
      flatten(k, v);
    }
  }
  return out;
}

function bulkApply(tw5: TW5Engine, batch: Array<Record<string, string | string[]>>): void {
  const wiki    = tw5.$tw.wiki;
  const Tiddler = tw5.$tw.Tiddler;
  const apply   = () => { for (const f of batch) wiki.addTiddler(new Tiddler(f)); };
  if (typeof wiki.transact === "function") wiki.transact(apply); else apply();
}

// ---------------------------------------------------------------------------
// IslandAdaptor
// ---------------------------------------------------------------------------

export class IslandAdaptor implements MemeProjection {
  readonly name = "lararium-island";

  /** Bag this adaptor targets for outbound writes. */
  readonly targetBag: NonNullable<LarTiddlerRecord["bag"]>;

  /**
   * Echo-loop guard.  Keyed by apply slot so concurrent island replays
   * (M-bags) and carrier-child removes don't interfere.
   *
   *   instanceId              — standard inbound apply
   *   edgeIslandId            — onSyncComplete batch flush
   *   `${instanceId}:acc`     — flushAccumulator frame drain
   *   `${instanceId}:child`   — carrier-child cleanup during deleteTiddler
   */
  private readonly _applying = new Map<string, ChangeOrigin>();
  private _isApplying(): boolean { return this._applying.size > 0; }

  /** Per-island sync-complete gate. */
  private readonly _syncComplete = new Set<string>();
  /** Pre-sync inbound buffer, drained on onSyncComplete(). */
  private readonly _buffer = new Map<string, LarTiddlerChange[]>();

  private _unsubscribe:    (() => void) | null = null;
  private _unwatchCascade: (() => void) | null = null;

  constructor(
    private readonly tw5:   TW5Engine,
    private readonly store: LarTiddlerStore,
    readonly instanceId:    string,
    targetBag: NonNullable<LarTiddlerRecord["bag"]> = "room",
  ) {
    this.targetBag = targetBag;
  }

  // ---------------------------------------------------------------------------
  // MemeProjection — inbound CRDT→TW5
  // ---------------------------------------------------------------------------

  /**
   * Inbound URI change from MemeProvider.
   *
   *   crdt-remote + pre-sync  → buffer per island (onSyncComplete flushes)
   *   crdt-remote + post-sync → return; IslandAccumulator owns this path
   *   all other origins       → apply immediately (echo-guarded)
   */
  onUriChanged(change: LarTiddlerChange): void {
    if (change.origin.kind !== "crdt-remote") {
      this._applyChange(change);
      return;
    }
    const islandId = change.origin.edgeIsland;
    if (this._syncComplete.has(islandId)) return; // IslandAccumulator handles post-sync
    const buf = this._buffer.get(islandId) ?? [];
    buf.push(change);
    this._buffer.set(islandId, buf);
  }

  /**
   * Scale-3 bulk inbound path — fires when MemeProvider coalesces a large patch
   * (>= CHANGESET_THRESHOLD URIs).  Fetches all records from the store and
   * applies as one wiki.transact() to produce a single widget refresh pass.
   */
  async onChangeset(uris: ReadonlySet<string>, origin: ChangeOrigin): Promise<void> {
    if (this._isApplying()) return;
    const applyKey = `changeset:${origin.kind}`;
    this._applying.set(applyKey, origin);
    try {
      const toRemove: string[] = [];
      const toAdd: Array<Record<string, string | string[]>> = [];

      await Promise.all(Array.from(uris).map(async (uri) => {
        const rec = await this.store.get(uri);
        if (!rec || rec.deleted) { toRemove.push(uri); return; }
        const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
        if (rec.text !== undefined) fields["text"] = rec.text;
        if (rec.bag)  fields["bag"]  = rec.bag;
        toAdd.push(fields);
      }));

      const wiki = this.tw5.$tw.wiki;
      for (const title of toRemove) wiki.deleteTiddler(title);
      if (toAdd.length > 0) bulkApply(this.tw5, toAdd);
    } finally {
      this._applying.delete(applyKey);
    }
  }

  /**
   * Island initial-sync settled.  Drains the island's buffer in one
   * wiki.transact() — one widget refresh pass per island.
   */
  onSyncComplete(islandId = "automerge"): void {
    this._syncComplete.add(islandId);
    const buf = this._buffer.get(islandId) ?? [];
    this._buffer.delete(islandId);
    if (buf.length === 0) return;

    const toRemove: string[] = [];
    const toAdd: Array<Record<string, string | string[]>> = [];

    for (const change of buf) {
      // Suppress own tw-local echoes that arrived before sync settled.
      if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) continue;

      if (change.record === null || change.record.deleted) {
        toRemove.push(change.title);
        for (const t of this._childUrisOf(change.title)) toRemove.push(t);
      } else {
        const rec = change.record;
        const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
        if (rec.text !== undefined) fields["text"] = rec.text;
        if (rec.bag) fields["bag"] = rec.bag;
        toAdd.push(fields);
      }
    }

    const applyKey = islandId;
    this._applying.set(applyKey, { kind: "crdt-remote", edgeIsland: islandId });
    try {
      const wiki = this.tw5.$tw.wiki;
      for (const title of toRemove) wiki.deleteTiddler(title);
      if (toAdd.length > 0) bulkApply(this.tw5, toAdd);
    } finally {
      this._applying.delete(applyKey);
    }
  }

  // ---------------------------------------------------------------------------
  // Render-loop integration — IslandAccumulator drain
  // ---------------------------------------------------------------------------

  /**
   * Drain N accumulators in recipe priority order (index 0 = lowest bag priority,
   * last index = highest).  Shares `budget` total patches across all accumulators —
   * stops when the frame budget exhausts, carries remainder to the next tick.
   * Each non-empty accumulator drains into one wiki.transact() block.
   *
   * Called per rAF frame by TW5Engine.startRenderLoop() (browser) or a
   * setInterval driver (Node).
   */
  flushAll(accs: IslandAccumulator[], budget = 200): void {
    let remaining = budget;
    for (const acc of accs) {
      if (remaining <= 0) break;
      const batch = acc.drain(remaining);
      if (batch.length === 0) continue;
      remaining -= batch.length;
      this._applyBatch(batch);
    }
  }

  /** Single-accumulator convenience — delegates to flushAll. */
  flushAccumulator(acc: IslandAccumulator, budget = 200): void {
    this.flushAll([acc], budget);
  }

  private _applyBatch(batch: LarTiddlerChange[]): void {
    const applyKey = `${this.instanceId}:acc`;
    const origin: ChangeOrigin = { kind: "crdt-remote", edgeIsland: "automerge" };
    this._applying.set(applyKey, origin);
    try {
      const wiki    = this.tw5.$tw.wiki;
      const Tiddler = this.tw5.$tw.Tiddler;
      const apply = () => {
        for (const change of batch) {
          if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) continue;
          if (change.record === null || change.record.deleted) {
            wiki.deleteTiddler(change.title);
            for (const t of this._childUrisOf(change.title)) wiki.deleteTiddler(t);
          } else {
            const rec = change.record;
            const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
            if (rec.text !== undefined) fields["text"] = rec.text;
            if (rec.bag) fields["bag"] = rec.bag;
            wiki.addTiddler(new Tiddler(fields));
          }
        }
      };
      if (typeof wiki.transact === "function") wiki.transact(apply); else apply();
    } finally {
      this._applying.delete(applyKey);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): () => void {
    if (typeof this.store.addProjection === "function") {
      this._unsubscribe = this.store.addProjection(this);
    } else {
      this._unsubscribe = this.store.subscribe((change) => this._applyChange(change));
    }

    // Invalidate the wiki-change listener for cascade-cache (outbound routing).
    const cascadeHandler = () => { /* no cascade cache in this implementation */ };
    this.tw5.$tw.wiki.addEventListener("change", cascadeHandler);
    this._unwatchCascade = () => this.tw5.$tw.wiki.removeEventListener("change", cascadeHandler);

    return () => this.stop();
  }

  stop(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._unwatchCascade?.();
    this._unwatchCascade = null;
  }

  // ---------------------------------------------------------------------------
  // Outbound TW5→CRDT
  // ---------------------------------------------------------------------------

  /**
   * TW5 wiki edit → bag write.
   *
   * Guards:
   *   - Echo-loop: _applying active → skip (inbound apply in progress)
   *   - Temp guard: $:/temp/* → skip
   *   - System guard: $:/ → skip
   *   - Draft suppression: "Draft of …" → skip (M-E island not yet wired)
   *   - Canon guard: lar:///ha.ka.ba/ → skip (corpus is read-only)
   *   - Meme URI gate: only lar: URIs reach the store
   *
   * Path H auto-split: if the body contains <<~ ahu blocks, splitBodyTiddler()
   * materialises child slot tiddlers in the bag (ONE parser, FOUR call sites law).
   */
  saveTiddler(
    tiddler:  unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    if (this._isApplying()) { callback(null, {}, "0"); return; }

    const fields = extractFields(tiddler);
    const title  = fields["title"] ?? "";

    if (isTemp(title) || isTW5System(title)) { callback(null, {}, "0"); return; }
    if (isDraft(title))                      { callback(null, {}, "0"); return; }
    if (!isMemeUri(title))                   { callback(null, {}, "0"); return; }

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this._writeMeme(title, fields, origin)
      .then(() => callback(null, {}, "0"))
      .catch((err: Error) => callback(err, {}, "0"));
  }

  deleteTiddler(
    title:    string,
    callback: (err: Error | null) => void,
    _options?: unknown,
  ): void {
    if (this._isApplying())               { callback(null); return; }
    if (isTemp(title) || isTW5System(title)) { callback(null); return; }
    if (!isMemeUri(title))                { callback(null); return; }

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this.store.tombstone(title, origin)
      .then(() => {
        this._removeSlotChildren(title, origin);
        callback(null);
      })
      .catch(callback);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _childUrisOf(parentUri: string): string[] {
    return this.tw5.$tw.wiki.filterTiddlers(`[field:fragment-parent[${parentUri}]]`) as string[];
  }

  private _removeFromTw5(title: string): void {
    const wiki = this.tw5.$tw.wiki;
    wiki.deleteTiddler(title);
    for (const t of this._childUrisOf(title)) wiki.deleteTiddler(t);
  }

  private _applyLiveRecord(rec: LarTiddlerRecord): void {
    const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
    if (rec.text !== undefined) fields["text"] = rec.text;
    if (rec.bag)  fields["bag"]  = rec.bag;
    this.tw5.$tw.wiki.addTiddler(new this.tw5.$tw.Tiddler(fields));
  }

  private _applyChange(change: LarTiddlerChange): void {
    if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) return;

    const applyKey = this.instanceId;
    this._applying.set(applyKey, change.origin);
    try {
      if (change.record === null || change.record.deleted) {
        // Cross-bag tombstone: only wipe TW5 when no live copy remains anywhere in the recipe.
        const store = this.store as { getLive?: (t: string) => Promise<LarTiddlerRecord | null> };
        if (typeof store.getLive === "function") {
          void store.getLive(change.title).then((live) => {
            const key = this.instanceId;
            this._applying.set(key, change.origin);
            try { live ? this._applyLiveRecord(live) : this._removeFromTw5(change.title); }
            finally { this._applying.delete(key); }
          });
        } else {
          this._removeFromTw5(change.title);
        }
      } else {
        this._applyLiveRecord(change.record);
      }
    } finally {
      this._applying.delete(applyKey);
    }
  }

  /** Remove ahu-slot child tiddlers from TW5 under the echo guard. */
  private _removeSlotChildren(parentUri: string, origin: ChangeOrigin): void {
    const children = this.tw5.$tw.wiki.filterTiddlers(`[field:fragment-parent[${parentUri}]]`);
    if (children.length === 0) return;
    const childKey = `${this.instanceId}:child`;
    this._applying.set(childKey, origin);
    try { for (const t of children) this.tw5.$tw.wiki.deleteTiddler(t); }
    finally { this._applying.delete(childKey); }
  }

  /**
   * Write a lar: URI to the store.  Splits ahu fragment-parent blocks first
   * (Path H auto-split).  Tombstones orphaned slot children.
   */
  private async _writeMeme(
    title:  string,
    fields: Record<string, string>,
    origin: ChangeOrigin,
  ): Promise<void> {
    const bodyText = fields["text"] ?? "";
    const { parent, children } = splitBodyTiddler(title, bodyText, fields);

    await this.store.put(buildDirectRecord(title, parent, this.targetBag), origin);

    if (children.length > 0) {
      const existingChildren = new Set<string>(this._childUrisOf(title));
      const newChildren      = new Set<string>();

      for (const child of children) {
        const childTitle = String(child["title"] ?? "");
        if (!childTitle.startsWith("lar:")) continue;
        newChildren.add(childTitle);
        await this.store.put(buildDirectRecord(childTitle, child, this.targetBag), origin);
      }

      for (const uri of existingChildren) {
        if (!newChildren.has(uri)) await this.store.tombstone(uri, origin);
      }
    }
  }
}
