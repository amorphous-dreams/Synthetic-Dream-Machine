/**
 * keep-seat-door: the names the package barrel exports from `keep-seat.ts`, on a subpath of their own.
 *
 * `keep-seat.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { mintKeepSeat, mintKeepSeatUnder, openKeepSecret, bindKeepSlot, sealToKeep, openFromKeep, encodeKeepSeat, decodeKeepSeat, signKeepCut, verifyKeepCut, keepVerifyKeyOf } from "./keep-seat.js";
export type { KeepSeat, KeepMint, KeepSecretOpening, KeepSlotBinding, KeepSeatReading } from "./keep-seat.js";
