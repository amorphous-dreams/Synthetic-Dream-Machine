/**
 * LarOpenPhase — canonical peer boot sequence shared by all platform peers.
 *
 * Defined once here in @lararium/core so browser and node peers can both
 * alias it without maintaining identical string unions in two places.
 *
 * Phase order (monotonic — never goes backward):
 *   boot → repo-open → catalog-ready → island-ready → wiki-ready →
 *   draft-ready → peer-ready → tw5-booted → corpus-ready → live
 */
export type LarOpenPhase =
  | "boot"           // factory called; repo not yet open
  | "repo-open"      // Repo + adapters initialized
  | "catalog-ready"  // catalog DocHandle resolved
  | "island-ready"   // LarariumIsland (system bag) resolved — may arrive async
  | "wiki-ready"     // wiki DocHandle resolved
  | "draft-ready"    // wiki-drafts DocHandle resolved
  | "peer-ready"     // LarPeer constructed, CompositeStore wired
  | "tw5-booted"     // TW5Engine.boot() resolved
  | "corpus-ready"   // corpus bags attached (fires once all initial corpora loaded)
  | "live";          // MemeSyncAdaptor wired, VmPool attached
