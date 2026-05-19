/**
 * MemeStoreDoc — Automerge document shape for a room or corpus content island.
 *
 * MemeStoreDoc extends LarDoc — same `{ schemaVersion, tiddlers }` shape
 * as every other Lararium Automerge document.  `tiddlers` remains a writable
 * Record (not Readonly) so AutomergeDocStore can mutate it inside change().
 *
 * Key = tiddler title (lar:/// URI for corpus; short title for wiki draft).
 * The bag field stamps the recipe priority slot: corpus slug for corpus islands,
 * wikiDraftLarUri(slug) for the wiki's top draft island.
 *
 * MutableLarRecord now lives in base-doc.ts (single canonical definition).
 * Re-exported here for backward-compat with existing importers.
 */

import type { LarDoc, MutableLarRecord } from "./base-doc.js";
export type { MutableLarRecord } from "./base-doc.js";

/**
 * MemeStoreDoc — writable tiddler-store document.
 *
 * Extends LarDoc: `schemaVersion` + `tiddlers` constitute the canonical shape.
 * No extra fields — the whole payload lives in `tiddlers`.
 */
export interface MemeStoreDoc extends LarDoc {
  readonly tiddlers: Record<string, MutableLarRecord>;  // writable inside change()
}

/** Safe empty state for repo.create<MemeStoreDoc>(). */
export function emptyMemeStoreDoc(): MemeStoreDoc {
  return { schemaVersion: "0.1", tiddlers: {} };
}
