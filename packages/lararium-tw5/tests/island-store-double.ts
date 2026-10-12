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

export function asIslandStore<T extends LarTiddlerStore>(store: T, working = "lar:///ha.ka.ba/wikis/test/working"): T & IslandStore {
  const s = store as T & Partial<IslandStore>;
  s.tombstoneInBag ??= (_bag: string, title: string, origin: ChangeOrigin): Promise<void> => store.tombstone(title, origin);
  s.writeFamily ??= async (
    puts: readonly LarTiddlerRecord[], tombstones: readonly string[], origin: ChangeOrigin, options?: LarWriteOptions,
  ): Promise<void> => {
    for (const record of puts) await store.put(record, origin, options);
    for (const title of tombstones) await s.tombstoneInBag!(options?.bag ?? "", title, origin);
  };
  // ONE STORE STANDS FOR THE WHOLE COMPOSITION. It is the working layer (`working`), and every bag a suite
  // names is that one layer, so layer order cannot be told apart here: a tombstone lands where its title
  // landed and a resolved record names the working layer. Suites that witness where a delete lands, or which
  // layer answers, stand over a real `CompositeStore` (`wiki-shore-rig.ts`).
  s.defaultWritableBagId ??= () => working;
  s.layerIndexOf ??= () => 0;
  s.resolveLayered ??= async (title: string) => {
    const record = await store.get(title);
    return record ? { bagId: working, record } : null;
  };
  return s as T & IslandStore;
}
