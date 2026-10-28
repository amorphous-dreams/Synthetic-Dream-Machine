/**
 * edge-reach at the doors — the quorum hand, the member edge, and a shadow carried across a seal roll.
 *
 * Driven through the doors a person runs: `runEdgeKapae` (`lares edge kapae`), `runCabalVouch`, `runCabalJoin`,
 * and the rotate's own anchor door. Every vector carries a control beside it.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae (#/edge-hands · #/rolls · #/reach)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, DAEMON_BAG_ID, seedDaemonDoc,
  foundingRoster, memberEdgeId, materializeSharedLarDoc, realmEdgeBoardDocUrl, edgeRollAnchorsFromBoard,
  edgeKapaeActsFromBoard, charterHandLineage, readRealmFrontier, rollAnchorsFromBoard, carriageDocUrl,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot,
} from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { writeNexusDoc, readNexusDoc } from "../src/nexus-doc.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalVouch } from "../src/commands/cabal-vouch.js";
import { runCabalJoin } from "../src/commands/cabal-join.js";
import { runEdgeKapae, EdgeKapaeError } from "../src/commands/edge-kapae-cmd.js";
import { runEdgeRollAnchors } from "../src/commands/edge-roll-anchor.js";
import { runCabalFace } from "../src/commands/cabal-face.js";
import { FaceNotNamed } from "../src/face-selector.js";
import { edgeLedgerDocUrl, keptFromLedger } from "@lararium/mesh";
import { direct } from "./direct-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { seatChairs } from "./seat-fixture.js";
import { seedFaceAtom } from "./atom-fixture.js";
import { actingAtomKey } from "./atom-fixture.js";
import { makeEdgeShadowRing } from "../src/edge-shadow-ring.js";

let root: string;
let priorLarRoot: string | undefined;
const REALM = "a".repeat(64);

const nymOf = (byte: number) => ed.getPublicKeyAsync(new Uint8Array(32).fill(byte)).then(hex);
const chairs = (keys: readonly string[]) => keys.map((_, i) => `Kahu ${i}`);

/** A charter seated over faces 0-2 at two of three, armed with faces 4-6, and the roll that reveals them. */
async function seatCharter() {
  await Promise.all([0, 1, 2, 4, 5, 6].map((i) => generateOrLoadPersonaGroupRoot(i)));
  await Promise.all([0, 1, 2, 4, 5, 6].map((i) => seedFaceAtom(i)));
  const old = await seatChairs([0, 1, 2]);
  const next = await seatChairs([4, 5, 6], { generation: 1 });
  const oldKeys = [...old.keys], newKeys = [...next.keys];
  const genesis = heldCharter({ keys: oldKeys, threshold: 2, successors: { keys: newKeys, threshold: 2 } });
  writeNexusDoc(larSealHome(), genesis.doc({ labels: chairs(oldKeys) }));
  const rolled = await genesis.roll(next.hands);
  const opened = rolled.roster;
  const roll = (): void => { writeNexusDoc(larSealHome(), rolled.doc({ labels: chairs(newKeys) })); };
  // Face 0 vouches, with its key at this charter's Nexus (cabal-realm#/the-steward-signer): each act names it.
  return { e0: genesis.head, opened, openedEpoch: rolled.head, roll };
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-reach-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await generateOrLoadPersonaGroupRoot(0);
  await seedFaceAtom(0);
  await ownedStore(larDataDir(), async (repo) => {
    const handle = seedDaemonDoc(repo);
    await repo.flush();
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packed = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: handle.url, kind: "oracle" } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packed }) }), "utf8");
  });
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(root, { recursive: true, force: true });
});

const edgeBoard = () => ownedStore(larDataDir(), async (repo) => {
  const doc = (await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae")).doc();
  return { doc, acts: edgeKapaeActsFromBoard(doc), anchors: edgeRollAnchorsFromBoard(doc) };
});
const ringRealm = () => ownedStore(larDataDir(), async (repo) => {
  const key = await actingAtomKey(0);
  const ring = makeEdgeShadowRing({ repo, vesselKey: () => key, sealHome: larSealHome(), fleetRoots: () => [],
    charterRealm: () => REALM, vesselKeyOfPeer: () => null, realmNymOfPeer: () => null });
  try { await ring.refold(); return { frontier: ring.realmFrontierOf(REALM), holders: ring.realmHoldersOf(REALM) }; }
  finally { ring.dispose(); }
});

describe("the quorum hand — the seats of the charter act on a realm's edges", () => {
  it("★ a member the quorum set aside meets a refusal whatever vouches, and the quorum's own lift returns the crossing ★", async () => {
    await seatCharter();
    const joiner = await nymOf(7);
    await direct(runCabalVouch)({ face: 0, joiner, realm: REALM });
    expect((await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner })).admitted).toBe(true);        // CONTROL

    const up = await direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: true, hand: "quorum" });
    expect(up.edgeId).toBe(memberEdgeId(REALM, joiner));
    expect(up.signers).toHaveLength(2);
    expect(up.epochCid).toBe(foundingRoster(readNexusDoc(larSealHome())).sealEpochCid);
    expect(up.shadowStands).toBe(true);

    const refused = await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner });
    expect(refused.admitted).toBe(false);
    expect(refused.refusal).toBe("set-aside");
    expect(refused.memberSetAside).toEqual({ edgeId: up.edgeId, verdict: "held" });
    expect(refused.setAside).toEqual([]);                    // the vouch itself stands; the member edge refuses

    // No single key holds a member's edge: a holder's hand over it meets a refusal and writes nothing.
    await expect(direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: false })).rejects.toThrow(/no single key holds/);
    expect((await edgeBoard()).acts.map((a) => a.actCid)).toEqual([up.actCid]);
    expect((await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner })).refusal).toBe("set-aside");
    // And a voucher's own withdrawal lifts nothing the quorum raised: it sets the vouch aside beside it.
    const vouchEdge = (await direct(runCabalVouch)({ face: 0, joiner, realm: REALM })).edgeId;
    const withdrawn = await direct(runEdgeKapae)({ face: 0, edgeId: vouchEdge, realm: REALM, raised: true });
    expect(withdrawn.hand).toBe("holder");
    await direct(runEdgeKapae)({ face: 0, edgeId: vouchEdge, realm: REALM, raised: false });
    expect((await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner })).refusal).toBe("set-aside");

    const down = await direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: false, hand: "quorum" });
    expect(down.parents).toEqual([up.actCid]);
    expect(down.shadowStands).toBe(false);
    expect((await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner })).admitted).toBe(true);
  });

  it("★ a voucher the quorum set aside lends no stake ★", async () => {
    await seatCharter();
    const joiner = await nymOf(8);
    const vouch = await direct(runCabalVouch)({ face: 0, joiner, realm: REALM });
    await direct(runEdgeKapae)({ face: 0, member: vouch.voucherDid, realm: REALM, raised: true, hand: "quorum" });
    const v = await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner });
    expect(v.admitted).toBe(false);
    expect(v.setAside.map((s) => [s.over, s.edgeId, s.verdict])).toEqual([["voucher", memberEdgeId(REALM, vouch.voucherDid), "held"]]);
    expect(v.memberSetAside).toBeUndefined();
  });

  it("★ a quorum act never lands short of its threshold, and the quorum hand takes a seated charter ★", async () => {
    const joiner = await nymOf(9);
    // No charter at all: nothing to sign with, nothing written.
    await expect(direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: true, hand: "quorum" })).rejects.toBeInstanceOf(EdgeKapaeError);
    // A charter that seats ONE held seat key beside two foreign keys, at two of three: this vessel holds one seat.
    await generateOrLoadPersonaGroupRoot(0);
    await seedFaceAtom(0);
    const held = (await seatChairs([0])).keys[0]!;
    const keys = [held, await nymOf(21), await nymOf(22)];
    writeNexusDoc(larSealHome(), heldCharter({ keys, threshold: 2 }).doc({ labels: chairs(keys) }));
    await expect(direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: true, hand: "quorum" })).rejects.toThrow(/holds 1 seat/);
    expect((await edgeBoard()).acts).toEqual([]);
    // The quorum hand acts on a realm's board alone.
    await expect(direct(runEdgeKapae)({ edgeId: "c".repeat(64), raised: true, hand: "quorum" })).rejects.toThrow(/name the realm/);
  });
});

describe("a seal roll carries the shadow, and a lift at the new head cites the raise it lifts", () => {
  it("★ the rotate anchors the realm's edge board; the shadow stands at the new head; the new quorum lifts it ★", async () => {
    const { e0, opened, openedEpoch, roll } = await seatCharter();
    const joiner = await nymOf(10);
    await direct(runCabalVouch)({ face: 0, joiner, realm: REALM });
    const up = await direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: true, hand: "quorum" });
    expect(up.epochCid).toBe(e0.epochCid);
    const beforeRoll = (await edgeBoard()).doc;

    const closing = foundingRoster(readNexusDoc(larSealHome()));
    const landed = await direct(runEdgeRollAnchors)({ face: 0, closing, opened, openedEpoch });
    expect(landed.map((a) => [a.realm, a.parents])).toEqual([[REALM, [up.actCid]]]);
    roll();
    const board = await edgeBoard();
    const lineage = charterHandLineage(readNexusDoc(larSealHome())!.sealLineage!)!.lineage;
    const readHead = (doc: typeof board.doc) => readRealmFrontier({ realm: REALM, board: doc, lineage,
      seenRaises: [up.actCid], pinned: null });
    expect(readHead(beforeRoll)).toMatchObject({ status: "unknown", missing: [{ why: "stale-lineage" }] });
    expect(readHead(board.doc)).toMatchObject({ status: "known", asOf: { quorum: { seq: expect.any(Number) } } });
    const folded = await ringRealm();
    expect(folded.frontier).toMatchObject({ status: "known", asOf: { quorum: { seq: expect.any(Number) } } });
    expect(board.anchors).toHaveLength(1);
    expect(board.anchors[0]!.signatures.map((s) => s.signer.toLowerCase()).every((k) => opened.keys.map((x) => x.toLowerCase()).includes(k))).toBe(true);

    // The shadow stands at the new head.
    const still = await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner });
    expect(still.refusal).toBe("set-aside");
    expect(still.memberSetAside?.verdict).toBe("held");

    // The NEW seats lift it, citing the raise the closed epoch's seats made.
    const down = await direct(runEdgeKapae)({ face: 0, member: joiner, realm: REALM, raised: false, hand: "quorum" });
    expect(down.epochCid).toBe(opened.sealEpochCid);
    expect(down.parents).toEqual([up.actCid]);
    expect(down.shadowStands).toBe(false);
    expect((await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner })).admitted).toBe(true);
  });

  it("CONTROL — a vessel that notes no realm anchors nothing; a realm it only vouched in takes an anchor that carries no act and a head under the new epoch", async () => {
    const { opened, openedEpoch, roll } = await seatCharter();
    const closing = foundingRoster(readNexusDoc(larSealHome()));
    expect(await direct(runEdgeRollAnchors)({ face: 0, closing, opened, openedEpoch })).toEqual([]);   // no realm noted: nothing to anchor
    expect((await edgeBoard()).anchors).toEqual([]);
    const joiner = await nymOf(11);
    const vouch = await direct(runCabalVouch)({ face: 0, joiner, realm: REALM });
    await direct(runEdgeKapae)({ face: 0, edgeId: vouch.edgeId, realm: REALM, raised: true });
    expect((await ringRealm()).holders?.get(vouch.voucherDid)).toMatchObject({ status: "known" });
    const landed = await direct(runEdgeRollAnchors)({ face: 0, closing, opened, openedEpoch });
    expect(landed.map((a) => [a.realm, a.parents])).toEqual([[REALM, []]]);   // a holder's act strands nothing: no parents
    roll();
    expect((await ringRealm()).frontier).toMatchObject({ status: "known" });   // the head stands under the new epoch with no further act
  });
});

describe("two faces open and none named: no door picks a face", () => {
  const REALM2 = "b".repeat(64);
  it("RED — vouch, join and cabal face refuse face-not-named; CONTROL: each acts once the face is named", async () => {
    await seatCharter();                                                    // faces 0, 1, 2, 4, 5, 6 stand open
    const joiner = await nymOf(12);
    await expect(direct(runCabalVouch)({ joiner, realm: REALM })).rejects.toBeInstanceOf(FaceNotNamed);
    await expect(direct(runCabalJoin)({ realm: REALM, applicant: joiner })).rejects.toBeInstanceOf(FaceNotNamed);
    await expect(direct(runCabalFace)({ realm: REALM, present: true })).rejects.toBeInstanceOf(FaceNotNamed);
    await direct(runCabalVouch)({ face: 0, joiner, realm: REALM });
    expect((await direct(runCabalJoin)({ face: 0, realm: REALM, applicant: joiner })).admitted).toBe(true);
    expect((await direct(runCabalFace)({ face: 0, realm: REALM, present: false })).realm).toBe(REALM);
  });

  it("RED — the roll anchor refuses face-not-named and writes nothing; named, it anchors that face's realms alone and names another face's realm unanchored", async () => {
    const { opened, openedEpoch } = await seatCharter();
    const closing = foundingRoster(readNexusDoc(larSealHome()));
    await direct(runCabalVouch)({ face: 0, joiner: await nymOf(13), realm: REALM });
    await direct(runCabalVouch)({ face: 1, joiner: await nymOf(14), realm: REALM2 });
    await expect(direct(runEdgeRollAnchors)({ closing, opened, openedEpoch })).rejects.toBeInstanceOf(FaceNotNamed);
    expect((await edgeBoard()).anchors).toEqual([]);                        // the refusal wrote no board
    const result = await direct(runEdgeRollAnchors)({ face: 0, closing, opened, openedEpoch });
    expect(result.map((r) => [r.state, r.realm])).toEqual([["landed", REALM], ["unanchored", REALM2]]);
    expect(result[1]).toMatchObject({ state: "unanchored", realm: REALM2, face: 1 });
    expect((await edgeBoard()).anchors).toHaveLength(1);                    // CONTROL: the named face's realm took its anchor
    const other = await ownedStore(larDataDir(), async (repo) => {
      const board = (await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM2), "board:edge-kapae")).doc();
      const ledger = (await materializeSharedLarDoc(repo, edgeLedgerDocUrl(await actingAtomKey(1)), "ledger:edge")).doc();
      return { anchors: edgeRollAnchorsFromBoard(board), kept: keptFromLedger(ledger, REALM2).anchors };
    });
    expect(other).toEqual({ anchors: [], kept: [] });                       // the face that did not act keeps its ledger as it stood
  });
  it("RED — the seal roll's store row resolves its face before any write: two faces open and none named refuse, and no carriage anchor or edge anchor lands; named, both land", async () => {
    const { opened, openedEpoch } = await seatCharter();
    const closing = foundingRoster(readNexusDoc(larSealHome()));
    await direct(runCabalVouch)({ face: 0, joiner: await nymOf(13), realm: REALM });
    await direct(runCabalVouch)({ face: 1, joiner: await nymOf(14), realm: REALM2 });
    const carriageAnchors = () => ownedStore(larDataDir(), async (repo) => {
      const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey().catch(() => ""), sealHome: larSealHome() });
      return rollAnchorsFromBoard((await materializeSharedLarDoc(repo, carriageDocUrl(island), "board:carriage-contracts")).doc()).length;
    });
    const row = (args: Record<string, unknown>) => storeDoorDirect("nexus-roll-anchor", { closing, opened, epoch: openedEpoch, ...args }, { sealHome: larSealHome() });
    const refused = await row({});
    expect(refused).toMatchObject({ refusal: "nexus-roll-anchor-refused" });
    expect(String(refused["refused"])).toMatch(/name the face/);
    expect(await carriageAnchors()).toBe(0);                                // the carriage anchor never landed
    expect((await edgeBoard()).anchors).toEqual([]);
    // CONTROL: named, the carriage anchor and the named face's realm anchor land.
    const landed = await row({ face: 0 });
    expect(landed["refused"]).toBeUndefined();
    expect(await carriageAnchors()).toBe(1);
    expect((await edgeBoard()).anchors).toHaveLength(1);
  });
});
