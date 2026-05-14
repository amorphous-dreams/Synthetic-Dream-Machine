/**
 * meme-sync-adaptor — TW5 SyncAdaptor backed by LarTiddlerStore (meme model).
 *
 * Replaces LarariumCrdtSyncAdaptor (sync-adaptor.web2.ts).
 * Key shifts from web2:
 *   - Outbound (Path H): direct handler auto-splits ahu slot bodies into
 *     independent lar:///parent#slot records via splitBodyTiddler; tombstones
 *     any children that disappeared in the re-split. Steady-state edits to
 *     already-split children issue their own saveTiddler calls and fast-path
 *     (no ahu blocks found).
 *   - Inbound: records land in TW5 verbatim as single tiddlers; the
 *     deserializer pre-splits on disk import so inbound children arrive flat.
 *   - Imports buildDirectRecord from meme-write.ts (not carrier-write.ts).
 *
 * Invariants preserved verbatim from web2:
 *   - Echo-loop guard (_applying Map<key, ChangeOrigin>)
 *   - Canon guard: lares/ namespace rejects saveTiddler (no lar:///ha.ka.ba write)
 *   - Temp guard: $:/temp/* and $:/ never synced
 *   - Draft suppression: "Draft of ..." suppressed until M-E island
 *   - Save cascade: corpus-driven write routing via SAVE_CASCADE_URI
 *   - Per-island onSyncComplete buffer flush (single-doc default "automerge")
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-sync-adaptor
 */

import type { LarTiddlerStore, LarTiddlerRecord, LarTiddlerChange, ChangeOrigin, MemeProjection } from "@lararium/core";
import type { TW5Engine } from "./tw5-vm.js";
import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import { buildDirectRecord } from "./meme-write.js";
import { splitBodyTiddler } from "./deserializer.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaveStrategy = "skip" | "direct";
type SaveHandler  = (
  title:  string,
  fields: Record<string, string>,
  origin: ChangeOrigin,
) => Promise<void>;

/** URI of the corpus meme that declares the ordered save-routing rules. */
const SAVE_CASCADE_URI = "lar:///ha.ka.ba/@lararium/tw5/sync/save-cascade";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function isTemp(title: string): boolean      { return title.startsWith("$:/temp/"); }
function isDraft(title: string): boolean     { return title.startsWith("Draft of "); }
function isTW5System(title: string): boolean { return title.startsWith("$:/"); }

/**
 * Normalise a TW5 tiddler argument to a flat Record<string, string>.
 *
 * TW5's saveTiddler receives either:
 *   A) a Tiddler instance — fields nested under `.fields`, other props flat
 *   B) a raw fields object — everything flat at the top level
 * Array-valued fields (e.g. tags) are space-joined.
 */
function extractFields(tiddler: unknown): Record<string, string> {
  if (!tiddler || typeof tiddler !== "object") return {};
  const t   = tiddler as Record<string, unknown>;
  const out: Record<string, string> = {};
  const flatten = (k: string, v: unknown) => {
    if (typeof v === "string")   { out[k] = v; }
    else if (Array.isArray(v))   { out[k] = (v as unknown[]).map(String).join(" "); }
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

// ---------------------------------------------------------------------------
// MemeSyncAdaptor
// ---------------------------------------------------------------------------

export class MemeSyncAdaptor implements MemeProjection {
  readonly name = "lararium-meme";

  /**
   * The bag this adaptor writes to.
   * M-bags: each adaptor instance targets one bag; TW5 recipe stack composes them.
   * Default "room" targets the situated-meaning bag in the current single-doc model.
   */
  readonly targetBag: NonNullable<LarTiddlerRecord["bag"]>;

  /**
   * _applying — active inbound origins during CRDT applies, keyed by apply slot.
   *
   * Non-empty means at least one inbound apply is in progress; saveTiddler /
   * deleteTiddler suppress echoes while the map is non-empty.
   *
   * Key convention:
   *   single-doc:  this.instanceId
   *   M-bags:      edgeIslandId per concurrent doc replay
   *   carrier-child removes: `${instanceId}:carrier-child`
   *
   * Map (not scalar) means concurrent island replays don't interfere.
   */
  private _applying = new Map<string, ChangeOrigin>();

  private _isApplying(): boolean { return this._applying.size > 0; }

  private _pendingModifications = new Set<string>();
  private _pendingDeletions     = new Set<string>();
  private _unsubscribe:   (() => void) | null = null;
  private _unwatchCascade: (() => void) | null = null;

  /**
   * Per-island sync-complete gate and change buffers.
   * Each island buffers inbound changes until onSyncComplete(islandId) fires.
   * Single-doc default: island "automerge".
   */
  private _syncComplete = new Set<string>();
  private _buffer = new Map<string, LarTiddlerChange[]>();

  /** Save cascade rules read from the corpus wiki. Invalidated on cascade-meme change. */
  private _cascadeCache: Array<{ filter: string; strategy: SaveStrategy }> | null = null;

  constructor(
    private readonly tw5:      TW5Engine,
    private readonly store:    LarTiddlerStore,
    readonly instanceId:       string,
    targetBag: NonNullable<LarTiddlerRecord["bag"]> = "room",
  ) {
    this.targetBag = targetBag;
  }

  // ---------------------------------------------------------------------------
  // MemeProjection — inbound CRDT→TW5 direction
  // ---------------------------------------------------------------------------

  /**
   * Called by MemeProvider for each coalesced URI change.
   * Buffered per island until onSyncComplete(islandId) fires; then applied.
   */
  onUriChanged(change: LarTiddlerChange): void {
    // The buffer gate only applies to crdt-remote events — initial Automerge
    // replay coalescing. Local-origin events (tw-local echoes, lares-command
    // ceremonies like promote/draft, canon-hydrate boot fans) must apply
    // immediately so cross-bag writes reach TW5 without waiting on a
    // sync-complete signal that local origins never trigger.
    if (change.origin.kind !== "crdt-remote") {
      this._applyChange(change);
      return;
    }
    const islandId = change.origin.edgeIsland;
    if (!this._syncComplete.has(islandId)) {
      const buf = this._buffer.get(islandId) ?? [];
      buf.push(change);
      this._buffer.set(islandId, buf);
      return;
    }
    this._applyChange(change);
  }

  /**
   * Scale-3 bulk path — called by MemeProvider when >= CHANGESET_THRESHOLD URIs
   * change in one patch. Fetches all records from the store and applies as one
   * TW5 transaction, avoiding N individual onUriChanged debounce callbacks.
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
        if (!rec || rec.deleted) {
          toRemove.push(uri);
          return;
        }
        const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
        if (rec.text !== undefined) fields["text"] = rec.text;
        if (rec.bag) fields["bag"] = rec.bag;
        toAdd.push(fields);
      }));

      for (const title of toRemove) this.tw5.$tw.wiki.deleteTiddler(title);
      if (toAdd.length > 0) _bulkAdd(this.tw5, toAdd);
    } finally {
      this._applying.delete(applyKey);
    }
  }

  /**
   * Fired by MemeProvider after an island's initial Automerge replay settles.
   * Flushes only that island's buffer in one TW5 transaction → one widget
   * refresh per island instead of one per tiddler.
   */
  onSyncComplete(islandId = "automerge"): void {
    this._syncComplete.add(islandId);
    const buf = this._buffer.get(islandId) ?? [];
    this._buffer.delete(islandId);
    if (buf.length === 0) return;

    const toRemove: string[] = [];
    const toAdd: Array<Record<string, string | string[]>> = [];

    const applyKey = islandId;
    this._applying.set(applyKey, { kind: "crdt-remote", edgeIsland: islandId });
    try {
      for (const change of buf) {
        if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) {
          continue;
        }

        if (change.record === null || change.record.deleted) {
          toRemove.push(change.title);
          for (const t of this._childUrisOf(change.title)) toRemove.push(t);
          this._pendingDeletions.add(change.title);
        } else {
          const rec = change.record;
          const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
          if (rec.text !== undefined) fields["text"] = rec.text;
          toAdd.push(fields);
          this._pendingModifications.add(change.title);
        }
      }
    } finally {
      this._applying.delete(applyKey);
    }

    for (const title of toRemove) this.tw5.$tw.wiki.deleteTiddler(title);
    if (toAdd.length > 0) _bulkAdd(this.tw5, toAdd);
  }

  /**
   * Start listening to store changes and subscribe the cascade cache watcher.
   * Registers as MemeProjection when the store supports addProjection(),
   * falling back to store.subscribe() for plain stores.
   */
  start(): () => void {
    if (typeof this.store.addProjection === "function") {
      this._unsubscribe = this.store.addProjection(this);
    } else {
      this._unsubscribe = this.store.subscribe((change) => this._applyChange(change));
    }

    const cascadeHandler = (changes: Record<string, unknown>) => {
      if (SAVE_CASCADE_URI in changes) this._cascadeCache = null;
    };
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
  // Internal — apply a single change to TW5 wiki under echo guard
  // ---------------------------------------------------------------------------

  /** Return all ahu-slot children of `parentUri` currently visible in TW5. */
  private _childUrisOf(parentUri: string): string[] {
    return this.tw5.$tw.wiki.filterTiddlers(`[field:fragment-parent[${parentUri}]]`) as string[];
  }

  private _removeFromTw5(title: string): void {
    const wiki = this.tw5.$tw.wiki;
    wiki.deleteTiddler(title);
    for (const t of this._childUrisOf(title)) wiki.deleteTiddler(t);
    this._pendingDeletions.add(title);
  }

  private _applyLiveRecord(title: string, rec: LarTiddlerRecord): void {
    const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
    if (rec.text !== undefined) fields["text"] = rec.text;
    // Include bag ID so the TW5 wiki carries provenance — disk projector reads
    // this field to find the right mirror without subscribing to Automerge.
    if (rec.bag) fields["bag"] = rec.bag;
    this.tw5.$tw.wiki.addTiddler(new this.tw5.$tw.Tiddler(fields));
    this._pendingModifications.add(title);
  }

  private _applyChange(change: LarTiddlerChange): void {
    if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) return;

    const applyKey = this.instanceId;
    this._applying.set(applyKey, change.origin);
    try {
      if (change.record === null || change.record.deleted) {
        // Cross-bag promotion contract: a tombstone in ONE bag must not wipe
        // TW5 if another layer still holds a live copy. Resolve via the
        // composite's live-walk; only remove when no live record remains.
        // The Promise resolves async; we fire-and-forget to keep _applyChange
        // synchronous (TW5 sync semantics). Concurrent writes for the same
        // URI are protected by the _applying echo guard above.
        const store = this.store as { getLive?: (t: string) => Promise<LarTiddlerRecord | null> };
        if (typeof store.getLive === "function") {
          void store.getLive(change.title).then((live) => {
            if (live) {
              this._applying.set(applyKey, change.origin);
              try { this._applyLiveRecord(change.title, live); }
              finally { this._applying.delete(applyKey); }
            } else {
              this._applying.set(applyKey, change.origin);
              try { this._removeFromTw5(change.title); }
              finally { this._applying.delete(applyKey); }
            }
          });
        } else {
          this._removeFromTw5(change.title);
        }
      } else {
        this._applyLiveRecord(change.title, change.record);
      }
    } finally {
      this._applying.delete(applyKey);
    }
  }

  // ---------------------------------------------------------------------------
  // TW5 SyncAdaptor contract — outbound TW5→CRDT direction
  // ---------------------------------------------------------------------------

  getStatus(
    callback: (err: Error | null, isLoggedIn: boolean, username: string, isReadOnly: boolean, isAnonymous: boolean) => void,
  ): void {
    callback(null, true, "lararium-operator", false, false);
  }

  getTiddlerInfo(_tiddler: unknown): { revision?: string } {
    return { revision: "0" };
  }

  getTiddlerRevision(_title: string): string | undefined {
    return "0";
  }

  getSkinnyTiddlers(
    callback: (err: Error | null, tiddlers: { title: string; revision?: string }[]) => void,
  ): void {
    this.store.listVisible().then((titles) => {
      callback(null, titles.map((title) => ({ title, revision: "0" })));
    }).catch((err: Error) => callback(err, []));
  }

  loadTiddler(
    title:    string,
    callback: (err: Error | null, fields: Record<string, unknown> | null) => void,
  ): void {
    this.store.get(title).then((rec) => {
      if (!rec || rec.deleted) { callback(null, null); return; }
      const fields: Record<string, unknown> = { title: rec.title, ...rec.fields };
      if (rec.text !== undefined) fields["text"] = rec.text;
      callback(null, fields);
    }).catch((err: Error) => callback(err, null));
  }

  saveTiddler(
    tiddler:  unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    if (this._isApplying()) { callback(null, {}, "0"); return; }

    const fields   = extractFields(tiddler);
    const title    = fields["title"] ?? "";
    const strategy = this._resolveSaveStrategy(title);

    if (strategy === "skip") { callback(null, {}, "0"); return; }

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this._saveHandlers[strategy](title, fields, origin)
      .then(() => callback(null, {}, "0"))
      .catch((err: Error) => callback(err, {}, "0"));
  }

  // ---------------------------------------------------------------------------
  // Save cascade — corpus-driven write routing
  // ---------------------------------------------------------------------------

  private _readSaveCascade(): Array<{ filter: string; strategy: SaveStrategy }> {
    if (this._cascadeCache) return this._cascadeCache;
    const ruleTitles: string[] = this.tw5.$tw.wiki.filterTiddlers(
      `[tag[${SAVE_CASCADE_URI}]has[tw5-filter]sort[order]]`,
    );
    this._cascadeCache = ruleTitles.map((t) => {
      const f: TW5TiddlerFields = this.tw5.$tw.wiki.getTiddler?.(t)?.fields ?? ({} as TW5TiddlerFields);
      return {
        filter:   String(f["tw5-filter"]    ?? ""),
        strategy: String(f["save-strategy"] ?? "skip") as SaveStrategy,
      };
    });
    return this._cascadeCache;
  }

  private _resolveSaveStrategy(title: string): SaveStrategy {
    if (isTemp(title) || isTW5System(title)) return "skip";
    if (isDraft(title)) return "skip"; // draft island not yet wired (M-E)

    if (title.startsWith("lar:")) return "direct";

    const wiki = this.tw5.$tw.wiki;
    for (const { filter, strategy } of this._readSaveCascade()) {
      try {
        const result: string[] = wiki.filterTiddlers(`[[${title}]${filter}]`);
        if (result.length > 0) return strategy;
      } catch { /* malformed corpus filter — skip rule */ }
    }
    return "skip";
  }

  private readonly _saveHandlers: Record<SaveStrategy, SaveHandler> = {
    skip: async () => { /* no-op */ },

    /**
     * Meme model direct save — Path H auto-split.
     *
     * If the tiddler body contains `<<~ ahu` blocks, runs splitBodyTiddler so
     * child slot tiddlers materialize in the bag automatically — symmetric with
     * the disk-sync ingest path (ONE parser, FOUR call sites law).
     *
     * Fragment saves (title contains "#") have no embedded ahu blocks by
     * definition — splitBodyTiddler fast-paths them. All paths go through
     * buildDirectRecord for the actual bag record shape.
     */
    direct: async (title, fields, origin) => {
      const bodyText = fields["text"] ?? "";
      const { parent, children } = splitBodyTiddler(title, bodyText, fields);

      await this.store.put(buildDirectRecord(title, parent, this.targetBag), origin);

      if (children.length > 0) {
        const existingChildUris = new Set<string>(this._childUrisOf(title));
        const newChildUris      = new Set<string>();

        for (const child of children) {
          const childTitle = String(child["title"] ?? "");
          if (!childTitle.startsWith("lar:")) continue; // skip parse-warning tiddlers
          newChildUris.add(childTitle);
          await this.store.put(buildDirectRecord(childTitle, child, this.targetBag), origin);
        }

        for (const uri of existingChildUris) {
          if (!newChildUris.has(uri)) await this.store.tombstone(uri, origin);
        }
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Delete path
  // ---------------------------------------------------------------------------

  /**
   * Remove ahu slot child tiddlers from the local TW5 wiki under the echo guard.
   *
   * Uses a dedicated carrier-child key in _applying so the outer apply guard
   * remains active if called during an inbound replay.
   */
  private _removeLocalCarrierChildren(parentUri: string, origin: ChangeOrigin): void {
    const childTitles: string[] = this.tw5.$tw.wiki.filterTiddlers(`[field:fragment-parent[${parentUri}]]`);
    if (childTitles.length === 0) return;
    const childKey = `${this.instanceId}:carrier-child`;
    this._applying.set(childKey, origin);
    try {
      for (const title of childTitles) this.tw5.$tw.wiki.deleteTiddler(title);
    } finally {
      this._applying.delete(childKey);
    }
  }

  deleteTiddler(
    title:    string,
    callback: (err: Error | null) => void,
    _options?: unknown,
  ): void {
    if (this._isApplying())               { callback(null); return; }
    if (isTemp(title) || isTW5System(title)) { callback(null); return; }
    if (!title.startsWith("lar:"))        { callback(null); return; } // drafts suppressed until M-E

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this.store.tombstone(title, origin)
      .then(() => {
        this._removeLocalCarrierChildren(title, origin);
        callback(null);
      })
      .catch(callback);
  }

  /**
   * Report accumulated modifications and deletions to TW5's syncer.
   */
  getUpdatedTiddlers(
    _syncer:  unknown,
    callback: (err: Error | null, updates: { modifications: string[]; deletions: string[] }) => void,
  ): void {
    const modifications = [...this._pendingModifications];
    const deletions     = [...this._pendingDeletions];
    this._pendingModifications.clear();
    this._pendingDeletions.clear();
    callback(null, { modifications, deletions });
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function _bulkAdd(tw5: TW5Engine, batch: Array<Record<string, string | string[]>>): void {
  const wiki    = tw5.$tw.wiki;
  const Tiddler = tw5.$tw.Tiddler;
  const apply   = () => { for (const f of batch) wiki.addTiddler(new Tiddler(f)); };
  if (typeof wiki.transact === "function") wiki.transact(apply); else apply();
}
