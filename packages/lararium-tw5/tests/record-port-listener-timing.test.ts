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
  test("port-token-outlives-notify: the store notifies inside writeFamily, before it resolves, so the token still names the tx; CONTROL: a foreign write carries no cause", async () => {
    const repo = new Repo({ network: [] });
    const real = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "real");
    const order: string[] = [];
    real.subscribe((change) => order.push(`notify:${change.title}`));
    const inner = real.writeFamily.bind(real);
    real.writeFamily = async (...args: Parameters<typeof inner>) => {
      order.push("write:start"); const result = await inner(...args); order.push("write:resolved"); return result;
    };
    const r = await realPort();
    r.composite.addLayer({ bagId: "real", store: real, writable: true, defaultWritable: false });
    try {
      await r.send(open);
      await r.send(write("order-tx", "Ordered", "real"));
      expect(order).toEqual(["write:start", "notify:Ordered", "write:resolved"]);   // measured: the change fires before the write promise resolves
      const entries = ofType(r.messages, "port:changes").flatMap((message) => message.entries);
      expect(entries.filter((entry) => entry.title === "Ordered").map((entry) => entry.causedBy)).toEqual([["order-tx"]]);
      await real.writeFamily([{ tiddler: { title: "Foreign", text: "outside" } }], [], { kind: "tw-local", instanceId: "foreign" });
      expect(ofType(r.messages, "port:changes").flatMap((message) => message.entries).find((entry) => entry.title === "Foreign")?.causedBy).toEqual([]);
    } finally { await r.close(); }
  });
  test("port-local-write-echoes-once: a write the store makes never re-enters as a remote change after the debounce; CONTROL: a change made on the handle outside the store arrives as crdt-remote", async () => {
    const repo = new Repo({ network: [] });
    const real = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "real");
    const r = await realPort();
    r.composite.addLayer({ bagId: "real", store: real, writable: true, defaultWritable: false });
    const origins: string[] = [];
    r.composite.subscribe((change) => { if (change.title === "Once" || change.title === "Remote") origins.push(`${change.title}:${change.origin.kind}${change.redelivery ? ":redelivery" : ""}`); });
    const entriesOf = (title: string) => ofType(r.messages, "port:changes").flatMap((message) => message.entries).filter((entry) => entry.title === title);
    try {
      await r.send(open);
      await r.send(write("once-tx", "Once", "real"));
      await new Promise((resolve) => setTimeout(resolve, 200));                       // past the provider's 40 ms debounce
      expect(entriesOf("Once").map((entry) => entry.causedBy)).toEqual([["once-tx"]]);
      // The store's debounced wave re-reads the title under the port's own origin, marked a redelivery, and the page never sees it.
      expect(origins).toEqual(["Once:tw-local", "Once:tw-local:redelivery"]);
      (real as unknown as { handle: { change(fn: (doc: LarDoc) => void): void } }).handle.change((doc) => {
        (doc.tiddlers as Record<string, unknown>)["Remote"] = { tiddler: { title: "Remote", text: "from elsewhere" } };
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(origins.filter((entry) => entry.startsWith("Remote"))).toEqual(["Remote:crdt-remote"]);
      expect(entriesOf("Remote").map((entry) => entry.causedBy)).toEqual([[]]);
    } finally { await r.close(); }
  });
  test("port-other-writer-echoes-once: a write by another writer on the store (a CLI put, no port) reaches the page exactly once, with no cause, after the debounce; CONTROL: its debounced redelivery still reaches a composite subscriber under the writer's origin", async () => {
    const repo = new Repo({ network: [] });
    const real = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), "real");
    const r = await realPort();
    r.composite.addLayer({ bagId: "real", store: real, writable: true, defaultWritable: false });
    const origins: string[] = [];
    r.composite.subscribe((change) => { if (change.title === "Cli") origins.push(`${change.origin.kind}${change.redelivery ? ":redelivery" : ""}`); });
    try {
      await r.send(open);
      await real.writeFamily([{ tiddler: { title: "Cli", text: "from the CLI" } }], [], { kind: "lares-verb", requestId: "x" });
      await new Promise((resolve) => setTimeout(resolve, 200));                       // past the provider's 40 ms debounce
      const entries = ofType(r.messages, "port:changes").flatMap((message) => message.entries).filter((entry) => entry.title === "Cli");
      expect(entries.map((entry) => entry.causedBy)).toEqual([[]]);
      expect(entries[0]?.fields).toMatchObject({ text: "from the CLI" });
      expect(origins).toEqual(["lares-verb", "lares-verb:redelivery"]);
    } finally { await r.close(); }
  });
});
