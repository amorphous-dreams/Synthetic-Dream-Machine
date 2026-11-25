/**
 * gate-bundle-door: the names the package barrel exports from `gate-bundle.ts`, on a subpath of their own.
 *
 * `gate-bundle.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { floorKeyDoor, custodyRootDoor } from "./gate-bundle.js";
export type { FloorKeyDoor, CustodyRootDoor, GateRootDoor } from "./gate-bundle.js";
export {
  deriveGateBundle, floorGateRoot, sovereignGateRoot, floorRoute, sovereignRoute, gateBundleDigest, gateKnock, knockSegment, readGateBundlePin,
  readGateSignature, nexusAidOfPin, GateBundleRefused, GATE_BUNDLE_REFUSALS, GATE_TIERS,
} from "./gate-bundle.js";
export type { GateBundle, GateBundlePin, GateBundleRoot, GateRoute, GateTier, GateBundleRefusalName } from "./gate-bundle.js";
