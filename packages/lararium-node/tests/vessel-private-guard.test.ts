/**
 * vessel-private-guard — NO RELATION, REGISTRATION OR ALIAS WIDENS WHO READS A VESSEL'S PRIVATE DOCUMENTS (lane `ralias`,
 * on P26's one guard).
 *
 * The finding (Sol, measured from source during K20): a realm registration names its book by `docUrl` alone, and the fold
 * asks only that each kept steward sealed it. A realm member who seals a registration naming ANOTHER vessel's daemon
 * document (or a face plane, or its catalog) makes that vessel's own realm gate hold the document as a registered book, so
 * the realm lanes (the write side, CONTRACT, the Nexus lane, the carrier leg) open it to her.
 *
 * The cure rides the one guard (controller ruling at P26: one guard, named classes): a `vessel-private` class keyed by id
 * (the daemon document, every face's five planes, the catalog), classed off the vessel's own bootstrap and catalog pointer,
 * never a title or a registration. A classed document crosses only where a proven relation already opens it: the same-face
 * view of the session's own face, a sibling of the face, a face-join grant on the face's own planes. Defence in depth: the
 * fold refuses a registration whose `docUrl` names a classed id.
 *
 *   V0  MEASURE: with today's guard (no vessel-private class), B's lone registration of A's daemon doc crosses to B.
 *   V1  RED: with the class seated, B draws withhold on A's daemon doc, a face plane and the catalog, whatever names them.
 *   V1c CONTROL: an ordinary registered book still crosses to B.
 *   V2  CONTROL: the same-face session still reads the daemon doc, its planes and the catalog; a sibling and a face-join grant
 *       holder still read the face's planes; a session of another face still reads no foreign plane.
 *   V3  RED: the fold refuses a registration naming a classed id; CONTROL: an ordinary one still counts.
 *   V4  RED: the book reads the bootstrap again when it changes, and a class never drops for the run.
 *   V5  RED (Copilot cold read, Q3): a bootstrap torn after a whole read reads `torn` until a whole re-read; CONTROL: an absent
 *       bootstrap, or one torn from the first read, tears nothing.
 *   V6  RED (Sonnet cold read, Q3): every growth of the book fires `onGrow`; CONTROL: no growth fires nothing.
 *   V7  RED (the train's Sol read, MEASURED HIGH): with two bootstrap faces, face A's session reads face B's circles plane
 *       once an ordinary catalog row points at it (the worn face's bridge admits the alias). OWNERSHIP decides first: a
 *       vessel-private id carries its owning face (the vessel's own for the daemon doc and catalog, read as the worn face),
 *       and crosses only to a peer proven as that face. CONTROL: face B's own session still reads its circles; face A still
 *       reads its own planes, the daemon doc and the catalog.
 *   V8  RED: the owner map names each face's five planes by their group and the daemon doc as the vessel's.
 * On the parent the class and the book do not exist, so V1–V4 read red at the missing module.
 */
import { afterAll, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { generateAutomergeUrl, interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, PERSONA_GROUP_ID_TIDDLER, RealmBagGate, deterministicDocUrl, foldRealmBags, hex, personaBagIdFor, personaMembershipEntries,
  personaSiblingBagIds, protectedDocGuard, realmBagRegistrationCounts, signRealmBagRegistration, storedLarRecord, writeRealmBagRegistration,
  type FaceGrantReading, type FederationGate, type LarDoc, type ProtectedDocClass,
} from "@lararium/mesh";
import { faceFleetViews, bridgeBooks } from "../src/face-fleet-view.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

type RelationInput = {
  owner?: string | null; wornFace?: string | null; peerFace?: string | null;
  sibling: boolean; siblingGate: FederationGate | null; sameOperator: boolean; sessionFace: FederationGate | null;
  faceGrant: { admitsPeer(documentId: DocumentId, peerId: PeerId): Promise<boolean> } | null; peerId: string; documentId: string;
};
type VesselPrivateModule = {
  vesselPrivateDocIds(bootstrapTiddlers: Record<string, { text?: string }>): ReadonlySet<string>;
  vesselPrivateBook(opts: { bootstrapPath: string; onGrow?: () => void }): { ids(): ReadonlySet<string>; has(id: string): boolean; add(urlOrId: string | null | undefined): void; torn?(): boolean };
  vesselPrivateRelationOpens(input: RelationInput): Promise<boolean>;
  vesselPrivateOwners?(bootstrapTiddlers: Record<string, { text?: string }>): ReadonlyMap<string, string>;
};
const vp = (await import("../src/vessel-private.js").catch(() => null)) as VesselPrivateModule | null;

const roots: string[] = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

const REALM = "epoch-cid-genesis";
const REALM_URL = deterministicDocUrl("ralias-realm-doc");
const seedA = new Uint8Array(32).fill(7), seedB = new Uint8Array(32).fill(8);
const steward = async (seed: Uint8Array) => ({ signer: hex(await ed.getPublicKeyAsync(seed)), sign: (b: Uint8Array) => ed.signAsync(b, seed).then(hex) });
const idOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

const G1 = "0x" + "11".repeat(16), G2 = "0x" + "22".repeat(16);
const urls = (g: string) => ({ persona: generateAutomergeUrl(), identities: generateAutomergeUrl(), circles: generateAutomergeUrl(), sessions: generateAutomergeUrl(), intents: generateAutomergeUrl(), group: g });
const ONE = urls(G1), TWO = urls(G2);
const DAEMON = generateAutomergeUrl();
const CATALOG = generateAutomergeUrl();
const BOOK = generateAutomergeUrl();                    // an ordinary book A keeps in her catalog
function bootstrap(...faces: Array<ReturnType<typeof urls>>): Record<string, { text?: string }> {
  const out: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: DAEMON }, [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };
  for (const f of faces) {
    for (const e of personaMembershipEntries({ personaGroupId: f.group, url: f.persona })) out[e.title] = { text: e.text ?? undefined };
    const sib = personaSiblingBagIds(personaBagIdFor(f.group));
    out[sib.identities] = { text: f.identities };
    out[sib.circles] = { text: f.circles };
    out[sib.sessions] = { text: f.sessions };
    out[sib.intents] = { text: f.intents };
  }
  return out;
}
const writeBootstrap = (path: string, tiddlers: Record<string, { text?: string }>): void =>
  writeFileSync(path, JSON.stringify({ title: "$:/lararium/social-bootstrap", text: JSON.stringify({ tiddlers }) }));
const catalogDoc = { tiddlers: {
  "lar:///ha.ka.ba/catalog": storedLarRecord("lar:///ha.ka.ba/catalog", { text: CATALOG }, "lararium-seed"),
  "lar:///ha.ka.ba/bags/notes": storedLarRecord("lar:///ha.ka.ba/bags/notes", { text: BOOK }, "alias"),
} } as unknown as LarDoc;

/** A's realm gate over a realm doc carrying `recs`: B's proven contract nym reads the book she keeps (the write side). */
async function realmGateOf(nymB: string, ...recs: Awaited<ReturnType<typeof signRealmBagRegistration>>[]): Promise<RealmBagGate> {
  const doc = { tiddlers: {} } as LarDoc;
  for (const rec of recs) writeRealmBagRegistration(doc, rec);
  const gate = new RealmBagGate({ mayFederate: async () => false }, { holdsCarriagePeer: () => false }, REALM_URL, {
    charter: { contractNymOfPeer: (p) => (p === "peer-B" ? nymB : null), holdsCharter: () => false },
  });
  await gate.refold(doc, REALM);
  return gate;
}
/** B, a realm member, seals ALONE a registration naming `docUrl` (one she does not keep): n-of-n over her own name. */
const aliasOf = async (docUrl: string, bag = "lar:///ha.ka.ba/bags/ford") =>
  signRealmBagRegistration({ realmId: REALM, bagUri: bag, docUrl, readTier: "contract" }, [await steward(seedB)]);

/** One verdict as the composer asks it, the guard seated where the composer seats it. */
const verdict = (o: {
  guard: ReturnType<typeof protectedDocGuard> | null; fed: FederationGate | null; peerClass: "contracted" | "same-operator";
  documentId: string; sessionFace?: FederationGate | null; peerId?: string; sibling?: boolean; siblingGate?: FederationGate | null; hasWsSocket?: boolean;
}) => selfSlotShareDecision({
  hasWsSocket: o.hasWsSocket ?? true, peerClass: o.peerClass, selfSlotFedGate: o.fed, antigenRing: null, membership: null, planeSeal: null,
  peerId: o.peerId ?? "peer-B", documentId: o.documentId as DocumentId, sessionFace: o.sessionFace ?? null, protectedDocs: o.guard,
  ...(o.sibling ? { sibling: true, siblingGate: o.siblingGate ?? null } : {}),
});

/** The guard the composer seats: the vessel-private ids, decided by the relation the peer proved. */
function seatedGuard(ids: ReadonlySet<string>, relation: (peerId: string) => Omit<RelationInput, "peerId" | "documentId">) {
  return protectedDocGuard({
    ids: () => new Map([...ids].map((id) => [id, "vessel-private" as ProtectedDocClass])),
    decide: { ["vessel-private" as ProtectedDocClass]: (peerId: string, documentId: string) => vp!.vesselPrivateRelationOpens({ ...relation(peerId), peerId, documentId }) },
  });
}
const noRelation = () => ({ sibling: false, siblingGate: null, sameOperator: false, sessionFace: null, faceGrant: null });

describe("no relation, registration or alias widens who reads a vessel's private documents", () => {
  test("V0 — MEASURE: with today's guard, B's lone registration of A's daemon doc crosses to B over the realm lane", async () => {
    const nymB = (await steward(seedB)).signer;
    const gate = await realmGateOf(nymB, await aliasOf(DAEMON));
    expect(gate.holdsDoc(idOf(DAEMON)), "the fold seats A's daemon doc as a registered book").toBe(true);
    const todays = protectedDocGuard({ ids: () => new Map(), decide: { "kahu-canon": () => false } });
    expect(await verdict({ guard: todays, fed: gate, peerClass: "contracted", documentId: idOf(DAEMON) })).toBe(true);
  });

  test("V1/V1c — RED: the class withholds A's daemon doc, a face plane and the catalog from B; an ordinary book still crosses", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const nymB = (await steward(seedB)).signer;
    const ids = new Set(vp!.vesselPrivateDocIds(bootstrap(ONE, TWO)));
    ids.add(idOf(CATALOG));
    for (const url of [DAEMON, ONE.persona, ONE.circles, TWO.intents, CATALOG]) {
      expect(ids.has(idOf(url)), `classed: ${url}`).toBe(true);
      const gate = await realmGateOf(nymB, await aliasOf(url));
      expect(gate.holdsDoc(idOf(url)), "the realm gate alone would open it").toBe(true);
      expect(await verdict({ guard: seatedGuard(ids, noRelation), fed: gate, peerClass: "contracted", documentId: idOf(url) }), `V1: ${url}`).toBe(false);
    }
    const book = await realmGateOf(nymB, await aliasOf(BOOK));
    expect(ids.has(idOf(BOOK)), "an ordinary book stays unclassed").toBe(false);
    expect(await verdict({ guard: seatedGuard(ids, noRelation), fed: book, peerClass: "contracted", documentId: idOf(BOOK) }), "V1c").toBe(true);
  });

  test("V2 — CONTROL: the same-face session, a sibling and a face-join grant holder keep what their relation opens", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const tiddlers = bootstrap(ONE, TWO);
    const ids = new Set(vp!.vesselPrivateDocIds(tiddlers));
    ids.add(idOf(CATALOG));
    const views = faceFleetViews(() => tiddlers, () => G1, () => bridgeBooks(catalogDoc));
    views.seat("own-device", { personaGroup: G1 } as FaceGrantReading);
    views.seat("other-face", { personaGroup: G2 } as FaceGrantReading);
    const sameFace = (peerId: string) => ({ ...noRelation(), sameOperator: true, sessionFace: views.gateFor(peerId) });
    for (const url of [DAEMON, ONE.persona, ONE.identities, ONE.circles, ONE.sessions, ONE.intents, CATALOG]) {
      expect(await verdict({ guard: seatedGuard(ids, sameFace), fed: null, peerClass: "same-operator", peerId: "own-device", sessionFace: views.gateFor("own-device"), documentId: idOf(url) }), `the worn face's session reads ${url}`).toBe(true);
    }
    expect(await verdict({ guard: seatedGuard(ids, sameFace), fed: null, peerClass: "same-operator", peerId: "other-face", sessionFace: views.gateFor("other-face"), documentId: idOf(TWO.circles) }), "a carried face reads its own plane").toBe(true);
    expect(await verdict({ guard: seatedGuard(ids, sameFace), fed: null, peerClass: "same-operator", peerId: "other-face", sessionFace: views.gateFor("other-face"), documentId: idOf(ONE.circles) }), "never a foreign plane").toBe(false);
    // A sibling: the sibling gate opens the face's planes (never the daemon doc).
    const planesOfOne = new Set([ONE.persona, ONE.identities, ONE.circles, ONE.sessions, ONE.intents].map((u) => String(idOf(u))));
    const siblingGate: FederationGate = { mayFederate: async (d) => planesOfOne.has(String(d)) };
    const asSibling = () => ({ ...noRelation(), sibling: true, siblingGate });
    expect(await verdict({ guard: seatedGuard(ids, asSibling), fed: null, peerClass: "contracted", hasWsSocket: false, sibling: true, siblingGate, peerId: "sib", documentId: idOf(ONE.circles) }), "a sibling reads the face's plane").toBe(true);
    expect(await verdict({ guard: seatedGuard(ids, asSibling), fed: null, peerClass: "contracted", hasWsSocket: false, sibling: true, siblingGate, peerId: "sib", documentId: idOf(DAEMON) }), "a sibling never reads the daemon doc").toBe(false);
    // A face-join grant holder: the ring opens the face's planes on the fed gate, and the guard lets that relation through.
    const faceGrant = { admitsPeer: async (d: DocumentId, p: PeerId) => p === "joinee" && planesOfOne.has(String(d)) };
    const ringFed: FederationGate = { mayFederate: async (d, p) => (p ? faceGrant.admitsPeer(d, p) : false) };
    const asJoinee = () => ({ ...noRelation(), faceGrant });
    expect(await verdict({ guard: seatedGuard(ids, asJoinee), fed: ringFed, peerClass: "contracted", peerId: "joinee", documentId: idOf(ONE.identities) }), "a grant holder reads the face's plane").toBe(true);
    expect(await verdict({ guard: seatedGuard(ids, asJoinee), fed: { mayFederate: async () => true }, peerClass: "contracted", peerId: "joinee", documentId: idOf(DAEMON) }), "a grant opens no daemon doc, whatever the fed gate says").toBe(false);
  });

  test("V3 — RED: the fold refuses a registration whose docUrl names a classed id; CONTROL: an ordinary one counts", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const ids = new Set(vp!.vesselPrivateDocIds(bootstrap(ONE)));
    const reading = { vesselPrivate: (id: string) => ids.has(id) };
    const alias = await aliasOf(DAEMON);
    const ordinary = await aliasOf(BOOK, "lar:///ha.ka.ba/bags/notes");
    expect(await realmBagRegistrationCounts(alias, REALM), "without the reading the seal alone counts").toBe(true);
    expect(await realmBagRegistrationCounts(alias, REALM, reading as never), "V3: a classed docUrl never counts").toBe(false);
    expect(await realmBagRegistrationCounts(ordinary, REALM, reading as never), "CONTROL: an ordinary book counts").toBe(true);
    const doc = { tiddlers: {} } as LarDoc;
    writeRealmBagRegistration(doc, alias); writeRealmBagRegistration(doc, ordinary);
    const standing = await foldRealmBags(doc, REALM, reading as never);
    expect([...standing.keys()]).toEqual(["lar:///ha.ka.ba/bags/notes"]);
    // A reading that throws refuses (fail closed).
    expect(await realmBagRegistrationCounts(ordinary, REALM, { vesselPrivate: () => { throw new Error("torn"); } } as never)).toBe(false);
  });

  test("V4 — RED: the book re-reads a changed bootstrap, and a class never drops for the run", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const dir = mkdtempSync(join(tmpdir(), "lar-ralias-")); roots.push(dir);
    const path = join(dir, "social-bootstrap.json");
    writeBootstrap(path, bootstrap(ONE));
    const book = vp!.vesselPrivateBook({ bootstrapPath: path });
    expect(book.has(String(idOf(DAEMON))) && book.has(String(idOf(ONE.circles)))).toBe(true);
    expect(book.has(String(idOf(TWO.circles))), "a face the bootstrap does not carry yet").toBe(false);
    book.add(CATALOG);
    expect(book.has(String(idOf(CATALOG))), "the catalog joins by its pointer").toBe(true);
    // A face added while the vessel runs: the next ask classes its planes.
    const grown = bootstrap(ONE, TWO);
    delete grown[DAEMON_BAG_ID];                               // and a rewrite that drops a name drops no class
    writeBootstrap(path, grown);
    const later = Date.now() / 1000 + 5;
    (await import("node:fs")).utimesSync(path, later, later);
    expect(book.has(String(idOf(TWO.circles))), "the new face's plane classes").toBe(true);
    expect(book.has(String(idOf(DAEMON))), "the daemon doc keeps its class").toBe(true);
    // A torn bootstrap keeps every class standing.
    writeFileSync(path, "{\"text\": \"{\\\"tiddl");
    (await import("node:fs")).utimesSync(path, later + 5, later + 5);
    expect(book.has(String(idOf(ONE.persona))) && book.has(String(idOf(CATALOG)))).toBe(true);
  });

  test("V5 — RED: a bootstrap torn after a whole read reads torn until a whole re-read; CONTROL: torn from the first read tears nothing", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const { utimesSync } = await import("node:fs");
    const dir = mkdtempSync(join(tmpdir(), "lar-ralias-torn-")); roots.push(dir);
    const path = join(dir, "social-bootstrap.json");
    writeBootstrap(path, bootstrap(ONE));
    const book = vp!.vesselPrivateBook({ bootstrapPath: path });
    expect(typeof book.torn, "the book reads torn").toBe("function");
    expect(book.torn!()).toBe(false);
    writeFileSync(path, "{\"text\": \"{\\\"tiddl");
    const t = Date.now() / 1000 + 5; utimesSync(path, t, t);
    expect(book.torn!(), "a write that tore mid-way").toBe(true);
    writeBootstrap(path, bootstrap(ONE, TWO)); utimesSync(path, t + 5, t + 5);
    expect(book.torn!(), "a whole re-read clears it").toBe(false);
    expect(book.has(String(idOf(TWO.circles))), "and classes the face that write added").toBe(true);
    // CONTROL: a vessel with no bootstrap, and one torn from its first read (the boot reads it as none), tear nothing.
    expect(vp!.vesselPrivateBook({ bootstrapPath: join(dir, "absent.json") }).torn!()).toBe(false);
    const firstTorn = join(dir, "first-torn.json");
    writeFileSync(firstTorn, "{");
    expect(vp!.vesselPrivateBook({ bootstrapPath: firstTorn }).torn!()).toBe(false);
  });

  test("V6 — RED: the book's growth fires onGrow; CONTROL: no growth, no fire", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const { utimesSync } = await import("node:fs");
    const dir = mkdtempSync(join(tmpdir(), "lar-ralias-grow-")); roots.push(dir);
    const path = join(dir, "social-bootstrap.json");
    writeBootstrap(path, bootstrap(ONE));
    let grew = 0;
    const book = vp!.vesselPrivateBook({ bootstrapPath: path, onGrow: () => { grew++; } });
    const atStand = grew;
    book.add(CATALOG);
    expect(grew, "the catalog's class re-asks").toBe(atStand + 1);
    book.add(CATALOG);
    expect(grew, "CONTROL: an id already classed re-asks nothing").toBe(atStand + 1);
    writeBootstrap(path, bootstrap(ONE, TWO));
    const t = Date.now() / 1000 + 5; utimesSync(path, t, t);
    expect(book.has(String(idOf(TWO.circles)))).toBe(true);
    expect(grew, "a face added at runtime re-asks").toBe(atStand + 2);
    writeBootstrap(path, bootstrap(ONE, TWO)); utimesSync(path, t + 5, t + 5);
    book.ids();
    expect(grew, "CONTROL: a re-read that classes nothing new re-asks nothing").toBe(atStand + 2);
  });

  test("V7 — RED: a catalog alias of face B's circles plane never opens it to face A's session; CONTROL: face B's own peer reads it", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    const tiddlers = bootstrap(ONE, TWO);
    const ids = new Set(vp!.vesselPrivateDocIds(tiddlers));
    ids.add(idOf(CATALOG));
    const owner = (id: string): string | null =>
      [ONE.persona, ONE.identities, ONE.circles, ONE.sessions, ONE.intents].some((u) => String(idOf(u)) === id) ? G1
        : [TWO.persona, TWO.identities, TWO.circles, TWO.sessions, TWO.intents].some((u) => String(idOf(u)) === id) ? G2
        : [DAEMON, CATALOG].some((u) => String(idOf(u)) === id) ? "vessel" : null;
    const aliased = { tiddlers: { ...(catalogDoc.tiddlers as object),
      "lar:///ha.ka.ba/bags/borrowed": storedLarRecord("lar:///ha.ka.ba/bags/borrowed", { text: TWO.circles }, "alias") } } as unknown as LarDoc;
    let catalog: LarDoc = catalogDoc;
    const views = faceFleetViews(() => tiddlers, () => G1, () => bridgeBooks(catalog));
    views.seat("face-a", { personaGroup: G1 } as FaceGrantReading);
    views.seat("face-b", { personaGroup: G2 } as FaceGrantReading);
    const faces: Record<string, string> = { "face-a": G1, "face-b": G2 };
    const guard = protectedDocGuard({
      ids: () => new Map([...ids].map((id) => [id, "vessel-private" as ProtectedDocClass])),
      decide: { ["vessel-private" as ProtectedDocClass]: (peerId: string, documentId: string) => vp!.vesselPrivateRelationOpens({
        ...noRelation(), sameOperator: true, sessionFace: views.gateFor(peerId),
        owner: owner(documentId), wornFace: G1, peerFace: faces[peerId] ?? null, peerId, documentId }) },
    });
    const ask = (peerId: string, url: string) => verdict({ guard, fed: null, peerClass: "same-operator", peerId, sessionFace: views.gateFor(peerId), documentId: idOf(url) });
    expect(await ask("face-a", TWO.circles), "MEASURE: denied with no alias").toBe(false);
    catalog = aliased;
    expect(await views.gateFor("face-a")!.mayFederate(idOf(TWO.circles)), "the bridge alone admits the alias").toBe(true);
    expect(await ask("face-a", TWO.circles), "V7: the alias opens nothing").toBe(false);
    expect(await ask("face-b", TWO.circles), "CONTROL: face B's own peer reads its circles").toBe(true);
    for (const url of [ONE.circles, DAEMON, CATALOG]) expect(await ask("face-a", url), `CONTROL: face A reads ${url}`).toBe(true);
    expect(await ask("face-b", ONE.circles), "never face A's plane").toBe(false);
  });

  test("V8 — RED: the owner map names each face's planes by group and the daemon doc as the vessel's", async () => {
    expect(vp, "vessel-private stands").not.toBeNull();
    expect(typeof vp!.vesselPrivateOwners, "vesselPrivateOwners stands").toBe("function");
    const owners = vp!.vesselPrivateOwners!(bootstrap(ONE, TWO));
    for (const u of [ONE.persona, ONE.identities, ONE.circles, ONE.sessions, ONE.intents]) expect(owners.get(String(idOf(u)))).toBe(G1);
    for (const u of [TWO.persona, TWO.identities, TWO.circles, TWO.sessions, TWO.intents]) expect(owners.get(String(idOf(u)))).toBe(G2);
    expect(owners.get(String(idOf(DAEMON)))).toBe("vessel");
  });
});
