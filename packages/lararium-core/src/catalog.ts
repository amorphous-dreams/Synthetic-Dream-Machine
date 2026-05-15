import type { LarDoc } from "./base-doc.js";
import type { MutableLarRecord } from "./base-doc.js";

/**
 * CatalogDoc — the tiny root Automerge document that names all islands.
 *
 * Doctrine (research packet §8 principle 8):
 *   The catalog serves as the hallway. Corpus docs function as libraries. Wiki docs function as shrines.
 *   The catalog MUST stay small and warmable. It MUST NOT contain full corpus.
 *
 * Boot order:
 *   auth.ready → catalog doc opens → catalog.ready → wiki/corpus docs open
 *   per-island: corpus:<id>.ready, wiki-content.ready, wiki-presence.ready
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
  /** Automerge URL for the wiki content doc (durable meaning: pins, notes). */
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
// Extends LarDoc (M24): `tiddlers` required, not optional.
// `corpora`, `wikis`, `recipes`, `projections` remain as legacy typed Records
// for backward-compat.  New code MUST use `tiddlers` as the authoritative
// oracle — these Records exist as a read-optimisation cache only and will be
// deprecated once all call sites migrate to tiddler-first lookups.
//
// Keyed by id for O(1) lookup. Automerge handles concurrent writes per entry.
// Keep field count small — this doc loads on every cold boot.
// ---------------------------------------------------------------------------

export interface CatalogDoc extends LarDoc {
  readonly tiddlers: Record<string, Readonly<MutableLarRecord>>;
  /**
   * @deprecated Use tiddlers keyed by corpusLarUri(slug) instead.
   * Legacy corpus index for backward-compat — entries here are now mirrored
   * as tiddlers by all boot-sequence peers.  Will be removed in M25+.
   */
  readonly corpora:    Record<string, CatalogCorpusEntry>;
  /**
   * @deprecated Use tiddlers keyed by wikiLarUri(slug) instead.
   * Legacy wiki index — mirrored as tiddlers at boot. Will be removed in M25+.
   */
  readonly wikis:      Record<string, CatalogRoomEntry>;
  readonly recipes:    Record<string, CatalogRecipeEntry>;
  readonly projections: Record<string, CatalogProjectionEntry>;
  /** LarariumDoc reference — separate island doc, binary blobs, Keyhive-signed. */
  readonly larariumDoc?:  CatalogLarariumEntry;
  /** Capability hints for the connecting peer — read during derive-visible-wikis step. */
  readonly capabilityHints?: Record<string, string>;
}

export function emptyCatalogDoc(): CatalogDoc {
  return {
    schemaVersion: "0.1",
    corpora:       {},
    wikis:         {},
    recipes:       {},
    projections:   {},
    tiddlers:      {},
  };
}
