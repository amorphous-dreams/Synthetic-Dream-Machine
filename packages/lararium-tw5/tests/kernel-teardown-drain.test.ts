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

async function scenario(responsive: boolean) {
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
    stop: async function () {
      working.set(TITLE, VALUE);
      try {
        await fake.adaptor.caps.receipt.ack([SLOT]);
        events.push("save-ack");
      } catch { events.push("save-refused"); }
    },
  };
  const host: IslandHostShore = {
    listen: (listener) => { deliver = listener; },
    storage: () => undefined,
    resolveByCid: async (cid) => cid === hash ? core : plugin,
    post: (message: IslandToVesselMsg) => {
      if (message.type === "ea") ready();
      if (message.type === "fault") throw new Error(message.error);
      if (message.type === "receipt:request") {
        events.push("receipt-request");
        if (responsive) queueMicrotask(() => {
          for (const [title, value] of working) disk.set(title, value);
          events.push("receipt-issued");
          deliver({ type: "receipt:issued", requestId: message.requestId, issued: true });
        });
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
    expect(reopen().get(TITLE)).toBe(VALUE);
  });
  test("CONTROL: a quiet vessel lets shutdown finish without acknowledging the unwritten save", async () => {
    const { events, reopen } = await scenario(false);
    expect(events).toContain("shutdown");
    expect(events).not.toContain("save-ack");
    expect(reopen().has(TITLE)).toBe(false);
  });
});
