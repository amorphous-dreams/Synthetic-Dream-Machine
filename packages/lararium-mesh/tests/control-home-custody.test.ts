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
  CONTROL_FRESH_BASE_AT_CHANGES, plainEntries, storedRecord,
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

// THE CONTROL DOCUMENT FRESH-BASES AT ITS STAND once its history passes a change count: one founding seed and one change carry
// every record and tombstone, under the same document id, so no reader that holds its url follows anywhere new.
describe("a control document past its change bound fresh-bases at its stand", () => {
  async function foundedWith(changes: number) {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    const control = founded.control!;
    for (let i = 0; i < changes; i++) {
      const title = `${CONTROL_HOME_ID}/ledger/row-${i % 64}`;
      control.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: `turn ${i}` }, "test"); });
    }
    const gone = `${CONTROL_HOME_ID}/ledger/gone`;
    control.change((d) => { d.tiddlers[gone] = storedRecord({ tiddler: { title: gone }, meta: { authority: "test", deleted: true } }); });
    control.change((d) => { delete d.tiddlers[`${CONTROL_HOME_ID}/ledger/row-63`]; });
    control.change((d) => { (d as { blobs?: unknown }).blobs = { kernel: { id: "kernel", version: "1", sha256: "00", mimeType: "application/octet-stream", blob: new Uint8Array([1, 2, 3]) } }; });
    const before = plainEntries(control.doc()!.tiddlers).sort(([a], [b]) => a.localeCompare(b));
    const changesBefore = A.stats(control.doc()!).numChanges;
    const daemonBytes = A.save((() => { const d = first.repo.create<LarDoc>(emptyLarDoc()); nameControlHome(d, `automerge:${address.controlId}`); return d.doc()!; })());
    await first.repo.flush();
    await first.repo.shutdown();
    return { inner, address, before, changesBefore, daemonBytes };
  }
  async function standAgain(inner: ReturnType<typeof memoryAdapter>, address: Parameters<typeof openSecretHome>[1], daemonBytes: Uint8Array) {
    const again = heldRepo(inner);
    await openSecretHome(again.repo, address);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const control = await standControlHome(again.repo, again.repo.import<LarDoc>(daemonBytes));
    log.mockRestore();
    await again.repo.flush();
    return { repo: again.repo, control };
  }
  const chunksOf = (inner: ReturnType<typeof memoryAdapter>, documentId: string) => [...inner.bytes.keys()].map((k) => k.split("\u0000")).filter((k) => k[0] === documentId);

  test("RED (83 s control load): a control document of many changes stands as one seed and one change, every record, tombstone and blob equal, at the same id", async () => {
    const { inner, address, before, changesBefore, daemonBytes } = await foundedWith(CONTROL_FRESH_BASE_AT_CHANGES + 64);
    expect(changesBefore).toBeGreaterThan(CONTROL_FRESH_BASE_AT_CHANGES);
    const { repo, control } = await standAgain(inner, address, daemonBytes);
    expect(control.documentId).toBe(address.controlId);
    expect(A.stats(control.doc()!).numChanges).toBeLessThanOrEqual(2);
    expect(plainEntries(control.doc()!.tiddlers).sort(([a], [b]) => a.localeCompare(b))).toEqual(before);
    expect(before.some(([, r]) => r.meta?.deleted === true)).toBe(true);
    expect(Array.from(control.doc()!.blobs?.["kernel"]?.blob ?? [])).toEqual([1, 2, 3]);
    // The old history leaves the rest: one snapshot stands for the document, no incremental beside it.
    const chunks = chunksOf(inner, address.controlId!);
    expect(chunks.filter((k) => k[1] === "snapshot")).toHaveLength(1);
    expect(chunks.filter((k) => k[1] === "incremental")).toHaveLength(0);
    await repo.shutdown();

    // A reboot reads the same facts off the fresh base, and fresh-bases nothing again.
    const rebooted = await standAgain(inner, address, daemonBytes);
    expect(A.stats(rebooted.control.doc()!).numChanges).toBeLessThanOrEqual(2);
    expect(plainEntries(rebooted.control.doc()!.tiddlers).sort(([a], [b]) => a.localeCompare(b))).toEqual(before);
    // A write after the base lands on it and survives the next stand.
    const after = `${CONTROL_HOME_ID}/ledger/after`;
    rebooted.control.change((d) => { d.tiddlers[after] = storedLarRecord(after, { text: "after" }, "test"); });
    await rebooted.repo.flush();
    await rebooted.repo.shutdown();
    const third = await standAgain(inner, address, daemonBytes);
    expect(plainEntries(third.control.doc()!.tiddlers).find(([t]) => t === after)?.[1].tiddler["text"]).toBe("after");
    await third.repo.shutdown();
  }, 60_000);

  test("CONTROL: a control document under the bound keeps its history whole", async () => {
    const { inner, address, before, changesBefore, daemonBytes } = await foundedWith(32);
    const { repo, control } = await standAgain(inner, address, daemonBytes);
    expect(A.stats(control.doc()!).numChanges).toBe(changesBefore);
    expect(plainEntries(control.doc()!.tiddlers).sort(([a], [b]) => a.localeCompare(b))).toEqual(before);
    await repo.shutdown();
  });
});
