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
    repo, daemonHandle, stateHandle: repo.create<LarDoc>(emptyLarDoc()), recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
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

/**
 * THE ONE-SHOT LINE'S HAND RIDES THE DELEGATE TOO. `lares shore take-records` reaches the vessel on a one-shot line (no session,
 * no face, no ordinal): the UDS door reads the peer and books `cli`, the daemon island holds no `wiki-act` and delegates it back
 * to main, and main runs it into the active wiki's island, whose shore reads `ctx.asker`. Main reads that asker from its own
 * booking of the ask it placed, as it does a session's; a one-shot ask that booked none lent the island no hand, so a person at a
 * real terminal read `hand-unattested`.
 */
test("RED: a one-shot line's wiki-act delegate carries the hand the door read; CONTROL: a seat's carries `seat`, an unplaced one none, and no face rides", async () => {
  const { core, delegate } = (() => {
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
      repo, daemonHandle, stateHandle: repo.create<LarDoc>(emptyLarDoc()), recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
      workerScriptUrl: new URL("file:///unused-scripted-island"), eaSilenceMs: 2 ** 30,
    });
    core.workerEa.catch(() => {});
    cleanups.push(() => core.dispose());
    cleanups.push(() => { for (const p of ports) p.close(); });
    cleanups.push(() => repo.shutdown().then(() => {}));
    const registry = new VerbTable();
    registry.register("wiki-act", async (_args, ctx) => ({ asker: (ctx as { asker?: unknown }).asker ?? null, worn: (ctx as { worn?: unknown }).worn ?? null }));
    core.mountMainVerbs(registry);
    const delegate = async (requestId: string, args: Record<string, unknown>): Promise<{ result?: Record<string, unknown>; error?: string }> => {
      const from = crossed.length;
      for (const l of [...listeners]) l(mkDaemonDelegateVerb({ requestId, verb: "wiki-act", args, requestedBy: ATOM }));
      for (let i = 0; i < 200; i++) {
        const r = crossed.slice(from).find((m) => (m as { type?: string; requestId?: string }).type === "daemon:verb-result" && (m as { requestId?: string }).requestId === requestId);
        if (r) return r as { result?: Record<string, unknown>; error?: string };
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error(`no verb-result for ${requestId}`);
    };
    return { core, delegate };
  })();
  const take = { verb: "shore", args: { op: "take-records", uri: "$:/StoryList", key: "7512190c6349272585509689" } };
  // The one-shot line: origin channel, a request id, the asker the door read; no face, no ordinal.
  core.placeVerb({ origin: "channel", verb: "wiki-act", args: take, requestedBy: ATOM, requestId: "one-shot-cli", asker: "cli" } as never);
  expect((await delegate("one-shot-cli", take)).result).toEqual({ asker: "cli", worn: null });
  // CONTROL: the booking serves ONE delegate of the act it booked.
  expect((await delegate("one-shot-cli", take)).result).toEqual({ asker: null, worn: null });
  core.placeVerb({ origin: "channel", verb: "wiki-act", args: take, requestedBy: ATOM, requestId: "one-shot-seat", asker: "seat" } as never);
  expect((await delegate("one-shot-seat", take)).result).toEqual({ asker: "seat", worn: null });
  expect((await delegate("never-placed", take)).result).toEqual({ asker: null, worn: null });
  // CONTROL: a delegate naming other args under a booked id lends no hand.
  core.placeVerb({ origin: "channel", verb: "wiki-act", args: take, requestedBy: ATOM, requestId: "one-shot-other", asker: "cli" } as never);
  expect((await delegate("one-shot-other", { ...take, args: { ...take.args, key: "other" } })).result).toEqual({ asker: null, worn: null });
});
