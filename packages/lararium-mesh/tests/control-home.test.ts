/**
 * control-home — the vessel's CONTROL document: one document, minted at founding beside the vessel's secret home and sealed
 * under the vessel's own key (operator ruling A6, 2026-11-09), named by the daemon document, held as its own store and
 * never as a recipe layer. A write while the key stays shut waits held in memory, never clear.
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import {
  CONTROL_HOME_ID, DAEMON_BAG_ID, MAILBOX_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX, WARD_AUDIT_URI_PREFIX, EFFECT_URI_PREFIX,
  controlHomeUrlOf, controlStoreOf, emptyLarDoc, expandRecipe, leaseEpochPrefix, standControlHome, wornFaceWikiBags, vesselOnlyDocIds, makeVesselOnlyDocs, storedLarRecord, type LarDoc,
  SealedDocumentStore, bindSecretHomeRest, enrollSecretHome, mintSecretHomeAddress, mintVesselDocumentId, nameControlHome, openSecretHome, vesselHeldHomes,
} from "../src/index.js";

describe("the vessel's control document", () => {
  test("vessel-only names include control and daemon bindings alone, and refresh preserves additions", () => {
    const doc = emptyLarDoc();
    for (const [title, text] of [[`${CONTROL_HOME_ID}/daemon-slot/draft/g`, "automerge:slot"], [`${CONTROL_HOME_ID}/daemon-canon/face`, "automerge:canon"], ["user/wiki", "automerge:user"]]) {
      doc.tiddlers[title] = storedLarRecord(title, { text }, "test");
    }
    expect(vesselOnlyDocIds(doc, "automerge:control")).toEqual(new Set(["control", "slot", "canon"]));
    const live = makeVesselOnlyDocs();
    live.add("secret");
    live.refresh(doc, "automerge:control");
    expect(live.has("secret")).toBe(true);
    expect(live.has("slot")).toBe(true);
    expect(live.has("user")).toBe(false);
    live.refresh(emptyLarDoc(), "automerge:control");
    expect(live.has("slot")).toBe(false);
  });
  test("a storage-less Repo (a suite's) mints one control document in memory and names it; CONTROL: a second stand returns that same document", async () => {
    const repo = new Repo({});
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    expect(controlHomeUrlOf(daemon.doc())).toBeNull();
    const first = await standControlHome(repo, daemon);
    expect(controlHomeUrlOf(daemon.doc())).toBe(first.url);
    const second = await standControlHome(repo, daemon);
    expect(second.documentId).toBe(first.documentId);
    expect(first.documentId).not.toBe(daemon.documentId);
  });

  test("the control store writes its one layer by default, and that layer names the control home", async () => {
    const repo = new Repo({});
    const control = controlStoreOf(repo.create<LarDoc>(emptyLarDoc()));
    expect(control.defaultWritableBagId()).toBe(CONTROL_HOME_ID);
    await control.put({ tiddler: { title: `${OUTCOME_URI_PREFIX}r1`, status: "done" } }, { kind: "test" });
    expect(await control.listBagsHolding(`${OUTCOME_URI_PREFIX}r1`)).toEqual([CONTROL_HOME_ID]);
  });

  test("every control family titles under the control home, never the daemon bag", () => {
    for (const prefix of [SUMMONS_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, WARD_AUDIT_URI_PREFIX, MAILBOX_URI_PREFIX, EFFECT_URI_PREFIX, leaseEpochPrefix("group")]) {
      expect(prefix.startsWith(`${CONTROL_HOME_ID}/`), prefix).toBe(true);
      expect(prefix.startsWith(`${DAEMON_BAG_ID}/`), prefix).toBe(false);
    }
  });

  test("no recipe composes the control home", () => {
    expect(expandRecipe({ wikiSlug: "daemon" })).not.toContain(CONTROL_HOME_ID);
  });

  test("THE PER-FACE BRIDGE RETIRES: the control home seals and registers under no face, lit or floor", () => {
    for (const lit of [true, false]) {
      const bags = wornFaceWikiBags({ lit });
      expect(bags.sealed).not.toContain(CONTROL_HOME_ID);
      expect(bags.registered).not.toContain(CONTROL_HOME_ID);
    }
  });

  test("a Repo that rests bytes and names no control document mints none at its stand: the founding mints it beside the home", async () => {
    const inner = memoryAdapter();
    const { repo } = heldRepo(inner);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    await expect(standControlHome(repo, daemon)).rejects.toThrow(/control-home-unavailable/);
    await repo.shutdown();
  });
});

describe("the control document seals under the vessel's key from its first byte (A6)", () => {
  test("RED: minted beside the secret home, its first byte rests sealed with no session and no face; the daemon document names it", async () => {
    const inner = memoryAdapter();
    const { repo } = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const home = await enrollSecretHome(repo, address);
    expect(home.control?.documentId).toBe(address.controlId);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemon, `automerge:${address.controlId}`);
    const control = await standControlHome(repo, daemon);
    expect(control.documentId).toBe(address.controlId);
    await controlStoreOf(control).put({ tiddler: { title: `${OUTCOME_URI_PREFIX}r1`, text: WORD } }, { kind: "test" });
    await repo.flush();
    await repo.shutdown();
    expect(restsAny(inner, address.controlId)).toBe(true);
    expect(restsClear(inner, address.controlId)).toBe(false);
  });

  test("RED: a write while the vessel's key stays shut waits held in memory, never clear; once the key opens, the rest merges in and the write lands sealed", async () => {
    const inner = memoryAdapter();
    // FOUNDING: home and control enrolled, one record written, the address kept.
    const first = heldRepo(inner);
    const address = { ...mintSecretHomeAddress(), controlId: mintVesselDocumentId() };
    const founded = await enrollSecretHome(first.repo, address);
    controlStoreOf(founded.control!);
    founded.control!.change((d) => { d.tiddlers["lar:///ha.ka.ba/bags/control/founded"] = storedLarRecord("lar:///ha.ka.ba/bags/control/founded", { text: "founded" }, "test"); });
    const daemonDoc = first.repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemonDoc, `automerge:${address.controlId}`);
    const daemonBytes = (await import("@automerge/automerge")).save(daemonDoc.doc());
    await first.repo.flush();
    await first.repo.shutdown();
    const restedBefore = new Map(inner.bytes);

    // THE LOCKED BOOT: the daemon document names the control document; no key stands.
    const locked = heldRepo(inner);
    const daemon = locked.repo.import<LarDoc>(daemonBytes);
    const control = await standControlHome(locked.repo, daemon);
    expect(control.documentId).toBe(address.controlId);
    control.change((d) => { d.tiddlers["lar:///ha.ka.ba/bags/control/floor-write"] = storedLarRecord("lar:///ha.ka.ba/bags/control/floor-write", { text: WORD }, "test"); });
    await locked.repo.flush();
    // Nothing new rested for the control document: the floor's write waits in memory.
    for (const [key, data] of inner.bytes) if (key.startsWith(address.controlId)) expect(restedBefore.get(key)).toEqual(data);
    expect(restsClear(inner, address.controlId)).toBe(false);

    // THE KEY OPENS: the home opens on the same rest; the founding's record merges in and the floor's write rests sealed.
    await openSecretHome(locked.repo, address);
    for (let i = 0; i < 100 && !control.doc().tiddlers["lar:///ha.ka.ba/bags/control/founded"]; i++) await new Promise((r) => setTimeout(r, 10));
    expect(control.doc().tiddlers["lar:///ha.ka.ba/bags/control/founded"]).toBeDefined();
    expect(control.doc().tiddlers["lar:///ha.ka.ba/bags/control/floor-write"]).toBeDefined();
    for (let i = 0; i < 100 && locked.store.waiting(address.controlId) > 0; i++) await new Promise((r) => setTimeout(r, 10));
    await locked.repo.flush();
    expect(locked.store.waiting(address.controlId)).toBe(0);
    await locked.repo.shutdown();
    expect(restsClear(inner, address.controlId)).toBe(false);

    // A FRESH UNLOCKED HOLDER reads both records back.
    const again = heldRepo(inner);
    await openSecretHome(again.repo, address);
    const reread = await again.repo.find<LarDoc>(`automerge:${address.controlId}` as never);
    expect(JSON.stringify(reread.doc())).toContain(WORD);
    expect(reread.doc().tiddlers["lar:///ha.ka.ba/bags/control/founded"]).toBeDefined();
    await again.repo.shutdown();
  });
});

const WORD = "a-control-write-that-must-never-rest-clear";
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
