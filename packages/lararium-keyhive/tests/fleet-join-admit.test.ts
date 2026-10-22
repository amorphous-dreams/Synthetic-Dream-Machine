/** fleet-join-admit — the admit a verified fleet-join answer carries, in the shape a vessel founds a face by. */
import { describe, expect, test } from "vitest";
import { custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, sovereignGateRoot, sovereignRoute, type FleetJoinAnswer, type GateBundlePin } from "@lararium/mesh";
import { carriedAdmitOfFleetJoin } from "../src/fleet-join-admit.js";

const pinAt = (nexus: string): GateBundlePin => {
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(3) })), new TextEncoder().encode(nexus), sovereignRoute("/ws"));
  try { return bundle.pin; } finally { bundle.drop(); }
};
const PIN = pinAt("epoch-0");
const FLOOR = (() => {
  const bundle = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(8) })), new TextEncoder().encode("epoch-0"), floorRoute("/flow"));
  try { return bundle.pin; } finally { bundle.drop(); }
})();
const GROUP = "0xc0ffee00d15ea5e5";
const answer = (over: Partial<FleetJoinAnswer> = {}): FleetJoinAnswer => ({
  kind: "fleet-join-answer", nonce: "ab".repeat(32), vesselKey: "cd".repeat(32), personaGroup: GROUP,
  edge: { kind: "device-admit/v1", personaGroupId: GROUP, syncUrl: "ws://stale.synthetic/ws", deviceEdge: "synthetic" },
  carriage: { gatePin: PIN, canon: { "lar:///ha.ka.ba/bags/lares": "automerge:canon" } },
  reach: { syncUrl: "ws://hearth.synthetic:7777/ws", islandKind: "charter", islandScope: "epoch-0" },
  secret: { epk: "00".repeat(32), nonce: "00".repeat(24), ciphertext: "00" },
  floorPins: [FLOOR],
  certificates: [], grants: [], signature: "00".repeat(64),
  ...over,
} as FleetJoinAnswer);

describe("the admit a fleet-join answer carries", () => {
  test("the signed edge founds, with the signed pin, canon and reach beside it", () => {
    const admit = carriedAdmitOfFleetJoin(answer());
    if ("refusal" in admit) throw new Error(admit.refusal);
    expect(admit.kind).toBe("device-admit/v1");
    expect(admit.hearthGatePubKey).toBe(PIN.signingKey);
    expect(admit.hearthGatePin).toEqual(PIN);
    expect(admit.hearthCanonDocs).toEqual({ "lar:///ha.ka.ba/bags/lares": "automerge:canon" });
    // The reach the root signed answers the dial, over whatever the edge itself named.
    expect(admit.syncUrl).toBe("ws://hearth.synthetic:7777/ws");
    expect([admit.hearthIslandKind, admit.hearthIslandScope]).toEqual(["charter", "epoch-0"]);
    // House ruling "The admit's gate pin", carrier (b): the floor pins the root signed ride beside the sovereign pin.
    expect(admit.hearthFloorPins).toEqual([FLOOR]);
  });

  test("a reach naming no island leaves the island out", () => {
    const admit = carriedAdmitOfFleetJoin(answer({ reach: { syncUrl: null, islandKind: null, islandScope: null } }));
    if ("refusal" in admit) throw new Error(admit.refusal);
    expect("hearthIslandKind" in admit || "hearthIslandScope" in admit).toBe(false);
  });

  test("an edge reading as no device admit, an edge of another face, or an unknown island kind refuses by name", () => {
    expect(carriedAdmitOfFleetJoin(answer({ edge: { kind: "other" } }))).toEqual({ refusal: "edge-malformed" });
    expect(carriedAdmitOfFleetJoin(answer({ edge: { kind: "device-admit/v1", personaGroupId: "0x00" } }))).toEqual({ refusal: "edge-other-face" });
    expect(carriedAdmitOfFleetJoin(answer({ reach: { syncUrl: null, islandKind: "torn", islandScope: null } }))).toEqual({ refusal: "reach-malformed" });
  });
});
