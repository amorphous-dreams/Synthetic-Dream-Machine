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
   * Bag stamped as "lararium" on each record. Recipe priority: lararium < catalog < lares < corpus < room.
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
 * lar: URI grammar — six root docs in two planes.
 *
 * Position semantics (zero-indexed path segments after lar:///)
 *
 *   pos 0  — what3words tagspace host, e.g. "ha.ka.ba"
 *   pos 1  — @-prefixed root doc identity (EXACTLY six reserved slots, see below)
 *   pos 2  — @-prefixed child doc identity   e.g. @catalog/@elyncia
 *            OR plain leaf path segment      e.g. @lararium/rooms/altar-fire
 *   pos 3+ — plain leaf path segments, never @-prefixed
 *
 * Rule: @ ONLY at pos 1 (root doc) or pos 2 (child doc under a root).
 *       @ NEVER at pos 3+.
 *       Any bare @name at pos 1 = exactly one Automerge doc identity.
 *
 * CONTENT PLANE (Automerge Tiga — ha / ka / ba):
 *   @lararium   LarariumDoc  — ha: engine, grammar, admin rooms, ha-recipes
 *   @catalog    CatalogDoc   — ka: corpus discovery, user rooms, ka-recipes
 *   @lares      LaresDoc     — ba: persona/doctrine, ba-recipes
 *
 * SOCIAL PLANE (identity / authority / session):
 *   @identities IdentitiesDoc — stable principal records (operators, agents, services)
 *   @groups     GroupsDoc     — collective authority + durable membership
 *   @sessions   SessionsDoc   — live operator-agent session docs
 *
 * Corpus child-docs live under ka (pos-2 @ slot):
 *   lar:///ha.ka.ba/@catalog/@elyncia   → elyncia corpus doc
 *   lar:///ha.ka.ba/@catalog/@ftls      → ftls corpus doc
 *
 * Rooms remain leaf paths (no @ at pos 2):
 *   lar:///ha.ka.ba/@lararium/rooms/{slug}  → admin/operator room (ha branch)
 *   lar:///ha.ka.ba/@catalog/rooms/{slug}   → user room (ka branch, M22+)
 *
 * Oracle chain:
 *   fragment → ha (LarariumDoc) → tiddlers[CATALOG_DOC_URI]   → CatalogDoc
 *                               → tiddlers[LARES_DOC_URI]      → LaresDoc
 *                               → tiddlers[IDENTITIES_DOC_URI] → IdentitiesDoc
 *                               → tiddlers[GROUPS_DOC_URI]     → GroupsDoc
 *                               → tiddlers[SESSIONS_DOC_URI]   → SessionsDoc
 *   CatalogDoc → tiddlers[corpusLarUri(slug)]  → corpus child-docs
 *             → tiddlers[roomLarUri(slug)]    → room leaf docs
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/automerge-tiga
 */

// ── Content plane — Automerge Tiga ──────────────────────────────────────────

/** ha vertex — engine / grammar / admin rooms / ha-recipes. */
export const LARARIUM_DOC_URI = "lar:///ha.ka.ba/@lararium";

/** ka vertex — corpus discovery / user rooms / ka-recipes. */
export const CATALOG_DOC_URI = "lar:///ha.ka.ba/@catalog";

/** ba vertex — persona / doctrine / ba-recipes. */
export const LARES_DOC_URI = "lar:///ha.ka.ba/@lares";

// ── Social plane — identity / authority / session ───────────────────────────

/** Stable principal records — operators, agents, services, devices. */
export const IDENTITIES_DOC_URI = "lar:///ha.ka.ba/@identities";

/** Collective authority + durable group membership. */
export const GROUPS_DOC_URI = "lar:///ha.ka.ba/@groups";

/** Live operator-agent session docs; hostful overlays project into these. */
export const SESSIONS_DOC_URI = "lar:///ha.ka.ba/@sessions";

/**
 * Derive the stable lar: URI identity for a named corpus child-doc.
 * Corpus docs sit at pos-2 under the @catalog root doc.
 * e.g. corpusLarUri("elyncia") → "lar:///ha.ka.ba/@catalog/@elyncia"
 */
export function corpusLarUri(slug: string): string {
  return `lar:///ha.ka.ba/@catalog/@${slug}`;
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
