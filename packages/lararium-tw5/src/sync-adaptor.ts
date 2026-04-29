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
 *   Callers that need canon promotion must use the Orichalcum ceremony path
 *   (separate route, not this adaptor).
 *
 * Draft guard:
 *   Session-local tiddlers ($:/temp/*, "Draft of ...") MUST NOT reach shared
 *   store state. The adaptor filters them from saveTiddler.
 */

import type { LarTiddlerStore, LarTiddlerRecord, ChangeOrigin } from "@lararium/core";
import type { LarariumTW5 } from "./lararium-tw5.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isSessionLocal(title: string): boolean {
  return title.startsWith("$:/temp/") || title.startsWith("Draft of ");
}

function isTW5System(title: string): boolean {
  return title.startsWith("$:/");
}

function extractFields(tiddler: unknown): Record<string, string> {
  if (!tiddler || typeof tiddler !== "object") return {};
  // TW5 tiddler objects expose fields directly on the object
  const t = tiddler as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    if (k === "fields" && typeof v === "object" && v !== null) {
      // Some TW5 versions nest fields inside .fields
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) {
        out[fk] = String(fv);
      }
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// LarariumCrdtSyncAdaptor
// ---------------------------------------------------------------------------

export class LarariumCrdtSyncAdaptor {
  readonly name = "lararium-crdt";

  private _applying: ChangeOrigin | null = null;
  private _revisions = new Map<string, string>();
  private _pendingModifications = new Set<string>();
  private _pendingDeletions = new Set<string>();
  private _unsubscribe: (() => void) | null = null;

  constructor(
    private readonly tw5: LarariumTW5,
    private readonly store: LarTiddlerStore,
    readonly instanceId: string,
  ) {}

  /**
   * Start listening to store changes and applying them to the TW5 wiki.
   * Call once after the TW5 instance has booted and the store is ready.
   * Returns an unsubscribe function for cleanup.
   */
  start(): () => void {
    this._unsubscribe = this.store.subscribe((change) => {
      // Skip changes we emitted ourselves.
      if (
        change.origin.kind === "tw-local" &&
        (change.origin as { instanceId: string }).instanceId === this.instanceId
      ) return;

      // Apply remote change to TW5 wiki under echo guard.
      this._applying = change.origin;
      try {
        if (change.record === null || change.record.deleted) {
          this.tw5.removeTiddler(change.title);
          this._pendingDeletions.add(change.title);
        } else {
          const fields: Record<string, string | string[]> = {
            title: change.record.title,
            ...change.record.fields,
          };
          if (change.record.text !== undefined) fields["text"] = change.record.text;
          this.tw5.setTiddler(fields);
          this._pendingModifications.add(change.title);
          if (change.revision) this._revisions.set(change.title, change.revision);
        }
      } finally {
        this._applying = null;
      }
    });
    return () => this._unsubscribe?.();
  }

  stop(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
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
      const fields: Record<string, unknown> = { title: rec.title, ...rec.fields };
      if (rec.text !== undefined) fields["text"] = rec.text;
      callback(null, fields);
    }).catch((err: Error) => callback(err, null));
  }

  saveTiddler(
    tiddler: unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    // Echo-loop guard: if we're currently applying a remote change, suppress writeback.
    if (this._applying !== null) {
      callback(null, {}, this._revisions.get("") ?? "0");
      return;
    }

    const fields = extractFields(tiddler);
    const title = fields["title"] ?? "";

    // Draft guard: never write session-local tiddlers to shared store.
    if (isSessionLocal(title) || isTW5System(title)) {
      callback(null, {}, "0");
      return;
    }

    const revision = String(Date.now());
    this._revisions.set(title, revision);

    const textVal = fields["text"];
    const record: LarTiddlerRecord = {
      title,
      fields: Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "text")),
      ...(textVal !== undefined ? { text: textVal } : {}),
      revision,
      bag: "room",
    };

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    this.store.put(record, origin).then(() => {
      callback(null, {}, revision);
    }).catch((err: Error) => callback(err, {}, revision));
  }

  deleteTiddler(
    title: string,
    callback: (err: Error | null) => void,
    _options?: unknown,
  ): void {
    // Echo-loop guard.
    if (this._applying !== null) { callback(null); return; }
    // Draft guard.
    if (isSessionLocal(title) || isTW5System(title)) { callback(null); return; }

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    this.store.tombstone(title, origin).then(() => callback(null)).catch(callback);
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
