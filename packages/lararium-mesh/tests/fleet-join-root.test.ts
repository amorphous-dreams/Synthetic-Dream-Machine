/** The root holder's half of the fleet-join door, composed once for every vessel: an offer, and the answer to one request. */
import { sovereignPinAt } from "./fixtures/sovereign-pin.js";
import { describe, expect, test } from "vitest";
import {
  composeFleetJoinAnswer, composeFleetJoinOffer, composeFleetJoinRequest, fleetJoinAnswerImage, fleetJoinHearthOf, fleetJoinSealPair,
  readFleetJoinAnswer, readFleetJoinOffer, FleetJoinRootRefused,
  type FleetJoinAnswer, type FleetJoinHearthDial, type FleetJoinRequest, type FleetJoinRootDoors,
} from "../src/fleet-join.js";
import { admitCarriageCommit, type CarriageEntry } from "../src/carriage-registry.js";
import { certificateImage, type FaceScope, type VesselFaceCertificate } from "../src/face-proof-subjects.js";
import { chain, pair, signHex, type Chain, type Pair } from "./face-proof-fixture.js";
import { testVesselTagDoor } from "./vessel-tag-fixture.js";
import * as ed25519 from "@noble/ed25519";
import { hex } from "../src/crypto.js";

const GROUP = "c0ffee00d15ea5e5";
const HEARTH_NEXUS = "nexus-a.synthetic";
const SECRET = new Uint8Array(32).fill(7);
const SALT = "5a".repeat(32);

/** A hearth's dial over face `a`'s key at its Nexus: what a root holder standing a gate carries. */
function hearthDial(a: Chain): FleetJoinHearthDial {
  const carriage = { gatePin: sovereignPinAt(HEARTH_NEXUS, 5), canon: { lares: "automerge:canon-lares" } };
  return {
    carriage, charter: "the hearth's charter, as its seal file's text",
    admit: { admit: { nym: a.scope.faceKey, action: "admit", parents: [], sealEpochCid: "epoch-synthetic", carriageCommit: admitCarriageCommit({ carriage, salt: SALT }), signatures: [] } as unknown as CarriageEntry, lineage: [], salt: SALT },
    floorPins: [],
  };
}

interface Rig { root: Pair; joinee: Pair; faces: Chain[]; scopes: FaceScope[]; log: string[]; rootOpen: { now: number; ever: number } }

/** The joinee's request over an offer, minted through the one request composer with a vessel key per scope. */
async function requestOver(rig: Rig, offer: unknown): Promise<{ request: FleetJoinRequest; sealSecret: Uint8Array; offer: ReturnType<typeof readFleetJoinOffer> }> {
  const read = readFleetJoinOffer(offer);
  if ("refusal" in read) throw new Error(read.refusal);
  const seal = fleetJoinSealPair();
  const vessels = new Map<string, Pair>();
  const request = await composeFleetJoinRequest({
    offer: read, atomKey: rig.joinee.key, sealKey: seal.key,
    mintFaceKey: async (scope) => { const p = await pair(`joinee vessel at ${scope.nexus}`); vessels.set(p.key, p); return p.key; },
    custody: { signAsVesselFace: async (_scope, key, image) => ed25519.signAsync(image, vessels.get(key)!.secret) },
    sign: (image) => signHex(image, rig.joinee),
    vesselTag: testVesselTagDoor(5),
  });
  if ("refusal" in request) throw new Error(request.refusal);
  return { request, sealSecret: seal.secret, offer: read };
}

/** A root holder's doors over synthetic keys, logging the order its acts ran in. */
function doorsOf(rig: Rig, hearth: FleetJoinHearthDial | null, over: Partial<FleetJoinRootDoors> = {}): FleetJoinRootDoors {
  return {
    seat: async (request) => {
      rig.log.push("seat");
      return hearth === null
        ? { edge: { kind: "device-admit", deviceEdge: "synthetic", hearthTrueName: "", deviceKey: request.atomKey }, reach: { syncUrl: null, islandKind: null, islandScope: null }, hearth: null }
        : { edge: { kind: "device-admit", deviceEdge: "synthetic", hearthTrueName: HEARTH_NEXUS }, reach: { syncUrl: "ws://hearth.synthetic:7777", islandKind: "charter", islandScope: HEARTH_NEXUS }, hearth };
    },
    certify: async (q) => {
      rig.log.push("certify");
      const face = rig.faces.find((f) => f.scope.faceKey === q.scope.faceKey)!;
      return { scope: q.scope, vesselFaceKey: q.vesselFaceKey, signature: await signHex(certificateImage(q.scope, q.vesselFaceKey), face.face) } as VesselFaceCertificate;
    },
    noteIssued: async () => { rig.log.push("note"); },
    withRoot: async (act) => {
      rig.log.push("root-open"); rig.rootOpen.now++; rig.rootOpen.ever++;
      try { return await act((image) => signHex(image, rig.root)); } finally { rig.rootOpen.now--; rig.log.push("root-shut"); }
    },
    addressSecret: async () => Uint8Array.from(SECRET),
    ...over,
  };
}

async function rigOf(nexuses: readonly string[]): Promise<Rig> {
  const faces = await Promise.all(nexuses.map((n, i) => chain(`root face ${i}`, n)));
  return { root: await pair("composer root"), joinee: await pair("composer joinee"), faces, scopes: faces.map((f) => f.scope), log: [], rootOpen: { now: 0, ever: 0 } };
}

describe("the root holder's half composes once, over the vessel's doors", () => {
  test("RED: an offer names the face, its root key and its standing scopes under a fresh nonce each time", async () => {
    const rig = await rigOf([HEARTH_NEXUS, "nexus-b.synthetic"]);
    const one = composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: [...rig.scopes].reverse() });
    const two = composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes });
    expect(readFleetJoinOffer(JSON.parse(JSON.stringify(one)))).toEqual(one);
    expect(one.scopes).toEqual(two.scopes);
    expect(one.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(one.nonce).not.toBe(two.nonce);
  });

  test("RED: a root holder standing a gate answers with its hearth's dial, and the joinee's reader opens the secret", async () => {
    const rig = await rigOf([HEARTH_NEXUS, "nexus-b.synthetic"]);
    const { request, sealSecret } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes }));
    const answer = await composeFleetJoinAnswer({ request: JSON.parse(JSON.stringify(request)), personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes, doors: doorsOf(rig, hearthDial(rig.faces[0]!)) });
    const verified = readFleetJoinAnswer(JSON.parse(JSON.stringify(answer)), { request, personaGroup: GROUP, rootKey: rig.root.key, sealSecret });
    if ("refusal" in verified) throw new Error(verified.refusal);
    expect(Array.from(verified.addressSecret)).toEqual(Array.from(SECRET));
    expect(fleetJoinHearthOf(verified.answer)?.carriage.gatePin).toEqual(sovereignPinAt(HEARTH_NEXUS, 5));
    expect(verified.answer.grants).toHaveLength(2);
    // THE ORDER: the seat, then every certificate, the issued note, and only then the root, opened once and shut again.
    expect(rig.log).toEqual(["seat", "certify", "certify", "note", "root-open", "root-shut"]);
    expect(rig.rootOpen).toEqual({ now: 0, ever: 1 });
  });

  test("RED: a root holder standing no gate answers with no hearth's dial: a leaf fleet's answer reads, and its secret opens", async () => {
    const rig = await rigOf([]);
    const { request, sealSecret } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: [] }));
    const answer = await composeFleetJoinAnswer({ request, personaGroup: GROUP, rootKey: rig.root.key, scopes: [], doors: doorsOf(rig, null) });
    expect([answer.carriage, answer.charter, answer.admit, answer.floorPins]).toEqual([null, null, null, []]);
    const verified = readFleetJoinAnswer(JSON.parse(JSON.stringify(answer)), { request, personaGroup: GROUP, rootKey: rig.root.key, sealSecret });
    if ("refusal" in verified) throw new Error(verified.refusal);
    expect(Array.from(verified.addressSecret)).toEqual(Array.from(SECRET));
    expect(fleetJoinHearthOf(verified.answer)).toBeNull();
    expect(verified.answer.certificates).toEqual([]);
  });

  test("RED: the hearth's dial stands whole or not at all, and an answer with none names no Nexus", async () => {
    const rig = await rigOf([HEARTH_NEXUS]);
    const { request, sealSecret } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes }));
    const whole = await composeFleetJoinAnswer({ request, personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes, doors: doorsOf(rig, hearthDial(rig.faces[0]!)) });
    const read = (a: unknown) => readFleetJoinAnswer(a, { request, personaGroup: GROUP, rootKey: rig.root.key, sealSecret });
    const resigned = async (a: FleetJoinAnswer): Promise<FleetJoinAnswer> => ({ ...a, signature: await signHex(fleetJoinAnswerImage(a), rig.root) });
    expect(read(await resigned({ ...whole, charter: null }))).toEqual({ refusal: "answer-hearth-partial" });
    expect(read(await resigned({ ...whole, carriage: null }))).toEqual({ refusal: "answer-hearth-partial" });
    expect(read(await resigned({ ...whole, admit: null }))).toEqual({ refusal: "answer-hearth-partial" });
    // No dial, yet the edge still names a hearth, the reach an island, or a floor pin rides: each refuses by name.
    const bare = { ...whole, carriage: null, charter: null, admit: null, floorPins: [] };
    expect(read(await resigned(bare))).toEqual({ refusal: "answer-hearthless-names-nexus" });
    const noName = { ...bare, edge: { kind: "device-admit", hearthTrueName: "" } };
    expect(read(await resigned(noName))).toEqual({ refusal: "answer-hearthless-names-nexus" });
    // CONTROL: a courier that strips the dial from a signed answer leaves bytes the root never signed.
    expect(read({ ...whole, carriage: null, charter: null, admit: null, floorPins: [], reach: { syncUrl: null, islandKind: null, islandScope: null }, edge: { kind: "device-admit", hearthTrueName: "" } })).toEqual({ refusal: "answer-unsigned" });
  });

  test("RED: a request that does not read against the face's offer as it stands signs nothing", async () => {
    const rig = await rigOf([HEARTH_NEXUS]);
    const { request } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes }));
    const refused = async (over: Parameters<typeof composeFleetJoinAnswer>[0]) => composeFleetJoinAnswer(over).then(() => "answered", (e: unknown) => (e instanceof FleetJoinRootRefused ? e.refusal : `threw ${String(e)}`));
    const base = { request, personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes, doors: doorsOf(rig, hearthDial(rig.faces[0]!)) };
    expect(await refused({ ...base, request: { kind: "fleet-join-request" } })).toBe("request-malformed");
    expect(await refused({ ...base, request: { ...request, signature: "00".repeat(64) } })).toBe("request-unsigned");
    // The face left the scope the request asks at: the offer rebuilt over today's scopes names it no more.
    expect(await refused({ ...base, scopes: [] })).toBe("request-scope-unoffered");
    // Another face's root holder reads another group's tag.
    expect(await refused({ ...base, personaGroup: "0123456789abcdef" })).toBe("request-vessel-tag-invalid");
    expect(await refused({ ...base, apart: [request.atomKey] })).toBe("request-key-reused");
    expect(rig.log).toEqual([]);
  });

  test("RED: a seat that refuses leaves the root shut; a hearth whose admit names a key the request never asked refuses before any certificate", async () => {
    const rig = await rigOf([HEARTH_NEXUS]);
    const { request } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes }));
    const base = { request, personaGroup: GROUP, rootKey: rig.root.key, scopes: rig.scopes };
    await expect(composeFleetJoinAnswer({ ...base, doors: doorsOf(rig, null, { seat: async () => { throw new Error("vessel-already-admitted"); } }) })).rejects.toThrow("vessel-already-admitted");
    expect(rig.rootOpen.ever).toBe(0);
    const other = await chain("another face", HEARTH_NEXUS);
    await expect(composeFleetJoinAnswer({ ...base, doors: doorsOf(rig, hearthDial(other)) })).rejects.toMatchObject({ refusal: "request-scope-household-absent" });
    expect(rig.log).toEqual(["seat"]);
    expect(rig.rootOpen.ever).toBe(0);
  });

  test("RED: a face with no address secret seals nothing, and a root door that signs under another key sends nothing", async () => {
    const rig = await rigOf([]);
    const { request } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: [] }));
    const base = { request, personaGroup: GROUP, rootKey: rig.root.key, scopes: [] };
    await expect(composeFleetJoinAnswer({ ...base, doors: doorsOf(rig, null, { addressSecret: async () => null }) })).rejects.toMatchObject({ refusal: "no-address-secret" });
    expect(rig.rootOpen.now).toBe(0);
    const stranger = await pair("a stranger's root");
    await expect(composeFleetJoinAnswer({ ...base, doors: doorsOf(rig, null, { withRoot: (act) => act((image) => signHex(image, stranger)) }) })).rejects.toMatchObject({ refusal: "answer-unsigned" });
  });

  test("RED: the composer zero-fills the address secret it was handed", async () => {
    const rig = await rigOf([]);
    const { request } = await requestOver(rig, composeFleetJoinOffer({ personaGroup: GROUP, rootKey: rig.root.key, scopes: [] }));
    const handed = Uint8Array.from(SECRET);
    await composeFleetJoinAnswer({ request, personaGroup: GROUP, rootKey: rig.root.key, scopes: [], doors: doorsOf(rig, null, { addressSecret: async () => handed }) });
    expect(Array.from(handed)).toEqual(new Array(32).fill(0));
    expect(hex(SECRET)).toBe("07".repeat(32));
  });
});
