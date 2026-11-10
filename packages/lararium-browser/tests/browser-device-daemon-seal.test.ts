/**
 * browser-device-daemon-seal — the browser files its per-device daemon documents as the node does (operator ruling:
 * idempotent-by-intent and isomorphic-by-intent parity between all vessel types).
 *
 * Both vessels read a document's held bag through one order (`vesselHeldBagOf`: the device table by owner, then the held
 * homes) over one table (`deviceDaemonDocs`). The floor's slot seals under the vessel's key whatever the lit state; a group's
 * slot seals under its own face's key and waits held under any other lit state (never the vessel's key, never another face's);
 * a restart that reads the same control document files every document the same way, and the floor's slot reads back.
 *
 * RED (the browser's former shape): every daemon device slot filed beside the control document under the vessel's key, so a
 * face's daemon memory never sealed under that face.
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  CONTROL_HOME_ID, SealedDocumentStore, bindSecretHomeRest, daemonFaceCanonBag, deviceDaemonDocs, emptyLarDoc, enrollBesideSecretHome, enrollSecretHome,
  mintSecretHomeAddress, mintVesselDocumentId, openSecretHome, storedLarRecord, vesselHeldBagOf, vesselHeldHomes, wikiSlotUri, type LarDoc, type LitDeviceFace,
} from "@lararium/mesh";

const WORKING = wikiSlotUri("daemon", "working");
const G1 = "group-one";
const F1 = "11111111-1111-4111-8111-111111111111";
const FACE1 = "face-subject-one";
const LIT: LitDeviceFace = { group: G1, relation: F1, face: FACE1 };
const UNLIT: LitDeviceFace = { group: null, relation: null, face: null };
const slot = (group: string) => `${CONTROL_HOME_ID}/daemon-slot/working/${encodeURIComponent(group)}`;

/** The browser vessel's composition: its held homes over its rest, its device table enrolling the floor beside them. */
function browserVessel(inner: StorageAdapterInterface) {
  const homes = vesselHeldHomes();
  let repo!: Repo;
  const device = deviceDaemonDocs({ enrollFloor: (documentId, bagId) => { if (!homes.has(documentId)) enrollBesideSecretHome(repo, documentId, bagId); } });
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({ inner, bagOf: (id) => vesselHeldBagOf(device, homes, UNLIT, id) ?? null, sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, waitOverSealed: true, hydrates: false });
  repo = new Repo({ storage: store, network: [] });
  bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id), () => { store.mapMoved(); void store.reseal(); }));
  return { repo, homes, device, bagOf: (id: string, lit: LitDeviceFace) => vesselHeldBagOf(device, homes, lit, id) };
}

function control(entries: Record<string, string>): LarDoc {
  const doc = emptyLarDoc();
  for (const [title, id] of Object.entries(entries)) doc.tiddlers[title] = storedLarRecord(title, { text: `automerge:${id}` }, "test");
  return doc as LarDoc;
}

describe("the browser seals its device daemon documents by owner, as the node does", () => {
  test("RED: the floor's slot seals under the vessel's key, lit or not; a group's slot under its face's key, never the vessel's", async () => {
    const v = browserVessel(memoryAdapter());
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    await enrollSecretHome(v.repo, address);
    // Announced before the control document names them, while a face stands lit: both wait held, neither under the face.
    v.device.announced(WORKING, "floor-slot");
    v.device.announced(WORKING, "group-slot");
    expect(v.bagOf("floor-slot", LIT)).toEqual({ bagId: WORKING, face: null });
    v.device.readControl(control({ [slot("floor")]: "floor-slot", [slot(G1)]: "group-slot", [`${CONTROL_HOME_ID}/daemon-canon/${F1}`]: "canon" }));
    for (const lit of [LIT, UNLIT]) {
      const floor = v.bagOf("floor-slot", lit);
      expect(floor?.held, "the floor's slot seals under the vessel's key").toBeDefined();
      expect(floor?.face).toBeNull();
    }
    expect(v.bagOf("group-slot", LIT)).toEqual({ bagId: WORKING, face: FACE1 });
    expect(v.bagOf("canon", LIT)).toEqual({ bagId: daemonFaceCanonBag(F1), face: FACE1 });
    // Unlit, a group's slot waits held: no face, and never the vessel's key.
    expect(v.bagOf("group-slot", UNLIT)).toEqual({ bagId: WORKING, face: null });
    expect(v.homes.has("group-slot")).toBe(false);
    await v.repo.shutdown();
  });

  test("a restart that reads the same control document files every document the same way, and the floor's slot reads back", async () => {
    const inner = memoryAdapter();
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const floorId = mintVesselDocumentId();
    const doc = control({ [slot("floor")]: floorId, [slot(G1)]: "group-slot" });
    const first = browserVessel(inner);
    await enrollSecretHome(first.repo, address);
    first.device.readControl(doc);
    const floor = first.repo.import<LarDoc>((await import("@automerge/automerge")).save((await import("@automerge/automerge")).from(emptyLarDoc() as never)), { docId: floorId as never });
    floor.change((d) => { d.tiddlers["memory"] = storedLarRecord("memory", { text: "the floor remembers" }, "test"); });
    const before = { floor: first.bagOf(floorId, LIT)?.bagId, group: first.bagOf("group-slot", LIT) };
    await first.repo.flush();
    await first.repo.shutdown();

    const again = browserVessel(inner);
    await openSecretHome(again.repo, address);
    again.device.readControl(doc);
    expect({ floor: again.bagOf(floorId, LIT)?.bagId, group: again.bagOf("group-slot", LIT) }).toEqual(before);
    const reread = await again.repo.find<LarDoc>(`automerge:${floorId}` as never);
    expect(JSON.stringify(reread.doc())).toContain("the floor remembers");
    await again.repo.shutdown();
  });
});

function memoryAdapter(): StorageAdapterInterface & { readonly bytes: Map<string, Uint8Array> } {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    bytes,
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> { return [...bytes].filter(([k]) => starts(k, prefix)).map(([k, data]) => ({ key: k.split("\u0000"), data: Uint8Array.from(data) })); },
    async removeRange(prefix) { for (const k of [...bytes.keys()]) if (starts(k, prefix)) bytes.delete(k); },
  };
}
