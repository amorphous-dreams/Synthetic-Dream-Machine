/**
 * meme-sinks — the store skins of `placeMeme`.
 *
 * `placeMeme` speaks four verbs over whatever holds tiddlers (`MemeSink`). Two skins stand here:
 *
 *   · `storeMemeSink`     — one bag's OWN store (`LarTiddlerStore`): the bag's doc reached by access, a
 *                           mounted layer, a memory store in a test. The store IS the residency; the
 *                           record carries no stamp of it.
 *   · `compositeMemeSink` — a bag the island MOUNTS WRITABLE, looked up through `writableStoreForBag`.
 *                           A bag with no writable layer fails loud, naming the bag: a placement into a
 *                           NAMED bag never shadows up to the default writable (that misroute is the
 *                           confused-deputy bug the residency law forbids).
 *
 * A tombstoned record stays in the store as a kāpae hide; the sink reads it as absent, so the placement
 * never re-tombstones or re-reads a hidden title.
 *
 * `bag` IS USER SPACE. Residency rides the envelope — the store a record sits in, the `bag` option a
 * put carries, the `$origin-bag` the nalu stamps on the wiki side — never a field on the record. An
 * author's own `bag` (an NPC's inventory) lands and reads back whole, and the canonical render — the
 * hash a writer holds as its base — reads the meme alone.
 *
 * Runs daemon-side (a plain module, never a plugin tiddler).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/meme-sinks
 */

import type { ChangeOrigin, CompositeStore, LarTiddlerRecord, LarTiddlerStore } from "@lararium/mesh";
import type { TiddlerFields } from "./deserializer.js";
import type { MemeSink } from "./place-meme.js";

/** The `LarTiddlerStore` skin — one bag's own store; the put option names the residency. */
export function storeMemeSink(store: LarTiddlerStore, bag: string, origin: ChangeOrigin): MemeSink {
  return {
    titles: () => store.listVisible(),
    read: async (title) => {
      const rec = await store.get(title);
      if (!rec || rec.meta?.deleted) return undefined;
      return rec.tiddler as unknown as TiddlerFields;
    },
    land: (fields) => {
      const record: LarTiddlerRecord = {
        tiddler: { ...(fields as Record<string, unknown>), title: String(fields.title) },
        meta: {},
      };
      return store.put(record, origin, { bag });
    },
    tombstone: (title) => store.tombstone(title, origin),
  };
}

/**
 * The composite skin — the bag's WRITABLE layer, or a loud refusal naming the bag. Null from
 * `writableStoreForBag` means the island cannot write that bag; nothing here guesses a default.
 */
export function compositeMemeSink(composite: CompositeStore, bag: string, origin: ChangeOrigin): MemeSink {
  const store = composite.writableStoreForBag(bag);
  if (!store) {
    throw new Error(`meme: bag "${bag}" holds no writable layer in this island — a placement never shadows up to the default writable`);
  }
  return storeMemeSink(store, bag, origin);
}
