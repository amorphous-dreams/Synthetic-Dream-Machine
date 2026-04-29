/**
 * MemoryTiddlerStore — in-memory LarTiddlerStore for tests and fixtures.
 *
 * Not intended for production use. Satisfies the full LarTiddlerStore
 * interface with no I/O. Suitable for host.test.ts, sync-adaptor.test.ts,
 * and browser host factory during development.
 *
 * Tombstoned titles disappear from listVisible() but remain readable via
 * get() when the record carries { deleted: true }.
 */

import type {
  LarTiddlerRecord,
  LarTiddlerChange,
  LarTiddlerStore,
  ChangeOrigin,
} from "@lararium/core";

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
