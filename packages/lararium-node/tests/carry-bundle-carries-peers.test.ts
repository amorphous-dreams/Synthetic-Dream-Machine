/**
 * carry-bundle-carries-peers.test.ts — a place carried LAST (a reader that runs no daemon and syncs no board) files the
 * floor pin of a herm the same quorum carried EARLIER, off the counted carry its own bundle hands it; and never the pin
 * of a place whose carry its replica does not count.
 *
 *   · RED before the fix: the bundle carries the herm's floor-pin statement but not its carry, so the reader's replica
 *     counts no carrier but itself and the herm's pin lands nowhere (`pin-absent` at the read);
 *   · the law holds: a statement whose place no counted carry names (a pin whose carry the bundle omits) still lands nowhere.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carriageDocUrl, carriageEntriesFromBoard, filePlaceFloorPins, foldCarrierSet, foundingRoster, hearthPinIndex, materializeSharedLarDoc,
  placeFloorPinsFromBoard, signCarriageQuorum, carriageEntryCounts, ORACLE_SOCKET_ROUTE, type LarDoc,
  ed25519SignerFromSeed, epochSeats, rollAnchorCounts, rollAnchorsFromBoard, signRollAnchor,
} from "@lararium/mesh";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusCarryFor, runNexusContract } from "../src/commands/nexus-contract.js";
import { takeCarryBundle, type CarryBundle } from "../src/carry-bundle.js";
import { placeCarriedNexuses } from "../src/vessel-raise.js";
import { liveBoardOpener, readCarriedNexuses } from "../src/nexus-carriage.js";
import { unionReadings } from "../src/vessel-raise.js";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { primaryNexusAid } from "../src/carried-set.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { restEvery } from "./resting-repo.js";
import { direct } from "./direct-store.js";
import { vesselCarriagePull } from "../src/herm-carriage.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { chairKey, chairSeed, seatChairs } from "./seat-fixture.js";

const roots: Record<"hearth" | "herm" | "relay" | "lastHop" | "reader" | "outsider", string> = { hearth: "", herm: "", relay: "", lastHop: "", reader: "", outsider: "" };
let prior: string | undefined;
const at = (root: string): void => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  for (const k of Object.keys(roots) as Array<keyof typeof roots>) roots[k] = mkdtempSync(join(tmpdir(), `carry-peers-${k}-`));
  prior = process.env["LAR_ROOT"];
});
afterEach(async () => {
  await restEvery();
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  for (const r of Object.values(roots)) rmSync(r, { recursive: true, force: true });
});

/** The floor pins the vessel at the current root files off its own replica, as its carriage refresh files them. */
async function filedHere(): Promise<readonly string[]> {
  const ownVesselKey = await loadVesselVerifyingKey();
  return ownedStore(larDataDir(), async (repo) => {
    const open = async (url: string, label: string): Promise<LarDoc | undefined> => (await materializeSharedLarDoc(repo, url as never, label)).doc();
    const filed: string[] = [];
    for (const r of await placeCarriedNexuses({ sealHome: larSealHome(), ownVesselKey, open: open as never })) {
      const doc = await open(carriageDocUrl(r.island), "board:carriage-contracts");
      const carriers = await foldCarrierSet(carriageEntriesFromBoard(doc), r.roster);
      filed.push(...filePlaceFloorPins(hearthPinIndex(), placeFloorPinsFromBoard(doc),
        { nexusHex: Buffer.from(r.aid, "utf8").toString("hex"), route: ORACLE_SOCKET_ROUTE, carriers }).filed);
    }
    return filed;
  });
}

/** The hearth seats a charter; each place founds a key and imports it, signs its carrier seal, and the hearth carries it. */
async function carryBoth(rolled = false): Promise<{ herm: string; reader: string; readerBundle: CarryBundle; lastHop?: string }> {
  at(roots.hearth);
  await generateOrLoadVesselIdentity();
  if (rolled) for (const face of [0, 1, 2]) await generateOrLoadPersonaGroupRoot(face);
  const seated = await seatChairs([0, 1, 2]);
  const successors = rolled ? await seatChairs([0, 1, 2], { generation: 1 }) : null;
  const genesis = heldCharter({ keys: seated.keys, threshold: 2,
    ...(successors ? { successors: { keys: successors.keys, threshold: 2 } } : {}) });
  const charter = successors ? await genesis.roll(successors.hands) : genesis;
  writeNexusDoc(larSealHome(), charter.doc({ labels: ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] }));
  const seals: Record<string, Awaited<ReturnType<typeof runNexusCarryFor>>> = {};
  const bundles: Record<string, CarryBundle> = {};
  for (const who of (rolled ? ["herm", "relay", "lastHop", "reader"] as const : ["herm", "reader"] as const)) {
    at(roots.hearth); const doc = readNexusDoc(larSealHome())!;
    at(roots[who]); await generateOrLoadVesselIdentity(); writeNexusDoc(larSealHome(), doc);
    seals[who] = await runNexusCarryFor({ sealHome: larSealHome() });
    at(roots.hearth);
    const s = seals[who]!;
    bundles[who] = (await direct(runNexusContract)({ action: "carry", nym: s.nym, carrierSig: s.carrierSig, floorPin: JSON.stringify(s.floorPin) })).carryBundle as CarryBundle;
    if (rolled) {
      at(roots[who]);
      await direct(takeCarryBundle)({ raw: JSON.stringify(bundles[who]), ownVesselKey: s.nym });
    }
  }
  return { herm: seals["herm"]!.nym, reader: seals["reader"]!.nym, readerBundle: bundles["reader"]!,
    ...(rolled ? { lastHop: seals["lastHop"]!.nym } : {}) };
}

describe("a carry bundle carries the counted carries of the places whose floor pins it carries", () => {
  it("RED: the take lands a counted roll anchor and leaves a forged copy off the shared board", async () => {
    const { reader, readerBundle } = await carryBoth(true);
    at(roots.reader);
    const charter = readNexusDoc(larSealHome())!;
    const [closed, opened] = charter.sealLineage!;
    const prev = epochSeats(closed!)!;
    const signers = await Promise.all([0, 1].map(async (face) => ({
      signer: await chairKey(face, 1), sign: ed25519SignerFromSeed(chairSeed(face, 1)),
    })));
    const counted = await signRollAnchor({
      prevEpochCid: closed!.epochCid, sealEpochCid: opened!.epochCid,
      prevKeys: prev.keys, prevThreshold: prev.threshold, parents: [],
    }, signers);
    expect(await rollAnchorCounts(counted, foundingRoster(charter))).toBe(true); // control
    const forged = { ...counted, signatures: counted.signatures.map((s, i) => i === 0 ? { ...s, sig: "0".repeat(128) } : s) };
    expect(await rollAnchorCounts(forged, foundingRoster(charter))).toBe(false); // control
    await direct(takeCarryBundle)({ raw: JSON.stringify({ ...readerBundle, rollAnchors: [counted, forged] }), ownVesselKey: reader });
    const anchors = await ownedStore(larDataDir(), async (repo) => {
      const island = nodeNexusIsland({ ownVesselKey: reader, sealHome: larSealHome() });
      const board = await materializeSharedLarDoc(repo, carriageDocUrl(island), "board:carriage-contracts");
      return rollAnchorsFromBoard(board.doc());
    });
    expect(anchors).toEqual([counted]);
  }, 60_000);

  it("A refreshes pins after its founding roll and the witness joins", async () => {
    const { herm, reader, lastHop } = await carryBoth(true);
    at(roots.hearth);
    const head = foundingRoster(readNexusDoc(larSealHome())).sealEpochCid;
    const own = await loadVesselVerifyingKey();
    const island = nodeNexusIsland({ ownVesselKey: own, sealHome: larSealHome() });
    const aid = primaryNexusAid(larSealHome())!;
    const pins = hearthPinIndex();
    at(roots.outsider);
    await generateOrLoadVesselIdentity();
    const unrelated = heldCharter({ keys: (await seatChairs([0, 1, 2], { generation: 1 })).keys, threshold: 2, variant: 7 });
    writeNexusDoc(larSealHome(), unrelated.doc());
    const stranger = await runNexusCarryFor({ sealHome: larSealHome() });
    at(roots.hearth);
    const signers = (await seatChairs([0, 1, 2], { generation: 1 })).hands;
    const unrelatedCarry = await signCarriageQuorum({ nym: stranger.nym, action: "carry", parents: [],
      sealEpochCid: unrelated.roster.sealEpochCid }, signers,
      { signer: stranger.nym, sig: stranger.carrierSig });
    expect(await carriageEntryCounts(unrelatedCarry, unrelated.roster)).toBe(true);
    const result = await ownedStore(larDataDir(), async (repo) => {
      const boards = liveBoardOpener(repo, () => {});
      try {
        const readings = async () => unionReadings(
          await readCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: own, open: boards.open }),
          await placeCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: own, open: boards.open }),
        );
        const acts = carriageEntriesFromBoard(await boards.open(carriageDocUrl(island), "board:carriage-contracts"));
        const carries = acts.filter((act) => act.action === "carry");
        const epochs = carries.map((act) => act.sealEpochCid);
        const count = (await readings()).length;
        const pull = vesselCarriagePull({ placeClass: "lararium", ownPlaceKey: own,
          sign: async () => new Uint8Array(64), readings, ownNexus: () => aid,
          openBoard: (url) => boards.open(url, "board:carriage-contracts"), pins,
          audience: "@daemon", deadlines: { draw: () => ({ cancel() {} }) },
        });
        const pulled = await pull("http://127.0.0.1:9", herm);
        const carriers = await foldCarrierSet([...acts, unrelatedCarry], foundingRoster(readNexusDoc(larSealHome())),
          { sealLineage: readNexusDoc(larSealHome())!.sealLineage ?? [], anchors: [] });
        return { epochs, nyms: carries.map((act) => act.nym), count, pulled, unrelatedCounted: carriers.has(stranger.nym) };
      } finally { boards.dispose(); }
    });
    console.log("founding-roll epochs", { head, carries: result.epochs, readings: result.count, pull: result.pulled, unrelatedCounted: result.unrelatedCounted });
    expect(result.epochs).toHaveLength(4);
    expect(result.epochs).toEqual([head, head, head, head]);
    expect(result.count).toBeGreaterThan(0);
    expect(result.unrelatedCounted).toBe(false);
    expect(result.nyms).toContain(herm);
    expect(result.nyms).toContain(reader);
    for (const nym of result.nyms) {
      expect(pins.get({ hearth: nym, nexus: Buffer.from(aid, "utf8").toString("hex"), route: ORACLE_SOCKET_ROUTE, tier: "floor" })).not.toBeNull();
    }
    at(roots.reader);
    expect(await filedHere()).toContain(lastHop);
    const readerKey = await loadVesselVerifyingKey();
    const readerPins = hearthPinIndex();
    const readerPull = await ownedStore(larDataDir(), async (repo) => {
      const boards = liveBoardOpener(repo, () => {});
      try {
        const readings = async () => unionReadings(
          await readCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: readerKey, open: boards.open }),
          await placeCarriedNexuses({ sealHome: larSealHome(), ownVesselKey: readerKey, open: boards.open }),
        );
        return vesselCarriagePull({ placeClass: "herm", ownPlaceKey: readerKey,
          sign: async () => new Uint8Array(64), readings, ownNexus: () => null,
          openBoard: (url) => boards.open(url, "board:carriage-contracts"), pins: readerPins,
          audience: "@daemon", deadlines: { draw: () => ({ cancel() {} }) },
        })("http://127.0.0.1:9", lastHop!);
      } finally { boards.dispose(); }
    });
    console.log("host-reader pull", readerPull);
    if (!readerPull.ok) expect(readerPull.reason).not.toContain("pin-absent");
  }, 60_000);
  it("a reader carried after a herm files the herm's floor pin off its own bundle", async () => {
    const { herm, reader, readerBundle } = await carryBoth();
    expect(readerBundle.floorPins).toHaveLength(2);
    at(roots.reader);
    const taken = await direct(takeCarryBundle)({ raw: JSON.stringify(readerBundle), ownVesselKey: reader });
    expect([...taken.floorPins].sort()).toEqual([herm, reader].sort());
    expect([...(await filedHere())].sort()).toEqual([herm, reader].sort());
  }, 60_000);

  it("RED by law: a herm's pin whose counted carry the bundle does not hand over lands nowhere", async () => {
    const { herm, reader, readerBundle } = await carryBoth();
    const stripped = { ...readerBundle, peers: [] };
    at(roots.reader);
    const taken = await direct(takeCarryBundle)({ raw: JSON.stringify(stripped), ownVesselKey: reader });
    expect(taken.floorPins).toEqual([reader]);
    expect(await filedHere()).not.toContain(herm);
  }, 60_000);
});
