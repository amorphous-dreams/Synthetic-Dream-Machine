/** The fleet-join door's three files: an offer, a request bound to it, an answer bound to the request. */
import { sovereignPinAt } from "./fixtures/sovereign-pin.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  composeFleetJoinRequest, fleetJoinSealPair,
  faceKeyGrantImage, fleetJoinAnswerImage, fleetJoinOffer, fleetJoinRequestImage, readFaceKeyGrant,
  readFleetJoinAnswer, readFleetJoinOffer, readFleetJoinRequest, sealAddressSecret,
  type FleetJoinAnswer, type FleetJoinOffer, type FleetJoinRequest,
} from "../src/fleet-join.js";
import { hex } from "../src/crypto.js";
import { admitCarriageCommit, type CarriageEntry } from "../src/carriage-registry.js";
import { deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, type GateBundlePin } from "../src/gate-bundle.js";
import { sealToRecipient } from "../src/sealed-box.js";
import { utf8Bytes, hexToBytes } from "../src/crypto.js";
import { FLEET_JOIN_SECRET_INFO } from "../src/domains.js";
import {
  certificateImage, certificateRequestImage,
  type FaceScope, type VesselFaceCertificate, type VesselFaceCertificateRequest, type VesselFaceKey,
} from "../src/face-proof-subjects.js";
import { chain, pair, signHex, type Chain, type Pair } from "./face-proof-fixture.js";

const GROUP = "c0ffee00d15ea5e5";
const NONCE = "ab".repeat(32);
// The hearth stands at face a's Nexus: the face's admit there names face a's key.
const HEARTH_NEXUS = "nexus-a.synthetic";
const PIN = sovereignPinAt(HEARTH_NEXUS, 5);
const SECRET = new Uint8Array(32).fill(7);

const SALT = "5a".repeat(32);
const CHARTER_TEXT = "the hearth's charter, as its seal file's text";
/** The face's admit as the answer carries it: a synthetic entry committing to `carriage` under SALT (the quorum is read at landing). */
const faceAdmitOver = (carriage: FleetJoinAnswer["carriage"], nym: string, salt = SALT) => ({
  admit: { nym, action: "admit", parents: [], sealEpochCid: "epoch-synthetic", carriageCommit: admitCarriageCommit({ carriage, salt }), signatures: [] } as unknown as CarriageEntry,
  lineage: [], salt,
});
const floorPinAt = (nexus: string, route = "/oracle", tag = 8): GateBundlePin => {
  const bundle = deriveGateBundle(floorGateRoot(floorKeyDoor({ derive: () => new Uint8Array(32).fill(tag) })), utf8Bytes(nexus), floorRoute(route));
  try { return bundle.pin; } finally { bundle.drop(); }
};

interface World {
  root: Pair; joinee: Pair; a: Chain; b: Chain; offer: FleetJoinOffer;
  seal: { secret: Uint8Array; key: string }; request: FleetJoinRequest; answer: FleetJoinAnswer;
}

async function world(): Promise<World> {
  const root = await pair("fleet root");
  const joinee = await pair("fleet joinee");
  const a = await chain("fleet face a", "nexus-a.synthetic");
  const b = await chain("fleet face b", "nexus-b.synthetic");
  const offer = fleetJoinOffer({ personaGroup: GROUP, rootKey: root.key, nonce: NONCE, scopes: [b.scope, a.scope, a.scope] });
  const sealSecret = new Uint8Array(32).fill(9);
  const seal = { secret: sealSecret, key: hex(x25519.getPublicKey(sealSecret)) };
  const body = { nonce: NONCE, atomKey: joinee.key, sealKey: seal.key, requests: [a.request, b.request] };
  const request: FleetJoinRequest = { kind: "fleet-join-request", ...body, signature: await signHex(fleetJoinRequestImage(body), joinee) };
  const carriage = { gatePin: PIN, canon: { "@lares": "automerge:canon-lares" } };
  const answerBody = {
    nonce: NONCE, atomKey: joinee.key, personaGroup: GROUP, edge: { kind: "device-admit/v1", deviceEdge: "synthetic", hearthTrueName: HEARTH_NEXUS },
    carriage,
    reach: { syncUrl: "ws://hearth.synthetic:7777", islandKind: "charter", islandScope: HEARTH_NEXUS },
    charter: CHARTER_TEXT,
    admit: faceAdmitOver(carriage, a.scope.faceKey),
    floorPins: [floorPinAt(HEARTH_NEXUS)],
    secret: sealAddressSecret({ secret: SECRET, request }),
  };
  const grants = await Promise.all([a, b].map(async (c) => ({ personaGroup: GROUP, scope: c.scope, signature: await signHex(faceKeyGrantImage(GROUP, c.scope), root) })));
  const answer: FleetJoinAnswer = {
    kind: "fleet-join-answer", ...answerBody, certificates: [a.certificate, b.certificate], grants,
    signature: await signHex(fleetJoinAnswerImage(answerBody), root),
  };
  return { root, joinee, a, b, offer, seal, request, answer };
}

const read = (w: World, answer: unknown = w.answer, rootKey = w.root.key) =>
  readFleetJoinAnswer(answer, { request: w.request, personaGroup: GROUP, rootKey, sealSecret: w.seal.secret });

describe("the fleet-join door's files", () => {
  test("an offer reads its scopes sorted and distinct, and refuses an unsorted carriage", async () => {
    const w = await world();
    expect(w.offer.scopes.map((s) => s.nexus)).toEqual(["nexus-a.synthetic", "nexus-b.synthetic"]);
    expect(readFleetJoinOffer(JSON.parse(JSON.stringify(w.offer)))).toEqual(w.offer);
    expect(readFleetJoinOffer({ ...w.offer, scopes: [...w.offer.scopes].reverse() })).toEqual({ refusal: "offer-malformed" });
    expect(readFleetJoinOffer({ ...w.offer, extra: 1 })).toEqual({ refusal: "offer-malformed" });
  });

  test("a request reads against its offer, and every binding refuses by name", async () => {
    const w = await world();
    expect(readFleetJoinRequest(JSON.parse(JSON.stringify(w.request)), w.offer)).toEqual(w.request);
    expect(readFleetJoinRequest(w.request, { ...w.offer, nonce: "ef".repeat(32) })).toEqual({ refusal: "request-other-offer" });
    expect(readFleetJoinRequest(w.request, { ...w.offer, scopes: [w.a.scope] })).toEqual({ refusal: "request-scope-unoffered" });
    expect(readFleetJoinRequest({ ...w.request, signature: "00".repeat(64) }, w.offer)).toEqual({ refusal: "request-unsigned" });
    // CONTROL: one face-scoped key under two scopes, and a key the reader holds apart.
    const twice = { ...w.request, requests: [w.a.request, w.a.request] };
    expect(readFleetJoinRequest(twice, w.offer)).toMatchObject({ refusal: "request-scope-twice" });
    expect(readFleetJoinRequest(w.request, w.offer, [w.a.request.vesselFaceKey])).toMatchObject({ refusal: "request-key-reused" });
    expect(readFleetJoinRequest(w.request, w.offer, [w.joinee.key])).toEqual({ refusal: "request-key-reused" });
  });

  test("the atom signs the request; another key cannot speak for it", async () => {
    const w = await world();
    const body = { nonce: w.request.nonce, atomKey: w.joinee.key, sealKey: w.request.sealKey, requests: w.request.requests };
    const honest = { kind: "fleet-join-request", ...body, signature: await signHex(fleetJoinRequestImage(body), w.joinee) };
    expect(readFleetJoinRequest(honest, w.offer)).toEqual(honest);
    const forged = { ...honest, signature: await signHex(fleetJoinRequestImage(body), w.root) };
    expect(readFleetJoinRequest(forged, w.offer)).toEqual({ refusal: "request-unsigned" });
  });

  test("an answer verifies under the root, carries one certificate and one grant per scope, and opens the secret", async () => {
    const w = await world();
    const verified = read(w, JSON.parse(JSON.stringify(w.answer)));
    if ("refusal" in verified) throw new Error(verified.refusal);
    expect(Array.from(verified.addressSecret)).toEqual(Array.from(SECRET));
    expect(verified.answer.carriage.gatePin).toEqual(PIN);
    expect(verified.answer.certificates.map((c) => c.scope.nexus).sort()).toEqual(["nexus-a.synthetic", "nexus-b.synthetic"]);
    expect(readFaceKeyGrant(verified.answer.grants[0], w.root.key)?.scope).toEqual(w.a.scope);
  });

  test("THE PIN AND THE CANON RIDE SIGNED: moving either, or the edge, refuses the answer", async () => {
    const w = await world();
    // A moved pin no longer answers the face admit's commitment; moved with an admit committed to it, the root never signed it.
    expect(read(w, { ...w.answer, carriage: { ...w.answer.carriage, gatePin: sovereignPinAt(HEARTH_NEXUS, 6) } })).toEqual({ refusal: "answer-admit-other-commit" });
    expect(read(w, { ...w.answer, carriage: { ...w.answer.carriage, gatePin: { ...PIN, signingKey: sovereignPinAt(HEARTH_NEXUS, 6).signingKey } } })).toEqual({ refusal: "answer-admit-other-commit" });
    const moved = { ...w.answer.carriage, gatePin: sovereignPinAt(HEARTH_NEXUS, 6) };
    expect(read(w, { ...w.answer, carriage: moved, admit: faceAdmitOver(moved, w.a.scope.faceKey) })).toEqual({ refusal: "answer-unsigned" });
    // The pin is the full sovereign sync pin AT the island the answer names: a bare key, or a pin at another Nexus, refuses.
    expect(read(w, { ...w.answer, carriage: { ...w.answer.carriage, gatePin: "cd".repeat(32) } })).toEqual({ refusal: "answer-malformed" });
    expect(read(w, { ...w.answer, carriage: { ...w.answer.carriage, gatePin: sovereignPinAt("nexus-elsewhere.synthetic", 5) } })).toEqual({ refusal: "answer-pin-other-nexus" });
    expect(read(w, { ...w.answer, carriage: { ...w.answer.carriage, canon: { "@lares": "automerge:other" } } })).toEqual({ refusal: "answer-admit-other-commit" });
    expect(read(w, { ...w.answer, edge: { kind: "device-admit/v1", deviceEdge: "swapped" } })).toEqual({ refusal: "answer-unsigned" });
    expect(read(w, { ...w.answer, reach: { ...w.answer.reach, syncUrl: "ws://elsewhere.synthetic" } })).toEqual({ refusal: "answer-unsigned" });
    // CONTROL: the right answer under another root refuses; under its own root it reads.
    expect(read(w, w.answer, (await pair("another root")).key)).toEqual({ refusal: "answer-unsigned" });
    expect("answer" in read(w)).toBe(true);
  });

  test("a certificate over a key the request never asked for, a missing one, or a missing grant refuses", async () => {
    const w = await world();
    const stranger = await pair("fleet stranger vessel");
    const borrowed: VesselFaceCertificate = { scope: w.a.scope, vesselFaceKey: stranger.key as never,
      signature: await signHex(certificateImage(w.a.scope, stranger.key as never), w.a.face) };
    expect(read(w, { ...w.answer, certificates: [borrowed, w.b.certificate] })).toEqual({ refusal: "certificate-refused" });
    expect(read(w, { ...w.answer, certificates: [w.a.certificate] })).toEqual({ refusal: "certificate-missing" });
    expect(read(w, { ...w.answer, grants: [w.answer.grants[0]] })).toEqual({ refusal: "grant-missing" });
    const forged = { ...w.answer.grants[0]!, signature: await signHex(faceKeyGrantImage(GROUP, w.a.scope), w.joinee) };
    expect(read(w, { ...w.answer, grants: [forged, w.answer.grants[1]] })).toEqual({ refusal: "grant-refused" });
  });

  test("the secret opens under the request's own seal key alone, and an answer to another request refuses", async () => {
    const w = await world();
    const otherSeal = new Uint8Array(32).fill(3);
    expect(readFleetJoinAnswer(w.answer, { request: w.request, personaGroup: GROUP, rootKey: w.root.key, sealSecret: otherSeal })).toEqual({ refusal: "seal-secret-other" });
    expect(readFleetJoinAnswer(w.answer, { request: w.request, personaGroup: GROUP, rootKey: w.root.key, sealSecret: new Uint8Array(5) })).toEqual({ refusal: "seal-secret-other" });
    expect(readFleetJoinAnswer(w.answer, { request: { ...w.request, nonce: "ef".repeat(32) }, personaGroup: GROUP, rootKey: w.root.key, sealSecret: w.seal.secret }))
      .toEqual({ refusal: "answer-other-request" });
    expect(readFleetJoinAnswer(w.answer, { request: w.request, personaGroup: "0123456789abcdef", rootKey: w.root.key, sealSecret: w.seal.secret }))
      .toEqual({ refusal: "answer-other-request" });
  });

  // ── The review's vectors: each one goes green only while its check stands. ──

  const signRequest = async (w: World, body: Omit<FleetJoinRequest, "kind" | "signature">, by: Pair = w.joinee): Promise<FleetJoinRequest> =>
    ({ kind: "fleet-join-request", ...body, signature: await signHex(fleetJoinRequestImage(body), by) });
  const asking = async (scope: FaceScope, by: Pair): Promise<VesselFaceCertificateRequest> =>
    ({ scope, vesselFaceKey: by.key as VesselFaceKey, signature: await signHex(certificateRequestImage(scope, by.key as VesselFaceKey), by) });
  const body = (w: World) => ({ nonce: w.request.nonce, atomKey: w.request.atomKey, sealKey: w.request.sealKey, requests: w.request.requests });
  /** The answer re-signed by the root after `change`, so only the check under test can refuse it. */
  const resigned = async (w: World, change: Partial<FleetJoinAnswer>, by: Pair = w.root): Promise<FleetJoinAnswer> => {
    const a = { ...w.answer, ...change };
    return { ...a, signature: await signHex(fleetJoinAnswerImage(a), by) };
  };

  test("KEYS STAND APART ACROSS SCOPES: a face-scoped key at one Nexus that serves as the face key at another, or repeats, refuses", async () => {
    const w = await world();
    const crossed = await signRequest(w, { ...body(w), requests: [await asking(w.a.scope, w.b.face), w.b.request] });
    expect(readFleetJoinRequest(crossed, w.offer)).toEqual({ refusal: "request-key-reused" });
    const repeated = await signRequest(w, { ...body(w), requests: [w.a.request, await asking(w.b.scope, w.a.vessel)] });
    expect(readFleetJoinRequest(repeated, w.offer)).toEqual({ refusal: "request-key-reused" });
    const asVessel = await signRequest(w, { ...body(w), requests: [w.a.request, await asking(w.b.scope, w.joinee)] });
    expect(readFleetJoinRequest(asVessel, w.offer)).toEqual({ refusal: "request-key-reused" });
    const vesselIsFace = await signRequest(w, { ...body(w), atomKey: w.a.face.key }, w.a.face);
    expect(readFleetJoinRequest(vesselIsFace, w.offer)).toEqual({ refusal: "request-key-reused" });
    const vesselIsRoot = await signRequest(w, { ...body(w), atomKey: w.root.key }, w.root);
    expect(readFleetJoinRequest(vesselIsRoot, w.offer)).toEqual({ refusal: "request-key-reused" });
    // CONTROL: the honest request, re-signed by the same helper, reads.
    expect(readFleetJoinRequest(await signRequest(w, body(w)), w.offer)).toMatchObject({ kind: "fleet-join-request" });
  });

  test("an offer refuses one face key at two Nexus, the root as a face key, past its bound, or a short PersonaGroup", async () => {
    const w = await world();
    // CONTROL: a face standing at no Nexus yet offers no scope, and still joins a vessel.
    expect(readFleetJoinOffer({ ...w.offer, scopes: [] })).toMatchObject({ scopes: [] });
    expect(() => fleetJoinOffer({ personaGroup: GROUP, rootKey: w.root.key, nonce: NONCE, scopes: [w.a.scope, { ...w.b.scope, faceKey: w.a.scope.faceKey }] })).toThrow(/offer-malformed/);
    expect(() => fleetJoinOffer({ personaGroup: GROUP, rootKey: w.a.face.key, nonce: NONCE, scopes: [w.a.scope] })).toThrow(/offer-malformed/);
    expect(readFleetJoinOffer({ ...w.offer, rootKey: "00".repeat(32) })).toEqual({ refusal: "offer-malformed" });
    const many = await Promise.all(Array.from({ length: 65 }, (_, i) => pair(`bound ${i}`)));
    expect(() => fleetJoinOffer({ personaGroup: GROUP, rootKey: w.root.key, nonce: NONCE, scopes: many.map((p, i) => ({ faceKey: p.key, nexus: `n${String(i).padStart(3, "0")}.synthetic` }) as FaceScope) })).toThrow(/offer-malformed/);
    expect(readFleetJoinOffer({ ...w.offer, scopes: [w.a.scope, w.a.scope] })).toEqual({ refusal: "offer-malformed" });
    expect(readFleetJoinOffer({ ...w.offer, personaGroup: "c0ff" })).toEqual({ refusal: "offer-malformed" });
    // CONTROL: the group's own id spelling, `0x` and all, reads.
    expect(readFleetJoinOffer({ ...w.offer, personaGroup: `0x${GROUP}` })).toMatchObject({ personaGroup: `0x${GROUP}` });
  });

  test("a request refuses a low-order seal key, and may take no scope at all", async () => {
    const w = await world();
    expect(readFleetJoinRequest(await signRequest(w, { ...body(w), requests: [] }), w.offer)).toMatchObject({ requests: [] });
    expect(readFleetJoinRequest(await signRequest(w, { ...body(w), sealKey: "00".repeat(32) }), w.offer)).toEqual({ refusal: "request-malformed" });
  });

  test("THE ROOT STANDS APART: an answer read under the joinee's own key or one of its face keys refuses", async () => {
    const w = await world();
    const byJoinee = await resigned(w, {}, w.joinee);
    expect(read(w, byJoinee, w.joinee.key)).toEqual({ refusal: "answer-root-reused" });
    expect(read(w, await resigned(w, {}, w.a.vessel), w.a.vessel.key)).toEqual({ refusal: "answer-root-reused" });
    expect(read(w, await resigned(w, {}, w.a.face), w.a.face.key)).toEqual({ refusal: "answer-root-reused" });
  });

  test("THE SECRET BINDS TO THE NONCE AND THE VESSEL: one sealed for another request refuses though the root signed it", async () => {
    const w = await world();
    const otherNonce = sealAddressSecret({ secret: SECRET, request: { ...w.request, nonce: "ef".repeat(32) } });
    expect(read(w, await resigned(w, { secret: otherNonce }))).toEqual({ refusal: "secret-unopened" });
    const otherVessel = sealAddressSecret({ secret: SECRET, request: { ...w.request, atomKey: w.a.vessel.key } });
    expect(read(w, await resigned(w, { secret: otherVessel }))).toEqual({ refusal: "secret-unopened" });
    const box = sealToRecipient({ recipientPub: hexToBytes(w.seal.key), plaintext: new Uint8Array(31), info: utf8Bytes(FLEET_JOIN_SECRET_INFO),
      extraSalt: [hexToBytes(NONCE), hexToBytes(w.joinee.key)] });
    const short = { epk: hex(box.senderEphemeralPub), nonce: hex(box.aeadNonce), ciphertext: hex(box.ciphertext) };
    expect(read(w, await resigned(w, { secret: short }))).toEqual({ refusal: "secret-unopened" });
    expect(read(w, { ...w.answer, atomKey: w.a.vessel.key })).toEqual({ refusal: "answer-other-request" });
    // CONTROL: the true seal, re-signed alike, opens.
    expect("answer" in read(w, await resigned(w, {}))).toBe(true);
  });

  test("a duplicate or forged certificate, and a duplicate, unrequested or other-face grant, refuse", async () => {
    const w = await world();
    expect(read(w, { ...w.answer, certificates: [w.a.certificate, w.a.certificate, w.b.certificate] })).toEqual({ refusal: "certificate-refused" });
    const forged = { ...w.a.certificate, signature: await signHex(certificateImage(w.a.scope, w.a.certificate.vesselFaceKey), w.b.face) };
    expect(read(w, { ...w.answer, certificates: [forged, w.b.certificate] })).toMatchObject({ refusal: "certificate-refused" });
    const [ga, gb] = w.answer.grants;
    expect(read(w, { ...w.answer, grants: [ga, ga, gb] })).toEqual({ refusal: "grant-refused" });
    const c = await chain("fleet face c", "nexus-c.synthetic");
    const unrequested = { personaGroup: GROUP, scope: c.scope, signature: await signHex(faceKeyGrantImage(GROUP, c.scope), w.root) };
    expect(read(w, { ...w.answer, grants: [ga, gb, unrequested] })).toEqual({ refusal: "grant-refused" });
    const otherFace = { personaGroup: "0123456789abcdef", scope: w.a.scope, signature: await signHex(faceKeyGrantImage("0123456789abcdef", w.a.scope), w.root) };
    expect(read(w, { ...w.answer, grants: [otherFace, gb] })).toEqual({ refusal: "grant-refused" });
    expect(readFaceKeyGrant(ga, w.joinee.key)).toBeNull();
    expect(readFaceKeyGrant(ga, "not a key")).toBeNull();
    expect(readFaceKeyGrant(null, w.root.key)).toBeNull();
    expect(readFaceKeyGrant(ga, w.root.key)).toEqual(ga);
  });

  test("THE EDGE HANDED ON MATCHES THE EDGE DIGESTED: a frozen canonical copy, and an oversized edge refuses", async () => {
    const w = await world();
    let reads = 0;
    const shifting = { kind: "device-admit/v1", get deviceEdge() { reads += 1; return reads === 1 ? "synthetic" : "swapped"; }, hearthTrueName: HEARTH_NEXUS };
    const verified = read(w, { ...w.answer, edge: shifting });
    if ("refusal" in verified) throw new Error(verified.refusal);
    expect(verified.answer.edge).toEqual({ kind: "device-admit/v1", deviceEdge: "synthetic", hearthTrueName: HEARTH_NEXUS });
    expect(Object.isFrozen(verified.answer.edge)).toBe(true);
    expect(read(w, await resigned(w, { edge: { blob: "x".repeat(70000) } }))).toEqual({ refusal: "answer-malformed" });
  });

  test("NONSENSE CONTROLS: nulls, arrays, strings, extra or hidden fields and throwing getters refuse by name", async () => {
    const w = await world();
    for (const junk of [null, [], "fleet", 7]) {
      expect(readFleetJoinOffer(junk)).toEqual({ refusal: "offer-malformed" });
      expect(readFleetJoinRequest(junk, w.offer)).toEqual({ refusal: "request-malformed" });
      expect(read(w, junk)).toEqual({ refusal: "answer-malformed" });
    }
    expect(readFleetJoinRequest({ ...w.request, extra: 1 }, w.offer)).toEqual({ refusal: "request-malformed" });
    expect(read(w, { ...w.answer, extra: 1 })).toEqual({ refusal: "answer-malformed" });
    expect(read(w, { ...w.answer, secret: { ...w.answer.secret, nonce: "00" } })).toEqual({ refusal: "answer-malformed" });
    const hidden = { ...w.offer, extra: 1 } as Record<string, unknown>;
    Object.defineProperty(hidden, "nonce", { value: NONCE, enumerable: false });
    expect(readFleetJoinOffer(hidden)).toEqual({ refusal: "offer-malformed" });
    const throwing = { ...w.offer };
    Object.defineProperty(throwing, "scopes", { get() { throw new Error("boom"); }, enumerable: true });
    expect(readFleetJoinOffer(throwing)).toEqual({ refusal: "offer-malformed" });
    expect(readFleetJoinOffer(JSON.parse(`{"kind":"fleet-join-offer","personaGroup":"${GROUP}","rootKey":"${w.root.key}","nonce":"${NONCE}","scopes":[],"__proto__":{}}`))).toEqual({ refusal: "offer-malformed" });
  });

  test("THE JOINEE COMPOSES ITS REQUEST over its own doors: a key per scope, each request under it, the whole under the vessel key", async () => {
    const w = await world();
    const minted = new Map<string, Pair>();
    let n = 0;
    const doors = {
      mintFaceKey: async (scope: FaceScope) => { const p = await pair(`composed ${n++}`); minted.set(p.key, p); void scope; return p.key; },
      custody: { signAsVesselFace: (_s: FaceScope, key: string, image: Uint8Array) => ed25519.signAsync(image, minted.get(key)!.secret) },
      sign: async (image: Uint8Array) => signHex(image, w.joinee),
    };
    const seal = fleetJoinSealPair();
    expect(seal.key).toBe(hex(x25519.getPublicKey(seal.secret)));
    const request = await composeFleetJoinRequest({ offer: w.offer, atomKey: w.joinee.key, sealKey: seal.key, ...doors });
    if ("refusal" in request) throw new Error(request.refusal);
    expect(request.requests.map((q) => q.scope)).toEqual(w.offer.scopes);
    expect(new Set(request.requests.map((q) => q.vesselFaceKey)).size).toBe(w.offer.scopes.length);
    expect(readFleetJoinRequest(JSON.parse(JSON.stringify(request)), w.offer)).toEqual(request);
    // A custody door that signs under another key refuses before the request exists.
    const astray = { signAsVesselFace: (_s: FaceScope, _k: string, image: Uint8Array) => ed25519.signAsync(image, w.joinee.secret) };
    expect(await composeFleetJoinRequest({ offer: w.offer, atomKey: w.joinee.key, sealKey: seal.key, ...doors, custody: astray }))
      .toMatchObject({ refusal: "certificate-request-refused" });
    // A vessel signature under another key reads back refused, so it never leaves the vessel.
    expect(await composeFleetJoinRequest({ offer: w.offer, atomKey: w.joinee.key, sealKey: seal.key, ...doors, sign: async (image) => signHex(image, w.root) }))
      .toEqual({ refusal: "request-unsigned" });
  });
});

/**
 * THE PIN STANDS AT THE HEARTH'S NEXUS. The hearth pins the Nexus its own sync gate stands at, which its device edge names
 * as the hearth's true name (`hearthTrueName`). An island standing names another scope for an `anchor` (a gate key) or
 * an `explicit` call, so the reader holds the pin to the edge's true name wherever the answer carries one, and to a
 * `charter` island's genesis otherwise; an island scope of any other kind never decides it.
 */
describe("the answer's pin stands at the Nexus the answer names", () => {
  const resign = async (w: World, change: Partial<FleetJoinAnswer>): Promise<FleetJoinAnswer> => {
    const a = { ...w.answer, ...change };
    return { ...a, signature: await signHex(fleetJoinAnswerImage(a), w.root) };
  };
  const edgeAt = (nexus: string) => ({ kind: "device-admit/v1", deviceEdge: "synthetic", hearthTrueName: nexus });

  test("RED: an anchor standing names a gate key; the pin at the edge's true name reads", async () => {
    const w = await world();
    const answer = await resign(w, { edge: edgeAt(HEARTH_NEXUS), reach: { ...w.answer.reach, islandKind: "anchor", islandScope: "ab".repeat(32) } });
    expect("answer" in read(w, answer)).toBe(true);
  });

  test("RED: with no island scope, a pin at another Nexus than the edge's true name refuses by name", async () => {
    const w = await world();
    const answer = await resign(w, { edge: edgeAt("nexus-elsewhere.synthetic"), reach: { ...w.answer.reach, islandKind: null, islandScope: null } });
    expect(read(w, answer)).toEqual({ refusal: "answer-pin-other-nexus" });
  });

  test("RED: an answer that names no Nexus at all (no true name, no charter island) refuses answer-nexus-absent", async () => {
    const w = await world();
    const bare = { kind: "device-admit/v1", deviceEdge: "synthetic" };
    // Every Nexus-bound check (the pin's Nexus, the floor pins' Nexus, the admit's face) would otherwise read nothing.
    for (const reach of [
      { ...w.answer.reach, islandKind: "anchor" as const, islandScope: "ab".repeat(32) },
      { ...w.answer.reach, islandKind: null, islandScope: null },
      { ...w.answer.reach, islandKind: "explicit" as const, islandScope: HEARTH_NEXUS },
    ]) {
      expect(read(w, await resign(w, { edge: bare, reach }))).toEqual({ refusal: "answer-nexus-absent" });
    }
    // CONTROL: the same bare edge under a charter island at the pin's Nexus reads.
    expect("answer" in read(w, await resign(w, { edge: bare, reach: { ...w.answer.reach, islandKind: "charter", islandScope: HEARTH_NEXUS } }))).toBe(true);
  });

  test("RED: a charter island's genesis holds the pin when the edge names no true name", async () => {
    const w = await world();
    const bare = { kind: "device-admit/v1", deviceEdge: "synthetic" };
    const elsewhere = await resign(w, { edge: bare, reach: { ...w.answer.reach, islandKind: "charter", islandScope: "nexus-elsewhere.synthetic" } });
    expect(read(w, elsewhere)).toEqual({ refusal: "answer-pin-other-nexus" });
    // CONTROL: the genesis the pin stands at reads.
    const home = await resign(w, { edge: bare, reach: { ...w.answer.reach, islandKind: "charter", islandScope: HEARTH_NEXUS } });
    expect("answer" in read(w, home)).toBe(true);
  });
});

/**
 * The answer carries what the joinee needs to DIAL: the hearth's charter, the face's own admit at the hearth's Nexus (opening
 * over the answer's carriage), and the hearth's floor pins. Each rides the root's signature, and each refuses by name.
 */
describe("the answer carries the dial: the charter, the face's admit and the floor pins", () => {
  const resign = async (w: World, change: Partial<FleetJoinAnswer>): Promise<FleetJoinAnswer> => {
    const a = { ...w.answer, ...change };
    return { ...a, signature: await signHex(fleetJoinAnswerImage(a), w.root) };
  };

  test("CONTROL: the charter, the admit and the floor pins read back as carried", async () => {
    const w = await world();
    const verified = read(w, JSON.parse(JSON.stringify(w.answer)));
    if ("refusal" in verified) throw new Error(verified.refusal);
    expect(verified.answer.charter).toBe(CHARTER_TEXT);
    expect(verified.answer.admit.admit.nym).toBe(w.a.scope.faceKey);
    expect(verified.answer.floorPins).toEqual([floorPinAt(HEARTH_NEXUS)]);
  });

  test("RED: a moved charter, admit, lineage or floor pin refuses unsigned", async () => {
    const w = await world();
    expect(read(w, { ...w.answer, charter: "another charter" })).toEqual({ refusal: "answer-unsigned" });
    expect(read(w, { ...w.answer, admit: { ...w.answer.admit, admit: { ...w.answer.admit.admit, parents: ["moved"] } } })).toEqual({ refusal: "answer-unsigned" });
    expect(read(w, { ...w.answer, admit: { ...w.answer.admit, lineage: [w.answer.admit.admit] } })).toEqual({ refusal: "answer-unsigned" });
    expect(read(w, { ...w.answer, floorPins: [floorPinAt(HEARTH_NEXUS, "/oracle", 9)] })).toEqual({ refusal: "answer-unsigned" });
    expect(read(w, { ...w.answer, floorPins: [] })).toEqual({ refusal: "answer-unsigned" });
  });

  test("RED: an admit the root signed over another carriage, or for another face, refuses by name", async () => {
    const w = await world();
    const other = { ...w.answer.carriage, canon: { "@lares": "automerge:elsewhere" } };
    expect(read(w, await resign(w, { admit: faceAdmitOver(other, w.a.scope.faceKey) }))).toEqual({ refusal: "answer-admit-other-commit" });
    expect(read(w, await resign(w, { admit: faceAdmitOver(w.answer.carriage, w.b.scope.faceKey) }))).toEqual({ refusal: "answer-admit-other-face" });
    expect(read(w, await resign(w, { admit: { ...w.answer.admit, salt: "zz" } }))).toEqual({ refusal: "answer-malformed" });
  });

  test("RED: a floor pin of the sovereign tier, at another Nexus, or twice on one route refuses by name", async () => {
    const w = await world();
    expect(read(w, await resign(w, { floorPins: [PIN] }))).toEqual({ refusal: "answer-floor-pin-refused" });
    expect(read(w, await resign(w, { floorPins: [floorPinAt("nexus-elsewhere.synthetic")] }))).toEqual({ refusal: "answer-floor-pin-refused" });
    expect(read(w, await resign(w, { floorPins: [floorPinAt(HEARTH_NEXUS), floorPinAt(HEARTH_NEXUS, "/oracle", 9)] }))).toEqual({ refusal: "answer-floor-pin-refused" });
    // CONTROL: two routes read.
    expect("answer" in read(w, await resign(w, { floorPins: [floorPinAt(HEARTH_NEXUS), floorPinAt(HEARTH_NEXUS, "/shelf")] }))).toBe(true);
  });

  test("RED: an answer missing the charter, the admit or the floor pins is malformed", async () => {
    const w = await world();
    for (const key of ["charter", "admit", "floorPins"] as const) {
      const { [key]: _gone, ...rest } = w.answer;
      expect(read(w, rest)).toEqual({ refusal: "answer-malformed" });
    }
  });
});
