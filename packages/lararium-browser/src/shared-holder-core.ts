/**
 * shared-holder-core — THE HOUSE BEHIND THE LOCK: one daemon island per origin, a port per tab.
 *
 * The Web Lock (vessel-lock.ts) refuses a second holder over one store. This core IS the one holder: it runs
 * inside a module SharedWorker (shared-holder.worker.ts), takes the store's lock for its own life, spawns the
 * daemon island ONCE, and hands every connecting tab a MessagePort onto it. A tab posts to the island through
 * its port; the island's messages reach every tab.
 *
 * Pure: the lock surface, the island spawn and the ports ride in, so a witness drives it with fakes and counts
 * island boots. The worker entry wires the platform pieces around it and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/moves
 */

import type { LockHost } from "./vessel-lock.js";

/** What the holder owns — the daemon island's worker handle, by the mesh handle shape. */
export interface HolderIsland {
  post(msg: unknown, transfer?: unknown[]): void;
  listen(onMessage: (raw: unknown) => void): () => void;
  onError(cb: (err: Error) => void): () => void;
  terminate(): void;
}

/** The greeting every tab receives on connect. */
export interface HolderHello {
  readonly kind:         "holder:hello";
  /** How many times this holder booted its island — ONE for the holder's whole life. */
  readonly islandBoots:  number;
  /** How many tabs stand attached, this one included. */
  readonly tabs:         number;
  /** The lock client the platform reports for this holder — a tab compares it to the lock's holder to ATTACH. */
  readonly lockClientId: string | null;
}

/** A port as the holder sees it — the two members `MessagePort` and a fake alike carry. */
export interface HolderPort {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", cb: (e: MessageEvent) => void): void;
  start?(): void;
}

export interface SharedHolderCoreOptions {
  readonly lockName:    string;
  readonly locks:       LockHost | null;
  readonly spawnIsland: () => HolderIsland;
}

export interface SharedHolderCore {
  /** A tab connected: greet it, pipe it to the island, boot the island on the first. */
  connect(port: HolderPort): Promise<void>;
  readonly islandBoots: number;
  readonly tabs:        number;
}

export function makeSharedHolderCore(opts: SharedHolderCoreOptions): SharedHolderCore {
  const ports = new Set<HolderPort>();
  let island: HolderIsland | null = null;
  let islandBoots = 0;
  let lockClientId: string | null = null;
  let lockTaken: Promise<void> | null = null;

  // Take the store's lock for the holder's whole life. The callback's promise never settles, so the platform
  // never lets go; a reaped SharedWorker releases it the one way a crashed holder can.
  const takeLock = (): Promise<void> => {
    if (lockTaken) return lockTaken;
    lockTaken = (async () => {
      if (!opts.locks || typeof opts.locks.request !== "function") return;
      let granted: (v: boolean) => void = () => {};
      const grant = new Promise<boolean>((r) => { granted = r; });
      void opts.locks.request(opts.lockName, { ifAvailable: true }, (lock) => {
        granted(lock !== null);
        return lock === null ? undefined : new Promise<never>(() => {});
      }).catch(() => granted(false));
      if (!(await grant)) return;
      if (typeof opts.locks.query === "function") {
        try {
          const held = (await opts.locks.query()).held ?? [];
          lockClientId = held.find((h) => h.name === opts.lockName)?.clientId ?? null;
        } catch { lockClientId = null; }
      }
    })();
    return lockTaken;
  };

  const bootIsland = (): HolderIsland => {
    if (island) return island;
    island = opts.spawnIsland();
    islandBoots++;
    // The island speaks to every tab — one island, many shores.
    island.listen((raw) => { for (const p of ports) p.postMessage(raw); });
    return island;
  };

  return {
    get islandBoots() { return islandBoots; },
    get tabs()        { return ports.size; },
    async connect(port) {
      await takeLock();
      const isl = bootIsland();
      ports.add(port);
      // A tab's message rides to the island whole; a transferred port (the manifest's sync port) rides with it.
      port.addEventListener("message", (e) => {
        const transfer = (e.ports ?? []) as unknown as unknown[];
        isl.post(e.data, transfer.length ? transfer : undefined);
      });
      port.start?.();
      const hello: HolderHello = { kind: "holder:hello", islandBoots, tabs: ports.size, lockClientId };
      port.postMessage(hello);
    },
  };
}
