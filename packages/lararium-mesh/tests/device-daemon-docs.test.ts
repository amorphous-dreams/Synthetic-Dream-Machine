/**
 * device-daemon-docs — a per-device daemon document seals by the face that OWNS it, never by the face lit as it announces.
 *
 * The floor's slot (`daemon-slot/<kind>/floor`) seals beside the control document under the vessel's key, lit or not; a
 * group's slot seals under that group's face, and only while it stands lit; an earlier face's documents after an
 * in-process face change wait held, never under the new face's key. A slot the island announces before the control
 * document names it waits held until the control document names its owner. A later entry never re-files a document.
 */
import { describe, expect, test } from "vitest";
import { CONTROL_HOME_ID, daemonFaceCanonBag, deviceDaemonDocs, floorSlotOf, floorSlotTitle, emptyLarDoc, storedLarRecord, wikiSlotUri, type LarDoc, type LitDeviceFace, type LitDeviceFaces } from "../src/index.js";

const WORKING = wikiSlotUri("daemon", "working");
const G1 = "group-one", G2 = "group-two";
const F1 = "11111111-1111-4111-8111-111111111111";
const FACE1 = "face-subject-one", FACE2 = "face-subject-two";
// A set of one (a browser vessel, or one face unlocked): the table reads the lit set whatever its size.
const one = (group: string | null, relation: string | null, face: string | null): LitDeviceFace => ({ group, relation, face });
const lit = (group: string | null, relation: string | null, face: string | null): LitDeviceFaces => [one(group, relation, face)];
const UNLIT = lit(null, null, null);

function control(entries: Record<string, string>): LarDoc {
  const doc = emptyLarDoc();
  for (const [title, id] of Object.entries(entries)) doc.tiddlers[title] = storedLarRecord(title, { text: `automerge:${id}` }, "test");
  return doc as LarDoc;
}
const slot = (group: string, kind = "working") => `${CONTROL_HOME_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;

function table() {
  const floor: Array<[string, string]> = [];
  return { floor, docs: deviceDaemonDocs({ enrollFloor: (documentId, bagId) => { floor.push([documentId, bagId]); } }) };
}

describe("a device daemon document seals by its owner's group, whatever the lit state", () => {
  test("RED: the floor's slot announced while a face stands lit seals under the vessel's key, never under that face", () => {
    const { docs, floor } = table();
    const now = lit(G1, F1, FACE1);
    docs.announced(WORKING, "floor-doc");
    // Announced, not yet named: it waits held (no face), never under the lit face's key.
    expect(docs.bagOf("floor-doc", now)).toEqual({ bagId: WORKING, face: null });
    expect(docs.readControl(control({ [slot("floor")]: "floor-doc" }))).toBe(true);
    expect(floor).toEqual([["floor-doc", WORKING]]);
    // The held homes answer it from here on (the vessel's key); the device table names no face for it.
    expect(docs.bagOf("floor-doc", now)).toBeUndefined();
    expect(docs.docsOf(WORKING, now)).toEqual([]);
  });

  test("RED: a group's slot announced while no face stands lit never files beside the vessel's key; it seals under its group once lit", () => {
    const { docs, floor } = table();
    docs.announced(WORKING, "g1-doc");
    docs.readControl(control({ [slot(G1)]: "g1-doc" }));
    expect(floor).toEqual([]);
    expect(docs.bagOf("g1-doc", UNLIT)).toEqual({ bagId: WORKING, face: null });
    expect(docs.bagOf("g1-doc", lit(G1, F1, FACE1))).toEqual({ bagId: WORKING, face: FACE1 });
  });

  test("RED: after an in-process face change, the earlier face's documents wait held, never under the new face's key", () => {
    const { docs } = table();
    docs.readControl(control({ [slot(G1)]: "g1-doc", [`${CONTROL_HOME_ID}/daemon-canon/${F1}`]: "canon-1" }));
    expect(docs.bagOf("g1-doc", lit(G1, F1, FACE1))).toEqual({ bagId: WORKING, face: FACE1 });
    expect(docs.bagOf("canon-1", lit(G1, F1, FACE1))).toEqual({ bagId: daemonFaceCanonBag(F1), face: FACE1 });
    docs.readControl(control({ [slot(G1)]: "g1-doc", [slot(G2)]: "g2-doc" }));
    const second = lit(G2, null, FACE2);
    expect(docs.bagOf("g1-doc", second)).toEqual({ bagId: WORKING, face: null });
    expect(docs.bagOf("canon-1", second)).toEqual({ bagId: daemonFaceCanonBag(F1), face: null });
    expect(docs.bagOf("g2-doc", second)).toEqual({ bagId: WORKING, face: FACE2 });
    // The bag's document for the island's door is the lit face's alone.
    expect(docs.docsOf(WORKING, second)).toEqual(["g2-doc"]);
  });

  test("a document keeps its first owner: a later entry naming it under another group moves nothing", () => {
    const { docs, floor } = table();
    docs.readControl(control({ [slot(G1)]: "g1-doc" }));
    expect(docs.readControl(control({ [slot("floor")]: "g1-doc", [slot(G2, "draft")]: "g1-doc" }))).toBe(false);
    expect(floor).toEqual([]);
    expect(docs.bagOf("g1-doc", lit(G2, null, FACE2))).toEqual({ bagId: WORKING, face: null });
  });

  test("a canon minted before its first byte files under its own face", () => {
    const { docs } = table();
    expect(docs.canonMinted(daemonFaceCanonBag(F1), "canon-1", F1)).toBe(true);
    expect(docs.has("canon-1")).toBe(true);
    expect(docs.bagOf("canon-1", lit(G1, F1, FACE1))?.face).toBe(FACE1);
  });
});

/**
 * THE LIT SET: `vault unlock --all` opens every face the passphrase answers, and each face's device documents seal under
 * that face's OWN key. The table files a document by its owner within the set, never by another member.
 */
describe("the lit set: each open face's device documents file under their own face", () => {
  const F2 = "22222222-2222-4222-8222-222222222222";
  test("LS1 — lit {h0,h1}: h1's slot and canon file under h1's face, h0's under h0's; neither under the other", () => {
    const { docs } = table();
    docs.readControl(control({ [slot(G1)]: "g1-doc", [slot(G2)]: "g2-doc", [`${CONTROL_HOME_ID}/daemon-canon/${F1}`]: "canon-1", [`${CONTROL_HOME_ID}/daemon-canon/${F2}`]: "canon-2" }));
    const set: LitDeviceFaces = [one(G1, F1, FACE1), one(G2, F2, FACE2)];
    expect(docs.bagOf("g1-doc", set)).toEqual({ bagId: WORKING, face: FACE1 });
    expect(docs.bagOf("g2-doc", set)).toEqual({ bagId: WORKING, face: FACE2 });
    expect(docs.bagOf("canon-1", set)?.face).toBe(FACE1);
    expect(docs.bagOf("canon-2", set)?.face).toBe(FACE2);
    expect(docs.docsOf(WORKING, set).sort()).toEqual(["g1-doc", "g2-doc"]);
  });

  test("LS2 — lit {h0}: h1's documents wait held (null face), never under h0's key; they file under h1 once it lights", () => {
    const { docs } = table();
    docs.readControl(control({ [slot(G1)]: "g1-doc", [slot(G2)]: "g2-doc" }));
    const h0Only: LitDeviceFaces = [one(G1, F1, FACE1)];
    expect(docs.bagOf("g2-doc", h0Only)).toEqual({ bagId: WORKING, face: null });
    expect(docs.docsOf(WORKING, h0Only)).toEqual(["g1-doc"]);
    const both: LitDeviceFaces = [...h0Only, one(G2, F2, FACE2)];
    expect(docs.bagOf("g2-doc", both)).toEqual({ bagId: WORKING, face: FACE2 });
  });

  test("LS3 — lock --face 1 drops h1 from the set: its documents wait held again, h0's keep their face", () => {
    const { docs } = table();
    docs.readControl(control({ [slot(G1)]: "g1-doc", [slot(G2)]: "g2-doc" }));
    const afterLock: LitDeviceFaces = [one(G1, F1, FACE1)];
    expect(docs.bagOf("g1-doc", afterLock)?.face).toBe(FACE1);
    expect(docs.bagOf("g2-doc", afterLock)?.face).toBeNull();
    expect(docs.bagOf("g2-doc", [])?.face).toBeNull();
  });
});

describe("the veil floor's wiki slot seals under the vessel's key (the-veil-ladder#/the-base-model)", () => {
  const GARDEN = wikiSlotUri("garden", "working");
  test("RED V1: a floor wiki slot waits held from its announce, then files as the vessel's own once the control document names it", () => {
    const { docs, floor } = table();
    docs.announced(GARDEN, "garden-floor");
    // Announced and unnamed: held (no face), never clear, with or without a lit face.
    expect(docs.bagOf("garden-floor", UNLIT)).toEqual({ bagId: GARDEN, face: null });
    expect(docs.bagOf("garden-floor", lit(G1, F1, FACE1))).toEqual({ bagId: GARDEN, face: null });
    expect(docs.readControl(control({ [floorSlotTitle("garden", "working")]: "garden-floor" }))).toBe(true);
    expect(floor).toEqual([["garden-floor", GARDEN]]);
    // The held homes answer it (the vessel's key); no face of the lit set ever seals it.
    expect(docs.bagOf("garden-floor", lit(G1, F1, FACE1))).toBeUndefined();
    expect(docs.docsOf(GARDEN, lit(G1, F1, FACE1))).toEqual([]);
    expect(docs.has("garden-floor")).toBe(true);
  });
  test("V1b: a floor-slot row reads its wiki and kind back, and a torn title names none", () => {
    expect(floorSlotOf(floorSlotTitle("my wiki/β", "working"))).toEqual({ slug: "my wiki/β", kind: "working" });
    expect(floorSlotOf(`${CONTROL_HOME_ID}/floor-slot/garden`)).toBeNull();
    expect(floorSlotOf(`${CONTROL_HOME_ID}/daemon-slot/working/floor`)).toBeNull();
  });
});

describe("a veil floor's wiki slot reaches the house's wiki islands; a daemon device slot never does", () => {
  test("RED V1c: floorWiki reads true for an announced or named floor wiki slot, false for every daemon slot and group document", () => {
    const { docs } = table();
    const GARDEN = wikiSlotUri("garden", "working");
    docs.announced(GARDEN, "garden-floor");
    expect(docs.floorWiki("garden-floor"), "announced, not yet named").toBe(true);
    docs.readControl(control({ [floorSlotTitle("garden", "working")]: "garden-floor", [slot("floor")]: "daemon-floor", [slot(G1)]: "group-doc" }));
    expect(docs.floorWiki("garden-floor")).toBe(true);
    expect(docs.floorWiki("daemon-floor"), "the daemon wiki's floor slot stays with the daemon island").toBe(false);
    expect(docs.floorWiki("group-doc")).toBe(false);
    expect(docs.floorWiki("unknown")).toBe(false);
  });

  test("V1d: a floor-minted wiki's CANON row files its document under the wiki's canon bag, as the vessel's own", () => {
    const { docs, floor } = table();
    expect(docs.readControl(control({ [floorSlotTitle("tabs", "canon")]: "tabs-canon" }))).toBe(true);
    expect(floor).toEqual([["tabs-canon", "lar:///ha.ka.ba/bags/tabs"]]);
    expect(docs.floorWiki("tabs-canon"), "the wiki island mounts its canon").toBe(true);
    expect(docs.bagOf("tabs-canon", lit(G1, F1, FACE1)), "no lit face seals it").toBeUndefined();
  });
});
