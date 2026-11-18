/**
 * A release cut carries the engine it stands on and never offers one: where the prior floor's engine differs from the engine
 * this vessel's genesis names, `cutReleaseFloor` refuses `floor-engine-unoffered` before anything stages.
 */
import { describe, expect, test } from "vitest";
import { cutReleaseFloor, type ReleaseFloorPorts } from "../src/canon-offer.js";
import { cutFloorSnapshot, floorManifestBytes, floorManifestCid, type FloorManifest } from "../src/floor-manifest.js";

function ports(engine: string, genesisEngine: string, staged: string[]): ReleaseFloorPorts {
  const lares = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "l" } } });
  const lararium = cutFloorSnapshot({});
  const prior: FloorManifest = { format: "lararium-floor", engine, plugins: "b".repeat(64), snapshots: { lares: lares.cid, lararium: lararium.cid } };
  const cas = new Map([[lares.cid, lares.bytes], [lararium.cid, lararium.bytes]]);
  return {
    prior: async () => ({ manifestCid: floorManifestCid(prior), bytes: floorManifestBytes(prior) }),
    canonRows: async () => null,
    tier: () => null,
    blob: async (cid) => cas.get(cid) ?? null,
    stage: async (blobs) => { for (const b of blobs) staged.push(b.cid); },
    genesisEngine: () => genesisEngine,
  };
}

describe("a release cut and the engine", () => {
  test("a prior whose engine differs from genesis refuses floor-engine-unoffered and stages nothing", async () => {
    const staged: string[] = [];
    await expect(cutReleaseFloor(ports("e".repeat(64), "f".repeat(64), staged))).rejects.toMatchObject({ code: "floor-engine-unoffered" });
    expect(staged).toEqual([]);
  });
  test("CONTROL: the engine genesis names cuts", async () => {
    const staged: string[] = [];
    await expect(cutReleaseFloor(ports("e".repeat(64), "e".repeat(64), staged))).resolves.toMatchObject({ kept: ["lararium", "lares"] });
  });
});
