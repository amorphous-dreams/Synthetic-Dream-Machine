/**
 * pool-mount-during-teardown — a mount that arrives while its island tears down waits for the teardown's
 * answer and then mounts FRESH.
 *
 * An island on its way down still reads live in the slot table until its teardown handshake ends. A mount
 * that read that slot as standing answered success for an island that then left: the caller held a wiki
 * that no island served. The mount waits for the one handshake in flight and then mounts a new island,
 * or refuses by name where the pool closes.
 *
 * The order rides a HANDSHAKE: the scripted island acks its teardown when the test tells it to. No clock.
 */
import { describe, test, expect } from "vitest";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec } from "../src/wiki-recipe.js";

const NO_OFFERINGS = async () => ({ ok: true as const, pluginCids: [] });
const WIKI_ID = "lar:///ha.ka.ba/bags/test/wiki";
const spec = (): WikiMountSpec => ({ coreHash: null, recipe: { wikiSlug: "test" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } });

/** A scripted host: each island answers its manifest with `ea` at once and acks its teardown on command. */
function scriptedHost() {
  const islands: Array<{ ack: () => void; terminated: boolean; teardowns: number }> = [];
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      const listeners = new Set<(raw: unknown) => void>();
      const island = { ack: () => { for (const l of [...listeners]) l(mkTeardownAck()); }, terminated: false, teardowns: 0 };
      islands.push(island);
      return {
        post: (msg: unknown) => {
          const type = (msg as { type?: string } | null)?.type;
          if (type === "teardown") { island.teardowns++; return; }
          queueMicrotask(() => { for (const l of [...listeners]) l(mkEa(WIKI_ID)); });
        },
        listen: (h) => { listeners.add(h); return () => { listeners.delete(h); }; },
        onError: () => () => {},
        terminate: () => { island.terminated = true; },
      };
    },
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  return { host, islands };
}

/** Let every turn already queued run: a promise that would settle without the handshake settles here. */
const turns = async (): Promise<void> => { for (let turn = 0; turn < 16; turn++) await Promise.resolve(); };

describe("a mount that arrives while its island tears down", () => {
  test("waits for the teardown's answer, then mounts a fresh island", async () => {
    const { host, islands } = scriptedHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    expect(islands).toHaveLength(1);

    const ending = pool.unmountWiki(WIKI_ID);
    let mounted = false;
    const mounting = pool.mountWiki(WIKI_ID, spec()).then(() => { mounted = true; });
    await turns();
    // The handshake still waits: the mount has answered nothing and spawned nothing.
    expect(mounted).toBe(false);
    expect(islands).toHaveLength(1);

    islands[0]!.ack();
    expect(await ending).toEqual({ wikiId: WIKI_ID, acked: true });
    await mounting;
    expect(mounted).toBe(true);
    expect(islands).toHaveLength(2);
    expect(islands[0]!.terminated).toBe(true);
    expect(islands[1]!.terminated).toBe(false);
    expect(pool.tier(WIKI_ID)).toBe("wela");
    expect(islands[0]!.teardowns).toBe(1);
  });

  test("two mounts that arrive during one teardown share one fresh island", async () => {
    const { host, islands } = scriptedHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    const ending = pool.unmountWiki(WIKI_ID);
    const first = pool.mountWiki(WIKI_ID, spec());
    const second = pool.mountWiki(WIKI_ID, spec());
    await turns();
    islands[0]!.ack();
    await Promise.all([ending, first, second]);
    expect(islands).toHaveLength(2);
    expect(pool.tier(WIKI_ID)).toBe("wela");
  });

  test("a mount that waited out a teardown the pool's own closing began refuses by name", async () => {
    const { host, islands } = scriptedHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    const ending = pool.unmountWiki(WIKI_ID);
    const mounting = pool.mountWiki(WIKI_ID, spec()).then(() => "mounted", (err: Error) => err.message);
    const closing = pool.disposeAll();
    await turns();
    islands[0]!.ack();
    await ending;
    expect(await mounting).toContain("pool-closing");
    await closing;
    expect(islands).toHaveLength(1);
  });

  test("CONTROL: a mount of a standing island with no teardown in flight answers at once and spawns nothing", async () => {
    const { host, islands } = scriptedHost();
    const pool = new VesselIslandPoolCore({ host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    await pool.mountWiki(WIKI_ID, spec());
    expect(islands).toHaveLength(1);
    expect(pool.tier(WIKI_ID)).toBe("wela");
  });
});
