/**
 * The summons relay claims a request id before its first wait, so two deliveries of one pending summons that
 * both pass the in-flight check place the verb once; a consume that fails releases the claim, so a later
 * delivery may place it.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, NoWorkingLayerRefusal, summon, wikiSlotUri } from "@lararium/mesh";
import { heedSummons } from "../src/verb-summons.js";
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
    getTiddler: (title: string) => { const fields = this.records.get(title); return fields ? { fields: { ...fields } } : undefined; },
    deleteTiddler: (title: string) => { this.records.delete(title); },
    addEventListener: (_type: string, listener: Listener) => { this.listeners.add(listener); },
    removeEventListener: (_type: string, listener: Listener) => { this.listeners.delete(listener); },
  };
  readonly $tw = { Tiddler: class { fields: Record<string, unknown>; constructor(fields: Record<string, unknown>) { this.fields = fields; } }, wiki: this.wiki };
}

function composite(withWorking = true) {
  const daemon = new CompositeStore();
  const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
  daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: false });
  const workingBag = new MemoryTiddlerStore(wikiSlotUri("daemon", "working"));
  if (withWorking) daemon.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: workingBag, writable: true });
  return { daemon, daemonBag, workingBag };
}

function change(request: ReturnType<typeof summon>, bag = wikiSlotUri("daemon", "working")) {
  return { title: request.tiddler.title, record: request, origin: { kind: "test" as const }, bag };
}

describe("heedSummons request-id claim", () => {
  test("same-turn duplicate deliveries claim once and tombstone the summons", async () => {
    const { daemon, workingBag } = composite();
    const request = summon({ verb: "relay", args: {}, requestedBy: "did:key:caller", requestId: "same-turn" });
    await daemon.put(request, { kind: "test" });
    const seenRequestIds = new Set<string>();
    let placed = 0;
    const opts = { daemon, seenRequestIds, isInFlight: () => false, placeVerb: () => { placed++; } };
    await Promise.all([heedSummons(change(request), opts), heedSummons(change(request), opts)]);
    expect(placed).toBe(1);
    expect((await workingBag.get(request.tiddler.title))?.meta?.deleted).toBe(true);
  });

  test("CONTROL: different request ids both relay", async () => {
    const { daemon } = composite();
    const requests = ["first-id", "second-id"].map((requestId) => summon({ verb: "relay", args: {}, requestedBy: "did:key:caller", requestId }));
    for (const request of requests) await daemon.put(request, { kind: "test" });
    const seenRequestIds = new Set<string>();
    const placed: string[] = [];
    await Promise.all(requests.map((request) => heedSummons(change(request), { daemon, seenRequestIds, isInFlight: () => false, placeVerb: (invocation) => { placed.push(invocation.requestId!); } })));
    expect(placed.sort()).toEqual(["first-id", "second-id"]);
  });

  test("a failed consume releases its claim for redelivery", async () => {
    const { daemon, workingBag } = composite(false);
    const request = summon({ verb: "relay", args: {}, requestedBy: "did:key:caller", requestId: "retry-after-refusal" });
    await daemon.put(request, { kind: "test" }, { bag: DAEMON_BAG_ID });
    const seenRequestIds = new Set<string>();
    let placed = 0;
    const opts = { daemon, seenRequestIds, isInFlight: () => false, placeVerb: () => { placed++; } };
    await expect(heedSummons(change(request, DAEMON_BAG_ID), opts)).rejects.toBeInstanceOf(NoWorkingLayerRefusal);
    daemon.addLayer({ bagId: wikiSlotUri("daemon", "working"), store: workingBag, writable: true });
    expect(placed, "a refused consume placed nothing").toBe(0);
    await heedSummons(change(request, DAEMON_BAG_ID), opts);
    expect(placed).toBe(1);
  });

  test("CONTROL: through the dispatcher, a live delivery and the startup scan place one pending summons once", async () => {
    const { daemon } = composite();
    const visible = daemon.listVisible.bind(daemon);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    daemon.listVisible = async () => { const titles = await visible(); await held; return titles; };
    const registry = new VerbTable();
    const dispatcher = new VerbDispatcher({ daemonVm: new FakeWiki() as unknown as TW5Engine, daemon, registry });
    const placed: string[] = [];
    const place = dispatcher.placeVerb.bind(dispatcher);
    dispatcher.placeVerb = (request) => { placed.push(request.requestId!); return place(request); };
    registry.register("relay", async () => ({ ok: true }));
    dispatcher.start();
    const request = summon({ verb: "relay", args: {}, requestedBy: "did:key:caller", requestId: "live-and-scan" });
    await daemon.put(request, { kind: "test" });
    release();
    await dispatcher.startupScan;
    // The tombstone and the in-flight check also cover this order; the same-turn vector above binds the claim.
    expect(placed).toEqual(["live-and-scan"]);
    dispatcher.stop();
  });
});
