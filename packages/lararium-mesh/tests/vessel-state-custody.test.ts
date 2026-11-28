/**
 * vessel-state-custody — THE CUSTODY ROW NAMES THE VESSEL STATE DOCUMENT; the daemon document only points at it.
 *
 * The daemon document rests clear and syncs, so a merged concurrent change can win its state pointer. The custody row
 * (the secret home's address) names the state document beside the home, and where it reads it stands: a pointer naming
 * another document reports and stands refused, and no pointer ever re-files the secret home as state. A held state
 * handle whose stored copy failed to merge keeps that merge pending until the next stand lands it. A fence read off an
 * unnamed or unread state document refuses by name.
 */
import { describe, expect, test, vi } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  VESSEL_STATE_ID, SECRET_HOME_ID, emptyLarDoc, storedLarRecord, type LarDoc,
  SealedDocumentStore, bindSecretHomeRest, enrollSecretHome, mintSecretHomeAddress, mintVesselDocumentId, nameVesselState, openSecretHome,
  standVesselState, readVesselState, stateStoreOf, vesselStateRefusal, VESSEL_LOCKED, VESSEL_STATE_UNNAMED, RECEIPT_FACT_URI_PREFIX, vesselHeldHomes, decodeSecretHomeAddress, encodeSecretHomeAddress, secretHomeRestOf,
} from "../src/index.js";

describe("the custody row outranks the daemon document's state pointer", () => {
  test("a daemon document naming the SECRET home as state re-files nothing: the custody row's state document stands", async () => {
    const { repo, homes } = heldRepo(memoryAdapter());
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    await enrollSecretHome(repo, address);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemon, `automerge:${address.documentId}`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await standVesselState(repo, daemon);
    warn.mockRestore();
    expect(state.documentId).toBe(address.stateId);
    expect(homes.bagOf(address.documentId)?.bagId).toBe(SECRET_HOME_ID);
    await repo.shutdown();
  });

  test("a custody row that names no state document never lets a pointer file the secret home as state", async () => {
    const { repo, homes } = heldRepo(memoryAdapter());
    const address = mintSecretHomeAddress();
    await enrollSecretHome(repo, address);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemon, `automerge:${address.documentId}`);
    await expect(standVesselState(repo, daemon)).rejects.toThrow(/vessel-state-unavailable: .*secret home/);
    expect(homes.bagOf(address.documentId)?.bagId).toBe(SECRET_HOME_ID);
    await repo.shutdown();
  });

  test("the bound secret document refuses enrolment under any other bag", async () => {
    const { repo, homes } = heldRepo(memoryAdapter());
    const address = mintSecretHomeAddress();
    await enrollSecretHome(repo, address);
    const rest = secretHomeRestOf(repo)!;
    expect(rest.enrollBeside(address.documentId, VESSEL_STATE_ID)).toBe(false);
    expect(rest.enrollBeside(address.documentId, "lar:///ha.ka.ba/wikis/daemon/working")).toBe(false);
    expect(homes.bagOf(address.documentId)?.bagId).toBe(SECRET_HOME_ID);
    await repo.shutdown();
  });

  test("a mismatched pointer stands the custody row's state document and reports the daemon document's", async () => {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    founded.state!.change((d) => { d.tiddlers[`${VESSEL_STATE_ID}/founded`] = storedLarRecord(`${VESSEL_STATE_ID}/founded`, { text: "founded" }, "test"); });
    await first.repo.flush();
    await first.repo.shutdown();

    const again = heldRepo(inner);
    await openSecretHome(again.repo, address);
    const daemon = again.repo.create<LarDoc>(emptyLarDoc());
    const rogue = mintVesselDocumentId();
    nameVesselState(daemon, `automerge:${rogue}`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await standVesselState(again.repo, daemon);
    expect(warn.mock.calls.some(([m]) => String(m).includes("custody row's stands"))).toBe(true);
    warn.mockRestore();
    expect(state.documentId).toBe(address.stateId);
    expect(state.doc().tiddlers[`${VESSEL_STATE_ID}/founded`]).toBeDefined();
    expect(again.homes.bagOf(rogue)).toBeNull();
    await again.repo.shutdown();
  });

  test("an address whose state id names the home itself reads as no address", () => {
    const address = mintSecretHomeAddress();
    expect(decodeSecretHomeAddress(encodeSecretHomeAddress({ ...address, stateId: address.documentId }))).toBeNull();
  });
});

describe("a fence read fails closed", () => {
  test("a daemon document and custody that name no state document refuse the read by name", async () => {
    const repo = new Repo({});
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    await expect(readVesselState(repo, daemon)).rejects.toThrow(/vessel-state-unavailable/);
  });

  test("a place whose custody and daemon document name no state document refuses the read `vessel-state-unnamed`", async () => {
    const { repo } = heldRepo(memoryAdapter());
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    await expect(readVesselState(repo, daemon)).rejects.toMatchObject({ refusal: VESSEL_STATE_UNNAMED });
    await repo.shutdown();
  });

  test("a vessel whose key stays shut refuses the read: the handle holds the seed alone", async () => {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    await enrollSecretHome(first.repo, address);
    const daemonBytes = A.save((() => { const d = first.repo.create<LarDoc>(emptyLarDoc()); nameVesselState(d, `automerge:${address.stateId}`); return d.doc(); })());
    await first.repo.flush();
    await first.repo.shutdown();
    const locked = heldRepo(inner);
    await expect(readVesselState(locked.repo, locked.repo.import<LarDoc>(daemonBytes))).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await locked.repo.shutdown();
  });

  test("CONTROL: an open vessel reads its state document", async () => {
    const { repo } = heldRepo(memoryAdapter());
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    await enrollSecretHome(repo, address);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemon, `automerge:${address.stateId}`);
    expect((await readVesselState(repo, daemon)).documentId).toBe(address.stateId);
    await repo.shutdown();
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
function heldRepo(inner: StorageAdapterInterface) {
  const homes = vesselHeldHomes();
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({ inner, bagOf: (id) => homes.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, waitOverSealed: true, hydrates: false });
  const repo = new Repo({ storage: store, network: [] });
  bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id), () => { store.mapMoved(); void store.reseal(); }));
  return { repo, store, homes };
}

// THE LOCKED HEARTH FAILS CLOSED (operator ruling 2026-11-09): every harm the held-seed stand-in carried, cured by name.
describe("the state home stood while the vessel's key stays shut refuses by name", () => {
  async function lockedVessel() {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    const fact = `${RECEIPT_FACT_URI_PREFIX}landed`;
    const slot = `${VESSEL_STATE_ID}/daemon-slot/working/floor`;
    founded.state!.change((d) => {
      d.tiddlers[fact] = storedLarRecord(fact, { text: "committed" }, "test");
      d.tiddlers[slot] = storedLarRecord(slot, { text: "automerge:rested-slot" }, "test");
    });
    const daemonBytes = A.save((() => { const d = first.repo.create<LarDoc>(emptyLarDoc()); nameVesselState(d, `automerge:${address.stateId}`); return d.doc(); })());
    await first.repo.flush();
    await first.repo.shutdown();
    const locked = heldRepo(inner);
    return { inner, address, fact, slot, locked, daemon: locked.repo.import<LarDoc>(daemonBytes) };
  }

  test("RED (locked floor mints no device slot): a device-slot title neither reads nor lands while locked, so no second slot can name itself beside the rest's", async () => {
    const { slot, locked, daemon } = await lockedVessel();
    const store = stateStoreOf(await standVesselState(locked.repo, daemon));
    await expect(store.get(slot)).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await expect(store.put({ tiddler: { title: slot, text: "automerge:second-slot" } }, { kind: "test" })).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await locked.repo.shutdown();
  });

  test("RED (midnight petitioner): the receipt ledger's read of a fact the rest holds refuses `vessel-locked`, never reads it absent", async () => {
    const { fact, locked, daemon } = await lockedVessel();
    const store = stateStoreOf(await standVesselState(locked.repo, daemon));
    await expect(store.storeForBag(VESSEL_STATE_ID)!.get(fact)).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await locked.repo.shutdown();
  });

  test("RED (CLI refused unlock): a direct holder whose key will not open refuses the stand by name, carrying the custody's reason, and stands no stand-in", async () => {
    const inner = memoryAdapter();
    const homes = vesselHeldHomes();
    const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
    const store = new SealedDocumentStore({ inner, bagOf: (id) => homes.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, waitOverSealed: true, hydrates: false });
    const repo = new Repo({ storage: store, network: [] });
    bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id), undefined, async () => { throw new Error("custody-locked: the vessel key stays shut"); }));
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemon, `automerge:${mintVesselDocumentId()}`);
    const refused = await standVesselState(repo, daemon).catch((e: unknown) => e);
    expect(refused).toMatchObject({ name: "VesselStateUnavailable", refusal: VESSEL_LOCKED });
    expect(String((refused as Error).message)).toMatch(/custody-locked/);
    await repo.shutdown();
  });

  test("CONTROL: the stand-in stays out of the vessel's Repo and answers its refusal by name", async () => {
    const { address, locked, daemon } = await lockedVessel();
    const state = await standVesselState(locked.repo, daemon);
    expect(vesselStateRefusal(state)?.refusal).toBe(VESSEL_LOCKED);
    expect(locked.repo.handles[address.stateId as never]).toBeUndefined();
    expect(await standVesselState(locked.repo, daemon)).toBe(state);
    await locked.repo.shutdown();
  });
});
