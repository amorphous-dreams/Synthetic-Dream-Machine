/**
 * device-daemon-docs — a per-device daemon document seals by the face that OWNS it, never by the face lit as it announces.
 *
 * The floor's slot (`daemon-slot/<kind>/floor`) seals beside the control document under the vessel's key, lit or not; a
 * group's slot seals under that group's face, and only while it stands lit; an earlier face's documents after an
 * in-process face change wait held, never under the new face's key. A slot the island announces before the control
 * document names it waits held until the control document names its owner. A later entry never re-files a document.
 */
import { describe, expect, test } from "vitest";
import { CONTROL_HOME_ID, daemonFaceCanonBag, deviceDaemonDocs, emptyLarDoc, storedLarRecord, wikiSlotUri, type LarDoc, type LitDeviceFace } from "../src/index.js";

const WORKING = wikiSlotUri("daemon", "working");
const G1 = "group-one", G2 = "group-two";
const F1 = "11111111-1111-4111-8111-111111111111";
const FACE1 = "face-subject-one", FACE2 = "face-subject-two";
const lit = (group: string | null, relation: string | null, face: string | null): LitDeviceFace => ({ group, relation, face });
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
