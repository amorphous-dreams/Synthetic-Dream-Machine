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

// A face house's Repo rests under a name that carries the digest of its (PersonaGroup, persona root) pair, so the
// origin's database list names no face and a claim under a foreign root can never open another house's store.
async function houseStoreName(personaGroup: string, personaRoot: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${personaGroup}|${personaRoot}`)));
  return `${lockName}:house:${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Hand a tab's sync port to a house Repo, withholding the Repo's frames from the tab until the house's gate clears:
 * the tab's frames reach the Repo at once (the island proves the face from them), and the Repo's reach the tab after.
 */
function attachGatedPeer(repo: Repo, tab: MessagePort, serving: Promise<void>): void {
  const relay = new MessageChannel();
  attachMessageChannelSync(repo, relay.port1);
  let open = false;
  const held: unknown[] = [];
  relay.port2.onmessage = (e: MessageEvent) => { if (open) tab.postMessage(e.data); else held.push(e.data); };
  tab.onmessage = (e: MessageEvent) => { relay.port2.postMessage(e.data); };
  void serving.then(() => { open = true; for (const frame of held.splice(0)) tab.postMessage(frame); });
}

const core = makeSharedHolderCore({
  lockName,
  locks: sw.navigator?.locks ?? null,
  spawnIsland: () => browserWorkerHandle(new Worker(islandUrl, { type: "module" })),
  makeRepo: async (personaGroup, personaRoot) => {
    const repo = new Repo({ storage: new IndexedDBStorageAdapter(await houseStoreName(personaGroup, personaRoot)) });
    return {
      shutdown: () => repo.shutdown(),
      attachPeer: (port, serving) => {
        if (serving) attachGatedPeer(repo, port, serving);
        else attachMessageChannelSync(repo, port);
      },
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
