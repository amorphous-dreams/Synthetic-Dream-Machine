/**
 * realm-nexus — A REALM STANDS UNDER ONE NEXUS, and the three Kahu-plane hands act as the WORN face's key there.
 *
 * kapae#/edge-hands (house reading): a vessel's first act in a realm names the Nexus the realm stands under, its
 * own ledger keeps that word, and every reader takes the realm's quorum roster off THAT Nexus's charter, never
 * off the vessel's own primary one. cabal-realm#/the-steward-signer: the vouch door, an edge's holder hand on a
 * realm's board and the feed's writer each sign with the key the worn face presents at that Nexus.
 *
 * N1 RED: a quorum act signed by the PRIMARY charter's seats sets a member aside on a realm the ledger stands
 *    under ANOTHER Nexus; the crossing must not count it / CONTROL: on a realm under the primary it counts.
 * N2 RED: the quorum hand on a realm under another Nexus, whose seats this vessel does not hold, refuses and
 *    writes nothing / CONTROL: on a realm under the primary it lands.
 * N3 RED: a vouch signs with the worn face's key at the realm's Nexus, never the persona root, and notes the realm
 *    under that Nexus / CONTROL: wearing another face vouches under that face's own key.
 * N4 RED: the first act's Nexus stands: a vouch that names another Nexus refuses and lands nothing / the same
 *    Nexus named again lands.
 * N5 RED: a realm holder act signs with the worn face's key, and `--as` on a realm refuses / a fleet act still
 *    signs with the fleet root.
 * N6 RED: a vessel that wears no face vouches nothing / wearing one, it vouches.
 * N7 RED: the face door presents the worn face's key and notes the realm; a read mints nothing / after the
 *    present, the read answers the same key.
 * N8 RED: a roll anchors only the realms standing under the Nexus that rolls / a realm under it takes the anchor.
 * N9 two pins that conflict (two replicas that met) read no quorum hand, and every act there refuses by name.
 * N10 a partial's `--nexus` names the Nexus at the first act: under a Nexus whose seats this vessel lacks it
 *     signs nothing / under the primary it signs.
 * N11 an act refused before its write pins nothing / the act that lands pins its Nexus.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DAEMON_BAG_ID, edgeKapaeActsFromBoard, edgeLedgerDocUrl, ledgerRealmNexus, materializeSharedLarDoc, memberEdgeId,
  nexusAidOf, realmEdgeBoardDocUrl, seedDaemonDoc, signEdgeKapae, writeEdgeKapae, type NexusDoc,
} from "@lararium/mesh";
import { restEvery, restingRepo } from "./resting-repo.js";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey, loadVesselVerifyingKey, wearPersona,
} from "../src/node-vessel-identity.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { carriedCharterHome } from "../src/carried-set.js";
import { nexusLeafFor } from "../src/nexus-leaf.js";
import { noteVesselRealm } from "../src/edge-board.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalVouch, CabalVouchError } from "../src/commands/cabal-vouch.js";
import { runCabalJoin } from "../src/commands/cabal-join.js";
import { runEdgeKapae, EdgeKapaeError } from "../src/commands/edge-kapae-cmd.js";
import { runEdgeRollAnchors } from "../src/commands/edge-roll-anchor.js";
import { runEdgePartial, EdgeCosignError } from "../src/commands/edge-cosign.js";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { chairKey, seatChairs } from "./seat-fixture.js";
import { atomKeyOf, atomSeedOf, seedFaceAtom, wornAtomKey } from "./atom-fixture.js";
import { seedFleet } from "./fleet-seed-fixture.js";

let root: string;
let priorLarRoot: string | undefined;
const REALM = "b1".repeat(32), OTHER_REALM = "b2".repeat(32), MEMBER = "c3".repeat(32), JOINER = "d4".repeat(32);

/** The primary charter: one seat this vessel holds, threshold one. */
let primary: { aid: string; doc: NexusDoc; seat: { signer: string; sign: (b: Uint8Array) => Promise<string> } };
/** A carried charter of ANOTHER Nexus: one seat this vessel does not hold. */
let carried: { aid: string; doc: NexusDoc };

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-realm-nexus-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  await seedFaceAtom(0);
  await seedFleet(0);
  await generateOrLoadPersonaGroupRoot(1);
  await seedFaceAtom(1);
  const seated = await seatChairs([0]);
  const doc = heldCharter({ keys: [...seated.keys], threshold: 1 }).doc();
  writeNexusDoc(larSealHome(), doc);
  primary = { aid: nexusAidOf(doc)!, doc, seat: seated.hands[0]! };
  const otherDoc = heldCharter({ keys: [await chairKey(7, 0, "elsewhere")], threshold: 1 }).doc();
  const otherAid = nexusAidOf(otherDoc)!;
  writeNexusDoc(carriedCharterHome(larSealHome(), otherAid), otherDoc);
  carried = { aid: otherAid, doc: otherDoc };
  // The daemon doc the lease fence reads.
  await ownedStore(larDataDir(), async (repo) => {
    const daemon = await seedDaemonDoc(repo);
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: daemon.url, kind: "oracle" } } }) }), "utf8");
  });
});
afterEach(async () => {
  await restEvery();
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(root, { recursive: true, force: true });
});

const vesselKey = async (): Promise<string> => (await wornAtomKey());
const noteUnder = (realm: string, aid: string) => ownedStore(larDataDir(), async (repo) => noteVesselRealm(repo, await vesselKey(), realm, aid));
const notedNexus = (realm: string) => ownedStore(larDataDir(), async (repo) => {
  const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(await vesselKey()), "ledger:edge");
  return ledgerRealmNexus(ledger.doc(), realm);
});
const boardActs = async (realm: string) => {
  const repo = restingRepo(larDataDir());
  try { return edgeKapaeActsFromBoard((await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(realm), "board:edge-kapae")).doc()); }
  finally { await repo.rest(); }
};

/** The primary charter's own seat sets a member aside on `realm`'s edge board, written by hand outside every door. */
async function primaryQuorumSetsAside(realm: string): Promise<void> {
  const act = await signEdgeKapae({ edgeId: memberEdgeId(realm, MEMBER), raised: true, hand: "quorum", parents: [], epochCid: primary.doc.sealEpochCid! }, [primary.seat]);
  await ownedStore(larDataDir(), async (repo) => {
    const handle = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(realm), "board:edge-kapae");
    handle.change((d) => writeEdgeKapae(d, act));
    await repo.flush();
  });
}

describe("a realm stands under one Nexus", () => {
  it("N1 RED: the primary's quorum counts on no realm standing under another Nexus / CONTROL: it counts under the primary", async () => {
    await noteUnder(REALM, carried.aid);
    await primaryQuorumSetsAside(REALM);
    const under = await direct(runCabalJoin)({ realm: REALM, applicant: MEMBER });
    expect(under.memberSetAside).toBeUndefined();
    // CONTROL: the same act on a realm standing under the primary sets the member aside.
    await noteUnder(OTHER_REALM, primary.aid);
    await primaryQuorumSetsAside(OTHER_REALM);
    const control = await direct(runCabalJoin)({ realm: OTHER_REALM, applicant: MEMBER });
    expect(control.memberSetAside?.edgeId).toBe(memberEdgeId(OTHER_REALM, MEMBER));
  });

  it("N1b RED: a realm noted under NO Nexus reads no quorum hand", async () => {
    await primaryQuorumSetsAside(REALM);
    const read = await direct(runCabalJoin)({ realm: REALM, applicant: MEMBER });
    expect(read.memberSetAside).toBeUndefined();
  });

  it("N2 RED: the quorum hand on a realm under another Nexus refuses and writes nothing / CONTROL: under the primary it lands", async () => {
    await noteUnder(REALM, carried.aid);
    await expect(direct(runEdgeKapae)({ member: MEMBER, realm: REALM, hand: "quorum", raised: true })).rejects.toThrow(EdgeKapaeError);
    expect(await boardActs(REALM)).toEqual([]);
    const landed = await direct(runEdgeKapae)({ member: MEMBER, realm: OTHER_REALM, hand: "quorum", raised: true });
    expect(landed.signers).toEqual([primary.seat.signer]);
    expect(landed.shadowStands).toBe(true);
    expect(await notedNexus(OTHER_REALM)).toBe(primary.aid);
  });

  it("N3 RED: a vouch signs with the worn face's key at the realm's Nexus and notes the realm there / CONTROL: another worn face vouches under its own key", async () => {
    await wearPersona(0);
    const vouch = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    const leaf = await nexusLeafFor(0, primary.aid);
    expect(leaf).not.toBeNull();
    expect(vouch.voucherDid).toBe(leaf!.verifyingKey.toLowerCase());
    expect(vouch.voucherDid).not.toBe((await loadPersonaGroupRootVerifyingKey(0))!.toLowerCase());
    expect(vouch.nexusAid).toBe(primary.aid);
    expect(await notedNexus(REALM)).toBe(primary.aid);
    await wearPersona(1);
    const second = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    expect(second.voucherDid).toBe((await nexusLeafFor(1, primary.aid))!.verifyingKey.toLowerCase());
    expect(second.voucherDid).not.toBe(vouch.voucherDid);
  });

  it("N4 RED: the first act's Nexus stands — a vouch naming another Nexus refuses / naming the same one lands", async () => {
    await wearPersona(0);
    await noteUnder(REALM, primary.aid);
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0, nexusAid: carried.aid })).rejects.toThrow(/realm-under-another-nexus/);
    expect(await notedNexus(REALM)).toBe(primary.aid);
    const again = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0, nexusAid: primary.aid });
    expect(again.nexusAid).toBe(primary.aid);
  });

  it("N5 RED: a realm holder act signs with the worn face's key, and --as on a realm refuses / a fleet act signs with the root", async () => {
    await wearPersona(0);
    const vouch = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    await expect(direct(runEdgeKapae)({ edgeId: vouch.edgeId, realm: REALM, raised: true, handleIndex: 0 })).rejects.toThrow(EdgeKapaeError);
    const held = await direct(runEdgeKapae)({ edgeId: vouch.edgeId, realm: REALM, raised: true });
    expect(held.signers).toEqual([vouch.voucherDid]);
    expect(held.shadowStands).toBe(true);
    // Another worn face holds no vouch there: its hand refuses.
    await wearPersona(1);
    await expect(direct(runEdgeKapae)({ edgeId: vouch.edgeId, realm: REALM, raised: false })).rejects.toThrow(EdgeKapaeError);
    // CONTROL: the dyad's hand stays the fleet root's.
    const fleet = await direct(runEdgeKapae)({ device: "e5".repeat(32), raised: true, handleIndex: 0 });
    expect(fleet.signers).toEqual([(await loadPersonaGroupRootVerifyingKey(0))!.toLowerCase()]);
  });

  it("N6 RED: a vessel that wears no face vouches nothing / wearing one, it vouches", async () => {
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 })).rejects.toThrow(CabalVouchError);
    await wearPersona(0);
    const vouch = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    expect(vouch.voucherDid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("N7 RED: the face door presents the worn face's key and notes the realm; a read mints nothing", async () => {
    const { runCabalFace, CabalFaceError } = await import("../src/commands/cabal-face.js");
    await wearPersona(0);
    await expect(direct(runCabalFace)({ realm: REALM, present: false })).rejects.toThrow(CabalFaceError);
    expect(await nexusLeafFor(0, primary.aid)).toBeNull();
    expect(await notedNexus(REALM)).toBeNull();
    const presented = await direct(runCabalFace)({ realm: REALM, present: true });
    expect(presented).toEqual({ realm: REALM, nexusAid: primary.aid, face: (await nexusLeafFor(0, primary.aid))!.verifyingKey.toLowerCase() });
    expect(await notedNexus(REALM)).toBe(primary.aid);
    expect(await direct(runCabalFace)({ realm: REALM, present: false })).toEqual(presented);
  });

  it("N8 RED: a roll anchors only the realms standing under the Nexus that rolls / a realm under it takes the anchor", async () => {
    // Two realms, each with a counted quorum act kept in the ledger: one under the primary, one under the carried.
    await noteUnder(OTHER_REALM, primary.aid);
    await direct(runEdgeKapae)({ member: MEMBER, realm: OTHER_REALM, hand: "quorum", raised: true });
    await noteUnder(REALM, carried.aid);
    await primaryQuorumSetsAside(REALM);
    // Keep the hand-written act in the ledger as a count under the primary would (the pre-reading's shape).
    await ownedStore(larDataDir(), async (repo) => {
      const { keepInLedger, edgeKapaeActsFromBoard: acts } = await import("@lararium/mesh");
      const board = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
      const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(await vesselKey()), "ledger:edge");
      ledger.change((d) => { keepInLedger(d, REALM, { acts: acts(board.doc()), anchors: [] }); });
      await repo.flush();
    });
    const { foundingRoster } = await import("@lararium/mesh");
    const closing = foundingRoster(primary.doc);
    const anchored = await direct(runEdgeRollAnchors)({ closing, opened: closing });
    expect(anchored.map((a) => a.realm)).toEqual([OTHER_REALM]);
  });

  it("N9 two conflicting pins read no quorum hand, and every act there refuses by name", async () => {
    await wearPersona(0);
    await primaryQuorumSetsAside(REALM);
    // Two replicas of the ledger that each pinned a different Nexus, merged: both pins rest side by side.
    await ownedStore(larDataDir(), async (repo) => {
      const { noteRealm, EDGE_LEDGER_PREFIX, storedLarRecord } = await import("@lararium/mesh");
      const ledger = await materializeSharedLarDoc(repo, edgeLedgerDocUrl(await vesselKey()), "ledger:edge");
      ledger.change((d) => {
        noteRealm(d, REALM, primary.aid);
        const second = `${EDGE_LEDGER_PREFIX}${REALM}/nexus/${carried.aid}`;
        d.tiddlers[second] = storedLarRecord(second, { text: carried.aid }, "edge-ledger");
      });
      await repo.flush();
    });
    expect(await notedNexus(REALM)).toBeNull();
    expect((await direct(runCabalJoin)({ realm: REALM, applicant: MEMBER })).memberSetAside).toBeUndefined();
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 })).rejects.toThrow(/realm-nexus-conflict/);
    await expect(direct(runEdgeKapae)({ member: MEMBER, realm: REALM, hand: "quorum", raised: true })).rejects.toThrow(/realm-nexus-conflict/);
  });

  it("N10 a partial's --nexus names the Nexus at the first act / under the primary it signs", async () => {
    // Two seats at threshold two, one held here: a partial, not a whole quorum.
    const doc = heldCharter({ keys: [primary.seat.signer, await chairKey(8, 0, "elsewhere")], threshold: 2 }).doc();
    writeNexusDoc(larSealHome(), doc);
    const aid = nexusAidOf(doc)!;
    await expect(direct(runEdgePartial)({ realm: REALM, member: MEMBER, raised: true, nexusAid: carried.aid })).rejects.toThrow(EdgeCosignError);
    expect(await notedNexus(REALM)).toBeNull();
    const signed = await direct(runEdgePartial)({ realm: REALM, member: MEMBER, raised: true, nexusAid: aid });
    expect(signed.signed).toEqual([primary.seat.signer]);
    expect(await notedNexus(REALM)).toBe(aid);
  });

  it("N11 an act refused before its write pins nothing / the act that lands pins its Nexus", async () => {
    await expect(direct(runEdgeKapae)({ member: MEMBER, realm: REALM, hand: "quorum", raised: true, nexusAid: primary.aid, parents: ["e".repeat(64)] }))
      .rejects.toThrow(EdgeKapaeError);
    expect(await notedNexus(REALM)).toBeNull();
    const landed = await direct(runEdgeKapae)({ member: MEMBER, realm: REALM, hand: "quorum", raised: true, nexusAid: primary.aid });
    expect(landed.shadowStands).toBe(true);
    expect(await notedNexus(REALM)).toBe(primary.aid);
  });
});
