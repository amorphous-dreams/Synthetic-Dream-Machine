/**
 * host-task — `yieldToHost()` resolves on a later HOST TASK, so work the host already holds takes its
 * slice before the yielding stretch continues; a chain of promises never does that. The seat follows
 * what the host offers: `setImmediate`, then `scheduler.yield`, then `MessageChannel`, then a zero timer.
 *
 * CONTROL: the same stretch awaiting a resolved promise in place of the yield lets the host task in
 * only after the whole stretch ran.
 */

import { describe, expect, test } from "vitest";

import { hostTaskSeatOf, selectHostTaskYield, yieldToHost, type HostTaskScope } from "../src/index.js";

/** A stretch of `n` steps, yielding through `pause` after each; records what ran, in order. */
async function stretch(n: number, pause: () => Promise<void>, log: string[]): Promise<void> {
  for (let i = 0; i < n; i++) { log.push(`step ${i}`); await pause(); }
}

describe("host-task — the seat follows the host", () => {
  const immediate = (fn: () => void): unknown => setImmediate(fn);
  const scheduler = { yield: (): Promise<void> => new Promise<void>((r) => { setImmediate(r); }) };

  test("setImmediate stands first, then scheduler.yield, then MessageChannel, then a zero timer", () => {
    expect(hostTaskSeatOf({ setImmediate: immediate, scheduler, MessageChannel, setTimeout })).toBe("setImmediate");
    expect(hostTaskSeatOf({ scheduler, MessageChannel, setTimeout })).toBe("scheduler.yield");
    expect(hostTaskSeatOf({ MessageChannel, setTimeout } as HostTaskScope)).toBe("MessageChannel");
    expect(hostTaskSeatOf({ setTimeout })).toBe("setTimeout");
  });

  test("a host with no task queue at all refuses by name", () => {
    expect(() => selectHostTaskYield({})).toThrow(/no task queue/);
  });

  // Node drains a port's messages in one poll-phase loop, so its own MessageChannel shows nothing about
  // task order; a browser worker delivers each message as one task. This channel models that delivery,
  // and the case reads this module's wiring over it: one post per yield, one waiter per message.
  class TaskChannel {
    port1: { onmessage: ((ev: unknown) => void) | null } = { onmessage: null };
    port2 = { postMessage: (message: unknown): void => { setImmediate(() => this.port1.onmessage?.({ data: message })); } };
  }

  // The host task is queued on the same queue the seat rides, BEFORE the stretch starts, so its place
  // in the order is the host's own and no duration decides the reading.
  const viaImmediate = (fn: () => void): void => { setImmediate(fn); };
  const viaTimer     = (fn: () => void): void => { setTimeout(fn, 0); };
  for (const [seat, scope, queue] of [
    ["setImmediate", { setImmediate: immediate }, viaImmediate],
    ["scheduler.yield", { scheduler }, viaImmediate],
    ["MessageChannel", { MessageChannel: TaskChannel }, viaImmediate],
    ["setTimeout", { setTimeout }, viaTimer],
  ] as Array<[string, HostTaskScope, (fn: () => void) => void]>) {
    test(`${seat}: a host task queued before the stretch runs before the stretch ends`, async () => {
      const pause = selectHostTaskYield(scope);
      const log: string[] = [];
      const hostTask = new Promise<void>((resolve) => { queue(() => { log.push("host task"); resolve(); }); });
      await stretch(40, pause, log);
      await hostTask;
      expect(log.indexOf("host task")).toBeGreaterThan(-1);
      expect(log.indexOf("host task")).toBeLessThan(log.indexOf("step 39"));
    });
  }

  test("MessageChannel: every waiter resolves, in the order it yielded", async () => {
    const pause = selectHostTaskYield({ MessageChannel } as HostTaskScope);
    const order: number[] = [];
    await Promise.all([0, 1, 2, 3].map((i) => pause().then(() => { order.push(i); })));
    expect(order).toEqual([0, 1, 2, 3]);
  });

  test("yieldToHost lets this host's queued task in", async () => {
    const log: string[] = [];
    const hostTask = new Promise<void>((resolve) => { setImmediate(() => { log.push("host task"); resolve(); }); });
    await stretch(3, yieldToHost, log);
    await hostTask;
    expect(log.indexOf("host task")).toBeLessThan(log.indexOf("step 2"));
  });

  test("CONTROL: a stretch that awaits a resolved promise never lets the host task in", async () => {
    const log: string[] = [];
    const hostTask = new Promise<void>((resolve) => { setImmediate(() => { log.push("host task"); resolve(); }); });
    await stretch(40, () => Promise.resolve(), log);
    await hostTask;
    expect(log.indexOf("host task")).toBe(log.length - 1);
  });
});
