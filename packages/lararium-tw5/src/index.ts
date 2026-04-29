/**
 * @lararium/tw5 — hosted TW5 implementation for Lararium.
 *
 * Carries:
 *   LarariumTW5          — isomorphic TW5 boot/filter/render interface
 *   LarariumCrdtSyncAdaptor — TW5 SyncAdaptor backed by LarTiddlerStore
 *   MemoryTiddlerStore   — in-memory LarTiddlerStore (tests / fixtures)
 *   filterMemesWikitext  — functional API (backward compat with @lararium/node)
 *   toCanonicalWikitext  — wikitext-filter pre-processor (exported for @lararium/core/cascade)
 *   FilterEngineFn       — injectable filter engine type
 *   entryToFields        — ClosureEntry → TW5 tiddler fields
 *   buildEdgeFieldMap    — pranala edges → TW5 edge-out-* fields
 *
 * Architecture law:
 *   This package owns TW5-compatible interpretation of authorized tiddler state.
 *   It does not own Lararium state, lar:/// identity, Orichalcum authority,
 *   graph law, causal-island law, or canon-promotion ceremony.
 *   @lararium/core owns those contracts. @lararium/node and @lararium/app
 *   bind this package to their respective runtime environments.
 */

export {
  LarariumTW5,
  filterMemesWikitext,
  filterMemesTW,
  filterMemesBrowser,
  precomputeRooms,
  toCanonicalWikitext,
  entryToFields,
  buildEdgeFieldMap,
} from "./lararium-tw5.js";

export type { FilterEngineFn } from "./lararium-tw5.js";

export { LarariumCrdtSyncAdaptor } from "./sync-adaptor.js";
export { MemoryTiddlerStore }      from "./memory-store.js";
