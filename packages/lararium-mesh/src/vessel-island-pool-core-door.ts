/**
 * vessel-island-pool-core-door: the names the package barrel exports from `vessel-island-pool-core.ts`, on a subpath of their own.
 *
 * `vessel-island-pool-core.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { VesselIslandPoolCore, resolveDiskMirrors } from "./vessel-island-pool-core.js";
export type { VesselIslandPoolCoreOptions, VesselRestState, DiskMirrorGrant } from "./vessel-island-pool-core.js";
