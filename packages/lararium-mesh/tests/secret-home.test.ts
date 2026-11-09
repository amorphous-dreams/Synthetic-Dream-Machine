/**
 * secret-home — the vessel's SECRET document rests sealed under its held key from its first byte (placement over
 * patterns, operator ruling 2026-11-09): it maps onto the rest BEFORE its first write, no session or face need stand, and
 * a Repo whose holder bound no sealed rest refuses by name with nothing written.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { utf8Bytes } from "../src/crypto.js";
import { SealedDocumentStore } from "../src/sealed-doc-store.js";
import { mintHeldRestKey, type HeldRestKey } from "../src/held-rest-key.js";
import {
  bindSecretHomeRest, decodeSecretHomeAddress, encodeSecretHomeAddress, enrollSecretHome, mintSecretHomeAddress, openSecretHome,
  secretHomeRestOf, type SecretHomeRest,
} from "../src/secret-home.js";
import { SECRET_HOME_ID } from "../src/lar-uris.js";
import { storedRecord } from "../src/stored-record.js";
import { attachMessageChannelSync, makeIslandRepo } from "../src/island-repo.js";
import { islandSecretHome, vesselHeldHomes, enrollBesideSecretHome } from "../src/secret-home.js";
import { CONTROL_HOME_ID } from "../src/lar-uris.js";

const WORD = "the-group-secret-seal-rides-here";
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
  [...inner.bytes].some(([key, data]) => key.startsWith(docId) && (holds(data, [...utf8Bytes(WORD)]) || holds(data, MAGIC)));
const restsAny = (inner: { bytes: Map<string, Uint8Array> }, docId: string): boolean => [...inner.bytes.keys()].some((k) => k.startsWith(docId));

/** A direct holder's store: no session, no face, no island. Its one rest maps only what enrollment named. */
function holderStore(inner: StorageAdapterInterface, opts: { readonly lies?: boolean } = {}) {
  const held = new Map<string, HeldRestKey>();
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  const store = new SealedDocumentStore({
    inner,
    bagOf: (id) => { const key = held.get(id); return key ? { bagId: SECRET_HOME_ID, face: null, held: key } : null; },
    sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, refuseClearOverSealed: true,
  });
  const rest: SecretHomeRest = {
    // A LYING REST (the instrument's own check): it answers sealed and maps nothing.
    enroll: (documentId, key) => { if (!opts.lies) held.set(documentId, key); },
    restsSealed: async (documentId) => opts.lies ? true : store.holdsSealed(documentId),
    enrollBeside: () => false,
  };
  return { store, rest };
}

const writeSecret = (handle: { change(fn: (d: { tiddlers: Record<string, unknown> }) => void): void }) =>
  handle.change((d) => { d.tiddlers["lar:///ha.ka.ba/bags/secret/seal/g"] = storedRecord({ tiddler: { title: "lar:///ha.ka.ba/bags/secret/seal/g", text: WORD }, meta: {} }) as never; });

describe("the vessel's secret home rests sealed from its first byte", () => {
  it("CONTROL: a rest that maps nothing lets the same write land clear — the instrument sees clear bytes", async () => {
    const inner = memoryAdapter();
    const { store, rest } = holderStore(inner, { lies: true });
    const repo = new Repo({ storage: store, network: [] });
    bindSecretHomeRest(repo, rest);
    const address = mintSecretHomeAddress();
    const home = await enrollSecretHome(repo, address);
    writeSecret(home.handle);
    await repo.flush();
    await repo.shutdown();
    expect(restsClear(inner, address.documentId)).toBe(true);
  });

  it("an enrolled home rests sealed with no session standing; its held key alone reopens it after a restart", async () => {
    const inner = memoryAdapter();
    const first = holderStore(inner);
    const repo = new Repo({ storage: first.store, network: [] });
    bindSecretHomeRest(repo, first.rest);
    const address = mintSecretHomeAddress();
    const home = await enrollSecretHome(repo, address);
    expect(await home.rest.assertSealed()).toBe(true);
    writeSecret(home.handle);
    await repo.flush();
    await repo.shutdown();
    expect(restsAny(inner, address.documentId)).toBe(true);
    expect(restsClear(inner, address.documentId)).toBe(false);

    // The address round-trips through its custody row's bytes; a fresh holder reopens the home with it.
    const kept = decodeSecretHomeAddress(encodeSecretHomeAddress(address))!;
    const second = holderStore(inner);
    const again = new Repo({ storage: second.store, network: [] });
    bindSecretHomeRest(again, second.rest);
    const reopened = await openSecretHome(again, kept);
    expect(JSON.stringify(reopened.handle.doc())).toContain(WORD);
    await again.shutdown();
  });

  it("another held key opens nothing: the home refuses by name and no fresh document replaces it", async () => {
    const inner = memoryAdapter();
    const first = holderStore(inner);
    const repo = new Repo({ storage: first.store, network: [] });
    bindSecretHomeRest(repo, first.rest);
    const address = mintSecretHomeAddress();
    writeSecret((await enrollSecretHome(repo, address)).handle);
    await repo.flush();
    await repo.shutdown();
    const before = new Map(inner.bytes);

    const thief = holderStore(inner);
    const stranger = new Repo({ storage: thief.store, network: [] });
    bindSecretHomeRest(stranger, thief.rest);
    await expect(openSecretHome(stranger, { documentId: address.documentId, key: mintHeldRestKey() })).rejects.toThrow(/secret-home-unavailable/);
    await stranger.shutdown();
    expect(inner.bytes).toEqual(before);
  });

  it("RED ORDER: a Repo whose holder bound no sealed rest refuses enrollment by name, with no byte of the home written", async () => {
    const inner = memoryAdapter();
    const { store } = holderStore(inner);
    const repo = new Repo({ storage: store, network: [] });
    expect(secretHomeRestOf(repo)).toBeNull();
    const address = mintSecretHomeAddress();
    await expect(enrollSecretHome(repo, address)).rejects.toThrow(/secret-home-unavailable/);
    await repo.flush();
    await repo.shutdown();
    expect(restsAny(inner, address.documentId)).toBe(false);
  });

  it("a clear chunk resting under a held home refuses by name; it never reaches the engine as the document", async () => {
    const inner = memoryAdapter();
    const address = mintSecretHomeAddress();
    await inner.save([address.documentId, "incremental", "aa"], Uint8Array.from([...MAGIC, 0, 0, 0, 0, 0]));
    const mapped = new SealedDocumentStore({
      inner, bagOf: () => ({ bagId: SECRET_HOME_ID, face: null, held: address.key }), sessionFace: () => null, sessionOf: () => null,
      seal: async () => ({ refusal: "signer-unavailable" }) as never, open: async () => ({ refusal: "signer-unavailable" }) as never,
    });
    await expect(mapped.load([address.documentId, "incremental", "aa"])).rejects.toThrow(/held-clear-at-rest/);
  });

  it("a Repo binds one rest: a second bind refuses", () => {
    const { rest } = holderStore(memoryAdapter());
    const repo = new Repo({ network: [] });
    bindSecretHomeRest(repo, rest);
    expect(() => bindSecretHomeRest(repo, rest)).toThrow(/already bound/);
  });

  it("THE DAEMON ISLAND'S DOOR: the island reaches the home by sync, asks the vessel's rest before it acts, and its write rests sealed at the vessel", async () => {
    const inner = memoryAdapter();
    const holder = holderStore(inner);
    const vessel = new Repo({ storage: holder.store, network: [], sharePolicy: async () => true });
    bindSecretHomeRest(vessel, holder.rest);
    const home = await enrollSecretHome(vessel, mintSecretHomeAddress());
    const { port1, port2 } = new MessageChannel();
    const island = makeIslandRepo({ syncPort: port1 as never });
    const detach = attachMessageChannelSync(vessel, port2 as never);
    try {
      const door = islandSecretHome(island, home.url, (documentId) => holder.rest.restsSealed(documentId));
      expect(await door.rest.assertSealed()).toBe(true);
      const title = `${SECRET_HOME_ID}/cap/island/written`;
      await door.store.put({ tiddler: { title, text: WORD }, meta: {} } as never, { kind: "lares-verb", requestId: "island-cap" });
      expect((await door.store.listVisible())).toContain(title);
      for (let i = 0; i < 100 && !home.handle.doc().tiddlers[title]; i++) await new Promise((r) => setTimeout(r, 20));
      expect(home.handle.doc().tiddlers[title]).toBeDefined();
      await vessel.flush();
      expect(restsClear(inner, home.handle.documentId)).toBe(false);
      // A home the vessel's rest does not hold sealed answers false: the Keyhive event store refuses on that answer.
      const stranger = islandSecretHome(island, home.url, async () => false);
      expect(await stranger.rest.assertSealed()).toBe(false);
    } finally { detach(); port1.close(); port2.close(); await island.shutdown(); await vessel.shutdown(); }
  });

  it("VESSEL-SCOPED CLASSIFICATION BESIDE THE HOME: the control document maps under the vessel's held key, bound to its own bag, only once the home's key stands", async () => {
    const inner = memoryAdapter();
    const homes = vesselHeldHomes();
    const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
    const store = new SealedDocumentStore({ inner, bagOf: (id) => homes.bagOf(id), sessionFace: () => null, sessionOf: () => null, seal: refuse, open: refuse, refuseClearOverSealed: true });
    const repo = new Repo({ storage: store, network: [] });
    bindSecretHomeRest(repo, homes.rest((id) => store.holdsSealed(id)));
    const control = mintSecretHomeAddress().documentId;
    // No home's key stands yet: nothing maps, and the caller keeps its own class.
    expect(enrollBesideSecretHome(repo, control, CONTROL_HOME_ID)).toBe(false);
    expect(homes.bagOf(control)).toBeNull();
    const home = await enrollSecretHome(repo, mintSecretHomeAddress());
    expect(enrollBesideSecretHome(repo, control, CONTROL_HOME_ID)).toBe(true);
    expect(homes.bagOf(control)?.bagId).toBe(CONTROL_HOME_ID);
    expect(homes.has(control)).toBe(true);
    expect([...homes.ids()].sort()).toEqual([home.handle.documentId, control].sort());
    // The secret home's own bag never re-enrolls beside itself.
    expect(enrollBesideSecretHome(repo, mintSecretHomeAddress().documentId, SECRET_HOME_ID)).toBe(false);
    const handle = repo.import<{ tiddlers: Record<string, unknown> }>((await import("@automerge/automerge")).save((await import("@automerge/automerge")).from({ tiddlers: {} })), { docId: control as never });
    writeSecret(handle as never);
    await repo.flush();
    await repo.shutdown();
    expect(restsClear(inner, control)).toBe(false);
    expect(restsClear(inner, home.handle.documentId)).toBe(false);
  });
});
