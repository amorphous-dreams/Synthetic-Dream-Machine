/**
 * gated-sync-leg-door: the names the package barrel exports from `gated-sync-leg.ts`, on a subpath of their own.
 *
 * `gated-sync-leg.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { GatedSyncLeg, oneWayDocumentsGate, carriesPrototypeKeyReason } from "./gated-sync-leg.js";
export type { SyncLegGate, LegRefusal } from "./gated-sync-leg.js";
