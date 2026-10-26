/** The registered nexus-rekey verb reads the booted vessel's custody, charter and daemon board. */
import { afterAll, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, leaseEpochPrefix, quorumLeaseEpochOnBoard, charterHandLineage, nexusAidOf } from "@lararium/mesh";
import { withLarRoot } from "../../../../tests/harness/with-lar-root.js";
import { heldCharter } from "../../../lararium-mesh/tests/charter-fixture.js";
import { direct } from "../direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "../found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, larSealHome, readNexusDoc, writeNexusDoc,
  carriedCharterHome, seatFaceRoute } from "../../dist/src/index.js";
import { loadVesselVerifyingKey } from "../../dist/src/node-vessel-identity.js";
import { loadWornFaceAtomKey } from "../../dist/src/face-atom-store.js";
import { noteVesselRealm } from "../../dist/src/edge-board.js";
import { askIslandVerb } from "../../dist/src/island-verb-ask.js";
import { seatedCustody } from "../../dist/src/custody-seat.js";
import type { NodeVesselResult } from "../../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
const root = mkdtempSync(join(tmpdir(), "nexus-rekey-boot-"));
const genesisDir = join(root, "genesis");
const storageDir = join(root, "data", "lares", "vessel");
const source = join(import.meta.dirname, "..", "..", "..", "..", "genesis");
cpSync(source, genesisDir, { recursive: true });
let vessel: NodeVesselResult | null = null;
let call = 0;
afterAll(async () => { if (vessel) await withLarRoot(root, () => vessel!.teardown()); rmSync(root, { recursive: true, force: true }); });

const ask = async (resource: string) => {
  const vm = vessel!.daemon;
  return withLarRoot(root, async () => askIslandVerb({ daemonHandle: vm.daemonHandle, placeVerb: vm.placeVerb,
    verb: "nexus-rekey", args: { resource }, requestedBy: `0x${await loadVesselVerifyingKey()}`, requestId: `rekey-${++call}` }).answer);
};

describe("nexus-rekey on a booted vessel", () => {
  test("a missing quorum changes no slot; held seats sign the nexus and a ledger-pinned realm", async () => {
    await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    await withLarRoot(root, () => foundSeedCharter({ name: "rekey founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
    const primary = await withLarRoot(root, async () => readNexusDoc(larSealHome()));
    expect(primary?.sealLineage).toHaveLength(1);
    const foreignKeys = await Promise.all([91, 92].map((byte) => ed.getPublicKeyAsync(new Uint8Array(32).fill(byte)).then(hex)));
    const foreign = heldCharter({ keys: foreignKeys, threshold: 2 });
    await withLarRoot(root, async () => writeNexusDoc(carriedCharterHome(larSealHome(), foreign.aid), foreign.doc()));
    vessel = await withLarRoot(root, () => openNodeVessel({ hostId: "rekey", wikiId: "rekey", storageDir, genesisDir,
      wss: new EventEmitter() as never }));
    const daemon = vessel.daemon.daemonHandle;
    await expect(ask(foreign.aid)).rejects.toThrow(/seats-not-held/);
    expect(Object.keys(daemon.doc()?.tiddlers ?? {}).filter((title) => title.startsWith(leaseEpochPrefix(foreign.aid)))).toEqual([]);

    const primaryAid = nexusAidOf(primary)!;
    const rolled = await ask(primaryAid);
    expect(rolled["rolled"]).toBe(1);
    const lineage = charterHandLineage(primary!.sealLineage!)!.lineage;
    expect(quorumLeaseEpochOnBoard(daemon.doc(), primaryAid, lineage)).toBe(1);
    const { leaseEpochOnBoard } = await import("../../dist/src/vessel-raise.js");
    expect(leaseEpochOnBoard(daemon, primaryAid, lineage)).toBe(1);

    const realm = "d7".repeat(32);
    await withLarRoot(root, async () => noteVesselRealm(vessel!.repo, (await loadWornFaceAtomKey())!, realm, primaryAid));
    expect((await ask(realm))["nexus"]).toBe(primaryAid);
    expect(quorumLeaseEpochOnBoard(daemon.doc(), realm, lineage)).toBe(1);

    await withLarRoot(root, async () => seatedCustody()!.lock());
    await expect(ask(primaryAid)).rejects.toThrow(/key rests unopened, so its sealed rows stay shut/);
    expect(quorumLeaseEpochOnBoard(daemon.doc(), primaryAid, lineage)).toBe(1);
  }, 180_000);
});
