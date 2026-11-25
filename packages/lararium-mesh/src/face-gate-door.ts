/**
 * face-gate-door: the names the package barrel exports from `face-gate.ts`, on a subpath of their own.
 *
 * `face-gate.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { makeFaceGate, presentedAdmitReader, memoryBackedWithdrawals, GATE_SILENCE_REASONS } from "./face-gate.js";
export type {
  FaceGate, FaceGateDeps, GateSocket, GateDeadlines, GateAdmitReader, PlaceContractReading, GateShadowReading, GateShadowRing,
  GateFaceGrantRing, GateSortInput, GateSortVerdict, GateSorter, GateWithdrawalMemory, GateSession, GateSeat, GateSessionTable,
  GateSilenceReason, GateSilenceDetail, GateOutcome,
} from "./face-gate.js";
