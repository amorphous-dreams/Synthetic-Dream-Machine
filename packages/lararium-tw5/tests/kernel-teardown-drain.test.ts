/** L29: the kernel must let the adaptor drain while the vessel can still issue receipts. */
import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { mkManifest, mkTeardown, wikiSlotUri, type IslandMsg_Manifest, type IslandToVesselMsg } from "@lararium/mesh";
import { runSovereignKernel, type IslandHostShore } from "../src/sovereign-kernel.js";
import type { IslandBehavior } from "../src/island-context.js";

const fake = vi.hoisted(() => ({ adaptor: null as any, handle: null as any }));
vi.mock("@lararium/mesh", async (original) => {
  const mesh = await original<typeof import("@lararium/mesh")>();
  return { ...mesh, makeIslandRepo: () => ({ flush: async () => {}, shutdown: async () => {} }), replicaHeads: () => ["head-1"] };
});
vi.mock("../src/slot-wait.js", () => ({ waitForSlotDocument: async () => ({ outcome: "ready", handle: fake.handle }) }));
vi.mock("../src/island-recipe.js", () => ({ buildIslandRecipe: () => ({ adaptor: fake.adaptor }), seedDrained: async () => {} }));
vi.mock("../src/outbound-bridge.js", () => ({ bridgeWikiToAdaptor: () => () => {} }));
vi.mock("../src/lazy-resolver.js", () => ({ installLazyResolver: () => () => {} }));
vi.mock("../src/island-kernel.js", () => ({ IslandKernel: class {
  constructor(private post: (m: unknown) => void) {}
  async bootTw5(_uri: unknown, _bytes: unknown, _plugins: unknown, opts: { onInstance(instance: Record<string, unknown>): void }) {
    const instance: Record<string, unknown> = {};
    opts.onInstance(instance);
    const stand = instance.larariumWritableStand as () => Promise<unknown>;
    delete instance.larariumWritableStand;
    await stand();
  }
  tw5() { return {}; }
  sendEa(wikiUri: string) { this.post({ type: "ea", wikiUri }); }
  teardown() {}
} }));

const SLOT = wikiSlotUri("daemon", "working");
const TITLE = "lar:///test.teardown.drain/value";
const VALUE = "the last daemon write";
const core = new TextEncoder().encode("core");
const hash = createHash("sha256").update(core).digest("hex");
const plugin = new TextEncoder().encode('{"title":"plugin"}');

async function scenario(responsive: boolean, opts: { reportUnsaved?: boolean } = {}) {
  const disk = new Map<string, string>();
  const working = new Map<string, string>();
  const events: string[] = [];
  let deliver!: (message: unknown) => void;
  let ready!: () => void;
  let shutdown!: () => void;
  const ea = new Promise<void>((resolve) => { ready = resolve; });
  const stopped = new Promise<void>((resolve) => { shutdown = resolve; });
  fake.handle = { documentId: "working-doc", doc: () => ({ blobs: {}, tiddlers: {} }) };
  fake.adaptor = {
    caps: {}, receiptRequired: false,
    awaitWikiDispatch: async () => {},
    stop: async function (submitted?: () => void) {
      working.set(TITLE, VALUE);
      const acknowledgement = fake.adaptor.caps.receipt.ack([SLOT]);
      // Let the capability post its ask before announcing that this fake has submitted its hands.
      await Promise.resolve();
      submitted?.();
      try {
        await acknowledgement;
        events.push("save-ack");
        return [];
      } catch {
        events.push("save-refused");
        return opts.reportUnsaved ? [TITLE] : [];
      }
    },
  };
  const host: IslandHostShore = {
    listen: (listener) => { deliver = listener; },
    storage: () => undefined,
    resolveByCid: async (cid) => cid === hash ? core : plugin,
    post: (message: IslandToVesselMsg) => {
      if (message.type === "ea") ready();
      if (message.type === "fault" && message.error.startsWith("teardown-fault:")) { events.push(`fault ${message.error}`); shutdown(); return; }
      if (message.type === "fault") throw new Error(message.error);
      if (message.type === "receipt:request") {
        events.push("receipt-request");
        if (responsive) queueMicrotask(() => {
          for (const [title, value] of working) disk.set(title, value);
          events.push("receipt-issued");
          deliver({ type: "receipt:issued", requestId: message.requestId, issued: true });
        });
      }
      if ((message as { type: string }).type === "receipt:asks-done") {
        events.push("receipt-asks-done");
        queueMicrotask(() => { events.push("receipt-close"); deliver({ type: "receipt:close" }); });
      }
      if (message.type === "teardown:ack") { events.push("shutdown"); shutdown(); }
    },
  };
  const behavior: IslandBehavior = { onEa: async () => {}, onSignal: () => false, onHooAnu: async () => {} };
  runSovereignKernel(host, behavior, { caps: { receipt: true } });
  const port = { addEventListener() {} } as unknown as IslandMsg_Manifest["syncPort"];
  deliver(mkManifest("lar:///test.kernel.drain/wiki", port, { wikiSlug: "daemon" }, { islandUrl: "automerge:oracle", workingUrl: "automerge:working" }, hash, { pluginCids: ["plugin"] }));
  await ea;
  deliver(mkTeardown());
  await stopped;
  return { events, reopen: () => new Map(disk) };
}

describe("sovereign kernel teardown drains its queued write", () => {
  test("a responsive vessel receipts the last write before shutdown and it survives reopen", async () => {
    const { events, reopen } = await scenario(true);
    expect(events).toContain("receipt-issued");
    expect(events.indexOf("receipt-issued")).toBeLessThan(events.indexOf("shutdown"));
    expect(events).toContain("save-ack");
    expect(events).toContain("receipt-asks-done");
    expect(events.indexOf("receipt-asks-done")).toBeLessThan(events.indexOf("receipt-close"));
    expect(events.indexOf("receipt-close")).toBeLessThan(events.indexOf("shutdown"));
    expect(reopen().get(TITLE)).toBe(VALUE);
  });
  test("CONTROL: a quiet vessel lets shutdown finish without acknowledging the unwritten save", async () => {
    const { events, reopen } = await scenario(false);
    expect(events).toContain("receipt-request");
    expect(events).toContain("receipt-asks-done");
    expect(events.indexOf("receipt-asks-done")).toBeLessThan(events.indexOf("receipt-close"));
    expect(events).toContain("save-refused");
    expect(events).toContain("shutdown");
    expect(events).not.toContain("save-ack");
    expect(reopen().has(TITLE)).toBe(false);
  });
  test("a title the shore reports unsaved reaches the vessel by name in place of the ack — CONTROL: the responsive vessel's ack", async () => {
    const { events } = await scenario(false, { reportUnsaved: true });
    const fault = events.find((event) => event.startsWith("fault "));
    expect(fault).toContain(JSON.stringify(TITLE));
    expect(events).not.toContain("shutdown");
    const control = await scenario(true, { reportUnsaved: true });
    expect(control.events).toContain("shutdown");
    expect(control.events.some((event) => event.startsWith("fault "))).toBe(false);
  });
});

describe("F1: the vessel's close answers this island's asks-done, and nothing else", () => {
  async function midLife(event: "bare-close" | "port-close") {
    let deliver!: (message: unknown) => void;
    let closePort: (() => void) | undefined;
    let ready!: () => void;
    const ea = new Promise<void>((resolve) => { ready = resolve; });
    fake.handle = { documentId: "working-doc", doc: () => ({ blobs: {}, tiddlers: {} }) };
    fake.adaptor = { caps: {}, receiptRequired: false, awaitWikiDispatch: async () => {}, stop: async () => [] };
    const host: IslandHostShore = {
      listen: (listener) => { deliver = listener; }, storage: () => undefined,
      resolveByCid: async (cid) => cid === hash ? core : plugin,
      post: (message) => {
        if (message.type === "ea") ready();
        if (message.type === "receipt:request") queueMicrotask(() => deliver({ type: "receipt:issued", requestId: message.requestId, issued: true }));
      },
    };
    const behavior: IslandBehavior = { onEa: async () => {}, onSignal: () => false, onHooAnu: async () => {} };
    runSovereignKernel(host, behavior, { caps: { receipt: true } });
    const port = { addEventListener(type: string, listener: () => void) { if (type === "close") closePort = listener; } } as unknown as IslandMsg_Manifest["syncPort"];
    deliver(mkManifest("lar:///test.kernel.drain/wiki", port, { wikiSlug: "daemon" }, { islandUrl: "automerge:oracle", workingUrl: "automerge:working" }, hash, { pluginCids: ["plugin"] }));
    await ea;
    if (event === "bare-close") deliver({ type: "receipt:close" });
    else closePort?.();
    return fake.adaptor.caps.receipt.ack([SLOT]).then(() => "issued", () => "refused");
  }
  test("a bare receipt:close mid-life leaves a later save receiptable — CONTROL: the sync port closing mid-life ends receipts", async () => {
    expect(await midLife("bare-close")).toBe("issued");
    expect(await midLife("port-close")).toBe("refused");
  });
});

// Proposed vessel stand-down message: the cure may give this event another wire name, but it must
// arrive independently of the teardown request so the responsive drain retains its receipt door.
describe("vessel stand-down releases receipt waits", () => {
  async function standDown(kind: "unfinished-act" | "parked-ask" | "port-close") {
    let deliver!: (message: unknown) => void;
    let closePort: (() => void) | undefined;
    let ready!: () => void;
    let acked = false;
    let refused = false;
    let asksDone = false;
    const ea = new Promise<void>((resolve) => { ready = resolve; });
    fake.handle = { documentId: "working-doc", doc: () => ({ blobs: {}, tiddlers: {} }) };
    fake.adaptor = {
      caps: {}, receiptRequired: false, awaitWikiDispatch: async () => {},
      stop: async (submitted?: () => void) => {
        if (kind === "unfinished-act") { fake.adaptor.caps.receipt.begin(); return; }
        const acknowledgement = fake.adaptor.caps.receipt.ack([SLOT]);
        await Promise.resolve();
        submitted?.();
        try { await acknowledgement; } catch { refused = true; }
      },
    };
    const host: IslandHostShore = {
      listen: (listener) => { deliver = listener; }, storage: () => undefined,
      resolveByCid: async (cid) => cid === hash ? core : plugin,
      post: (message) => {
        if (message.type === "ea") ready();
        if (message.type === "teardown:ack") acked = true;
        if ((message as { type: string }).type === "receipt:asks-done") asksDone = true;
      },
    };
    const behavior: IslandBehavior = { onEa: async () => {}, onSignal: () => false, onHooAnu: async () => {} };
    runSovereignKernel(host, behavior, { caps: { receipt: true } });
    const port = { addEventListener(type: string, listener: () => void) { if (type === "close") closePort = listener; } } as unknown as IslandMsg_Manifest["syncPort"];
    deliver(mkManifest("lar:///test.kernel.drain/wiki", port, { wikiSlug: "daemon" }, { islandUrl: "automerge:oracle", workingUrl: "automerge:working" }, hash, { pluginCids: ["plugin"] }));
    await ea;
    // A clock that never fires: no advance can manufacture the vessel's stand-down.
    const clock = vi.spyOn(globalThis, "setTimeout").mockImplementation((() => 1) as typeof setTimeout);
    try {
      deliver(mkTeardown());
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(acked).toBe(false);
      if (kind === "unfinished-act") {
        // An act begun without done never lets asks-done leave, so the vessel's close is not yet its answer: the vessel's
        // stand-down reaches this island as its sync port closing (the vessel's terminate), which ends receipts at any time.
        expect(asksDone, "an unfinished act holds asks-done").toBe(false);
        deliver({ type: "receipt:close" });
        for (let i = 0; i < 20; i++) await Promise.resolve();
        expect(acked, "a close answering no asks-done ends nothing").toBe(false);
        closePort?.();
      } else if (kind === "port-close") {
        expect(closePort, "the island observes its sync port closing").toBeDefined();
        closePort?.();
      } else {
        expect(asksDone, "the parked ask has left, so asks-done went out").toBe(true);
        deliver({ type: "receipt:close" });
      }
      for (let i = 0; i < 50; i++) await Promise.resolve();
      expect(acked, "stand-down must reach teardown:ack without a timer").toBe(true);
      if (kind !== "unfinished-act") expect(refused).toBe(true);
    } finally { clock.mockRestore(); }
  }
  test("an act begun without done cannot hold teardown after vessel stand-down (its port closing)", async () => { await standDown("unfinished-act"); });
  test("a parked receipt refuses on vessel stand-down without a clock", async () => { await standDown("parked-ask"); });
  test("a sync port closing mid-settle refuses the parked receipt without a clock", async () => { await standDown("port-close"); });
});
