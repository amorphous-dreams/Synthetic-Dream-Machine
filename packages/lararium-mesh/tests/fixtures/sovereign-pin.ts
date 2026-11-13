/**
 * A sovereign gate pin for one Nexus on the sync route, derived from a test custody door filled with one byte (`tag`).
 * Distinct tags give distinct keys at the same Nexus; the same tag gives the same pin.
 */
import { custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, type GateBundlePin } from "../../src/index.js";

export function sovereignPinAt(nexusAid: string, tag = 1): GateBundlePin {
  const bundle = deriveGateBundle(
    sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(tag) })),
    new TextEncoder().encode(nexusAid), sovereignRoute("/ws"),
  );
  try { return bundle.pin; } finally { bundle.drop(); }
}
