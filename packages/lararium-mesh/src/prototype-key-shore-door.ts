/**
 * prototype-key-shore-door: the names the package barrel exports from `prototype-key-shore.ts`, on a subpath of their own.
 *
 * `prototype-key-shore.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { shoreInbound, shoreStorage, syncMessagePrototypeKey, chunkPrototypeKey, docPrototypeKeyFault, assertNoPrototypeKeys, type PrototypeKeyRefusal } from "./prototype-key-shore.js";
