import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  DAEMON_BAG_ID, realmEdgeBoardDocUrl, materializeSharedLarDoc,
  edgeKapaeActsFromBoard, foldEdgeReadings, countEdgeActs, hex,
  charterHandLineage, readRealmFrontier, realmRaiseCids,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { ownedStore } from "../src/owned-store.js";
import { noteVesselRealm, vesselEdgeCharter } from "../src/edge-board.js";
import { carriedCharterHome, primaryNexusAid } from "../src/carried-set.js";
import { runEdgePartial, runEdgeCosign, EdgeCosignError } from "../src/commands/edge-cosign.js";
import { chairKey, chairSeed, seatChairs } from "./seat-fixture.js";
import { ed25519SignerFromSeed, nexusAidOf } from "@lararium/mesh";
import { foundRealmFrontier } from "./realm-frontier-fixture.js";
import { seedFaceAtom, actingAtomKey } from "./atom-fixture.js";
import { makeEdgeShadowRing } from "../src/edge-shadow-ring.js";

let genesis: ReturnType<typeof heldCharter> | null = null;

let roots: string[];
let chairA: string;
let chairB: string;
let priorLarRoot: string | undefined;
const REALM = "af".repeat(32), MEMBER = "bc".repeat(32);

async function stand(index: number, seatIndex: number, keys: string[]) {
  process.env["LAR_ROOT"] = roots[index]!;
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await seedFaceAtom(0);
  await generateOrLoadPersonaGroupRoot(seatIndex); await seedFaceAtom(seatIndex);
  await seatChairs([seatIndex]);
  await generateOrLoadPersonaGroupRoot(8); await seedFaceAtom(8);
  await generateOrLoadPersonaGroupRoot(0);   // three faces held
  writeNexusDoc(larSealHome(), genesis!.doc());
  await ownedStore(larDataDir(), async (repo) => {
    const daemon = await import("@lararium/mesh").then((m) => m.seedDaemonDoc(repo));
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: daemon.url, kind: "oracle" } } }) }), "utf8");
  });
}

async function withRepo<T>(index: number, run: (repo: Repo) => Promise<T>): Promise<T> {
  process.env["LAR_ROOT"] = roots[index]!;
  return ownedStore(larDataDir(), run);
}

beforeEach(async () => {
  priorLarRoot = process.env["LAR_ROOT"];
  roots = [mkdtempSync(join(tmpdir(), "lares-cosign-a-")), mkdtempSync(join(tmpdir(), "lares-cosign-b-"))];
  process.env["LAR_ROOT"] = roots[0]!; await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } }); await generateOrLoadPersonaGroupRoot(0); await seedFaceAtom(0);
  chairA = (await seatChairs([0])).keys[0]!;
  process.env["LAR_ROOT"] = roots[1]!; await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } }); await generateOrLoadPersonaGroupRoot(1); await seedFaceAtom(1);
  chairB = (await seatChairs([1])).keys[0]!;
  const keys = [chairA, chairB];
  // The charter commits to the chairs' next keys, so a roll moves its head and keeps its Nexus.
  genesis = heldCharter({ keys, threshold: 2, successors: { keys: [await chairKey(0, 1), await chairKey(1, 1)], threshold: 2 } });
  await stand(0, 0, keys); await stand(1, 1, keys);
  const hands = [0, 1].map((face) => ({ signer: keys[face]!, sign: ed25519SignerFromSeed(chairSeed(face)) }));
  for (const index of [0, 1]) await withRepo(index, async (repo) => {
    const edge = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    await foundRealmFrontier(edge, REALM, genesis!, hands);
    await repo.flush();
  });
  // Each vessel founds its face's custody under a key derivation of its own, so the hook gets room beside a loaded runner.
}, 90_000);
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((resolve) => setTimeout(resolve, 200));
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A person's confirmed cosign: the confirmation names the very act the partial carries. */
const cosign = (repo: Repo, p: unknown) =>
  runEdgeCosign({ partial: p, face: 0, sealHome: larSealHome(), repo, confirmActCid: (p as { act?: { actCid?: string } } | null)?.act?.actCid ?? "none" });

async function partial(index: number, raised = true) {
  process.env["LAR_ROOT"] = roots[index]!;
  const sealHome = larSealHome();
  return withRepo(index, (repo) => runEdgePartial({ realm: REALM, member: MEMBER, raised, sealHome, repo, face: 0 }));
}

async function board(index: number) {
  return withRepo(index, async (repo) => {
    const handle = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    const acts = edgeKapaeActsFromBoard(handle.doc());
    const counted = await countEdgeActs(acts, [], () => ({ quorum: true }), vesselEdgeCharter(REALM, larSealHome(), primaryNexusAid(larSealHome())));
    await repo.flush();
    return { readings: foldEdgeReadings(counted.acts), acts };
  });
}

async function frontier(index: number) {
  return withRepo(index, async (repo) => {
    const handle = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    const counted = await countEdgeActs(edgeKapaeActsFromBoard(handle.doc()), [], () => ({ quorum: true }),
      vesselEdgeCharter(REALM, larSealHome(), primaryNexusAid(larSealHome())));
    return readRealmFrontier({ realm: REALM, board: handle.doc(), lineage: charterHandLineage(genesis!.doc().sealLineage!)!.lineage,
      seenRaises: realmRaiseCids(counted.acts), pinned: null });
  });
}

async function ringFrontier(index: number) {
  return withRepo(index, async (repo) => {
    const vesselKey = await actingAtomKey(0);
    const ring = makeEdgeShadowRing({ repo, vesselKey: () => vesselKey, sealHome: larSealHome(),
      fleetRoots: () => [], charterRealm: () => REALM,
      vesselKeyOfPeer: () => null, realmNymOfPeer: () => null });
    try { await ring.refold(); return ring.realmFrontierOf(REALM); }
    finally { ring.dispose(); }
  });
}

describe("the cross-vessel quorum cosign door", () => {
  it("carries a raise between separate seat vessels and refuses replay", async () => {
    const a = await partial(0);
    expect(a.signed).toHaveLength(1);
    expect(a.partial.frontier).toBeDefined();
    const { frontier: _frontier, ...stripped } = a.partial;
    await expect(withRepo(1, (repo) => cosign(repo, stripped))).rejects.toThrow(/frontier-missing/);
    expect((await board(1)).acts).toEqual([]);
    expect((await board(0)).readings.get(a.edgeId)).toBeUndefined();
    // An act short of its threshold lands on NO board: the partial door wrote nothing.
    expect((await board(0)).acts.map((x) => x.actCid)).not.toContain(a.actCid);
    const bResult = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(a.partial))));
    expect(bResult.landed).toBe(true); expect(bResult.shadowStands).toBe(true); expect(bResult.added).toEqual([chairB]);
    const returned = await withRepo(0, (repo) => cosign(repo, JSON.parse(JSON.stringify(bResult.partial))));
    expect(returned.landed).toBe(true); expect(returned.added).toEqual([]);
    expect((await board(0)).readings.get(a.edgeId)?.stands).toBe(true);
    await expect(frontier(0)).resolves.toMatchObject({ status: "known" });
    await expect(frontier(1)).resolves.toMatchObject({ status: "known" });
    for (const index of [0, 1]) {
      const read = await ringFrontier(index);
      expect(read?.status).toBe("known");
      if (read?.status === "known") expect(read.asOf["quorum"]?.seq).toBe(1);
    }
    await expect(withRepo(1, (repo) => cosign(repo, bResult.partial))).rejects.toMatchObject({ verdict: "replay" });
    // CONTROL: the other member edge remains absent on both independent boards.
    const control = "de".repeat(32);
    expect((await board(1)).readings.get(control)).toBeUndefined();
  });

  it("a cosigning vessel whose primary charter differs reads the partial's Nexus off its epoch (a carried charter) / CONTROL: a realm it pinned elsewhere refuses", async () => {
    // B carries the shared charter and stands under another primary one.
    process.env["LAR_ROOT"] = roots[1]!;
    const shared = genesis!.doc();
    writeNexusDoc(carriedCharterHome(larSealHome(), nexusAidOf(shared)!), shared);
    writeNexusDoc(larSealHome(), heldCharter({ keys: [chairB], threshold: 1 }).doc());
    const a = await partial(0);
    const landed = await withRepo(1, (repo) => cosign(repo, a.partial));
    expect(landed.landed).toBe(true); expect(landed.added).toEqual([chairB]);
    // CONTROL: on a realm B pinned under its own primary Nexus, the same act answers to no charter there.
    const other = "ab".repeat(32);
    await withRepo(1, async (repo) => noteVesselRealm(repo, await actingAtomKey(0), other, primaryNexusAid(larSealHome())!));
    process.env["LAR_ROOT"] = roots[0]!;
    const elsewhere = await withRepo(0, (repo) => runEdgePartial({ realm: other, member: MEMBER, raised: true, face: 0, sealHome: larSealHome(), repo }));
    await expect(withRepo(1, (repo) => cosign(repo, elsewhere.partial))).rejects.toThrow(/realm-under-another-nexus/);
  });

  it("requires a seat on another vessel to finish a fresh partial", async () => {
    const a = await partial(0);
    await expect(withRepo(0, (repo) => cosign(repo, a.partial))).rejects.toThrow(EdgeCosignError);
    // CONTROL: the complementary seat can cosign it.
    await expect(withRepo(1, (repo) => cosign(repo, a.partial))).resolves.toMatchObject({ landed: true });
  });

  it("a board move after opening makes the carried frontier stale before a seat signs or lands", async () => {
    const waiting = await partial(0);
    process.env["LAR_ROOT"] = roots[0]!;
    const other = await withRepo(0, (repo) => runEdgePartial({ realm: REALM, member: "cd".repeat(32), raised: true, face: 0,
      sealHome: larSealHome(), repo }));
    await withRepo(1, (repo) => cosign(repo, other.partial));
    const before = (await board(1)).acts.map((a) => a.actCid);
    await expect(withRepo(1, (repo) => cosign(repo, waiting.partial))).rejects.toMatchObject({ verdict: "stale" });
    expect((await board(1)).acts.map((a) => a.actCid)).toEqual(before);
    expect(before).not.toContain(waiting.actCid);
    expect((await ringFrontier(1))?.status).toBe("known");
  });

  it("refuses malformed and subject-swapped partial text", async () => {
    const a = await partial(0); const changed = JSON.parse(JSON.stringify(a.partial)) as { subject: { member: string } };
    changed.subject.member = "cd".repeat(32);
    await expect(withRepo(1, (repo) => cosign(repo, { nonsense: true }))).rejects.toMatchObject({ verdict: "invalid" });
    await expect(withRepo(1, (repo) => cosign(repo, changed))).rejects.toMatchObject({ verdict: "invalid" });
    // CONTROL: intact partial is accepted by the complementary vessel.
    await expect(withRepo(1, (repo) => cosign(repo, a.partial))).resolves.toMatchObject({ landed: true });
  });

  it("lowers a raised edge across the same two vessels", async () => {
    const up = await partial(0);
    const fullUp = await withRepo(1, (repo) => cosign(repo, up.partial));
    await withRepo(0, (repo) => cosign(repo, fullUp.partial));
    const down = await partial(0, false);
    expect(down.partial.frontier).toBeUndefined(); // The current head already counts the raise; a lower adds none.
    const fullDown = await withRepo(1, (repo) => cosign(repo, down.partial));
    expect(fullDown.landed).toBe(true); expect(fullDown.shadowStands).toBe(false);
    const landedAtA = await withRepo(0, (repo) => cosign(repo, fullDown.partial));
    expect(landedAtA.landed).toBe(true);
    // CONTROL: the raised state was standing before the causal lower landed there.
    expect((await board(0)).readings.get(up.edgeId)?.stands).toBe(false);
  });

  it("refuses a whole quorum and a vessel with no seated key", async () => {
    process.env["LAR_ROOT"] = roots[0]!;
    const own = chairA;
    writeNexusDoc(larSealHome(), heldCharter({ keys: [own], threshold: 1 }).doc());
    await expect(partial(0)).rejects.toThrow(/whole quorum/);
    process.env["LAR_ROOT"] = roots[1]!;
    const outsiderKey = chairB;
    process.env["LAR_ROOT"] = roots[0]!;
    writeNexusDoc(larSealHome(), heldCharter({ keys: [outsiderKey], threshold: 1 }).doc());
    await expect(partial(0)).rejects.toThrow(/holds no seat/);
    // CONTROL: restoring the two-seat charter lets A produce a partial again.
    process.env["LAR_ROOT"] = roots[1]!;
    process.env["LAR_ROOT"] = roots[0]!;
    const keys = [chairA, chairB];
    writeNexusDoc(larSealHome(), heldCharter({ keys, threshold: 2 }).doc());
    await expect(partial(0)).resolves.toHaveProperty("signed");
  });
  it("refuses a partial cut before the edge's line moved, and one cut under a charter head this vessel rolled past", async () => {
    const land = async (p: unknown) => {
      const atB = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(p))));
      await withRepo(0, (repo) => cosign(repo, JSON.parse(JSON.stringify(atB.partial))));
      return atB;
    };
    const first = await partial(0);
    await land(first.partial);
    // A cuts a lower that cites the raise, and holds it. The line then moves: a second raise lands on both boards.
    const heldLower = await partial(0, false);
    const second = await partial(0);
    expect(second.actCid).not.toBe(first.actCid);
    await land(second.partial);
    await expect(withRepo(1, (repo) => cosign(repo, heldLower.partial)))
      .rejects.toMatchObject({ verdict: "stale" });
    // CONTROL: a lower cut from the moved frontier lands, and the shadow comes down.
    const fresh = await partial(0, false);
    expect((await land(fresh.partial)).shadowStands).toBe(false);

    // THE EPOCH ROAD. B's charter head moves to another epoch after A cut a partial under the earlier one: a
    // roll, which keeps the Nexus the realm stands under.
    const underOldHead = await partial(0);
    process.env["LAR_ROOT"] = roots[1]!;
    const next = await Promise.all([0, 1].map(async (face) => ({ signer: await chairKey(face, 1), sign: ed25519SignerFromSeed(chairSeed(face, 1)) })));
    writeNexusDoc(larSealHome(), (await genesis!.roll(next)).doc());
    await expect(withRepo(1, (repo) => cosign(repo, underOldHead.partial)))
      .rejects.toMatchObject({ verdict: "stale" });
  });
  it("a cosign that still falls short hands the grown partial on and lands nothing", async () => {
    // Three seats, all three needed; the third seat's vessel never appears.
    process.env["LAR_ROOT"] = roots[0]!;
    const keyA = chairA;
    process.env["LAR_ROOT"] = roots[1]!;
    const keyB = chairB;
    const keys = [keyA, keyB, hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(0xc3)))];
    const three = heldCharter({ keys, threshold: 3 });
    for (const index of [0, 1]) {
      process.env["LAR_ROOT"] = roots[index]!;
      writeNexusDoc(larSealHome(), three.doc());
    }
    const a = await partial(0);
    const atB = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(a.partial))));
    expect(atB.landed).toBe(false);
    expect(atB.signed).toHaveLength(2);
    expect(atB.added).toEqual([keyB]);
    expect((await board(1)).acts.map((x) => x.actCid)).not.toContain(a.actCid);
    // The grown partial carries both signatures on: the same vessel has nothing more to add.
    await expect(withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(atB.partial))))).rejects.toThrow(EdgeCosignError);
  });
  it("a read with no confirmation signs nothing and writes nothing", async () => {
    const a = await partial(0);
    const read = await withRepo(1, (repo) => runEdgeCosign({ partial: JSON.parse(JSON.stringify(a.partial)), face: 0, sealHome: larSealHome(), repo }));
    expect(read).toMatchObject({ would: "cosign", landed: false, added: [], subject: { kind: "member", member: MEMBER }, raised: true });
    expect(read.partial.act.signatures).toHaveLength(1);
    expect((await board(1)).acts).toEqual([]);
    // CONTROL: the confirmed call signs and lands, and a whole act read on the first vessel reads as landable.
    const done = await withRepo(1, (repo) => cosign(repo, JSON.parse(JSON.stringify(a.partial))));
    expect(done.landed).toBe(true);
    const whole = await withRepo(0, (repo) => runEdgeCosign({ partial: JSON.parse(JSON.stringify(done.partial)), face: 0, sealHome: larSealHome(), repo }));
    expect(whole).toMatchObject({ would: "land", landed: false });
    expect((await board(0)).acts).toEqual([]);
    // A confirmation that names another act refuses: the partial changed between the read and the signature.
    await expect(withRepo(0, (repo) => runEdgeCosign({ partial: JSON.parse(JSON.stringify(done.partial)), face: 0, sealHome: larSealHome(), repo, confirmActCid: "0".repeat(64) })))
      .rejects.toThrow(/differs from the act the confirmation names/);
    expect((await board(0)).acts).toEqual([]);
  });
});
