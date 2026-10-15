/**
 * working-layer-host-binding-bound — the host's ask for the daemon working binding never waits in silence.
 *
 * A worker that never answers ends the mount in HostWorkingBindingRefusal once the hang bound passes; a
 * worker that faults or errors ends it at once; a worker that answers late, inside the bound, mounts.
 */
import { afterEach, describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { DAEMON_BAG_ID, emptyLarDoc, mkDaemonResolveBindingResult, mkEa, mkFault, wikiSlotUri, type IslandMsg_Manifest, type LarDoc } from "@lararium/mesh";
import { HostWorkingBindingRefusal, openDaemonVmCore, type DaemonVmHost } from "@lararium/tw5";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function rig(boundMs: number) {
  const repo = new Repo();
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const workingHandle = repo.create<LarDoc>(emptyLarDoc());
  const listeners: Array<(message: unknown) => void> = [];
  const errorListeners: Array<(error: unknown) => void> = [];
  const posted: Array<{ type?: string; requestId?: string }> = [];
  const worker = {
    post: (message: unknown) => { posted.push(message as never); },
    listen: (listener: (message: unknown) => void) => { listeners.push(listener); return () => {}; },
    onError: (listener: (error: unknown) => void) => { errorListeners.push(listener); return () => {}; },
    terminate: () => {},
  };
  const ports: MessagePort[] = [];
  const host: DaemonVmHost = {
    spawnWorker: () => worker,
    newSyncChannel: () => {
      const { port1, port2 } = new MessageChannel();
      ports.push(port1, port2);
      return { mainPort: port1 as unknown as IslandMsg_Manifest["syncPort"], syncPort: port2 as unknown as IslandMsg_Manifest["syncPort"] };
    },
  };
  const core = openDaemonVmCore(host, {
    repo, daemonHandle, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
    workerScriptUrl: new URL("file:///unused-fake-worker"), hostBindingBoundMs: boundMs,
  });
  cleanups.push(() => { core.dispose(); for (const port of ports) port.close(); return repo.shutdown().then(() => {}); });
  listeners.forEach((listener) => listener(mkEa(DAEMON_BAG_ID)));
  const answer = (requestId: string) => listeners.forEach((listener) => listener(mkDaemonResolveBindingResult({
    requestId, personalUrl: workingHandle.url, draftUrl: workingHandle.url, workingUrl: workingHandle.url,
  })));
  const asked = async () => { for (let i = 0; i < 50 && !posted.some((m) => m.type === "daemon:resolve-binding-request"); i++) await pause(2); return posted.find((m) => m.type === "daemon:resolve-binding-request")!; };
  return { core, listeners, errorListeners, answer, asked };
}

describe("the host's binding ask ends in a named refusal or a mount, never in silence", () => {
  test("a worker that never answers ends in HostWorkingBindingRefusal once the bound passes", async () => {
    const r = rig(60);
    await expect(r.core.mountHostWorkingLayer()).rejects.toBeInstanceOf(HostWorkingBindingRefusal);
  });

  test("a worker that faults ends the ask at once, before any bound", async () => {
    const r = rig(60_000);
    const mounting = r.core.mountHostWorkingLayer();
    await r.asked();
    r.listeners.forEach((listener) => listener(mkFault("lar:///ha.ka.ba/wikis/daemon", "boom")));
    await expect(mounting).rejects.toBeInstanceOf(HostWorkingBindingRefusal);
  });

  test("a worker that errors ends the ask at once", async () => {
    const r = rig(60_000);
    const mounting = r.core.mountHostWorkingLayer();
    await r.asked();
    r.errorListeners.forEach((listener) => listener(new Error("worker exited")));
    await expect(mounting).rejects.toBeInstanceOf(HostWorkingBindingRefusal);
  });

  test("CONTROL: a worker that answers late, inside the bound, mounts the working layer", async () => {
    const r = rig(5_000);
    const mounting = r.core.mountHostWorkingLayer();
    const ask = await r.asked();
    await pause(150);
    r.answer(ask.requestId!);
    await mounting;
    expect(r.core.composite.defaultWritableBagId()).toBe(wikiSlotUri("daemon", "working"));
  });
});
