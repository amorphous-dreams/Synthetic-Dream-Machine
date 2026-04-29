/**
 * LarTiddlerStore — TW5-neutral tiddler store contract.
 *
 * Owned by @lararium/core. No tiddlywiki runtime import.
 * Implemented by @lararium/tw5 (CrdtTiddlerStore, CanonTiddlerStore, MemoryTiddlerStore).
 *
 * Bags/layers model:
 *   core   — TW5 core / plugin / shadow tiddlers
 *   canon  — hostless lares/ carriers (promoted, long-lived)
 *   room   — shared live room edits (CRDT-backed)
 *   user   — operator private notes and personal overlays
 *   session — drafts, focus state, $:/temp/*, cursors (personal)
 *
 * Priority order: core < canon < room < user < session
 *
 * Hard rules:
 *   - room layer may override canon for live view; must not mutate canon.
 *   - session layer must not leak $:/temp/* or "Draft of ..." into shared state.
 *   - canon promotion requires Orichalcum ceremony (separate write path, not store.put).
 *   - tombstone() marks deletion in live room state; no hard delete by default.
 */

import type { ClosureEntry, EdgeRecord } from "./compiler.js";

// ---------------------------------------------------------------------------
// LarTiddlerRecord — materialized tiddler in Lararium's store model
// ---------------------------------------------------------------------------

export interface LarTiddlerRecord {
  /** TW5 title — same as the meme's lar:/// URI for corpus tiddlers. */
  readonly title:        string;
  /** All non-text fields as string values. */
  readonly fields:       Readonly<Record<string, string>>;
  /** Body wikitext (may be absent for skinny/index records). */
  readonly text?:        string;
  /** True when this record carries a tombstone marker. */
  readonly deleted?:     boolean;
  /** Originating lar:/// URI — absent for session/draft tiddlers. */
  readonly sourceUri?:   string;
  /** SHA-256 of carrier text at time of materialization. */
  readonly contentHash?: string;
  /** Monotonic or content-addressed revision string (CRDT head, receipt SHA, etc.). */
  readonly revision?:    string;
  /** Orichalcum authority context that authorized this record. */
  readonly authority?:   string;
  /** Bag this record belongs to. */
  readonly bag?:         "core" | "canon" | "room" | "user" | "session";
  /** Recipe URI that resolved this record. */
  readonly recipe?:      string;
}

// ---------------------------------------------------------------------------
// ChangeOrigin — audit trail for every store mutation
// ---------------------------------------------------------------------------

/**
 * Carried by every store.put() and store.tombstone() call.
 * Used by LarariumCrdtSyncAdaptor to prevent echo loops:
 *   - TW local edits must not round-trip as remote changes.
 *   - CRDT remote changes must not fire back as local TW edits.
 */
export type ChangeOrigin =
  | { readonly kind: "tw-local";        readonly instanceId: string }
  | { readonly kind: "crdt-remote";     readonly edgeIsland: string }
  | { readonly kind: "canon-hydrate";   readonly receipt:    string }
  | { readonly kind: "mcp-draft";       readonly toolCallId: string }
  | { readonly kind: "operator-import"; readonly sessionId:  string }
  | { readonly kind: "canvas-draft";    readonly shapeId:    string };

// ---------------------------------------------------------------------------
// LarTiddlerChange — stream unit from store.subscribe()
// ---------------------------------------------------------------------------

export interface LarTiddlerChange {
  readonly title:     string;
  /** null indicates a tombstone (deletion marker). */
  readonly record:    LarTiddlerRecord | null;
  readonly origin:    ChangeOrigin;
  readonly revision?: string;
}

// ---------------------------------------------------------------------------
// LarTiddlerStore — the canonical store interface
// ---------------------------------------------------------------------------

export interface LarTiddlerStore {
  /**
   * Returns titles of all tiddlers visible under current authority.
   * Applies room recipe + Orichalcum ability checks.
   * Never returns $:/temp/* or "Draft of ..." titles for other sessions.
   */
  listVisible(): Promise<string[]>;

  /**
   * Materialize one authorized tiddler record.
   * Returns null if the title does not exist or the caller lacks read ability.
   */
  get(title: string): Promise<LarTiddlerRecord | null>;

  /**
   * Write a record to live room state.
   * Must NOT write to lares/ (canon path). Canon promotion requires Orichalcum ceremony.
   * origin carries the audit trail and echo-loop guard.
   */
  put(record: LarTiddlerRecord, origin: ChangeOrigin): Promise<void>;

  /**
   * Mark a title deleted in live room state.
   * Does not hard-delete. Tombstoned titles disappear from listVisible() by default.
   * origin carries the audit trail.
   */
  tombstone(title: string, origin: ChangeOrigin): Promise<void>;

  /**
   * Subscribe to store changes. Returns an unsubscribe function.
   * Fires for every put() and tombstone() — including remote CRDT changes.
   * Subscribers MUST check change.origin before writing back to avoid echo loops.
   */
  subscribe(fn: (change: LarTiddlerChange) => void): () => void;
}

// ---------------------------------------------------------------------------
// FilterEngineFn — TW5-neutral injectable filter type
//
// Defined here so @lararium/core/cascade can import it without depending on
// @lararium/tw5 (which would create a circular dependency). @lararium/tw5
// re-exports this type from @lararium/core.
// ---------------------------------------------------------------------------

/**
 * Injectable async filter engine — consumed by compileCascade in cascade.ts.
 * Implemented by @lararium/tw5's filterMemesWikitext / LarariumTW5.filterClosure.
 * The edges param enables the edge: wikitext-filter operator.
 */
export type FilterEngineFn = (
  expr:    string,
  closure: readonly ClosureEntry[],
  edges?:  readonly EdgeRecord[],
) => Promise<ClosureEntry[]>;
