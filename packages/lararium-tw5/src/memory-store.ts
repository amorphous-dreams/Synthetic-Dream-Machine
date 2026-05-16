/**
 * MemoryTiddlerStore — in-memory LarTiddlerStore.
 *
 * Two roles:
 *   1. Tests and fixtures (original purpose). Used by host.test.ts,
 *      sync-adaptor.test.ts, and the browser host factory during
 *      development.
 *   2. **Production projection layer** (E.2 onward). Mounted as the
 *      top-priority composite layer with bagId = `BAG_IDS.projection`.
 *      Holds tiddlers whose `bag` field reads `"projection"` —
 *      typically TW5 runtime state (`$:/state/*`, `$:/HistoryList`,
 *      `$:/StoryList`) that the operator does NOT want synced or
 *      persisted. The store has no I/O, no Automerge backing, no wire
 *      surface; on daemon restart the projection layer comes up empty.
 *
 * Tombstoned titles disappear from listVisible() but remain readable via
 * get() when the record carries { deleted: true }.
 */

import type {
  LarTiddlerRecord,
  LarTiddlerChange,
  LarTiddlerStore,
  ChangeOrigin,
} from "@lararium/mesh";

export class MemoryTiddlerStore implements LarTiddlerStore {
  private _records = new Map<string, LarTiddlerRecord>();
  private _subscribers: ((change: LarTiddlerChange) => void)[] = [];

  async listVisible(): Promise<string[]> {
    const out: string[] = [];
    for (const [title, rec] of this._records) {
      if (!rec.deleted) out.push(title);
    }
    return out;
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    return this._records.get(title) ?? null;
  }

  async put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void> {
    this._records.set(record.title, record);
    this._emit({ title: record.title, record, origin });
  }

  async tombstone(title: string, origin: ChangeOrigin): Promise<void> {
    const existing = this._records.get(title);
    const dead: LarTiddlerRecord = {
      ...(existing ?? { title, fields: {} }),
      deleted: true,
    };
    this._records.set(title, dead);
    this._emit({ title, record: null, origin });
  }

  subscribe(fn: (change: LarTiddlerChange) => void): () => void {
    this._subscribers.push(fn);
    return () => {
      const idx = this._subscribers.indexOf(fn);
      if (idx >= 0) this._subscribers.splice(idx, 1);
    };
  }

  private _emit(change: LarTiddlerChange): void {
    for (const fn of this._subscribers) fn(change);
  }

  /** Test helper — direct record injection without triggering subscribers. */
  _seed(record: LarTiddlerRecord): void {
    this._records.set(record.title, record);
  }

  /** Test helper — full record map snapshot. */
  _snapshot(): Map<string, LarTiddlerRecord> {
    return new Map(this._records);
  }
}

/**
 * ProjectionStore — alias for MemoryTiddlerStore used as the BAG_IDS.projection
 * composite layer.  Holds TW5 runtime state ($:/state/*, $:/StoryList, etc.)
 * that never syncs or persists.  Comes up empty on every daemon restart.
 */
export type ProjectionStore = MemoryTiddlerStore;
