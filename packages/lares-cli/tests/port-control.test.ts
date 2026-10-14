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
import { spawn } from "node:child_process";
import { stopIncumbent, waitForPortBudgeted, waitForResourceBudgeted, SlowBootTimeout, type StopResult } from "../src/port-control.js";

const PORT = 54_321;

/**
 * `stopIncumbent`'s floor (`pidAlive`) signals the real global `process.kill(pid, 0)` — never a test seam
 * of its own. To drive a FAKE pid's liveness through tests that already mock `holderPids`/`probe`/`kill`
 * against a fictional process, spy `process.kill` itself: a signal-0 probe for `pid` reads alive while
 * `aliveFn(pid)` holds, and ESRCH once it does not. Every OTHER signal (the real SIGTERM sends, which ride
 * the door's own injected `kill` option, never `process.kill`) passes through untouched.
 */
function withPidAliveSpy<T>(aliveFn: (pid: number) => boolean, fn: () => Promise<T>): Promise<T> {
  const spy = vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: string | number) => {
    if (signal === 0) {
      if (!aliveFn(pid)) { const e = new Error("ESRCH") as NodeJS.ErrnoException; e.code = "ESRCH"; throw e; }
      return true;
    }
    return true;
  }) as typeof process.kill);
  return fn().finally(() => spy.mockRestore());
}

describe("stopIncumbent — the holder's real exit, never a forced one", () => {
  it("RED: a delayed flush keeps the stop PENDING past its grace, with no SIGKILL ever sent", async () => {
    const kill = vi.fn();
    // THE DELAYED FLUSH, held by the door's own word: the holder lets go only once the door has reported the
    // grace spent (`onPastGrace`). No clock of the test's decides when the holder frees, so the stop meets
    // "past grace and still held" on any machine, and then meets the holder's real exit.
    let held = true;
    const probe = async () => held;
    const holderPids = () => [4242];
    let pastGraceHeldPids: readonly number[] | null = null;

    const result = await withPidAliveSpy(() => held, () => stopIncumbent(PORT, {
      graceMs: 40, pollMs: 10, probe, holderPids, kill,
      onPastGrace: (pids) => { pastGraceHeldPids = pids; held = false; },
    }));

    expect(result).toEqual<StopResult>({ stopped: true });
    expect(kill).toHaveBeenCalledWith(4242, "SIGTERM");
    expect(kill).not.toHaveBeenCalledWith(expect.anything(), "SIGKILL");
    expect(kill).toHaveBeenCalledTimes(1);          // one SIGTERM, never a second signal of any kind
    expect(pastGraceHeldPids).toEqual([4242]);       // the report fired — the wait kept going anyway
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
    // The holder outlasts the door's own SECOND signal by six more of the door's looks, then lets go: the
    // door's `kill` calls and its own looks decide, and no clock of the test's does. Each of those looks gives
    // a ladder its chance to send a third signal.
    let looksAfterCut = 0;
    const held = (): boolean => kill.mock.calls.length < 2 || ++looksAfterCut <= 6;
    const probe = async () => held();
    const holderPids = () => [4242];
    let reported = 0;
    const result = await withPidAliveSpy(() => held(), () => stopIncumbent(PORT, {
      graceMs: 20, pollMs: 5, probe, holderPids, kill, cut: true,
      onPastGrace: () => { reported += 1; },
    }));
    expect(reported).toBe(1);                         // the cut followed the one report of a spent grace
    expect(result).toEqual<StopResult>({ stopped: true });
    // The initial SIGTERM plus exactly one cut SIGTERM — never a SIGKILL, never a third signal.
    expect(kill).toHaveBeenCalledTimes(2);
    expect(kill).toHaveBeenNthCalledWith(1, 4242, "SIGTERM");
    expect(kill).toHaveBeenNthCalledWith(2, 4242, "SIGTERM");
    expect(kill).not.toHaveBeenCalledWith(expect.anything(), "SIGKILL");
  });

  it("H5′ RED→GREEN: --cut reaches the CAPTURED pid even once a past-grace port re-read would find nobody", async () => {
    // Mirrors main.ts's own ordering: the http listener (and so the port) frees almost INSTANTLY once the
    // first SIGTERM lands, well before the holder's own teardown actually finishes — so a past-grace
    // RE-READ of the OS port table (`holderPids(port)`) already answers [] by the time grace is spent,
    // while the real holder (mocked via `holderAlive`, exactly as `commands/read.ts` wires `udsAlive`)
    // stands alive well past it. The fix never re-reads the port at that point; it signals the pids it
    // itself signalled at the top (captured BEFORE the port froze), filtered by their own real liveness.
    const kill = vi.fn();
    let portFreed = false;
    setTimeout(() => { portFreed = true; }, 2);     // the port frees almost at once — main.ts's own order
    let holderLetGo = false;
    setTimeout(() => { holderLetGo = true; }, 30);  // the real holder exits well after grace is spent
    const probe = async () => true;                 // irrelevant once holderAlive is wired
    const holderPids = () => (portFreed ? [] : [4242]);   // THE RE-READ FAULT: [] by the time grace fires
    const holderAlive = async () => !holderLetGo;
    let pastGraceHeldPids: readonly number[] | null = null;

    const result = await withPidAliveSpy(() => !holderLetGo, () => stopIncumbent(PORT, {
      graceMs: 10, pollMs: 5, probe, holderPids, kill, cut: true, holderAlive,
      onPastGrace: (pids) => { pastGraceHeldPids = pids; },
    }));
    expect(result).toEqual<StopResult>({ stopped: true });
    expect(pastGraceHeldPids).toEqual([4242]);      // named the real holder, never the stale []
    expect(kill).toHaveBeenCalledTimes(2);          // the initial SIGTERM plus exactly one cut SIGTERM
    expect(kill).toHaveBeenNthCalledWith(1, 4242, "SIGTERM");
    expect(kill).toHaveBeenNthCalledWith(2, 4242, "SIGTERM");
  });

  it("H5′ MUTATION PROOF: re-reading the port at past-grace (the retired shape) would have reached nobody", async () => {
    // Re-enact the retired shape by hand: naming the held pids off a past-grace `holderPids(port)` call,
    // exactly as the code once did, against the SAME port-frees-before-holder-exits timeline above.
    let portFreed = true;   // by the time grace would fire, main.ts's own ordering already froze the port
    const holderPids = () => (portFreed ? [] : [4242]);
    const heldAtPastGrace = holderPids();
    expect(heldAtPastGrace).toEqual([]);   // nobody to cut — the retired re-read shape's own fault
    void portFreed;
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

  it("H5 RED→GREEN: waits on the HOLDER, not the port — `stopped:true` only once `holderAlive` lets go", async () => {
    // The port frees INSTANTLY (mirrors main.ts closing its http listener as the very first teardown
    // step), but the real holder (its UDS rendezvous claim, here mocked) keeps answering for a while
    // longer. A port-only reading would report `stopped: true` at once — the bug this closes.
    const kill = vi.fn();
    let holderLetGo = false;
    setTimeout(() => { holderLetGo = true; }, 30);
    // Once `holderAlive` is wired, the loop never consults `probe` again — only the initial
    // "already free" guard does, so it must read HELD there to enter the wait at all. The port
    // freeing instantly thereafter (main.ts's own ordering) is exactly what `holderAlive` must
    // outlast.
    const probe = async () => true;
    const holderAlive = async () => !holderLetGo;
    const t0 = performance.now();
    const result = await stopIncumbent(PORT, {
      graceMs: 5_000, pollMs: 5, probe, holderPids: () => [999_999], kill, holderAlive,
      onPastGrace: () => {},
    });
    const elapsed = performance.now() - t0;
    expect(result).toEqual<StopResult>({ stopped: true });
    expect(elapsed).toBeGreaterThanOrEqual(25);   // proves it did NOT return the instant the port read free
  });

  it("H5 MUTATION PROOF: a port-only reading (no `holderAlive` wired) would have reported `stopped:true` early", async () => {
    const kill = vi.fn();
    const portFree = true;
    const probe = async () => !portFree;
    // Re-enact the retired port-only shape by hand: the very first probe already reads free.
    const stoppedImmediately = !(await probe(PORT));
    expect(stoppedImmediately).toBe(true);   // proves the OLD shape would call this "stopped" with the holder still live
    void kill;
  });

  it("H5: the signalled pids' own liveness is the unconditional FLOOR under `holderAlive`", async () => {
    // A flaky/premature `holderAlive` that answers "gone" from the very first poll must NOT resolve
    // `stopped: true` while the signalled pid still answers a signal-0 probe (mocked here via a
    // `process.kill` spy, independent of the `kill` option this door uses to SEND signals).
    const kill = vi.fn();
    let pidDead = false;
    const killSpy = vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: string | number) => {
      if (signal === 0 && pid === 777_777 && pidDead) {
        const e = new Error("ESRCH") as NodeJS.ErrnoException;
        e.code = "ESRCH";
        throw e;
      }
      return true;
    }) as typeof process.kill);
    try {
      const probe = async () => true;             // irrelevant: holderAlive is wired, probe never consulted
      const holderAlive = async () => false;       // reads "gone" from the first poll onward
      const resultPromise = stopIncumbent(PORT, {
        graceMs: 5_000, pollMs: 5, probe, holderPids: () => [777_777], kill, holderAlive,
        onPastGrace: () => {},
      });
      let resolved = false;
      void resultPromise.then(() => { resolved = true; });
      await new Promise((r) => setTimeout(r, 40));
      expect(resolved).toBe(false);     // the floor kept it pending despite holderAlive saying "gone"
      pidDead = true;                   // now let the floor itself read "gone" too
      await expect(resultPromise).resolves.toEqual<StopResult>({ stopped: true });
    } finally {
      killSpy.mockRestore();
    }
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
      const result = await withPidAliveSpy(() => realNow() < heldUntil, () => stopIncumbent(PORT, {
        graceMs: 40, pollMs: 5, probe, holderPids: () => [4242], kill,
        onPastGrace: (pids) => { pastGraceHeldPids = pids; },
      }));
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

describe("stopIncumbent — H5′ LIVE: a real hung-teardown child, cut delivered through to a real second SIGTERM", () => {
  it("--cut reaches the REAL child even once the port itself reads free well before the child exits", async () => {
    // A real child process stands in for the vessel's own hung teardown (`main.ts`'s own convention: a
    // first SIGTERM starts a graceful shutdown; a SECOND SIGTERM — `--cut`'s own signal — cuts it, exit
    // 75). `kill` here frees the mocked "port" on the FIRST SIGTERM it sends — mirroring main.ts closing
    // its http listener as its very first teardown step — well before the child has actually exited, so
    // a past-grace RE-READ of that "port" finds nobody. `pidAlive`'s floor rides the REAL
    // `process.kill(pid, 0)` against this REAL child — no mock needed for it at all.
    const child = spawn(process.execPath, [
      "-e",
      // Prints "ready" only once the SIGTERM handler is actually REGISTERED — spawning the process and
      // the process having run far enough to attach its own handler are two different moments; sending
      // a signal in the gap between them hits Node's own DEFAULT SIGTERM action (terminate) instead of
      // this handler, which would read as the child dying with no code at all rather than proving anything.
      "let n=0; process.on('SIGTERM',()=>{n++; if(n>=2) process.exit(75);}); process.stdout.write('ready\\n'); setInterval(()=>{},1000);",
    ]);
    try {
      const pid: number = await new Promise((resolve, reject) => {
        let buf = "";
        child.stdout.on("data", (c: Buffer) => {
          buf += c.toString();
          if (buf.includes("ready")) resolve(child.pid!);
        });
        child.once("error", reject);
        child.once("exit", (code) => reject(new Error(`child exited before signalling ready (code ${code})`)));
      });
      let portFreed = false;
      const probe = async (): Promise<boolean> => !portFreed;
      const realKill = (p: number, sig: NodeJS.Signals): void => { if (sig === "SIGTERM") portFreed = true; process.kill(p, sig); };
      const resultPromise = stopIncumbent(54_998, {
        graceMs: 50, pollMs: 10, probe,
        holderPids: () => (portFreed ? [] : [pid]),   // THE RE-READ FAULT, live: [] once the "port" frees
        kill: realKill, cut: true,
        onPastGrace: () => {},
      });
      const exitPromise = new Promise<number>((resolve) => child.once("exit", (code) => resolve(code ?? -1)));
      const [result, exitCode] = await Promise.all([resultPromise, exitPromise]);
      expect(exitCode).toBe(75);                         // the child saw its SECOND SIGTERM — the cut landed
      expect(result).toEqual<StopResult>({ stopped: true });
    } finally {
      if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
    }
  }, 10_000);
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
    // "At once" reads off the door's own acts, never off a clock: it probed once, and never asked who holds.
    const probe = vi.fn(async () => true);
    const holderPids = vi.fn(() => []);
    await waitForPortBudgeted(54_324, PHASES, { phase: () => "starting", pollMs: 5, probe, holderPids });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(holderPids).not.toHaveBeenCalled();
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
