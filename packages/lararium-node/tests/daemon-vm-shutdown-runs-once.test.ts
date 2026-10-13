/**
 * daemon-vm-shutdown-runs-once — the daemon island's teardown handshake runs ONCE, and every later
 * call reads the first one's answer.
 *
 * A composition's teardown reaches the daemon VM's `shutdown` by more than one road (its own dispose,
 * then the list of what it stood). The first call sends `teardown`, the island flushes and answers
 * `teardown:ack`, and the vessel terminates the worker. A second call that sent `teardown` again asked a
 * terminated worker, waited out its whole bound for an ack no island stood to give, and logged a failed
 * shutdown over one that had completed.
 *
 * The order here rides a HANDSHAKE between the two parties, never a clock: the scripted island answers
 * when the test tells it to, and each assertion reads what crossed the boundary.
 */

import { describe, test, expect, afterEach, vi } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, mkTeardownAck, type LarDoc, type IslandMsg_Manifest } from "@lararium/mesh";
import { openDaemonVmCore, type DaemonVmHost } from "@lararium/tw5";

/** A scripted island: it records what crosses its boundary, in order, and answers when told. */
function scriptedIsland() {
  const listeners = new Set<(raw: unknown) => void>();
  const crossed: string[] = [];
  return {
    handle: {
      post:      (msg: unknown) => { crossed.push(`vessel→island ${(msg as { type?: string })?.type ?? "unknown"}`); },
      listen:    (h: (raw: unknown) => void): (() => void) => { listeners.add(h); return () => { listeners.delete(h); }; },
      onError:   (): (() => void) => () => {},
      terminate: () => { crossed.push("vessel terminates the worker"); },
    },
    /** The island answers its teardown. */
    ack: (): void => { crossed.push("island→vessel teardown:ack"); for (const l of [...listeners]) l(mkTeardownAck()); },
    crossed,
    teardownsSent: (): number => crossed.filter((c) => c === "vessel→island teardown").length,
    terminations:  (): number => crossed.filter((c) => c === "vessel terminates the worker").length,
  };
}

describe("the daemon VM's shutdown handshake runs once", () => {
  const cleanups: Array<() => void | Promise<void>> = [];
  afterEach(async () => {
    vi.clearAllTimers();
    vi.useRealTimers();
    for (const c of cleanups.splice(0)) await c();
  });

  function open() {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const island = scriptedIsland();
    // The global channel: this vector stands no worker of any kind, only a scripted handle.
    const ports: MessagePort[] = [];
    const host: DaemonVmHost = {
      spawnWorker: () => island.handle,
      newSyncChannel: () => {
        const { port1, port2 } = new MessageChannel();
        ports.push(port1, port2);
        return { mainPort: port1 as unknown as IslandMsg_Manifest["syncPort"], syncPort: port2 as unknown as IslandMsg_Manifest["syncPort"] };
      },
    };
    const core = openDaemonVmCore(host, {
      repo, daemonHandle,
      recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
      workerScriptUrl: new URL("file:///unused-scripted-island"),
      // The mount never settles here (no island answers `ea`); its watchdog stays out of the vectors' way.
      eaSilenceMs: 2 ** 30,
    });
    core.workerEa.catch(() => {});
    cleanups.push(() => core.dispose());
    cleanups.push(() => { for (const p of ports) p.close(); });
    cleanups.push(() => repo.shutdown().then(() => {}));
    return { core, island };
  }

  test("CONTROL: one shutdown sends one teardown, hears the ack, then terminates, in that order", async () => {
    const { core, island } = open();
    const down = core.shutdown();
    expect(island.teardownsSent()).toBe(1);
    expect(island.terminations()).toBe(0);   // the worker stands until its ack arrives
    island.ack();
    expect(await down).toEqual({ acked: true });
    expect(island.crossed.filter((c) => /teardown|terminates/.test(c))).toEqual([
      "vessel→island teardown", "island→vessel teardown:ack", "vessel terminates the worker",
    ]);
  });

  test("a second shutdown after the first completed sends NO second teardown and reads the first answer", async () => {
    const { core, island } = open();
    const first = core.shutdown();
    island.ack();
    expect(await first).toEqual({ acked: true });
    // The second road reaches the same VM: its worker stands terminated and can answer nothing.
    const second = core.shutdown();
    expect(island.teardownsSent()).toBe(1);
    expect(await second).toEqual({ acked: true });
    expect(island.teardownsSent()).toBe(1);
    expect(island.terminations()).toBe(1);
  });

  test("two shutdowns in flight share one handshake: one teardown, one ack, one termination", async () => {
    const { core, island } = open();
    const first = core.shutdown();
    const second = core.shutdown();
    expect(island.teardownsSent()).toBe(1);
    island.ack();
    expect(await Promise.all([first, second])).toEqual([{ acked: true }, { acked: true }]);
    expect(island.terminations()).toBe(1);
  });

  test("a shutdown after a hard dispose asks nothing of the terminated worker and answers unacked", async () => {
    const { core, island } = open();
    core.dispose();
    const down = core.shutdown();
    expect(island.teardownsSent()).toBe(0);
    expect(await down).toEqual({ acked: false });
  });

  test("a hard dispose while a shutdown stands waiting ends that wait at once, unacked, and leaves no bound armed", async () => {
    vi.useFakeTimers();
    const { core, island } = open();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const down = core.shutdown(60_000);
    expect(island.teardownsSent()).toBe(1);
    core.dispose();
    // No clock moved: the wait ended on the dispose itself.
    expect(await down).toEqual({ acked: false });
    expect(island.terminations()).toBeGreaterThanOrEqual(1);
    // A deliberate hard stop says nothing of a failed ack, and the handshake's bound stands disarmed.
    expect(warn.mock.calls.some((c) => String(c[0]).includes("graceful shutdown ack failed"))).toBe(false);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("graceful shutdown ack failed"))).toBe(false);
    warn.mockRestore();
  });

  test("the bound stays a bound: an island that never acks gets terminated once its budget runs out", async () => {
    vi.useFakeTimers();
    const { core, island } = open();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const down = core.shutdown(50);
    expect(island.teardownsSent()).toBe(1);
    expect(island.terminations()).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await down).toEqual({ acked: false });
    expect(island.terminations()).toBe(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("graceful shutdown ack failed"))).toBe(true);
    // A later call still reads that one answer, and sends nothing.
    expect(await core.shutdown()).toEqual({ acked: false });
    expect(island.teardownsSent()).toBe(1);
    warn.mockRestore();
  });
});
