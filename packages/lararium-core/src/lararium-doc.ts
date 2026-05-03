/**
 * LarariumDoc — Automerge corpus doc for the TW5 engine and bundled plugins.
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

import type { MutableLarRecord } from "./meme-store-doc.js";
export type { MutableLarRecord };

export interface LarariumBlobEntry {
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

export interface LarariumDoc {
  readonly schemaVersion: string;
  /** Keyed by LarariumBlobEntry.id. */
  readonly blobs: Record<string, LarariumBlobEntry>;
  /**
   * System tiddlers keyed by `lar:` URI (or TW5 title for $:/ namespace).
   *
   * Holds first-class tiddlers that belong to the engine island rather than
   * a corpus or room doc. Seeded at island creation time and reconciled on
   * resume boots. Current residents:
   *   - grammar meme  (lar:///ha.ka.ba/@lares/grammars/memetic-wikitext)
   *
   * Bag stamped as "system" on each record. Recipe priority: system < corpus < room.
   * Operator overrides use a higher-priority bag (Invariant 4 of grammar-invariants.ts).
   *
   * Value type is `Readonly<MutableLarRecord>` — these records are engine-owned and
   * must only be written via `seedGrammarTiddler` / `reconcileGrammarTiddlerIfChanged`.
   * `MutableLarRecord` (non-readonly) is the Automerge write-layer shape used internally
   * inside `handle.change()` callbacks.
   *
   * Optional for backward-compat with engine docs created before this field existed;
   * `emptyLarariumDoc()` always initializes it as `{}`.
   */
  readonly tiddlers?: Record<string, Readonly<MutableLarRecord>>;
  /**
   * Sorted list of $:/ tiddler titles present in a freshly booted TW5 VM
   * before any corpus tiddlers are loaded.  Written once at seedLarariumDoc time.
   *
   * Authority boundary: any $:/ title in this list is engine-owned.
   * Corpus Automerge docs MUST NOT store these titles.
   * TW5 state that falls outside this set (plugin config, personal state)
   * belongs in the personal or session/presence doc.
   *
   * Keyhive: this manifest will be signed as part of the lararium island
   * authority proof — changes require a new signed engine doc.
   */
  readonly systemTitles?: readonly string[];
}

export function emptyLarariumDoc(): LarariumDoc {
  return { schemaVersion: "0.1", blobs: {}, tiddlers: {}, systemTitles: [] };
}

export const ENGINE_CORE_ID = "tiddlywikicore";

/**
 * Well-known tiddler address — the LarariumDoc self-reference.
 *
 * The `@lararium` scope root IS the LarariumDoc. No sub-path needed.
 * Stored inside LarariumDoc.tiddlers. Its `text` field holds the current
 * `automerge:` URL of the LarariumDoc itself (self-referential).
 *
 * Analogous to IPNS (stable name → mutable pointer to current content) and
 * AT Protocol `.well-known/atproto-did` (stable path → current DID).
 * Any peer that has synced the LarariumDoc can read this tiddler and recover
 * the root doc URL — no out-of-band oracle required.
 *
 * Namespace clarity:
 *   lar:///ha.ka.ba/@lararium              ← this constant (engine root oracle)
 *   lar:///ha.ka.ba/@lararium/catalogDocUri ← catalog URL slot
 *   lar:///ha.ka.ba/@lararium/rooms/{slug}  ← room identifiers (no collision)
 */
export const LARARIUM_DOC_URI = "lar:///ha.ka.ba/@lararium";

/**
 * Well-known tiddler address — the CatalogDoc identity URI.
 *
 * Dual purpose (mirrors LARARIUM_DOC_URI):
 *   1. The slot key in LarariumDoc.tiddlers whose `text` = the CatalogDoc automerge: URL.
 *   2. The key in CatalogDoc.tiddlers for the catalog's own self-reference tiddler.
 *
 * Boot sequence: URL fragment → open LarariumDoc → read this tiddler → open CatalogDoc.
 *
 * Named doc pattern — all `@`-prefixed scopes in ha.ka.ba ARE doc identities:
 *   lar:///ha.ka.ba/@lararium  → LarariumDoc (engine)
 *   lar:///ha.ka.ba/@catalog   → CatalogDoc  (hallway)
 *   lar:///ha.ka.ba/@elyncia   → elyncia corpus doc   (tiddler in CatalogDoc.tiddlers)
 *   lar:///ha.ka.ba/@ftls      → ftls corpus doc       (tiddler in CatalogDoc.tiddlers)
 *   lar:///ha.ka.ba/@sdm       → sdm corpus doc        (tiddler in CatalogDoc.tiddlers)
 */
export const CATALOG_DOC_URI = "lar:///ha.ka.ba/@catalog";

/**
 * Derive the stable lar: URI identity for a named corpus doc.
 * e.g. corpusLarUri("elyncia") → "lar:///ha.ka.ba/@elyncia"
 */
export function corpusLarUri(slug: string): string {
  return `lar:///ha.ka.ba/@${slug}`;
}

/**
 * Derive the stable lar: URI identity for a room.
 * Rooms live in the @lararium sub-namespace — no collision with @-scope doc roots.
 * e.g. roomLarUri("altar-fire") → "lar:///ha.ka.ba/@lararium/rooms/altar-fire"
 *
 * This URI forms the map key in CatalogDoc.rooms.
 * The CatalogRoomEntry.id field retains the short slug for readability.
 */
export function roomLarUri(slug: string): string {
  return `lar:///ha.ka.ba/@lararium/rooms/${slug}`;
}
