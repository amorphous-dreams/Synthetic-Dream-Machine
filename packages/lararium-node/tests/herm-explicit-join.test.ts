/**
 * herm-explicit-join.test.ts — a herm's EXPLICIT JOIN, end to end through the commands a person runs
 * (lar:///ha.ka.ba/lararium/node/carry-bundle; lar:///ha.ka.ba/lararium/mesh/place-floor-pin), across two vessel roots: a
 * hearth that holds the seats, and a herm that holds only its vessel key and the imported charter.
 *
 *   herm   `nexus carry-for`            → carrier seal + its floor pin at this Nexus, signed by its vessel key
 *   hearth `nexus carry --floor-pin`    → the counted carry and the statement land on the carriage board; a CARRY BUNDLE
 *   herm   `nexus carry-take <bundle>`  → the acts and the pins land on the herm's own replica; its floor gate stands there
 *
 * Proven:
 *   · CONTROL: the whole join; afterwards the herm reads that Nexus `via: "carrier-seal"`, and a reader of that board files
 *     the herm's floor pin under the herm's key;
 *   · RED: a herm that only holds the charter stands no gate (no carrier-seal reading) before the take;
 *   · RED: a floor-pin statement for another Nexus, a forged one, or one signed by another place refuses the carry, and
 *     nothing lands;
 *   · RED: a bundle carrying another place's carry, or a tampered contract, writes nothing on the herm's replica.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carriageDocUrl, carriageEntriesFromBoard, filePlaceFloorPins, writeCarriageEntry, foldCarrierSet, foundingRoster, hearthPinIndex, materializeSharedLarDoc,
  placeFloorPinsFromBoard, placeKelRowsFromBoard, verifyPlaceKel, FLOW_SOCKET_ROUTE, type LarDoc, type PlaceFloorPinStatement,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, loadPlaceAid, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusCarryFor, runNexusContract, NexusContractError } from "../src/commands/nexus-contract.js";
import { takeCarryBundle, CarryBundleError, type CarryBundle } from "../src/carry-bundle.js";
import { placeCarriedNexuses } from "../src/vessel-raise.js";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { primaryNexusAid } from "../src/carried-set.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { restEvery } from "./resting-repo.js";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";

let hearthRoot: string;
let hermRoot: string;
let priorLarRoot: string | undefined;
const at = (root: string): void => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  hearthRoot = mkdtempSync(join(tmpdir(), "herm-join-hearth-"));
  hermRoot   = mkdtempSync(join(tmpdir(), "herm-join-herm-"));
  priorLarRoot = process.env["LAR_ROOT"];
});
afterEach(async () => {
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(hearthRoot, { recursive: true, force: true });
  rmSync(hermRoot, { recursive: true, force: true });
});

/** The hearth seats a 2-of-3 charter; the herm founds its vessel key and imports that charter. Ends standing at the herm. */
async function standBoth(): Promise<{ aid: string }> {
  at(hearthRoot);
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  const seated = await seatChairs([0, 1, 2]);
  writeNexusDoc(larSealHome(), heldCharter({ keys: seated.keys, threshold: 2 }).doc({ labels: ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] }));
  const doc = readNexusDoc(larSealHome());
  const aid = primaryNexusAid(larSealHome())!;
  at(hermRoot);
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  writeNexusDoc(larSealHome(), doc!);
  return { aid };
}

/** What the vessel at the current root reads off its own replica: its carrier-seal readings and the floor pins it files. */
async function readOwn(): Promise<{ carried: string[]; filed: readonly string[] }> {
  const ownVesselKey = await loadVesselVerifyingKey();
  return ownedStore(larDataDir(), async (repo) => {
    const open = async (url: string, label: string): Promise<LarDoc | undefined> => (await materializeSharedLarDoc(repo, url as never, label)).doc();
    const readings = await placeCarriedNexuses({ sealHome: larSealHome(), ownVesselKey, open: open as never });
    const filed: string[] = [];
    // The board as a reader files it: the statements under the carrier set its own replica folds.
    for (const r of readings) {
      const index = hearthPinIndex();
      const doc = await open(carriageDocUrl(r.island), "board:carriage-contracts");
      const carriers = await foldCarrierSet(carriageEntriesFromBoard(doc), r.roster);
      const read = filePlaceFloorPins(index, placeFloorPinsFromBoard(doc), { nexusHex: Buffer.from(r.aid, "utf8").toString("hex"), route: FLOW_SOCKET_ROUTE, kelRows: placeKelRowsFromBoard(doc), standing: { via: "carrier", carriers } });
      filed.push(...read.filed);
    }
    return { carried: readings.filter((r) => r.via === "carrier-seal").map((r) => r.aid), filed };
  });
}

describe("a herm's explicit join: carry-for → carry --floor-pin → carry-take", () => {
  it("CONTROL: the whole join stands the herm's gate at that Nexus, and its floor pin files under its key", async () => {
    const { aid } = await standBoth();
    const seal = await runNexusCarryFor({ sealHome: larSealHome() });
    expect(verifyPlaceKel(seal.placeKel).ok && (verifyPlaceKel(seal.placeKel) as { signerKey: string }).signerKey).toBe(seal.nym);
    expect(seal.floorPin?.aid).toBe(await loadPlaceAid());
    // RED before the take: holding the charter alone stands nothing.
    expect((await readOwn()).carried).toEqual([]);

    at(hearthRoot);
    const carry = await direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, floorPin: JSON.stringify({ floorPin: seal.floorPin, placeKel: seal.placeKel }) });
    expect(carry.carrierHeld).toBe(true);
    expect(carry.carryBundle?.contract.nym).toBe(seal.nym);
    expect(carry.carryBundle?.floorPins).toHaveLength(1);
    // The hearth's own replica files the herm's pin: its board counts the carry.
    expect((await ownedStore(larDataDir(), async (repo) => {
      const doc = (await materializeSharedLarDoc(repo, carry.boardUrl as never, "board:carriage-contracts")).doc();
      const roster = foundingRoster(readNexusDoc(larSealHome()));
      return filePlaceFloorPins(hearthPinIndex(), placeFloorPinsFromBoard(doc), {
        nexusHex: Buffer.from(aid, "utf8").toString("hex"), route: FLOW_SOCKET_ROUTE, kelRows: placeKelRowsFromBoard(doc), standing: { via: "carrier", carriers: await foldCarrierSet(carriageEntriesFromBoard(doc), roster) },
      });
    })).filed).toEqual([seal.nym]);

    at(hermRoot);
    const taken = await direct(takeCarryBundle)({ raw: JSON.stringify(carry.carryBundle), ownVesselKey: seal.nym });
    expect(taken).toMatchObject({ aid, nym: seal.nym, floorPins: [seal.floorPin!.aid] });
    const own = await readOwn();
    expect(own.carried).toEqual([aid]);
    expect(own.filed).toEqual([seal.nym]);
  }, 60_000);

  it("RED: a floor pin for another Nexus, a forged one, or one another place signed refuses the carry and lands nothing", async () => {
    await standBoth();
    const seal = await runNexusCarryFor({ sealHome: larSealHome() });
    const pin = seal.floorPin!;
    at(hearthRoot);
    const other = await runNexusCarryFor({ sealHome: larSealHome() });   // the hearth's own vessel key: another place
    const forged: PlaceFloorPinStatement = { ...pin, sig: pin.sig.replace(/^./, (c) => (c === "0" ? "1" : "0")) };
    const elsewhere: PlaceFloorPinStatement = { ...pin, pin: { ...pin.pin, nexus: Buffer.from("nexus-elsewhere", "utf8").toString("hex") } };
    // The claim of another place, signed over the same pin by a head whose signer is not the carry's nym.
    const wrapped = (floorPin: unknown, placeKel: unknown) => JSON.stringify({ floorPin, placeKel });
    for (const bad of [wrapped(forged, seal.placeKel), wrapped(elsewhere, seal.placeKel), wrapped(other.floorPin, other.placeKel), wrapped(pin, other.placeKel), wrapped(pin, []), JSON.stringify({ floorPin: pin }), "{}"]) {
      await expect(direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, floorPin: bad }))
        .rejects.toBeInstanceOf(NexusContractError);
    }
    // A carry with no claim at all lands nothing: the claim is required, not optional.
    await expect(direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig })).rejects.toBeInstanceOf(NexusContractError);
    const listed = await ownedStore(larDataDir(), async (repo) => {
      const url = carriageDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: larSealHome() }));
      const doc = (await materializeSharedLarDoc(repo, url as never, "board:carriage-contracts")).doc();
      return { acts: carriageEntriesFromBoard(doc).length, pins: placeFloorPinsFromBoard(doc).length };
    });
    expect(listed).toEqual({ acts: 0, pins: 0 });
  }, 60_000);

  it("RED: a bundle carrying another place's carry, or a tampered contract, writes nothing on the herm's replica", async () => {
    await standBoth();
    const seal = await runNexusCarryFor({ sealHome: larSealHome() });
    at(hearthRoot);
    const other = await runNexusCarryFor({ sealHome: larSealHome() });
    // The herm's own carry first: its bundle then names no other place, so what lands of `other` lands off the refused take alone.
    const carryOwn = await direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, floorPin: JSON.stringify({ floorPin: seal.floorPin, placeKel: seal.placeKel }) });
    const carryOther = await direct(runNexusContract)({ action: "carry", nym: other.nym, carrierSig: other.carrierSig, floorPin: JSON.stringify({ floorPin: other.floorPin, placeKel: other.placeKel }) });
    at(hermRoot);
    await expect(direct(takeCarryBundle)({ raw: JSON.stringify(carryOther.carryBundle), ownVesselKey: seal.nym })).rejects.toBeInstanceOf(CarryBundleError);
    const own = carryOwn.carryBundle as CarryBundle;
    const tampered = { ...own, contract: { ...own.contract, signatures: own.contract.signatures.slice(0, 1) } };
    await expect(direct(takeCarryBundle)({ raw: JSON.stringify(tampered), ownVesselKey: seal.nym })).rejects.toBeInstanceOf(CarryBundleError);
    expect((await readOwn()).carried).toEqual([]);
    // CONTROL on the same replica: the untampered bundle takes.
    await direct(takeCarryBundle)({ raw: JSON.stringify(own), ownVesselKey: seal.nym });
    expect((await readOwn()).carried).toHaveLength(1);
    // RED, and the own-key check alone answers it: with this herm already carried here, another place's bundle still takes nothing.
    await expect(direct(takeCarryBundle)({ raw: JSON.stringify(carryOther.carryBundle), ownVesselKey: seal.nym })).rejects.toBeInstanceOf(CarryBundleError);
    expect((await readOwn()).filed).not.toContain(other.nym);
  }, 60_000);

  it("RED: a stale bundle the quorum since closed (an uncarry on the herm's replica descends from it) writes nothing", async () => {
    await standBoth();
    const seal = await runNexusCarryFor({ sealHome: larSealHome() });
    at(hearthRoot);
    const carry = await direct(runNexusContract)({ action: "carry", nym: seal.nym, carrierSig: seal.carrierSig, floorPin: JSON.stringify({ floorPin: seal.floorPin, placeKel: seal.placeKel }) });
    const closed = await direct(runNexusContract)({ action: "uncarry", nym: seal.nym });
    const uncarry = await ownedStore(larDataDir(), async (repo) =>
      carriageEntriesFromBoard((await materializeSharedLarDoc(repo, closed.boardUrl as never, "board:carriage-contracts")).doc()).find((e) => e.action === "uncarry")!);
    at(hermRoot);
    // The uncarry reached the herm's replica (as the board would carry it once the relay opens); the old bundle then heads nothing.
    await ownedStore(larDataDir(), async (repo) => {
      const url = carriageDocUrl(nodeNexusIsland({ ownVesselKey: seal.nym, sealHome: larSealHome() }));
      const handle = await materializeSharedLarDoc(repo, url as never, "board:carriage-contracts");
      handle.change((d) => { writeCarriageEntry(d, (carry.carryBundle as CarryBundle).contract); writeCarriageEntry(d, uncarry); });
      await repo.flush();
    });
    await expect(direct(takeCarryBundle)({ raw: JSON.stringify(carry.carryBundle), ownVesselKey: seal.nym })).rejects.toBeInstanceOf(CarryBundleError);
    expect((await readOwn()).carried).toEqual([]);
  }, 60_000);
});
