/**
 * node-walks.test.ts — N: a node vessel MAY walk, and the hearth sorts it by the relation it proves, never by
 * what kind of device it is.
 *
 * Proven, on a temp LAR_ROOT with a real node vessel identity and a real persona root:
 *   · RED: a node vessel holding a carried invite and then a grant sorts WALKER exactly as a browser-shaped leaf
 *     presenting the same arms does — the same class, the same kind of standing;
 *   · the sort input names no device type at all: it carries the proven key, the same-operator vouch, what was
 *     presented and the challenge — nothing else to sort on;
 *   · walking grants no carry duty: the node's carried set and its own charter stand exactly as before, and the
 *     walk lands only under its own `walk/` store.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, genesisSealEpochCid, encodeInvite, mintHostToken, takeInvite, walkIdentity, signPresented, deriveNexusScopedKey,
  hexToBytes, PERSONA_GLAMOUR_CONTEXT, type KahuQuorumSeats, type Presented, type WalkStore, type WalkRecord,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { heldNexusLeaves } from "../src/nexus-leaf.js";
import { carriedSet } from "../src/carried-set.js";
import { nodeWalkStore } from "../src/node-walk-store.js";
import { rollHosting, readHostingState, liveEpochs } from "../src/hosting-store.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import type { SortInput } from "../src/daemon-auth-gate.js";

const AID = "epoch0-" + "a".repeat(64);
const HEARTH_LEAF = new Uint8Array(32).fill(91);
const GATE = "ee".repeat(32);
const NONCE = "ab".repeat(32);
const SEEDS = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

let root: string;
let hearthStore: string;
let priorLarRoot: string | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-node-walks-"));
  hearthStore = mkdtempSync(join(tmpdir(), "lares-hearth-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
  rmSync(hearthStore, { recursive: true, force: true });
});

async function hearth(): Promise<{ sort: ReturnType<typeof makeSocketSorter>; invite: () => string }> {
  await rollHosting({ storageDir: hearthStore, nexusAid: AID, leafSeed: HEARTH_LEAF });
  const keys = await Promise.all(SEEDS.map(pubOf));
  const roster: KahuQuorumSeats = { keys, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2) };
  const reading: CarriedNexusReading = { aid: AID, via: "consent", island: AID, roster, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: roster, posture: "private" };
  const sort = makeSocketSorter({
    readings: async () => [reading], carrier: () => false, primaryPosture: () => "private",
    hosting: { storageDir: hearthStore, leafSeedFor: async () => HEARTH_LEAF },
  });
  const invite = () => encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(liveEpochs(readHostingState(hearthStore, AID)!, HEARTH_LEAF)!.current) });
  return { sort, invite };
}

/** The sort input a dial carrying `identity` puts before the hearth's sorter. */
async function sortInputFor(vesselKey: string, record: WalkRecord, leaf: { verifyingKey: string; seed: Uint8Array }): Promise<SortInput> {
  const id = walkIdentity({ contactCard: vesselKey, peerPubKey: vesselKey, sign: async () => "00".repeat(64) }, record, leaf)!;
  const presented: Presented = await signPresented({ presented: id.presented!, nonce: NONCE, gatePubKey: GATE, vesselKey, sign: id.leafSign! });
  return { identifier: `0x${vesselKey}`, vesselKey, sameOperator: false, presented, challenge: { nonce: NONCE, gatePubKey: GATE } };
}

describe("N — a node vessel walks like any leaf", () => {
  it("RED: a node holding an invite, then a grant, sorts walker exactly as a browser-shaped leaf does", async () => {
    const { sort, invite } = await hearth();
    const nodeVessel = (await generateOrLoadVesselIdentity()).verifyingKey;
    await generateOrLoadPersonaGroupRoot(0);
    const nodeLeaf = (await heldNexusLeaves(AID))[0]!;
    const store: WalkStore = nodeWalkStore(larDataDir());
    const taken = await takeInvite(store, invite());
    const nodeRedeem = await sort(await sortInputFor(nodeVessel, taken!.record, nodeLeaf));
    expect(nodeRedeem?.class).toBe("walker");

    // A browser-shaped leaf: another floor root, its own per-Nexus face, the same kind of record.
    const browserRoot = new Uint8Array(32).fill(77);
    const kp = await deriveNexusScopedKey(browserRoot, 0, PERSONA_GLAMOUR_CONTEXT, AID);
    const browserLeaf = { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) };
    const browserVessel = await pubOf(new Uint8Array(32).fill(78));
    const browserRedeem = await sort(await sortInputFor(browserVessel, { nexusAid: AID, invite: invite() }, browserLeaf));
    expect(browserRedeem?.class).toBe(nodeRedeem?.class);
    expect(Object.keys(browserRedeem!).sort()).toEqual(Object.keys(nodeRedeem!).sort());

    // Both then present their grants, and both stand as walkers again.
    const nodeGrant = nodeRedeem!.grant!;
    const browserGrant = browserRedeem!.grant!;
    expect((await sort(await sortInputFor(nodeVessel, { nexusAid: AID, grant: nodeGrant }, nodeLeaf)))?.class).toBe("walker");
    expect((await sort(await sortInputFor(browserVessel, { nexusAid: AID, grant: browserGrant }, browserLeaf)))?.class).toBe("walker");
  });

  it("the sort input names no device type — only the proven key, the vouch, the presentation and the challenge", async () => {
    await hearth();
    const vessel = await pubOf(new Uint8Array(32).fill(79));
    const kp = await deriveNexusScopedKey(new Uint8Array(32).fill(80), 0, PERSONA_GLAMOUR_CONTEXT, AID);
    const input = await sortInputFor(vessel, { nexusAid: AID, invite: encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: { purpose: "host-invite", n: "11".repeat(32), y: "22".repeat(64) } }) },
      { verifyingKey: kp.verifyingKey.toLowerCase(), seed: hexToBytes(kp.signingKey) });
    expect(Object.keys(input).sort()).toEqual(["challenge", "identifier", "presented", "sameOperator", "vesselKey"]);
  });

  it("walking grants no carry duty: the carried set and the node's own charter stand as before", async () => {
    const { invite } = await hearth();
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    const sealHome = join(root, "state", "nexus");
    const before = await carriedSet(sealHome);
    await takeInvite(nodeWalkStore(larDataDir()), invite());
    expect(await carriedSet(sealHome)).toEqual(before);
    expect(existsSync(join(sealHome, "nexus.json"))).toBe(false);
    expect(readdirSync(join(larDataDir(), "walk"))).toHaveLength(1);
  });
});
