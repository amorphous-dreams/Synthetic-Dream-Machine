/**
 * edge-shadow-ring — the one live reading the gates consult, driven through each gate's own entry point.
 *
 * The acts land through the door a person runs (`runEdgeKapae`); the ring folds the boards; then the socket
 * sorter, the share verdict, carriage serve and the realm's gates each answer. Every vector carries a control.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae#/reach
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  hex, DAEMON_BAG_ID, seedDaemonDoc, NEXUS_DOC_DOMAIN, genesisCharterEpoch,
  RealmBoardGate, RealmBagGate, realmDocUrl, realmEdgeBoardDocUrl, realmVouchBoardDocUrl, fleetEdgeBoardDocUrl,
  deviceEdgeId, DeterministicFederationGate, crossroadsDocUrl,
  type FederationGate, type NexusMembership, type PlaneSeal, type AntigenRing,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalVouch } from "../src/commands/cabal-vouch.js";
import { runEdgeKapae } from "../src/commands/edge-kapae-cmd.js";
import { makeEdgeShadowRing, type EdgeShadowRing } from "../src/edge-shadow-ring.js";
import { makeSocketSorter } from "../src/socket-sorter.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";
import { decideAndServeWantBlock, type CasWireServerDeps } from "../src/cas-wire.js";
import type { SortInput } from "../src/daemon-auth-gate.js";
import { direct } from "./direct-store.js";

let root: string;
let priorLarRoot: string | undefined;
const REALM = "a".repeat(64);
const nymOf = (byte: number) => ed.getPublicKeyAsync(new Uint8Array(32).fill(byte)).then(hex);
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-ring-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
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

/** Stand a ring over this vessel's store for one read, and hand the caller the ring while the store stays held. */
async function withRing<T>(
  peers: Record<string, { vessel?: string; nym?: string }>, run: (ring: EdgeShadowRing) => Promise<T>,
  charterRealm: string | null = REALM,
): Promise<T> {
  const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
  const vesselKey = (await loadVesselVerifyingKey())!;
  return ownedStore(larDataDir(), async (repo) => run(makeEdgeShadowRing({
    repo, vesselKey, sealHome: larSealHome(),
    fleetRoots: () => [fleetRoot],
    charterRealm: () => charterRealm,
    vesselKeyOfPeer: (peerId) => peers[peerId]?.vessel ?? null,
    realmNymOfPeer: (peerId) => peers[peerId]?.nym ?? null,
  })));
}

describe("the ring fails closed until its first fold lands", () => {
  it("★ before any fold every device reads aside, every member reads aside, and nobody stands ★", async () => {
    const phone = await nymOf(51);
    await withRing({ p: { vessel: phone, nym: phone } }, async (ring) => {
      expect(ring.fold()).toBeNull();
      expect(ring.deviceAside(phone)).toBe(true);
      expect(ring.aside("p")).toBe(true);
      expect(ring.memberAside(REALM)("p")).toBe(true);
      expect(ring.standsInRealm("p", REALM)).toBe(false);
      await ring.refold();
      // CONTROL: once the boards read clean, the same asks answer clear.
      expect(ring.deviceAside(phone)).toBe(false);
      expect(ring.aside("p")).toBe(false);
      expect(ring.memberAside(REALM)("p")).toBe(false);
    });
  });
});

describe("a fold that fails leaves no reading", () => {
  it("★ after a failed refold every gate answers closed, where the earlier reading would have admitted ★", async () => {
    const phone = await nymOf(54);
    const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    const vesselKey = (await loadVesselVerifyingKey())!;
    let fail = false;
    await ownedStore(larDataDir(), async (repo) => {
      const ring = makeEdgeShadowRing({
        repo, vesselKey, sealHome: larSealHome(),
        fleetRoots: () => { if (fail) throw new Error("the store would not read"); return [fleetRoot]; },
        vesselKeyOfPeer: () => phone, realmNymOfPeer: () => phone,
      });
      await ring.refold();
      expect(ring.deviceAside(phone)).toBe(false);                                 // CONTROL: a clean fold admits
      fail = true;
      await expect(ring.refold()).rejects.toThrow(/would not read/);
      expect(ring.fold()).toBeNull();
      expect(ring.deviceAside(phone)).toBe(true);
      expect(ring.memberAside(REALM)("p")).toBe(true);
      fail = false;
      await ring.refold();
      expect(ring.deviceAside(phone)).toBe(false);
    });
  });
});

describe("a device the fleet root set aside — the sorter, the share verdict and carriage serve", () => {
  it("★ the device never sorts same-operator, reads no document on any lane, and draws Mu at the fetch door ★", async () => {
    const phone = await nymOf(52), laptop = await nymOf(53);
    const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    const up = await direct(runEdgeKapae)({ device: phone, raised: true });
    expect(up.board).toBe("fleet");
    expect(up.boardUrl).toBe(fleetEdgeBoardDocUrl(fleetRoot));
    expect(up.edgeId).toBe(deviceEdgeId(fleetRoot, phone));

    await withRing({ "peer-phone": { vessel: phone }, "peer-laptop": { vessel: laptop } }, async (ring) => {
      const fold = await ring.refold();
      expect(fold.fleets[0]!.selfAside).toBe(false);
      expect(ring.deviceAside(phone)).toBe(true);
      expect(ring.deviceAside(`0x${phone.toUpperCase()}`)).toBe(true);
      expect(ring.deviceAside(laptop)).toBe(false);                               // CONTROL
      expect(ring.aside("peer-unnamed")).toBe(false);                             // a peer the wire has not named
      expect(ring.fleetBoardUrls()).toEqual([fleetEdgeBoardDocUrl(fleetRoot)]);

      // THE SORTER, through its own entry point: a delegation that proves same-operator, set aside.
      const sorter = makeSocketSorter({ readings: async () => [], carrier: () => false, primaryPosture: () => "private", deviceAside: ring.deviceAside });
      const input = (vesselKey: string): SortInput => ({ identifier: `0x${vesselKey}`, vesselKey, sameOperator: true, challenge: { nonce: "ab".repeat(32), gatePubKey: "ee".repeat(32) } });
      expect(await sorter(input(phone))).toBeNull();                              // silence under PRIVATE: what a stranger meets
      expect(await sorter(input(laptop))).toEqual({ class: "same-operator" });     // CONTROL
      const open = makeSocketSorter({ readings: async () => [], carrier: () => false, primaryPosture: () => "open", deviceAside: ring.deviceAside });
      expect(await open(input(phone))).toEqual({ class: "stranger" });             // under OPEN it sorts by what else it proves: nothing

      // THE SHARE VERDICT: a socket admitted before the shadow arrived still holds its class; the verdict reads the shadow first.
      const MY_NEXUS = "11".repeat(32);
      const share = (peerId: string, documentId: DocumentId, sibling = false) => selfSlotShareDecision({
        hasWsSocket: !sibling, sibling, siblingGate: { mayFederate: () => true }, peerClass: "same-operator",
        selfSlotFedGate: new DeterministicFederationGate(MY_NEXUS), antigenRing: null, membership: null, planeSeal: null,
        peerId, documentId, shadow: ring,
      });
      const PRIVATE = idOf(realmDocUrl("a-private-plane")), SHELF = idOf(crossroadsDocUrl(MY_NEXUS));
      for (const doc of [PRIVATE, SHELF]) {
        expect(await share("peer-phone", doc)).toBe(false);
        expect(await share("peer-phone", doc, true)).toBe(false);                 // the sibling lane
        expect(await share("peer-laptop", doc)).toBe(true);                       // CONTROL
        expect(await share("peer-laptop", doc, true)).toBe(true);
      }

      // CARRIAGE SERVE: the fleet's fetch door never even asks the fleet predicate for a device set aside.
      const asked: string[] = [];
      const deps: CasWireServerDeps = {
        cadDir: join(root, "cad"), cidDir: join(root, "cid"),
        seal: { isSealedPlane: () => true } as PlaneSeal, membership: { holdsCarriagePeer: () => true } as NexusMembership,
        antigen: { kapaed: new Set(), presenterNym: () => null } as AntigenRing, fedGate: { mayFederate: () => false } as FederationGate,
        fleet: (peerId) => { asked.push(peerId); return true; }, shadow: ring,
      };
      const clear = "sha256:" + "0".repeat(64);
      expect((await decideAndServeWantBlock(deps, "peer-phone", clear)).kind).toBe("cas-mu");
      expect(asked).toEqual([]);
      await decideAndServeWantBlock(deps, "peer-laptop", clear);
      expect(asked).toEqual(["peer-laptop"]);                                      // CONTROL: the door reads on

      // THE SEALED LANE: a member set aside from the realm a block belongs to draws Mu ahead of the carry lane.
      const sealedCid = "blake3:" + "11".repeat(32);
      const consulted: string[] = [];
      const lane: CasWireServerDeps = { ...deps, shadow: { aside: () => false }, realmAside: (peerId) => { consulted.push(peerId); return peerId === "peer-away"; }, membership: { holdsCarriagePeer: (p) => { consulted.push(`member:${p}`); return true; } } };
      expect((await decideAndServeWantBlock(lane, "peer-away", sealedCid)).kind).toBe("cas-mu");
      expect(consulted).toEqual(["peer-away"]);                                    // the carry lane never ran
      await decideAndServeWantBlock(lane, "peer-home", sealedCid);
      expect(consulted).toEqual(["peer-away", "peer-home", "member:peer-home"]);   // CONTROL: a standing member reaches the lane
    });

    // The root lifts its own shadow: the device reads as fleet again at the next fold.
    const down = await direct(runEdgeKapae)({ device: phone, raised: false });
    expect(down.parents).toEqual([up.actCid]);
    await withRing({}, async (ring) => { await ring.refold(); expect(ring.deviceAside(phone)).toBe(false); });
  });

  it("★ a shadow over this vessel's own device edge reads back as selfAside ★", async () => {
    const own = (await loadVesselVerifyingKey())!;
    await direct(runEdgeKapae)({ device: own, raised: true });
    await withRing({}, async (ring) => { expect((await ring.refold()).fleets[0]!.selfAside).toBe(true); });
  });
});

describe("a realm's members — the realm gate and the lane its boards cross by", () => {
  it("★ a withdrawn vouch sets its joiner aside at the realm's gate and closes the realm's boards to it ★", async () => {
    const joiner = await nymOf(61), bystander = await nymOf(62);
    const vouch = await direct(runCabalVouch)({ joiner, realm: REALM });
    const peers = { "peer-j": { nym: joiner }, "peer-b": { nym: bystander }, "peer-root": { nym: vouch.voucherDid } };
    const realmUrl = realmDocUrl(REALM);
    const deny: FederationGate = { mayFederate: () => false };
    const everyone: NexusMembership = { holdsCarriagePeer: () => true };

    const read = (ring: EdgeShadowRing) => {
      const bags = new RealmBagGate(deny, everyone, realmUrl, { memberAside: ring.memberAside(REALM) });
      const boards = new RealmBoardGate(deny, ring.realmBoards, ring.standsInRealm);
      return {
        realmDoc: (p: string) => bags.mayFederate(idOf(realmUrl), p as PeerId),
        edgeBoard: (p: string) => boards.mayFederate(idOf(realmEdgeBoardDocUrl(REALM)), p as PeerId),
        vouchBoard: (p: string) => boards.mayFederate(idOf(realmVouchBoardDocUrl(REALM)), p as PeerId),
      };
    };

    await withRing(peers, async (ring) => {
      const fold = await ring.refold();
      expect(fold.realms[0]!.standing.has(joiner)).toBe(true);
      const at = read(ring);
      expect(await at.realmDoc("peer-j")).toBe(true);                             // CONTROL: the member reads
      expect(await at.edgeBoard("peer-j")).toBe(true);
      expect(await at.vouchBoard("peer-j")).toBe(true);
      expect(await at.edgeBoard("peer-root")).toBe(true);                         // the seed stands
      expect(await at.edgeBoard("peer-b")).toBe(false);                           // a face no vouch names holds no standing
      expect(await at.realmDoc("peer-b")).toBe(true);                             // and no shadow: the realm's other lanes decide
    });

    // A vessel under no charter still reads this realm: its own vouch there noted the realm in its ledger.
    await withRing(peers, async (ring) => {
      await ring.refold();
      expect([...ring.realmBoards().values()]).toEqual([REALM, REALM]);
      expect(ring.standsInRealm("peer-j", REALM)).toBe(true);
    }, null);
    // CONTROL: a realm this vessel never touched reads no board and opens no lane.
    await withRing(peers, async (ring) => { await ring.refold(); expect(ring.standsInRealm("peer-j", "c".repeat(64))).toBe(false); }, null);

    await direct(runEdgeKapae)({ edgeId: vouch.edgeId, realm: REALM, raised: true });   // the voucher withdraws

    await withRing(peers, async (ring) => {
      await ring.refold();
      const at = read(ring);
      expect(await at.realmDoc("peer-j")).toBe(false);
      expect(await at.edgeBoard("peer-j")).toBe(false);
      expect(await at.vouchBoard("peer-j")).toBe(false);
      expect(await at.edgeBoard("peer-root")).toBe(true);                         // CONTROL: the shadow scopes to one edge
      expect(await at.realmDoc("peer-b")).toBe(true);
      expect(ring.memberAside("b".repeat(64))("peer-j")).toBe(false);             // another realm reads nothing from this one
    });
  });

  it("★ a member the quorum set aside reads nothing of the realm, though no vouch ever named it ★", async () => {
    const roots = await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    const keys = roots.map((r) => r.verifyingKey);
    const e0 = genesisCharterEpoch(keys, 2, "");
    writeNexusDoc(larSealHome(), { kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: e0.epochCid, sealLineage: [e0], kahu: keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k })) });
    const member = await nymOf(63);
    const peers = { "peer-m": { nym: member } };
    await withRing(peers, async (ring) => { await ring.refold(); expect(ring.memberAside(REALM)("peer-m")).toBe(false); });   // CONTROL
    await direct(runEdgeKapae)({ member, realm: REALM, raised: true, hand: "quorum" });
    await withRing(peers, async (ring) => {
      await ring.refold();
      expect(ring.memberAside(REALM)("peer-m")).toBe(true);
      expect(ring.standsInRealm("peer-m", REALM)).toBe(false);
    });
    // A holder's hand over a member edge meets a refusal: only the quorum holds that edge.
    const other = await nymOf(64);
    await expect(direct(runEdgeKapae)({ member: other, realm: REALM, raised: true })).rejects.toThrow(/no single key holds/);
    await withRing({ "peer-o": { nym: other } }, async (ring) => { await ring.refold(); expect(ring.memberAside(REALM)("peer-o")).toBe(false); });
  });
});
