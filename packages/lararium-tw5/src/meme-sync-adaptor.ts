/**
 * meme-sync-adaptor — TW5 SyncAdaptor backed by LarTiddlerStore (meme model).
 *
 * Replaces LarariumCrdtSyncAdaptor (sync-adaptor.web2.ts).
 * Key shifts from web2:
 *   - Outbound: no carrier split. In the meme model the tiddler text IS the
 *     canonical source; ahu slot children are independent lar:///parent#slot
 *     records that receive their own saveTiddler calls.
 *   - Inbound: unchanged contract — still calls tw5.deserializeCarrier for
 *     text/x-memetic-wikitext records so inline-body carriers (legacy or
 *     remote peers) hydrate correctly.
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

function isMemeRecord(rec: LarTiddlerRecord, title: string): boolean {
  return rec.text !== undefined &&
    (rec.fields["type"] === "text/x-memetic-wikitext" ||
      rec.fields["content-type"] === "text/x-memetic-wikitext" ||
      (!(rec.fields["type"] || rec.fields["content-type"]) && title.startsWith("lar:")));
}

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
    const islandId = change.origin.kind === "crdt-remote"
      ? change.origin.edgeIsland
      : this.instanceId;
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
          const childTitles = this.tw5.filterTiddlers(`[field:fragment-parent[${uri}]]`);
          for (const t of childTitles) toRemove.push(t);
          return;
        }
        const isMeme = isMemeRecord(rec, uri);
        if (isMeme && rec.text) {
          const staleChildren = this.tw5.filterTiddlers(`[field:fragment-parent[${uri}]]`);
          for (const t of staleChildren) toRemove.push(t);
          const tiddlers = this.tw5.deserializeCarrier(uri, rec.text, rec.fields as Record<string, string | string[]>);
          for (const t of tiddlers) toAdd.push(t as Record<string, string | string[]>);
        } else {
          const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
          if (rec.text !== undefined) fields["text"] = rec.text;
          toAdd.push(fields);
        }
      }));

      for (const title of toRemove) this.tw5.removeTiddler(title);
      if (toAdd.length > 0) this.tw5.bulkSetTiddlers(toAdd);
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
          const childTitles: string[] = this.tw5.filterTiddlers(`[field:fragment-parent[${change.title}]]`);
          for (const t of childTitles) toRemove.push(t);
          this._pendingDeletions.add(change.title);
        } else {
          const rec = change.record;
          const isMeme = isMemeRecord(rec, change.title);

          if (isMeme && rec.text) {
            const staleChildren: string[] = this.tw5.filterTiddlers(`[field:fragment-parent[${change.title}]]`);
            for (const t of staleChildren) toRemove.push(t);
            const tiddlers = this.tw5.deserializeCarrier(
              change.title, rec.text, rec.fields as Record<string, string | string[]>,
            );
            for (const t of tiddlers) toAdd.push(t as Record<string, string | string[]>);
          } else {
            const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
            if (rec.text !== undefined) fields["text"] = rec.text;
            toAdd.push(fields);
          }

          this._pendingModifications.add(change.title);
        }
      }
    } finally {
      this._applying.delete(applyKey);
    }

    for (const title of toRemove) this.tw5.removeTiddler(title);
    if (toAdd.length > 0) this.tw5.bulkSetTiddlers(toAdd);
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

    this._unwatchCascade = this.tw5.onWikiChange((changes) => {
      if (SAVE_CASCADE_URI in changes) this._cascadeCache = null;
    });

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

  private _applyChange(change: LarTiddlerChange): void {
    if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) return;

    const applyKey = this.instanceId;
    this._applying.set(applyKey, change.origin);
    try {
      if (change.record === null || change.record.deleted) {
        this.tw5.removeTiddler(change.title);
        const childTitles: string[] = this.tw5.filterTiddlers(`[field:fragment-parent[${change.title}]]`);
        for (const t of childTitles) this.tw5.removeTiddler(t);
        this._pendingDeletions.add(change.title);
      } else {
        const rec    = change.record;
        const isMeme = isMemeRecord(rec, change.title);

        if (isMeme && rec.text) {
          const staleChildren: string[] = this.tw5.filterTiddlers(`[field:fragment-parent[${change.title}]]`);
          for (const t of staleChildren) this.tw5.removeTiddler(t);
          const tiddlers = this.tw5.deserializeCarrier(
            change.title, rec.text, rec.fields as Record<string, string | string[]>,
          );
          for (const t of tiddlers) this.tw5.setTiddler(t as Record<string, string | string[]>);
        } else {
          const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
          if (rec.text !== undefined) fields["text"] = rec.text;
          this.tw5.setTiddler(fields);
        }

        this._pendingModifications.add(change.title);
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
    const ruleTitles: string[] = this.tw5.filterTiddlers(
      `[tag[${SAVE_CASCADE_URI}]has[tw5-filter]sort[order]]`,
    );
    this._cascadeCache = ruleTitles.map((t) => {
      const f: TW5TiddlerFields = this.tw5.wiki.getTiddler?.(t)?.fields ?? ({} as TW5TiddlerFields);
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

    const wiki = this.tw5.wiki;
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
     * Meme model direct save.
     *
     * In the meme model, ahu slot children live as independent lar:///parent#slot
     * records and receive their own saveTiddler calls — no carrier split needed.
     * Fragment saves (title contains "#") and plain meme saves both go through
     * buildDirectRecord.
     */
    direct: async (title, fields, origin) => {
      await this.store.put(buildDirectRecord(title, fields, this.targetBag), origin);
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
    const childTitles: string[] = this.tw5.filterTiddlers(`[field:fragment-parent[${parentUri}]]`);
    if (childTitles.length === 0) return;
    const childKey = `${this.instanceId}:carrier-child`;
    this._applying.set(childKey, origin);
    try {
      for (const title of childTitles) this.tw5.removeTiddler(title);
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
