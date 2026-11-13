import { describe, expect, test } from "vitest";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec } from "../src/wiki-recipe.js";

const CORE = "c".repeat(64);
const PLUGIN = "a".repeat(64);
const spec: WikiMountSpec = { coreHash: CORE, recipe: { wikiSlug: "wiki" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } };
function rig(resolve: () => Promise<{ ok: true; pluginCids: readonly string[] } | { ok: false; error: string }>) {
  const listeners = new Set<(raw: unknown) => void>();
  const hear = (msg: unknown): void => { for (const fn of [...listeners]) fn(msg); };
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      return { post(msg) {
        const type = (msg as { type?: string }).type;
        if (type === "manifest" || type === "teardown") queueMicrotask(() => hear(type === "manifest" ? mkEa("wiki") : mkTeardownAck()));
      }, listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, onError: () => () => {}, terminate() {} };
    },
    newSyncChannel() { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  return new VesselIslandPoolCore({ host, resolvePluginCids: resolve });
}

describe("a mounted wiki names the engine inputs its mirror reads", () => {
  test("mountInputsOf returns the core hash and the recipe's own plugin selection; CONTROL: an unmounted wiki reads null", async () => {
    const pool = rig(async () => ({ ok: true, pluginCids: [PLUGIN] }));
    await pool.mountWiki("wiki", spec);
    expect(await (pool as any).mountInputsOf("wiki")).toEqual({ coreCid: CORE, pluginCids: [PLUGIN] });
    expect(await (pool as any).mountInputsOf("other")).toBeNull();
    await pool.disposeAll();
  });
  test("a wiki with no core hash, or a recipe whose plugins refuse, reads null and never a guess", async () => {
    const refusing = rig(async () => ({ ok: false, error: "plugin-collision" }));
    await refusing.mountWiki("wiki", spec).catch(() => undefined);
    expect(await (refusing as any).mountInputsOf("wiki")).toBeNull();
    const bare = rig(async () => ({ ok: true, pluginCids: [] }));
    await bare.mountWiki("wiki", { ...spec, coreHash: null });
    expect(await (bare as any).mountInputsOf("wiki")).toBeNull();
    await bare.disposeAll();
  });
});
