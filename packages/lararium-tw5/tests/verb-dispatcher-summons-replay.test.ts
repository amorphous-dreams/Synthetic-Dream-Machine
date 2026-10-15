import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, summon, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";

type Listener = (changed: Record<string, { deleted?: boolean }>) => void;
class FakeWiki {
  readonly records = new Map<string, Record<string, unknown>>();
  readonly listeners = new Set<Listener>();
  readonly wiki = {
    addTiddler: (value: { fields?: Record<string, unknown> } | Record<string, unknown>) => {
      const fields = "fields" in value && value.fields ? value.fields : value as Record<string, unknown>;
      const title = String(fields.title);
      this.records.set(title, { ...fields });
      for (const listener of this.listeners) listener({ [title]: {} });
    },
    getTiddler: (title: string) => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string) => { this.records.delete(title); },
    addEventListener: (_type: string, listener: Listener) => { this.listeners.add(listener); },
    removeEventListener: (_type: string, listener: Listener) => { this.listeners.delete(listener); },
  };
  readonly $tw = { Tiddler: class { fields: Record<string, unknown>; constructor(fields: Record<string, unknown>) { this.fields = fields; } }, wiki: this.wiki };
}
function daemonWithWorking() {
  const daemon = new CompositeStore();
  daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true, defaultWritable: false });
  daemon.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: new MemoryTiddlerStore(wikiSlotUri("daemon", "working")), writable: true, defaultWritable: true });
  return daemon;
}
/** Records every summons the dispatcher places, and resolves `firstRun` when a handler first runs. */
function watch(dispatcher: VerbDispatcher, registry: VerbTable) {
  const placed: string[] = [];
  const place = dispatcher.placeVerb.bind(dispatcher);
  dispatcher.placeVerb = (request) => { placed.push(request.requestId!); return place(request); };
  let ran!: () => void;
  const firstRun = new Promise<void>((resolve) => { ran = resolve; });
  registry.register("replayed", async () => { ran(); return { ok: true }; });
  return { placed, firstRun };
}

describe("dispatcher startup summons replay", () => {
  test("pending persisted summons dispatch once and a tombstoned summons stays silent", async () => {
    const daemon = daemonWithWorking();
    const pending = summon({ verb: "replayed", args: {}, requestedBy: "did:key:caller", requestId: "persisted-pending" });
    const consumed = summon({ verb: "replayed", args: {}, requestedBy: "did:key:caller", requestId: "persisted-consumed" });
    await daemon.put(pending, { kind: "test" });
    await daemon.put(consumed, { kind: "test" });
    await daemon.tombstoneInBag(wikiSlotUri("daemon", "working"), consumed.tiddler.title, { kind: "test" });
    const tw5 = new FakeWiki();
    const registry = new VerbTable();
    const dispatcher = new VerbDispatcher({ daemonVm: tw5 as unknown as TW5Engine, daemon, registry });
    const seen = watch(dispatcher, registry);
    dispatcher.start();
    await dispatcher.startupScan;
    await seen.firstRun;
    expect(seen.placed).toEqual(["persisted-pending"]);
    expect((await daemon.getLive(pending.tiddler.title))).toBeNull();
    dispatcher.stop();

    const fresh = new VerbDispatcher({ daemonVm: new FakeWiki() as unknown as TW5Engine, daemon, registry });
    const again = watch(fresh, new VerbTable());
    fresh.start();
    await fresh.startupScan;
    expect(again.placed, "a heeded summons fired again after a restart").toEqual([]);
    fresh.stop();
  });

  test("CONTROL live delivery dispatches once", async () => {
    const daemon = daemonWithWorking();
    const tw5 = new FakeWiki();
    const registry = new VerbTable();
    const dispatcher = new VerbDispatcher({ daemonVm: tw5 as unknown as TW5Engine, daemon, registry });
    const seen = watch(dispatcher, registry);
    dispatcher.start();
    const live = summon({ verb: "replayed", args: {}, requestedBy: "did:key:caller", requestId: "during-scan" });
    await daemon.put(live, { kind: "test" });
    await seen.firstRun;
    await dispatcher.startupScan;
    expect(seen.placed).toEqual(["during-scan"]);
    dispatcher.stop();
  });

  test("the request-id claim deduplicates a live arrival against the startup snapshot", async () => {
    const daemon = daemonWithWorking();
    const listVisible = daemon.listVisible.bind(daemon);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    daemon.listVisible = async () => { const titles = await listVisible(); await held; return titles; };
    const tw5 = new FakeWiki();
    const registry = new VerbTable();
    const dispatcher = new VerbDispatcher({ daemonVm: tw5 as unknown as TW5Engine, daemon, registry });
    const seen = watch(dispatcher, registry);
    dispatcher.start();
    // The summons lands while the scan is held: live delivery heeds it, then the scan meets it again.
    const live = summon({ verb: "replayed", args: {}, requestedBy: "did:key:caller", requestId: "scan-race" });
    await daemon.put(live, { kind: "test" });
    await seen.firstRun;
    release();
    await dispatcher.startupScan;
    expect(seen.placed).toEqual(["scan-race"]);
    dispatcher.stop();
  });

  test("the startup scan reads only the summons prefix, never another title", async () => {
    const daemon = daemonWithWorking();
    await daemon.put({ tiddler: { title: "lar:///ha.ka.ba/t/unrelated", text: "x" } }, { kind: "test" });
    const resolved: string[] = [];
    const resolveTopmost = daemon.resolveTopmost.bind(daemon);
    daemon.resolveTopmost = async (title: string) => { resolved.push(title); return resolveTopmost(title); };
    const dispatcher = new VerbDispatcher({ daemonVm: new FakeWiki() as unknown as TW5Engine, daemon, registry: new VerbTable() });
    dispatcher.start();
    await dispatcher.startupScan;
    expect(resolved).toEqual([]);
    dispatcher.stop();
  });
});
