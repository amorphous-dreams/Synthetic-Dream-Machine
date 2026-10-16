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
  carriageDocUrl, carriageEntriesFromBoard, filePlaceFloorPins, foldCarrierSet, hearthPinIndex, materializeSharedLarDoc,
  placeFloorPinsFromBoard, ORACLE_SOCKET_ROUTE, type LarDoc,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { runNexusCarryFor, runNexusContract } from "../src/commands/nexus-contract.js";
import { takeCarryBundle, type CarryBundle } from "../src/carry-bundle.js";
import { placeCarriedNexuses } from "../src/vessel-raise.js";
import { ownedStore } from "../src/owned-store.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { restEvery } from "./resting-repo.js";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";

const roots: Record<"hearth" | "herm" | "reader", string> = { hearth: "", herm: "", reader: "" };
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
async function carryBoth(): Promise<{ herm: string; reader: string; readerBundle: CarryBundle }> {
  at(roots.hearth);
  await generateOrLoadVesselIdentity();
  const seated = await seatChairs([0, 1, 2]);
  writeNexusDoc(larSealHome(), heldCharter({ keys: seated.keys, threshold: 2 }).doc({ labels: ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"] }));
  const seals: Record<string, Awaited<ReturnType<typeof runNexusCarryFor>>> = {};
  const bundles: Record<string, CarryBundle> = {};
  for (const who of ["herm", "reader"] as const) {
    at(roots.hearth); const doc = readNexusDoc(larSealHome())!;
    at(roots[who]); await generateOrLoadVesselIdentity(); writeNexusDoc(larSealHome(), doc);
    seals[who] = await runNexusCarryFor({ sealHome: larSealHome() });
    at(roots.hearth);
    const s = seals[who]!;
    bundles[who] = (await direct(runNexusContract)({ action: "carry", nym: s.nym, carrierSig: s.carrierSig, floorPin: JSON.stringify(s.floorPin) })).carryBundle as CarryBundle;
  }
  return { herm: seals["herm"]!.nym, reader: seals["reader"]!.nym, readerBundle: bundles["reader"]! };
}

describe("a carry bundle carries the counted carries of the places whose floor pins it carries", () => {
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
