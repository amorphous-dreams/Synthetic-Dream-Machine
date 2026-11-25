/**
 * noise-ik-door: the names the package barrel exports from `noise-ik.ts`, on a subpath of their own.
 *
 * `noise-ik.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { NOISE_MAX_MESSAGE_BYTES, MIN_MESSAGE1_BYTES, MIN_MESSAGE2_BYTES } from "./noise-ik.js";
