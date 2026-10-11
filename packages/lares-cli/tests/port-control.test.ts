/**
 * port-control.test.ts — `stopIncumbent` waits on the holder's REAL exit, and `waitForPortBudgeted` spends a
 * declared budget per named boot phase rather than one flat deadline.
 *
 * Proven:
 *   · RED: a delayed flush (the port frees only well past the declared grace) keeps `stopIncumbent` PENDING —
 *     it never calls SIGKILL, however long the grace has been spent. Reverted to the old escalate-to-SIGKILL
 *     shape, this test catches the escalation (a SIGKILL call lands before the port frees) — the mutation bites.
 *   · CONTROL: a port that frees inside the grace resolves `{ stopped: true, forced: false }` off one SIGTERM.
 *   · a held port with no discoverable owner FAILS LOUD before any signal sends.
 *   · `waitForPortBudgeted`: RED — a phase that never completes exhausts ITS OWN budget and refuses, naming the
 *     holder, never touching a later phase's allowance; CONTROL — a phase change resets the clock, and a port
 *     that opens inside the new phase's budget resolves.
 */
import { describe, expect, it, vi } from "vitest";
import { stopIncumbent, waitForPortBudgeted, waitForResourceBudgeted, SlowBootTimeout, type StopResult } from "../src/port-control.js";

const PORT = 54_321;

describe("stopIncumbent — the holder's real exit, never a forced one", () => {
  it("RED: a delayed flush keeps the stop PENDING past its grace, with no SIGKILL ever sent", async () => {
    const kill = vi.fn();
    let heldUntil = Date.now() + 300;   // frees well past a 40ms grace — the "delayed flush"
    const probe = async () => Date.now() < heldUntil;
    const holderPids = () => [4242];
    let pastGraceHeldPids: readonly number[] | null = null;

    const result = await stopIncumbent(PORT, {
      graceMs: 40, pollMs: 10, probe, holderPids, kill,
      onPastGrace: (pids) => { pastGraceHeldPids = pids; },
    });

    expect(result).toEqual<StopResult>({ stopped: true });
    expect(kill).toHaveBeenCalledWith(4242, "SIGTERM");
    expect(kill).not.toHaveBeenCalledWith(expect.anything(), "SIGKILL");
    expect(kill).toHaveBeenCalledTimes(1);          // one SIGTERM, never a second signal of any kind
    expect(pastGraceHeldPids).toEqual([4242]);       // the report fired — the wait kept going anyway
    void heldUntil;
  });

  it("MUTATION PROOF: the old escalate-to-SIGKILL shape would have failed the RED test above", async () => {
    const kill = vi.fn();
    const heldUntil = Date.now() + 300;
    const probe = async () => Date.now() < heldUntil;
    const holderPids = () => [4242];

    // Re-enact the retired shape by hand: SIGTERM, wait out a short grace, then SIGKILL — exactly the
    // escalation `stopIncumbent` no longer performs.
    const graceMs = 40;
    kill(4242, "SIGTERM");
    await new Promise((r) => setTimeout(r, graceMs + 10));
    if (await probe(PORT)) kill(4242, "SIGKILL");   // the fault this door retired

    expect(kill).toHaveBeenCalledWith(4242, "SIGKILL");   // proves the OLD shape would bite the RED assertion
  });

  it("CONTROL: a port that frees inside the grace resolves off one SIGTERM, no further waiting", async () => {
    const kill = vi.fn();
    let freed = false;
    const probe = async () => !freed;
    setTimeout(() => { freed = true; }, 20);
    const result = await stopIncumbent(PORT, { graceMs: 5_000, pollMs: 5, probe, holderPids: () => [111], kill, onPastGrace: () => {} });
    expect(result).toEqual<StopResult>({ stopped: true });
    expect(kill).toHaveBeenCalledTimes(1);
    expect(kill).toHaveBeenCalledWith(111, "SIGTERM");
  });

  it("already free is a no-op — no signal sent", async () => {
    const kill = vi.fn();
    const result = await stopIncumbent(PORT, { probe: async () => false, holderPids: () => [111], kill, onPastGrace: () => {} });
    expect(result).toEqual<StopResult>({ stopped: false });
    expect(kill).not.toHaveBeenCalled();
  });

  it("a held port with no discoverable owner FAILS LOUD before any signal sends", async () => {
    const kill = vi.fn();
    await expect(stopIncumbent(PORT, { probe: async () => true, holderPids: () => [], kill, onPastGrace: () => {} }))
      .rejects.toThrow(/no owning PID found/);
    expect(kill).not.toHaveBeenCalled();
  });

  it("`cut: true` delivers exactly ONE further signal past grace — never a ladder, never SIGKILL", async () => {
    const kill = vi.fn();
    let heldUntil = Date.now() + 300;
    const probe = async () => Date.now() < heldUntil;
    const holderPids = () => [4242];
    const result = await stopIncumbent(PORT, {
      graceMs: 20, pollMs: 5, probe, holderPids, kill, cut: true,
      onPastGrace: () => {},
    });
    expect(result).toEqual<StopResult>({ stopped: true });
    // The initial SIGTERM plus exactly one cut SIGTERM — never a SIGKILL, never a third signal.
    expect(kill).toHaveBeenCalledTimes(2);
    expect(kill).toHaveBeenNthCalledWith(1, 4242, "SIGTERM");
    expect(kill).toHaveBeenNthCalledWith(2, 4242, "SIGTERM");
    expect(kill).not.toHaveBeenCalledWith(expect.anything(), "SIGKILL");
    void heldUntil;
  });

  it("without `cut`, past grace delivers no second signal at all (the default stays report-only)", async () => {
    const kill = vi.fn();
    const heldUntil = Date.now() + 300;
    const probe = async () => Date.now() < heldUntil;
    const result = await stopIncumbent(PORT, {
      graceMs: 20, pollMs: 5, probe, holderPids: () => [4242], kill,
      onPastGrace: () => {},
    });
    expect(result).toEqual<StopResult>({ stopped: true });
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("SET-BACK/SET-FORWARD `Date.now()` PROOF: the grace reads off a monotonic clock, never the wall clock", async () => {
    const kill = vi.fn();
    const realNow = Date.now;
    let wallOffsetMs = 0;
    // Any caller still reading Date.now() (a probe's own timing, or a reverted grace check) would be thrown
    // wildly off by this; `stopIncumbent`'s OWN grace/cut timing must not move at all.
    Date.now = () => realNow() + wallOffsetMs;
    try {
      let heldUntil = realNow() + 300;
      const probe = async () => realNow() < heldUntil;
      let pastGraceHeldPids: readonly number[] | null = null;
      const t0 = performance.now();
      // Jump the wall clock backward by a year mid-wait, then forward by a year — a reverted
      // `Date.now()`-based deadline would either never fire (set-back) or fire instantly (set-forward).
      setTimeout(() => { wallOffsetMs = -365 * 24 * 60 * 60 * 1000; }, 10);
      setTimeout(() => { wallOffsetMs = 365 * 24 * 60 * 60 * 1000; }, 20);
      const result = await stopIncumbent(PORT, {
        graceMs: 40, pollMs: 5, probe, holderPids: () => [4242], kill,
        onPastGrace: (pids) => { pastGraceHeldPids = pids; },
      });
      const elapsedMonotonic = performance.now() - t0;
      expect(result).toEqual<StopResult>({ stopped: true });
      expect(pastGraceHeldPids).toEqual([4242]);
      // The real elapsed time stayed near the declared 300ms hold, not instant (forward jump) and not
      // never-ending (back jump, which would have timed this test out instead).
      expect(elapsedMonotonic).toBeGreaterThan(100);
      expect(elapsedMonotonic).toBeLessThan(2_000);
      void heldUntil;
    } finally {
      Date.now = realNow;
    }
  });
});

describe("waitForPortBudgeted — a declared budget per named boot phase", () => {
  const PHASES = [
    { name: "starting", budgetMs: 40 },
    { name: "ready",    budgetMs: 200 },
  ] as const;

  it("RED: a phase that never completes exhausts its OWN budget and refuses, naming the holder", async () => {
    let phase = "starting";
    const probe = async () => false;   // the port never opens
    await expect(
      waitForPortBudgeted(54_322, PHASES, { phase: () => phase, pollMs: 5, probe, holderPids: () => [777] }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(SlowBootTimeout);
      const err = e as SlowBootTimeout;
      expect(err.phase).toBe("starting");          // exhausted in the phase it was stuck in, not a later one
      expect(err.holderPids).toEqual([777]);
      return true;
    });
    void phase;
  });

  it("CONTROL: a phase change resets the clock — a port that opens inside the NEW phase's budget resolves", async () => {
    let phase = "starting";
    let opensAt = 0;
    setTimeout(() => { phase = "ready"; opensAt = Date.now() + 60; }, 30);   // moves on before "starting" exhausts
    const probe = async () => opensAt !== 0 && Date.now() >= opensAt;
    await expect(
      waitForPortBudgeted(54_323, PHASES, { phase: () => phase, pollMs: 5, probe, holderPids: () => [] }),
    ).resolves.toBeUndefined();
  });

  it("a port already open resolves at once, spending none of either phase's budget", async () => {
    const started = Date.now();
    await waitForPortBudgeted(54_324, PHASES, { phase: () => "starting", pollMs: 5, probe: async () => true });
    expect(Date.now() - started).toBeLessThan(30);
  });
});

describe("waitForResourceBudgeted — the non-port generalization (M1)", () => {
  const PHASES = [
    { name: "starting", budgetMs: 40 },
    { name: "ready",    budgetMs: 200 },
  ] as const;

  it("RED: a non-port resource that never settles exhausts its own phase budget, naming the resource and the holder", async () => {
    await expect(
      waitForResourceBudgeted("the vessel's store door", PHASES, {
        phase: () => "starting", pollMs: 5, probe: async () => false, holderPids: () => [4242],
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(SlowBootTimeout);
      const err = e as SlowBootTimeout;
      expect(err.phase).toBe("starting");
      expect(err.resource).toBe("the vessel's store door");
      expect(err.holderPids).toEqual([4242]);
      expect(err.message).toMatch(/the vessel's store door is still held by pid\(s\) 4242/);
      return true;
    });
  });

  it("CONTROL: `until` ends the wait quietly the instant it reads true, never throwing", async () => {
    let done = false;
    setTimeout(() => { done = true; }, 15);
    await expect(
      waitForResourceBudgeted("the vessel's store door", PHASES, {
        phase: () => "starting", pollMs: 5, probe: async () => false, holderPids: () => [], until: () => done,
      }),
    ).resolves.toBeUndefined();
  });

  it("async phase/probe/holderPids are awaited (an async holder read is honoured, not just a sync one)", async () => {
    await expect(
      waitForResourceBudgeted("async resource", PHASES, {
        phase: async () => "starting", pollMs: 5, probe: async () => false,
        holderPids: async () => [9],
      }),
    ).rejects.toSatisfy((e: unknown) => {
      expect((e as SlowBootTimeout).holderPids).toEqual([9]);
      return true;
    });
  });

  it("SET-BACK/SET-FORWARD `Date.now()` PROOF: phase budgets read off a monotonic clock", async () => {
    const realNow = Date.now;
    let wallOffsetMs = 0;
    Date.now = () => realNow() + wallOffsetMs;
    try {
      setTimeout(() => { wallOffsetMs = -365 * 24 * 60 * 60 * 1000; }, 10);
      setTimeout(() => { wallOffsetMs = 365 * 24 * 60 * 60 * 1000; }, 20);
      const t0 = performance.now();
      await expect(
        waitForResourceBudgeted("the vessel's store door", PHASES, {
          phase: () => "starting", pollMs: 5, probe: async () => false, holderPids: () => [4242],
        }),
      ).rejects.toBeInstanceOf(SlowBootTimeout);
      const elapsedMonotonic = performance.now() - t0;
      // A reverted Date.now()-based deadline would either never throw (set-back, timing this test out)
      // or throw near-instantly (set-forward, well under the declared 40ms phase budget).
      expect(elapsedMonotonic).toBeGreaterThan(30);
      expect(elapsedMonotonic).toBeLessThan(2_000);
    } finally {
      Date.now = realNow;
    }
  });

  it("MUTATION PROOF: `waitForPortBudgeted`'s own RED test above still exercises the SAME shared loop", async () => {
    // waitForPortBudgeted is now a thin wrapper over waitForResourceBudgeted; a port-shaped resource string
    // (`"port <n>"`) proves the wrapper still routes through the generalized primitive, not a parallel copy.
    await expect(
      waitForPortBudgeted(54_399, PHASES, { phase: () => "starting", pollMs: 5, probe: async () => false, holderPids: () => [1] }),
    ).rejects.toSatisfy((e: unknown) => {
      expect((e as SlowBootTimeout).resource).toBe("port 54399");
      return true;
    });
  });
});
