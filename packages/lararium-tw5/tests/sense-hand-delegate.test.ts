/**
 * sense-hand-delegate — the sense hand verbs answer a terminal's session through the vessel's real route (hitl-reads-a-hand).
 *
 * The island delegates `promote`, `retire`, `un-retire` and `purge` back to main (`daemon:delegate-verb`), where the reactors
 * stand. Main reads the asker from its OWN booking of the ask it placed (the hand the UDS door read), never from the island's
 * delegate: a terminal's (`cli`) delegate lands, a seat's refuses `sense-needs-hand`, and a delegate main never placed, or one
 * for another act under the booked id, reads no hand and refuses.
 */
import { createRequire } from "node:module";
import { afterEach, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { mkDaemonDelegateVerb, type IslandMsg_Manifest } from "@lararium/mesh/island-protocol";
import { type Repo as RepoType } from "@lararium/mesh/automerge";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";
import { captureVerbCap, type DaemonVerbProvider, type VerbContribution } from "../src/verb-caps.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

const ATOM = `0x${"b1".repeat(32)}`;

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
    repo, daemonHandle, controlHandle: repo.create<LarDoc>(emptyLarDoc()), recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
    workerScriptUrl: new URL("file:///unused-scripted-island"), eaSilenceMs: 2 ** 30,
  });
  core.workerEa.catch(() => {});
  cleanups.push(() => core.dispose());
  cleanups.push(() => { for (const p of ports) p.close(); });
  cleanups.push(() => repo.shutdown().then(() => {}));
  const calls: Array<{ verb: string; input: Record<string, unknown> }> = [];
  const answer = (verb: string) => async (input: Record<string, unknown> = {}) => { calls.push({ verb, input }); return { landed: verb }; };
  const provider = {
    senseRoster: answer("roster"), senseInspect: answer("inspect"), senseBuild: answer("build"), senseReconcile: answer("reconcile"),
    sensePromote: answer("promote"), senseRetire: answer("retire"), senseUnRetire: answer("un-retire"), sensePurge: answer("purge"),
  } as unknown as DaemonVerbProvider;
  const registry = new VerbTable();
  (captureVerbCap().build(<T>() => provider as unknown as T) as VerbContribution)(registry);
  core.mountMainVerbs(registry);
  const say = (msg: unknown): void => { for (const l of [...listeners]) l(msg); };
  const delegate = async (requestId: string, verb: string, args: Record<string, unknown>): Promise<{ result?: unknown; error?: string }> => {
    const from = crossed.length;
    say(mkDaemonDelegateVerb({ requestId, verb, args, requestedBy: ATOM }));
    for (let i = 0; i < 200; i++) {
      const r = crossed.slice(from).find((m) => (m as { type?: string; requestId?: string }).type === "daemon:verb-result" && (m as { requestId?: string }).requestId === requestId);
      if (r) return r as { result?: unknown; error?: string };
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(`no verb-result for ${requestId}`);
  };
  const place = (requestId: string, verb: string, args: Record<string, unknown>, asker: string) =>
    core.placeVerb({ origin: "channel", verb, args, requestedBy: ATOM, face: "subject-1", requestId, ordinal: 1, asker } as never);
  return { delegate, place, calls };
}

const VERBS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["promote", { name: "alpha" }], ["retire", { name: "alpha", grounds: "superseded" }], ["un-retire", { name: "alpha" }], ["purge", { name: "alpha" }],
];

for (const [verb, args] of VERBS) {
  test(`RED: a terminal's session ${verb} lands through the delegate route; a seat's refuses; CONTROL: an unplaced delegate reads no hand`, async () => {
    const { delegate, place, calls } = open();
    place(`cli-${verb}`, verb, args, "cli");
    const landed = await delegate(`cli-${verb}`, verb, args);
    expect(landed.error, `${verb} from a terminal`).toBeUndefined();
    expect(calls.at(-1)).toMatchObject({ verb, input: { hand: "hand" } });

    place(`seat-${verb}`, verb, args, "seat");
    expect((await delegate(`seat-${verb}`, verb, args)).error).toMatch(/sense-needs-hand/);
    expect((await delegate(`never-${verb}`, verb, args)).error).toMatch(/sense-needs-hand/);
    // A delegate for other args under a terminal's booked id lends no hand.
    place(`other-${verb}`, verb, args, "cli");
    expect((await delegate(`other-${verb}`, verb, { ...args, name: "beta" })).error).toMatch(/sense-needs-hand/);
    expect(calls).toHaveLength(1);
  });
}
