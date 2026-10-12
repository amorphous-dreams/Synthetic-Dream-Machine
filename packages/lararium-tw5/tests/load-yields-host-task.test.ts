import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { LOAD_YIELD_QUANTUM, registerActionReactors } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";

const BAG = "lar:///ha.ka.ba/bags/load-yields";
const allowCap = async (_access: CapabilityAccess, _bag: string): Promise<CapabilityVerifyResult> => ({ ok: true });

function context(composite: CompositeStore): VerbContext {
  const invocation: Verb = {
    requestId: "req-load-yields", title: "lar:///lararium.local.vm/verbs/req-load-yields",
    action: "LOAD", args: {}, targets: [], batchMode: "best-effort", status: "pending",
    requestedBy: "operator-test", requestedAt: "2026-10-12T00:00:00Z",
  } as Verb;
  return { daemon: composite, invocation, cap: allowCap };
}

class CountingStore extends MemoryTiddlerStore {
  landed: string[] = [];
  onLanding?: (count: number) => void;

  override async put(record: Parameters<MemoryTiddlerStore["put"]>[0]): Promise<void> {
    const title = String(record.tiddler.title);
    if (title.startsWith("item-")) {
      this.landed.push(title);
      this.onLanding?.(this.landed.length);
    }
    await super.put(record);
  }
}

function setup(store = new CountingStore(), yieldHostTask?: () => Promise<void>) {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store, writable: true });
  const table = new VerbTable();
  registerActionReactors(table, {
    composite,
    ...(yieldHostTask ? { yieldHostTask } : {}),
  });
  return { composite, store, load: table.get("LOAD")! };
}

function carriers(count: number) {
  return Array.from({ length: count }, (_, index) => ({ title: `item-${index}`, text: `body-${index}` }));
}

async function runLoad(
  count: number,
  options: { store?: CountingStore; yieldHostTask?: () => Promise<void> } = {},
) {
  const { composite, store, load } = setup(options.store, options.yieldHostTask);
  const result = await load({ "to-bag": BAG, "source-uri": "file:///load", "change-id": "load-yields", carriers: carriers(count) }, context(composite));
  return { result, store };
}

describe("LOAD yields a host task by landing quantum", () => {
  test("400 landings admit a pending host invocation and preserve the no-yield result", async () => {
    let invocationStartedAt = -1;
    let queuedInvocation: (() => void) | undefined;
    let yields = 0;
    const store = new CountingStore();
    store.onLanding = (count) => {
      if (count === 10) queuedInvocation = () => { invocationStartedAt = store.landed.length; };
    };
    const yielded = await runLoad(400, {
      store,
      yieldHostTask: async () => {
        yields++;
        const invocation = queuedInvocation;
        queuedInvocation = undefined;
        invocation?.();
      },
    });
    queuedInvocation?.();
    const noYield = await runLoad(400, { yieldHostTask: async () => {} });
    expect(yields).toBe(Math.floor((400 - 1) / LOAD_YIELD_QUANTUM));
    expect(invocationStartedAt).toBeGreaterThan(0);
    expect(invocationStartedAt).toBeLessThanOrEqual(LOAD_YIELD_QUANTUM);
    expect(yielded.result).toEqual(noYield.result);
    expect(yielded.store.landed).toEqual(noYield.store.landed);
  });

  test("CONTROL: fewer than one quantum never yields", async () => {
    let yields = 0;
    const { result, store } = await runLoad(LOAD_YIELD_QUANTUM - 1, { yieldHostTask: async () => { yields++; } });
    expect(yields).toBe(0);
    expect(result["count"]).toBe(LOAD_YIELD_QUANTUM - 1);
    expect(store.landed).toEqual(carriers(LOAD_YIELD_QUANTUM - 1).map(({ title }) => title));
  });

  test("the real host task queue runs setImmediate before a 400-record LOAD resolves", async () => {
    let ran = false;
    const store = new CountingStore();
    store.onLanding = (count) => {
      if (count === 10) setImmediate(() => { ran = true; });
    };
    await runLoad(400, { store });
    expect(ran).toBe(true);
  });

  test("a wiki-change invocation reaches its handler before the next LOAD slice", async () => {
    type Changed = Record<string, { deleted?: boolean }>;
    type ChangeListener = (changed: Changed) => void;
    class InvocationWiki {
      private readonly tiddlers = new Map<string, { fields: Record<string, unknown> }>();
      private readonly listeners = new Set<ChangeListener>();

      addEventListener(_type: string, listener: ChangeListener) { this.listeners.add(listener); }
      removeEventListener(_type: string, listener: ChangeListener) { this.listeners.delete(listener); }
      getTiddler(title: string) { return this.tiddlers.get(title); }
      addTiddler(tiddler: { fields: Record<string, unknown> }) {
        const title = String(tiddler.fields["title"]);
        this.tiddlers.set(title, tiddler);
        for (const listener of this.listeners) listener({ [title]: {} });
      }
      deleteTiddler(title: string) {
        this.tiddlers.delete(title);
        for (const listener of this.listeners) listener({ [title]: { deleted: true } });
      }
    }

    const store = new CountingStore();
    const composite = new CompositeStore();
    composite.addLayer({ bagId: BAG, store, writable: true });
    composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(), writable: true });
    const wiki = new InvocationWiki();
    const daemonVm = { $tw: { wiki, Tiddler: class { constructor(readonly fields: Record<string, unknown>) {} } } };
    const table = new VerbTable();
    let invocationStartedAt = -1;
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => { resolveStarted = resolve; });
    table.register("PING", async () => {
      invocationStartedAt = store.landed.length;
      resolveStarted();
      return { startedAt: invocationStartedAt };
    });
    registerActionReactors(table, { composite });
    const dispatcher = new VerbDispatcher({ daemonVm: daemonVm as never, daemon: composite, registry: table });
    dispatcher.start();
    store.onLanding = (count) => {
      if (count === 10) setImmediate(() => dispatcher.placeVerb({
        verb: "PING", args: {}, requestedBy: "operator-test", requestId: "req-ping-during-load",
      }));
    };
    try {
      const load = table.get("LOAD")!({
        "to-bag": BAG, "source-uri": "file:///load", "change-id": "load-with-invocation", carriers: carriers(400),
      }, context(composite));
      await load;
      await started;
      expect(invocationStartedAt).toBeGreaterThanOrEqual(10);
      expect(invocationStartedAt).toBeLessThanOrEqual(LOAD_YIELD_QUANTUM);
    } finally {
      dispatcher.stop();
    }
  });
});
