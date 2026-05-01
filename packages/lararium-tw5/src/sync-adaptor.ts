/**
 * LarariumCrdtSyncAdaptor — TW5 SyncAdaptor backed by LarTiddlerStore.
 *
 * Binds a hosted TW5 wiki to a LarTiddlerStore so TW5's syncer treats the
 * store as its remote backend. Implements the TW5 SyncAdaptor contract.
 *
 * Echo-loop guard:
 *   - When the store fires a change with origin.kind === "tw-local" and the
 *     instanceId matches ours, skip applying it to $tw.wiki (we sent it).
 *   - When the store fires a change with origin.kind === "crdt-remote", apply
 *     to $tw.wiki but suppress the resulting wiki change event from writing
 *     back to the store (we received it, not generated it).
 *
 * Canon guard (hard rule):
 *   saveTiddler MUST NOT write to lares/.
 *   Callers that need canon promotion must submit a future Keyhive-backed
 *   promotion proposal. No active promotion route exists in this adaptor.
 *
 * Draft guard:
 *   Session-local tiddlers ($:/temp/*, "Draft of ...") MUST NOT reach shared
 *   store state. The adaptor filters them from saveTiddler.
 *
 * Save cascade:
 *   Write routing is corpus-driven — rules live in:
 *   lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade
 *   Read from the wiki at first use and cached for the session.
 */

import type { LarTiddlerStore, LarTiddlerChange, ChangeOrigin, MemeProjection } from "@lararium/core";
import type { LarariumTW5 } from "./lararium-tw5.js";
import type { TW5TiddlerFields } from "./types/tiddlywiki.js";
import {
  inferChildCarrierTitle,
  buildDirectRecord,
  saveChildCarrierRecord,
  saveParentAfterChildDelete,
} from "./carrier-write.js";

// ---------------------------------------------------------------------------
// Save strategy types
// ---------------------------------------------------------------------------

type SaveStrategy = "skip" | "direct" | "child-carrier";
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

function isSessionLocal(title: string): boolean {
  return title.startsWith("$:/temp/") || title.startsWith("Draft of ");
}

function isTW5System(title: string): boolean {
  return title.startsWith("$:/");
}

/**
 * Extract a flat Record<string, string> from a TW5 tiddler object.
 *
 * TW5 passes tiddler objects to saveTiddler in two shapes depending on
 * context (Tiddler instance with .fields, or a raw fields object). Both
 * shapes are normalised here. Array-valued fields are joined with spaces.
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

  private _applying: ChangeOrigin | null = null;
  private _revisions = new Map<string, string>();
  private _pendingModifications = new Set<string>();
  private _pendingDeletions = new Set<string>();
  private _unsubscribe: (() => void) | null = null;

  // Bulk-refresh gate — buffer changes until initial Automerge replay settles.
  private _syncComplete = false;
  private _buffer: LarTiddlerChange[] = [];

  // Save cascade — read from wiki on first use, cached for the session.
  private _cascadeCache: Array<{ filter: string; strategy: SaveStrategy }> | null = null;

  constructor(
    private readonly tw5: LarariumTW5,
    private readonly store: LarTiddlerStore,
    readonly instanceId: string,
  ) {}

  // ---------------------------------------------------------------------------
  // MemeProjection — called by MemeProvider (bypasses the per-tiddler path)
  // ---------------------------------------------------------------------------

  /**
   * Called by MemeProvider for each coalesced URI change. During the initial
   * Automerge replay (before markSyncComplete), changes are buffered. After
   * sync-complete they are applied immediately.
   */
  onUriChanged(change: LarTiddlerChange): void {
    if (!this._syncComplete) {
      this._buffer.push(change);
      return;
    }
    this._applyChange(change);
  }

  /**
   * Fired once by MemeProvider after the initial Automerge replay settles.
   * Flushes the buffered changes in a single TW5 transaction → one widget
   * refresh cycle instead of one per tiddler. Resolves the 94s setTimeout
   * violation: TW5 used to fire a refresh for every patch during replay.
   */
  onSyncComplete(): void {
    this._syncComplete = true;
    if (this._buffer.length === 0) return;

    const toRemove: string[] = [];
    const toAdd: Array<Record<string, string | string[]>> = [];

    this._applying = { kind: "crdt-remote", edgeIsland: "automerge" };
    try {
      for (const change of this._buffer) {
        if (
          change.origin.kind === "tw-local" &&
          (change.origin as { instanceId: string }).instanceId === this.instanceId
        ) continue;

        if (change.record === null || change.record.deleted) {
          toRemove.push(change.title);
          const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${change.title}]has[ahu-slot]]`);
          for (const t of childTitles) toRemove.push(t);
          this._pendingDeletions.add(change.title);
        } else {
          const rec = change.record;
          const isCarrier = rec.text !== undefined &&
            (rec?.fields["content-type"] === "text/x-memetic-wikitext" ||
              (!rec?.fields["content-type"] && change.title.startsWith("lar:")));

          if (isCarrier && rec.text) {
            const staleChildren: string[] = this.tw5.filterTiddlers(`[tag[${change.title}]has[ahu-slot]]`);
            for (const t of staleChildren) toRemove.push(t);
            const tiddlers = this.tw5.deserializeCarrier(change.title, rec.text, rec?.fields as Record<string, string | string[]>);
            for (const t of tiddlers) toAdd.push(t as Record<string, string | string[]>);
          } else {
            const fields: Record<string, string | string[]> = { title: rec.title, ...rec?.fields };
            if (rec.text !== undefined) fields["text"] = rec.text;
            toAdd.push(fields);
          }

          this._pendingModifications.add(change.title);
          if (change.revision) this._revisions.set(change.title, change.revision);
        }
      }
    } finally {
      this._buffer = [];
    }

    for (const title of toRemove) this.tw5.removeTiddler(title);
    if (toAdd.length > 0) this.tw5.bulkSetTiddlers(toAdd);

    this._applying = null;
  }

  /**
   * Start listening to store changes and applying them to the TW5 wiki.
   *
   * When the store exposes addProjection() (AutomergeMemeStore / any MemeProvider-
   * backed store), this adaptor registers itself as a MemeProjection so it
   * participates in the onSyncComplete bulk-refresh gate. Otherwise it falls
   * back to store.subscribe() (no bulk gate, but still correct).
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
    return () => this.stop();
  }

  stop(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  // ---------------------------------------------------------------------------
  // Internal — apply a single change to TW5 wiki under echo guard
  // Heleuma: lar:///ha.ka.ba/api/v0.1/lararium/modules/sync-adaptor #source
  // ---------------------------------------------------------------------------

  private _applyChange(change: LarTiddlerChange): void {
    if (
      change.origin.kind === "tw-local" &&
      (change.origin as { instanceId: string }).instanceId === this.instanceId
    ) return;

    this._applying = change.origin;
    try {
      if (change.record === null || change.record.deleted) {
        this.tw5.removeTiddler(change.title);
        const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${change.title}]has[ahu-slot]]`);
        for (const t of childTitles) this.tw5.removeTiddler(t);
        this._pendingDeletions.add(change.title);
      } else {
        const rec = change.record;
        const isCarrier = rec.text !== undefined &&
          (rec?.fields["content-type"] === "text/x-memetic-wikitext" ||
            (!rec?.fields["content-type"] && change.title.startsWith("lar:")));

        if (isCarrier && rec.text) {
          const staleChildren: string[] = this.tw5.filterTiddlers(`[tag[${change.title}]has[ahu-slot]]`);
          for (const t of staleChildren) this.tw5.removeTiddler(t);
          const tiddlers = this.tw5.deserializeCarrier(change.title, rec.text, rec?.fields as Record<string, string | string[]>);
          for (const t of tiddlers) this.tw5.setTiddler(t as Record<string, string | string[]>);
        } else {
          const fields: Record<string, string | string[]> = { title: rec.title, ...rec?.fields };
          if (rec.text !== undefined) fields["text"] = rec.text;
          this.tw5.setTiddler(fields);
        }

        this._pendingModifications.add(change.title);
        if (change.revision) this._revisions.set(change.title, change.revision);
      }
    } finally {
      this._applying = null;
    }
  }

  // ---------------------------------------------------------------------------
  // TW5 SyncAdaptor contract
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
      const fields: Record<string, unknown> = { title: rec.title, ...rec?.fields };
      if (rec.text !== undefined) fields["text"] = rec.text;
      callback(null, fields);
    }).catch((err: Error) => callback(err, null));
  }

  saveTiddler(
    tiddler: unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    if (this._applying !== null) { callback(null, {}, "0"); return; }

    const fields = extractFields(tiddler);
    const title  = fields["title"] ?? "";
    const strategy = this._resolveSaveStrategy(title, fields);

    if (strategy === "skip") { callback(null, {}, "0"); return; }

    const revision = String(Date.now());
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this._saveHandlers[strategy](title, fields, revision, origin)
      .then(() => callback(null, {}, revision))
      .catch((err: Error) => callback(err, {}, revision));
  }

  // ---------------------------------------------------------------------------
  // Save cascade — corpus-driven write routing
  //
  // Rules live in lar:///ha.ka.ba/api/v0.1/lararium/sync/save-cascade.
  // Read from the wiki on first call and cached for the session.
  // Fast-path guards (isSessionLocal, isTW5System) avoid the filter call for
  // the most common skip cases; they mirror cascade rules 1–3 exactly.
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

  private _resolveSaveStrategy(title: string, fields: Record<string, string> = {}): SaveStrategy {
    // Fast-path: avoid filter call for the most common skip cases.
    if (isSessionLocal(title) || isTW5System(title)) return "skip";

    // Explicit field/title facts take priority — saveTiddler can be called
    // with a fresh tiddler not yet in the wiki, so cascade filters may miss it.
    if (fields["ahu-parent"]) return "child-carrier";
    const currentFields = this.tw5.wiki.getTiddler?.(title)?.fields ?? ({} as TW5TiddlerFields);
    if (currentFields["ahu-parent"]) return "child-carrier";
    const hash = title.lastIndexOf("#");
    if (title.startsWith("lar:") && hash > 0 && this.tw5.wiki.getTiddler?.(title.slice(0, hash))) {
      return "child-carrier";
    }
    if (title.startsWith("lar:")) return "direct";

    // Corpus cascade — first matching TW5 filter wins.
    const wiki = this.tw5.wiki;
    for (const { filter, strategy } of this._readSaveCascade()) {
      try {
        const result: string[] = wiki.filterTiddlers(`[[${title}]${filter}]`);
        if (result.length > 0) return strategy;
      } catch { /* malformed filter — skip rule */ }
    }
    return "skip";
  }

  private readonly _saveHandlers: Record<SaveStrategy, SaveHandler> = {
    skip: async () => { /* no-op */ },

    direct: async (title, fields, revision, origin) => {
      this._revisions.set(title, revision);
      await this.store.put(buildDirectRecord(title, fields, revision), origin);
    },

    "child-carrier": async (title, fields, revision, origin) => {
      await saveChildCarrierRecord(this.tw5, this.store, this._revisions, title, fields, revision, origin);
    },
  };

  // ---------------------------------------------------------------------------
  // Delete path
  // ---------------------------------------------------------------------------

  private _removeLocalCarrierChildren(parentUri: string, origin: ChangeOrigin): void {
    const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]]`);
    if (childTitles.length === 0) return;
    const previous = this._applying;
    this._applying = origin;
    try {
      for (const title of childTitles) this.tw5.removeTiddler(title);
    } finally {
      this._applying = previous;
    }
  }

  deleteTiddler(
    title: string,
    callback: (err: Error | null) => void,
    _options?: unknown,
  ): void {
    if (this._applying !== null) { callback(null); return; }
    if (isSessionLocal(title) || isTW5System(title) || !title.startsWith("lar:")) { callback(null); return; }

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    const revision = String(Date.now());
    const childCarrier = inferChildCarrierTitle(this.tw5, title);

    if (childCarrier) {
      saveParentAfterChildDelete(
        this.tw5, this.store, this._revisions,
        title, childCarrier.parentUri, childCarrier.slot,
        revision, origin,
      )
        .then(() => callback(null))
        .catch(callback);
      return;
    }

    this.store.tombstone(title, origin)
      .then(() => {
        if (title.startsWith("lar:")) this._removeLocalCarrierChildren(title, origin);
        callback(null);
      })
      .catch(callback);
  }

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
