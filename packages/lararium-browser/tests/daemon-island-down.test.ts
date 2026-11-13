/**
 * The browser takes its daemon island down GRACEFULLY (L29 mirror, the third merge read's Q4): the island runs its teardown
 * and its settlement round (asks-done -> receipt:close), so an owed write rests or is named unsaved, never dropped silent.
 * The hard kill (`dispose`) stays only as the liveness for a worker wedged alive, and a tab attached to the shared holder
 * detaches without tearing down the island its other tabs share (the holder's own last-session close runs that teardown).
 */
// `?raw` because this suite runs in a browser: the pin reads the boot's own source, never through `node:fs`.
import bootSrc from "../src/open-browser-vessel.ts?raw";
import { describe, expect, test } from "vitest";
import { daemonIslandDown } from "../src/daemon-island-down.js";

function fakeDaemon(shutdown: () => Promise<{ acked: boolean }>) {
  const order: string[] = [];
  return {
    order,
    vm: {
      shutdown: async () => { order.push("shutdown"); const answer = await shutdown(); order.push(`acked:${answer.acked}`); return answer; },
      dispose: () => { order.push("dispose"); },
    },
  };
}

describe("the browser's daemon island goes down through its own teardown", () => {
  test("PIN: the browser vessel's daemon step runs the graceful door, never the bare hard kill", () => {
    const source = bootSrc as string;
    expect(source).toMatch(/what: "daemon worker", down: \(\) => daemonIslandDown\(daemon, /);
    expect(source).not.toMatch(/what: "daemon worker", down: \(\) => daemon\.dispose\(\)/);
  });

  test("an own island shuts down gracefully (its settlement round runs), then the facade disposes — CONTROL: a clean close acks", async () => {
    const d = fakeDaemon(async () => ({ acked: true }));
    await daemonIslandDown(d.vm, { attached: false });
    expect(d.order).toEqual(["shutdown", "acked:true", "dispose"]);
  });

  test("an island whose teardown names a fault still comes down: the facade disposes after the unacked shutdown", async () => {
    const d = fakeDaemon(async () => ({ acked: false }));
    await daemonIslandDown(d.vm, { attached: false });
    expect(d.order).toEqual(["shutdown", "acked:false", "dispose"]);
  });

  test("a shutdown that refuses (a restart in flight) still disposes", async () => {
    const d = fakeDaemon(async () => { throw new Error("daemon-restarting"); });
    await daemonIslandDown(d.vm, { attached: false });
    expect(d.order).toEqual(["shutdown", "dispose"]);
  });

  test("a tab attached to the shared holder detaches (dispose) and never tears down the shared island", async () => {
    const d = fakeDaemon(async () => ({ acked: true }));
    await daemonIslandDown(d.vm, { attached: true });
    expect(d.order).toEqual(["dispose"]);
  });
});
