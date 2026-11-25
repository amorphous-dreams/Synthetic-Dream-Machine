/**
 * gate-withdrawal-store-door: the names the package barrel exports from `gate-withdrawal-store.ts`, on a subpath of their own.
 *
 * `gate-withdrawal-store.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { GATE_MEMORY_RECORD_MAX_BYTES, storedWithdrawals, GateMemoryRecordTorn } from "./gate-withdrawal-store.js";
export type { GateMemoryRecords } from "./gate-withdrawal-store.js";
