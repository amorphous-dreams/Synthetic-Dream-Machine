/**
 * face-fleet-view — D3's narrowest caller: a same-operator session reads its face's documents through that face's
 * scoped view, opened from the PersonaGroup the gate proved and the vessel's bootstrap alone.
 *
 * Proven, each with its control:
 *   · the facets name the face's plane, its three travelling planes and the daemon doc, each in the `plane` layer;
 *     RED: a PersonaGroup the bootstrap carries no plane for has none;
 *   · through the share verdict: a same-operator peer whose session proved face 1 reads face 1's circles plane /
 *     RED: face 2's circles plane, a document of no face, and the same peer with no face view read nothing
 *     beyond the shelf;
 *   · RED: a session with no face opens no view; a dropped peer's view closes and reads nothing;
 *   · THE BRIDGE: the WORN face's session reads the vessel's books (a wiki doc, the catalog) and never another
 *     face's planes / RED: a session of a face the vessel carries but does not wear reads its own planes alone,
 *     never the worn face's books or planes.
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import { DAEMON_BAG_ID, DeterministicFederationGate, PERSONA_GROUP_ID_TIDDLER, personaBagIdFor, personaMembershipEntries, personaSiblingBagIds, type FaceGrantReading , type LarDoc } from "@lararium/mesh";
import { faceFleetFacets, faceFleetViews, bridgeBooks } from "../src/face-fleet-view.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

const G1 = "0x" + "11".repeat(16), G2 = "0x" + "22".repeat(16);
const urls = (g: string) => ({ persona: generateAutomergeUrl(), identities: generateAutomergeUrl(), circles: generateAutomergeUrl(), sessions: generateAutomergeUrl(), intents: generateAutomergeUrl(), group: g });
const ONE = urls(G1), TWO = urls(G2);
const DAEMON = generateAutomergeUrl();
const STRAY = generateAutomergeUrl();

function bootstrap(...faces: Array<ReturnType<typeof urls>>): Record<string, { text?: string }> {
  const out: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: DAEMON } };
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
const idOf = (url: string) => interpretAsDocumentId(url as never) as DocumentId;
const grant = (personaGroup: string): FaceGrantReading => ({ personaGroup, faceKey: "fa".repeat(32), nexus: "nexus-a.synthetic", revision: "r" });
const shelf = new DeterministicFederationGate("ab".repeat(32));

describe("a same-operator session reads its own face's documents", () => {
  test("the facets: the face's four planes and the daemon doc; RED: a group with no plane has none", () => {
    const facets = faceFleetFacets(bootstrap(ONE, TWO), G1)!;
    expect(facets.documents.map((d) => [d.name, d.document, d.layer])).toEqual([
      ["persona", ONE.persona, "plane"], ["identities", ONE.identities, "plane"], ["circles", ONE.circles, "plane"],
      ["sessions", ONE.sessions, "plane"], ["intents", ONE.intents, "plane"], ["daemon", DAEMON, "plane"],
    ]);
    expect(faceFleetFacets(bootstrap(ONE), G2)).toBeNull();
  });

  test("through the share verdict: face 1's session reads face 1's planes, and never face 2's", async () => {
    const views = faceFleetViews(() => bootstrap(ONE, TWO));
    views.seat("device-two", grant(G1));
    const verdict = (documentId: DocumentId, sessionFace = views.gateFor("device-two")) => selfSlotShareDecision({
      hasWsSocket: true, peerClass: "same-operator", selfSlotFedGate: shelf, antigenRing: null, membership: null, planeSeal: null,
      federationPosture: "private", peerId: "device-two", documentId, sessionFace,
    });
    expect(await verdict(idOf(ONE.circles))).toBe(true);
    expect(await verdict(idOf(ONE.intents))).toBe(true);
    expect(await verdict(idOf(ONE.persona))).toBe(true);
    expect(await verdict(idOf(DAEMON))).toBe(true);
    expect(await verdict(idOf(TWO.circles))).toBe(false);               // RED: another face's book
    expect(await verdict(idOf(TWO.intents))).toBe(false);               // RED: another face's intent log
    expect(await verdict(idOf(STRAY))).toBe(false);                     // RED: a document of no face
    expect(await verdict(idOf(ONE.circles), null)).toBe(false);         // RED: the class alone reads no plane
  });

  test("RED: no face opens no view; a dropped peer's view reads nothing", async () => {
    const views = faceFleetViews(() => bootstrap(ONE));
    views.seat("stranger", null);
    expect(views.gateFor("stranger")).toBeNull();
    views.seat("device-two", grant(G1));
    const gate = views.gateFor("device-two")!;
    expect(await gate.mayFederate(idOf(ONE.circles))).toBe(true);
    views.drop("device-two");
    expect(views.gateFor("device-two")).toBeNull();
    expect(await gate.mayFederate(idOf(ONE.circles))).toBe(false);      // a closed view answers nothing
  });
});

describe("the worn face's books: the bridge until O1 (an allow-list the catalog names)", () => {
  const WIKI = generateAutomergeUrl();                                   // a personal-wiki slot doc: no face tags it
  const pinned = { ...bootstrap(ONE, TWO), [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };
  const books = () => new Set([String(idOf(WIKI))]);                     // the catalog names the wiki as a book

  test("the worn face reads the vessel's books and its own planes, and never another face's planes", async () => {
    const views = faceFleetViews(() => pinned, () => G1, books);
    views.seat("worn-device", grant(G1));
    const gate = views.gateFor("worn-device")!;
    expect(await gate.mayFederate(idOf(WIKI))).toBe(true);
    expect(await gate.mayFederate(idOf(ONE.circles))).toBe(true);
    for (const theirs of [TWO.persona, TWO.identities, TWO.circles, TWO.sessions, TWO.intents]) expect(await gate.mayFederate(idOf(theirs))).toBe(false);
    views.drop("worn-device");
    expect(await gate.mayFederate(idOf(WIKI))).toBe(false);              // a closed view reads nothing
  });

  test("RED: a face carried but not worn reads its own planes alone", async () => {
    const views = faceFleetViews(() => pinned, () => G1, books);
    views.seat("other-device", grant(G2));
    const gate = views.gateFor("other-device")!;
    expect(await gate.mayFederate(idOf(TWO.circles))).toBe(true);        // CONTROL: its own book
    expect(await gate.mayFederate(idOf(WIKI))).toBe(false);
    expect(await gate.mayFederate(idOf(ONE.persona))).toBe(false);
    // The worn group the vessel names wins over the bootstrap's pin.
    const switched = faceFleetViews(() => pinned, () => G2, books);
    switched.seat("other-device", grant(G2));
    expect(await switched.gateFor("other-device")!.mayFederate(idOf(WIKI))).toBe(true);
    switched.seat("worn-device", grant(G1));
    expect(await switched.gateFor("worn-device")!.mayFederate(idOf(WIKI))).toBe(false);
  });

  test("RED: no books named opens no bridge; a caller that names none sees only the view", async () => {
    const views = faceFleetViews(() => pinned, () => G1);
    views.seat("worn-device", grant(G1));
    expect(await views.gateFor("worn-device")!.mayFederate(idOf(WIKI))).toBe(false);
    expect(await views.gateFor("worn-device")!.mayFederate(idOf(ONE.circles))).toBe(true);
  });

  test("RED: another face's plane that no catalog row, no bootstrap entry and no list names reads NOTHING across the bridge (read 6: an omission never lets a document in); CONTROL: the catalog's non-face books are allowed", async () => {
    const STRAYED = generateAutomergeUrl();                              // a foreign face's plane document with every name removed
    const sib = personaSiblingBagIds(personaBagIdFor(G2));
    const catalog = { tiddlers: {
      [personaBagIdFor(G2)]: { tiddler: { title: personaBagIdFor(G2), text: TWO.persona } },
      [sib.circles]: { tiddler: { title: sib.circles, text: TWO.circles } },
      [sib.intents]: { tiddler: { title: sib.intents, text: TWO.intents } },
      [personaBagIdFor(G1)]: { tiddler: { title: personaBagIdFor(G1), text: ONE.persona } },
      "lar:///ha.ka.ba/bags/my-wiki": { tiddler: { title: "lar:///ha.ka.ba/bags/my-wiki", text: WIKI } },
    } } as never;
    const allowed = bridgeBooks(catalog);
    expect(allowed.has(String(idOf(WIKI))), "a non-face book").toBe(true);
    // A pointer the vessel's planes stand on (a realm's doc) crosses beside the books; a face-scoped title never does.
    const REALM = generateAutomergeUrl();
    const withRealm = { tiddlers: { ...(catalog as { tiddlers: object }).tiddlers, "lar:///ha.ka.ba/lares/api/realm/doc/nexus-x": { tiddler: { title: "lar:///ha.ka.ba/lares/api/realm/doc/nexus-x", text: REALM } } } } as never;
    expect(bridgeBooks(withRealm).has(String(idOf(REALM))), "a realm's doc pointer").toBe(true);
    expect(bridgeBooks(withRealm).has(String(idOf(TWO.persona))), "CONTROL: a face-scoped row stays out").toBe(false);
    for (const face of [TWO.persona, TWO.circles, TWO.intents, ONE.persona]) expect(allowed.has(String(idOf(face))), "face-scoped rows are never books").toBe(false);
    const onlyWorn = { ...bootstrap(ONE), [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };    // the bootstrap forgets face two
    const views = faceFleetViews(() => onlyWorn, () => G1, () => allowed);
    views.seat("worn", grant(G1));
    const gate = views.gateFor("worn")!;
    expect(await gate.mayFederate(idOf(STRAYED)), "the document no list names").toBe(false);
    expect(await gate.mayFederate(idOf(TWO.circles)), "a catalog row for face two is not a book").toBe(false);
    expect(await gate.mayFederate(idOf(WIKI))).toBe(true);
    expect(await gate.mayFederate(idOf(ONE.circles))).toBe(true);
  });
});

describe("the bridge names the Kahu canon this vessel stands (walk R4: the canon reaches a joined leaf)", () => {
  // The catalog points at the vessel's books; the Kahu realm, never the catalog, registers `@lares` and `@lararium`
  // (one owner per registry). A worn face's session read every book the catalog named and none of the canon, so a
  // seated leaf's wiki faulted on `slot bags/lararium unavailable — the peer answered WITHOUT doc` (measured, w1).
  const WIKI = generateAutomergeUrl(), LARES = generateAutomergeUrl(), LARARIUM = generateAutomergeUrl();
  const catalog = { tiddlers: { "lar:///ha.ka.ba/bags/notes": { tiddler: { title: "lar:///ha.ka.ba/bags/notes", text: WIKI } } } } as unknown as LarDoc;

  test("RED: the books name the catalog's pointers and the canon the realm stands for this vessel", () => {
    const books = bridgeBooks(catalog, { lares: LARES as never, lararium: LARARIUM as never });
    expect(books.has(String(idOf(WIKI)))).toBe(true);
    expect(books.has(String(idOf(LARES)))).toBe(true);
    expect(books.has(String(idOf(LARARIUM)))).toBe(true);
    expect(books.size).toBe(3);
  });

  test("CONTROL: no canon named adds no book; a canon the catalog also points at counts once; a half-stood canon names its half", () => {
    expect([...bridgeBooks(catalog, {})]).toEqual([String(idOf(WIKI))]);
    expect([...bridgeBooks(catalog)]).toEqual([String(idOf(WIKI))]);
    const both = { tiddlers: { ...(catalog as unknown as { tiddlers: Record<string, unknown> }).tiddlers, "lar:///ha.ka.ba/bags/lares": { tiddler: { title: "lar:///ha.ka.ba/bags/lares", text: LARES } } } } as unknown as LarDoc;
    expect(bridgeBooks(both, { lares: LARES as never }).size).toBe(2);
    expect(bridgeBooks(catalog, { lararium: LARARIUM as never }).has(String(idOf(LARARIUM)))).toBe(true);
    expect(bridgeBooks(catalog, { lararium: LARARIUM as never }).has(String(idOf(LARES)))).toBe(false);
  });

  test("through the share verdict: the worn face's session reads the canon the vessel stands; a carried face's session does not", async () => {
    const pinned = { ...bootstrap(ONE, TWO), [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };
    const books = () => bridgeBooks(catalog, { lares: LARES as never, lararium: LARARIUM as never });
    const views = faceFleetViews(() => pinned, () => G1, books);
    views.seat("worn-device", grant(G1));
    views.seat("other-device", grant(G2));
    expect(await views.gateFor("worn-device")!.mayFederate(idOf(LARARIUM))).toBe(true);
    expect(await views.gateFor("other-device")!.mayFederate(idOf(LARARIUM))).toBe(false);
  });
});
