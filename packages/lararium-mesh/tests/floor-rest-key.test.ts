/**
 * floor-rest-key — the floor's rest key, its split from the secret home's key, and the floor registry's gate
 * (the-veil-ladder#/the-base-model, in-house rulings 6 and 7; operator ruling 2026-11-09 whole on both hosts).
 *
 * The floor stands before any face, so its documents answer a key no secret home keeps: one helper derives it through each
 * host's own door, the held homes keep it apart from the secret home's random key, and the floor's registry (rows of the
 * place's daemon document) passes only where it stands.
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  ALL_DOMAINS, CONTROL_HOME_ID, DAEMON_BAG_ID, FLOOR_REST_KEY_INFO, FLOOR_UNKEYED, FloorUnavailable, VESSEL_LOCKED,
  AutomergeDocStore, CompositeStore, SealedDocumentStore, bindSecretHomeRest, emptyLarDoc, enrollBesideSecretHome, enrollSecretHome,
  floorDaemonSlotTitle, floorKeyStandsOn, floorRegistryOf, floorRestKey, floorSlotTitle, mintHeldRestKey, mintSecretHomeAddress, openHeld,
  sealHeld, seedFloorDoor, standFloorKeyOn, vesselHeldHomes, wikiSlotUri, type FloorKeyRefusal, type LarDoc,
} from "../src/index.js";

const seed = (fill: number) => new Uint8Array(32).fill(fill);
const GARDEN = wikiSlotUri("garden", "working");
const REF = "00".repeat(16);

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const k = (key: StorageKey) => key.join("\u0000");
  return {
    load: async (key) => bytes.get(k(key)),
    save: async (key, data) => { bytes.set(k(key), data); },
    remove: async (key) => { bytes.delete(k(key)); },
    loadRange: async (prefix) => [...bytes].filter(([key]) => key.startsWith(k(prefix))).map(([key, data]) => ({ key: key.split("\u0000"), data }) as Chunk),
    removeRange: async (prefix) => { for (const key of [...bytes.keys()]) if (key.startsWith(k(prefix))) bytes.delete(key); },
  };
}

function heldRepo() {
  const homes = vesselHeldHomes();
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({ inner: memoryAdapter(), bagOf: (id) => homes.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, refuseClearOverSealed: true });
  const repo = new Repo({ storage: store, network: [] });
  let moves = 0;
  bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id), () => { moves++; }));
  return { homes, repo, moves: () => moves };
}

describe("the floor's rest key: one helper, each host's own door", () => {
  test("FK1: the floor's domain stands in the registry, and one door derives one key every time", () => {
    expect(ALL_DOMAINS).toContain(FLOOR_REST_KEY_INFO);
    const asked: string[] = [];
    const door = (info: string) => { asked.push(info); return seedFloorDoor(seed(7))(info); };
    const a = floorRestKey(door), b = floorRestKey(seedFloorDoor(seed(7)));
    expect(asked).toEqual([FLOOR_REST_KEY_INFO]);
    expect([...a]).toEqual([...b]);
    expect([...a]).not.toEqual([...seed(7)]);
    expect([...floorRestKey(seedFloorDoor(seed(8)))]).not.toEqual([...a]);
  });

  test("FK2: a door that cannot answer derives none: the refusal surfaces as itself, and a short child refuses", () => {
    class Locked extends Error {}
    expect(() => floorRestKey(() => { throw new Locked("custody-locked"); })).toThrow(Locked);
    expect(() => floorRestKey(() => new Uint8Array(16))).toThrow(/no 32-byte child/);
    expect(() => seedFloorDoor(new Uint8Array(31))).toThrow(/32 bytes/);
  });

  test("FK3: a floor bag sealed under the floor's key opens under it alone, per bag", () => {
    const floor = floorRestKey(seedFloorDoor(seed(7)));
    const sealed = sealHeld({ bagId: GARDEN, held: floor, role: "change", ref: REF, plaintext: new TextEncoder().encode("floor words") });
    if (!("chunk" in sealed)) throw new Error(`the seal refused: ${sealed.refusal}`);
    const open = (bagId: string, held: Uint8Array) => openHeld({ bagId, held, role: "change", ref: REF, sealed: sealed.chunk.sealed });
    expect("plaintext" in open(GARDEN, floor)).toBe(true);
    expect("plaintext" in open(wikiSlotUri("orchard", "working"), floor), "another floor bag binds another content key").toBe(false);
    expect("plaintext" in open(GARDEN, mintHeldRestKey()), "the secret home's random key never opens a floor value").toBe(false);
  });
});

describe("the held homes keep two keys apart", () => {
  test("RED FK4: a floor document seals with NO secret home standing, and the control document does not", async () => {
    const { homes, repo } = heldRepo();
    const floorDoc = mintSecretHomeAddress().documentId, control = mintSecretHomeAddress().documentId;
    expect(enrollBesideSecretHome(repo, floorDoc, GARDEN), "mapped, held: no floor key stands yet").toBe(false);
    expect(homes.bagOf(floorDoc)).toEqual({ bagId: GARDEN, face: null });
    expect(floorKeyStandsOn(repo)).toBe(false);
    const floor = floorRestKey(seedFloorDoor(seed(7)));
    expect(standFloorKeyOn(repo, floor)).toBe(true);
    expect(floorKeyStandsOn(repo)).toBe(true);
    expect([...(homes.bagOf(floorDoc)?.held ?? [])]).toEqual([...floor]);
    // No face landed: no secret home's key stands, so a control document maps held and reads no key.
    expect(enrollBesideSecretHome(repo, control, CONTROL_HOME_ID)).toBe(false);
    expect(homes.bagOf(control)).toEqual({ bagId: CONTROL_HOME_ID, face: null });
    await repo.shutdown();
  });

  test("RED FK5: the floor key differs from the secret-home key, and a face landing moves neither", async () => {
    const { homes, repo } = heldRepo();
    const floor = floorRestKey(seedFloorDoor(seed(7)));
    standFloorKeyOn(repo, floor);
    const floorDoc = mintSecretHomeAddress().documentId;
    enrollBesideSecretHome(repo, floorDoc, GARDEN);
    // A face lands: its secret home mints with a random key of its own, and the control document files beside it.
    const address = { ...mintSecretHomeAddress(), controlId: mintSecretHomeAddress().documentId };
    const home = await enrollSecretHome(repo, address);
    const secretHeld = homes.bagOf(home.handle.documentId)?.held, controlHeld = homes.bagOf(address.controlId)?.held, floorHeld = homes.bagOf(floorDoc)?.held;
    expect([...(secretHeld ?? [])]).toEqual([...address.key]);
    expect([...(controlHeld ?? [])]).toEqual([...address.key]);
    expect([...(floorHeld ?? [])], "the floor document still answers the floor's key").toEqual([...floor]);
    expect([...(floorHeld ?? [])]).not.toEqual([...(secretHeld ?? [])]);
    expect([...(homes.floorKey() ?? [])], "the Lift opens floor values with the floor's key after the secret home mints").toEqual([...floor]);
    await repo.shutdown();
  });

  test("FK6: one floor key per rest: the same key again changes nothing, another refuses", async () => {
    const { repo, moves } = heldRepo();
    const floor = floorRestKey(seedFloorDoor(seed(7)));
    expect(standFloorKeyOn(repo, floor)).toBe(true);
    const before = moves();
    expect(standFloorKeyOn(repo, floorRestKey(seedFloorDoor(seed(7))))).toBe(false);
    expect(moves()).toBe(before);
    expect(() => standFloorKeyOn(repo, floorRestKey(seedFloorDoor(seed(9))))).toThrow(/another floor key/);
    expect(standFloorKeyOn(new Repo({ network: [] }), floor), "a Repo whose holder bound no rest stands none").toBe(false);
    await repo.shutdown();
  });
});

describe("the floor registry's gate names the floor key", () => {
  function daemonComposite() {
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const composite = new CompositeStore();
    const store = new AutomergeDocStore(handle, DAEMON_BAG_ID);
    composite.addLayer({ bagId: DAEMON_BAG_ID, store, writable: true, defaultWritable: false });
    store.markSyncComplete();
    return { repo, handle, composite };
  }

  test("RED FR2: a place that derives no floor key (a herm) registers no floor row, and a locked floor refuses by its own name", async () => {
    const { repo, handle, composite } = daemonComposite();
    for (const refusal of [FLOOR_UNKEYED, VESSEL_LOCKED] as FloorKeyRefusal[]) {
      const registry = floorRegistryOf(composite, () => refusal);
      expect(registry.refusal()).toBe(refusal);
      await expect(registry.get(floorSlotTitle("garden", "working"))).rejects.toMatchObject({ name: "FloorUnavailable", refusal });
      await expect(registry.put(floorSlotTitle("garden", "working"), { text: "automerge:abc" }, "test")).rejects.toBeInstanceOf(FloorUnavailable);
      await expect(registry.entries()).rejects.toMatchObject({ refusal });
    }
    // A grant that names no floor key at all reads as a place that derives none (fail closed).
    await expect(floorRegistryOf(composite, undefined).put(floorDaemonSlotTitle("working"), { text: "automerge:abc" }, "test")).rejects.toMatchObject({ refusal: FLOOR_UNKEYED });
    expect(Object.keys(handle.doc()?.tiddlers ?? {}), "no floor row landed in the daemon document").toEqual([]);
    await repo.shutdown();
  });

  test("FR3: a keyed floor names its documents in the daemon document, reads them back, and drops a row whole", async () => {
    const { repo, handle, composite } = daemonComposite();
    const registry = floorRegistryOf(composite, () => null);
    const title = floorSlotTitle("garden", "working");
    expect(await registry.get(title)).toBeNull();
    await registry.put(title, { text: "automerge:gardenfloor", "minted-by": "placekey" }, "test");
    await registry.put(floorDaemonSlotTitle("working"), { text: "automerge:daemonfloor" }, "test");
    expect(await registry.get(title)).toBe("automerge:gardenfloor");
    expect(Object.keys(handle.doc()?.tiddlers ?? {}).sort()).toEqual([floorDaemonSlotTitle("working"), title].sort());
    const rows = await registry.entries();
    expect(rows.map((r) => r.title).sort()).toEqual([floorDaemonSlotTitle("working"), title].sort());
    expect(rows.find((r) => r.title === title)?.record.tiddler).toMatchObject({ "face-reach": "vessel-only", "minted-by": "placekey" });
    await registry.remove(title, "test");
    expect(await registry.get(title)).toBeNull();
    expect(Object.keys(handle.doc()?.tiddlers ?? {})).toEqual([floorDaemonSlotTitle("working")]);
    await expect(registry.put(`${CONTROL_HOME_ID}/floor-slot/garden/working`, { text: "automerge:x" }, "test"), "a control title names no floor row").rejects.toThrow(/names no floor row/);
    await repo.shutdown();
  });
});
