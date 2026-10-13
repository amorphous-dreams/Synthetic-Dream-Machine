/**
 * pool-teardown-runs-once — a wiki island's teardown handshake runs ONCE, however many roads reach it.
 *
 * `disposeAll` and `unmountWiki` can both reach one island while its handshake stands waiting (a stop tick
 * that fires an unawaited `disposeAll`, then the composition's own teardown). Each call that sent its own
 * `teardown` and waited on its own ack met a worker the first call had terminated whenever that first
 * call ended on its bound: the second then waited out a second bound for an ack no island stood to give.
 *
 * The order rides a HANDSHAKE: the scripted island answers when the test tells it to.
 */
import { describe, test, expect } from "vitest";
import { VesselIslandPoolCore } from "../src/vessel-island-pool-core.js";
import { mkEa, mkTeardownAck } from "../src/island-protocol.js";
import type { VesselIslandHost, VesselWorkerHandle } from "../src/vessel-host.js";
import type { WikiMountSpec } from "../src/wiki-recipe.js";

const NO_OFFERINGS = async () => ({ ok: true as const, pluginCids: [] });
const WIKI_ID = "lar:///ha.ka.ba/bags/test/wiki";
const spec = (): WikiMountSpec => ({ coreHash: null, recipe: { wikiSlug: "test" }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } });

/** A scripted island: it answers the manifest with `ea` at once, counts each `teardown`, and acks on command. */
function scriptedHost() {
  const listeners = new Set<(raw: unknown) => void>();
  let teardowns = 0;
  let terminations = 0;
  const host: VesselIslandHost = {
    spawnWorker(): VesselWorkerHandle {
      return {
        post: (msg: unknown) => {
          const type = (msg as { type?: string } | null)?.type;
          if (type === "teardown") { teardowns++; return; }
          queueMicrotask(() => { for (const l of [...listeners]) l(mkEa(WIKI_ID)); });
        },
        listen: (h) => { listeners.add(h); return () => { listeners.delete(h); }; },
        onError: () => () => {},
        terminate: () => { terminations++; },
      };
    },
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); return { mainPort: port1, syncPort: port2 }; },
    storage: () => undefined,
  };
  return {
    host,
    teardowns: () => teardowns,
    terminations: () => terminations,
    ack: () => { for (const l of [...listeners]) l(mkTeardownAck()); },
  };
}

describe("a wiki island's teardown handshake runs once", () => {
  test("two unmounts in flight share one handshake: one teardown, one termination, one answer", async () => {
    const island = scriptedHost();
    const pool = new VesselIslandPoolCore({ host: island.host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());

    const first = pool.unmountWiki(WIKI_ID);
    const second = pool.unmountWiki(WIKI_ID);
    expect(island.teardowns()).toBe(1);
    island.ack();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual({ wikiId: WIKI_ID, acked: true });
    expect(b).toEqual(a);
    expect(island.terminations()).toBe(1);
    expect(pool.tier(WIKI_ID)).toBe("anu");
  });

  test("disposeAll beside an unmount in flight sends no second teardown", async () => {
    const island = scriptedHost();
    const pool = new VesselIslandPoolCore({ host: island.host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());

    const unmount = pool.unmountWiki(WIKI_ID);
    const all = pool.disposeAll();
    const again = pool.disposeAll();
    // Each disposeAll reaches the island a few turns after its call; let those turns run before the ack.
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
    expect(island.teardowns()).toBe(1);
    island.ack();
    expect(await unmount).toEqual({ wikiId: WIKI_ID, acked: true });
    expect((await all).acked).toEqual([WIKI_ID]);
    expect((await again).cut).toEqual([]);
    expect(island.terminations()).toBe(1);
  });

  test("CONTROL: an unmount after the first completed answers at once and sends nothing; a fresh mount tears down afresh", async () => {
    const island = scriptedHost();
    const pool = new VesselIslandPoolCore({ host: island.host, resolvePluginCids: NO_OFFERINGS });
    await pool.mountWiki(WIKI_ID, spec());
    const first = pool.unmountWiki(WIKI_ID);
    island.ack();
    await first;
    expect(await pool.unmountWiki(WIKI_ID)).toEqual({ wikiId: WIKI_ID, acked: true });
    expect(island.teardowns()).toBe(1);

    // The island stands again: its own teardown runs its own handshake.
    await pool.mountWiki(WIKI_ID, spec());
    const later = pool.unmountWiki(WIKI_ID);
    expect(island.teardowns()).toBe(2);
    island.ack();
    expect(await later).toEqual({ wikiId: WIKI_ID, acked: true });
  });
});
