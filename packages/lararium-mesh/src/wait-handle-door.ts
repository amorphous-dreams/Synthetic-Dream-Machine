/**
 * wait-handle-door: the names the package barrel exports from `wait-handle.ts`, on a subpath of their own.
 *
 * `wait-handle.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { waitHandle, nameDocumentFor, nameDerivedDocument, LOCAL_READY_MS, seatSealedRest, sealedLoadEnding, type SealedRestDoor, type SealedSettlement, type SealedLoadEnding } from "./wait-handle.js";
