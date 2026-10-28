import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, emptyLarDoc, type LarDoc, type LarTiddlerChange, type LarTiddlerStore } from "@lararium/mesh";
import { AtomicMemoryStore } from "./atomic-memory-store.js";
import { ofType, open, realPort } from "./record-port-real-rig.js";

function timingLayer(synchronous: boolean): LarTiddlerStore {
  const backing = new AtomicMemoryStore("timed");
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  backing.subscribe((change) => {
    const deliver = () => { for (const listener of listeners) listener(change); };
    if (synchronous) deliver();
    else setImmediate(deliver);
  });
  return new Proxy(backing, { get(target, key) {
    if (key === "notifiesSynchronously") return synchronous ? true : undefined;
    if (key === "subscribe") return (listener: (change: LarTiddlerChange) => void) => {
      listeners.add(listener); return () => { listeners.delete(listener); };
    };
    const value = Reflect.get(target, key, target) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
  } });
}

const write = (txId: string, title: string, bag?: string) => ({ type: "port:write", portId: "p", txId,
  records: [{ title, fields: { text: title }, ...(bag ? { bag } : {}) }] });

describe("port listener timing", () => {
  test("port-late-notifying-layer: precheck refuses before any family lands; CONTROL: synchronous declaration preserves causedBy", async () => {
    const r = await realPort();
    const late = timingLayer(false);
    r.composite.addLayer({ bagId: "late", store: late, writable: true, defaultWritable: false });
    await r.send(open);
    await r.send({ type: "port:write", portId: "p", txId: "late", records: [
      { title: "WouldLand", fields: { text: "no" } }, { title: "Late", fields: { text: "no" }, bag: "late" },
    ] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "late-notifying-layer" });
    expect(await r.defaultStore.get("WouldLand")).toBeNull();
    expect(await late.get("Late")).toBeNull();
    const sync = timingLayer(true);
    r.composite.addLayer({ bagId: "sync", store: sync, writable: true, defaultWritable: false });
    await r.send(write("sync-tx", "Sync", "sync"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied" });
    expect(ofType(r.messages, "port:changes").flatMap((message) => message.entries).find((entry) => entry.title === "Sync")?.causedBy).toEqual(["sync-tx"]);
    await r.close();
  });

  test("port-real-automerge-caused-by: real layer echo names the tx; CONTROL: foreign write carries no cause", async () => {
    const repo = new Repo({ network: [] });
    const real = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "real");
    const r = await realPort();
    r.composite.addLayer({ bagId: "real", store: real, writable: true, defaultWritable: false });
    try {
      await r.send(open);
      await r.send(write("real-tx", "Real", "real"));
      await real.writeFamily([{ tiddler: { title: "Foreign", text: "outside" } }], [], { kind: "tw-local", instanceId: "foreign" });
      const entries = ofType(r.messages, "port:changes").flatMap((message) => message.entries);
      expect(entries.find((entry) => entry.title === "Real")?.causedBy).toEqual(["real-tx"]);
      expect(entries.find((entry) => entry.title === "Foreign")?.causedBy).toEqual([]);
    } finally { await r.close(); }
  });
});
