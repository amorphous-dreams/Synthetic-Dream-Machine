/**
 * The bind site's consult reads the fleet of the face that signs: a device set aside from one face's fleet stays
 * out when that face answers a join, and another face's board decides nothing for it.
 */
import { describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ rootsAsked: [] as number[], boards: [] as string[], ledgerKeys: [] as string[], asideOn: "" }));

vi.mock("../src/node-vessel-identity.js", () => ({
  loadPersonaGroupRootVerifyingKey: async (face = 0) => { seam.rootsAsked.push(face); return `root-${face}`; },
  loadPersonaGroupRootSeed: async () => new Uint8Array(32),
  loadVesselVerifyingKey: async () => "vessel",
}));
vi.mock("../src/identity-anchors.js", () => ({ loadIdentityAnchors: async (face = 0) => ({ personaGroupId: `group-${face}` }) }));
vi.mock("../src/face-atom-store.js", () => ({ loadFaceAtom: async (face = 0) => new Uint8Array(32).fill(face + 1) }));
vi.mock("../src/edge-board.js", () => ({
  readVesselEdgeBoard: async ({ scope, vesselKey }: { scope: string; vesselKey: string }) => {
    seam.boards.push(scope); seam.ledgerKeys.push(vesselKey);
    return { readings: new Map([[`edge:${scope}:device`, { stands: scope === seam.asideOn, verdict: "raised" }]]) };
  },
}));
vi.mock("@lararium/mesh", async (real) => ({
  ...(await real<object>()),
  fleetEdgeBoardDocUrl: (root: string) => `board:${root}`,
  fleetEdgeAuthority: () => ({}),
  deviceEdgeId: (root: string, device: string) => `edge:${root}:${device}`,
}));

import { assertDyadBinds } from "../src/commands/device-admit.js";
import { faceAtomKeyFromSeed } from "@lararium/mesh";

describe("the dyad consult reads the signing face's fleet", () => {
  test("CONTROL: no face named reads the founding face's fleet", async () => {
    seam.rootsAsked = []; seam.boards = []; seam.ledgerKeys = []; seam.asideOn = "root-0";
    await expect(assertDyadBinds({} as never, "device")).rejects.toMatchObject({ name: "DeviceSetAside" });
    expect(seam.rootsAsked).toEqual([0]);
    expect(seam.boards).toEqual(["root-0"]);
    expect(seam.ledgerKeys).toEqual([faceAtomKeyFromSeed(new Uint8Array(32).fill(1), "group-0").key]);
  });

  test("DYAD_CONSULT_READS_THE_FACE: face 2's root reads face 2's board, set aside there", async () => {
    seam.rootsAsked = []; seam.boards = []; seam.ledgerKeys = []; seam.asideOn = "root-2";
    await expect(assertDyadBinds({} as never, "device", 2)).rejects.toMatchObject({ name: "DeviceSetAside" });
    expect(seam.rootsAsked).toEqual([2]);
    expect(seam.boards).toEqual(["root-2"]);
    expect(seam.ledgerKeys).toEqual([faceAtomKeyFromSeed(new Uint8Array(32).fill(3), "group-2").key]);
  });

  test("a shadow on the founding face's board never binds face 2's answer", async () => {
    seam.rootsAsked = []; seam.boards = []; seam.ledgerKeys = []; seam.asideOn = "root-0";
    await expect(assertDyadBinds({} as never, "device", 2)).resolves.toBeUndefined();
    expect(seam.boards).toEqual(["root-2"]);
  });
});
