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
  unnamed: 0 as number | "ambiguous",
}));

const HOUSEHOLD = vi.hoisted(() => ({ aid: "nexus-a", admit: { nym: "d" }, lineage: [], opening: { carriage: { gatePin: "pin", canon: {} }, salt: "s" } }));
vi.mock("../src/face-household-admit.js", () => ({ ensureFaceHouseholdLeaf: async (_s: string, face: number) => { seam.asked.push(["household-leaf", face]); return { seed: new Uint8Array(32) }; }, ensureFaceHouseholdAdmit: async (o: { face: number }) => { seam.asked.push(["household-admit", o.face]); return HOUSEHOLD; } }));
vi.mock("../src/admit-bundle.js", () => ({ admitBundlePathFor: (h: string, aid: string) => `${h}/nexus/carriage-admit/${aid}.json`, takeAdmitBundle: async () => {  } }));
vi.mock("../src/hearth-sovereign-pin.js", () => ({ stoodFloorPins: () => [] }));
vi.mock("../src/nexus-doc.js", () => ({ nexusCharterDocPath: () => seam.bootstrapPath, parseNexusDoc: () => ({}) }));
vi.mock("../src/fs-atomic.js", () => ({ atomicWriteFileSync: () => {  } }));
vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath, larSealHome: () => `${seam.bootstrapPath}.seal` }));
vi.mock("../src/carried-set.js", () => ({ importCarriedCharter: () => {  }, readCarriedCharters: () => new Map(), primaryNexusAid: () => "nexus-a" }));
// Which face an unnamed run resolves has its reds in face-selector.test.ts; this suite reads what the join does with the answer.
vi.mock("../src/face-selector.js", () => {
  class FaceNotNamed extends Error {}
  return { FaceNotNamed, resolveFace: async (named?: number) => {
    if (named !== undefined) return named;
    if (seam.unnamed === "ambiguous") throw new FaceNotNamed("this vessel holds faces h0, h1 and wears none: name one");
    return seam.unnamed;
  } };
});
vi.mock("../src/identity-anchors.js", () => ({
  loadIdentityAnchors: async (face: number) => { seam.asked.push(["anchors", face]); return seam.anchors.get(face) ?? null; },
}));
vi.mock("../src/face-key-custody.js", () => ({
  readNexusKey: async (face: number, nexus: string) => { seam.asked.push(["nexus-key", [face, nexus]]); return new Uint8Array(32).fill(face + 1); },
  nexusKeyPublicOf: (seed: Uint8Array) => `face-key-${seed[0]! - 1}`,
  nodeFaceKeyCustody: {}, nodeVesselFaceKeyCustody: {},
}));
vi.mock("../src/node-vessel-identity.js", () => ({
  vesselFloorKeyDoor: async () => ({}),
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
  readFaceAddressSecret: async (group: string) => { seam.asked.push(["address-secret", group]); return new Uint8Array(32); },
  noteIssuedFaceKeys: async (args: { personaGroup: string; rootKey: string; device: string; certificates: unknown[] }) => {
    seam.asked.push(["issued", [args.personaGroup, args.rootKey, args.device, args.certificates.length]]);
  },
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
  readFleetJoinRequest: () => ({ atomKey: "c".repeat(64), requests: [{ scope: { faceKey: "d", nexus: "nexus-a" } }] }),
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
    seam.asked = []; seam.unnamed = 0;
    seam.anchors = new Map([[2, { personaGroupId: SECOND_GROUP, meshCabalDocIdHex: "cabal-two" }]]);
    seam.roots = new Set([0, 2]);
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-face-${process.pid}.json`);
    writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: {
      "lar:///ha.ka.ba/lares/persona-group-id": { text: FOUNDING_GROUP },
    } }) }));
  });
  afterAll(() => { rmSync(seam.bootstrapPath, { force: true }); rmSync(`${seam.bootstrapPath}.seal`, { recursive: true, force: true }); });

  test("CONTROL: no face named answers for the founding face, off the bootstrap's pin", async () => {
    const offer = await runFleetJoinOffer({ sealHome: "/test/seal" }) as unknown as { personaGroup: string; rootKey: string };
    expect(offer.personaGroup).toBe(FOUNDING_GROUP);
    expect(offer.rootKey).toBe(ROOT(0));
    const answer = await answerAt();
    expect(answer.personaGroup).toBe(FOUNDING_GROUP);
    expect(askedFor("device-admit")).toEqual([0]);
    expect(askedFor("provisional")).toEqual([0, 0]);              // the offer's guard, then the answer's
    expect(askedFor("anchors")).toEqual([]);
    // THE ISSUED BOOK: the certificates are noted under the face's group and root, against the request's vessel key.
    expect(askedFor("issued")).toEqual([[FOUNDING_GROUP, ROOT(0), "c".repeat(64), 1]]);
    // THE DIAL IT CARRIES: the founding face's leaf at its household Nexus (the offer) and its admit there (the answer).
    expect(askedFor("household-leaf")).toEqual([0]);
    expect(askedFor("household-admit")).toEqual([0]);
    expect((answer as unknown as { admit: { admit: { nym: string } } }).admit.admit.nym).toBe("d");
  });

  test("--face 1: the issued book notes under face 1's own group and root, never the founding face's", async () => {
    seam.anchors.set(1, { personaGroupId: "group-face-one", meshCabalDocIdHex: "cabal-one" });
    seam.roots.add(1);
    const answer = await answerAt(1);
    expect(answer.personaGroup).toBe("group-face-one");
    expect(askedFor("issued")).toEqual([["group-face-one", ROOT(1), "c".repeat(64), 1]]);
    // --face 1 carries face 1's admit, never the founding face's.
    expect(askedFor("household-admit")).toEqual([1]);
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
    expect(askedFor("issued")).toEqual([[SECOND_GROUP, ROOT(2), "c".repeat(64), 1]]);
    expect(askedFor("household-admit")).toEqual([2]);
  });

  test("a face this vessel never founded refuses by name, and signs nothing", async () => {
    await expect(runFleetJoinOffer({ sealHome: "/test/seal", face: 3 })).rejects.toMatchObject({ refusal: "face-absent" });
    await expect(answerAt(3)).rejects.toMatchObject({ refusal: "face-absent" });
    expect(askedFor("root-seed")).toEqual([]);
    expect(askedFor("device-admit")).toEqual([]);
    expect(askedFor("issued")).toEqual([]);
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

  test("RED: an unnamed offer and answer on a vessel with several faces and none worn refuse by name; CONTROL: a sole or worn face resolves", async () => {
    seam.unnamed = "ambiguous";
    await expect(runFleetJoinOffer({ sealHome: "/test/seal" })).rejects.toBeInstanceOf(FleetJoinRefused);
    await expect(answerAt(undefined)).rejects.toBeInstanceOf(FleetJoinRefused);
    expect(askedFor("root-seed")).toEqual([]);
    seam.unnamed = 0;
    await expect(runFleetJoinOffer({ sealHome: "/test/seal" })).resolves.toBeDefined();
  });
});
