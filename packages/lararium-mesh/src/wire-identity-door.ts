/**
 * wire-identity-door: the names the package barrel exports from `wire-identity.ts`, on a subpath of their own.
 *
 * `wire-identity.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { wireIdentityOf, seatDialLeg } from "./wire-identity.js";
export type { WireIdentity, WireAlias, WireLegAt, WireLegSeat, WireLegRefusal, WornFace } from "./wire-identity.js";
