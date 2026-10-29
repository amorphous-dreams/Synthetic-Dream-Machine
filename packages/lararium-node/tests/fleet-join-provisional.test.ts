import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const seam = vi.hoisted(() => ({
  provisional: false,
  noCharter: false,
  bootstrapPath: "",
  leaf: vi.fn(),
  guard: vi.fn(), household: vi.fn(), edge: vi.fn(), certificate: vi.fn(), grant: vi.fn(), secret: vi.fn(), issued: vi.fn(), answer: vi.fn(),
}));

const HOUSEHOLD = vi.hoisted(() => ({ aid: "nexus-a", admit: { nym: "d" }, lineage: [], opening: { carriage: { gatePin: "pin", canon: {} }, salt: "s" } }));
// Which face an unnamed run resolves has its reds in face-selector.test.ts; this suite reads the provisional guard.
vi.mock("../src/face-selector.js", () => ({ resolveFace: async (named?: number) => named ?? 0, FaceNotNamed: class extends Error {} }));
vi.mock("../src/face-household-admit.js", () => {
  class FaceHouseholdAdmitRefused extends Error {
    constructor(readonly refusal: string, detail: string) { super(`[face household admit] ${refusal}: ${detail}`); }
  }
  const noCharter = () => { if (seam.noCharter) throw new FaceHouseholdAdmitRefused("no-household-nexus", "this vessel keeps no charter"); };
  return {
    FaceHouseholdAdmitRefused,
    ensureFaceHouseholdLeaf: async () => { noCharter(); seam.leaf(); return { seed: new Uint8Array(32) }; },
    ensureFaceHouseholdAdmit: async () => { noCharter(); seam.household(); return HOUSEHOLD; },
  };
});
vi.mock("../src/admit-bundle.js", () => ({ admitBundlePathFor: (h: string, aid: string) => `${h}/nexus/carriage-admit/${aid}.json`, takeAdmitBundle: async () => {  } }));
vi.mock("../src/hearth-sovereign-pin.js", () => ({ stoodFloorPins: () => [] }));
vi.mock("../src/nexus-doc.js", () => ({ nexusCharterDocPath: () => seam.bootstrapPath, parseNexusDoc: () => ({}) }));
vi.mock("../src/fs-atomic.js", () => ({ atomicWriteFileSync: () => {  } }));
vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath, larSealHome: () => `${seam.bootstrapPath}.seal` }));
vi.mock("../src/carried-set.js", () => ({ importCarriedCharter: () => {  }, readCarriedCharters: () => new Map(), primaryNexusAid: () => null }));
vi.mock("../src/face-key-custody.js", () => ({ readNexusKey: async () => null, nodeFaceKeyCustody: {}, nodeVesselFaceKeyCustody: {} }));
vi.mock("../src/node-vessel-identity.js", () => ({
  vesselFloorKeyDoor: async () => ({}),
  loadPersonaGroupRootVerifyingKey: async () => "a".repeat(64),
  loadPersonaGroupRootSeed: async () => new Uint8Array(32),
  loadVesselVerifyingKey: async () => "b".repeat(64),
}));
vi.mock("../src/face-provisional.js", () => {
  class FaceProvisional extends Error { readonly reason = "face-provisional"; }
  return {
    FaceProvisional,
    refuseWhileProvisional: async (face: number, act: string) => {
      seam.guard(face, act);
      if (seam.provisional) throw new FaceProvisional("face-provisional");
    },
  };
});
vi.mock("../src/commands/device-admit.js", () => ({
  runDeviceAdmit: async () => {
    seam.edge();
    return { payload: { syncUrl: "ws://hearth" }, hearth: { gatePin: "pin", canon: {} } };
  },
}));
vi.mock("../src/commands/init.js", () => ({ runInit: vi.fn() }));
vi.mock("../src/fleet-join-custody.js", () => ({
  readFaceAddressSecret: async () => { seam.secret(); return new Uint8Array(32); },
  noteIssuedFaceKeys: async () => { seam.issued(); },
}));
vi.mock("@noble/ed25519", () => ({ signAsync: async () => new Uint8Array(64) }));
vi.mock("@lararium/keyhive", () => ({}));
vi.mock("@lararium/mesh", () => ({
  gateBundleDigest: (pin: unknown) => JSON.stringify(pin),
  nexusAidOf: () => "nexus-a",
  heldNexusRoot: () => ({ nexus: "nexus-a" }),
  makeMultiSigQuorumVerifier: () => ({}),
  verifySignedAdmitBundle: async () => ({ carriage: {} }),
  readGateBundlePin: () => ({ refusal: "pin-malformed" }),
  PERSONA_GROUP_ID_TIDDLER: "lar:///ha.ka.ba/lares/persona-group-id",
  fleetJoinOffer: (offer: unknown) => offer,
  readFleetJoinRequest: () => ({ vesselKey: "c".repeat(64), requests: [{ scope: { faceKey: "d", nexus: "nexus-a" } }] }),
  foldWithdrawals: () => ({ memory: {} }),
  issueCertificate: async () => { seam.certificate(); return { certificate: { kind: "certificate" } }; },
  faceKeyGrantImage: () => { seam.grant(); return new Uint8Array(); },
  fleetJoinAnswerImage: () => { seam.answer(); return new Uint8Array(); },
  sealAddressSecret: () => ({ sealed: true }),
  hex: (bytes: Uint8Array) => Buffer.from(bytes).toString("hex"),
}));

import { FleetJoinRefused, runFleetJoinAnswer, runFleetJoinOffer } from "../src/commands/fleet-join.js";

const opts = { repo: {} as Parameters<typeof runFleetJoinAnswer>[0]["repo"], sealHome: "/test/seal", request: { nonce: "0".repeat(64) } };

describe("fleet join answer at a restored face", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.provisional = false;
    seam.noCharter = false;
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-provisional-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      "lar:///ha.ka.ba/lares/persona-group-id": { text: "group" },
    } }) }));
  });
  afterAll(() => { rmSync(seam.bootstrapPath, { force: true }); rmSync(`${seam.bootstrapPath}.seal`, { recursive: true, force: true }); });

  test("provisional refusal leaves no edge, certificate, grant, address secret or answer", async () => {
    seam.provisional = true;
    await expect(runFleetJoinAnswer(opts)).rejects.toThrow("face-provisional");
    expect(seam.guard).toHaveBeenCalledOnce();
    expect(seam.guard).toHaveBeenCalledWith(0, "fleet join answer");
    for (const write of [seam.household, seam.edge, seam.certificate, seam.grant, seam.secret, seam.issued, seam.answer]) expect(write).not.toHaveBeenCalled();
  });

  test("a confirmed face reaches the signed answer", async () => {
    const answer = await runFleetJoinAnswer(opts);
    expect(answer.kind).toBe("fleet-join-answer");
    expect(seam.guard).toHaveBeenCalledOnce();
    expect(seam.guard).toHaveBeenCalledWith(0, "fleet join answer");
    for (const write of [seam.household, seam.edge, seam.certificate, seam.grant, seam.secret, seam.issued, seam.answer]) expect(write).toHaveBeenCalledOnce();
  });

  test("C RED: a provisional face's OFFER refuses before any household leaf is minted; CONTROL: a confirmed face mints it", async () => {
    seam.provisional = true;
    const refused = await runFleetJoinOffer({ sealHome: "/nonexistent/seal" }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(FleetJoinRefused);
    expect((refused as FleetJoinRefused).refusal).toBe("face-provisional");
    expect(seam.guard).toHaveBeenCalledWith(0, "fleet join offer");
    expect(seam.leaf).not.toHaveBeenCalled();
    seam.provisional = false;
    await runFleetJoinOffer({ sealHome: "/nonexistent/seal" });
    expect(seam.leaf).toHaveBeenCalledOnce();
  });

  test("D RED: a vessel with no charter refuses the offer and the answer as a named FleetJoinRefused", async () => {
    seam.noCharter = true;
    for (const act of [() => runFleetJoinOffer({ sealHome: "/nonexistent/seal" }), () => runFleetJoinAnswer(opts)]) {
      const refused = await act().catch((e: unknown) => e);
      expect(refused).toBeInstanceOf(FleetJoinRefused);
      expect((refused as FleetJoinRefused).refusal).toBe("no-household-nexus");
      expect(String((refused as Error).message)).toMatch(/^\[lares fleet join\] no-household-nexus: /);
    }
    for (const write of [seam.leaf, seam.household, seam.answer]) expect(write).not.toHaveBeenCalled();
  });
});
