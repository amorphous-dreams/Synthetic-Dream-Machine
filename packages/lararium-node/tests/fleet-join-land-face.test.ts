/**
 * A landing re-founds the joining vessel's bootstrap and its h0 anchors, so a vessel stands one joined face: an
 * answer for another face over a vessel that already wears one refuses by name and writes nothing.
 */
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GROUP_TIDDLER = "lar:///ha.ka.ba/lares/persona-group-id";
const seam = vi.hoisted(() => ({ bootstrapPath: "", writes: [] as string[] }));

vi.mock("../src/vessel-paths.js", () => ({ larBootstrapPath: () => seam.bootstrapPath }));
vi.mock("../src/carried-set.js", () => ({ readCarriedCharters: () => new Map(), primaryNexusAid: () => null }));
vi.mock("../src/identity-anchors.js", () => ({ loadIdentityAnchors: async () => null }));
vi.mock("../src/face-key-custody.js", () => ({ nodeFaceKeyCustody: {}, nodeVesselFaceKeyCustody: {} }));
vi.mock("../src/node-vessel-identity.js", () => ({}));
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
  PERSONA_GROUP_ID_TIDDLER: "lar:///ha.ka.ba/lares/persona-group-id",
  readFleetJoinOffer: () => ({ personaGroup: "group-two", rootKey: "root" }),
  readFleetJoinRequest: () => ({ nonce: "n" }),
  readFleetJoinAnswer: () => ({ answer: { personaGroup: "group-two", certificates: [], grants: [] }, addressSecret: new Uint8Array(32) }),
}));

import { runFleetJoinLand } from "../src/commands/fleet-join.js";

const bootstrapNaming = (group: string | null) => writeFileSync(seam.bootstrapPath, JSON.stringify({ text: JSON.stringify({ tiddlers: group === null ? {} : { [GROUP_TIDDLER]: { text: group } } }) }));

describe("a landing keeps the one face a joined vessel wears", () => {
  beforeEach(() => {
    seam.writes = [];
    seam.bootstrapPath = join(tmpdir(), `lar-fleet-join-land-face-${process.pid}.json`);
  });
  afterAll(() => rmSync(seam.bootstrapPath, { force: true }));

  test("CONTROL: a bare place lands the face", async () => {
    bootstrapNaming(null);
    await runFleetJoinLand({ repo: {} as never, answer: {} });
    expect(seam.writes).toEqual(["secret", "record", "init", "clear"]);
  });

  test("CONTROL: the same face lands again", async () => {
    bootstrapNaming("group-two");
    await runFleetJoinLand({ repo: {} as never, answer: {} });
    expect(seam.writes).toContain("init");
  });

  test("LAND_KEEPS_THE_WORN_FACE: another face's answer over a vessel wearing one refuses face-other and writes nothing", async () => {
    bootstrapNaming("group-zero");
    await expect(runFleetJoinLand({ repo: {} as never, answer: {} })).rejects.toMatchObject({ refusal: "face-other" });
    expect(seam.writes).toEqual([]);
  });

  test("a torn bootstrap refuses bootstrap-torn and writes nothing", async () => {
    writeFileSync(seam.bootstrapPath, "{not json");
    await expect(runFleetJoinLand({ repo: {} as never, answer: {} })).rejects.toMatchObject({ refusal: "bootstrap-torn" });
    expect(seam.writes).toEqual([]);
  });
});
