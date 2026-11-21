/**
 * hearth-daemon-crossing (road row `L4f`) — the hearth lets its face's daemon working slot cross to a session that proved
 * that face, and to no other peer.
 *
 * The daemon wiki's device slots rest in the vessel-only class, which answers every wire peer `false` before any lane reads.
 * Reds: for the working slot of the face a peer's session proved, the vessel-only verdict yields to the lanes, and that
 * face's fleet view lets the document through. Controls: every other vessel-only document, a sibling, a session of another
 * face, a peer with no face and a closed view read nothing.
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import { CONTROL_HOME_ID, DAEMON_BAG_ID, DeterministicFederationGate, deviceDaemonDocs, emptyLarDoc, makeVesselOnlyDocs, personaBagIdFor, personaMembershipEntries, personaSiblingBagIds, storedLarRecord, type FaceGrantReading, type LarDoc } from "@lararium/mesh";
import { faceFleetViews } from "../src/face-fleet-view.js";
import { vesselOnlyClass, vesselOnlyShareVerdict } from "../src/vessel-only-share.js";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";

const G1 = "0x" + "11".repeat(16), G2 = "0x" + "22".repeat(16);
const ISLANDS = new Set(["island"]);
const slot = (group: string, kind = "working") => `${CONTROL_HOME_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;

function hearth() {
  const control = emptyLarDoc();
  for (const [title, id] of Object.entries({ [slot(G1)]: "w1", [slot(G1, "draft")]: "d1", [slot(G2)]: "w2" })) control.tiddlers[title] = storedLarRecord(title, { text: `automerge:${id}` }, "test");
  const device = deviceDaemonDocs({ enrollFloor: () => {} });
  device.readControl(control as LarDoc);
  const docs = vesselOnlyClass({ named: makeVesselOnlyDocs(), held: new Set<string>(), device, catalog: () => undefined });
  /** The verdict as the vessel composes it: the peer's proven face against the group that owns the working slot. */
  const verdict = (peer: string, id: string, face: string | null, opts: { socket?: boolean; sibling?: boolean } = {}) =>
    vesselOnlyShareVerdict(docs, ISLANDS, peer, id, opts.socket ?? true, opts.sibling ?? false, face !== null && device.workingGroupOf(id) === face);
  return { verdict };
}

describe("the vessel-only verdict yields the face's working slot to that face's proven session", () => {
  test("RED: a wire peer whose session proved the face reads past the vessel-only verdict for that face's working slot", () => {
    expect(hearth().verdict("leaf", "w1", G1)).toBeUndefined();
  });

  test("CONTROL: the face's draft slot, another face's working slot, a faceless peer and a sibling stay refused; the house's island still reads", () => {
    const { verdict } = hearth();
    expect(verdict("leaf", "d1", G1)).toBe(false);
    expect(verdict("leaf", "w2", G1)).toBe(false);
    expect(verdict("leaf", "w1", G2)).toBe(false);
    expect(verdict("leaf", "w1", null)).toBe(false);
    expect(verdict("sibling", "w1", G1, { socket: false, sibling: true })).toBe(false);
    expect(verdict("island", "w1", null, { socket: false })).toBe(true);
  });
});

const urls = (g: string) => ({ persona: generateAutomergeUrl(), identities: generateAutomergeUrl(), circles: generateAutomergeUrl(), sessions: generateAutomergeUrl(), intents: generateAutomergeUrl(), group: g });
const ONE = urls(G1), TWO = urls(G2);
const WORKING_ONE = generateAutomergeUrl(), WORKING_TWO = generateAutomergeUrl();
function bootstrap(...faces: Array<ReturnType<typeof urls>>): Record<string, { text?: string }> {
  const out: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: generateAutomergeUrl() } };
  for (const f of faces) {
    for (const e of personaMembershipEntries({ personaGroupId: f.group, url: f.persona })) out[e.title] = e.text ? { text: e.text } : {};
    const sib = personaSiblingBagIds(personaBagIdFor(f.group))!;
    out[sib.identities] = { text: f.identities }; out[sib.circles] = { text: f.circles }; out[sib.sessions] = { text: f.sessions }; out[sib.intents] = { text: f.intents };
  }
  return out;
}
const idOf = (url: string) => interpretAsDocumentId(url as never) as DocumentId;
const grant = (personaGroup: string): FaceGrantReading => ({ personaGroup, faceKey: "fa".repeat(32), nexus: "nexus-a.synthetic", revision: "r" });
const workingOf = (group: string): string | null => (group === G1 ? WORKING_ONE : group === G2 ? WORKING_TWO : null);

describe("a face's fleet view reads that face's daemon working slot", () => {
  test("RED: a session that proved the face reads its working slot through its view", async () => {
    const views = faceFleetViews(() => bootstrap(ONE, TWO), () => G1, undefined, undefined, undefined, workingOf);
    views.seat("leaf", grant(G1));
    expect(await views.gateFor("leaf")!.mayFederate(idOf(WORKING_ONE))).toBe(true);
    views.seat("lit", grant(G2));   // a face the vessel carries beside the worn one reads its own slot
    expect(await views.gateFor("lit")!.mayFederate(idOf(WORKING_TWO))).toBe(true);
  });

  test("RED: through the composed share verdict (the vessel-only class, then the lanes) a same-operator session of the face reads its working slot; CONTROL: a session of another face and a peer with no view read none", async () => {
    const control = emptyLarDoc();
    const w1 = String(idOf(WORKING_ONE));
    control.tiddlers[slot(G1)] = storedLarRecord(slot(G1), { text: WORKING_ONE }, "test");
    const device = deviceDaemonDocs({ enrollFloor: () => {} });
    device.readControl(control as LarDoc);
    const docs = vesselOnlyClass({ named: makeVesselOnlyDocs(), held: new Set<string>(), device, catalog: () => undefined });
    const views = faceFleetViews(() => bootstrap(ONE, TWO), () => G1, undefined, undefined, undefined, workingOf);
    views.seat("leaf", grant(G1)); views.seat("other", grant(G2));
    const verdict = async (peer: string) => vesselOnlyShareVerdict(docs, ISLANDS, peer, w1, true, false, views.faceOf(peer) !== null && device.workingGroupOf(w1) === views.faceOf(peer))
      ?? await selfSlotShareDecision({
        hasWsSocket: true, peerClass: "same-operator", selfSlotFedGate: new DeterministicFederationGate("ab".repeat(32)), antigenRing: NO_BANS, membership: null, planeSeal: null,
        peerId: peer, documentId: idOf(WORKING_ONE), sessionFace: views.gateFor(peer),
        shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
      });
    expect(await verdict("leaf")).toBe(true);
    expect(await verdict("other")).toBe(false);
    expect(await verdict("stranger")).toBe(false);
  });

  test("CONTROL: another face's working slot, a hearth that names none and a closed view read nothing", async () => {
    const views = faceFleetViews(() => bootstrap(ONE, TWO), () => G1, undefined, undefined, undefined, workingOf);
    views.seat("leaf", grant(G1));
    const gate = views.gateFor("leaf")!;
    expect(await gate.mayFederate(idOf(WORKING_TWO))).toBe(false);
    views.drop("leaf");
    expect(await gate.mayFederate(idOf(WORKING_ONE))).toBe(false);
    const bare = faceFleetViews(() => bootstrap(ONE), () => G1);
    bare.seat("leaf", grant(G1));
    expect(await bare.gateFor("leaf")!.mayFederate(idOf(WORKING_ONE))).toBe(false);
  });
});
