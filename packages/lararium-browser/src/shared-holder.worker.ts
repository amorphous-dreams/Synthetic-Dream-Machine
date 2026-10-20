/**
 * shared-holder.worker — the module SharedWorker entry: one holder per origin, the island behind it.
 *
 * The script URL carries `?island=<daemon worker url>&lock=<lock name>`; the first admitted session of each face
 * stands that face's house: its daemon island (a nested dedicated worker) and its own Repo (shared-holder-core.ts).
 * The holder takes the store's Web Lock so a tab that asks finds it held by THE HOLDER and attaches. It holds
 * documents and ciphertext and no key: a face's hive lives in its island, and ending the island locks it.
 */

import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { attachMessageChannelSync } from "@lararium/mesh";
import { makeHolderRuntime } from "./shared-holder-runtime.js";
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

const { core } = makeHolderRuntime({
  lockName,
  locks: sw.navigator?.locks ?? null,
  spawnIsland: () => browserWorkerHandle(new Worker(islandUrl, { type: "module" })),
  openRepo: (storeName) => {
    const repo = new Repo({ storage: new IndexedDBStorageAdapter(storeName) });
    return {
      shutdown: () => repo.shutdown(),
      attachSide: (port: MessagePort) => attachMessageChannelSync(repo, port),
    };
  },
});

sw.addEventListener("connect", (e: MessageEvent) => {
  const port = e.ports[0];
  if (port) {
    // Engines that surface a close event release the port's routes; a failed clone marks it lost too.
    port.addEventListener("close", () => core.disconnect(port));
    port.addEventListener("messageerror", () => core.disconnect(port));
    void core.connect(port);
  }
});
