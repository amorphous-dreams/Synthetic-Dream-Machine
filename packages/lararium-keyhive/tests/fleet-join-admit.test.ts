/** fleet-join-admit — the admit a verified fleet-join answer carries, in the shape a vessel founds a face by. */
import { describe, expect, test } from "vitest";
import type { FleetJoinAnswer } from "@lararium/mesh";
import { carriedAdmitOfFleetJoin } from "../src/fleet-join-admit.js";

const GROUP = "0xc0ffee00d15ea5e5";
const answer = (over: Partial<FleetJoinAnswer> = {}): FleetJoinAnswer => ({
  kind: "fleet-join-answer", nonce: "ab".repeat(32), vesselKey: "cd".repeat(32), personaGroup: GROUP,
  edge: { kind: "device-admit/v1", personaGroupId: GROUP, syncUrl: "ws://stale.synthetic/ws", deviceEdge: "synthetic" },
  carriage: { gatePin: "ef".repeat(32), canon: { "lar:///ha.ka.ba/bags/lares": "automerge:canon" } },
  reach: { syncUrl: "ws://hearth.synthetic:7777/ws", islandKind: "charter", islandScope: "epoch-0" },
  secret: { epk: "00".repeat(32), nonce: "00".repeat(24), ciphertext: "00" },
  certificates: [], grants: [], signature: "00".repeat(64),
  ...over,
} as FleetJoinAnswer);

describe("the admit a fleet-join answer carries", () => {
  test("the signed edge founds, with the signed pin, canon and reach beside it", () => {
    const admit = carriedAdmitOfFleetJoin(answer());
    if ("refusal" in admit) throw new Error(admit.refusal);
    expect(admit.kind).toBe("device-admit/v1");
    expect(admit.hearthGatePubKey).toBe("ef".repeat(32));
    expect(admit.hearthCanonDocs).toEqual({ "lar:///ha.ka.ba/bags/lares": "automerge:canon" });
    // The reach the root signed answers the dial, over whatever the edge itself named.
    expect(admit.syncUrl).toBe("ws://hearth.synthetic:7777/ws");
    expect([admit.hearthIslandKind, admit.hearthIslandScope]).toEqual(["charter", "epoch-0"]);
  });

  test("a reach naming no island leaves the island out", () => {
    const admit = carriedAdmitOfFleetJoin(answer({ reach: { syncUrl: null, islandKind: null, islandScope: null } }));
    if ("refusal" in admit) throw new Error(admit.refusal);
    expect("hearthIslandKind" in admit || "hearthIslandScope" in admit).toBe(false);
  });

  test("an edge that is no device admit, an edge of another face, or an unknown island kind refuses by name", () => {
    expect(carriedAdmitOfFleetJoin(answer({ edge: { kind: "other" } }))).toEqual({ refusal: "edge-malformed" });
    expect(carriedAdmitOfFleetJoin(answer({ edge: { kind: "device-admit/v1", personaGroupId: "0x00" } }))).toEqual({ refusal: "edge-other-face" });
    expect(carriedAdmitOfFleetJoin(answer({ reach: { syncUrl: null, islandKind: "torn", islandScope: null } }))).toEqual({ refusal: "reach-malformed" });
  });
});
