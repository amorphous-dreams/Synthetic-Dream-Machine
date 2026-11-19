/**
 * pool-opens-granted-slots — the vessel opens every slot document it grants a wiki island before the island asks.
 *
 * A wiki island keeps no store, so each slot document reaches it from the vessel's Repo. The vessel pushes what it holds a
 * handle for and announces it to the island; a document its Repo holds only at rest (no handle yet) reaches the island
 * only by the island's own pull. Measured on a live house: the personal slot alone rode the pull and never arrived. So the
 * pool opens every granted slot document on the vessel's Repo before it binds the island: each one then rides the push.
 *
 *   G1  a slot document the vessel's Repo holds only at rest stands a handle there once the mount's manifest leaves.
 *       control: before the mount, the Repo held no handle for it.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/vessel-island-pool-core
 */
import { describe, expect, test } from "vitest";
import { Repo, type Chunk, type DocumentId, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) }));
    },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}

describe("the pool opens every slot document it grants", () => {
  test("G1 — a slot document held only at rest stands a handle on the vessel's Repo once the manifest leaves", async () => {
    const storage = memoryAdapter();
    const first = new Repo({ storage, network: [] });
    const personal = first.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: { margin: {} } });
    const working = first.create<{ tiddlers: Record<string, unknown> }>({ tiddlers: {} });
    await first.flush();
    await first.shutdown();
    const vessel = new Repo({ storage, network: [] });
    const idOf = (url: string): DocumentId => url.slice("automerge:".length) as DocumentId;
    expect(vessel.handles[idOf(personal.url)]).toBeUndefined();                 // control: at rest alone

    let manifestLeft = false;
    const listeners = new Set<(raw: unknown) => void>();
    const hear = (msg: unknown): void => { for (const fn of [...listeners]) fn(msg); };
    const host: VesselIslandHost = {
      spawnWorker(): VesselWorkerHandle {
        return { post(msg) {
          const type = (msg as { type?: string }).type;
          if (type === "manifest") manifestLeft = true;
          if (type === "manifest" || type === "teardown") queueMicrotask(() => hear(type === "manifest" ? mkEa("wiki") : mkTeardownAck()));
        }, listen(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, onError: () => () => {}, terminate() {} };
      },
      newSyncChannel() { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    };
    const pool = new VesselIslandPoolCore({ host, mainRepo: vessel, resolvePluginCids: async () => ({ ok: true, pluginCids: [] }) });
    await pool.mountWiki("wiki", { coreHash: null, recipe: { wikiSlug: "wiki" }, grants: { islandUrl: working.url, personalUrl: personal.url, wikiUrl: null } });
    expect(manifestLeft).toBe(true);
    expect(vessel.handles[idOf(personal.url)]).toBeDefined();
    expect(vessel.handles[idOf(working.url)]).toBeDefined();
    await pool.disposeAll();
    await vessel.shutdown();
  });
});
