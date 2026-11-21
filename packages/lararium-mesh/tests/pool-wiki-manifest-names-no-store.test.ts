/**
 * pool-wiki-manifest-names-no-store — the pool hands a wiki island no store: the vessel's Repo holds the one.
 *
 *   P1  a wiki mount's manifest names no storage, even under a host shaped to offer a store per wiki.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/vessel-island-pool-core
 */
import { describe, expect, test } from "vitest";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck, type IslandMsg_Manifest } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";

describe("the pool hands a wiki island no store", () => {
  test("P1 — a wiki mount's manifest names no storage", async () => {
    const manifests: IslandMsg_Manifest[] = [];
    const listeners = new Set<(raw: unknown) => void>();
    const hear = (msg: unknown): void => { for (const fn of [...listeners]) fn(msg); };
    // A host shaped as one that still offers a disk store per wiki: the pool asks it nothing of the kind.
    const offering = { storage: (wikiId: string) => ({ type: "nodefs" as const, dir: `/nowhere/${wikiId}` }) };
    const host = {
      ...offering,
      spawnWorker(): VesselWorkerHandle {
        return { post(msg) {
          const type = (msg as { type?: string }).type;
          if (type === "manifest") manifests.push(msg as IslandMsg_Manifest);
          if (type === "manifest" || type === "teardown") queueMicrotask(() => hear(type === "manifest" ? mkEa("wiki") : mkTeardownAck()));
        }, listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, onError: () => () => {}, terminate() {} };
      },
      newSyncChannel() { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    } as unknown as VesselIslandHost;
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids: async () => ({ ok: true, pluginCids: [] }) });
    await pool.mountWiki("wiki", { coreHash: null, recipe: { wikiSlug: "wiki" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } });
    expect(manifests).toHaveLength(1);
    expect(manifests[0]!.storage).toBeUndefined();
    await pool.disposeAll();
  });
});
