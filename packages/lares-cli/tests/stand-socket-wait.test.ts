/**
 * stand-socket-wait — `vessel stand` waits for the verb socket on the node's own events.
 *
 * The socket answers (connect), the node attests `fatal:` or `uds error:` (its log), or the child exits: each
 * ends the wait at once. A node that keeps writing its log is alive and keeps the wait open past any fixed
 * deadline; only silence (no log progress, no exit, no bind) is the named LIVENESS bound.
 */
import { describe, test, expect } from "vitest";
import { awaitVerbSocket } from "../src/stand-socket-wait.js";

function rig(over: { alive?: () => boolean; log?: () => string; exited?: () => boolean } = {}) {
  let t = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => t,
    sleep: async (ms: number) => { sleeps.push(ms); t += ms; },
    alive: async () => (over.alive ?? (() => false))(),
    readAttestation: over.log ?? (() => ""),
    childExited: over.exited ?? (() => false),
  };
}

describe("awaitVerbSocket", () => {
  test("RED: the child exits -> the wait ends at once as `exited`, with no deadline spent", async () => {
    const r = rig({ exited: () => true });
    expect(await awaitVerbSocket({ ...r, silenceMs: 120_000 })).toEqual({ outcome: "exited", refusal: null });
    expect(r.sleeps.length).toBe(0);
  });

  test("RED: a node that keeps writing its log holds the wait open past the old 120 s deadline until the socket answers", async () => {
    let polls = 0;
    const r = rig();
    const out = await awaitVerbSocket({
      ...r, silenceMs: 120_000,
      alive: async () => ++polls > 600,            // 600 polls x 500 ms = 300 s of slow bind
      readAttestation: () => "x".repeat(polls),    // the log grows every poll
    });
    expect(out.outcome).toBe("up");
    expect(r.now()).toBeGreaterThan(120_000);
  });

  test("a late fatal ends the wait as `fault`; a uds error names its refusal", async () => {
    expect((await awaitVerbSocket({ ...rig({ log: () => "fatal: boom" }), silenceMs: 1000 })).outcome).toBe("fault");
    expect(await awaitVerbSocket({ ...rig({ log: () => "uds error: EINVAL path" }), silenceMs: 1000 })).toEqual({ outcome: "refused", refusal: "EINVAL path" });
  });

  test("CONTROL: a node silent for the whole LIVENESS span ends as `silent`", async () => {
    const out = await awaitVerbSocket({ ...rig(), silenceMs: 5_000 });
    expect(out.outcome).toBe("silent");
  });
});
