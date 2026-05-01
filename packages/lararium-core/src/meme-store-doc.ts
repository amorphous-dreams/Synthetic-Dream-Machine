/**
 * MemeStoreDoc — Automerge document shape for a room or corpus content island.
 *
 * Lives in @lararium/core so both the browser (lararium-app) and server
 * (lararium-node) can type their Automerge handles without a cross-package dep.
 *
 * Key = tiddler title (lar:/// URI for corpus; short title for room).
 * The bag field stamps the recipe priority slot: corpus slug for corpus islands,
 * "room" for the room island. _freeze() in AutomergeMemeStore uses it.
 */

export interface MutableLarRecord {
  title:        string;
  fields:       Record<string, string>;
  text?:        string;
  deleted?:     boolean;
  sourceUri?:   string;
  contentHash?: string;
  revision?:    string;
  authority?:   string;
  /** Corpus slug ("lares", "elyncia", …) or "room". Stamped at write time. */
  bag?:         string;
}

export type MemeStoreDoc = Record<string, MutableLarRecord>;
