/**
 * shared-holder.test — ONE DAEMON ISLAND PER HOUSE, TABS GET A MessagePort (device-capabilities-2026 #/moves 5:
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
import { faceFixture } from "./holder-session-fixture.js";

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

/** A fake island: counts boots and answers wiki verb requests. */
function fakeIslandFactory(): { spawn: () => HolderIsland; boots: () => number } {
  let boots = 0;
  return {
    boots: () => boots,
    spawn: (_group?: string, personaRoot?: string, edgeDigest?: string) => {
      boots++;
      const listeners = new Set<(raw: unknown) => void>();
      // The island's Binding Gate clears for the edge the first session presented.
      queueMicrotask(() => { for (const l of listeners) l({ type: "gate:clear", edgeDigest, personaRoot }); });
      return {
        post:      (msg) => {
          const request = msg as { type?: string; requestId?: string };
          if (request.type === "wiki:place-verb") {
            for (const l of listeners) l({ type: "wiki:verb-result", requestId: request.requestId, result: { ok: true } });
          }
        },
        listen:    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        onError:   () => () => {},
        terminate: () => {},
      };
    },
  };
}

/** A fake SharedWorker: one core per URL (the platform's one-per-name-and-URL), a fresh port pair per tab. */
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

    const a = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/shared-holder.worker.js"), host });
    const b = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/shared-holder.worker.js"), host });
    expect(a.kind).toBe("attached"); expect(b.kind).toBe("attached");
    if (a.kind !== "attached" || b.kind !== "attached") return;

    expect(island.boots()).toBe(0);                       // a port that admitted no session stands no house
    expect(a.hello.islandBoots).toBe(0); expect(b.hello.islandBoots).toBe(0);
    expect(a.hello).toMatchObject({ ownerEpoch: expect.any(String), sessionId: expect.any(String), generation: 0 });
    expect(b.hello.ownerEpoch).toBe(a.hello.ownerEpoch);
    expect(b.hello.sessionId).not.toBe(a.hello.sessionId);
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

    // The port speaks to the ONE island: its reply returns to the asking tab alone.
    const face = await faceFixture("face:holder-test");
    const session = { personaGroup: face.group, edge: face.edge, atom: face.atom };
    const ha = holderWorkerHandle(a.port, session); const hb = holderWorkerHandle(b.port, session);
    const seenA = new Promise<unknown>((r) => ha.listen((m) => r(m)));
    ha.post({ type: "wiki:place-verb", requestId: "from-a" });
    // The handle stamps the tab's envelope going out and reads it off coming in: the daemon core sees the bare message.
    expect(await seenA).toEqual({ type: "wiki:verb-result", requestId: "from-a", result: { ok: true } });
    expect(island.boots()).toBe(1);                       // ONE island for the face, however many tabs wear it
    const seenB: unknown[] = [];
    hb.listen((message) => seenB.push(message));
    expect(seenB).toEqual([]);
  });

  test("the tab's handle hears only its own session: another session or generation under its owner's epoch drops by name", async () => {
    const hello = { kind: "holder:hello", islandBoots: 1, tabs: 1, lockClientId: "holder-x", ownerEpoch: "epoch-x", sessionId: "session-mine", generation: 0, nonce: "00" };
    let holderSide!: MessagePort;
    class GreetingSharedWorker {
      readonly port: MessagePort;
      constructor() {
        const { port1, port2 } = new MessageChannel();
        this.port = port1; holderSide = port2;
        port2.postMessage(hello);
      }
    }
    const attached = await attachSharedHolder({ houseName: "lares:house:test", 
      holderUrl: new URL("https://vessel.test/shared-holder.worker.js"),
      host: { SharedWorker: GreetingSharedWorker as unknown as SharedWorkerHost["SharedWorker"] },
    });
    if (attached.kind !== "attached") throw new Error("the fake holder did not attach");
    const heard: unknown[] = [];
    const drops: unknown[] = [];
    const warn = console.warn;
    console.warn = (...line: unknown[]) => { drops.push(line.join(" ")); };
    try {
      holderWorkerHandle(attached.port).listen((m) => heard.push(m));
      const envelope = { ownerEpoch: "epoch-x", sessionId: "session-mine", generation: 0 };
      holderSide.postMessage({ type: "breath", wikiUri: "other-session", ...envelope, sessionId: "session-theirs" });
      holderSide.postMessage({ type: "breath", wikiUri: "other-generation", ...envelope, generation: 1 });
      holderSide.postMessage({ type: "breath", wikiUri: "other-owner", ...envelope, ownerEpoch: "epoch-y" });
      holderSide.postMessage({ type: "breath", wikiUri: "mine", ...envelope });
      await expect.poll(() => heard.length).toBe(1);
      expect(heard).toEqual([{ type: "breath", wikiUri: "mine" }]);
      expect(drops).toEqual(["[shared-holder] dropped unknown-session", "[shared-holder] dropped stale-generation", "[shared-holder] dropped stale-owner-epoch"]);
    } finally {
      console.warn = warn;
      holderSide.close();
    }
  });

  test("CONTROL — no SharedWorker on the host: the floor, named; the lock refuses as today with no holder to attach to", async () => {
    const r = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl: new URL("https://vessel.test/shared-holder.worker.js"), host: {} });
    expect(r.kind).toBe("floor");
    if (r.kind === "floor") expect(r.why).toMatch(/SharedWorker/);
    const lockTable = new Map<string, string>([[vesselLockName(IDB), "tab-1"]]);
    await expect(holdVesselLock(IDB, fakeLocks("tab-2", lockTable))).rejects.toThrow(/tab-1/);
  });

  test("a shared holder without Web Locks never boots or greets a second store owner", async () => {
    const island = fakeIslandFactory();
    const core = makeSharedHolderCore({ lockName: vesselLockName(IDB), locks: null, spawnIsland: island.spawn });
    const { port1, port2 } = new MessageChannel();
    const received = new Promise<unknown>((resolve) => port1.addEventListener("message", (event) => resolve(event.data), { once: true }));
    port1.start();

    await core.connect(port2);

    expect(island.boots()).toBe(0);
    expect(core.tabs).toBe(0);
    expect(await received).toEqual({
      kind: "holder:refused",
      storeName: vesselLockName(IDB),
      cause: expect.stringMatching(/Web Locks/),
    });
    port1.close();
    port2.close();
  });

  test("a named holder lock refusal reaches the tab immediately with its store and cause", async () => {
    const lockTable = new Map<string, string>([[vesselLockName(IDB), "other-holder"]]);
    const host = fakeSharedWorkerHost((url) => makeSharedHolderCore({
      lockName: vesselLockName(IDB),
      locks: fakeLocks(`holder:${url}`, lockTable),
      spawnIsland: () => { throw new Error("a refused holder must not boot an island"); },
    }));

    await expect(attachSharedHolder({ houseName: "lares:house:test", 
      holderUrl: new URL("https://vessel.test/shared-holder.worker.js"),
      host,
      helloTimeoutMs: 5_000,
    })).rejects.toMatchObject({
      name: "SharedHolderRefusal",
      storeName: vesselLockName(IDB),
      cause: expect.stringMatching(/another holder owns the lock/),
    });
  });

  test("a refused holder retries after contention releases", async () => {
    const lockName = vesselLockName(`${IDB}:retry`);
    const lockTable = new Map<string, string>([[lockName, "temporary-owner"]]);
    const island = fakeIslandFactory();
    const core = makeSharedHolderCore({ lockName, locks: fakeLocks("retrying-holder", lockTable), spawnIsland: island.spawn });
    const host = fakeSharedWorkerHost(() => core);
    const holderUrl = new URL("https://vessel.test/shared-holder.worker.js");

    await expect(attachSharedHolder({ houseName: "lares:house:test",  holderUrl, host, helloTimeoutMs: 5_000 }))
      .rejects.toMatchObject({ name: "SharedHolderRefusal", storeName: lockName });
    expect(island.boots()).toBe(0);

    lockTable.delete(lockName);
    const recovered = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl, host, helloTimeoutMs: 5_000 });
    expect(recovered.kind).toBe("attached");
    if (recovered.kind !== "attached") return;
    expect(recovered.hello.islandBoots).toBe(0);
    expect(island.boots()).toBe(0);
    recovered.port.close();
  });

  test("REAL CHROMIUM — two SharedWorker clients share the mounted wiki, and a fresh attachment reads its edit", async () => {
    const lockName = vesselLockName(`lares:test:chromium:${crypto.randomUUID()}`);
    const holderUrl = new URL("./fixtures/shared-holder-live.worker.ts", import.meta.url);
    holderUrl.searchParams.set("lock", lockName);
    const host: SharedWorkerHost = {
      SharedWorker: SharedWorker as unknown as SharedWorkerHost["SharedWorker"],
    };
    const first = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl, host });
    const second = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl, host });
    expect(first.kind).toBe("attached");
    expect(second.kind).toBe("attached");
    if (first.kind !== "attached" || second.kind !== "attached") return;
    expect(first.port).not.toBe(second.port);
    const face = await faceFixture("face:live");
    const session = { personaGroup: face.group, edge: face.edge, atom: face.atom };

    // Each tab asks the one island by its own request and hears its own answer; the edit one tab made reads back
    // through another tab's own request, never through an echo of the first tab's traffic.
    let n = 0;
    const ask = (handle: ReturnType<typeof holderWorkerHandle>, verb: "read" | "change", level?: string) => new Promise<unknown>((resolve) => {
      const requestId = `t-${++n}`;
      const stop = handle.listen((message) => {
        const m = message as { type?: unknown; requestId?: unknown; output?: unknown };
        if (m.type === "wiki:verb-result" && m.requestId === requestId) { stop(); resolve(m.output); }
      });
      handle.post({ type: "wiki:place-verb", requestId, verb, args: level ? { level } : {} });
    });
    const firstHandle = holderWorkerHandle(first.port, session);
    const secondHandle = holderWorkerHandle(second.port, session);
    expect(await ask(firstHandle, "read")).toEqual({ kind: "wiki", title: "Lady Aki", level: "2" });
    expect(await ask(firstHandle, "change", "3")).toEqual({ kind: "wiki", title: "Lady Aki", level: "3" });
    expect(await ask(secondHandle, "read")).toEqual({ kind: "wiki", title: "Lady Aki", level: "3" });

    second.port.close();
    const reattached = await attachSharedHolder({ houseName: "lares:house:test",  holderUrl, host });
    expect(reattached.kind).toBe("attached");
    if (reattached.kind !== "attached") return;
    expect(reattached.hello.islandBoots).toBe(1);
    expect(await ask(holderWorkerHandle(reattached.port, session), "read")).toEqual({ kind: "wiki", title: "Lady Aki", level: "3" });

    first.port.close();
    reattached.port.close();
  }, 10_000);

  test("REAL CHROMIUM MUTATION — another page's lock yields an immediate named holder refusal", async () => {
    const lockName = vesselLockName(`lares:test:chromium-refusal:${crypto.randomUUID()}`);
    const holderUrl = new URL("./fixtures/shared-holder-live.worker.ts", import.meta.url);
    holderUrl.searchParams.set("lock", lockName);
    let releaseLock: (() => void) | undefined;
    let signalHeld: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { signalHeld = resolve; });
    const lockLife = navigator.locks.request(lockName, { ifAvailable: true }, (lock) => {
      if (!lock) throw new Error("the mutation could not acquire its source lock");
      signalHeld?.();
      return new Promise<void>((resolve) => { releaseLock = resolve; });
    });
    await held;
    const host: SharedWorkerHost = {
      SharedWorker: SharedWorker as unknown as SharedWorkerHost["SharedWorker"],
    };
    try {
      await expect(attachSharedHolder({ houseName: "lares:house:test",  holderUrl, host, helloTimeoutMs: 5_000 }))
        .rejects.toMatchObject({ name: "SharedHolderRefusal", storeName: lockName });
    } finally {
      releaseLock?.();
      await lockLife;
    }
  }, 10_000);

  test("a delayed holder greeting cannot open an unguarded fallback", async () => {
    const noGreeting: SharedWorkerHost = {
      SharedWorker: class {
        readonly port = new MessageChannel().port1;
      } as unknown as SharedWorkerHost["SharedWorker"],
    };
    const attached = await attachSharedHolder({ houseName: "lares:house:test", 
      holderUrl: new URL("https://vessel.test/shared-holder.worker.js"),
      host: noGreeting,
      helloTimeoutMs: 1,
    });
    expect(attached.kind).toBe("floor");
    await expect(holdVesselLock(IDB, null)).rejects.toThrow(/Web Locks/);
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
