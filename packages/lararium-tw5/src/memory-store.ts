/**
 * MemoryTiddlerStore — in-memory LarTiddlerStore.
 *
 * Two roles:
 *   1. Tests and fixtures.
 *   2. The `temp` slot in every WikiRecipe — top of the cascade, volatile
 *      per-island. No I/O, no Automerge backing, no wire surface; on island
 *      restart the slot comes up empty.
 *
 * What belongs in temp (device-vessel local, never crosses the boundary):
 *   $:/temp/*           drafts mid-typing, alerts, HTTP request trackers
 *   $:/temp/volatile/*  rAF tick markers, animation frames
 *   $:/status/*         TW5 login/identity status flags (per-device)
 *   $:/boot/*           boot-time config
 *   $:/HistoryList      navigation back-stack
 *   $:/state/popup/*    sub-second UI popup state
 *   (catch-all) $:/*    anything else under TW5's system namespace
 *
 * What does NOT belong in temp (operator's cross-device viewing state):
 *   $:/StoryList         which tiddlers are open in the story river
 *   $:/state/folded/*    fold/expand state per tiddler frame
 *   $:/state/tab-*       selected tab per tiddler
 *   $:/palette           operator's chosen color palette
 *
 * The above route to the `personal` slot — a CRDT
 * bag scoped to the operator's Keyhive PersonaGroup (their authorised device
 * cabal), keyed per (PersonaGroup × recipe-fingerprint). The in-wiki bag-paths
 * cascade (lar:///ha.ka.ba/lararium/config/bag-paths) decides routing, not this
 * store: prefix rules send those four above the `$:/state/` → temp catch-all.
 * See:
 *   bags/lares/ha.ka.ba/lararium/api/personal-slot.md
 *
 * Tombstoned titles disappear from listVisible() but remain readable via
 * get() when the record carries { deleted: true }.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/memory-store
 */

import { assertStorableTitle } from "@lararium/mesh/lar-uris";
import type {
  LarTiddlerRecord,
  LarTiddlerChange,
  LarTiddlerStore,
  ChangeOrigin,
  LarWriteOptions,
} from "@lararium/mesh";

export class MemoryTiddlerStore implements LarTiddlerStore {
  constructor(private readonly bagId?: string) {}

  private _records = new Map<string, LarTiddlerRecord>();
  private _subscribers: ((change: LarTiddlerChange) => void)[] = [];

  /** The titles this store holds as tombstones. */
  listTombstoned(): string[] {
    return [...this._records].filter(([, rec]) => rec.meta?.deleted === true).map(([title]) => title);
  }

  async listVisible(): Promise<string[]> {
    const out: string[] = [];
    for (const [title, rec] of this._records) {
      if (!rec.meta?.deleted) out.push(title);
    }
    return out;
  }

  async get(title: string): Promise<LarTiddlerRecord | null> {
    return this._records.get(title) ?? null;
  }

  readNow(title: string): { record: LarTiddlerRecord | null } {
    return { record: this._records.get(title) ?? null };
  }

  async put(record: LarTiddlerRecord, origin: ChangeOrigin, _options?: LarWriteOptions): Promise<void> {
    // The title door: one law for every store that holds a title (`@lararium/mesh` `title-law.ts`).
    assertStorableTitle(record.tiddler.title);
    this._records.set(record.tiddler.title, record);
    this._emit({ title: record.tiddler.title, record, origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}) });
  }

  async tombstone(title: string, origin: ChangeOrigin, _options?: LarWriteOptions): Promise<void> {
    assertStorableTitle(title);   // a tombstone against an absent title mints the key
    const existing = this._records.get(title);
    const dead: LarTiddlerRecord = {
      ...(existing ?? { tiddler: { title } }),
      meta: { ...(existing?.meta ?? {}), deleted: true },
    };
    this._records.set(title, dead);
    this._emit({ title, record: null, origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}) });
  }

  /** A family lands in one synchronous stretch: every title passes the door first, every member applies, and only
   *  then do the changes fire, so no peer sees a member without the rest and nothing can interleave between them. A
   *  subscriber that throws leaves the later subscribers and members still delivered. */
  async writeFamily(puts: readonly LarTiddlerRecord[], tombstones: readonly string[], origin: ChangeOrigin, _options?: LarWriteOptions): Promise<void> {
    for (const record of puts) assertStorableTitle(record.tiddler.title);
    for (const title of tombstones) assertStorableTitle(title);
    const bag = this.bagId !== undefined ? { bag: this.bagId } : {};
    const changes: LarTiddlerChange[] = [];
    for (const record of puts) {
      this._records.set(record.tiddler.title, record);
      changes.push({ title: record.tiddler.title, record, origin, ...bag });
    }
    for (const title of tombstones) {
      const existing = this._records.get(title);
      this._records.set(title, { ...(existing ?? { tiddler: { title } }), meta: { ...(existing?.meta ?? {}), deleted: true } });
      changes.push({ title, record: null, origin, ...bag });
    }
    // The family has committed; a subscriber that throws faults the subscriber, never the commit, so the writer
    // reads success and a retry cannot apply the members a second time.
    // Each change reads the store as it stands when it fires, so a listener that rewrites a later member leaves
    // the last delivered value equal to the store's.
    for (const change of changes) {
      const live = this._records.get(change.title);
      const fired: LarTiddlerChange = change.record === null
        ? (live?.meta?.deleted === true || live === undefined ? change : { ...change, record: live })
        : (live === undefined ? { ...change, record: null } : { ...change, record: live });
      try { this._emit(fired); } catch { /* the commit stands */ }
    }
  }

  /** HARD-remove: drop the record entirely (get → null = ABSENT, falls through),
   *  distinct from tombstone's kāpae hide. The MOVE/promotion source retract. */
  async remove(title: string, origin: ChangeOrigin): Promise<void> {
    this._records.delete(title);
    this._emit({ title, record: null, origin, ...(this.bagId !== undefined ? { bag: this.bagId } : {}) });
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
    this._records.set(record.tiddler.title, record);
  }

  /** Test helper — full record map snapshot. */
  _snapshot(): Map<string, LarTiddlerRecord> {
    return new Map(this._records);
  }
}

