/**
 * tree-key-door: the names the package barrel exports from `tree-key.ts`, on a subpath of their own.
 *
 * `tree-key.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { mintTreeKey, treeKeyEquals } from "./tree-key.js";
export type { TreeKey, TreeKeyOpening } from "./tree-key.js";
