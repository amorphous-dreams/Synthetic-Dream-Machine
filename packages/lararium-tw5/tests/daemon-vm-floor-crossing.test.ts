/** A holder refusal swaps both daemon sync crossings without retaining the old Repo adapters. */
import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import { emptyLarDoc, type IslandMsg_Manifest, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import { makeMemeGetReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

describe("the daemon VM floor crossing", () => {
  test.each([false, true])("replay=%s keeps exactly one primary and one owned sync attachment", async (replay) => {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const ports: MessagePort[] = [];
    const active = new Set<unknown>();
    const added: unknown[] = [];
    const network = repo.networkSubsystem;
    const originalAdd = network.addNetworkAdapter.bind(network);
    vi.spyOn(network, "addNetworkAdapter").mockImplementation((adapter) => {
      added.push(adapter);
      active.add(adapter);
      const originalDisconnect = adapter.disconnect.bind(adapter);
      vi.spyOn(adapter, "disconnect").mockImplementation(() => {
        active.delete(adapter);
        return originalDisconnect();
      });
      return originalAdd(adapter);
    });
    const channel = () => {
      const { port1, port2 } = new MessageChannel();
      ports.push(port1, port2);
      return { mainPort: port1 as IslandMsg_Manifest["syncPort"], syncPort: port2 as IslandMsg_Manifest["syncPort"] };
    };
    let replayManifest: (() => { msg: IslandMsg_Manifest; transfer: IslandMsg_Manifest["syncPort"][]; afterPost?: () => void }) | undefined;
    const posted: unknown[] = [];
    const host: DaemonVmHost = {
      spawnWorker: () => ({ post: (msg) => { posted.push(msg); }, listen: () => () => {}, onError: () => () => {}, terminate: () => {} }),
      newSyncChannel: channel,
      newOwnedSyncChannel: channel,
      onManifestReplay: (factory) => { replayManifest = factory; },
    };
    const core = openDaemonVmCore(host, {
      repo, daemonHandle, ownedDocument: { documentUrl: daemonHandle.url },
      recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
      workerScriptUrl: new URL("file:///unused-floor-island"), eaSilenceMs: 2 ** 30,
    });
    core.workerEa.catch(() => {});
    try {
      expect(replayManifest, "the browser host receives the replacement manifest factory").toBeTypeOf("function");
      const original = [...added];
      expect(original, "the first manifest attaches both sync crossings").toHaveLength(2);
      expect(active.size).toBe(2);
      if (replay) {
        const fresh = replayManifest!();
        expect(fresh.transfer).toHaveLength(2);
        expect(added).toHaveLength(4);
        expect(original.every((adapter) => active.has(adapter)), "the old crossing stays until the replacement posts").toBe(true);
        const beforePost = posted.length;
        host.spawnWorker(new URL("file:///unused-floor-island")).post(fresh.msg, fresh.transfer);
        expect(posted).toHaveLength(beforePost + 1);
        fresh.afterPost?.();
        fresh.afterPost?.();
        expect(active.size, "the fresh two replace the retired two").toBe(2);
        expect(original.every((adapter) => !active.has(adapter)), "the old crossing has no live adapter").toBe(true);
        expect(added.slice(2).every((adapter) => active.has(adapter)), "both fresh ports stay attached").toBe(true);
      } else {
        expect(added).toHaveLength(2);
        expect(original.every((adapter) => active.has(adapter)), "without replay the first crossing stays attached").toBe(true);
      }
    } finally {
      core.dispose();
      for (const port of ports) port.close();
      await repo.shutdown();
      vi.restoreAllMocks();
    }
  });
});

test("face drop waits for the island acknowledgement", async () => {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  const listeners: Array<(msg: any) => void> = [];
  const host: DaemonVmHost = {
    spawnWorker: () => ({ post: () => {}, listen: (fn) => { listeners.push(fn); return () => {}; }, onError: () => () => {}, terminate: () => {} }),
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); ports.push(port1, port2); return { mainPort: port1 as IslandMsg_Manifest["syncPort"], syncPort: port2 as IslandMsg_Manifest["syncPort"] }; },
  };
  const core = openDaemonVmCore(host, { repo, daemonHandle, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null, workerScriptUrl: new URL("file:///unused"), eaSilenceMs: 2 ** 30 });
  core.workerEa.catch(() => {});
  try {
    let settled = false;
    const pending = core.dropFace("abc").then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    for (const listener of listeners) listener({ type: "daemon:face-settled", atomKey: "abc", op: "dropped", ok: true });
    await pending; expect(settled).toBe(true);
  } finally { core.dispose(); ports.forEach((port) => port.close()); await repo.shutdown(); }
});

test("a face change asked after the island ended rejects at once", async () => {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  const host: DaemonVmHost = {
    spawnWorker: () => ({ post: () => {}, listen: () => () => {}, onError: () => () => {}, terminate: () => {} }),
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); ports.push(port1, port2); return { mainPort: port1 as IslandMsg_Manifest["syncPort"], syncPort: port2 as IslandMsg_Manifest["syncPort"] }; },
  };
  const core = openDaemonVmCore(host, { repo, daemonHandle, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null, workerScriptUrl: new URL("file:///unused"), eaSilenceMs: 2 ** 30 });
  core.workerEa.catch(() => {});
  try {
    core.dispose();
    await expect(core.dropFace("abc")).rejects.toThrow("disposed");
  } finally { ports.forEach((port) => port.close()); await repo.shutdown(); }
});

// The face's late bags (the bag its own catalog names past boot, open-node-vessel's `registerFaceBags`) settle under op `bags`;
// a composition awaits that answer inside `openDaemon`, so a dropped answer hangs the whole vessel short of its return.
test.each(["dropped", "bags"] as const)("B2 — a face change under op %s settles on the island's answer (dropped = CONTROL)", async (op) => {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  const listeners: Array<(msg: any) => void> = [];
  const host: DaemonVmHost = {
    spawnWorker: () => ({ post: () => {}, listen: (fn) => { listeners.push(fn); return () => {}; }, onError: () => () => {}, terminate: () => {} }),
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); ports.push(port1, port2); return { mainPort: port1 as IslandMsg_Manifest["syncPort"], syncPort: port2 as IslandMsg_Manifest["syncPort"] }; },
  };
  const core = openDaemonVmCore(host, { repo, daemonHandle, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null, workerScriptUrl: new URL("file:///unused"), eaSilenceMs: 2 ** 30 });
  core.workerEa.catch(() => {});
  try {
    let settled = false;
    const pending = (op === "bags" ? core.registerFaceBags("abc", ["lar:///ha.ka.ba/bags/late"]) : core.dropFace("abc")).then(() => { settled = true; });
    pending.catch(() => {}); // an unanswered ask ends at the dispose below; the assertion names it
    await Promise.resolve(); expect(settled).toBe(false);
    for (const listener of listeners) listener({ type: "daemon:face-settled", atomKey: "abc", op, ok: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled, `the ${op} answer settles the ask`).toBe(true);
    await pending;
  } finally { core.dispose(); ports.forEach((port) => port.close()); await repo.shutdown(); }
});

test("the persona plane stays outside the daemon composite", async () => {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const personaHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  const host: DaemonVmHost = {
    spawnWorker: () => ({ post: () => {}, listen: () => () => {}, onError: () => () => {}, terminate: () => {} }),
    newSyncChannel: () => { const { port1, port2 } = new MessageChannel(); ports.push(port1, port2); return { mainPort: port1 as IslandMsg_Manifest["syncPort"], syncPort: port2 as IslandMsg_Manifest["syncPort"] }; },
  };
  const bagId = "lar:///ha.ka.ba/bags/private-group";
  const core = openDaemonVmCore(host, { repo, daemonHandle, personaHandle, personaBagId: bagId, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null, workerScriptUrl: new URL("file:///unused"), eaSilenceMs: 2 ** 30 });
  core.workerEa.catch(() => {});
  try {
    expect(core.composite.storeForBag(bagId)).toBeNull();
    expect(core.personaPlane).toEqual({ bagId, handle: personaHandle });
    const opts = { composite: core.composite, tw5: { $tw: { wiki: {} } } } as unknown as MemeVerbOptions;
    const ctx = { invocation: { requestId: "test" }, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    await expect(makeMemeGetReactor(opts)({ bag: bagId, uri: "lar:///acts/example" }, ctx)).rejects.toThrow(/nothing reaches it/);
  } finally { core.dispose(); ports.forEach((port) => port.close()); await repo.shutdown(); }
});
