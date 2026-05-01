/**
 * EngineDoc — Automerge corpus doc for the TW5 engine and bundled plugins.
 *
 * Each blob is stored as Uint8Array (Automerge binary, not CRDT string).
 * This gives O(1) sync cost after the initial transfer — the blob is treated
 * as an immutable unit, not a character sequence.
 *
 * Key conventions:
 *   "tiddlywikicore"            — the TW5 boot kernel (tiddlywikicore-*.js)
 *   "$:/plugins/<author>/<id>"  — vendored TW5 plugins (JSON plugin bundle bytes)
 *
 * Island law: engine doc is separate from the catalog. Catalog holds the URL
 * reference only. Engine doc may be large (~2.5MB) — catalog stays small.
 *
 * Keyhive: each blob entry carries a sha256 for content-addressing.
 * Signature verification is added at the Keyhive layer (planned).
 */

export interface EngineBlobEntry {
  /** Stable id — "tiddlywikicore" or TW5 plugin title like "$:/plugins/sq/streams". */
  readonly id:       string;
  readonly version:  string;
  readonly sha256:   string;   // hex-encoded SHA-256 of blob bytes
  readonly mimeType: string;   // "application/javascript" | "application/json"
  /** Binary blob. Automerge stores as immutable bytes — no per-byte CRDT overhead. */
  readonly blob:     Uint8Array;
  readonly author?:  string;
  readonly license?: string;
  readonly source?:  string;
}

export interface EngineDoc {
  readonly schemaVersion: string;
  /** Keyed by EngineBlobEntry.id. */
  readonly blobs: Record<string, EngineBlobEntry>;
  /**
   * Sorted list of $:/ tiddler titles present in a freshly booted TW5 VM
   * before any corpus tiddlers are loaded.  Written once at seedEngineDoc time.
   *
   * Authority boundary: any $:/ title in this list is engine-owned.
   * Corpus Automerge docs MUST NOT store these titles.
   * TW5 state that falls outside this set (plugin config, personal state)
   * belongs in the personal or session/presence doc.
   *
   * Keyhive: this manifest will be signed as part of the engine island
   * authority proof — changes require a new signed engine doc.
   */
  readonly systemTitles?: readonly string[];
}

export function emptyEngineDoc(): EngineDoc {
  return { schemaVersion: "0.1", blobs: {} };
}

export const ENGINE_CORE_ID = "tiddlywikicore";
