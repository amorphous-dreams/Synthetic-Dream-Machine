import { describe, expect, test, vi } from "vitest";
import { memoryControlStore } from "./control-store-fixture.js";
import { CompositeStore, NoWorkingLayerRefusal } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { OUTCOME_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemeDeleteReactor, makeMemePatchReactor, makeMemePutReactor } from "../src/meme-verbs.js";
import { VerbDispatcher, VerbTable, type VerbContext } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";

class Wiki {
  private readonly records = new Map<string, Record<string, unknown>>();
  private readonly listeners = new Set<(changed: Record<string, { deleted?: boolean }>) => void>();
  readonly wiki = {
    getTiddlerText: (_title: string, fallback = "") => fallback,
    addTiddler: (input: { fields?: Record<string, unknown> } | Record<string, unknown>) => {
      const fields = "fields" in input && input.fields ? input.fields : input as Record<string, unknown>;
      const title = String(fields.title);
      this.records.set(title, { ...fields });
      for (const listener of this.listeners) listener({ [title]: {} });
    },
    getTiddler: (title: string) => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string) => { this.records.delete(title); },
    addEventListener: (_type: string, listener: (changed: Record<string, { deleted?: boolean }>) => void) => this.listeners.add(listener),
    removeEventListener: (_type: string, listener: (changed: Record<string, { deleted?: boolean }>) => void) => this.listeners.delete(listener),
  };
  readonly $tw = { Tiddler: class { fields: Record<string, unknown>; constructor(fields: Record<string, unknown>) { this.fields = fields; } }, wiki: this.wiki };
}

/**
 * WHY NO OUTCOME LANDS. The test once waited for an error outcome in the daemon bag. Since 2d561837a the product
 * always mounts the daemon's working layer, and since 0d3ca666f an outcome lands in the composite's default writable
 * (that working layer), never in the clear daemon bag. A daemon wiki with no working layer therefore stands
 * unreachable in the product: no outcome can land there, and a refusal-only outcome written into the clear daemon bag
 * by name would reopen the very path 0d3ca666f closed. So the premise "the refusal arrives as an outcome" left with
 * those commits. The test now reads the refusal where it fires, at the meme-put reactor, and pins that the clear
 * daemon bag takes neither the content nor an outcome.
 */
describe("a meme write into the daemon's own wiki without a working layer", () => {
  function stand() {
    const daemon = new CompositeStore();
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true, defaultWritable: false });
    const tw5 = new Wiki();
    const options = { composite: daemon, tw5: tw5 as unknown as Pick<TW5Engine, "$tw"> };
    return { daemon, daemonBag, tw5, options };
  }

  test("the meme-put reactor refuses by name, carries the --recipe remedy, and writes no content", async () => {
    const { daemon, daemonBag, options } = stand();
    const reactor = makeMemePutReactor(options);
    const invocation = { verb: "meme-put", args: { recipe: "default", uri: "lar:///t/no-working", text: "content" }, requestedBy: "did:key:test", requestId: "meme-no-working" };
    const refused = await reactor(invocation.args, { daemon, invocation } as unknown as VerbContext).then(() => null, (err: unknown) => err);
    expect(refused, "the write went through with no working layer").toBeInstanceOf(NoWorkingLayerRefusal);
    expect(String((refused as Error).message)).toContain("no default writable layer");
    expect(String((refused as Error).message), "the refusal named no remedy").toContain("--recipe");
    expect(await daemonBag.get("lar:///t/no-working")).toBeNull();
    expect(await daemon.defaultWritableBagId()).toBeNull();
  });

  test("through the dispatcher, the refused write rests its outcome in the control document; the clear daemon bag holds no outcome and no content", async () => {
    const { daemon, daemonBag, tw5, options } = stand();
    const registry = new VerbTable();
    registry.register("meme-put", makeMemePutReactor(options));
    const control = memoryControlStore();
    const dispatcher = new VerbDispatcher({ daemonVm: tw5 as unknown as TW5Engine, daemon, control, registry });
    const landed = new Promise<void>((resolve) => {
      control.subscribe((change) => { if (change.title === `${OUTCOME_URI_PREFIX}meme-no-working`) resolve(); });
    });
    try {
      dispatcher.start();
      dispatcher.placeVerb({ verb: "meme-put", args: { recipe: "default", uri: "lar:///t/no-working", text: "content" }, requestedBy: "did:key:test", requestId: "meme-no-working" });
      await landed;
      const outcome = await control.getLive(`${OUTCOME_URI_PREFIX}meme-no-working`);
      expect(outcome?.tiddler["status"], "the refused write's outcome rests in the control document").toBe("error");
      expect(await daemonBag.get(`${OUTCOME_URI_PREFIX}meme-no-working`), "an outcome landed in the clear daemon bag").toBeNull();
      expect(await daemonBag.get("lar:///t/no-working")).toBeNull();
    } finally {
      dispatcher.stop();
    }
  });
});

describe("RED (#428 F1) — the meme door never writes a residency ledger", () => {
  test("meme put, patch and delete of a ledger uri refuse `effect-ledger-house-only` before any write", async () => {
    const daemon = new CompositeStore();
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true });
    const options = { composite: daemon, tw5: new Wiki() as unknown as Pick<TW5Engine, "$tw"> };
    const uri = "lar:///ha.ka.ba/wikis/elyncia-referee/working/ledger/residency/forged";
    const ctx = (verb: string) => ({ daemon, invocation: { verb, requestId: "r", requestedBy: "did:key:test", args: {} } } as unknown as VerbContext);
    await expect(makeMemePutReactor(options)({ recipe: "default", uri, text: "content" }, ctx("meme-put"))).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    await expect(makeMemePatchReactor(options)({ recipe: "default", uri, slot: "#/a", append: "x", base: "sha256-x" }, ctx("meme-patch"))).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    await expect(makeMemeDeleteReactor(options)({ recipe: "default", uri }, ctx("meme-delete"))).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    expect(await daemonBag.get(uri)).toBeNull();
  });
});

describe("RED (the record of leaving stays) — the meme door never writes a shell's record of leaving", () => {
  test("meme put, patch and delete of `shell-leavings/<slug>` refuse `effect-ledger-house-only` before any write", async () => {
    const daemon = new CompositeStore();
    const daemonBag = new MemoryTiddlerStore(DAEMON_BAG_ID);
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: daemonBag, writable: true });
    const options = { composite: daemon, tw5: new Wiki() as unknown as Pick<TW5Engine, "$tw"> };
    const uri = "lar:///ha.ka.ba/lararium/shell-leavings/elyncia-referee";
    const ctx = (verb: string) => ({ daemon, invocation: { verb, requestId: "r", requestedBy: "did:key:test", args: {} } } as unknown as VerbContext);
    await expect(makeMemePutReactor(options)({ recipe: "default", uri, text: "content" }, ctx("meme-put"))).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    await expect(makeMemePatchReactor(options)({ recipe: "default", uri, slot: "#/a", append: "x", base: "sha256-x" }, ctx("meme-patch"))).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    await expect(makeMemeDeleteReactor(options)({ recipe: "default", uri }, ctx("meme-delete"))).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    expect(await daemonBag.get(uri)).toBeNull();
  });
});
