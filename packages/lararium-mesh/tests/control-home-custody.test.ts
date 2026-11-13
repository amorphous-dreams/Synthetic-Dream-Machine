/**
 * control-home-custody — THE CUSTODY ROW NAMES THE CONTROL DOCUMENT; the daemon document only points at it.
 *
 * The daemon document rests clear and syncs, so a merged concurrent change can win its control pointer. The custody row
 * (the secret home's address) names the control document beside the home, and where it reads it stands: a pointer naming
 * another document reports and stands refused, and no pointer ever re-files the secret home as control. A held control
 * handle whose stored copy failed to merge keeps that merge pending until the next stand lands it. A fence read off an
 * unnamed or unread control document refuses by name.
 */
import { describe, expect, test, vi } from "vitest";
import * as A from "@automerge/automerge";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  CONTROL_HOME_ID, SECRET_HOME_ID, emptyLarDoc, storedLarRecord, type LarDoc,
  SealedDocumentStore, bindSecretHomeRest, enrollSecretHome, mintSecretHomeAddress, mintVesselDocumentId, nameControlHome, openSecretHome,
  standControlHome, readControlHome, controlStoreOf, controlHomeRefusal, VESSEL_LOCKED, CONTROL_HOME_UNNAMED, RECEIPT_FACT_URI_PREFIX, vesselHeldHomes, decodeSecretHomeAddress, encodeSecretHomeAddress, secretHomeRestOf,
} from "../src/index.js";

describe("the custody row outranks the daemon document's control pointer", () => {
  test("a daemon document naming the SECRET home as control re-files nothing: the custody row's control document stands", async () => {
    const { repo, homes } = heldRepo(memoryAdapter());
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    await enrollSecretHome(repo, address);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemon, `automerge:${address.documentId}`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const control = await standControlHome(repo, daemon);
    warn.mockRestore();
    expect(control.documentId).toBe(address.controlId);
    expect(homes.bagOf(address.documentId)?.bagId).toBe(SECRET_HOME_ID);
    await repo.shutdown();
  });

  test("a custody row that names no control document never lets a pointer file the secret home as control", async () => {
    const { repo, homes } = heldRepo(memoryAdapter());
    const address = mintSecretHomeAddress();
    await enrollSecretHome(repo, address);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemon, `automerge:${address.documentId}`);
    await expect(standControlHome(repo, daemon)).rejects.toThrow(/control-home-unavailable: .*secret home/);
    expect(homes.bagOf(address.documentId)?.bagId).toBe(SECRET_HOME_ID);
    await repo.shutdown();
  });

  test("the bound secret document refuses enrolment under any other bag", async () => {
    const { repo, homes } = heldRepo(memoryAdapter());
    const address = mintSecretHomeAddress();
    await enrollSecretHome(repo, address);
    const rest = secretHomeRestOf(repo)!;
    expect(rest.enrollBeside(address.documentId, CONTROL_HOME_ID)).toBe(false);
    expect(rest.enrollBeside(address.documentId, "lar:///ha.ka.ba/wikis/daemon/working")).toBe(false);
    expect(homes.bagOf(address.documentId)?.bagId).toBe(SECRET_HOME_ID);
    await repo.shutdown();
  });

  test("a mismatched pointer stands the custody row's control document and reports the daemon document's", async () => {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    founded.control!.change((d) => { d.tiddlers[`${CONTROL_HOME_ID}/founded`] = storedLarRecord(`${CONTROL_HOME_ID}/founded`, { text: "founded" }, "test"); });
    await first.repo.flush();
    await first.repo.shutdown();

    const again = heldRepo(inner);
    await openSecretHome(again.repo, address);
    const daemon = again.repo.create<LarDoc>(emptyLarDoc());
    const rogue = mintVesselDocumentId();
    nameControlHome(daemon, `automerge:${rogue}`);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const control = await standControlHome(again.repo, daemon);
    expect(warn.mock.calls.some(([m]) => String(m).includes("custody row's stands"))).toBe(true);
    warn.mockRestore();
    expect(control.documentId).toBe(address.controlId);
    expect(control.doc().tiddlers[`${CONTROL_HOME_ID}/founded`]).toBeDefined();
    expect(again.homes.bagOf(rogue)).toBeNull();
    await again.repo.shutdown();
  });

  test("an address whose control id names the home itself reads as no address", () => {
    const address = mintSecretHomeAddress();
    expect(decodeSecretHomeAddress(encodeSecretHomeAddress({ ...address, controlId: address.documentId }))).toBeNull();
  });
});

describe("a fence read fails closed", () => {
  test("a daemon document and custody that name no control document refuse the read by name", async () => {
    const repo = new Repo({});
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    await expect(readControlHome(repo, daemon)).rejects.toThrow(/control-home-unavailable/);
  });

  test("a place whose custody and daemon document name no control document refuses the read `control-home-unnamed`", async () => {
    const { repo } = heldRepo(memoryAdapter());
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    await expect(readControlHome(repo, daemon)).rejects.toMatchObject({ refusal: CONTROL_HOME_UNNAMED });
    await repo.shutdown();
  });

  test("a vessel whose key stays shut refuses the read: the handle holds the seed alone", async () => {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    await enrollSecretHome(first.repo, address);
    const daemonBytes = A.save((() => { const d = first.repo.create<LarDoc>(emptyLarDoc()); nameControlHome(d, `automerge:${address.controlId}`); return d.doc(); })());
    await first.repo.flush();
    await first.repo.shutdown();
    const locked = heldRepo(inner);
    await expect(readControlHome(locked.repo, locked.repo.import<LarDoc>(daemonBytes))).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await locked.repo.shutdown();
  });

  test("CONTROL: an open vessel reads its control document", async () => {
    const { repo } = heldRepo(memoryAdapter());
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    await enrollSecretHome(repo, address);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemon, `automerge:${address.controlId}`);
    expect((await readControlHome(repo, daemon)).documentId).toBe(address.controlId);
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
describe("the control home stood while the vessel's key stays shut refuses by name", () => {
  async function lockedVessel() {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    const fact = `${RECEIPT_FACT_URI_PREFIX}landed`;
    const slot = `${CONTROL_HOME_ID}/daemon-slot/working/floor`;
    founded.control!.change((d) => {
      d.tiddlers[fact] = storedLarRecord(fact, { text: "committed" }, "test");
      d.tiddlers[slot] = storedLarRecord(slot, { text: "automerge:rested-slot" }, "test");
    });
    const daemonBytes = A.save((() => { const d = first.repo.create<LarDoc>(emptyLarDoc()); nameControlHome(d, `automerge:${address.controlId}`); return d.doc(); })());
    await first.repo.flush();
    await first.repo.shutdown();
    const locked = heldRepo(inner);
    return { inner, address, fact, slot, locked, daemon: locked.repo.import<LarDoc>(daemonBytes) };
  }

  test("RED (locked floor mints no device slot): a device-slot title neither reads nor lands while locked, so no second slot can name itself beside the rest's", async () => {
    const { slot, locked, daemon } = await lockedVessel();
    const store = controlStoreOf(await standControlHome(locked.repo, daemon));
    await expect(store.get(slot)).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await expect(store.put({ tiddler: { title: slot, text: "automerge:second-slot" } }, { kind: "test" })).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await locked.repo.shutdown();
  });

  test("RED (midnight petitioner): the receipt ledger's read of a fact the rest holds refuses `vessel-locked`, never reads it absent", async () => {
    const { fact, locked, daemon } = await lockedVessel();
    const store = controlStoreOf(await standControlHome(locked.repo, daemon));
    await expect(store.storeForBag(CONTROL_HOME_ID)!.get(fact)).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
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
    nameControlHome(daemon, `automerge:${mintVesselDocumentId()}`);
    const refused = await standControlHome(repo, daemon).catch((e: unknown) => e);
    expect(refused).toMatchObject({ name: "ControlHomeUnavailable", refusal: VESSEL_LOCKED });
    expect(String((refused as Error).message)).toMatch(/custody-locked/);
    await repo.shutdown();
  });

  test("CONTROL: the stand-in stays out of the vessel's Repo and answers its refusal by name", async () => {
    const { address, locked, daemon } = await lockedVessel();
    const control = await standControlHome(locked.repo, daemon);
    expect(controlHomeRefusal(control)?.refusal).toBe(VESSEL_LOCKED);
    expect(locked.repo.handles[address.controlId as never]).toBeUndefined();
    expect(await standControlHome(locked.repo, daemon)).toBe(control);
    await locked.repo.shutdown();
  });
});
