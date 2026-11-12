/**
 * browser-device-daemon-seal — the browser files its per-device daemon documents as the node does (operator ruling:
 * idempotent-by-intent and isomorphic-by-intent parity between all vessel types).
 *
 * Both vessels read a document's held bag through one order (`vesselHeldBagOf`: the device table by owner, then the held
 * homes) over one table (`deviceDaemonDocs`). The floor's slot seals under the vessel's key whatever the lit state; a group's
 * slot seals under its own face's key and waits held under any other lit state (never the vessel's key, never another face's);
 * a restart that reads the same registries files every document the same way, and the floor's slot reads back. The floor's
 * slot takes its name in the place's daemon document and seals under the floor's rest key, with no secret home standing.
 *
 * RED (the browser's former shape): every daemon device slot filed beside the control document under the vessel's key, so a
 * face's daemon memory never sealed under that face.
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  CONTROL_HOME_ID, SealedDocumentStore, bindSecretHomeRest, daemonFaceCanonBag, emptyLarDoc, enrollSecretHome,
  floorDaemonSlotTitle, floorRestKey, seedFloorDoor, standFloorKeyOn,
  mintSecretHomeAddress, mintVesselDocumentId, openSecretHome, storedLarRecord, wikiSlotUri, type LarDoc, type LitDeviceFace,
} from "@lararium/mesh";
import { browserDeviceFiling } from "../src/browser-device-filing.js";

const WORKING = wikiSlotUri("daemon", "working");
const G1 = "group-one";
const F1 = "11111111-1111-4111-8111-111111111111";
const FACE1 = "face-subject-one";
const LIT: LitDeviceFace = { group: G1, relation: F1, face: FACE1 };
const UNLIT: LitDeviceFace = { group: null, relation: null, face: null };
const slot = (group: string) => `${CONTROL_HOME_ID}/daemon-slot/working/${encodeURIComponent(group)}`;
/** This browser's floor key, as `standBrowserFloorKey` derives it from its `floor-rest` seed. */
const FLOOR_SEED = new Uint8Array(32).fill(3);
const floorKey = () => floorRestKey(seedFloorDoor(FLOOR_SEED));

/** The browser vessel's composition: its sealed rest over the vessel's OWN filing (`browserDeviceFiling`, which
 *  `openBrowserVessel` composes), so a filing the vessel changes moves this suite with it. */
function browserVessel(inner: StorageAdapterInterface) {
  let repo!: Repo;
  let lit: LitDeviceFace = UNLIT;
  const filing = browserDeviceFiling({ repo: () => repo, litDevices: () => [lit] });
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({ inner, bagOf: (id) => filing.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, waitOverSealed: true, hydrates: false });
  repo = new Repo({ storage: store, network: [] });
  bindSecretHomeRest(repo, filing.secretHomes.rest((id) => store.holdsSealed(id), () => { store.mapMoved(); void store.reseal(); }));
  return {
    repo, homes: filing.secretHomes, device: filing.deviceDocs,
    bagOf: (id: string, face: LitDeviceFace) => { const prior = lit; lit = face; try { return filing.bagOf(id) ?? undefined; } finally { lit = prior; } },
  };
}

function control(entries: Record<string, string>): LarDoc {
  const doc = emptyLarDoc();
  for (const [title, id] of Object.entries(entries)) doc.tiddlers[title] = storedLarRecord(title, { text: `automerge:${id}` }, "test");
  return doc as LarDoc;
}

describe("the browser seals its device daemon documents by owner, as the node does", () => {
  test("RED: the floor's slot seals under the FLOOR's key with no secret home standing, lit or not; a group's slot under its face's key, never the vessel's", async () => {
    const v = browserVessel(memoryAdapter());
    // A VEIL FLOOR: no secret home and no control document stand. The floor's rest key alone stands.
    standFloorKeyOn(v.repo, floorKey());
    // Announced before a registry names them, while a face stands lit: both wait held, neither under the face.
    v.device.announced(WORKING, "floor-slot");
    v.device.announced(WORKING, "group-slot");
    expect(v.bagOf("floor-slot", LIT)).toEqual({ bagId: WORKING, face: null });
    v.device.readFloor(control({ [floorDaemonSlotTitle("working")]: "floor-slot" }));
    for (const lit of [LIT, UNLIT]) {
      const floor = v.bagOf("floor-slot", lit);
      expect([...(floor?.held ?? [])], "the floor's slot seals under the floor's key").toEqual([...floorKey()]);
      expect(floor?.face).toBeNull();
    }
    // A face lands: its secret home mints with a key of its own, and the floor's slot keeps the floor's key.
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    await enrollSecretHome(v.repo, address);
    v.device.readControl(control({ [slot(G1)]: "group-slot", [`${CONTROL_HOME_ID}/daemon-canon/${F1}`]: "canon" }));
    expect([...(v.bagOf("floor-slot", LIT)?.held ?? [])]).toEqual([...floorKey()]);
    expect([...(v.bagOf("floor-slot", LIT)?.held ?? [])], "the floor key differs from the secret home's key").not.toEqual([...address.key]);
    expect([...(v.homes.bagOf(address.controlId)?.held ?? [])]).toEqual([...address.key]);
    expect(v.bagOf("group-slot", LIT)).toEqual({ bagId: WORKING, face: FACE1 });
    expect(v.bagOf("canon", LIT)).toEqual({ bagId: daemonFaceCanonBag(F1), face: FACE1 });
    // Unlit, a group's slot waits held: no face, and never the vessel's key.
    expect(v.bagOf("group-slot", UNLIT)).toEqual({ bagId: WORKING, face: null });
    expect(v.homes.has("group-slot")).toBe(false);
    await v.repo.shutdown();
  });

  test("a restart that reads the same registries files every document the same way, and the floor's slot reads back under the floor's key alone", async () => {
    const inner = memoryAdapter();
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const floorId = mintVesselDocumentId();
    const doc = control({ [slot(G1)]: "group-slot" });
    const daemonDoc = control({ [floorDaemonSlotTitle("working")]: floorId });
    const first = browserVessel(inner);
    standFloorKeyOn(first.repo, floorKey());
    await enrollSecretHome(first.repo, address);
    first.device.readControl(doc);
    first.device.readFloor(daemonDoc);
    const floor = first.repo.import<LarDoc>((await import("@automerge/automerge")).save((await import("@automerge/automerge")).from(emptyLarDoc() as never)), { docId: floorId as never });
    floor.change((d) => { d.tiddlers["memory"] = storedLarRecord("memory", { text: "the floor remembers" }, "test"); });
    const before = { floor: first.bagOf(floorId, LIT)?.bagId, group: first.bagOf("group-slot", LIT) };
    await first.repo.flush();
    await first.repo.shutdown();

    // The restart opens NO secret home before the floor reads: the floor's slot answers the floor's key alone.
    const again = browserVessel(inner);
    standFloorKeyOn(again.repo, floorKey());
    again.device.readFloor(daemonDoc);
    const reread = await again.repo.find<LarDoc>(`automerge:${floorId}` as never);
    expect(JSON.stringify(reread.doc())).toContain("the floor remembers");
    expect([...inner.bytes].some(([key, data]) => key.startsWith(floorId) && new TextDecoder().decode(data).includes("the floor remembers")), "the floor's slot rests sealed, never clear").toBe(false);
    await openSecretHome(again.repo, address);
    again.device.readControl(doc);
    expect({ floor: again.bagOf(floorId, LIT)?.bagId, group: again.bagOf("group-slot", LIT) }).toEqual(before);
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

/**
 * THE LIT SET AT ITS SMALLEST (parity, operator ruling 2026-11-09): the browser vessel files through the node's one table
 * with a set of one. Its lit face's slot seals under that face; a sibling face's slot, which no browser lights, waits held.
 */
describe("the browser's lit set holds one face", () => {
  test("LS-B1 — a set of one files its own face's slot under that face and a sibling's slot held, as the node's table does", () => {
    const vessel = browserVessel(memoryAdapter());
    vessel.device.readControl(control({ [slot(G1)]: "g1-doc", [slot("group-two")]: "g2-doc" }));
    expect(vessel.bagOf("g1-doc", LIT)).toEqual({ bagId: WORKING, face: FACE1 });
    expect(vessel.bagOf("g2-doc", LIT)).toEqual({ bagId: WORKING, face: null });
  });
});
