/**
 * ledger-private-guard — A VESSEL'S EDGE LEDGER CROSSES TO NO WIRE PEER (road `T33`, the class half).
 *
 * The ledger (`edgeLedgerDocUrl(atom key)`) keeps this vessel's roll marks, its frontier pins and its `seen` rows. Its
 * id derives from the atom key, which stands public on the fleet board, and no class guarded it: it fell through to the
 * ordinary lanes. A hand that reaches it writes `rolled/<raise>` and the raise reads answered.
 *
 *   L0  MEASURE (controller ruling F4: both traced lanes plus a wire stranger), with today's guard (the bootstrap's
 *       vessel-private ids, no ledger): the sibling gate's base (`DeterministicFederationGate` over the fleet board) and the
 *       same-face session view leave the ledger shut, and so does a plain wire stranger. A CONTRACTED realm member who
 *       seals a lone registration naming the ledger opens it over the realm lane (lane `ralias`'s shape, on a document
 *       that class never named). So the class lands.
 *   L1  RED: classed under the `device` owner, the ledger withholds on every lane, the realm alias included, and also
 *       where a sibling gate or a same-face view would open it: no relation reaches a document only this device keeps.
 *   L1c CONTROL: the same-face session still reads the face's planes and the daemon doc; a sibling still reads the
 *       face's planes.
 *   L2  RED (the cold read's MEDIUM, controller ruling): ONE function classes every face's ledger whose atom key the vessel
 *       holds at boot (the worn face, each joined face, each face lit later), under the `device` owner; a key it never
 *       held stays unclassed, and an absent key classes nothing.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { generateAutomergeUrl, interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, DeterministicFederationGate, PERSONA_GROUP_ID_TIDDLER, RealmBagGate, deterministicDocUrl, edgeLedgerDocUrl, fleetEdgeBoardDocUrl, hex,
  personaBagIdFor, personaMembershipEntries, personaSiblingBagIds, protectedDocGuard, signRealmBagRegistration, writeRealmBagRegistration,
  type FaceGrantReading, type FederationGate, type LarDoc, type ProtectedDocClass,
} from "@lararium/mesh";
import { faceFleetViews } from "../src/face-fleet-view.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";
import * as vp from "../src/vessel-private.js";

const REALM = "epoch-cid-genesis";
const REALM_URL = deterministicDocUrl("ledger-private-realm-doc");
const NEXUS = "9a".repeat(32);
const FLEET_ROOT = "5c".repeat(32);
const ATOM = "3d".repeat(32);                         // this device's atom key: public on the fleet board
const LEDGER = edgeLedgerDocUrl(ATOM);
const G1 = "0x" + "11".repeat(16);
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;
const seedB = new Uint8Array(32).fill(8);
const steward = async (seed: Uint8Array) => ({ signer: hex(await ed.getPublicKeyAsync(seed)), sign: (b: Uint8Array) => ed.signAsync(b, seed).then(hex) });

const FACE = { persona: generateAutomergeUrl(), identities: generateAutomergeUrl(), circles: generateAutomergeUrl(), sessions: generateAutomergeUrl(), intents: generateAutomergeUrl() };
const DAEMON = generateAutomergeUrl();
function bootstrap(): Record<string, { text?: string }> {
  const out: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: DAEMON }, [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };
  for (const e of personaMembershipEntries({ personaGroupId: G1, url: FACE.persona })) out[e.title] = { text: e.text ?? undefined };
  const sib = personaSiblingBagIds(personaBagIdFor(G1));
  out[sib.identities] = { text: FACE.identities };
  out[sib.circles] = { text: FACE.circles };
  out[sib.sessions] = { text: FACE.sessions };
  out[sib.intents] = { text: FACE.intents };
  return out;
}

/** A's realm gate after B, a contracted member, sealed ALONE a registration naming `docUrl`. */
async function aliasedRealmGate(docUrl: string): Promise<RealmBagGate> {
  const nymB = (await steward(seedB)).signer;
  const doc = { tiddlers: {} } as LarDoc;
  writeRealmBagRegistration(doc, await signRealmBagRegistration({ realmId: REALM, bagUri: "lar:///ha.ka.ba/bags/ford", docUrl, readTier: "contract" }, [await steward(seedB)]));
  const gate = new RealmBagGate({ mayFederate: async () => false }, { holdsCarriagePeer: () => false }, REALM_URL, {
    charter: { contractNymOfPeer: (p) => (p === "peer-B" ? nymB : null), holdsCharter: () => false },
  });
  await gate.refold(doc, REALM);
  return gate;
}

/** The guard as the composer seats it: the book's ids, decided by the vessel-private relation (worn face G1). */
function seatedGuard(book: vp.VesselPrivateBook, relation: { sibling: boolean; siblingGate: FederationGate | null; sameOperator: boolean; sessionFace: FederationGate | null; peerFace: string | null }) {
  return protectedDocGuard({
    ids: () => new Map([...book.ids()].map((id) => [id, "vessel-private" as ProtectedDocClass])),
    decide: { "vessel-private": (peerId, documentId) => vp.vesselPrivateRelationOpens({ owner: book.ownerOf(documentId), wornFace: G1, faceGrant: null, peerId, documentId, ...relation }) },
  });
}
const none = { sibling: false, siblingGate: null, sameOperator: false, sessionFace: null, peerFace: null };

/** The book as the composer stands it: the bootstrap's ids (written to a scratch file), nothing else yet. */
async function bookOf(): Promise<vp.VesselPrivateBook> {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const path = join(mkdtempSync(join(tmpdir(), "lar-ledger-private-")), "social-bootstrap.json");
  writeFileSync(path, JSON.stringify({ title: "$:/lararium/social-bootstrap", text: JSON.stringify({ tiddlers: bootstrap() }) }));
  return vp.vesselPrivateBook({ bootstrapPath: path });
}

describe("a vessel's edge ledger crosses to no wire peer (T33)", () => {
  test("L0 — MEASURE: the sibling gate, the same-face view and a stranger leave the ledger shut; a realm alias opens it", async () => {
    const book = await bookOf();
    const ledger = String(idOf(LEDGER));
    expect(book.has(ledger), "today the ledger stands unclassed").toBe(false);
    // The sibling gate's base, as the composer builds it (`composeSiblings` answers the face's planes alone, else the base).
    const siblingGate = new DeterministicFederationGate(NEXUS, [fleetEdgeBoardDocUrl(FLEET_ROOT)]);
    expect(await selfSlotShareDecision({ hasWsSocket: false, sibling: true, siblingGate, peerClass: undefined, selfSlotFedGate: null, antigenRing: null,
      membership: null, planeSeal: null, peerId: "sib", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, none) }), "the sibling gate").toBe(false);
    // The same-face session's view (`face-fleet-view`).
    const views = faceFleetViews(() => bootstrap(), () => G1, () => new Set<string>());
    views.seat("own-device", { personaGroup: G1 } as FaceGrantReading);
    expect(await selfSlotShareDecision({ hasWsSocket: true, peerClass: "same-operator", sessionFace: views.gateFor("own-device"), selfSlotFedGate: new DeterministicFederationGate(NEXUS),
      antigenRing: null, membership: null, planeSeal: null, peerId: "own-device", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, none) }), "the same-face view").toBe(false);
    // A plain wire stranger, on the deterministic shelf.
    expect(await selfSlotShareDecision({ hasWsSocket: true, peerClass: "contracted", selfSlotFedGate: new DeterministicFederationGate(NEXUS),
      antigenRing: null, membership: null, planeSeal: null, peerId: "stranger", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, none) }), "a stranger").toBe(false);
    // A contracted realm member's lone registration naming the ledger: the realm lane opens it.
    expect(await selfSlotShareDecision({ hasWsSocket: true, peerClass: "contracted", selfSlotFedGate: await aliasedRealmGate(LEDGER),
      antigenRing: null, membership: null, planeSeal: null, peerId: "peer-B", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, none) }), "a realm alias").toBe(true);
    views.close();
  });

  test("L1 — RED: under the device owner the ledger withholds on every lane, whatever a relation's own gate would open", async () => {
    const book = await bookOf();
    book.add(LEDGER, (vp as { DEVICE_OWNER?: string }).DEVICE_OWNER);
    expect(book.ownerOf(String(idOf(LEDGER))), "the ledger's owner").toBe("device");
    const open: FederationGate = { mayFederate: async () => true };
    const lanes: Array<[string, Parameters<typeof selfSlotShareDecision>[0]]> = [
      ["a sibling whose gate opens it", { hasWsSocket: false, sibling: true, siblingGate: open, peerClass: undefined, selfSlotFedGate: null, antigenRing: null, membership: null, planeSeal: null,
        peerId: "sib", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, { ...none, sibling: true, siblingGate: open }) }],
      ["the worn face's session whose view opens it", { hasWsSocket: true, peerClass: "same-operator", sessionFace: open, selfSlotFedGate: null, antigenRing: null, membership: null, planeSeal: null,
        peerId: "own-device", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, { ...none, sameOperator: true, sessionFace: open, peerFace: G1 }) }],
      ["a realm alias", { hasWsSocket: true, peerClass: "contracted", selfSlotFedGate: await aliasedRealmGate(LEDGER), antigenRing: null, membership: null, planeSeal: null,
        peerId: "peer-B", documentId: idOf(LEDGER), protectedDocs: seatedGuard(book, none) }],
    ];
    for (const [what, input] of lanes) expect(await selfSlotShareDecision(input), what).toBe(false);
  });

  test("L1c — CONTROL: the worn face's session reads its planes and the daemon doc; a sibling reads the face's planes", async () => {
    const book = await bookOf();
    book.add(LEDGER, (vp as { DEVICE_OWNER?: string }).DEVICE_OWNER);
    const open: FederationGate = { mayFederate: async () => true };
    for (const url of [DAEMON, FACE.circles]) {
      expect(await selfSlotShareDecision({ hasWsSocket: true, peerClass: "same-operator", sessionFace: open, selfSlotFedGate: null, antigenRing: null, membership: null, planeSeal: null,
        peerId: "own-device", documentId: idOf(url), protectedDocs: seatedGuard(book, { ...none, sameOperator: true, sessionFace: open, peerFace: G1 }) }), `session reads ${url}`).toBe(true);
    }
    expect(await selfSlotShareDecision({ hasWsSocket: false, sibling: true, siblingGate: open, peerClass: undefined, selfSlotFedGate: null, antigenRing: null, membership: null, planeSeal: null,
      peerId: "sib", documentId: idOf(FACE.circles), protectedDocs: seatedGuard(book, { ...none, sibling: true, siblingGate: open }) }), "a sibling reads the face's plane").toBe(true);
  });

  test("L2 — RED: classDeviceLedgers classes every held face's ledger under the device owner, and nothing else", async () => {
    const classDeviceLedgers = (vp as { classDeviceLedgers?: (book: vp.VesselPrivateBook, keys: Iterable<string | null | undefined>) => void }).classDeviceLedgers;
    expect(typeof classDeviceLedgers, "classDeviceLedgers stands").toBe("function");
    const book = await bookOf();
    const worn = ATOM, joined = "4e".repeat(32), lit = "5f".repeat(32), never = "6a".repeat(32);
    classDeviceLedgers!(book, [worn, joined, null, undefined, ""]);
    classDeviceLedgers!(book, [lit]);
    for (const key of [worn, joined, lit]) expect(book.ownerOf(String(idOf(edgeLedgerDocUrl(key)))), `the ledger of ${key.slice(0, 4)}`).toBe("device");
    expect(book.has(String(idOf(edgeLedgerDocUrl(never)))), "a key the vessel never held").toBe(false);
  });
});
