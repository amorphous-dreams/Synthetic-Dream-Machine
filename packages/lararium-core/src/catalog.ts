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
// CatalogDoc — Automerge document shape
//
// Keyed by id for O(1) lookup. Automerge handles concurrent writes per entry.
// Keep field count small — this doc loads on every cold boot.
// ---------------------------------------------------------------------------

export interface CatalogDoc {
  readonly schemaVersion: string;
  readonly corpora:    Record<string, CatalogCorpusEntry>;
  readonly rooms:      Record<string, CatalogRoomEntry>;
  readonly recipes:    Record<string, CatalogRecipeEntry>;
  readonly projections: Record<string, CatalogProjectionEntry>;
  /** Capability hints for the connecting peer — read during derive-visible-rooms step. */
  readonly capabilityHints?: Record<string, string>;
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
  };
}
