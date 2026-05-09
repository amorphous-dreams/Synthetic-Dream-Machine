/**
 * wiki-handlers — command-tiddler handlers for whole-wiki operations.
 *
 * Reads composite for room oracle tiddlers under
 * `lar:///ha.ka.ba/@lararium/rooms/{slug}`. Each oracle tiddler's `text`
 * field carries the room's Automerge doc URL.
 *
 * E.4 ships the read-only handlers (list, which). E.5+ adds write handlers
 * (init, sync, pin, etc.) when the per-room mint ceremony lands.
 */

import type { CompositeStore } from "@lararium/core";
import type { CommandHandler } from "./command-dispatcher.js";

const ROOM_PREFIX = "lar:///ha.ka.ba/@lararium/rooms/";

export interface WikiHandlerOptions {
  readonly composite: CompositeStore;
}

/**
 * `lares wiki list` — enumerate rooms registered in the catalog.
 *
 * Walks composite.listVisible(), filters titles matching the room oracle
 * shape, returns each as `{ slug, uri, automergeUrl }`. The Automerge URL
 * comes from the oracle tiddler's `text` field.
 */
export function createListWikisHandler(opts: WikiHandlerOptions): CommandHandler {
  return async () => {
    const titles  = await opts.composite.listVisible();
    const wikis: Array<{ slug: string; uri: string; automergeUrl: string | null }> = [];
    for (const title of titles) {
      if (!title.startsWith(ROOM_PREFIX)) continue;
      // Filter to direct children only — slug has no further `/`.
      const tail = title.slice(ROOM_PREFIX.length);
      if (tail.includes("/")) continue;
      const rec  = await opts.composite.get(title);
      wikis.push({
        slug:         tail,
        uri:          title,
        automergeUrl: typeof rec?.text === "string" ? rec.text : null,
      });
    }
    return { wikis };
  };
}
