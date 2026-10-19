import { beforeEach, describe, expect, test, vi } from "vitest";

const harness = vi.hoisted(() => ({
  bindings: vi.fn(),
  boot: vi.fn(),
}));

vi.mock("../src/boot-daemon-keyhive.js", () => ({ bootDaemonKeyhive: harness.boot }));
vi.mock("../src/slot-doc-resolver.js", () => ({
  makeSlotDocResolver: () => ({ bindings: (...args: unknown[]) => harness.bindings(...args) }),
}));

import { AutomergeDocStore, CompositeStore, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import { makeOperatorDaemonBehavior, operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

const working = wikiSlotUri("daemon", "working");
const daemonBag = wikiBagUri("daemon");
const manifest = {
  daemonAuth: { seed: new Uint8Array(32), vesselVerifyingKey: "a".repeat(64), registerBags: [], archiveOpens: false },
} as never;

function fakeProvider() {
  return {
    registerBag: vi.fn(async () => ({ docId: "f".repeat(64) })),
    exportArchive: vi.fn(async () => new Uint8Array()),
  };
}

function context(options: { daemonHandle?: boolean; composite?: CompositeStore } = {}) {
  const handles = new Map<string, unknown>();
  if (options.daemonHandle) handles.set(daemonBag, { url: "automerge:daemon" });
  const composite = options.composite ?? new CompositeStore();
  if (!composite.hasBag(daemonBag)) {
    // A writable stand-in: the daemon's bag holds the working layer's document ledger row after attach.
    const state: { tiddlers: Record<string, unknown> } = { tiddlers: {} };
    const handle = { doc: () => state, change: (edit: (doc: typeof state) => void) => { edit(state); }, heads: () => [], on: () => () => {} };
    composite.addLayer({ bagId: daemonBag, store: new AutomergeDocStore(handle as never, daemonBag), writable: true });
  }
  return {
    composite,
    repo: {
      create: () => { throw new Error("working-slot resolver failed: resolver planted"); },
      find: async () => ({ doc: () => ({ tiddlers: {} }), heads: () => [], on: () => () => {} }),
    },
    recipe: { wikiSlug: "daemon" },
    handles,
    post: () => {},
  } as never;
}

beforeEach(() => {
  harness.bindings.mockReset();
  harness.boot.mockReset();
  harness.boot.mockImplementation(async () => ({ keyhive: fakeProvider(), did: "device", unreadable: null }));
  harness.bindings.mockRejectedValue(new Error("working-slot resolver failed: resolver planted"));
});

describe("daemon working-layer attachment is a boot condition", () => {
  test("a resolver failure rejects boot with the named slot refusal", async () => {
    const behavior = makeOperatorDaemonBehavior(manifest);
    const error = await behavior.onEa(context({ daemonHandle: true }) as never).catch((err: unknown) => err);
    expect((error as Error | undefined)?.name).toBe("WorkingLayerAttachRefusal");
    expect(error?.constructor.name).toBe("WorkingLayerAttachRefusal");
    expect((error as Error | undefined)?.message).toContain(working);
    expect((error as Error | undefined)?.message).toContain("resolver planted");
    expect((error as Error | undefined)?.message).toMatch(/fresh store/);
  });

  test("a missing daemon handle refuses with the same name", async () => {
    const behavior = makeOperatorDaemonBehavior(manifest);
    const error = await behavior.onEa(context() as never).catch((err: unknown) => err);
    expect((error as Error | undefined)?.name).toBe("WorkingLayerAttachRefusal");
    expect(error?.constructor.name).toBe("WorkingLayerAttachRefusal");
    expect((error as Error | undefined)?.message).toContain(working);
  });

  test("a daemon test rig without Keyhive fails closed by the same refusal name", async () => {
    const behavior = makeOperatorDaemonBehavior({} as never);
    const error = await behavior.onEa(context() as never).catch((err: unknown) => err);
    expect((error as Error | undefined)?.name).toBe("WorkingLayerAttachRefusal");
    expect((error as Error | undefined)?.message).toContain(working);
  });

  test("CONTROL — successful attachment announces the slot and makes it the default writable", async () => {
    harness.bindings.mockResolvedValue({ workingUrl: "automerge:daemon-working" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const ctx = context({ daemonHandle: true }) as unknown as ReturnType<typeof context>;
    const workingDoc = { tiddlers: {} as Record<string, unknown> };
    const workingHandle = { url: "automerge:daemon-working", doc: () => workingDoc, heads: () => [], on: () => () => {}, change: (fn: (doc: typeof workingDoc) => void) => fn(workingDoc) };
    (ctx.repo as unknown as { find: () => Promise<typeof workingHandle> }).find = async () => workingHandle;
    await operatorDaemonOptions(manifest).verifierFactory!(ctx as never);
    expect(log.mock.calls.flat().join(" ")).toContain(`[daemon] working layer attached: ${working}`);
    expect(ctx.composite.defaultWritableBagId()).toBe(working);
    await ctx.composite.put({ tiddler: { title: "lar:///ha.ka.ba/working-attach-save", text: "landed" } }, { kind: "test" });
    expect(workingDoc.tiddlers["lar:///ha.ka.ba/working-attach-save"]).toBeDefined();
    await expect((ctx.composite.storeForBag(daemonBag) as unknown as { get: (title: string) => Promise<unknown> }).get("lar:///ha.ka.ba/working-attach-save")).resolves.toBeNull();
    log.mockRestore();
  });
});
