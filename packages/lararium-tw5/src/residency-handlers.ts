/**
 * residency-handlers — verb-tiddler handlers for operator-driven
 * residency read: residency (stats).
 *
 * Operators invoke it via `lares residency`. Each handler closes over the BagStowage
 * the daemon constructs at boot.
 */

import type { VerbReactor } from "./verb-dispatcher.js";
import type { BagStowage } from "@lararium/mesh/bag-residency";

export interface ResidencyHandlerOptions {
  readonly residency: BagStowage;
}

// register-cold lives in @lararium/tw5 (worker-data-verbs) — it runs
// in the daemon worker (sovereign-worker, verify-then-delegate gated) and command this
// main-resident BagStowage via daemon:residency-op. A lit face holds what it needs warm (`holdLit`) and a face's keep list holds the wikis it names; no operator verb pins a bag. Only the `residency` stats
// READ stays main (the manager lives here); the askMain research decides its eventual home.

export function makeResidencyStatsReactor(opts: ResidencyHandlerOptions): VerbReactor {
  return async () => {
    const stats = opts.residency.stats();
    return {
      clockKind: stats.clockKind,
      pinned:   [...stats.pinned],
      wela:     stats.wela.map((e) => ({
        url:         e.url,
        idleFor:     e.idleFor,
        ...(e.syncActive !== undefined && { syncActive: e.syncActive }),
      })),
      anuCount: stats.anuCount,
      hotCap:   stats.hotCap,
    };
  };
}
