import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const seam = vi.hoisted(() => ({
  provisional: false,
  bootstrapPath: "",
  guard: vi.fn(), edge: vi.fn(), certificate: vi.fn(), grant: vi.fn(), secret: vi.fn(), answer: vi.fn(),
}));

vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath }));
vi.mock("../src/carried-set.js", () => ({ readCarriedCharters: () => new Map(), primaryNexusAid: () => null }));
vi.mock("../src/face-key-custody.js", () => ({ readNexusKey: async () => null, nodeFaceKeyCustody: {}, nodeVesselFaceKeyCustody: {} }));
vi.mock("../src/node-vessel-identity.js", () => ({
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
  mintFaceAddressSecret: async () => { seam.secret(); return new Uint8Array(32); },
}));
vi.mock("@noble/ed25519", () => ({ signAsync: async () => new Uint8Array(64) }));
vi.mock("@lararium/keyhive", () => ({}));
vi.mock("@lararium/mesh", () => ({
  PERSONA_GROUP_ID_TIDDLER: "lar:///ha.ka.ba/lares/persona-group-id",
  fleetJoinOffer: (offer: unknown) => offer,
  readFleetJoinRequest: () => ({ vesselKey: "c".repeat(64), requests: [{ scope: { faceKey: "d", nexus: "nexus" } }] }),
  foldWithdrawals: () => ({ memory: {} }),
  issueCertificate: async () => { seam.certificate(); return { certificate: { kind: "certificate" } }; },
  faceKeyGrantImage: () => { seam.grant(); return new Uint8Array(); },
  fleetJoinAnswerImage: () => { seam.answer(); return new Uint8Array(); },
  sealAddressSecret: () => ({ sealed: true }),
  hex: (bytes: Uint8Array) => Buffer.from(bytes).toString("hex"),
}));

import { runFleetJoinAnswer } from "../src/commands/fleet-join.js";

const opts = { repo: {} as Parameters<typeof runFleetJoinAnswer>[0]["repo"], sealHome: "/test/seal", request: { nonce: "0".repeat(64) } };

describe("fleet join answer at a restored face", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seam.provisional = false;
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-provisional-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      "lar:///ha.ka.ba/lares/persona-group-id": { text: "group" },
    } }) }));
  });
  afterAll(() => rmSync(seam.bootstrapPath, { force: true }));

  test("provisional refusal leaves no edge, certificate, grant, address secret or answer", async () => {
    seam.provisional = true;
    await expect(runFleetJoinAnswer(opts)).rejects.toThrow("face-provisional");
    expect(seam.guard).toHaveBeenCalledOnce();
    expect(seam.guard).toHaveBeenCalledWith(0, "fleet join answer");
    for (const write of [seam.edge, seam.certificate, seam.grant, seam.secret, seam.answer]) expect(write).not.toHaveBeenCalled();
  });

  test("a confirmed face reaches the signed answer", async () => {
    const answer = await runFleetJoinAnswer(opts);
    expect(answer.kind).toBe("fleet-join-answer");
    expect(seam.guard).toHaveBeenCalledOnce();
    expect(seam.guard).toHaveBeenCalledWith(0, "fleet join answer");
    for (const write of [seam.edge, seam.certificate, seam.grant, seam.secret, seam.answer]) expect(write).toHaveBeenCalledOnce();
  });
});
