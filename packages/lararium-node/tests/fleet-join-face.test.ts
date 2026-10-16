/**
 * Fleet join serves every face (stable-founding-road#/rulings): `--face <index>` names the face, default 0, and a
 * nonzero face carries that face's group, root, scopes, provisional guard and device edge, never the founding
 * face's. The seams stand mocked; each mock records the face index it was asked for.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FOUNDING_GROUP = "group-founding";
const SECOND_GROUP = "group-face-two";
const ROOT = (face: number) => String(face).repeat(64).slice(0, 64);

const seam = vi.hoisted(() => ({
  bootstrapPath: "",
  asked: [] as Array<[string, unknown]>,
  anchors: new Map<number, { personaGroupId: string; meshCabalDocIdHex: string }>(),
  roots: new Set<number>(),
}));

vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath }));
vi.mock("../src/carried-set.js", () => ({ readCarriedCharters: () => new Map(), primaryNexusAid: () => "nexus-a" }));
vi.mock("../src/identity-anchors.js", () => ({
  loadIdentityAnchors: async (face: number) => { seam.asked.push(["anchors", face]); return seam.anchors.get(face) ?? null; },
}));
vi.mock("../src/face-key-custody.js", () => ({
  readNexusKey: async (face: number, nexus: string) => { seam.asked.push(["nexus-key", [face, nexus]]); return new Uint8Array(32).fill(face + 1); },
  nexusKeyPublicOf: (seed: Uint8Array) => `face-key-${seed[0]! - 1}`,
  nodeFaceKeyCustody: {}, nodeVesselFaceKeyCustody: {},
}));
vi.mock("../src/node-vessel-identity.js", () => ({
  loadPersonaGroupRootVerifyingKey: async (face: number) => { seam.asked.push(["root-key", face]); return seam.roots.has(face) ? ROOT(face) : undefined; },
  loadPersonaGroupRootSeed: async (face: number) => { seam.asked.push(["root-seed", face]); return new Uint8Array(32); },
  loadVesselVerifyingKey: async () => "b".repeat(64),
}));
vi.mock("../src/face-provisional.js", () => {
  class FaceProvisional extends Error { readonly reason = "face-provisional"; }
  return { FaceProvisional, refuseWhileProvisional: async (face: number) => { seam.asked.push(["provisional", face]); } };
});
vi.mock("../src/commands/device-admit.js", () => ({
  runDeviceAdmit: async (opts: { face?: number }) => {
    seam.asked.push(["device-admit", opts.face]);
    return { payload: { syncUrl: "ws://hearth" }, hearth: { gatePin: "pin", canon: {} } };
  },
}));
vi.mock("../src/commands/init.js", () => ({ runInit: vi.fn() }));
vi.mock("../src/fleet-join-custody.js", () => ({
  mintFaceAddressSecret: async (group: string) => { seam.asked.push(["address-secret", group]); return new Uint8Array(32); },
}));
vi.mock("@noble/ed25519", () => ({ signAsync: async () => new Uint8Array(64) }));
vi.mock("@lararium/keyhive", () => ({}));
vi.mock("@lararium/mesh", () => ({
  PERSONA_GROUP_ID_TIDDLER: "lar:///ha.ka.ba/lares/persona-group-id",
  fleetJoinOffer: (offer: unknown) => offer,
  readFleetJoinRequest: () => ({ vesselKey: "c".repeat(64), requests: [{ scope: { faceKey: "d", nexus: "nexus-a" } }] }),
  foldWithdrawals: () => ({ memory: {} }),
  issueCertificate: async () => ({ certificate: { kind: "certificate" } }),
  faceKeyGrantImage: (group: string) => { seam.asked.push(["grant", group]); return new Uint8Array(); },
  fleetJoinAnswerImage: () => new Uint8Array(),
  sealAddressSecret: () => ({ sealed: true }),
  hex: (bytes: Uint8Array) => Buffer.from(bytes).toString("hex"),
}));

import { FleetJoinRefused, runFleetJoinAnswer, runFleetJoinOffer } from "../src/commands/fleet-join.js";

const request = { nonce: "0".repeat(64) };
const answerAt = (face?: number) => runFleetJoinAnswer({ repo: {} as never, sealHome: "/test/seal", request, ...(face === undefined ? {} : { face }) });
const askedFor = (what: string) => seam.asked.filter(([name]) => name === what).map(([, value]) => value);

describe("fleet join names its face", () => {
  beforeEach(() => {
    seam.asked = [];
    seam.anchors = new Map([[2, { personaGroupId: SECOND_GROUP, meshCabalDocIdHex: "cabal-two" }]]);
    seam.roots = new Set([0, 2]);
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-face-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      "lar:///ha.ka.ba/lares/persona-group-id": { text: FOUNDING_GROUP },
    } }) }));
  });
  afterAll(() => rmSync(seam.bootstrapPath, { force: true }));

  test("CONTROL: no face named answers for the founding face, off the bootstrap's pin", async () => {
    const offer = await runFleetJoinOffer({ sealHome: "/test/seal" }) as unknown as { personaGroup: string; rootKey: string };
    expect(offer.personaGroup).toBe(FOUNDING_GROUP);
    expect(offer.rootKey).toBe(ROOT(0));
    const answer = await answerAt();
    expect(answer.personaGroup).toBe(FOUNDING_GROUP);
    expect(askedFor("device-admit")).toEqual([0]);
    expect(askedFor("provisional")).toEqual([0]);
    expect(askedFor("anchors")).toEqual([]);
  });

  test("FLEET_JOIN_SERVES_EVERY_FACE: face 2 carries its own group, root, scopes, guard, edge, secret and grants", async () => {
    const offer = await runFleetJoinOffer({ sealHome: "/test/seal", face: 2 }) as unknown as { personaGroup: string; rootKey: string; scopes: Array<{ faceKey: string }> };
    expect(offer.personaGroup).toBe(SECOND_GROUP);
    expect(offer.rootKey).toBe(ROOT(2));
    expect(offer.scopes.map((scope) => scope.faceKey)).toEqual(["face-key-2"]);
    seam.asked = [];
    const answer = await answerAt(2);
    expect(answer.personaGroup).toBe(SECOND_GROUP);
    // Dispatch positions: every seam the answer reaches names face 2, and none names the founding face.
    expect(askedFor("anchors")).toEqual([2]);
    expect(askedFor("root-key")).toEqual([2]);
    expect(askedFor("nexus-key")).toEqual([[2, "nexus-a"]]);
    expect(askedFor("provisional")).toEqual([2]);
    expect(askedFor("device-admit")).toEqual([2]);
    expect(askedFor("root-seed")).toEqual([2]);
    expect(askedFor("address-secret")).toEqual([SECOND_GROUP]);
    expect(askedFor("grant")).toEqual([SECOND_GROUP]);
  });

  test("a face this vessel never founded refuses by name, and signs nothing", async () => {
    await expect(runFleetJoinOffer({ sealHome: "/test/seal", face: 3 })).rejects.toMatchObject({ refusal: "face-absent" });
    await expect(answerAt(3)).rejects.toMatchObject({ refusal: "face-absent" });
    expect(askedFor("root-seed")).toEqual([]);
    expect(askedFor("device-admit")).toEqual([]);
  });

  test("a face with anchors and no root held here refuses root-absent", async () => {
    seam.roots = new Set([0]);
    await expect(answerAt(2)).rejects.toMatchObject({ refusal: "root-absent" });
    expect(askedFor("device-admit")).toEqual([]);
  });

  test("NONSENSE: a negative or fractional face refuses face-malformed before any read", async () => {
    for (const face of [-1, 1.5, Number.NaN]) {
      await expect(answerAt(face)).rejects.toBeInstanceOf(FleetJoinRefused);
      await expect(answerAt(face)).rejects.toMatchObject({ refusal: "face-malformed" });
    }
    expect(seam.asked).toEqual([]);
  });
});
