/**
 * slot-wait — an island's wait for a slot document reads a rejection as a verdict only when a peer gave it.
 *
 *   S1  the Repo settles "unavailable" while NO peer stands connected (the vessel's main thread has not yet
 *       answered the port); the peer then connects and the document arrives: the wait answers the HANDLE.
 *                                                 control: with a peer connected, the same rejection reads `verdict`
 *   S2  no peer ever connects and the port stays silent: the wait ends `never-arrived` once the silence budget
 *       passes, having asked more than once.      control: a find that resolves at once answers `ready` in one ask
 *   S3  inbound traffic keeps the silence clock young, and the hard cap still ends the wait `never-arrived`.
 *   S4  a rejection that states no absence (an address the Repo cannot read) ends the wait `refused` at the first
 *       ask, with no peer connected.              control: S2's absence, same world, waits out its budget
 * The premise (a Repo with no peer rejects a find at once) stands pinned on the real library in the node package:
 * `packages/lararium-node/tests/repo-without-a-peer-rejects.test.ts`.
 */
import { describe, expect, test } from "vitest";
import { waitForSlotDocument, type SlotWaitDeps } from "../src/slot-wait.js";

/** A hand-stepped clock: `sleep` advances it, so a vector reads no wall time. */
function world(over: Partial<SlotWaitDeps<string>> & { find: () => Promise<string> }) {
  let t = 0;
  let heard = 0;
  let asks = 0;
  const deps: SlotWaitDeps<string> = {
    peerCount: () => 0,
    absence: (rejection) => rejection instanceof Error && rejection.message === "unavailable",
    now: () => t,
    lastHeard: () => heard,
    sleep: async (ms) => { t += ms; await Promise.resolve(); },
    defer: async () => { await Promise.resolve(); },
    budgets: { silenceMs: 8_000, hardCapMs: 60_000, pollMs: 250 },
    ...over,
    find: () => { asks += 1; return over.find(); },
  };
  return { deps, asks: () => asks, at: () => t, hear: () => { heard = t; } };
}

describe("an island's wait for a slot document", () => {
  test("S1 — a rejection with no peer connected asks again; the handle answers once the peer stands", async () => {
    let peers = 0;
    let stalled = 3;   // the main thread answers the port after three polls
    const w = world({
      peerCount: () => peers,
      find: async () => {
        if (peers === 0) { if (--stalled === 0) peers = 1; throw new Error("unavailable"); }
        return "handle-of-the-daemon-bag";
      },
    });
    expect(await waitForSlotDocument(w.deps)).toEqual({ outcome: "ready", handle: "handle-of-the-daemon-bag" });
    expect(w.asks()).toBeGreaterThan(1);

    // control: a connected peer that never comes to hold the document gives a verdict, once the budget passes
    const c = world({ peerCount: () => 1, find: async () => { throw new Error("unavailable"); } });
    expect(await waitForSlotDocument(c.deps)).toEqual({ outcome: "verdict" });
    expect(c.asks()).toBeGreaterThan(1);
  });

  test("S5 — the main thread's 'unavailable' is a relay's word: the ask goes again, and the document its peer brings later answers", async () => {
    // The island's one peer is the vessel's main thread. It answers "unavailable" while no source IT hears holds the
    // document (its dial to the hearth not yet carrying it), and it asks again and pushes the document on once one
    // does: the same island, asking again inside its budgets, meets the handle.
    let relayHolds = false;
    let asks = 0;
    const w = world({
      peerCount: () => 1,
      find: async () => {
        if (++asks === 4) relayHolds = true;     // the hearth's copy reaches the main thread after three asks
        if (!relayHolds) { w.hear(); throw new Error("unavailable"); }
        return "handle-of-the-hearths-lararium";
      },
    });
    expect(await waitForSlotDocument(w.deps)).toEqual({ outcome: "ready", handle: "handle-of-the-hearths-lararium" });
    expect(w.asks()).toBe(4);

    // control: a relay that never comes to hold it still ends loud, as a verdict, once the budget passes
    const c = world({ peerCount: () => 1, find: async () => { throw new Error("unavailable"); } });
    expect(await waitForSlotDocument(c.deps)).toEqual({ outcome: "verdict" });
    expect(c.at()).toBeGreaterThanOrEqual(8_000);
    expect(c.asks()).toBeGreaterThan(1);
  });

  test("S2 — no peer and a silent port ends never-arrived at the silence budget", async () => {
    const w = world({ find: async () => { throw new Error("unavailable"); } });
    const out = await waitForSlotDocument(w.deps);
    expect(out.outcome).toBe("never-arrived");
    expect(w.at()).toBeGreaterThanOrEqual(8_000);
    expect(w.at()).toBeLessThan(9_000);
    expect(w.asks()).toBeGreaterThan(1);

    const c = world({ find: async () => "at-once" });
    expect(await waitForSlotDocument(c.deps)).toEqual({ outcome: "ready", handle: "at-once" });
    expect(c.asks()).toBe(1);
  });

  test("S3 — traffic keeps the silence clock young; the hard cap still ends the wait", async () => {
    const w = world({ find: async () => { w.hear(); throw new Error("unavailable"); } });
    const out = await waitForSlotDocument(w.deps);
    expect(out.outcome).toBe("never-arrived");
    expect(w.at()).toBeGreaterThanOrEqual(60_000);
    expect(w.at()).toBeLessThan(61_000);
  });

  test("S4 — a rejection that states no absence ends refused at the first ask", async () => {
    const w = world({ find: async () => { throw new Error("Invalid document URL: automerge:bogus"); } });
    expect(await waitForSlotDocument(w.deps)).toEqual({ outcome: "refused", why: "Invalid document URL: automerge:bogus" });
    expect(w.asks()).toBe(1);
    expect(w.at()).toBeLessThan(1_000);
  });
});
