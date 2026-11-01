/**
 * carrier-fold-across-roll — a hearth that carried its places at one charter epoch and then rolled files their floor
 * pins at the new head, through the roll's anchor on the carriage board, and never without one (W18).
 *
 * Measured in the held-out herm-mesh cell: the founding hearth's board held all four carry acts, three at the epoch
 * its charter rolled away from, and its head-only carrier fold counted the one carry made after the roll, so it read
 * three herms' pins `place-uncarried` on every refresh.
 *
 *   RED       three places carried at E, a roll to E' lays its anchor; the hearth's own pin filing (the carriage
 *             pull's refresh into its `HearthPinIndex`) files all three pins, and its carried-place reading counts them
 *   CONTROL   the same walk with no roll files all three
 *   CONTROL   fail closed: the same roll with its anchor taken off the board leaves all three uncounted
 *   CONTROL   a place carried after the roll counts at E'
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carriageDocUrl, DAEMON_BAG_ID, foundingRoster, hearthPinIndex, materializeSharedLarDoc, FLOW_SOCKET_ROUTE, rollAnchorKey,
  rollAnchorsFromBoard, type LarDoc,
} from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusCarryFor, runNexusContract, runNexusRollAnchor } from "../src/commands/nexus-contract.js";
import { liveBoardOpener, readCarriedNexuses } from "../src/nexus-carriage.js";
import { unionReadings, placeCarriedNexuses } from "../src/vessel-raise.js";
import { vesselCarriagePull } from "../src/herm-carriage.js";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { primaryNexusAid } from "../src/carried-set.js";
import { restEvery } from "./resting-repo.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";
import { openTestCustody, sealTestCustody } from "./found-route.js";

let roots: { hearth: string; peers: string[] };
let prior: string | undefined;
const at = (root: string): void => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  prior = process.env["LAR_ROOT"];
  roots = { hearth: mkdtempSync(join(tmpdir(), "roll-hearth-")), peers: Array.from({ length: 4 }, () => mkdtempSync(join(tmpdir(), "roll-peer-"))) };
});
afterEach(async () => {
  await restEvery();
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  rmSync(roots.hearth, { recursive: true, force: true });
  for (const root of roots.peers) rmSync(root, { recursive: true, force: true });
});

type Carry = Awaited<ReturnType<typeof runNexusCarryFor>>;

/** A place mints its carrier seal over the charter the hearth stands on now; a place that stands already re-mints. */
async function carryFor(peer: string, again = false): Promise<Carry> {
  at(roots.hearth);
  const charter = readNexusDoc(larSealHome())!;
  at(peer);
  if (again) await openTestCustody(); else await sealTestCustody();
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  writeNexusDoc(larSealHome(), charter);
  const carry = await runNexusCarryFor({ sealHome: larSealHome() });
  at(roots.hearth);
  return carry;
}

/** The hearth signs each carry through its store, as its store door does. */
async function land(carries: readonly Carry[]): Promise<void> {
  at(roots.hearth);
  await ownedStore(larDataDir(), async (repo) => {
    for (const c of carries) {
      await runNexusContract({ action: "carry", nym: c.nym, carrierSig: c.carrierSig, floorPin: JSON.stringify({ floorPin: c.floorPin, placeKel: c.placeKel }), sealHome: larSealHome(), repo });
    }
  });
}

/** Stage a seated hearth over a charter that may roll, and carry three places at its genesis epoch. */
async function stage(roll: "none" | "anchored" | "anchor-taken"): Promise<{ carries: Carry[]; later: () => Promise<Carry> }> {
  at(roots.hearth);
  await sealTestCustody();
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  for (const face of [0, 1, 2]) await generateOrLoadPersonaGroupRoot(face);
  const seats = await seatChairs([0, 1, 2]);
  const next = await seatChairs([0, 1, 2], { generation: 1 });
  const genesis = heldCharter({ keys: seats.keys, threshold: 2, successors: { keys: next.keys, threshold: 2 } });
  writeNexusDoc(larSealHome(), genesis.doc());
  await openTestCustody();
  const carries: Carry[] = [];
  for (const peer of roots.peers.slice(0, 3)) carries.push(await carryFor(peer));
  await land(carries);
  if (roll !== "none") {
    at(roots.hearth);
    const rolled = await genesis.roll(next.hands);
    await ownedStore(larDataDir(), async (repo) => {
      await runNexusRollAnchor({
        sealHome: larSealHome(), repo, closing: foundingRoster(readNexusDoc(larSealHome())!),
        opened: { keys: [...rolled.keys], threshold: rolled.threshold, sealEpochCid: rolled.head.epochCid },
      });
      if (roll === "anchor-taken") {
        const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() });
        const handle = await materializeSharedLarDoc(repo, carriageDocUrl(island), "board:carriage-contracts");
        const anchors = rollAnchorsFromBoard(handle.doc());
        expect(anchors.length, "the roll laid its anchor before the test takes it").toBeGreaterThan(0);
        handle.change((d: LarDoc) => { for (const a of anchors) delete d.tiddlers[rollAnchorKey(a)]; });
        expect(rollAnchorsFromBoard(handle.doc())).toHaveLength(0);
      }
    });
    writeNexusDoc(larSealHome(), rolled.doc());
  }
  return { carries, later: async () => { const c = await carryFor(roots.peers[3]!); await land([c]); return c; } };
}

/** The hearth's own pin filing, read off the product's pin index, and its carried-place fold per place. */
async function filed(nyms: readonly string[]): Promise<{ pins: boolean[]; counted: boolean[] }> {
  at(roots.hearth);
  const own = await loadVesselVerifyingKey();
  const aid = primaryNexusAid(larSealHome())!;
  const nexus = Buffer.from(aid, "utf8").toString("hex");
  const pins = hearthPinIndex();
  return ownedStore(larDataDir(), async (repo) => {
    const boards = liveBoardOpener(repo, () => {});
    try {
      const readings = async () => unionReadings(
        await readCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: own, open: boards.open }),
        await placeCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: own, open: boards.open }),
      );
      expect((await readings()).map((r) => r.aid), "the hearth reads its own Nexus").toContain(aid);
      const pull = vesselCarriagePull({
        placeClass: "lararium", ownPlaceKey: own, sign: async () => new Uint8Array(64), readings, ownNexus: () => aid,
        openBoard: (url) => boards.open(url, "board:carriage-contracts"), pins, audience: DAEMON_BAG_ID,
        deadlines: { draw: () => ({ cancel() {} }) },
      });
      await pull("http://127.0.0.1:9", nyms[0]!);
      const counted: boolean[] = [];
      for (const nym of nyms) {
        const placed = await placeCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: nym, open: boards.open });
        counted.push(placed.some((r) => r.aid === aid));
      }
      return { pins: nyms.map((nym) => pins.get({ hearth: nym, nexus, route: FLOW_SOCKET_ROUTE, tier: "floor" }) !== null), counted };
    } finally { boards.dispose(); }
  });
}

describe("a carrier fold crosses a charter roll through its anchor alone (W18)", () => {
  it("RED: places carried before a roll file their pins and count at the new head", async () => {
    const { carries } = await stage("anchored");
    expect(await filed(carries.map((c) => c.nym))).toEqual({ pins: [true, true, true], counted: [true, true, true] });
  }, 90_000);

  it("CONTROL: with no roll every place files and counts", async () => {
    const { carries } = await stage("none");
    expect(await filed(carries.map((c) => c.nym))).toEqual({ pins: [true, true, true], counted: [true, true, true] });
  }, 90_000);

  it("CONTROL: fail closed: with the roll's anchor taken off the board no closed-epoch carry counts", async () => {
    const { carries } = await stage("anchor-taken");
    expect(await filed(carries.map((c) => c.nym))).toEqual({ pins: [false, false, false], counted: [false, false, false] });
  }, 90_000);

  it("CONTROL: a place carried after the roll files and counts at the head", async () => {
    const { later } = await stage("anchored");
    const after = await later();
    const read = await filed([after.nym]);
    expect(read).toEqual({ pins: [true], counted: [true] });
  }, 90_000);
});

/** Carry one place through an optional revoke/re-admit-like carrier cycle around a roll. */
async function carryCycle(rollBetween: boolean): Promise<Carry> {
  at(roots.hearth);
  await sealTestCustody();
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  for (const face of [0, 1, 2]) await generateOrLoadPersonaGroupRoot(face);
  const seats = await seatChairs([0, 1, 2]);
  const next = await seatChairs([0, 1, 2], { generation: 1 });
  const genesis = heldCharter({ keys: seats.keys, threshold: 2, successors: { keys: next.keys, threshold: 2 } });
  writeNexusDoc(larSealHome(), genesis.doc());
  await openTestCustody();

  const first = await carryFor(roots.peers[0]!);
  await land([first]);
  at(roots.hearth);
  await ownedStore(larDataDir(), async (repo) => {
    await runNexusContract({ action: "uncarry", nym: first.nym, sealHome: larSealHome(), repo });
  });
  if (rollBetween) {
    const rolled = await genesis.roll(next.hands);
    await ownedStore(larDataDir(), async (repo) => {
      await runNexusRollAnchor({
        sealHome: larSealHome(), repo, closing: foundingRoster(readNexusDoc(larSealHome())!),
        opened: { keys: [...rolled.keys], threshold: rolled.threshold, sealEpochCid: rolled.head.epochCid },
      });
    });
    writeNexusDoc(larSealHome(), rolled.doc());
  }
  const again = await carryFor(roots.peers[0]!, true);
  expect(again.nym, "the same place carries again").toBe(first.nym);
  await land([again]);
  return again;
}

describe("a re-carry follows its carried uncarry through a charter roll", () => {
  it("RED: uncarry at E, roll to E', then re-carry the same place at E' counts", async () => {
    const again = await carryCycle(true);
    expect(again.nym).toBeTruthy();
    expect(await filed([again.nym])).toEqual({ pins: [true], counted: [true] });
  }, 90_000);

  it("CONTROL: uncarry and re-carry at E counts without a roll", async () => {
    const again = await carryCycle(false);
    expect(again.nym).toBeTruthy();
    expect(await filed([again.nym])).toEqual({ pins: [true], counted: [true] });
  }, 90_000);
});
