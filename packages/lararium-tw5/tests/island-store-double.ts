/**
 * island-store-double — a single test store standing where the wiki's `CompositeStore` stands.
 *
 * The adaptor writes through the composite's bag-naming surface (`writeFamily`, `tombstoneInBag`).
 * A suite that watches ONE store fill gets that surface laid over it: a family lands member by member
 * through the store's own `put` (so a recording `put` sees each member and the bag it named), and its
 * tombstones through `tombstoneInBag` — the store's own when it records one, else its `tombstone`.
 * A store that already carries either method keeps its own.
 */

import type { ChangeOrigin, LarTiddlerRecord, LarTiddlerStore, LarWriteOptions } from "@lararium/mesh";
import type { IslandStore } from "../src/island-adaptor.js";

export function asIslandStore<T extends LarTiddlerStore>(store: T): T & IslandStore {
  const s = store as T & Partial<IslandStore>;
  s.tombstoneInBag ??= (_bag: string, title: string, origin: ChangeOrigin): Promise<void> => store.tombstone(title, origin);
  s.writeFamily ??= async (
    puts: readonly LarTiddlerRecord[], tombstones: readonly string[], origin: ChangeOrigin, options?: LarWriteOptions,
  ): Promise<void> => {
    for (const record of puts) await store.put(record, origin, options);
    for (const title of tombstones) await s.tombstoneInBag!(options?.bag ?? "", title, origin);
  };
  return s as T & IslandStore;
}
