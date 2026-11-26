/**
 * The daemon island mounts the floor the place accepted (`floor-accept` `floorToMount`), as every wiki island does. A walked
 * hearth read a promoted record `not-found` from every face outside the Kahu cabal after `floor accept`: the daemon island's
 * manifest named no floor, so the island read its genesis seed's floor and the `--bag` read door answered the prior snapshot.
 */
import { createRequire } from "node:module";
import { afterEach, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { type IslandMsg_Manifest } from "@lararium/mesh/island-protocol";
import { type Repo as RepoType } from "@lararium/mesh/automerge";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

const ACCEPTED = "b2070fa57af5231b657eda593e93eea36f967f1b084624053dafe9ccb6258695";

async function manifestOf(over: Record<string, unknown>): Promise<IslandMsg_Manifest> {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  let posted: (m: IslandMsg_Manifest) => void = () => {};
  const manifest = new Promise<IslandMsg_Manifest>((resolve) => { posted = resolve; });
  const host: DaemonVmHost = {
    spawnWorker: () => ({
      post: (msg: unknown) => { if ((msg as { type?: string }).type === "manifest") posted(msg as IslandMsg_Manifest); },
      listen: (): (() => void) => () => {},
      onError: (): (() => void) => () => {},
      onExit: (): (() => void) => () => {},
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
    workerScriptUrl: new URL("file:///unused-scripted-island"), eaSilenceMs: 2 ** 30, askLivenessMs: 50, ...over,
  } as never);
  core.workerEa.catch(() => {});
  cleanups.push(() => core.dispose());
  cleanups.push(() => { for (const p of ports) p.close(); });
  cleanups.push(() => repo.shutdown().then(() => {}));
  return manifest;
}

test("RED: the daemon island's manifest names the floor the vessel pinned, so its read doors answer the accepted release; CONTROL: a vessel that stands on genesis names none, and the island reads its seed's own floor", async () => {
  expect((await manifestOf({ floorCid: ACCEPTED })).floorCid).toBe(ACCEPTED);
  expect((await manifestOf({})).floorCid).toBeUndefined();
  expect((await manifestOf({ floorCid: null })).floorCid).toBeUndefined();
}, 5_000);
