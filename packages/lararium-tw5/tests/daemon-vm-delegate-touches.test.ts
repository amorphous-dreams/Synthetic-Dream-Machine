/**
 * daemon-vm-delegate-touches — NO SILENT LOSS across the postMessage (sealed-store#/owed): a verb the island delegates to
 * main (rite-begin/land, nexus-posture, floor-accept, persona-new, seal-home-refold, realm-bag, sync-wiki, wiki-act) runs
 * inside its call's scope there, and the `daemon:verb-result` carries what main changed for it, so the island's outcome
 * names those documents and the seat owes them. A postMessage carries no async context; the request id does.
 * Canon: lar:///ha.ka.ba/kahua/memory/research/signer-refused
 */
import { createRequire } from "node:module";
import { afterEach, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { mkDaemonDelegateVerb, type IslandMsg_Manifest } from "@lararium/mesh/island-protocol";
import { type Repo as RepoType } from "@lararium/mesh/automerge";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { seatCallScope, watchCallTouches } from "@lararium/mesh/call-touches";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

function open() {
  const listeners = new Set<(raw: unknown) => void>();
  const crossed: unknown[] = [];
  const repo = new Repo({ sharePolicy: async () => true });
  watchCallTouches(repo as never);
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  const host: DaemonVmHost = {
    spawnWorker: () => ({
      post: (msg: unknown) => { crossed.push(msg); },
      listen: (h: (raw: unknown) => void): (() => void) => { listeners.add(h); return () => { listeners.delete(h); }; },
      onError: (): (() => void) => () => {},
      terminate: () => {},
    }),
    newSyncChannel: () => {
      const { port1, port2 } = new MessageChannel();
      ports.push(port1, port2);
      return { mainPort: port1 as unknown as IslandMsg_Manifest["syncPort"], syncPort: port2 as unknown as IslandMsg_Manifest["syncPort"] };
    },
  };
  const core = openDaemonVmCore(host, {
    repo, daemonHandle, controlHandle: repo.create<LarDoc>(emptyLarDoc()), recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
    workerScriptUrl: new URL("file:///unused-scripted-island"), eaSilenceMs: 2 ** 30,
  });
  core.workerEa.catch(() => {});
  cleanups.push(() => core.dispose());
  cleanups.push(() => { for (const p of ports) p.close(); });
  cleanups.push(() => repo.shutdown().then(() => {}));
  const registry = new VerbTable();
  // A PLACE ROW THAT WRITES ON MAIN (rite-begin, floor-accept, persona-new and kin run here): it changes a document after an await.
  const placeDoc = repo.create<{ rows?: number }>();
  registry.register("probe-write", async () => { await new Promise((r) => setTimeout(r, 1)); placeDoc.change((d) => { d.rows = (d.rows ?? 0) + 1; }); return { worn: "wrote" }; });
  registry.register("probe-read", async () => ({ worn: "read" }));
  core.mountMainVerbs(registry);
  const say = (msg: unknown): void => { for (const l of [...listeners]) l(msg); };
  const delegate = async (requestId: string, requestedBy: string, verb = "probe-write", args: Record<string, unknown> = {}): Promise<unknown> => {
    const from = crossed.length;
    say(mkDaemonDelegateVerb({ requestId, verb, args, requestedBy }));
    for (let i = 0; i < 50; i++) {
      const r = crossed.slice(from).find((m) => (m as { type?: string; requestId?: string }).type === "daemon:verb-result" && (m as { requestId?: string }).requestId === requestId);
      if (r) return r;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error(`no verb-result for ${requestId}`);
  };
  return { core, delegate, placeDoc };
}

test("RED: a delegated place-row one-shot carries main's own changes back on its verb-result; a read carries an empty report", async () => {
  const store = new AsyncLocalStorage<string>();
  seatCallScope({ run: (id, fn) => store.run(id, fn), current: () => store.getStore(), exit: (fn) => store.exit(fn) });
  try {
    const { delegate, placeDoc } = open();
    const wrote = await delegate("w-1", "0xabc", "probe-write") as { result?: unknown; touched?: Record<string, string[]> };
    expect(Object.keys(wrote.touched ?? {})).toEqual([placeDoc.documentId]);
    const read = await delegate("r-1", "0xabc", "probe-read") as { touched?: Record<string, string[]> };
    expect(read.touched).toEqual({});
  } finally { seatCallScope(null); }
});
