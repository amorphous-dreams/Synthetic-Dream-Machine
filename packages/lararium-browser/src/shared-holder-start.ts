import { refuseBufferedPorts, type ConnectBuffer } from "./connect-buffer.js";
import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { attachMessageChannelSync } from "@lararium/mesh";
import { makeHolderRuntime } from "./shared-holder-runtime.js";
import type { BrowserIslandScope } from "./browser-sovereign-island-model.js";


/** Starts the holder; a start that fails refuses every buffered and later port by name, then rethrows for the entry's log. */
export async function startHolder(buffer: ConnectBuffer<MessagePort>): Promise<void> {
  try { await startHolderOn(buffer); }
  catch (error) {
    const lock = new URL((globalThis as unknown as { location: { href: string } }).location.href).searchParams.get("lock") ?? "lares:vessel:lares:vessel";
    refuseBufferedPorts(buffer, lock, error);
    throw error;
  }
}

async function startHolderOn(buffer: ConnectBuffer<MessagePort>): Promise<void> {
  const sw = globalThis as unknown as {
    name: string;
    location: { href: string };
    navigator?: { locks?: Parameters<typeof makeHolderRuntime>[0]["locks"] };
  };
  const params = new URL(sw.location.href).searchParams;
  const lockName = params.get("lock") ?? "lares:vessel:lares:vessel";
  const moduleUrl = params.get("island-module");
  const startIsland = moduleUrl
    ? (await import(/* @vite-ignore */ moduleUrl) as { startIsland(scope: BrowserIslandScope): void }).startIsland
    : (await import("./daemon-island-start.js")).startIsland;
  if (typeof startIsland !== "function") throw new Error("island module exports no startIsland(scope)");

  const { core } = makeHolderRuntime({
    lockName,
    holderLockName: `${lockName}:${sw.name}`,
    expectedHouseName: sw.name,
    locks: sw.navigator?.locks ?? null,
    spawnIsland: () => {
      const { port1, port2 } = new MessageChannel();
      const errors = new Set<(error: Error) => void>();
      const stop = new Set<() => void>();
      const listeners = new Set<(raw: unknown) => void>();
      port1.addEventListener("message", (event) => { for (const cb of listeners) cb(event.data); });
      port1.addEventListener("messageerror", () => { for (const cb of errors) cb(new Error("island port messageerror")); });
      port1.start();
      const scope: BrowserIslandScope = {
        post: (msg) => port2.postMessage(msg),
        listen: (cb) => { port2.addEventListener("message", (event) => cb(event.data)); port2.start(); },
        ready: () => port2.postMessage({ type: "ready" }),
        onStop: (cb) => { stop.add(cb); },
      };
      try { startIsland(scope); }
      catch (error) { port1.close(); port2.close(); throw error; }
      return {
        post: (msg, transfer) => port1.postMessage(msg, (transfer ?? []) as Transferable[]),
        listen: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
        onError: (cb) => { errors.add(cb); return () => errors.delete(cb); },
        terminate: () => {
          let finished = false;
          const finish = () => { if (finished) return; finished = true; for (const cb of stop) cb(); port1.close(); port2.close(); };
          const timer = setTimeout(finish, 5_000);
          port1.addEventListener("message", (event) => {
            if ((event.data as { type?: string })?.type !== "teardown:ack") return;
            clearTimeout(timer);
            finish();
          });
          port1.postMessage({ type: "teardown" });
        },
      };
    },
    openRepo: (storeName) => {
      const repo = new Repo({ storage: new IndexedDBStorageAdapter(storeName) });
      return { shutdown: () => repo.shutdown(), attachSide: (port: MessagePort) => attachMessageChannelSync(repo, port) };
    },
  });

  buffer.open((port) => {
    port.addEventListener("close", () => core.disconnect(port));
    port.addEventListener("messageerror", () => core.disconnect(port));
    void core.connect(port);
  });
}
