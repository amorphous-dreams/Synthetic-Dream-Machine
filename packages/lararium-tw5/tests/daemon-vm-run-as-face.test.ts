/**
 * K20: main runs a face row as the session's face only once the keyholder island clears it. `runAsFace` asks the island
 * (`daemon:gate-verb-request`) and runs main's handler wearing the face only on a clearance; a refusal never runs the
 * row, and a gate the island never answers ends by name within its bound, never a hang the session waits out.
 */
import { createRequire } from "node:module";
import { afterEach, expect, test } from "vitest";
import { emptyLarDoc, mkDaemonGateVerbResult, type IslandMsg_Manifest, type LarDoc, type Repo as RepoType } from "@lararium/mesh";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

const ATOM_1 = `0x${"b1".repeat(32)}`;
const WORN = { ordinal: 1, presenter: ATOM_1 };

function open(answer: (msg: { requestId: string; verb: string; requestedBy: string }) => string | undefined | "silent") {
  const listeners = new Set<(raw: unknown) => void>();
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const ports: MessagePort[] = [];
  const say = (msg: unknown): void => { for (const l of [...listeners]) l(msg); };
  const gates: Array<{ verb: string; requestedBy: string }> = [];
  const host: DaemonVmHost = {
    spawnWorker: () => ({
      post: (msg: unknown) => {
        const m = msg as { type?: string; requestId: string; verb: string; requestedBy: string };
        if (m.type !== "daemon:gate-verb-request") return;
        gates.push({ verb: m.verb, requestedBy: m.requestedBy });
        const verdict = answer(m);
        if (verdict === "silent") return;
        queueMicrotask(() => say(mkDaemonGateVerbResult({ requestId: m.requestId, ...(verdict ? { error: verdict } : {}) })));
      },
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
    workerScriptUrl: new URL("file:///unused-scripted-island"), eaSilenceMs: 2 ** 30, gateBoundMs: 50,
  } as never);
  core.workerEa.catch(() => {});
  cleanups.push(() => core.dispose());
  cleanups.push(() => { for (const p of ports) p.close(); });
  cleanups.push(() => repo.shutdown().then(() => {}));
  const ran: unknown[] = [];
  const registry = new VerbTable();
  registry.register("face-row", async (args, context) => { ran.push({ args, worn: context.worn ?? null, local: context.local }); return { ok: true }; });
  core.mountMainVerbs(registry);
  return { core, ran, gates };
}

test("RED (Sonnet's cold read, MED-1): a gate the island never answers ends runAsFace by name within its bound, and the row never runs", async () => {
  const { core, ran } = open(() => "silent");
  await expect(core.runAsFace({ verb: "face-row", args: {}, worn: WORN })).rejects.toThrow(/did not answer gate-/);
  expect(ran).toEqual([]);
}, 3_000);

test("a refused gate never runs the row; CONTROL: a cleared gate runs it wearing the face, local, cleared for that presenter", async () => {
  const refused = open(() => "capability denied for routed verb \"face-row\"");
  await expect(refused.core.runAsFace({ verb: "face-row", args: { x: 1 }, worn: WORN })).rejects.toThrow(/capability denied/);
  expect(refused.ran).toEqual([]);
  const cleared = open(() => undefined);
  expect(await cleared.core.runAsFace({ verb: "face-row", args: { x: 1 }, worn: WORN })).toEqual({ ok: true });
  expect(cleared.ran).toEqual([{ args: { x: 1 }, worn: WORN, local: true }]);
  expect(cleared.gates).toEqual([{ verb: "face-row", requestedBy: ATOM_1 }]);
});
