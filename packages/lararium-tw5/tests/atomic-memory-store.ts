import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord, LarWriteOptions } from "@lararium/mesh";
import { assertStorableTitle } from "@lararium/mesh/lar-uris";

/**
 * A memory layer that writes a family atomically, for the record port's tests: every title passes the door, every
 * member applies, and only then do the changes fire in one synchronous stretch. Each change reads the store as it
 * stands when it fires, so a listener that rewrites or removes a later member leaves the last delivered value equal
 * to the store's. A listener that throws faults the listener, never the commit. The plain MemoryTiddlerStore
 * stays non-atomic, and the port refuses it by name.
 */
export class AtomicMemoryStore extends MemoryTiddlerStore {
  constructor(private readonly atomicBag?: string) { super(atomicBag); }

  async writeFamily(puts: readonly LarTiddlerRecord[], tombstones: readonly string[], origin: ChangeOrigin, _options?: LarWriteOptions): Promise<void> {
    for (const record of puts) assertStorableTitle(record.tiddler.title);
    for (const title of tombstones) assertStorableTitle(title);
    const bag = this.atomicBag !== undefined ? { bag: this.atomicBag } : {};
    const records = this as unknown as { _records: Map<string, LarTiddlerRecord>; _emit(change: LarTiddlerChange): void };
    const changes: LarTiddlerChange[] = [];
    for (const record of puts) {
      records._records.set(record.tiddler.title, record);
      changes.push({ title: record.tiddler.title, record, origin, ...bag });
    }
    for (const title of tombstones) {
      const existing = records._records.get(title);
      records._records.set(title, { ...(existing ?? { tiddler: { title } }), meta: { ...(existing?.meta ?? {}), deleted: true } });
      changes.push({ title, record: null, origin, ...bag });
    }
    for (const change of changes) {
      const live = records._records.get(change.title);
      const fired: LarTiddlerChange = change.record === null
        ? (live?.meta?.deleted === true || live === undefined ? change : { ...change, record: live })
        : (live === undefined ? { ...change, record: null } : { ...change, record: live });
      try { records._emit(fired); } catch { /* the commit stands */ }
    }
  }
}
