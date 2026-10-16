/**
 * The bind site's consult reads the fleet of the face that signs: a device set aside from one face's fleet stays
 * out when that face answers a join, and another face's board decides nothing for it.
 */
import { describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ rootsAsked: [] as number[], boards: [] as string[], asideOn: "" }));

vi.mock("../src/node-vessel-identity.js", () => ({
  loadPersonaGroupRootVerifyingKey: async (face = 0) => { seam.rootsAsked.push(face); return `root-${face}`; },
  loadPersonaGroupRootSeed: async () => new Uint8Array(32),
  loadVesselVerifyingKey: async () => "vessel",
}));
vi.mock("../src/edge-board.js", () => ({
  readVesselEdgeBoard: async ({ scope }: { scope: string }) => {
    seam.boards.push(scope);
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

describe("the dyad consult reads the signing face's fleet", () => {
  test("CONTROL: no face named reads the founding face's fleet", async () => {
    seam.rootsAsked = []; seam.boards = []; seam.asideOn = "root-0";
    await expect(assertDyadBinds({} as never, "device")).rejects.toMatchObject({ name: "DeviceSetAside" });
    expect(seam.rootsAsked).toEqual([0]);
    expect(seam.boards).toEqual(["root-0"]);
  });

  test("DYAD_CONSULT_READS_THE_FACE: face 2's root reads face 2's board, set aside there", async () => {
    seam.rootsAsked = []; seam.boards = []; seam.asideOn = "root-2";
    await expect(assertDyadBinds({} as never, "device", 2)).rejects.toMatchObject({ name: "DeviceSetAside" });
    expect(seam.rootsAsked).toEqual([2]);
    expect(seam.boards).toEqual(["root-2"]);
  });

  test("a shadow on the founding face's board never binds face 2's answer", async () => {
    seam.rootsAsked = []; seam.boards = []; seam.asideOn = "root-0";
    await expect(assertDyadBinds({} as never, "device", 2)).resolves.toBeUndefined();
    expect(seam.boards).toEqual(["root-2"]);
  });
});
