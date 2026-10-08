/**
 * host-command.test.ts — the hearth's three hosting doors, end to end on a temp LAR_ROOT: a real vessel
 * identity, real persona roots seated in a real charter, a real Automerge board on disk.
 *
 * Proven:
 *   · `runHostRoll` signs the hosting act with the face's per-Nexus leaf, keeps the state, and LANDS the act on
 *     this hearth's hosting doc in the Nexus — the doc a walker reads — and never on the carriage board; a second
 *     roll chains from the first;
 *   · RED: with a running vessel's Repo handed in, the act lands on THAT replica at once, the replica its walkers
 *     sync — no second Repo, no restart; CONTROL: with none, the door opens the store itself and the act is on
 *     disk for the next opener;
 *   · `runHostInvite` mints a `host-invite` token at the current epoch: the carried string decodes, names this
 *     vessel's gate key and the Nexus, and REDEEMS through the vessel's own sorter, after which `runHostState`
 *     counts one redemption;
 *   · REFUSALS write nothing: no charter, a Nexus this hearth does not carry, an invite before any roll.
 */
import { NEXUS_DOC_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, genesisSealEpochCid, carriageDocUrl, hostingDocUrl, materializeSharedLarDoc, hostingActsFromBoard, hostingActCid, decodeInvite,
  tokenVerifiesAt, redeemClaim, signLeafProof, type NexusDoc, type Presented,
} from "@lararium/mesh";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { heldNexusLeaves } from "../src/nexus-leaf.js";
import { runHostRoll, runHostInvite, runHostState, HostRefusal } from "../src/commands/host.js";
import { hearthDoorReactors } from "../src/hearth-door-verbs.js";
import { readHostingState, liveEpochs, hostingDir } from "../src/hosting-store.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";

let root: string;
let priorLarRoot: string | undefined;
const sealHome = (): string => join(root, "state", "nexus");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-host-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

/** Seat a charter whose founding kahu are this vessel's own held persona roots — so the vessel carries it. */
async function seatOwnCharter(): Promise<{ aid: string; doc: NexusDoc }> {
  await generateOrLoadVesselIdentity();
  const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
  const keys = roots.map((r) => r.verifyingKey);
  const doc: NexusDoc = {
    kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2),
    kahu: keys.map((verifyingKey, i) => ({ displayName: `Kahu ${i}`, verifyingKey })),
  };
  writeNexusDoc(sealHome(), doc);
  return { aid: doc.sealEpochCid!, doc };
}

/** The hosting acts a doc carries, read by a fresh opener of the vessel's store. */
async function docActs(url: Parameters<typeof materializeSharedLarDoc>[1]): Promise<ReturnType<typeof hostingActsFromBoard>> {
  const repo = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
  try { return hostingActsFromBoard((await materializeSharedLarDoc(repo, url, "hosting")).doc()); }
  finally { await repo.shutdown().catch(() => {}); }
}

describe("lares host — roll, invite, state", () => {
  it("a roll lands the signed act on this hearth's hosting doc, never the carriage board; a second roll chains from the first", async () => {
    const { aid } = await seatOwnCharter();
    const doc = hostingDocUrl(aid, await loadVesselVerifyingKey());
    const first = await runHostRoll({ sealHome: sealHome() });
    expect(first).toMatchObject({ nexusAid: aid, previous: null, docUrl: doc });
    const leaf = (await heldNexusLeaves(aid))[0]!;
    expect(first.act.hearthLeaf).toBe(leaf.verifyingKey);
    expect((await docActs(doc)).map(hostingActCid)).toEqual([first.epoch]);
    expect(await docActs(carriageDocUrl(aid))).toEqual([]);
    const second = await runHostRoll({ sealHome: sealHome(), cap: 2 });
    expect(second.act.prev).toBe(first.epoch);
    expect(second.cap).toBe(2);
    expect((await docActs(doc)).map(hostingActCid).sort()).toEqual([first.epoch, second.epoch].sort());
  });

  it("RED: the door served inside a running vessel lands the act on its live replica at once; CONTROL: the direct door lands it on disk", async () => {
    const { aid } = await seatOwnCharter();
    const doc = hostingDocUrl(aid, await loadVesselVerifyingKey());
    // The running vessel holds its store and already carries its hosting doc in its replica.
    const live = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
    try {
      const held = await materializeSharedLarDoc(live, doc, "hosting");
      const doors = hearthDoorReactors({ storageDir: larDataDir(), sealHome: sealHome(), repo: live, dialGate: () => null });
      const rolled = await doors["host-roll"]({}, {} as never);
      expect(rolled["refused"]).toBeUndefined();
      expect(hostingActsFromBoard(held.doc()).map(hostingActCid)).toEqual([rolled["epoch"]]);
    } finally { await live.shutdown().catch(() => {}); }
    // CONTROL: no vessel stands — the CLI's own door opens the store, and the next opener reads both acts.
    const direct = await runHostRoll({ sealHome: sealHome() });
    expect((await docActs(doc)).map(hostingActCid)).toContain(direct.epoch);
  });

  it("an invite the hearth mints redeems through its own sorter, and the state counts it", async () => {
    const { aid, doc } = await seatOwnCharter();
    await runHostRoll({ sealHome: sealHome() });
    const { invite, epoch } = await runHostInvite({ sealHome: sealHome(), relay: "ws://hearth:8080/ws" });
    const carried = decodeInvite(invite)!;
    expect(carried).toMatchObject({ nexusAid: aid, gatePubKey: await loadVesselVerifyingKey(), relay: "ws://hearth:8080/ws" });
    expect(carried.token.purpose).toBe("host-invite");
    const leaf = (await heldNexusLeaves(aid))[0]!;
    const live = liveEpochs(readHostingState(larDataDir(), aid)!, leaf.seed)!;
    expect(live.current.cid).toBe(epoch);
    expect(tokenVerifiesAt(live.current, carried.token)).toBe(true);

    // A newcomer redeems it at this hearth's gate, through the vessel's own sorter.
    const guestSeed = new Uint8Array(32).fill(7);
    const guestLeaf = hex(await ed.getPublicKeyAsync(guestSeed));
    const vesselKey = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(8)));
    const arm: Presented = { kind: "token", nexusAid: aid, token: carried.token, claim: redeemClaim(guestSeed, carried.token.n), leaf: guestLeaf };
    const leafProof = await signLeafProof({ presented: arm, nonce: "ab".repeat(32), gatePubKey: "ee".repeat(32), vesselKey, sign: async (b) => hex(await ed.signAsync(b, guestSeed)) });
    const roster = { keys: doc.kahu.map((k) => k.verifyingKey!), threshold: 2, sealEpochCid: aid };
    const reading: CarriedNexusReading = { aid, via: "seat", island: aid, roster, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: roster, posture: "private" };
    const sort = makeSocketSorter({
      readings: async () => [reading], carrier: () => false, primaryPosture: () => "private",
      hosting: { storageDir: larDataDir(), leafSeedFor: async (a) => (await heldNexusLeaves(a))[0]?.seed ?? null },
    });
    const verdict = await sort({
      identifier: `0x${vesselKey}`, vesselKey, sameOperator: false,
      presented: { ...arm, leafProof } as Presented, challenge: { nonce: "ab".repeat(32), gatePubKey: "ee".repeat(32) },
    });
    expect(verdict?.class).toBe("walker");
    expect(await runHostState({ sealHome: sealHome() })).toEqual([{
      nexusAid: aid, epoch, previousEpoch: null, cap: 3, redeemed: 1, redeemedPrevious: 0,
    }]);
  });

  it("REFUSALS write nothing: no charter, an uncarried Nexus, an invite before any roll", async () => {
    await generateOrLoadVesselIdentity();
    await expect(runHostRoll({ sealHome: sealHome() })).rejects.toBeInstanceOf(HostRefusal);
    const { aid } = await seatOwnCharter();
    await expect(runHostRoll({ sealHome: sealHome(), nexusAid: "epoch0-" + "b".repeat(64) })).rejects.toThrow(/does not carry/);
    await expect(runHostInvite({ sealHome: sealHome() })).rejects.toThrow(/hosts no one here yet/);
    expect(existsSync(hostingDir(larDataDir(), aid))).toBe(false);
  });
});
