/**
 * vessel-state — the vessel's vessel state document: one document, minted at founding beside the vessel's secret home and sealed
 * under the vessel's own key (operator ruling A6, 2026-11-09), named by the daemon document, held as its own store and
 * never as a recipe layer. While the key stays shut every read and write refuses `vessel-locked`; nothing waits in memory.
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  VESSEL_STATE_ID, VESSEL_WORK_ID, DAEMON_BAG_ID, MAILBOX_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX, EFFECT_URI_PREFIX,
  vesselStateUrlOf, vesselStateRefusal, stateStoreOf, emptyLarDoc, VESSEL_LOCKED, VESSEL_STATE_UNNAMED, expandRecipe, leaseEpochPrefix, standVesselState, wornFaceWikiBags, vesselOnlyDocIds, makeVesselOnlyDocs, storedLarRecord, type LarDoc,
  SealedDocumentStore, bindSecretHomeRest, enrollSecretHome, mintSecretHomeAddress, mintVesselDocumentId, nameVesselState, openSecretHome, vesselHeldHomes,
} from "../src/index.js";

describe("the vessel's state document", () => {
  test("vessel-only names include state and daemon bindings alone, and refresh preserves additions", () => {
    const doc = emptyLarDoc();
    for (const [title, text] of [[`${VESSEL_STATE_ID}/daemon-slot/draft/g`, "automerge:slot"], [`${VESSEL_STATE_ID}/daemon-canon/face`, "automerge:canon"], ["user/wiki", "automerge:user"]]) {
      doc.tiddlers[title] = storedLarRecord(title, { text }, "test");
    }
    expect(vesselOnlyDocIds(doc, "automerge:state")).toEqual(new Set(["state", "slot", "canon"]));
    const live = makeVesselOnlyDocs();
    live.add("secret");
    live.refresh(doc, "automerge:state");
    expect(live.has("secret")).toBe(true);
    expect(live.has("slot")).toBe(true);
    expect(live.has("user")).toBe(false);
    live.refresh(emptyLarDoc(), "automerge:state");
    expect(live.has("slot")).toBe(false);
  });
  test("a storage-less Repo (a suite's) mints one state document in memory and names it; CONTROL: a second stand returns that same document", async () => {
    const repo = new Repo({});
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    expect(vesselStateUrlOf(daemon.doc())).toBeNull();
    const first = await standVesselState(repo, daemon);
    expect(vesselStateUrlOf(daemon.doc())).toBe(first.url);
    const second = await standVesselState(repo, daemon);
    expect(second.documentId).toBe(first.documentId);
    expect(first.documentId).not.toBe(daemon.documentId);
  });

  test("the state store writes its one layer by default, and that layer names the state home", async () => {
    const repo = new Repo({});
    const state = stateStoreOf(repo.create<LarDoc>(emptyLarDoc()));
    expect(state.defaultWritableBagId()).toBe(VESSEL_STATE_ID);
    await state.put({ tiddler: { title: `${VESSEL_STATE_ID}/floor-pin/test`, status: "done" } }, { kind: "test" });
    expect(await state.listBagsHolding(`${VESSEL_STATE_ID}/floor-pin/test`)).toEqual([VESSEL_STATE_ID]);
  });

  test("work families carry their own coordinate and lease slots carry the registry coordinate", () => {
    expect(leaseEpochPrefix("group").startsWith(`${VESSEL_STATE_ID}/`)).toBe(true);
    for (const prefix of [SUMMONS_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, MAILBOX_URI_PREFIX, EFFECT_URI_PREFIX]) {
      expect(prefix.startsWith(`${VESSEL_WORK_ID}/`), prefix).toBe(true);
      expect(prefix.startsWith(`${DAEMON_BAG_ID}/`), prefix).toBe(false);
    }
  });

  test("no recipe composes the state home", () => {
    expect(expandRecipe({ wikiSlug: "daemon" })).not.toContain(VESSEL_STATE_ID);
  });

  test("THE PER-FACE BRIDGE RETIRES: the state home seals and registers under no face, lit or floor", () => {
    for (const lit of [true, false]) {
      const bags = wornFaceWikiBags({ lit });
      expect(bags.sealed).not.toContain(VESSEL_STATE_ID);
      expect(bags.registered).not.toContain(VESSEL_STATE_ID);
    }
  });

  test("a Repo that rests bytes and names no state document mints none at its stand: its stand-in refuses `vessel-state-unnamed`", async () => {
    const inner = memoryAdapter();
    const { repo } = heldRepo(inner);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    const state = await standVesselState(repo, daemon);
    expect(vesselStateRefusal(state)?.refusal).toBe(VESSEL_STATE_UNNAMED);
    // The floor answers a verb's answer from memory alone (none waits) and refuses every state fact by the stand-in's name.
    await expect(stateStoreOf(state).get(`${VESSEL_STATE_ID}/floor-pin/test`)).rejects.toMatchObject({ refusal: VESSEL_STATE_UNNAMED });
    await expect(stateStoreOf(state).get(`${RECEIPT_FACT_URI_PREFIX}r1`)).rejects.toMatchObject({ refusal: VESSEL_STATE_UNNAMED });
    expect(vesselStateUrlOf(daemon.doc())).toBeNull();
    await repo.flush();
    expect(restsAny(inner, state.documentId)).toBe(false);
    await repo.shutdown();
  });
});

describe("the state document seals under the vessel's key from its first byte (A6)", () => {
  test("RED: minted beside the secret home, its first byte rests sealed with no session and no face; the daemon document names it", async () => {
    const inner = memoryAdapter();
    const { repo } = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    const home = await enrollSecretHome(repo, address);
    expect(home.state?.documentId).toBe(address.stateId);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemon, `automerge:${address.stateId}`);
    const state = await standVesselState(repo, daemon);
    expect(state.documentId).toBe(address.stateId);
    await stateStoreOf(state).put({ tiddler: { title: `${VESSEL_STATE_ID}/floor-pin/test`, text: WORD } }, { kind: "test" });
    await repo.flush();
    await repo.shutdown();
    expect(restsAny(inner, address.stateId)).toBe(true);
    expect(restsClear(inner, address.stateId)).toBe(false);
  });

  test("RED (second boot): a store whose map names no bag for the state document refuses its sealed chunks `bag-unmapped`, never hands them to the engine raw", async () => {
    const inner = memoryAdapter();
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    founded.state!.change((d) => { d.tiddlers["lar:///ha.ka.ba/bags/vessel-state/founded"] = storedLarRecord("lar:///ha.ka.ba/bags/vessel-state/founded", { text: WORD }, "test"); });
    await first.repo.flush();
    await first.repo.shutdown();
    expect(restsAny(inner, address.stateId)).toBe(true);
    const second = heldRepo(inner);
    await expect(second.store.loadRange([address.stateId])).rejects.toMatchObject({ refusal: "bag-unmapped" });
    await second.repo.shutdown();
  });

  test("RED (Gaia Tuesday): while the vessel's key stays shut the state store refuses every read and write `vessel-locked` and nothing rests; once unlocked, a fresh stand reads the state document whole", async () => {
    const inner = memoryAdapter();
    // FOUNDING: home and state enrolled, one record written, the address kept.
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), stateId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    founded.state!.change((d) => { d.tiddlers["lar:///ha.ka.ba/bags/vessel-state/founded"] = storedLarRecord("lar:///ha.ka.ba/bags/vessel-state/founded", { text: "founded" }, "test"); });
    const daemonDoc = first.repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemonDoc, `automerge:${address.stateId}`);
    const daemonBytes = (await import("@automerge/automerge")).save(daemonDoc.doc());
    await first.repo.flush();
    await first.repo.shutdown();
    const restedBefore = new Map(inner.bytes);

    // THE LOCKED BOOT: the daemon document names the state document; no key stands.
    const locked = heldRepo(inner);
    const daemon = locked.repo.import<LarDoc>(daemonBytes);
    const state = await standVesselState(locked.repo, daemon);
    expect(state.documentId).toBe(address.stateId);
    expect(vesselStateRefusal(state)?.refusal).toBe(VESSEL_LOCKED);
    const store = stateStoreOf(state);
    await expect(store.put({ tiddler: { title: "lar:///ha.ka.ba/bags/vessel-state/floor-write", text: WORD } }, { kind: "test" })).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await expect(store.get("lar:///ha.ka.ba/bags/vessel-state/founded")).rejects.toMatchObject({ refusal: VESSEL_LOCKED });
    await expect(store.listVisible()).rejects.toThrow(/vessel-locked/);
    // The stand-in never joins the vessel's Repo: nothing of it syncs, rests or waits there.
    expect(locked.repo.handles[address.stateId as never]).toBeUndefined();
    await locked.repo.flush();
    expect(locked.store.waiting(address.stateId)).toBe(0);
    for (const [key, data] of inner.bytes) if (key.startsWith(address.stateId)) expect(restedBefore.get(key)).toEqual(data);

    // THE KEY OPENS (an unlock recomposes): the home opens on the same rest and a fresh stand reads the founding's record.
    await openSecretHome(locked.repo, address);
    const opened = await standVesselState(locked.repo, daemon);
    expect(vesselStateRefusal(opened)).toBeNull();
    expect(opened.doc().tiddlers["lar:///ha.ka.ba/bags/vessel-state/founded"]).toBeDefined();
    expect(JSON.stringify(opened.doc())).not.toContain(WORD);
    await locked.repo.shutdown();
    expect(restsClear(inner, address.stateId)).toBe(false);
  });
});

const WORD = "a-state-write-that-must-never-rest-clear";
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];
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
const holds = (hay: Uint8Array, needle: readonly number[]): boolean => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; }
  return false;
};
const restsClear = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean =>
  [...inner.bytes].some(([key, data]) => key.startsWith(docId) && (holds(data, [...new TextEncoder().encode(WORD)]) || MAGIC.every((b, i) => data[i] === b)));
const restsAny = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean => [...inner.bytes.keys()].some((k) => k.startsWith(docId));
/** A vessel's store: its held homes table over its rest, as the node and browser vessels bind it (moved → reseal). */
function heldRepo(inner: StorageAdapterInterface) {
  const homes = vesselHeldHomes();
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({ inner, bagOf: (id) => homes.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, waitOverSealed: true, hydrates: false });
  const repo = new Repo({ storage: store, network: [] });
  bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id), () => { store.mapMoved(); void store.reseal(); }));
  return { repo, store, homes };
}
