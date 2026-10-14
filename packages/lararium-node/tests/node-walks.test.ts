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
  hex, encodeInvite, mintHostToken, takeInvite, walkIdentity, makeMultiSigQuorumVerifier,
  hexToBytes, PERSONA_GLAMOUR_CONTEXT, type KahuQuorumSeats, type Presented, type WalkStore, type WalkRecord,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { mintNexusLeaf } from "../src/nexus-leaf.js";
import { signNexusKeyHandOver, signAntigenEntry, ed25519SignerFromSeed, type NexusKeyHandOver, type KapaeAntigenEntry } from "@lararium/mesh";
import { carriedSet } from "../src/carried-set.js";
import { nodeWalkStore } from "../src/node-walk-store.js";
import { rollHosting, readHostingState, liveEpochs } from "../src/hosting-store.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import type { SortInput } from "../src/daemon-auth-gate.js";
import { presentOnSocket, socketUnderTest } from "./gate-dial-fixture.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";

const AID = "nexus-" + "a".repeat(64);
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

async function hearth(board: { handOvers?: readonly NexusKeyHandOver[]; antigen?: (roster: KahuQuorumSeats) => Promise<readonly KapaeAntigenEntry[]> } = {}): Promise<{ sort: ReturnType<typeof makeSocketSorter>; invite: () => string }> {
  await rollHosting({ nexusAid: AID, leafSeed: HEARTH_LEAF });
  const keys = await Promise.all(SEEDS.map(pubOf));
  const roster: KahuQuorumSeats = { keys, threshold: 2, sealEpochCid: heldCharter({ keys: keys, threshold: 2 }).aid };
  const antigen = board.antigen ? await board.antigen(roster) : [];
  const reading: CarriedNexusReading = { nexus: AID, aid: AID, revision: "fixture", via: "consent", island: AID, roster, sealLineage: [], denyBoard: [], antigen, handOvers: board.handOvers ?? [], antigenRoster: roster, antigenVerifier: makeMultiSigQuorumVerifier(), posture: "private" };
  const sort = makeSocketSorter({
    readings: async () => [reading], carrier: () => false, primaryPosture: () => "private",
    hosting: { leafSeedFor: async () => HEARTH_LEAF },
  });
  const live = liveEpochs((await readHostingState(AID))!, HEARTH_LEAF)!;
  const invite = () => encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(live.current) });
  return { sort, invite };
}

/** The sort input a dial carrying `identity` puts before the hearth's sorter. */
async function sortInputFor(vesselKey: string, record: WalkRecord, leaf: { verifyingKey: string; seed: Uint8Array }): Promise<SortInput> {
  const id = walkIdentity({ contactCard: vesselKey, peerPubKey: vesselKey, sign: async () => "00".repeat(64) }, record, leaf)!;
  const presented: Presented = await presentOnSocket(socketUnderTest(vesselKey, { nonce: NONCE, gatePubKey: GATE }), id.presented!, id.leafSign!);
  return { identifier: `0x${vesselKey}`, vesselKey, sameOperator: false, presented, challenge: { nonce: NONCE, gatePubKey: GATE } };
}

/** A synthetic walker's key at the Nexus: its 32 bytes ARE the key, as a per-Nexus key mints at random. */
const randomKeyOf = async (seed: Uint8Array): Promise<{ signingKey: string; verifyingKey: string }> =>
  ({ signingKey: Buffer.from(seed).toString("hex"), verifyingKey: Buffer.from(await import("@noble/ed25519").then((m) => m.getPublicKeyAsync(seed))).toString("hex") });

describe("N — a node vessel walks like any leaf", () => {
  it("RED: a node holding an invite, then a grant, sorts walker exactly as a browser-shaped leaf does", async () => {
    const { sort, invite } = await hearth();
    const nodeVessel = (await generateOrLoadVesselIdentity()).verifyingKey;
    await generateOrLoadPersonaGroupRoot(0);
    const nodeLeaf = await mintNexusLeaf(0, AID);
    const store: WalkStore = nodeWalkStore();
    const taken = await takeInvite(store, invite());
    const nodeRedeem = await sort(await sortInputFor(nodeVessel, taken!.record, nodeLeaf));
    expect(nodeRedeem?.class).toBe("walker");

    // A browser-shaped leaf: another floor root, its own per-Nexus face, the same kind of record.
    const browserRoot = new Uint8Array(32).fill(77);
    const kp = await randomKeyOf(browserRoot);
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
    const kp = await randomKeyOf(new Uint8Array(32).fill(80));
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
    await takeInvite(nodeWalkStore(), invite());
    expect(await carriedSet(sealHome)).toEqual(before);
    expect(existsSync(join(sealHome, "nexus.json"))).toBe(false);
    expect(readdirSync(join(larDataDir(), "walk"))).toHaveLength(1);
  });
});

describe("a walker's key follows its hand-over line at the hearth's sorter", () => {
  const OLD = new Uint8Array(32).fill(91), NEW = new Uint8Array(32).fill(92);
  const keyOf = async (seed: Uint8Array) => ({ verifyingKey: await pubOf(seed), seed });
  const line = async () => [await signNexusKeyHandOver({ nexus: AID, from: await pubOf(OLD), to: await pubOf(NEW) }, ed25519SignerFromSeed(OLD), ed25519SignerFromSeed(NEW))];
  const kapaeOn = (seed: Uint8Array) => async (roster: KahuQuorumSeats) => [await signAntigenEntry(
    { nym: await pubOf(seed), action: "kapae", parents: [], sealEpochCid: roster.sealEpochCid },
    await Promise.all(SEEDS.map(async (s) => ({ signer: await pubOf(s), sign: ed25519SignerFromSeed(s) }))))];
  const redeem = async (sort: ReturnType<typeof makeSocketSorter>, invite: () => string, seed: Uint8Array, fill: number) => {
    const vessel = await pubOf(new Uint8Array(32).fill(fill));
    return sort(await sortInputFor(vessel, { nexusAid: AID, invite: invite() }, await keyOf(seed)));
  };

  it("W1 the key a hand-over moved on stands as no walker; its successor stands (CONTROL: no line, the first key stands)", async () => {
    const plain = await hearth();
    expect((await redeem(plain.sort, plain.invite, OLD, 93))?.class).toBe("walker");
    const moved = await hearth({ handOvers: await line() });
    expect((await redeem(moved.sort, moved.invite, OLD, 94))?.class).not.toBe("walker");
    expect((await redeem(moved.sort, moved.invite, NEW, 95))?.class).toBe("walker");
  });

  it("W2 a kapae on the key a hand-over moved on holds its successor out of the walker class", async () => {
    const held = await hearth({ handOvers: await line(), antigen: kapaeOn(OLD) });
    expect((await redeem(held.sort, held.invite, NEW, 96))?.class).not.toBe("walker");
  });
});

