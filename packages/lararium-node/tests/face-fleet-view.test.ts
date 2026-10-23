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
import { DAEMON_BAG_ID, DeterministicFederationGate, PERSONA_GROUP_ID_TIDDLER, personaBagIdFor, personaMembershipEntries, personaSiblingBagIds, type FaceGrantReading } from "@lararium/mesh";
import { faceFleetFacets, faceFleetViews } from "../src/face-fleet-view.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

const G1 = "0x" + "11".repeat(16), G2 = "0x" + "22".repeat(16);
const urls = (g: string) => ({ persona: generateAutomergeUrl(), identities: generateAutomergeUrl(), circles: generateAutomergeUrl(), sessions: generateAutomergeUrl(), group: g });
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
      ["sessions", ONE.sessions, "plane"], ["daemon", DAEMON, "plane"],
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
    expect(await verdict(idOf(ONE.persona))).toBe(true);
    expect(await verdict(idOf(DAEMON))).toBe(true);
    expect(await verdict(idOf(TWO.circles))).toBe(false);               // RED: another face's book
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

describe("the worn face's books: the bridge until O1", () => {
  const WIKI = generateAutomergeUrl();                                   // a personal-wiki slot doc: no face tags it
  const pinned = { ...bootstrap(ONE, TWO), [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };

  test("the worn face reads the vessel's books and never another face's planes", async () => {
    const views = faceFleetViews(() => pinned);
    views.seat("worn-device", grant(G1));
    const gate = views.gateFor("worn-device")!;
    expect(await gate.mayFederate(idOf(WIKI))).toBe(true);
    expect(await gate.mayFederate(idOf(ONE.circles))).toBe(true);
    for (const theirs of [TWO.persona, TWO.identities, TWO.circles, TWO.sessions]) expect(await gate.mayFederate(idOf(theirs))).toBe(false);
    views.drop("worn-device");
    expect(await gate.mayFederate(idOf(WIKI))).toBe(false);              // a closed view reads nothing
  });

  test("RED: a face carried but not worn reads its own planes alone", async () => {
    const views = faceFleetViews(() => pinned);
    views.seat("other-device", grant(G2));
    const gate = views.gateFor("other-device")!;
    expect(await gate.mayFederate(idOf(TWO.circles))).toBe(true);        // CONTROL: its own book
    expect(await gate.mayFederate(idOf(WIKI))).toBe(false);
    expect(await gate.mayFederate(idOf(ONE.persona))).toBe(false);
    // The worn group the vessel names wins over the bootstrap's pin.
    const switched = faceFleetViews(() => pinned, () => G2);
    switched.seat("other-device", grant(G2));
    expect(await switched.gateFor("other-device")!.mayFederate(idOf(WIKI))).toBe(true);
    switched.seat("worn-device", grant(G1));
    expect(await switched.gateFor("worn-device")!.mayFederate(idOf(WIKI))).toBe(false);
  });

  test("RED: a caller that names no worn face (sealed custody's group, nothing proven yet) opens no bridge, whatever the bootstrap's group text says; CONTROL: the named worn face keeps it", async () => {
    const forged = { ...bootstrap(ONE, TWO), [PERSONA_GROUP_ID_TIDDLER]: { text: G1 } };   // the mutable bootstrap claims G1 is worn
    const unnamed = faceFleetViews(() => forged, () => null);
    unnamed.seat("device", grant(G1));
    expect(await unnamed.gateFor("device")!.mayFederate(idOf(WIKI)), "no custody-named worn face: the vessel's books stay shut").toBe(false);
    expect(await unnamed.gateFor("device")!.mayFederate(idOf(ONE.circles)), "its own planes still read").toBe(true);
    const named = faceFleetViews(() => forged, () => G1);
    named.seat("device", grant(G1));
    expect(await named.gateFor("device")!.mayFederate(idOf(WIKI))).toBe(true);
  });
});
