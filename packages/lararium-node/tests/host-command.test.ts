/**
 * host-command.test.ts — the hearth's three hosting doors, end to end on a temp LAR_ROOT: a real vessel
 * identity, real persona roots held beneath faces with their seat keys seated in a real charter, a real Automerge board on disk.
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
import { HOSTING_ACT_DOMAIN, writeHostingAct, mintHostingAct } from "@lararium/mesh";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seatedCustody } from "../src/custody-seat.js";
import { holdSealsUntilBothArrive } from "./custody-seat-fixture.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, carriageDocUrl, hostingDocUrl, materializeSharedLarDoc, hostingActsFromBoard, hostingActCid, decodeInvite,
  tokenVerifiesAt, redeemClaim, makeMultiSigQuorumVerifier, type NexusDoc, type Presented,
} from "@lararium/mesh";
import { socketProof, socketUnderTest } from "./gate-dial-fixture.js";
import { restEvery, restingRepo } from "./resting-repo.js";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey, wearPersona } from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { heldNexusLeaves, mintNexusLeaf, mintWornNexusLeaf, nexusLeafFor } from "../src/nexus-leaf.js";
import { runHostRoll, runHostInvite, runHostState, landEveryHostingAct, HostRefusal } from "../src/commands/host.js";
import { ownedStore } from "../src/owned-store.js";
import { runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { readHostingState, rollHosting, liveEpochs, hostingDir } from "../src/hosting-store.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import type { CarriedNexusReading } from "../src/nexus-carriage.js";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";

let root: string;
let priorLarRoot: string | undefined;
// The seal home the vessel's own resolver names: the custody door's host acts read the charter there.
const sealHome = (): string => larSealHome();

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lares-host-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  // Every Repo this suite opened rests (its adapter closed) before the directory leaves: no save of theirs can land after.
  await restEvery();
  rmSync(root, { recursive: true, force: true });
});

/** Seat a charter whose founding kahu are this vessel's held seat keys — so the vessel carries it. */
async function seatOwnCharter(): Promise<{ aid: string; doc: NexusDoc }> {
  await generateOrLoadVesselIdentity();
  await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
  const keys = (await seatChairs([0, 1, 2])).keys;
  const doc: NexusDoc = heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
  writeNexusDoc(sealHome(), doc);
  return { aid: doc.sealEpochCid!, doc };
}
/** Seat the charter and WEAR h0 — the face that hosts. */
async function seatAndWear(): Promise<{ aid: string; doc: NexusDoc }> {
  const seated = await seatOwnCharter();
  await wearPersona(0);
  return seated;
}

/** The hosting acts a doc carries, read by a fresh opener of the vessel's store. */
async function docActs(url: Parameters<typeof materializeSharedLarDoc>[1]): Promise<ReturnType<typeof hostingActsFromBoard>> {
  const repo = restingRepo(larDataDir());
  try { return hostingActsFromBoard((await materializeSharedLarDoc(repo, url, "hosting")).doc()); }
  finally { await repo.rest(); }
}

describe("lares host — roll, invite, state", () => {
  it("CONTROL: a single host rolls cleanly — the act lands on this hearth's hosting doc, never the carriage board; a second roll chains from the first", async () => {
    const { aid } = await seatAndWear();
    const doc = hostingDocUrl(aid, await loadVesselVerifyingKey());
    const first = await direct(runHostRoll)({ sealHome: sealHome() });
    expect(first).toMatchObject({ nexusAid: aid, previous: null, docUrl: doc });
    const leaf = (await heldNexusLeaves(aid))[0]!;
    expect(first.act.hearthLeaf).toBe(leaf.verifyingKey);
    expect((await docActs(doc)).map(hostingActCid)).toEqual([first.epoch]);
    expect(await docActs(carriageDocUrl(aid))).toEqual([]);
    const second = await direct(runHostRoll)({ sealHome: sealHome(), cap: 2 });
    expect(second.act.prev).toBe(first.epoch);
    expect(second.cap).toBe(2);
    expect((await docActs(doc)).map(hostingActCid).sort()).toEqual([first.epoch, second.epoch].sort());
  });

  it("RED: the act served inside a running vessel lands on its live replica at once and tells the refold; CONTROL: a command's own act lands it on disk", async () => {
    const { aid } = await seatAndWear();
    const doc = hostingDocUrl(aid, await loadVesselVerifyingKey());
    // The running vessel holds its store and already carries its hosting doc in its replica.
    const live = restingRepo(larDataDir());
    const told: string[] = [];
    const beside = (hosting: SealedActContext["hosting"]): SealedActContext => ({ kelHead: null, personaSelves: null, walk: null, hosting, backup: null });
    try {
      const held = await materializeSharedLarDoc(live, doc, "hosting");
      const rolled = await runSealedAct("host.roll", {}, beside({ withRepo: (act) => act(live), rolled: async (nexusAid) => { told.push(nexusAid); } }));
      expect(hostingActsFromBoard(held.doc()).map(hostingActCid)).toEqual([rolled["epoch"]]);
      expect(told).toEqual([aid]);
      // The state and the invite answer off the sealed rows through the same door.
      expect(await runSealedAct("host.state", {}, beside(null))).toEqual({ nexuses: [expect.objectContaining({ nexusAid: aid, epoch: rolled["epoch"], redeemed: 0 })] });
      const minted = await runSealedAct("host.invite", { relay: "ws://hearth:8080/ws" }, beside(null));
      expect(decodeInvite(String(minted["invite"]))).toMatchObject({ nexusAid: aid, relay: "ws://hearth:8080/ws" });
    } finally { await live.rest(); }
    // No store lent: the roll refuses before any row moves. A hosting door's own refusal crosses with its words.
    const reason = async (act: Promise<unknown>): Promise<string> => act.then(() => "ran", (e: { reason?: string; message?: string }) => `${e.reason}: ${e.message}`);
    expect(await reason(runSealedAct("host.roll", {}, beside(null)))).toMatch(/^act-refused: no store stands here/);
    expect(await reason(runSealedAct("host.roll", { nexusAid: "nexus-" + "b".repeat(64) }, beside({ withRepo: (act) => ownedStore(larDataDir(), act), rolled: async () => {} })))).toMatch(/^act-refused: .*does not carry/);
    expect(await reason(runSealedAct("host.roll", { storageDir: "/elsewhere" }, beside(null)))).toMatch(/^bad-args/);   // no frame names a directory
    // CONTROL: no vessel stands — the command's own act holds the store for the roll, and the next opener reads both acts.
    const ran = await runSealedAct("host.roll", {}, beside({ withRepo: (act) => ownedStore(larDataDir(), act), rolled: async () => {} }));
    expect((await docActs(doc)).map(hostingActCid)).toContain(ran["epoch"]);
    expect(ran["previous"]).toBe((await docActs(doc)).map(hostingActCid).find((cid) => cid !== ran["epoch"]));
  });

  it("RED: a roll that sealed its state and stopped before its act reached the doc lands that act at the next roll, and at a stand", async () => {
    const { aid } = await seatAndWear();
    const doc = hostingDocUrl(aid, await loadVesselVerifyingKey());
    const leaf = (await mintWornNexusLeaf(aid))!;
    // The state row commits; the process stops before the hosting doc carries the act. Twice over: the state
    // then holds a previous act and a current one, and the doc carries neither.
    const first = await rollHosting({ nexusAid: aid, leafSeed: leaf.seed });
    const stranded = await rollHosting({ nexusAid: aid, leafSeed: leaf.seed });
    expect(await docActs(doc)).toEqual([]);
    // A sovereign composition lands what the sealed state holds as it stands; a second pass lands nothing.
    expect(await direct(landEveryHostingAct)({})).toBe(2);
    expect((await docActs(doc)).map(hostingActCid).sort()).toEqual([first.act, stranded.act].map(hostingActCid).sort());
    expect(await direct(landEveryHostingAct)({})).toBe(0);
    // Stranded again, one epoch on: the next roll lands the stranded act first and chains from it.
    const strandedAgain = await rollHosting({ nexusAid: aid, leafSeed: leaf.seed });
    expect((await docActs(doc)).map(hostingActCid)).not.toContain(hostingActCid(strandedAgain.act));
    const next = await direct(runHostRoll)({});
    expect(next.previous).toBe(hostingActCid(strandedAgain.act));
    expect((await docActs(doc)).map(hostingActCid).sort()).toEqual([first.act, stranded.act, strandedAgain.act, next.act].map(hostingActCid).sort());
    // Two rolls on one store that read ONE state: the roll that seals second met a state the first moved, and
    // refuses as the door's own refusal. The handshake holds the overlap (neither seals until both have read); on a
    // slow machine two rolls merely started together may run one after the other, and the second then lawfully
    // stands as the next roll.
    const gate = holdSealsUntilBothArrive(seatedCustody()!, /state\.json$/);
    let together: PromiseSettledResult<Awaited<ReturnType<typeof runHostRoll>>>[];
    try { together = await ownedStore(larDataDir(), (repo) => Promise.allSettled([runHostRoll({ sealHome: sealHome(), repo }), runHostRoll({ sealHome: sealHome(), repo })])); }
    finally { gate.release(); }
    expect(together.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
    const overtaken = together.find((o): o is PromiseRejectedResult => o.status === "rejected")!;
    expect(overtaken.reason).toBeInstanceOf(HostRefusal);
    expect(String(overtaken.reason.message)).toMatch(/moved under this roll/);
  });

  it("an invite the hearth mints redeems through its own sorter, and the state counts it", async () => {
    const { aid, doc } = await seatAndWear();
    await direct(runHostRoll)({ sealHome: sealHome() });
    const { invite, epoch } = await runHostInvite({ sealHome: sealHome(), relay: "ws://hearth:8080/ws" });
    const carried = decodeInvite(invite)!;
    expect(carried).toMatchObject({ nexusAid: aid, gatePubKey: await loadVesselVerifyingKey(), relay: "ws://hearth:8080/ws" });
    expect(carried.token.purpose).toBe("host-invite");
    const leaf = (await heldNexusLeaves(aid))[0]!;
    const live = liveEpochs((await readHostingState(aid))!, leaf.seed)!;
    expect(live.current.cid).toBe(epoch);
    expect(tokenVerifiesAt(live.current, carried.token)).toBe(true);

    // A newcomer redeems it at this hearth's gate, through the vessel's own sorter.
    const guestSeed = new Uint8Array(32).fill(7);
    const guestLeaf = hex(await ed.getPublicKeyAsync(guestSeed));
    const vesselKey = hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(8)));
    const arm: Presented = { kind: "token", nexusAid: aid, token: carried.token, claim: redeemClaim(guestSeed, carried.token.n), leaf: guestLeaf };
    const leafProof = await socketProof(socketUnderTest(vesselKey, { nonce: "ab".repeat(32), gatePubKey: "ee".repeat(32) }), arm, async (b) => hex(await ed.signAsync(b, guestSeed)));
    const roster = { keys: doc.kahu.map((k) => k.verifyingKey!), threshold: 2, sealEpochCid: aid };
    const reading: CarriedNexusReading = { nexus: aid, aid, revision: "fixture", via: "seat", island: aid, roster, sealLineage: [], denyBoard: [], antigen: [], antigenRoster: roster, antigenVerifier: makeMultiSigQuorumVerifier(), posture: "private" };
    const sort = makeSocketSorter({
      readings: async () => [reading], carrier: () => false, primaryPosture: () => "private",
      hosting: { leafSeedFor: async (a) => (await heldNexusLeaves(a))[0]?.seed ?? null },
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

  it("RED: the WORN face hosts, never the roster's first: h1 worn, the act signs as h1's leaf", async () => {
    const { aid } = await seatOwnCharter();
    await wearPersona(1);
    const rolled = await direct(runHostRoll)({ sealHome: sealHome() });
    expect(rolled.act.hearthLeaf).toBe((await nexusLeafFor(1, aid))!.verifyingKey);
    expect(rolled.act.hearthLeaf).not.toBe((await mintNexusLeaf(0, aid)).verifyingKey);
  });

  it("RED: a vessel wearing no face hosts no one — the roll refuses and writes nothing", async () => {
    const { aid } = await seatOwnCharter();
    await expect(direct(runHostRoll)({ sealHome: sealHome() })).rejects.toThrow(/wears no face/);
    expect(existsSync((await hostingDir(aid)))).toBe(false);
  });

  it("★ a FORGED act naming this face blocks nothing: only an act the face's own leaf signed counts as hosting elsewhere ★", async () => {
    const { aid } = await seatAndWear();
    const url = hostingDocUrl(aid, await loadVesselVerifyingKey());
    const leaf = (await mintWornNexusLeaf(aid))!.verifyingKey;
    // A board writer plants a well-shaped act under this face's leaf, with a signature nobody made.
    const forged = { kind: HOSTING_ACT_DOMAIN, nexusAid: aid, hearthLeaf: leaf, prev: null, oprfPub: "e2f2ae0a6abc4e71a884a961c500515f58e30b6aa582dd8db6a65945e08d2d76", cap: 3, sig: "00".repeat(64) };
    const repo = restingRepo(larDataDir());
    try {
      const handle = await materializeSharedLarDoc(repo, url, "hosting");
      handle.change((d) => writeHostingAct(d, forged as never));
      await repo.flush();
      expect(hostingActsFromBoard(handle.doc(), leaf).length, "KNOWN POSITIVE: the planted act reads by shape").toBe(1);
    } finally { await repo.rest(); }
    const rolled = await direct(runHostRoll)({ sealHome: sealHome() });
    expect(rolled.act.hearthLeaf).toBe(leaf);
  });

  it("an act this leaf signed for ANOTHER Nexus, copied onto this doc, blocks nothing", async () => {
    const { aid } = await seatAndWear();
    const url = hostingDocUrl(aid, await loadVesselVerifyingKey());
    const held = (await mintWornNexusLeaf(aid))!;
    // A genuine act, signed by this very leaf, naming another Nexus: the signature verifies and the Nexus does not match.
    const elsewhere = await mintHostingAct({ leafSeed: held.seed, nexusAid: `nexus-${"e7".repeat(32)}`, prev: null, cap: 3 });
    const repo = restingRepo(larDataDir());
    try {
      const handle = await materializeSharedLarDoc(repo, url, "hosting");
      handle.change((d) => writeHostingAct(d, elsewhere.act));
      await repo.flush();
      expect(hostingActsFromBoard(handle.doc(), held.verifyingKey).length, "KNOWN POSITIVE: the copied act reads by shape and by leaf").toBe(1);
    } finally { await repo.rest(); }
    const rolled = await direct(runHostRoll)({ sealHome: sealHome() });
    expect(rolled.act.nexusAid).toBe(aid);
  });

  it("RED: an act this face signed on the hosting doc that no local state holds refuses the first roll, writing nothing", async () => {
    const { aid } = await seatAndWear();
    const doc = hostingDocUrl(aid, await loadVesselVerifyingKey());
    const first = await direct(runHostRoll)({ sealHome: sealHome() });
    // The local hosting state is gone — as on a second store hosting under the same face — while the doc keeps the act.
    rmSync((await hostingDir(aid)), { recursive: true, force: true });
    await expect(direct(runHostRoll)({ sealHome: sealHome() })).rejects.toThrow(/already hosts in this Nexus from another store/);
    expect(existsSync((await hostingDir(aid)))).toBe(false);
    expect((await docActs(doc)).map(hostingActCid)).toEqual([first.epoch]);
  });

  it("REFUSALS write nothing: no charter, an uncarried Nexus, an invite before any roll", async () => {
    await generateOrLoadVesselIdentity();
    await expect(direct(runHostRoll)({ sealHome: sealHome() })).rejects.toBeInstanceOf(HostRefusal);
    const { aid } = await seatAndWear();
    await expect(direct(runHostRoll)({ sealHome: sealHome(), nexusAid: "nexus-" + "b".repeat(64) })).rejects.toThrow(/does not carry/);
    await expect(runHostInvite({ sealHome: sealHome() })).rejects.toThrow(/hosts no one here yet/);
    expect(existsSync((await hostingDir(aid)))).toBe(false);
  });
});
