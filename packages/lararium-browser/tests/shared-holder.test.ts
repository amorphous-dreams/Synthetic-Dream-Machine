/**
 * shared-holder.test — ONE DAEMON ISLAND PER ORIGIN, TABS GET A MessagePort (device-capabilities-2026 #/moves 5:
 * "the daemon island could stand ONCE per origin and hand each tab a MessagePort — move 2's lock becomes the door,
 * this becomes the house behind it").
 *
 * Red over a FAKE `SharedWorker` (one holder core per script URL, the way the platform gives one SharedWorker per
 * URL per origin) and FAKE Web Locks: two vessel-open attaches → ONE island boot, two ports, each greeted; the
 * holder took the lock, and a tab that finds the lock held BY THE HOLDER attaches rather than refusing.
 * CONTROL: a host without `SharedWorker` reads the floor — the dedicated-worker path stands as today, and the
 * lock's refusal stays the refusal (`vessel-lock.test.ts` holds those bytes).
 * MEASURED-NOT-ASSUMED: the holder's lifetime past the last tab closing (Safari / Firefox) stands as ONE
 * `test.fails` naming what a real-browser measure must prove.
 */
import { describe, expect, test } from "vitest";
import { makeSharedHolderCore, type HolderIsland } from "../src/shared-holder-core.js";
import { attachSharedHolder, holderWorkerHandle, type SharedWorkerHost } from "../src/shared-holder.js";
import { holdVesselLock, vesselLockName, type LockHost } from "../src/vessel-lock.js";

/** In-memory Web Locks: one exclusive holder per name; `ifAvailable` answers at once; query names the client. */
function fakeLocks(clientId: string, shared: Map<string, string>): LockHost {
  return {
    request: async (name, _opts, cb) => {
      if (shared.has(name)) return cb(null);
      shared.set(name, clientId);
      const out = cb({ name });
      // Held for the callback's life — the platform lets go when the promise settles.
      void Promise.resolve(out).finally(() => { if (shared.get(name) === clientId) shared.delete(name); });
      return out;
    },
    query: async () => ({ held: [...shared].map(([name, id]) => ({ name, mode: "exclusive", clientId: id })) }),
  };
}

/** A fake island: counts boots, echoes every post back as `{ echo }`. */
function fakeIslandFactory(): { spawn: () => HolderIsland; boots: () => number } {
  let boots = 0;
  return {
    boots: () => boots,
    spawn: () => {
      boots++;
      const listeners = new Set<(raw: unknown) => void>();
      return {
        post:      (msg) => { for (const l of listeners) l({ echo: msg }); },
        listen:    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        onError:   () => () => {},
        terminate: () => {},
      };
    },
  };
}

/** A fake SharedWorker: one core per URL (the platform's one-per-origin-per-URL), a fresh port pair per tab. */
function fakeSharedWorkerHost(coreFor: (url: string) => ReturnType<typeof makeSharedHolderCore>): SharedWorkerHost {
  class FakeSharedWorker {
    readonly port: MessagePort;
    constructor(url: string | URL) {
      const { port1, port2 } = new MessageChannel();
      this.port = port1;
      coreFor(String(url)).connect(port2);
    }
  }
  return { SharedWorker: FakeSharedWorker as unknown as SharedWorkerHost["SharedWorker"] };
}

const IDB = "lares:vessel:holder-test";

describe("the shared holder — one island per origin, a port per tab", () => {
  test("two attaches over one fake SharedWorker → ONE island boot, two ports, two greetings; the holder holds the lock", async () => {
    const lockTable = new Map<string, string>();
    const island    = fakeIslandFactory();
    const cores     = new Map<string, ReturnType<typeof makeSharedHolderCore>>();
    const coreFor   = (url: string) => {
      let c = cores.get(url);
      if (!c) { c = makeSharedHolderCore({ lockName: vesselLockName(IDB), locks: fakeLocks("holder-1", lockTable), spawnIsland: island.spawn }); cores.set(url, c); }
      return c;
    };
    const host = fakeSharedWorkerHost(coreFor);

    const a = await attachSharedHolder({ holderUrl: new URL("https://vessel.test/shared-holder.worker.js"), host });
    const b = await attachSharedHolder({ holderUrl: new URL("https://vessel.test/shared-holder.worker.js"), host });
    expect(a.kind).toBe("attached"); expect(b.kind).toBe("attached");
    if (a.kind !== "attached" || b.kind !== "attached") return;

    expect(island.boots()).toBe(1);                       // ONE island
    expect(a.hello.islandBoots).toBe(1); expect(b.hello.islandBoots).toBe(1);
    expect(a.hello.tabs).toBe(1);        expect(b.hello.tabs).toBe(2);
    expect(a.port).not.toBe(b.port);                      // two ports
    expect(lockTable.get(vesselLockName(IDB))).toBe("holder-1");   // the holder took the lock
    expect(a.hello.lockClientId).toBe("holder-1");

    // A tab that finds the lock held BY THE HOLDER attaches rather than refusing.
    const hold = await holdVesselLock(IDB, fakeLocks("tab-2", lockTable), { attachToHolder: b.hello.lockClientId });
    expect(hold.held).toBe(false);
    expect(hold.attached).toBe(true);
    // A tab that finds the lock held by ANOTHER TAB still refuses loud (the collision the lock exists to stop).
    await expect(holdVesselLock(IDB, fakeLocks("tab-3", lockTable), { attachToHolder: "some-other-holder" })).rejects.toThrow(/already held/);

    // The port speaks to the ONE island: a post from tab A echoes to BOTH tabs.
    const ha = holderWorkerHandle(a.port); const hb = holderWorkerHandle(b.port);
    const seenB = new Promise<unknown>((r) => hb.listen((m) => r(m)));
    const seenA = new Promise<unknown>((r) => ha.listen((m) => r(m)));
    ha.post({ ping: 1 });
    expect(await seenA).toEqual({ echo: { ping: 1 } });
    expect(await seenB).toEqual({ echo: { ping: 1 } });
  });

  test("CONTROL — no SharedWorker on the host: the floor, named; the lock refuses as today with no holder to attach to", async () => {
    const r = await attachSharedHolder({ holderUrl: new URL("https://vessel.test/shared-holder.worker.js"), host: {} });
    expect(r.kind).toBe("floor");
    if (r.kind === "floor") expect(r.why).toMatch(/SharedWorker/);
    const lockTable = new Map<string, string>([[vesselLockName(IDB), "tab-1"]]);
    await expect(holdVesselLock(IDB, fakeLocks("tab-2", lockTable))).rejects.toThrow(/tab-1/);
  });

  test.fails("MEASURED-NOT-ASSUMED — the holder survives the last tab closing for N seconds (Safari / Firefox lifetime)", async () => {
    // What a real-browser measure must prove: with two tabs attached, close both, wait N seconds, open a third —
    // its hello reads `islandBoots === 1` (the holder lived) rather than 2 (the platform reaped it and the island
    // re-booted). Chromium keeps a SharedWorker alive only while a client holds it; Firefox proposes
    // `extendedLifetime` (Mozilla #1227); Safari's lifetime under the seven-day rule stays unread. No fake can
    // stand in for the platform's reaper, so this stays red until `tools/mesh-scenarios.sh` gains the walk.
    const measured: { islandBootsAfterReopen: number } | null = null;
    expect(measured).not.toBeNull();
  });
});
