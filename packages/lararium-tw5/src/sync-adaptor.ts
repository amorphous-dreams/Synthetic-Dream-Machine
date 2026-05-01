/**
 * LarariumCrdtSyncAdaptor — TW5 SyncAdaptor backed by LarTiddlerStore.
 *
 * Binds a hosted TW5 wiki to a LarTiddlerStore so TW5's syncer treats the
 * store as its remote backend. Implements the TW5 SyncAdaptor contract.
 *
 * Each adaptor instance targets a single bag. Multi-doc architecture wires
 * multiple adaptors (one per bag/doc) through the TW5 recipe stack:
 *
 *   system bag   ← invariant boot corpus (read-only in this adaptor)
 *   corpus bags  ← durable Automerge docs, one per named corpus
 *   room bag     ← situated meaning: pins, notes, active artifacts
 *   draft bag    ← draft-of tiddlers; synced across user's devices, not per-session
 *   projection   ← rebuildable shadow; receipt-tagged
 *
 * Echo-loop guard:
 *   _applying tracks the active ChangeOrigin during an inbound CRDT apply.
 *   Any saveTiddler / deleteTiddler call while _applying !== null is an echo
 *   of our own write and is suppressed immediately.
 *
 *   M-bags note: in the multi-doc world _applying becomes a per-edgeIsland
 *   gate (Map<edgeIslandId, ChangeOrigin>) so concurrent doc replays from
 *   different islands don't block each other. The single-value form here is
 *   correct for the current single-doc model.
 *
 * Canon guard:
 *   saveTiddler MUST NOT write to lares/. Canon promotion goes through a
 *   future Keyhive-backed ceremony. No active promotion route exists here.
 *
 * Temp guard:
 *   $:/temp/* tiddlers are session-local scratch and MUST NOT reach shared
 *   store state. They are suppressed in saveTiddler and deleteTiddler.
 *
 * Draft sync:
 *   "Draft of ..." tiddlers ARE synced across the user's identity's devices.
 *   A user's in-progress edit on their laptop should appear on their desktop.
 *   Drafts are per-user (identity), not per-session. They land in the draft
 *   bag (M-bags) or targetBag (current single-doc) until bag routing exists.
 *
 * Save cascade:
 *   Write routing is corpus-driven — rules live in the wiki at:
 *   lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade
 *   Read from the wiki on first use and cached. Cache invalidates whenever
 *   that meme changes (subscribed via onWikiChange in start()).
 */

import type { LarTiddlerStore, LarTiddlerRecord, LarTiddlerChange, ChangeOrigin, MemeProjection } from "@lararium/core";
import type { LarariumTW5 } from "./lararium-tw5.js";
import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import { buildDirectRecord } from "./carrier-write.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaveStrategy = "skip" | "direct";
type SaveHandler  = (
  title:    string,
  fields:   Record<string, string>,
  revision: string,
  origin:   ChangeOrigin,
) => Promise<void>;

/** URI of the corpus meme that declares the ordered save-routing rules. */
const SAVE_CASCADE_URI = "lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Fast-path guards mirroring the structural skip/sync categories.
 *
 * isTemp      — $:/temp/* only; session-local scratch, never synced.
 * isTW5System — $:/ namespace; TW5 internals, never synced.
 * isDraft     — "Draft of ..." titles; suppressed until the draft island (M-E) is wired.
 */
function isTemp(title: string): boolean {
  return title.startsWith("$:/temp/");
}

function isDraft(title: string): boolean {
  return title.startsWith("Draft of ");
}

function isTW5System(title: string): boolean {
  return title.startsWith("$:/");
}

function isCarrierRecord(rec: LarTiddlerRecord, title: string): boolean {
  return rec.text !== undefined &&
    (rec.fields["type"] === "text/x-memetic-wikitext" ||
      rec.fields["content-type"] === "text/x-memetic-wikitext" ||
      (!(rec.fields["type"] || rec.fields["content-type"]) && title.startsWith("lar:")));
}

/**
 * Normalise a TW5 tiddler argument to a flat Record<string, string>.
 *
 * TW5's saveTiddler callback receives either:
 *   A) a Tiddler instance — fields nested under `.fields`, other props flat
 *   B) a raw fields object — everything flat at the top level
 *
 * Array-valued fields (e.g. `tags`) are joined with spaces to match the
 * TW5 wire representation used throughout the adaptor.
 */
function extractFields(tiddler: unknown): Record<string, string> {
  if (!tiddler || typeof tiddler !== "object") return {};
  const t = tiddler as Record<string, unknown>;
  const out: Record<string, string> = {};
  const flatten = (k: string, v: unknown) => {
    if (typeof v === "string") { out[k] = v; }
    else if (Array.isArray(v)) { out[k] = (v as unknown[]).map(String).join(" "); }
  };
  for (const [k, v] of Object.entries(t)) {
    if (k === "fields" && typeof v === "object" && v !== null) {
      // Shape A: Tiddler instance — unwrap the nested fields object.
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) flatten(fk, fv);
    } else {
      flatten(k, v);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// LarariumCrdtSyncAdaptor
// ---------------------------------------------------------------------------

export class LarariumCrdtSyncAdaptor implements MemeProjection {
  readonly name = "lararium-crdt";

  /**
   * The bag this adaptor writes to.
   *
   * M-bags: in multi-doc architecture each adaptor instance targets one bag.
   * The TW5 recipe stack composes them. Default "room" is correct for the
   * current single-doc model where all live content goes to the room bag.
   */
  readonly targetBag: NonNullable<LarTiddlerRecord["bag"]>;

  /**
   * _applying — active inbound origins during CRDT applies, keyed by apply slot.
   *
   * Non-empty means at least one inbound apply is in progress; saveTiddler /
   * deleteTiddler suppress echoes whenever the map is non-empty.
   *
   * Key convention:
   *   current single-doc: this.instanceId
   *   M-bags future:      edgeIslandId per concurrent doc replay
   *   carrier-child removes: `${instanceId}:carrier-child`
   *
   * Using a Map (rather than a scalar) means concurrent doc replays from
   * different islands don't interfere — each island sets and deletes its own
   * key without clearing another island's guard.
   */
  private _applying = new Map<string, ChangeOrigin>();

  private _isApplying(): boolean { return this._applying.size > 0; }

  private _revisions = new Map<string, string>();
  private _pendingModifications = new Set<string>();
  private _pendingDeletions = new Set<string>();
  private _unsubscribe: (() => void) | null = null;
  private _unwatchCascade: (() => void) | null = null;

  /**
   * Per-island sync-complete gate and change buffers.
   *
   * Each island (identified by edgeIslandId) buffers inbound changes until
   * onSyncComplete(islandId) fires for that island. One slow corpus doc
   * completing does not flush or gate another island's buffer.
   *
   * Single-doc default: island "automerge" (matches AutomergeMemeStore origin).
   * M-bags: each DocHandle uses its own edgeIslandId as the key.
   */
  private _syncComplete = new Set<string>();
  private _buffer = new Map<string, LarTiddlerChange[]>();

  /** Save cascade rules read from the corpus wiki. Invalidated on cascade-meme change. */
  private _cascadeCache: Array<{ filter: string; strategy: SaveStrategy }> | null = null;

  constructor(
    private readonly tw5: LarariumTW5,
    private readonly store: LarTiddlerStore,
    readonly instanceId: string,
    targetBag: NonNullable<LarTiddlerRecord["bag"]> = "room",
  ) {
    this.targetBag = targetBag;
  }

  // ---------------------------------------------------------------------------
  // MemeProjection — inbound CRDT→TW5 direction
  // ---------------------------------------------------------------------------

  /**
   * Called by MemeProvider for each coalesced URI change.
   * Buffered per island until onSyncComplete(islandId) fires for that island,
   * then applied immediately. One slow island cannot gate another.
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
   * Fired by MemeProvider after an island's initial Automerge replay settles.
   * Flushes only that island's buffer in one TW5 transaction → one widget
   * refresh per island instead of one per tiddler.
   *
   * Single-doc default: islandId = "automerge".
   * M-bags: each DocHandle fires with its own edgeIslandId.
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
          const isCarrier = isCarrierRecord(rec, change.title);

          if (isCarrier && rec.text) {
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
          if (change.revision) this._revisions.set(change.title, change.revision);
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
   *
   * Registers as MemeProjection when the store supports addProjection()
   * (AutomergeMemeStore), falling back to store.subscribe() for plain stores.
   */
  start(): () => void {
    const storeWithProjection = this.store as unknown as {
      addProjection?: (p: MemeProjection) => () => void;
    };
    if (typeof storeWithProjection.addProjection === "function") {
      this._unsubscribe = storeWithProjection.addProjection(this);
    } else {
      this._unsubscribe = this.store.subscribe((change) => this._applyChange(change));
    }

    // Invalidate cascade cache whenever the save-cascade meme changes.
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
  // Heleuma: lar:///ha.ka.ba/api/v0.1/lararium/modules/sync-adaptor #source
  // ---------------------------------------------------------------------------

  private _applyChange(change: LarTiddlerChange): void {
    // Skip echoes of our own writes.
    if (change.origin.kind === "tw-local" && change.origin.instanceId === this.instanceId) return;

    // M-bags: key becomes change.origin.edgeIsland when available.
    const applyKey = this.instanceId;
    this._applying.set(applyKey, change.origin);
    try {
      if (change.record === null || change.record.deleted) {
        this.tw5.removeTiddler(change.title);
        const childTitles: string[] = this.tw5.filterTiddlers(`[field:fragment-parent[${change.title}]]`);
        for (const t of childTitles) this.tw5.removeTiddler(t);
        this._pendingDeletions.add(change.title);
      } else {
        const rec = change.record;
        const isCarrier = rec.text !== undefined &&
          (rec.fields["type"] === "text/x-memetic-wikitext" ||
            rec.fields["content-type"] === "text/x-memetic-wikitext" ||
            (!(rec.fields["type"] || rec.fields["content-type"]) && change.title.startsWith("lar:")));

        if (isCarrier && rec.text) {
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
        if (change.revision) this._revisions.set(change.title, change.revision);
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
    const t = _tiddler as { fields?: { title?: string }; title?: string };
    const title = t?.fields?.title ?? t?.title ?? "";
    const rev = this._revisions.get(title);
    return rev !== undefined ? { revision: rev } : {};
  }

  getTiddlerRevision(title: string): string | undefined {
    return this._revisions.get(title);
  }

  getSkinnyTiddlers(
    callback: (err: Error | null, tiddlers: { title: string; revision?: string }[]) => void,
  ): void {
    this.store.listVisible().then((titles) => {
      const skinny = titles.map((title) => {
        const rev = this._revisions.get(title);
        return rev !== undefined ? { title, revision: rev } : { title };
      });
      callback(null, skinny);
    }).catch((err: Error) => callback(err, []));
  }

  loadTiddler(
    title: string,
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
    tiddler: unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    if (this._isApplying()) { callback(null, {}, "0"); return; }

    const fields   = extractFields(tiddler);
    const title    = fields["title"] ?? "";
    const strategy = this._resolveSaveStrategy(title);

    if (strategy === "skip") { callback(null, {}, "0"); return; }

    const revision = String(Date.now());
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this._saveHandlers[strategy](title, fields, revision, origin)
      .then(() => callback(null, {}, revision))
      .catch((err: Error) => callback(err, {}, revision));
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
    // Fast-path: the structural skip categories never route differently.
    if (isTemp(title) || isTW5System(title)) return "skip";
    if (isDraft(title)) return "skip"; // draft island not yet wired (M-E)

    if (title.startsWith("lar:")) return "direct";

    // Corpus cascade — first matching TW5 filter wins.
    const wiki = this.tw5.wiki;
    for (const { filter, strategy } of this._readSaveCascade()) {
      try {
        const result: string[] = wiki.filterTiddlers(`[[${title}]${filter}]`);
        if (result.length > 0) return strategy;
      } catch { /* malformed corpus filter — skip rule, do not crash */ }
    }
    return "skip";
  }

  private readonly _saveHandlers: Record<SaveStrategy, SaveHandler> = {
    skip: async () => { /* no-op */ },

    direct: async (title, fields, revision, origin) => {
      this._revisions.set(title, revision);
      await this.store.put(buildDirectRecord(title, fields, revision, this.targetBag), origin);
    },

  };

  // ---------------------------------------------------------------------------
  // Delete path
  // ---------------------------------------------------------------------------

  /**
   * Remove carrier child tiddlers from the local TW5 wiki under the echo guard.
   *
   * Sets a dedicated carrier-child key in _applying so the outer apply guard
   * remains active if this is called during an inbound replay. The Map means
   * the outer key survives independently — no save/restore needed.
   *
   * M-bags: the carrier-child key remains instance-scoped; each island's
   * removes get their own key when edgeIslandId is used as the outer key.
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
    title: string,
    callback: (err: Error | null) => void,
    _options?: unknown,
  ): void {
    if (this._isApplying()) { callback(null); return; }
    if (isTemp(title) || isTW5System(title)) { callback(null); return; }
    if (!title.startsWith("lar:")) { callback(null); return; } // drafts suppressed until M-E

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    // All lar: tiddlers — including ahu slot children — tombstone as independent
    // records. Carrier text reconstruction does not occur in the write path.
    this.store.tombstone(title, origin)
      .then(() => {
        this._removeLocalCarrierChildren(title, origin);
        callback(null);
      })
      .catch(callback);
  }

  /**
   * Report accumulated modifications and deletions to TW5's syncer.
   *
   * M-bags: in multi-doc, modifications from different bags/docs accumulate
   * in separate sets and are merged here for TW5's single syncer view.
   */
  getUpdatedTiddlers(
    _syncer: unknown,
    callback: (err: Error | null, updates: { modifications: string[]; deletions: string[] }) => void,
  ): void {
    const modifications = [...this._pendingModifications];
    const deletions = [...this._pendingDeletions];
    this._pendingModifications.clear();
    this._pendingDeletions.clear();
    callback(null, { modifications, deletions });
  }
}
