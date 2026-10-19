/**
 * shared-holder-core — THE HOUSE BEHIND THE LOCK: one daemon island per origin, a port per tab.
 *
 * The Web Lock (vessel-lock.ts) refuses a second holder over one store. This core IS the one holder: it runs
 * inside a module SharedWorker (shared-holder.worker.ts), takes the store's lock for its own life, spawns the
 * daemon island ONCE, and hands every connecting tab a MessagePort onto it. A tab posts to the island through
 * its port; the island's messages follow the route declared for each kind.
 *
 * Pure: the lock surface, the island spawn and the ports ride in, so a witness drives it with fakes and counts
 * island boots. The worker entry wires the platform pieces around it and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/moves
 */

import type { LockHost } from "./vessel-lock.js";
import { HOLDER_ROUTES } from "./holder-routes.js";

type WireMessage = Record<string, unknown> & { type: string };

function wireMessage(raw: unknown): WireMessage | null {
  if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") return null;
  return raw as WireMessage;
}

// These tab-originated requests expect an island result. Island-originated asks also carry requestId,
// but their answers must keep that id whole on the return crossing.
const TAB_REQUESTS = new Set([
  "wiki:place-verb",
  "daemon:place-verb",
  "daemon:derive-skeleton-request",
  "daemon:worldline-compare-request",
  "daemon:worldline-trajectory-request",
  "daemon:resolve-binding-request",
]);

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

/** A holder that cannot own its store names the refusal before a tab considers opening a local holder. */
export interface HolderRefused {
  readonly kind: "holder:refused";
  readonly storeName: string;
  readonly cause: string;
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
  readonly onDrop?: (kind: string, reason: string) => void;
}

export interface SharedHolderCore {
  /** A tab connected: greet it, pipe it to the island, boot the island on the first. */
  connect(port: HolderPort): Promise<void>;
  disconnect(port: HolderPort): void;
  readonly islandBoots: number;
  readonly tabs:        number;
}

export function makeSharedHolderCore(opts: SharedHolderCoreOptions): SharedHolderCore {
  const ports = new Set<HolderPort>();
  const ended = new WeakSet<HolderPort>();
  const pending = new Map<string, { port: HolderPort; requestId: string }>();
  const cameras = new Map<string, HolderPort>();
  const requestNamespace = crypto.randomUUID();
  let nextRequest = 0;
  let owner: HolderPort | null = null;
  let island: HolderIsland | null = null;
  let islandBoots = 0;
  let lockClientId: string | null = null;
  let lockTaken: Promise<void> | null = null;
  const onDrop = opts.onDrop ?? ((kind: string, reason: string) => {
    console.warn(`[shared-holder] dropped ${kind}: ${reason}`);
  });

  const routeFromIsland = (raw: unknown): void => {
    const msg = wireMessage(raw);
    if (!msg) { onDrop("unknown", "invalid-message"); return; }
    const route = HOLDER_ROUTES[msg.type as keyof typeof HOLDER_ROUTES];
    if (!route) { onDrop(msg.type, "unknown-route"); return; }
    if (route === "owner") {
      if (!owner || !ports.has(owner)) { onDrop(msg.type, "no-owner"); return; }
      owner.postMessage(raw);
      return;
    }
    if (route === "camera") {
      const cameraId = msg.cameraId;
      if (typeof cameraId !== "string") { onDrop(msg.type, "missing-camera-id"); return; }
      const port = cameras.get(cameraId);
      if (!port || !ports.has(port)) { onDrop(msg.type, "no-camera-lease"); return; }
      port.postMessage(raw);
      return;
    }
    const holderId = msg.requestId;
    if (typeof holderId !== "string") { onDrop(msg.type, "missing-request-id"); return; }
    const asking = pending.get(holderId);
    if (!asking || !ports.has(asking.port)) { onDrop(msg.type, "unknown-request"); return; }
    pending.delete(holderId);
    asking.port.postMessage({ ...msg, requestId: asking.requestId });
  };

  // Take the store's lock for the holder's whole life. The callback's promise never settles, so the platform
  // never lets go; a reaped SharedWorker releases it the one way a crashed holder can.
  const takeLock = (): Promise<void> => {
    if (lockTaken) return lockTaken;
    const attempt = (async () => {
      if (!opts.locks || typeof opts.locks.request !== "function") {
        throw new Error(`[vessel] shared holder cannot open store "${opts.lockName}": this engine offers no Web Locks.`);
      }
      let granted: (v: boolean) => void = () => {};
      const grant = new Promise<boolean>((r) => { granted = r; });
      let requestFailure: string | null = null;
      void opts.locks.request(opts.lockName, { ifAvailable: true }, (lock) => {
        granted(lock !== null);
        return lock === null ? undefined : new Promise<never>(() => {});
      }).catch((error) => {
        requestFailure = error instanceof Error ? error.message : String(error);
        granted(false);
      });
      if (!(await grant)) {
        const cause = requestFailure ? `: ${requestFailure}` : " — another holder owns the lock";
        throw new Error(`[vessel] shared holder refused store "${opts.lockName}"${cause}.`);
      }
      if (typeof opts.locks.query === "function") {
        try {
          const held = (await opts.locks.query()).held ?? [];
          lockClientId = held.find((h) => h.name === opts.lockName)?.clientId ?? null;
        } catch { lockClientId = null; }
      }
    })();
    lockTaken = attempt;
    // A refusal describes this lock attempt, not the holder's whole lifetime. Once the other owner
    // releases, a later tab may retry through this same SharedWorker and become the sole holder.
    void attempt.catch(() => {
      if (lockTaken === attempt) lockTaken = null;
    });
    return attempt;
  };

  const bootIsland = (): HolderIsland => {
    if (island) return island;
    island = opts.spawnIsland();
    islandBoots++;
    island.listen(routeFromIsland);
    return island;
  };

  return {
    get islandBoots() { return islandBoots; },
    get tabs()        { return ports.size; },
    disconnect(port) {
      ended.add(port);
      ports.delete(port);
      if (owner === port) owner = null;
      for (const [id, asking] of pending) if (asking.port === port) pending.delete(id);
      for (const [id, holder] of cameras) if (holder === port) cameras.delete(id);
    },
    async connect(port) {
      // The attachment door needs the named cause now; a silent port would make the tab wait on its bound.
      try { await takeLock(); } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        const refused: HolderRefused = { kind: "holder:refused", storeName: opts.lockName, cause };
        port.postMessage(refused);
        return;
      }
      if (ended.has(port)) return;
      // THE OWNER IS THE PORT THAT STANDS THE ISLAND: the island speaks `ready` before any manifest arrives, so its
      // boot traffic needs a destination from the first message. A later port takes the owner role only once no owner
      // stands (the first one ended), and it then sends its own manifest.
      if (owner === null || !ports.has(owner)) owner = port;
      const isl = bootIsland();
      ports.add(port);
      // A transferred manifest sync port rides to the one island with its owner's manifest.
      port.addEventListener("message", (e) => {
        if (!ports.has(port)) return;
        const msg = wireMessage(e.data);
        if (!msg) { onDrop("unknown", "invalid-message"); return; }
        if (msg.type === "manifest") {
          if (owner && owner !== port) {
            const refused: HolderRefused = { kind: "holder:refused", storeName: opts.lockName, cause: "island-owned" };
            port.postMessage(refused);
            onDrop(msg.type, "island-owned");
            return;
          }
          owner = port;
        }
        if ((msg.type === "lar:control-event" || msg.type === "lar:resend") && typeof msg.cameraId === "string") {
          cameras.set(msg.cameraId, port);
        }
        let forwarded: unknown = e.data;
        if (TAB_REQUESTS.has(msg.type) && typeof msg.requestId === "string") {
          const holderId = `${requestNamespace}:${++nextRequest}`;
          pending.set(holderId, { port, requestId: msg.requestId });
          forwarded = { ...msg, requestId: holderId };
        }
        const transfer = (e.ports ?? []) as unknown as unknown[];
        isl.post(forwarded, transfer.length ? transfer : undefined);
      });
      port.start?.();
      const hello: HolderHello = { kind: "holder:hello", islandBoots, tabs: ports.size, lockClientId };
      port.postMessage(hello);
    },
  };
}
