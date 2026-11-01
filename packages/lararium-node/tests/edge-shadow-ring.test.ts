/**
 * edge-shadow-ring — the one live reading the gates consult, driven through each gate's own entry point.
 *
 * The acts land through the door a person runs (`runEdgeKapae`); the ring folds the boards; then the socket
 * sorter, the share verdict, carriage serve and the realm's gates each answer. Every vector carries a control.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae#/reach
 */
import { afterEach, beforeEach, describe, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  hex, DAEMON_BAG_ID, seedDaemonDoc, materializeSharedLarDoc,
  RealmBoardGate, RealmBagGate, realmDocUrl, realmEdgeBoardDocUrl, realmVouchBoardDocUrl, fleetEdgeBoardDocUrl,
  deviceEdgeId, DeterministicFederationGate, crossroadsDocUrl,
  nexusAidOf,
  type FederationGate, type NexusMembership, type PlaneSeal, type AntigenRing,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey,
} from "../src/node-vessel-identity.js";
import { signCabalInvite, writeVouch, prepareHolderFrontier, registerHandFrontierInto, type NexusDoc } from "@lararium/mesh";
import { larDataDir, larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { noteVesselRealm } from "../src/edge-board.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalVouch } from "../src/commands/cabal-vouch.js";
import { runCabalJoin } from "../src/commands/cabal-join.js";
import { runEdgeKapae } from "../src/commands/edge-kapae-cmd.js";
import { runEdgeSeatMarks } from "../src/commands/edge-seats.js";
import { signSeatRoll, ed25519SignerFromSeed } from "@lararium/mesh";
import { makeEdgeShadowRing, type EdgeShadowRing } from "../src/edge-shadow-ring.js";
import { floorShadowRing } from "../src/floor-fleet-lanes.js";
import { makeGateSorter } from "../src/socket-sorter.js";
import { gateShadowRing } from "../src/gate-shadow-ring.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";
import { decideAndServeWantBlock, type CasWireServerDeps } from "../src/cas-wire.js";
import type { FaceScope, GateSortInput, VesselFaceKey } from "@lararium/mesh";
import { direct } from "./direct-store.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { chairKey, seatChairs } from "./seat-fixture.js";
import { foundRealmFrontier } from "./realm-frontier-fixture.js";
import { atomKeyOf, atomSeedOf, seedFaceAtom, actingAtomKey } from "./atom-fixture.js";
import { seedFleet } from "./fleet-seed-fixture.js";
import { fleetLineageOf } from "../src/fleet-lineage.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { scratchRoot as root, it } from "./support/scratch-fixture.js";

const REALM = "a".repeat(64);
const nymOf = (byte: number) => ed.getPublicKeyAsync(new Uint8Array(32).fill(byte)).then(hex);
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

beforeEach(async () => {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await generateOrLoadPersonaGroupRoot(0);
  await seedFaceAtom(0);
  await seedFleet(0);
  await ownedStore(larDataDir(), async (repo) => {
    const handle = seedDaemonDoc(repo);
    await repo.flush();
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packed = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: handle.url, kind: "oracle" } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packed }) }), "utf8");
  });
});
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 200));
});

/**
 * Seat a charter over chair 0's own seat key, and root face 0 in REALM: the seat vouches the face
 * (by its own hand, outside every door), so a vouch that face makes through the door roots in the seat. The
 * lineage's roots stay the seats of the charter the realm stands under; a face's key at that Nexus never sits
 * among them, since the Nexus names itself after its seats.
 */
let seatKey = "";
let charterDoc: NexusDoc | null = null;
async function seatOwnCharter(): Promise<void> {
  await generateOrLoadPersonaGroupRoot(0);
  await seedFaceAtom(0);
  const seat = (await seatChairs([0])).hands[0]!;
  seatKey = seat.signer;
  const charter = heldCharter({ keys: [seat.signer], threshold: 1 });
  charterDoc = charter.doc({ labels: ["Kahu 0"] });
  writeNexusDoc(larSealHome(), charterDoc);
  await ownedStore(larDataDir(), async (repo) => {
    const board = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    await foundRealmFrontier(board, REALM, charter, [seat]);
    await repo.flush();
  });
}
async function rootFaceInRealm(face: string): Promise<void> {
  const invite = await signCabalInvite({ realmDocIdHex: REALM, joinerIdentityHex: face, voucherDid: seatKey, boundEpoch: "0" },
    (await seatChairs([0])).hands[0]!.sign);
  await ownedStore(larDataDir(), async (repo) => {
    const board = await materializeSharedLarDoc(repo, realmVouchBoardDocUrl(REALM), "board:vouch-registry");
    board.change((d) => writeVouch(d, invite));
    const edge = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
    const chair = (await seatChairs([0])).hands[0]!;
    const head = await prepareHolderFrontier({ realm: REALM, board: edge.doc(), voucher: seatKey,
      counted: [], signer: { key: chair.signer, sign: chair.sign } });
    if (head.kind !== "none") edge.change((d) => registerHandFrontierInto(d, head));
    await repo.flush();
  });
}

/** Stand a ring over this vessel's store for one read, and hand the caller the ring while the store stays held. */
async function withRing<T>(
  peers: Record<string, { vessel?: string; nym?: string }>, run: (ring: EdgeShadowRing) => Promise<T>,
  charterRealm: string | null = REALM,
): Promise<T> {
  const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
  const vesselKey = (await actingAtomKey(0));
  const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey() });
  return ownedStore(larDataDir(), async (repo) => run(makeEdgeShadowRing({
    repo, vesselKey: () => vesselKey, sealHome: larSealHome(),
    fleetRoots: () => [fleetRoot],
    lineageOfFleet: (r) => fleetLineageOf(repo, r, [island]),
    charterRealm: () => charterRealm,
    vesselKeyOfPeer: (peerId) => peers[peerId]?.vessel ?? null,
    realmNymOfPeer: (peerId) => peers[peerId]?.nym ?? null,
  })));
}

describe("the ring fails closed until its first fold lands", () => {
  it("a floor composition stays shut, then the selected face folds its fleet on the same store", async () => {
    const selected = await actingAtomKey();
    const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    await ownedStore(larDataDir(), async (repo) => {
      const common = {
        repo, sealHome: larSealHome(), charterRealm: () => null,
        vesselKeyOfPeer: () => null, realmNymOfPeer: () => null,
      };
      const floor = floorShadowRing(makeEdgeShadowRing({ ...common, vesselKey: () => "", fleetRoots: () => [] }), (p) => p === "sibling");
      expect(floor.fold()).toBeNull();
      expect(floor.deviceAside(selected)).toBe(true);
      expect(floor.aside("sibling")).toBe(true);
      await floor.refold();
      expect(floor.deviceAside(selected)).toBe(true); // floor remains shut after folding
      floor.dispose();

      const face = makeEdgeShadowRing({ ...common, vesselKey: () => selected, fleetRoots: () => [fleetRoot] });
      expect(face.fold()).toBeNull();
      const fold = await face.refold();
      expect(fold.fleets.map((f) => f.fleetRoot)).toContain(fleetRoot);
      expect(face.fold()).not.toBeNull();
      face.dispose();
    });
  });
  it("★ before any fold every device reads aside, every member reads aside, and nobody stands ★", async () => {
    const phone = await nymOf(51);
    await withRing({ p: { vessel: phone, nym: phone } }, async (ring) => {
      expect(ring.fold()).toBeNull();
      expect(ring.deviceAside(phone)).toBe(true);
      expect(ring.aside("p")).toBe(true);
      expect(ring.memberAside(REALM)("p")).toBe(true);
      expect(ring.standsInRealm("p", REALM)).toBe(false);
      await ring.refold();
      expect(ring.deviceAside(phone)).toBe(false);
      expect(ring.aside("p")).toBe(false);
      // A fold alone cannot clear a member while the realm has no signed frontier.
      expect(ring.memberAside(REALM)("p")).toBe(true);
      expect(ring.standsInRealm("p", REALM)).toBe(false);
    });
    const chairs = await seatChairs([0]);
    const charter = heldCharter({ keys: [...chairs.keys], threshold: 1 });
    writeNexusDoc(larSealHome(), charter.doc());
    await ownedStore(larDataDir(), async (repo) => {
      await noteVesselRealm(repo, await actingAtomKey(0), REALM, nexusAidOf(charter.doc())!);
      const edge = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
      await foundRealmFrontier(edge, REALM, charter, chairs.hands);
      await repo.flush();
    });
    await withRing({ p: { vessel: phone, nym: phone } }, async (ring) => {
      await ring.refold();
      // CONTROL: the charter's held hand founds genesis, so the same member reads clear. (The device half stands in the
      // first ring: seating a charter renames the island the fleet lineage is read through.)
      expect(ring.memberAside(REALM)("p")).toBe(false);
    });
  });
});

describe("device standing names the fleet edge", () => {
  it("reads aside before a fold, and clear for an unnamed device after a fold", async () => {
    const device = await nymOf(71);
    await withRing({}, async (ring) => {
      const fleet = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
      expect(ring.deviceStanding(fleet, device)).toBe("aside");
      await ring.refold();
      expect(ring.deviceStanding(fleet, device)).toBe("clear");
    });
  });

  it("reads aside after a raise, owing after its lower, and returned once the raise got answered", async () => {
    const device = await nymOf(72);
    const fleet = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    const raised = await direct(runEdgeKapae)({ device, raised: true });
    await withRing({}, async (ring) => { await ring.refold(); expect(ring.deviceStanding(fleet, device)).toBe("aside"); });
    await direct(runEdgeKapae)({ device, raised: false });
    // The lift stands and the raise still owes its roll: the reading says so until this vessel answers it.
    await withRing({}, async (ring) => { await ring.refold(); expect(ring.deviceStanding(fleet, device)).toBe("owing"); });
    const receipt = async (how: "revoked" | "no-authority", cid: string, edgeId: string) =>
      signSeatRoll({ kind: "seat-roll", scope: fleet.toLowerCase(), edgeId, raiseCids: [cid], how }, ed25519SignerFromSeed(await atomSeedOf()));
    await direct(runEdgeSeatMarks)({ fleetRoot: fleet, rolls: [await receipt("revoked", raised.actCid, raised.edgeId)] });
    await withRing({}, async (ring) => { await ring.refold(); expect(ring.deviceStanding(fleet, device)).toBe("returned"); });
    // A raise this vessel answered with NO AUTHORITY left its seat standing under another hand: it reads owing still.
    const other = await nymOf(74);
    const up = await direct(runEdgeKapae)({ device: other, raised: true });
    await direct(runEdgeKapae)({ device: other, raised: false });
    await direct(runEdgeSeatMarks)({ fleetRoot: fleet, rolls: [await receipt("no-authority", up.actCid, up.edgeId)] });
    await withRing({}, async (ring) => { await ring.refold(); expect(ring.deviceStanding(fleet, other)).toBe("owing"); });
    expect(raised.shadowStands).toBe(true);
  });

  it("reads aside for a fleet this vessel does not follow", async () => {
    const device = await nymOf(73);
    await withRing({}, async (ring) => {
      await ring.refold();
      expect(ring.deviceStanding("ff".repeat(32), device)).toBe("aside");
    });
  });
});

describe("a fold that fails leaves no reading", () => {
  it("★ after a failed refold every gate answers closed, where the earlier reading would have admitted ★", async () => {
    const phone = await nymOf(54);
    const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    const vesselKey = (await actingAtomKey(0));
    let fail = false;
    const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey() });
    await ownedStore(larDataDir(), async (repo) => {
      const ring = makeEdgeShadowRing({
        repo, vesselKey: () => vesselKey, sealHome: larSealHome(), lineageOfFleet: (r) => fleetLineageOf(repo, r, [island]),
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

describe("the reading goes dark the moment a board moves", () => {
  it("★ a change on a board this ring follows closes every gate until the next fold lands ★", async () => {
    const phone = await nymOf(55);
    const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    const vesselKey = (await actingAtomKey(0));
    let refolds = 0;
    const island = nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey() });
    await ownedStore(larDataDir(), async (repo) => {
      const ring = makeEdgeShadowRing({
        repo, vesselKey: () => vesselKey, sealHome: larSealHome(), fleetRoots: () => [fleetRoot], lineageOfFleet: (r) => fleetLineageOf(repo, r, [island]),
        vesselKeyOfPeer: () => phone, realmNymOfPeer: () => null, onRefold: () => { refolds++; },
      });
      await ring.refold();
      expect(ring.deviceAside(phone)).toBe(false);                                 // CONTROL
      // Another hand's act arrives on the fleet board (here: any change to the document).
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(fleetRoot), "board:edge-kapae");
      board.change((d) => { (d.tiddlers as Record<string, unknown>)["a-foreign-row"] = { tiddler: { text: "noise" }, meta: {} }; });
      expect(ring.fold()).toBeNull();
      expect(ring.deviceAside(phone)).toBe(true);
      for (let i = 0; i < 100 && refolds === 0; i++) await new Promise((r) => setTimeout(r, 20));
      expect(refolds).toBeGreaterThan(0);
      expect(ring.deviceAside(phone)).toBe(false);
      ring.dispose();
    });
  });
});

describe("a fold a board's change overtook publishes nothing", () => {
  it("★ a fold that started before a board moved never lands over the fold that followed the move ★", async () => {
    const phone = await nymOf(56);
    const fleetRoot = (await generateOrLoadPersonaGroupRoot(0)).verifyingKey;
    const vesselKey = (await actingAtomKey(0));
    let refolds = 0;
    let calls = 0;
    let release = (): void => undefined;
    const held = new Promise<void>((r) => { release = r; });
    await ownedStore(larDataDir(), async (repo) => {
      const ring = makeEdgeShadowRing({
        repo, vesselKey: () => vesselKey, sealHome: larSealHome(),
        // The SECOND fold waits inside its first read; every other fold runs straight through.
        fleetRoots: async () => { if (++calls === 2) await held; return [fleetRoot]; },
        vesselKeyOfPeer: () => phone, realmNymOfPeer: () => null, onRefold: () => { refolds++; },
      });
      await ring.refold();
      const early = ring.refold();                                                 // the fold a caller started early
      const board = await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl(fleetRoot), "board:edge-kapae");
      board.change((d) => { (d.tiddlers as Record<string, unknown>)["a-foreign-row"] = { tiddler: { text: "noise" }, meta: {} }; });
      for (let i = 0; i < 100 && refolds === 0; i++) await new Promise((r) => setTimeout(r, 20));
      expect(refolds).toBeGreaterThan(0);
      const fresh = ring.fold();
      expect(fresh).not.toBeNull();                                                // CONTROL: the fold after the move landed
      release();
      await early;
      expect(ring.fold()).toBe(fresh);                                             // the overtaken fold published nothing
      ring.dispose();
    });
  });
});

// ── D4: the face key a gate proves, bound to its device edge ──────────────────────────────────────────────
const PHONE_FACE = "a1".repeat(32), PHONE_FACE_TWO = "a2".repeat(32), LAPTOP_FACE = "b1".repeat(32);
const FACE_N = "nexus-n";
const presenterOf = (vesselFaceKey: string, faceKey = "f1".repeat(32)) => ({ scope: { faceKey, nexus: FACE_N } as FaceScope, vesselFaceKey: vesselFaceKey as VesselFaceKey });
const faceDevices = (pairs: Record<string, string>) => (p: { vesselFaceKey: VesselFaceKey }) =>
  pairs[p.vesselFaceKey] !== undefined ? { device: pairs[p.vesselFaceKey]! } : { unreadable: "face-device-unbound" };
/** What a sovereign gate hands its sorter for a face it read held, with the PersonaGroup's grant. */
function sameOperatorInput(fleetAside: boolean): GateSortInput {
  const faceKey = "f1".repeat(32);
  return {
    tier: "sovereign", scope: { faceKey, nexus: FACE_N } as FaceScope, placeKey: null, place: null, profile: "face" as GateSortInput["profile"],
    admit: { verdict: { state: "held", reason: "held", nym: faceKey }, nexus: FACE_N, admitRef: "ref", revision: "r", head: faceKey },
    sameGroup: { personaGroup: "0xgroup", faceKey, nexus: FACE_N, revision: "g" }, fleetAside,
    arm: { kind: "admit", admit: {} as never, lineage: [] },
  };
}

describe("D4 — a device set aside cuts every face it presented, across a restart", () => {
  it("★ two faces one device presents read fleet-aside from the gate's ring, before and after the vessel restarts ★", async () => {
    const phone = await nymOf(54), laptop = await nymOf(55);
    const devices = faceDevices({ [PHONE_FACE]: phone, [PHONE_FACE_TWO]: phone, [LAPTOP_FACE]: laptop });
    const faces = [presenterOf(PHONE_FACE), presenterOf(PHONE_FACE_TWO, "f2".repeat(32)), presenterOf(LAPTOP_FACE)];
    // CONTROL: before any shadow, a folded ring reads every mapped face clear.
    await withRing({}, async (ring) => {
      await ring.refold();
      expect(faces.map((f) => gateShadowRing({ ring, deviceOf: devices }).consult(f).fleetAside)).toEqual([false, false, false]);
    });
    await direct(runEdgeKapae)({ device: phone, raised: true });
    await withRing({}, async (ring) => {
      const shadows = gateShadowRing({ ring, deviceOf: devices });
      await ring.refold();
      expect(faces.map((f) => shadows.consult(f).fleetAside)).toEqual([true, true, false]);
    });
    // THE RESTART: a fresh ring over the reopened store answers closed until it folds, then reads the shadow again.
    await withRing({}, async (ring) => {
      const shadows = gateShadowRing({ ring, deviceOf: devices });
      expect(faces.map((f) => shadows.consult(f))).toEqual(faces.map(() => ({ aside: true, fleetAside: true })));
      await ring.refold();
      expect(faces.map((f) => shadows.consult(f).fleetAside)).toEqual([true, true, false]);
      const sorter = makeGateSorter({ posture: () => "private" });
      expect(await sorter.sort(sameOperatorInput(shadows.consult(faces[1]!).fleetAside))).toMatchObject({ class: "contracted" });
      expect(await sorter.sort(sameOperatorInput(shadows.consult(faces[2]!).fleetAside))).toEqual({ class: "same-operator" });
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

      // THE GATE (D4), through its own entry points: a face the phone presents, proven same-operator, set aside.
      const shadows = gateShadowRing({ ring, deviceOf: faceDevices({ [PHONE_FACE]: phone, [LAPTOP_FACE]: laptop }) });
      const sorter = makeGateSorter({ posture: () => "private" });
      const sorted = (vesselFaceKey: string) => sorter.sort(sameOperatorInput(shadows.consult(presenterOf(vesselFaceKey)).fleetAside));
      expect(shadows.consult(presenterOf(PHONE_FACE))).toEqual({ aside: false, fleetAside: true });
      expect(await sorted(PHONE_FACE)).toMatchObject({ class: "contracted" });      // it sorts by what else it proves: its admit
      expect(await sorted(LAPTOP_FACE)).toEqual({ class: "same-operator" });        // CONTROL

      // THE SHARE VERDICT: a socket admitted before the shadow arrived still holds its class; the verdict reads the shadow first.
      const MY_NEXUS = "11".repeat(32);
      const share = (peerId: string, documentId: DocumentId, sibling = false) => selfSlotShareDecision({
        hasWsSocket: !sibling, sibling, siblingGate: { mayFederate: () => true }, peerClass: "same-operator",
        selfSlotFedGate: new DeterministicFederationGate(MY_NEXUS), antigenRing: null, membership: null, planeSeal: null,
        peerId, documentId, shadow: ring,
        // D3: the gate of the face each session proved; it would hand over the face's every plane, so only the shadow refuses.
        sessionFace: { mayFederate: () => true },
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
    const own = (await actingAtomKey(0));
    await direct(runEdgeKapae)({ device: own, raised: true });
    await withRing({}, async (ring) => { expect((await ring.refold()).fleets[0]!.selfAside).toBe(true); });
  });
});

describe("a realm's members — the realm gate and the lane its boards cross by", () => {
  it("waits before a qualifying frontier, then admits under the charter quorum's genesis", async () => {
    const joiner = await nymOf(60);
    // Name a real chair in the charter before this vessel stores its key. The face can vouch,
    // but the vouch cannot sign a quorum genesis until the chair's hand is held here.
    const seat = await chairKey(0);
    const charter = heldCharter({ keys: [seat], threshold: 1 });
    writeNexusDoc(larSealHome(), charter.doc({ labels: ["Kahu 0"] }));
    const vouch = await direct(runCabalVouch)({ joiner, realm: REALM, boundEpoch: 0 });
    await withRing({ p: { nym: joiner } }, async (ring) => {
      await ring.refold();
      expect(ring.realmFrontierOf(REALM)?.status).toBe("unknown");
      expect(ring.memberAside(REALM)("p")).toBe(true);
      expect(ring.standsInRealm("p", REALM)).toBe(false);
    });
    const waiting = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, epoch: 0 });
    expect(waiting.refusal).toBe("frontier-unknown");
    expect(waiting.missing?.length).toBeGreaterThan(0);

    const held = (await seatChairs([0])).hands[0]!;
    seatKey = held.signer;
    await ownedStore(larDataDir(), async (repo) => {
      const edge = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
      await foundRealmFrontier(edge, REALM, charter, [held]);
      await repo.flush();
    });
    await rootFaceInRealm(vouch.voucherDid);
    await withRing({ p: { nym: joiner } }, async (ring) => {
      await ring.refold();
      expect(ring.realmFrontierOf(REALM)?.status).toBe("known");
      expect(ring.standsInRealm("p", REALM)).toBe(true);
    });
    const entered = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, epoch: 0 });
    expect(entered.admitted).toBe(true);
    expect(entered.frontier?.asOf["quorum"]?.cid).toMatch(/^[0-9a-f]{64}$/);
  });
  it("★ a withdrawn vouch sets its joiner aside at the realm's gate and closes the realm's boards to it ★", async () => {
    await seatOwnCharter();
    const joiner = await nymOf(61), bystander = await nymOf(62);
    const vouch = await direct(runCabalVouch)({ joiner, realm: REALM, boundEpoch: 0 });
    await rootFaceInRealm(vouch.voucherDid);
    const peers = { "peer-j": { nym: joiner }, "peer-b": { nym: bystander }, "peer-root": { nym: seatKey } };
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
      expect(await at.edgeBoard("peer-root")).toBe(true);                         // a seat of the charter roots the lineage
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

    // ★ A hand deletes the withdrawn vouch from the realm's vouch board. This vessel read it once: the joiner
    //   still reads aside, and the board regains the vouch at the next fold.
    const vouchUrl = realmVouchBoardDocUrl(REALM);
    await ownedStore(larDataDir(), async (repo) => {
      const board = await materializeSharedLarDoc(repo, vouchUrl, "board:vouch-registry");
      board.change((d) => { for (const key of Object.keys(d.tiddlers)) delete (d.tiddlers as Record<string, unknown>)[key]; });
      await repo.flush();
      expect(Object.keys(board.doc()!.tiddlers)).toEqual([]);
    });
    await withRing(peers, async (ring) => {
      await ring.refold();
      expect(ring.memberAside(REALM)("peer-j")).toBe(true);
      expect(ring.standsInRealm("peer-j", REALM)).toBe(false);
    });
    await ownedStore(larDataDir(), async (repo) => {
      const board = await materializeSharedLarDoc(repo, vouchUrl, "board:vouch-registry");
      // Both vouches this vessel read come back: the seat's over the face, and the face's over the joiner.
      expect(Object.keys(board.doc()!.tiddlers)).toHaveLength(2);
    });
  });

  it("★ a vessel that holds no charter of the realm's Nexus reads no joiner as standing: nothing else roots a lineage ★", async () => {
    await seatOwnCharter();
    const joiner = await nymOf(65);
    const vouch = await direct(runCabalVouch)({ joiner, realm: REALM, boundEpoch: 0 });
    await rootFaceInRealm(vouch.voucherDid);
    // The vessel's charter moves to ANOTHER Nexus: the realm still stands under the first one, whose charter it no
    // longer holds.
    const held = charterDoc!;
    writeNexusDoc(larSealHome(), heldCharter({ keys: [await nymOf(66)], threshold: 1 }).doc({ labels: ["Kahu 0"] }));
    await withRing({ "peer-j": { nym: joiner } }, async (ring) => {
      const fold = await ring.refold();
      expect(fold.realms[0]!.roots).toEqual([]);
      expect(ring.standsInRealm("peer-j", REALM)).toBe(false);
      expect(ring.memberAside(REALM)("peer-j")).toBe(true);
    });
    // CONTROL: holding the charter of the Nexus the realm stands under, the same lineage gives its joiner standing.
    writeNexusDoc(larSealHome(), held);
    await withRing({ "peer-j": { nym: joiner } }, async (ring) => {
      await ring.refold();
      expect(ring.standsInRealm("peer-j", REALM)).toBe(true);
      expect(ring.memberAside(REALM)("peer-j")).toBe(false);
    });
  });

  it("★ a member the quorum set aside reads nothing of the realm, though no vouch ever named it ★", async () => {
    await Promise.all([0, 1, 2].map((i) => generateOrLoadPersonaGroupRoot(i)));
    await Promise.all([0, 1, 2].map((i) => seedFaceAtom(i)));
    // three faces held: each act names the one these vectors act as (face 0)
    const chairs = await seatChairs([0, 1, 2]);
    const keys = [...chairs.keys];
    const charter = heldCharter({ keys, threshold: 2 });
    const doc = charter.doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
    writeNexusDoc(larSealHome(), doc);
    await ownedStore(larDataDir(), async (repo) => {
      const edge = await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl(REALM), "board:edge-kapae");
      await foundRealmFrontier(edge, REALM, charter, chairs.hands.slice(0, 2));
      await noteVesselRealm(repo, await actingAtomKey(0), REALM, nexusAidOf(doc)!);
      await repo.flush();
    });
    const member = await nymOf(63);
    const peers = { "peer-m": { nym: member } };
    await withRing(peers, async (ring) => { await ring.refold(); expect(ring.memberAside(REALM)("peer-m")).toBe(false); });   // CONTROL
    await direct(runEdgeKapae)({ face: 0, member, realm: REALM, raised: true, hand: "quorum" });
    await withRing(peers, async (ring) => {
      await ring.refold();
      expect(ring.memberAside(REALM)("peer-m")).toBe(true);
      expect(ring.standsInRealm("peer-m", REALM)).toBe(false);
    });
    // A holder's hand over a member edge meets a refusal: only the quorum holds that edge.
    const other = await nymOf(64);
    await expect(direct(runEdgeKapae)({ face: 0, member: other, realm: REALM, raised: true })).rejects.toThrow(/no single key holds/);
    await withRing({ "peer-o": { nym: other } }, async (ring) => { await ring.refold(); expect(ring.memberAside(REALM)("peer-o")).toBe(false); });
  });
});
