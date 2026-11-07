/**
 * stand-socket-wait — `vessel stand` waits for the verb socket on the node's own events.
 *
 * The socket answers (connect), the node attests `fatal:` or `uds error:` (its log), or the child exits: each
 * ends the wait at once. A node that keeps writing its log is alive and keeps the wait open past any fixed
 * deadline; only silence (no log progress, no exit, no bind) is the named LIVENESS bound.
 */
import { describe, test, expect } from "vitest";
import { awaitBootPhase, awaitVerbSocket } from "../src/stand-socket-wait.js";

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

describe("awaitBootPhase", () => {
  const boot = (over: { log?: () => string; exited?: () => boolean } = {}) => {
    const r = rig(over);
    return { ...r, sleeps: r.sleeps, wait: (silenceMs = 30_000) => awaitBootPhase({ now: r.now, sleep: r.sleep, readAttestation: r.readAttestation, childExited: r.childExited, silenceMs }) };
  };
  test("RED: a child that exits early resolves at once as `exited` (the 180 s cap is gone)", async () => {
    const b = boot({ exited: () => true });
    expect(await b.wait()).toBe("exited");
    expect(b.sleeps.length).toBe(0);
  });
  test("CONTROL: a ready line resolves `ready`; a fatal line resolves `fault`", async () => {
    expect(await boot({ log: () => "boot\nvessel-ready" }).wait()).toBe("ready");
    expect(await boot({ log: () => "fatal: nope" }).wait()).toBe("fault");
  });
  test("RED: a boot that keeps writing holds the wait past the old 180 s cap until ready", async () => {
    let polls = 0;
    const r = rig();
    const out = await awaitBootPhase({ now: r.now, sleep: r.sleep, childExited: r.childExited,
      readAttestation: () => (++polls > 1500 ? "vessel-ready" : "x".repeat(polls)), silenceMs: 30_000 });
    expect(out).toBe("ready");
    expect(r.now()).toBeGreaterThan(180_000);
  });
  test("CONTROL: a silent, living boot ends as `silent` after the LIVENESS span", async () => {
    expect(await boot().wait(5_000)).toBe("silent");
  });
});
