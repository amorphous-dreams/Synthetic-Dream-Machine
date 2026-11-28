/**
 * withdraw-placed-ask — THE ISLAND HALF OF A WITHDRAWN ASK (lar:///engine.filter.watches, comms-ux-enacts landing 16): the vessel's
 * seat hands the island the id of an ask whose caller left (`daemon:withdraw-verb`); the island removes the ask's invocation and
 * the dispatcher aborts the handler's signal, so a held handler (a watch) stops. The seat half reads in
 * `packages/lararium-node/tests/uds-withdraw-ask.test.ts`.
 */
import { memoryControlStore } from "./control-store-fixture.js";
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { isVesselToIslandMsg, mkDaemonWithdrawVerb } from "@lararium/mesh/island-protocol";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { withdrawPlacedAsk } from "../src/daemon-behavior.js";
import type { TW5Engine } from "../src/tw5-vm.js";

type TiddlerFields = Record<string, unknown>;
type ChangeListener = (changed: Record<string, { deleted?: boolean }>) => void;

/** A fake TW5 wiki whose writes fire synchronous change events, the one thing the dispatcher's local path reads. */
class FakeTW5Engine {
  private readonly records = new Map<string, TiddlerFields>();
  private listeners: ChangeListener[] = [];
  readonly wiki = {
    addTiddler: (tiddler: { fields?: TiddlerFields } | TiddlerFields): void => {
      const fields: TiddlerFields = (tiddler && typeof tiddler === "object" && "fields" in tiddler && tiddler.fields) ? tiddler.fields as TiddlerFields : (tiddler as TiddlerFields);
      const title = typeof fields.title === "string" ? fields.title : null;
      if (!title) throw new Error("title required");
      this.records.set(title, { ...fields });
      for (const l of this.listeners) l({ [title]: {} });
    },
    getTiddler: (title: string): { fields: TiddlerFields } | undefined => {
      const fields = this.records.get(title);
      return fields ? { fields: { ...fields } } : undefined;
    },
    deleteTiddler: (title: string): void => {
      if (this.records.delete(title)) for (const l of this.listeners) l({ [title]: { deleted: true } });
    },
    addEventListener: (type: string, fn: ChangeListener): void => { if (type === "change") this.listeners.push(fn); },
    removeEventListener: (type: string, fn: ChangeListener): void => { if (type === "change") this.listeners = this.listeners.filter((l) => l !== fn); },
  };
  readonly $tw = { Tiddler: class { fields: TiddlerFields; constructor(fields: TiddlerFields) { this.fields = fields; } }, wiki: this.wiki };
}

function makeDaemon(): CompositeStore {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  return composite;
}

async function settle(turns = 20): Promise<void> {
  for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("the island withdraws a placed ask whose caller left", () => {
  test("RED: the withdraw message reads whole at the island door; CONTROL: a message carrying more than the id vanishes", () => {
    expect(mkDaemonWithdrawVerb("r1")).toEqual({ type: "daemon:withdraw-verb", requestId: "r1" });
    expect(isVesselToIslandMsg(mkDaemonWithdrawVerb("r1"))).toBe(true);
    expect(isVesselToIslandMsg({ type: "daemon:withdraw-verb", requestId: "" })).toBe(false);
    expect(isVesselToIslandMsg({ type: "daemon:withdraw-verb", requestId: "r1", verb: "x" })).toBe(false);
  });

  test("RED: withdrawing a held ask aborts its handler's signal; CONTROL: an ask that stands nowhere moves nothing", async () => {
    const tw5 = new FakeTW5Engine() as unknown as TW5Engine;
    const registry = new VerbTable();
    let aborted = false;
    let started = false;
    registry.register("hold", (_args, ctx) => new Promise((resolve) => {
      started = true;
      ctx.signal?.addEventListener("abort", () => { aborted = true; resolve({ withdrawn: true }); }, { once: true });
    }));
    const dispatcher = new VerbDispatcher({ daemonVm: tw5, daemon: makeDaemon(), control: memoryControlStore(), registry, localOf: () => true });
    dispatcher.start();
    try {
      dispatcher.placeVerb({ verb: "hold", args: {}, requestedBy: "me", requestId: "held-1" });
      await settle();
      expect(started).toBe(true);
      expect(aborted).toBe(false);
      expect(withdrawPlacedAsk(tw5, "never-placed")).toBe(false);
      expect(aborted).toBe(false);
      expect(withdrawPlacedAsk(tw5, "held-1")).toBe(true);
      await settle();
      expect(aborted).toBe(true);
      expect(withdrawPlacedAsk(tw5, "held-1"), "a withdrawn ask stands nowhere").toBe(false);
    } finally { dispatcher.stop(); }
  });
});
