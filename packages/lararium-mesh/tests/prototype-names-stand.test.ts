/**
 * prototype-names-stand — `constructor` and `prototype` stand as ordinary names; `__proto__` alone refuses.
 *
 * Harden refused all three keys by name. The operator's ruling (2026-11-02, "Approve the narrowing lane")
 * narrows the law: no guard may block a legitimate user choice, and only `__proto__` rewires a prototype
 * (the phantom-record attack). A `constructor` or `prototype` key answers only where a map holds it as its
 * own, because every by-key read rides the own-property door (`ownEntry` · `hasOwnEntry`), and the scan in
 * `prototype-key-maps.test.ts` holds that door for `tiddlers` and `blobs`.
 *
 *   RED  a tiddler titled `constructor` (or `prototype`), carrying the other name as a field, round-trips
 *        byte for byte through put, an island sync, a storage reload and the projection bus.
 *   RED  a MISSING `constructor` title reads absent through every reader: the store's get, readNow, getAt,
 *        listVisible and parallelDrafts, the island's store, the composite, plainEntries.
 *   CONTROL  `__proto__` still refuses by name everywhere: a title, a field, a nested key, a raw-change chunk,
 *        a storage chunk, and a 3.5.0 local write names its refusal, never a bare RangeError.
 */
import { describe, expect, test } from "vitest";
import { Repo, type StorageAdapterInterface, type StorageKey, type Chunk } from "@automerge/automerge-repo";
import { init, change, getChanges, encodeSyncMessage, save, from } from "@automerge/automerge";
import { EventEmitter } from "node:events";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { CompositeStore } from "../src/composite-store.js";
import { attachMessageChannelSync, makeIslandRepo } from "../src/island-repo.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { shoreInbound, shoreStorage, syncMessagePrototypeKey, chunkPrototypeKey } from "../src/prototype-key-shore.js";
import { carriesPrototypeKeyReason } from "../src/gated-sync-leg.js";
import { storedRecord, storedValue } from "../src/stored-record.js";
import { storableTitleFault } from "../src/title-law.js";
import { isVerbRefusal } from "../src/verb-refusal.js";
import { ownEntry, hasOwnEntry, isPrototypeKey, plainEntries, prototypeKeyFault, PROTOTYPE_KEYS } from "../src/stored-value.js";
import type { LarTiddlerChange, LarTiddlerRecord } from "../src/tiddler-store.js";

const ORIGIN = { kind: "lares-verb", requestId: "narrow" } as const;
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

/** A record titled `title` that also names both prototype words as fields (each its own value). */
const named = (title: string): LarTiddlerRecord => ({
  tiddler: { title, text: `the ${title} body`, constructor: "a field a person named constructor", prototype: "a field a person named prototype" } as never,
});
/** The record as bytes, keys sorted at every depth: what "byte for byte" compares. */
const bytesOf = (r: LarTiddlerRecord | null | undefined): string => JSON.stringify(r?.tiddler ?? null, (_k, v: unknown) =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v);

/** A storage adapter over one Map: what a node store or IndexedDB answers, with no shore of its own. */
function memoryStorage(): StorageAdapterInterface {
  const chunks = new Map<string, Uint8Array>();
  const k = (key: StorageKey): string => key.join("\u0000");
  return {
    async load(key) { return chunks.get(k(key)); },
    async save(key, data) { chunks.set(k(key), data); },
    async remove(key) { chunks.delete(k(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      const p = k(prefix);
      return [...chunks].filter(([key]) => key === p || key.startsWith(p + "\u0000")).map(([key, data]) => ({ key: key.split("\u0000"), data }));
    },
    async removeRange(prefix) { const p = k(prefix); for (const key of [...chunks.keys()]) if (key === p || key.startsWith(p + "\u0000")) chunks.delete(key); },
  };
}

async function until<T>(read: () => Promise<T | null> | T | null, ms = 3_000): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (v !== null || Date.now() > end) return v;
    await tick();
  }
}

describe.each(["constructor", "prototype"])("RED: a tiddler titled `%s` stands, byte for byte", (title) => {
  test("the title law and the key set name it ordinary", () => {
    expect(isPrototypeKey(title)).toBe(false);
    expect(storableTitleFault(title)).toBeNull();
    expect(() => storedRecord(named(title))).not.toThrow();
  });

  test("put, then the projection bus, the island sync and a storage reload, each read back the same bytes", async () => {
    const storage = memoryStorage();
    const house = new Repo({ network: [], storage: shoreStorage(storage), peerId: "hearth" as never });
    const handle = house.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(handle, "lar:///narrow/bag");
    const seen: LarTiddlerChange[] = [];
    store.addProjection({ onUriChanged: (c) => { if (c.title === title) seen.push(c); } });

    // PUT
    await store.put(named(title), ORIGIN);
    const put = await store.get(title);
    expect(bytesOf(put)).toBe(bytesOf(named(title)));
    expect((await store.listVisible())).toContain(title);

    // THE PROJECTION BUS: every projection (the disk projector, the wiki's adaptor) rides this change.
    expect(seen.length).toBeGreaterThan(0);
    expect(bytesOf(seen.at(-1)!.record)).toBe(bytesOf(named(title)));

    // THE ISLAND SYNC: the shore stands on both legs (`attachMessageChannelSync` · `makeIslandRepo`).
    const isle = new MessageChannel();
    attachMessageChannelSync(house, isle.port1);
    const island = makeIslandRepo({ syncPort: isle.port2, peerId: "island" });
    try {
      const islandHandle = await island.find<LarDoc>(handle.url);
      const islandStore = new AutomergeDocStore(islandHandle);
      const synced = await until(() => islandStore.get(title));
      expect(bytesOf(synced)).toBe(bytesOf(named(title)));

      // THE STORAGE RELOAD: a fresh Repo over the same chunks, through the storage shore.
      await house.flush();
      const again = new Repo({ network: [], storage: shoreStorage(storage), peerId: "hearth-2" as never });
      try {
        const reloaded = new AutomergeDocStore(await again.find<LarDoc>(handle.url));
        expect(bytesOf(await reloaded.get(title))).toBe(bytesOf(named(title)));
      } finally { await again.shutdown(); }
    } finally {
      isle.port1.close(); isle.port2.close();
      await Promise.allSettled([house.shutdown(), island.shutdown()]);
    }
  });

  test("a raw change and a stored chunk carrying the name pass both shores", () => {
    const doc = change(change(init<{ tiddlers: Record<string, unknown> }>(), (d) => { d.tiddlers = {}; }), (d) => { d.tiddlers[title] = { tiddler: { title } }; });
    const msg = encodeSyncMessage({ heads: [], need: [], have: [], changes: getChanges(init(), doc) } as never);
    expect(syncMessagePrototypeKey(msg)).toBeNull();
    expect(carriesPrototypeKeyReason({ type: "sync", senderId: "p", targetId: "q", documentId: "d", data: msg } as never)).toBeNull();
    expect(chunkPrototypeKey(save(doc))).toBeNull();
    expect(prototypeKeyFault({ tiddlers: { [title]: { tiddler: { title, constructor: "f", prototype: "g" } } } })).toBeNull();
  });
});

describe("RED: a MISSING `constructor` title reads absent through every reader, never an inherited function", () => {
  test("store get · readNow · getAt · listVisible · parallelDrafts · the island · the composite · plainEntries", async () => {
    const house = new Repo({ network: [], peerId: "hearth" as never });
    const handle = house.create<LarDoc>(emptyLarDoc());
    const store = new AutomergeDocStore(handle, "lar:///narrow/bag");
    await store.put({ tiddler: { title: "lar:///narrow/real", text: "x" } }, ORIGIN);
    const isle = new MessageChannel();
    attachMessageChannelSync(house, isle.port1);
    const island = makeIslandRepo({ syncPort: isle.port2, peerId: "island" });
    try {
      for (const missing of ["constructor", "prototype", "toString", "hasOwnProperty"]) {
        expect(await store.get(missing), missing).toBeNull();
        expect(store.readNow(missing).record, missing).toBeNull();
        expect(store.getAt(missing, store.headsNow()!), missing).toBeNull();
        expect(store.parallelDrafts(missing), missing).toEqual([]);
        expect(ownEntry(handle.doc()!.tiddlers, missing), missing).toBeUndefined();
        expect(hasOwnEntry(handle.doc()!.tiddlers, missing), missing).toBe(false);
      }
      expect(await store.listVisible()).toEqual(["lar:///narrow/real"]);
      expect(plainEntries(handle.doc()!.tiddlers).map(([t]) => t)).toEqual(["lar:///narrow/real"]);

      const islandStore = new AutomergeDocStore(await island.find<LarDoc>(handle.url));
      expect(await until(() => islandStore.get("lar:///narrow/real"))).not.toBeNull();
      expect(await islandStore.get("constructor")).toBeNull();
      expect(islandStore.parallelDrafts("constructor")).toEqual([]);

      const composite = new CompositeStore();
      composite.addLayer({ bagId: "lar:///narrow/bag", store, writable: true });
      expect(await composite.get("constructor")).toBeNull();
    } finally {
      isle.port1.close(); isle.port2.close();
      await Promise.allSettled([house.shutdown(), island.shutdown()]);
    }
  });
});

describe("CONTROL: `__proto__` alone refuses by name, on every path", () => {
  test("the key set holds `__proto__` and nothing else", () => {
    expect([...PROTOTYPE_KEYS]).toEqual(["__proto__"]);
    expect(isPrototypeKey("__proto__")).toBe(true);
  });

  test("as a title, a field, a nested key", () => {
    expect(storableTitleFault("__proto__")).toMatch(/^prototype-key-title/);
    for (const json of ['{"title":"lar:///x","__proto__":"v"}', '{"title":"lar:///x","nested":{"__proto__":"v"}}']) {
      let thrown: unknown;
      try { storedRecord({ tiddler: JSON.parse(json) }); } catch (e) { thrown = e; }
      expect(isVerbRefusal(thrown) && (thrown as { reason: string }).reason, json).toBe("prototype-key");
    }
    expect(() => storedValue(JSON.parse('{"a":[{"__proto__":1}]}'))).toThrow(/__proto__/);
    expect(prototypeKeyFault(JSON.parse('{"tiddlers":{"real":{"tiddler":{"__proto__":"v"}}}}'))).toMatch(/__proto__/);
  });

  test("a raw-change chunk and a storage chunk carrying `__proto__` refuse at both shores", async () => {
    const poisoned = new Uint8Array(Buffer.from(
      "hW9KgxtHT78AoQIBEJG2bhA4/3CkEdPXXPS2Z3IBz7Rh8PLy5jblA7EAQQEWi/18WNVB8pHwYPxn4LT79QIHAQIDAhMDIwdAA0MCVgIMAQQCEBEMExMVPiECIwo0BEIMVghXGIABAgIAAgF+Bxh+07Wg1wYAfgABfwACBwABHgAAAQIBfwIEA38IAgkGCg4LAAUDAAAEBQAAAQ0AAAR+AAQCAQADfnoMBAF+cBIMAXwIdGlkZGxlcnMJX19wcm90b19fBHJlYWwFdGl0bGUABH0ObGFyOi8vL3BoYW50b20EdGV4dAV0aXRsZQAUHwB9AQd6BQF/AhYBBAQDFAMAfwQEAX8AAgQUAQQABBYDABQWcmVhbGZvcmdlZGxhcjovLy9waGFudG9tHwAB",
      "base64"));
    expect(chunkPrototypeKey(poisoned)).toMatch(/__proto__/);
    const adapter = shoreStorage({ async load() { return poisoned; }, async loadRange() { return [{ key: ["d", "snapshot", "x"], data: poisoned }]; } });
    await expect(adapter.load(["d", "snapshot", "x"])).rejects.toMatchObject({ reason: "prototype-key" });
    const msg = encodeSyncMessage({ heads: [], need: [], have: [], changes: [poisoned] } as never);
    const net = new EventEmitter();
    const passed: unknown[] = [];
    shoreInbound(net as never);
    net.on("message", (m) => passed.push(m));
    net.emit("message", { type: "sync", senderId: "p", targetId: "q", documentId: "d", data: msg });
    expect(passed).toEqual([]);
  });

  test("a 3.5.0 local `__proto__` write names its refusal, never a bare RangeError", async () => {
    const repo = new Repo();
    const store = new AutomergeDocStore(repo.create<LarDoc>({ schemaVersion: "0.1", tiddlers: {} } as never));
    for (const record of [{ tiddler: { title: "__proto__" } }, JSON.parse('{"tiddler":{"title":"lar:///t","__proto__":"v"}}'), JSON.parse('{"tiddler":{"title":"lar:///t"},"meta":{"__proto__":"v"}}')]) {
      let thrown: unknown;
      try { await store.put(record, ORIGIN); } catch (e) { thrown = e; }
      expect(thrown).not.toBeInstanceOf(RangeError);
      expect(isVerbRefusal(thrown)).toBe(true);
    }
    const doc = from<{ tiddlers: Record<string, unknown> }>({ tiddlers: {} });
    let caught: unknown;
    try { change(doc, (d) => { d.tiddlers["__proto__"] = storedRecord({ tiddler: { title: "__proto__" } }); }); } catch (e) { caught = e; }
    expect(isVerbRefusal(caught)).toBe(true);
    await repo.shutdown();
  });
});
