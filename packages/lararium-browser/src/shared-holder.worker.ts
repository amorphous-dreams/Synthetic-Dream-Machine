/**
 * shared-holder.worker — the module SharedWorker entry: one holder per origin, the island behind it.
 *
 * The script URL carries `?island=<daemon worker url>&lock=<lock name>`; the first tab to connect boots the
 * daemon island once (a nested dedicated worker), and every tab's port pipes to it (shared-holder-core.ts).
 * The holder takes the store's Web Lock so a tab that asks finds it held by THE HOLDER and attaches.
 */

import { makeSharedHolderCore } from "./shared-holder-core.js";
import { browserWorkerHandle } from "./worker-handle.js";

// The SharedWorker global, read structurally — this package's lib is DOM, so the worker scope types stay out.
const sw = globalThis as unknown as {
  location: { href: string };
  navigator?: { locks?: LockLike };
  addEventListener(type: "connect", cb: (e: MessageEvent) => void): void;
};
interface LockLike {
  request(name: string, options: { ifAvailable: true }, cb: (lock: { name: string } | null) => unknown): Promise<unknown>;
  query?(): Promise<{ held?: ReadonlyArray<{ name: string; mode: string; clientId: string }> }>;
}

const params    = new URL(sw.location.href).searchParams;
const islandUrl = params.get("island") ?? "";
const lockName  = params.get("lock")   ?? "lares:vessel:lares:vessel";

const core = makeSharedHolderCore({
  lockName,
  locks: sw.navigator?.locks ?? null,
  spawnIsland: () => browserWorkerHandle(new Worker(islandUrl, { type: "module" })),
});

sw.addEventListener("connect", (e: MessageEvent) => {
  const port = e.ports[0];
  if (port) void core.connect(port);
});
