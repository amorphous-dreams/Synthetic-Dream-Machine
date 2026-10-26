import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carriageDocUrl, materializeSharedLarDoc, placeSignerFromSeed, mintPlaceInception, mintPlaceRotation,
  placeKelHeadFromBoard, writePlaceKelEvent, type LarDoc,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusCarryFor, runNexusContract } from "../src/commands/nexus-contract.js";
import { takeCarryBundle, CarryBundleError, type CarryBundle } from "../src/carry-bundle.js";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { restEvery } from "./resting-repo.js";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const key = (n: number) => placeSignerFromSeed(seed(n)).key;
let hearth: string, herm: string, prior: string | undefined;
const at = (root: string) => { process.env["LAR_ROOT"] = root; };
beforeEach(() => {
  hearth = mkdtempSync(join(tmpdir(), "carry-kel-hearth-"));
  herm = mkdtempSync(join(tmpdir(), "carry-kel-herm-"));
  prior = process.env["LAR_ROOT"];
});
afterEach(async () => {
  await restEvery();
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  rmSync(hearth, { recursive: true, force: true });
  rmSync(herm, { recursive: true, force: true });
});

async function setup() {
  at(hearth);
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  const seated = await seatChairs([0, 1, 2]);
  writeNexusDoc(larSealHome(), heldCharter({ keys: seated.keys, threshold: 2 }).doc());
  const charter = readNexusDoc(larSealHome())!;
  at(herm);
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  writeNexusDoc(larSealHome(), charter);
  const seal = await runNexusCarryFor({ sealHome: larSealHome() });
  at(hearth);
  const carry = await direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, floorPin: JSON.stringify(seal.floorPin) });
  return { seal, bundle: carry.carryBundle as CarryBundle, boardUrl: carry.boardUrl };
}
async function head(aid: string) {
  const ownVesselKey = await loadVesselVerifyingKey();
  return ownedStore(larDataDir(), async (repo) => {
    const url = carriageDocUrl(nodeNexusIsland({ ownVesselKey, sealHome: larSealHome() }));
    const board = await materializeSharedLarDoc(repo, url, "board:carriage-contracts");
    return placeKelHeadFromBoard(board.doc(), { aid }, null);
  });
}
const chain = () => {
  const start = mintPlaceInception({ signerSeed: seed(1), coldVerifyingKey: key(2) });
  const one = mintPlaceRotation({ chain: [start.event], coldSeed: seed(2), newSignerKey: key(3), nextColdVerifyingKey: key(4) });
  const two = mintPlaceRotation({ chain: [start.event, one], coldSeed: seed(4), newSignerKey: key(5), nextColdVerifyingKey: key(6) });
  return { start, one, two };
};

describe("a carry bundle carries verified place descent", () => {
  it("an offline herm takes a rotation and its own board reads the new head", async () => {
    const { seal, bundle, boardUrl } = await setup();
    const { start, one } = chain();
    await ownedStore(larDataDir(), async (repo) => {
      const board = await materializeSharedLarDoc(repo, boardUrl as never, "board:carriage-contracts");
      board.change((d) => { writePlaceKelEvent(d, start.aid, start.event); writePlaceKelEvent(d, start.aid, one); });
    });
    // The issuer reads every KEL row on its board into a fresh carry.
    const issued = await ownedStore(larDataDir(), async (repo) => {
      const board = await materializeSharedLarDoc(repo, boardUrl as never, "board:carriage-contracts");
      const { carryBundleFrom } = await import("../src/carry-bundle.js");
      const { foundingRoster } = await import("@lararium/mesh");
      return carryBundleFrom({ aid: bundle.aid, nym: seal.nym, board: board.doc(), roster: foundingRoster(readNexusDoc(larSealHome())) });
    });
    expect(issued?.placeKel).toHaveLength(2);
    at(herm);
    await direct(takeCarryBundle)({ raw: JSON.stringify({ ...bundle, placeKel: [start.event] }), ownVesselKey: seal.nym });
    const base = await head(start.aid);
    expect(base.ok && base.seq).toBe(0);
    await direct(takeCarryBundle)({ raw: JSON.stringify(issued), ownVesselKey: seal.nym });
    const rotated = await head(start.aid);
    expect(rotated.ok && rotated.seq).toBe(1);
  }, 60_000);

  it("a forged row, gap, and fork land only a verifying prefix", async () => {
    const { seal, bundle } = await setup();
    const { start, one, two } = chain();
    const fork = mintPlaceRotation({ chain: [start.event], coldSeed: seed(2), newSignerKey: key(7), nextColdVerifyingKey: key(8) });
    const forged = { ...one, sig: "0".repeat(128) };
    at(herm);
    for (const rows of [[start.event, forged], [start.event, two], [start.event, one, fork]]) {
      await direct(takeCarryBundle)({ raw: JSON.stringify({ ...bundle, placeKel: rows }), ownVesselKey: seal.nym });
      const read = await head(start.aid);
      expect(read.ok && read.seq).toBe(0);
    }
  }, 60_000);

  it("a bundle without placeKel refuses before its carry lands", async () => {
    const { seal, bundle } = await setup();
    const { placeKel: _omit, ...missing } = bundle;
    at(herm);
    await expect(direct(takeCarryBundle)({ raw: JSON.stringify(missing), ownVesselKey: seal.nym })).rejects.toBeInstanceOf(CarryBundleError);
    const { start } = chain();
    expect((await head(start.aid)).ok).toBe(false);
  }, 60_000);
});
