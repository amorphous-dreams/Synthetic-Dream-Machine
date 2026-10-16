/**
 * fleet-join-land-undo — a landing whose admit the take refuses keeps no charter it imported for it.
 *
 * The landing imports the answer's charter first (the take reads its admit against it), then takes the admit. A take
 * that refuses once left a carried charter for a Nexus this vessel never joined: a realm plane stands on a carried
 * charter alone. A refused take now removes the charter its landing put down.
 *
 * Proven, each with its control:
 *   · RED: a charter the landing put down where none stood is gone after the take refuses, and the refusal names
 *     `admit-refused` / CONTROL: a take that holds keeps it;
 *   · lane reading (unruled): a charter that extended (or matched) one already held stands, since it moves its own
 *     lineage forward and the vessel held that Nexus before.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GROUP_TIDDLER = "lar:///ha.ka.ba/lares/persona-group-id";
const seam = vi.hoisted(() => ({ bootstrapPath: "", writes: [] as string[], charterPath: "", outcome: "landed" as "landed" | "same" | "extended", takeFails: false }));

const HOUSEHOLD = vi.hoisted(() => ({ aid: "nexus-a", admit: { nym: "d" }, lineage: [], opening: { carriage: { gatePin: "pin", canon: {} }, salt: "s" } }));
vi.mock("../src/face-household-admit.js", () => ({ ensureFaceHouseholdLeaf: async () => ({ seed: new Uint8Array(32) }), ensureFaceHouseholdAdmit: async () => HOUSEHOLD }));
vi.mock("../src/admit-bundle.js", () => ({ admitBundlePathFor: (h: string, aid: string) => `${h}/nexus/carriage-admit/${aid}.json`, takeAdmitBundle: async () => { if (seam.takeFails) throw new Error("the admit names no leaf this vessel holds"); seam.writes.push("bundle"); } }));
vi.mock("../src/hearth-sovereign-pin.js", () => ({ stoodFloorPins: () => [] }));
vi.mock("../src/nexus-doc.js", () => ({ nexusCharterDocPath: () => seam.bootstrapPath, parseNexusDoc: () => ({}) }));
vi.mock("../src/fs-atomic.js", () => ({ atomicWriteFileSync: () => { seam.writes.push("floor-pins"); } }));
vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath, larSealHome: () => `${seam.bootstrapPath}.seal` }));
const fs = await vi.hoisted(async () => await import("node:fs"));
vi.mock("../src/carried-set.js", () => ({ importCarriedCharter: () => {
  seam.writes.push("charter");
  fs.writeFileSync(seam.charterPath, "the incoming charter");
  return { aid: "nexus-a", sealEpochCid: "head", outcome: seam.outcome, path: seam.charterPath };
}, readCarriedCharters: () => new Map(), primaryNexusAid: () => null }));
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

import { existsSync } from "node:fs";
import { runFleetJoinLand } from "../src/commands/fleet-join.js";

const bootstrapNaming = (group: string | null) => writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: group === null ? {} : { [GROUP_TIDDLER]: { text: group } } }) }));

describe("a refused take keeps no charter its landing imported", () => {
  beforeEach(() => {
    seam.writes = [];
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-land-undo-${process.pid}.json`);
    seam.charterPath = join(tmpdir(), `lar-fleet-join-land-undo-${process.pid}.charter.json`);
    seam.takeFails = false;
    seam.outcome = "landed";
    rmSync(seam.charterPath, { force: true });
  });
  afterAll(() => {
    rmSync(seam.bootstrapPath, { force: true }); rmSync(`${seam.bootstrapPath}.seal`, { recursive: true, force: true }); rmSync(seam.charterPath, { force: true });
  });

  test("RED: a charter landed where none stood is gone once the take refuses; CONTROL: a take that holds keeps it", async () => {
    bootstrapNaming(null);
    seam.takeFails = true;
    await expect(runFleetJoinLand({ repo: {} as never, answer: {} })).rejects.toMatchObject({ refusal: "admit-refused" });
    expect(seam.writes).toEqual(["charter"]);
    expect(existsSync(seam.charterPath)).toBe(false);                                    // RED

    seam.takeFails = false;
    seam.writes = [];
    await runFleetJoinLand({ repo: {} as never, answer: {} });
    expect(existsSync(seam.charterPath)).toBe(true);                                     // CONTROL
  });

  test("lane reading: a charter that extended one already held stands through a refused take", async () => {
    bootstrapNaming(null);
    seam.takeFails = true;
    seam.outcome = "extended";
    await expect(runFleetJoinLand({ repo: {} as never, answer: {} })).rejects.toMatchObject({ refusal: "admit-refused" });
    expect(existsSync(seam.charterPath)).toBe(true);
  });
});
