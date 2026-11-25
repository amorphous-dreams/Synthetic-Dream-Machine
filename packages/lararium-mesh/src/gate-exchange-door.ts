/**
 * gate-exchange-door: the names the package barrel exports from `gate-exchange.ts`, on a subpath of their own.
 *
 * `gate-exchange.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export {
  GATE_PROTOCOL, GATE_FLIGHT_BYTES, GATE_FLIGHT_REFUSALS, gateFlightProtocols, readGateFlightHeader, gateProtocolSelected,
  GATE_FRAME, GATE_FRAME_DIRECTION, GATE_FINISH_BYTES, GATE_VERDICT_BYTES, GATE_FRAME_BODY_MAX, GATE_SUBJECT_MAX_BYTES,
  gateFrameTagReserved, gateFrameTableRefusal,
} from "./gate-exchange.js";
export type { GateFlightRefusal, PresentationArm, PlaceArm } from "./gate-exchange.js";
