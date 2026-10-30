/**
 * Main books the face each session ask wears. The UDS seat places a session's verb with its verified presenter and the
 * face's ordinal; when the island delegates that verb back, main hands the handler that booking (`VerbContext.worn`),
 * read from what main itself placed and never from the island's delegate. A delegate main never placed for a session
 * carries no worn face, whatever presenter it names.
 */
import { createRequire } from "node:module";
import { afterEach, expect, test } from "vitest";
import { emptyLarDoc, mkDaemonDelegateVerb, type IslandMsg_Manifest, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

function open() {
  const listeners = new Set<(raw: unknown) => void>();
  const crossed: unknown[] = [];
  const repo = new Repo({ sharePolicy: async () => true });
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
    repo, daemonHandle, recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
    workerScriptUrl: new URL("file:///unused-scripted-island"), eaSilenceMs: 2 ** 30,
  });
  core.workerEa.catch(() => {});
  cleanups.push(() => core.dispose());
  cleanups.push(() => { for (const p of ports) p.close(); });
  cleanups.push(() => repo.shutdown().then(() => {}));
  const registry = new VerbTable();
  registry.register("probe-worn", async (_args, context) => ({ worn: (context as { worn?: unknown }).worn ?? null }));
  core.mountMainVerbs(registry);
  const say = (msg: unknown): void => { for (const l of [...listeners]) l(msg); };
  const delegate = async (requestId: string, requestedBy: string): Promise<unknown> => {
    say(mkDaemonDelegateVerb({ requestId, verb: "probe-worn", args: {}, requestedBy }));
    for (let i = 0; i < 50; i++) {
      const r = crossed.find((m) => (m as { type?: string; requestId?: string }).type === "daemon:verb-result" && (m as { requestId?: string }).requestId === requestId);
      if (r) { const m = r as { result?: { worn?: unknown }; error?: string }; return m.result ? m.result.worn : m.error; }
      await Promise.resolve();
    }
    throw new Error(`no verb-result for ${requestId}`);
  };
  return { core, delegate };
}

const ATOM_1 = `0x${"b1".repeat(32)}`;
const ATOM_0 = `0x${"a0".repeat(32)}`;

test("RED: a session's delegated verb reaches main's handler wearing the face main booked; CONTROL: an unbooked delegate wears none", async () => {
  const { core, delegate } = open();
  core.placeVerb({ origin: "channel", verb: "probe-worn", args: {}, requestedBy: ATOM_1, face: "subject-1", requestId: "s-1", ordinal: 1 } as never);
  expect(await delegate("s-1", ATOM_1)).toEqual({ ordinal: 1, presenter: ATOM_1 });
  // The island's delegate names a presenter; main reads its own booking, never that name.
  core.placeVerb({ origin: "channel", verb: "probe-worn", args: {}, requestedBy: ATOM_1, face: "subject-1", requestId: "s-2", ordinal: 1 } as never);
  expect(await delegate("s-2", ATOM_0)).toEqual({ ordinal: 1, presenter: ATOM_1 });
  // CONTROL: a delegate main never placed, and a channel ask that rode no session, wear no face.
  expect(await delegate("never-placed", ATOM_1)).toBeNull();
  core.placeVerb({ origin: "channel", verb: "probe-worn", args: {}, requestedBy: ATOM_1, requestId: "m-1" });
  expect(await delegate("m-1", ATOM_1)).toBeNull();
  core.placeVerb({ origin: "surface", verb: "probe-worn", args: {}, requestedBy: ATOM_1, face: "subject-1", requestId: "p-1", ordinal: 1 } as never);
  expect(await delegate("p-1", ATOM_1)).toBeNull();
});
