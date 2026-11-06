import { beforeEach, describe, expect, test, vi } from "vitest";

const harness = vi.hoisted(() => ({
  bindings: vi.fn(),
  slotDoc: vi.fn(),
  boot: vi.fn(),
}));

vi.mock("../src/boot-daemon-keyhive.js", () => ({ bootDaemonKeyhive: harness.boot }));
vi.mock("../src/slot-doc-resolver.js", () => ({
  makeSlotDocResolver: () => ({ bindings: (...args: unknown[]) => harness.bindings(...args), slotDoc: (...args: unknown[]) => harness.slotDoc(...args) }),
}));

import { AutomergeDocStore, CompositeStore, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import { makeOperatorDaemonBehavior, operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

const working = wikiSlotUri("daemon", "working");
const daemonBag = wikiBagUri("daemon");
const manifest = {
  daemonAuth: { atom: { seed: "00".repeat(32), key: "b".repeat(64) }, placeVerifyingKey: "a".repeat(64), registerBags: [], archiveOpens: false },
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
  harness.slotDoc.mockReset();
  harness.boot.mockReset();
  harness.boot.mockImplementation(async () => ({ keyhive: fakeProvider(), did: "device", unreadable: null }));
  harness.slotDoc.mockRejectedValue(new Error("working-slot resolver failed: resolver planted"));
});

describe("daemon working-layer attachment is a boot condition", () => {
  test("a faceless daemon with no floor anchor names the absent route without waiting", async () => {
    const behavior = makeOperatorDaemonBehavior({ daemonAuth: { placeVerifyingKey: "a".repeat(64), registerBags: [] } } as never);
    await expect(behavior.onWritable!(context() as never)).resolves.toMatchObject({ state: "no-route", reason: expect.stringMatching(/no face/i) });
    expect(harness.slotDoc).not.toHaveBeenCalled();
  });

  // sealed-store#/U1: at the floor the working slot stands on the floor's own document, keyed by the floor's anchor, so a
  // faceless floor's verb outcomes land there (a herm's verb answers) and never meet NO_WORKING_LAYER.
  test("a faceless floor holding its anchor attaches the working floor as the default writable, on the marker and on ea", async () => {
    const floorAuth = { daemonAuth: { placeVerifyingKey: "a".repeat(64), registerBags: [], workingFloorAnchor: { kind: "place", aid: "E".repeat(44) } } } as never;
    harness.slotDoc.mockResolvedValue({ url: "automerge:daemon-working-floor", reach: "vessel-only" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    for (const hook of ["onWritable", "verifierFactory"] as const) {
      harness.slotDoc.mockClear();
      const ctx = context({ daemonHandle: true }) as unknown as ReturnType<typeof context>;
      const workingDoc = { tiddlers: {} as Record<string, unknown> };
      const workingHandle = { url: "automerge:daemon-working-floor", doc: () => workingDoc, heads: () => [], on: () => () => {}, change: (fn: (doc: typeof workingDoc) => void) => fn(workingDoc) };
      (ctx.repo as unknown as { find: () => Promise<typeof workingHandle> }).find = async () => workingHandle;
      // The marker rides the behavior; the verifier rides the options the behavior stands on.
      const out = hook === "onWritable"
        ? await makeOperatorDaemonBehavior(floorAuth).onWritable!(ctx as never)
        : await operatorDaemonOptions(floorAuth).verifierFactory!(ctx as never);
      if (hook === "onWritable") expect(out).toMatchObject({ state: "standing" });
      expect(harness.slotDoc).toHaveBeenCalledWith("daemon", "working");
      expect(harness.boot).not.toHaveBeenCalled();
      expect(ctx.composite.defaultWritableBagId()).toBe(working);
      await ctx.composite.put({ tiddler: { title: "lar:///ha.ka.ba/floor-outcome", text: "landed" } }, { kind: "test" });
      expect(workingDoc.tiddlers["lar:///ha.ka.ba/floor-outcome"]).toBeDefined();
      // The floor verifier reaches the slot it attached, on the local channel alone.
      if (hook === "verifierFactory") {
        const verifier = out as { verify: (a: unknown) => Promise<{ ok: boolean }> };
        await expect(verifier.verify({ bagUrl: working, channel: "local" })).resolves.toMatchObject({ ok: true });
        await expect(verifier.verify({ bagUrl: working, channel: "peer" })).resolves.toMatchObject({ ok: false });
      }
    }
    log.mockRestore();
  });


  test("a resolver failure rejects boot with the named slot refusal", async () => {
    const behavior = makeOperatorDaemonBehavior(manifest);
    const error = await behavior.onWritable!(context({ daemonHandle: true }) as never).catch((err: unknown) => err);
    expect((error as Error | undefined)?.name).toBe("WorkingLayerAttachRefusal");
    expect(error?.constructor.name).toBe("WorkingLayerAttachRefusal");
    expect((error as Error | undefined)?.message).toContain(working);
    expect((error as Error | undefined)?.message).toContain("resolver planted");
    expect((error as Error | undefined)?.message).toMatch(/fresh store/);
  });

  test("a missing daemon handle refuses with the same name", async () => {
    const behavior = makeOperatorDaemonBehavior(manifest);
    const error = await behavior.onWritable!(context() as never).catch((err: unknown) => err);
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
    harness.slotDoc.mockResolvedValue({ url: "automerge:daemon-working", reach: "face" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const ctx = context({ daemonHandle: true }) as unknown as ReturnType<typeof context>;
    const workingDoc = { tiddlers: {} as Record<string, unknown> };
    const workingHandle = { url: "automerge:daemon-working", doc: () => workingDoc, heads: () => [], on: () => () => {}, change: (fn: (doc: typeof workingDoc) => void) => fn(workingDoc) };
    (ctx.repo as unknown as { find: () => Promise<typeof workingHandle> }).find = async () => workingHandle;
    await makeOperatorDaemonBehavior(manifest).onWritable!(ctx as never);
    expect(harness.slotDoc).toHaveBeenCalledWith("daemon", "working");
    expect(harness.bindings).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(" ")).toContain(`[daemon] working layer attached: ${working}`);
    expect(ctx.composite.defaultWritableBagId()).toBe(working);
    await ctx.composite.put({ tiddler: { title: "lar:///ha.ka.ba/working-attach-save", text: "landed" } }, { kind: "test" });
    expect(workingDoc.tiddlers["lar:///ha.ka.ba/working-attach-save"]).toBeDefined();
    await expect((ctx.composite.storeForBag(daemonBag) as unknown as { get: (title: string) => Promise<unknown> }).get("lar:///ha.ka.ba/working-attach-save")).resolves.toBeNull();
    log.mockRestore();
  });
});
