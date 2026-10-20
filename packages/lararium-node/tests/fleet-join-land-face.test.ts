/**
 * A landing carries another joined face beside the one a vessel wears.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GROUP_TIDDLER = "lar:///ha.ka.ba/lares/persona-group-id";
const seam = vi.hoisted(() => ({ bootstrapPath: "", writes: [] as string[] }));

const HOUSEHOLD = vi.hoisted(() => ({ aid: "nexus-a", admit: { nym: "d" }, lineage: [], opening: { carriage: { gatePin: "pin", canon: {} }, salt: "s" } }));
vi.mock("../src/face-household-admit.js", () => ({ ensureFaceHouseholdLeaf: async () => ({ seed: new Uint8Array(32) }), ensureFaceHouseholdAdmit: async () => HOUSEHOLD }));
vi.mock("../src/admit-bundle.js", () => ({ admitBundlePathFor: (h: string, aid: string) => `${h}/nexus/carriage-admit/${aid}.json`, takeAdmitBundle: async () => { seam.writes.push("bundle"); } }));
vi.mock("../src/hearth-sovereign-pin.js", () => ({ stoodFloorPins: () => [] }));
vi.mock("../src/nexus-doc.js", () => ({ nexusCharterDocPath: () => seam.bootstrapPath, parseNexusDoc: () => ({}) }));
vi.mock("../src/fs-atomic.js", () => ({ atomicWriteFileSync: () => { seam.writes.push("floor-pins"); } }));
vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath, larSealHome: () => `${seam.bootstrapPath}.seal` }));
vi.mock("../src/carried-set.js", () => ({ importCarriedCharter: () => { seam.writes.push("charter"); }, readCarriedCharters: () => new Map(), primaryNexusAid: () => null }));
vi.mock("../src/identity-anchors.js", () => ({ loadIdentityAnchors: async () => null }));
vi.mock("../src/face-key-custody.js", () => ({ nodeFaceKeyCustody: {}, nodeVesselFaceKeyCustody: {} }));
vi.mock("../src/node-vessel-identity.js", () => ({ vesselFloorKeyDoor: async () => ({}) }));
vi.mock("../src/face-provisional.js", () => ({ FaceProvisional: class extends Error {}, refuseWhileProvisional: async () => {} }));
vi.mock("../src/commands/device-admit.js", () => ({ runDeviceAdmit: async () => ({}) }));
vi.mock("../src/commands/init.js", () => ({ runInit: async () => { seam.writes.push("init"); } }));
vi.mock("../src/fleet-join-custody.js", () => ({
  readPendingFleetJoin: async () => ({ offer: {}, request: {}, sealSecret: "00".repeat(32) }),
  readFaceJoinRecord: async () => null,
  readFaceAddressSecret: async () => null,
  landFaceAddressSecret: async () => { seam.writes.push("secret"); },
  keepFaceJoinRecord: async () => { seam.writes.push("record"); },
  clearPendingFleetJoin: async () => { seam.writes.push("clear"); return true; },
}));
vi.mock("@noble/ed25519", () => ({}));
vi.mock("@lararium/keyhive", () => ({ carriedAdmitOfFleetJoin: () => ({ kind: "device-admit/v1" }) }));
vi.mock("@lararium/mesh", () => ({
  gateBundleDigest: (pin: unknown) => JSON.stringify(pin),
  nexusAidOf: () => "nexus-a",
  heldNexusRoot: () => ({ nexus: "nexus-a" }),
  makeMultiSigQuorumVerifier: () => ({}),
  verifySignedAdmitBundle: async () => ({ carriage: {} }),
  readGateBundlePin: () => ({ refusal: "pin-malformed" }),
  PERSONA_GROUP_ID_TIDDLER: "lar:///ha.ka.ba/lares/persona-group-id",
  readFleetJoinOffer: () => ({ personaGroup: "group-two", rootKey: "root" }),
  readFleetJoinRequest: () => ({ nonce: "n" }),
  readFleetJoinAnswer: () => ({ answer: {
    personaGroup: "group-two", certificates: [], grants: [], edge: { hearthTrueName: "nexus-a" }, carriage: { gatePin: { signingKey: "k" }, canon: {} },
    reach: { syncUrl: null }, charter: "charter", admit: { admit: { nym: "d" }, lineage: [], salt: "s" }, floorPins: [],
  }, addressSecret: new Uint8Array(32) }),
}));

import { runFleetJoinLand } from "../src/commands/fleet-join.js";

const bootstrapNaming = (group: string | null) => writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: group === null ? {} : { [GROUP_TIDDLER]: { text: group } } }) }));

describe("a landing keeps the face a joined vessel wears", () => {
  beforeEach(() => {
    seam.writes = [];
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-land-face-${process.pid}.json`);
  });
  afterAll(() => { rmSync(seam.bootstrapPath, { force: true }); rmSync(`${seam.bootstrapPath}.seal`, { recursive: true, force: true }); });

  test("CONTROL: a bare place lands the face", async () => {
    bootstrapNaming(null);
    await runFleetJoinLand({ repo: {} as never, answer: {} });
    expect(seam.writes).toEqual(["charter", "bundle", "floor-pins", "secret", "record", "init", "clear"]);
  });

  test("CONTROL: the same face lands again", async () => {
    bootstrapNaming("group-two");
    await runFleetJoinLand({ repo: {} as never, answer: {} });
    expect(seam.writes).toContain("init");
  });

  test("LAND_KEEPS_THE_WORN_FACE: another face's answer lands beside the worn face", async () => {
    bootstrapNaming("group-zero");
    await runFleetJoinLand({ repo: {} as never, answer: {} });
    expect(seam.writes).toEqual(["charter", "bundle", "floor-pins", "secret", "record", "init", "clear"]);
  });

  test("a torn bootstrap refuses bootstrap-torn and writes nothing", async () => {
    writeFileSync(seam.bootstrapPath, "{not json");
    await expect(runFleetJoinLand({ repo: {} as never, answer: {} })).rejects.toMatchObject({ refusal: "bootstrap-torn" });
    expect(seam.writes).toEqual([]);
  });
});
