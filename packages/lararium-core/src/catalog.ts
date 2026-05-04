import type { MutableLarRecord } from "./meme-store-doc.js";

/**
 * CatalogDoc — the tiny root Automerge document that names all islands.
 *
 * Doctrine (research packet §8 principle 8):
 *   The catalog is the hallway. Corpus docs are libraries. Room docs are shrines.
 *   The catalog MUST stay small and warmable. It MUST NOT contain full corpus.
 *
 * Boot order:
 *   auth.ready → catalog doc opens → catalog.ready → room/corpus docs open
 *   per-island: corpus:<id>.ready, room-content.ready, room-presence.ready
 *
 * Authority-first-sync-order law:
 *   Catalog URL is injected by the server after auth, never guessed from localStorage.
 *   A peer that has not completed auth MUST NOT receive catalog content.
 */

// ---------------------------------------------------------------------------
// Island descriptors — entries inside the catalog doc
// ---------------------------------------------------------------------------

export interface CatalogCorpusEntry {
  readonly id:            string;
  /** Automerge URL for the corpus CRDT doc. */
  readonly docUrl:        string;
  /** HTTP URL for a pre-rendered projection snapshot (first-paint path). */
  readonly snapshotUrl?:  string;
  /** Automerge heads at time of last snapshot — used to detect stale projections. */
  readonly snapshotHeads?: readonly string[];
  /** Human-readable label. */
  readonly label?:        string;
  /** Schema/migration version for this corpus doc. */
  readonly schemaVersion: string;
  /** Receipt id of the last canon-promotion ceremony touching this corpus. */
  readonly receiptId?:    string;
}

export interface CatalogRoomEntry {
  readonly id:              string;
  /** Automerge URL for the room content doc (durable meaning: pins, notes). */
  readonly contentDocUrl:   string;
  /** Automerge URL or ephemeral channel for presence (cursors, typing, attention). */
  readonly presenceDocUrl?: string;
  readonly snapshotUrl?:    string;
  readonly snapshotHeads?:  readonly string[];
  readonly label?:          string;
  readonly schemaVersion:   string;
  readonly receiptId?:      string;
}

export interface CatalogRecipeEntry {
  readonly id:      string;
  /** Ordered bag stack, low-priority first (mirrors TW5 recipe/bag convention). */
  readonly bagStack: readonly string[];
}

export interface CatalogProjectionEntry {
  readonly id:            string;
  readonly projectionType: string;
  readonly sourceIslandId: string;
  readonly receiptId:     string;
  readonly url?:          string;
}

// ---------------------------------------------------------------------------
// LarariumDoc entry — points to the LarariumDoc island (system bag).
//
// Kept out of CatalogCorpusEntry (different schema, binary blobs, no lares path).
// The catalog carries the reference only — the LarariumDoc is a separate island.
// ---------------------------------------------------------------------------

export interface CatalogLarariumEntry {
  /** TW5 core version string — "5.4.0". Browsers compare against loaded version. */
  readonly version:    string;
  /** Automerge URL for the LarariumDoc. */
  readonly docUrl:     string;
  /** SHA-256 of the tiddlywikicore blob — content-addressed quick-check. */
  readonly sha256:     string;
}

// ---------------------------------------------------------------------------
// CatalogDoc — Automerge document shape
//
// Keyed by id for O(1) lookup. Automerge handles concurrent writes per entry.
// Keep field count small — this doc loads on every cold boot.
// ---------------------------------------------------------------------------

export interface CatalogDoc {
  readonly schemaVersion: string;
  readonly corpora:    Record<string, CatalogCorpusEntry>;
  /**
   * Room entries, keyed by `lar:///ha.ka.ba/@lararium/rooms/{slug}`.
   * Use `roomLarUri(slug)` from `@lararium/core` to form the key.
   * `CatalogRoomEntry.id` holds the short slug for human-readable display.
   */
  readonly rooms:      Record<string, CatalogRoomEntry>;
  readonly recipes:    Record<string, CatalogRecipeEntry>;
  readonly projections: Record<string, CatalogProjectionEntry>;
  /** LarariumDoc reference — separate island doc, binary blobs, Keyhive-signed. */
  readonly larariumDoc?:  CatalogLarariumEntry;
  /** Capability hints for the connecting peer — read during derive-visible-rooms step. */
  readonly capabilityHints?: Record<string, string>;
  /**
   * Named doc tiddler store — keyed by `lar:///ha.ka.ba/@{slug}`.
   * Bag stamped as "catalog" on each record (ka vertex of the Automerge Tiga).
   *
   * Each corpus / named island doc is stored here as a tiddler whose
   * `text` field holds its current `automerge:` URL.  Isomorphic to
   * LarariumDoc.tiddlers: any peer that has synced the CatalogDoc can
   * enumerate all available corpora without a separate HTTP oracle.
   *
   * Reserved keys:
   *   "lar:///ha.ka.ba/@catalog"  — self-reference (ka self-ref tiddler)
   *
   * Corpus keys (written by node peer on first boot / resume):
   *   "lar:///ha.ka.ba/@elyncia"  → Elyncia world corpus automerge URL
   *   "lar:///ha.ka.ba/@ftls"     → Flying Triremes & Laser Swords corpus
   *   "lar:///ha.ka.ba/@sdm"      → Synthetic Dream Machine corpus
   */
  readonly tiddlers?: Record<string, Readonly<MutableLarRecord>>;
}

// ---------------------------------------------------------------------------
// Empty catalog — safe initial state for repo.create()
// ---------------------------------------------------------------------------

export function emptyCatalogDoc(): CatalogDoc {
  return {
    schemaVersion: "0.1",
    corpora:       {},
    rooms:         {},
    recipes:       {},
    projections:   {},
    tiddlers:      {},
  };
}
