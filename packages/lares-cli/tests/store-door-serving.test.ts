/**
 * store-door — A VESSEL THAT SERVES IS WAITED ON, NEVER TIMED OUT (No Global Now: a wall clock MUST NOT decide).
 *
 * The live seat answers the holder probe `serving`, naming the oldest ask in flight. The door then waits on the vessel's
 * own answer however long the island runs ahead of the act: no budget spends, no "parked … no discoverable holder" reads
 * against a live vessel. The serving phase's figure paces the progress lines alone, each naming the request id; a
 * person's interrupt ends the wait, closes the door's own socket, and names the id to read back.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/local-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/local-connector.js")>();
  return { ...actual, udsAlive: vi.fn(), whoHolds: vi.fn(), udsSocketPresent: vi.fn(() => true), invokeLocal: vi.fn() };
});
vi.mock("../src/custody-door.js", () => ({ vesselStanding: vi.fn(async () => ({ reading: "vessel", unlocked: true, composing: false })) }));
vi.mock("../src/env.js", () => ({ vesselDid: vi.fn(async () => "did:test"), larSealHome: vi.fn(() => "/tmp/unused-seal") }));

import { udsAlive, whoHolds, invokeLocal } from "../src/local-connector.js";
import { throughStoreDoor, storeFailure, RequestLost, StoreDoorInterrupted, StoreDoorEnded, STORE_DOOR_PHASES, SlowBootTimeout, hostPidAlive, standBootLog } from "../src/store-door.js";

/** Every phase's figure tiny, so a clock-decided refusal, were one left, would fire many times over inside the wait. */
const TINY = [
  { name: "unbound", budgetMs: 5 },
  { name: "parked",  budgetMs: 5, paced: true as const },
  { name: "wedged",  budgetMs: 5 },
  { name: "serving", budgetMs: 5, paced: true as const },
];
const SERVING = { phase: "serving" as const, holder: "vessel", message: "the vessel (pid 4242) serves the store; 2 ask(s) in flight", inFlight: 2, oldest: { verb: "seal" }, held: true };

describe("a serving vessel is waited on, never timed out", () => {
  it("the shipped serving phase is paced: it names a cadence and no budget", () => {
    expect(STORE_DOOR_PHASES.find((p) => p.name === "serving")).toMatchObject({ paced: true });
  });

  it("RED: a serving vessel whose answer comes after many cadences answers the door; progress lines name the request id and the oldest ask", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(SERVING);
    let sentId = "";
    let release!: () => void;
    const answered = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(invokeLocal).mockImplementation(async (_verb, _args, _by, opts) => {
      sentId = opts?.requestId ?? "";
      expect(opts?.untimed).toBe(true);   // no local timer rides this wait
      await answered;
      return { status: "done", requestId: sentId };
    });
    const lines: string[] = [];
    const door = throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, progress: (line) => {
      lines.push(line);
      if (lines.length === 4) release();   // the vessel answers only once the waiter paced past its figure thrice
    } });
    const r = await door;
    expect(r.via).toBe("daemon");
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]).toContain(sentId);
    expect(lines[0]).toContain("the oldest a seal");
    expect(lines[0]).toContain(`lares vessel request ${sentId}`);   // the cure rides every line
    expect(lines[0]).toMatch(/serves/);
  });

  it("a person's interrupt ends the wait, aborts the door's own socket, and names the request id to read back", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(SERVING);
    let aborted = false;
    let sentId = "";
    vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => new Promise((_resolve, reject) => {
      sentId = opts?.requestId ?? "";
      opts?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
    }));
    const interrupt = new AbortController();
    const lines: string[] = [];
    const door = throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interrupt: interrupt.signal, interactive: true, progress: (line) => {
      lines.push(line);
      if (lines.length === 2) interrupt.abort();
    } });
    await expect(door).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(StoreDoorInterrupted);
      expect((e as StoreDoorInterrupted).requestId).toBe(sentId);
      expect((e as Error).message).toContain(`lares vessel request ${sentId}`);
      const f = storeFailure(e);
      expect(f.code).toBe("outcome-unknown");
      expect(f.hint).toContain(sentId);
      return true;
    });
    expect(aborted).toBe(true);
  });

  it("the shipped parked phase is paced: a boot that still advances leaves no clock to decide", () => {
    expect(STORE_DOOR_PHASES.find((p) => p.name === "parked")).toMatchObject({ paced: true });
  });
});

describe("a parked holder is waited on until a cause ends it, never a clock", () => {
  const PARKED = { phase: "parked" as const, holder: "vessel", message: "a vessel (pid 4242) holds the store at /tmp/x" };
  const hang = () => vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => new Promise((_resolve, reject) => {
    opts?.signal?.addEventListener("abort", () => { reject(new Error("aborted")); }, { once: true });
  }));

  it("RED: a fake clock far past the old 45 s leaves the act owed: no refusal, and the pacing line says the boot goes on", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(PARKED);
    hang();
    const real = performance.now.bind(performance);
    let skew = 0;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => real() + skew);
    const interrupt = new AbortController();
    const lines: string[] = [];
    try {
      const door = throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: true, interrupt: interrupt.signal,
        holderAlive: () => true, bootLog: () => "phase → catalog-ready\nphase → island-ready\n",
        progress: (line) => { lines.push(line); if (lines.length === 3) interrupt.abort(); } });
      skew = 10 * 60_000;   // ten minutes pass on the fake clock
      await expect(door).rejects.toBeInstanceOf(StoreDoorInterrupted);   // only the person ended it
    } finally { spy.mockRestore(); }
    expect(lines[0]).toContain("the vessel still boots");
    expect(lines[0]).toContain("island-ready");
    expect(lines[0]).toContain("the act stays owed");
  });

  it("RED: a gone holder ends the wait with a named refusal and a runnable cure", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(PARKED);
    hang();
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, holderAlive: (() => { let n = 0; return () => (n++ < 1); })(), bootLog: () => "" }))
      .rejects.toSatisfy((e: unknown) => {
        expect(e).toBeInstanceOf(StoreDoorEnded);
        expect((e as StoreDoorEnded).ended).toBe("holder-gone");
        const f = storeFailure(e);
        expect(f.code).toBe("store-door-ended");
        expect(f.hint).toMatch(/`lares [^`]+`/);
        return true;
      });
  });

  it("a holder pid the host never read alive (another pid namespace) never ends a healthy boot", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(PARKED);
    hang();
    const interrupt = new AbortController();
    let paces = 0;
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, holderAlive: () => false, bootLog: () => "", interactive: false, interrupt: interrupt.signal,
      progress: () => { if ((paces += 1) === 4) interrupt.abort(); } })).rejects.toBeInstanceOf(StoreDoorInterrupted);
  });

  it("the stand log binds to the held vessel: a stale fatal (written before the holder started) or a container holder reads nothing; a current-boot fatal reads", () => {
    const log = "[lararium] phase → boot\nfatal: no hearth\n";
    const alive = () => true;
    // STALE: the file was last written before the held pid started: an earlier failed stand's fatal.
    expect(standBootLog([4242], { alive, startMs: () => 2_000, logMtimeMs: () => 1_000, readLog: () => log })).toBe("");
    // CONTAINER: the host never reads the named pid alive.
    expect(standBootLog([4242], { alive: () => false, startMs: () => 1_000, logMtimeMs: () => 2_000, readLog: () => log })).toBe("");
    // CURRENT: written after the holder started.
    expect(standBootLog([4242], { alive, startMs: () => 1_000, logMtimeMs: () => 2_000, readLog: () => log })).toContain("fatal: no hearth");
    // An earlier boot's fault in the same file never reads past the last boot line.
    expect(standBootLog([4242], { alive, startMs: () => 1_000, logMtimeMs: () => 2_000, readLog: () => "phase → boot\nfatal: old\n[lararium] phase → boot\nphase → repo-open\n" })).not.toContain("fatal");
  });

  it("EPERM reads a holder alive; only ESRCH reads it gone", () => {
    const kill = vi.spyOn(process, "kill");
    try {
      kill.mockImplementation(() => { throw Object.assign(new Error("eperm"), { code: "EPERM" }); });
      expect(hostPidAlive(4242)).toBe(true);
      kill.mockImplementation(() => { throw Object.assign(new Error("esrch"), { code: "ESRCH" }); });
      expect(hostPidAlive(4242)).toBe(false);
    } finally { kill.mockRestore(); }
  });

  it("an unattended parked wait prints a runnable cure with every pace line", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(PARKED);
    hang();
    const interrupt = new AbortController();
    const lines: string[] = [];
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, holderAlive: () => true, bootLog: () => "", interactive: false, interrupt: interrupt.signal,
      progress: (line) => { lines.push(line); if (lines.length === 2) interrupt.abort(); } })).rejects.toBeInstanceOf(StoreDoorInterrupted);
    expect(lines[0]).toContain("`lares vessel read`");
    expect(lines[0]).toContain("pid 4242");
    expect(lines[0]).toMatch(/interrupt this act; it stays owed/);
  });

  it("no door clock rides the wire: a paced door asks the vessel for its full patience, never the 30 s default", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(SERVING);
    let asked: number | undefined;
    vi.mocked(invokeLocal).mockImplementation(async (_verb, _args, _by, opts) => { asked = opts?.timeoutMs; return { status: "done", requestId: opts?.requestId ?? "" }; });
    await throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: STORE_DOOR_PHASES });
    expect(asked).toBeGreaterThanOrEqual(3_600_000);
  });

  it("CONTROL: the unpaced phases keep their bound: a wedged holder still ends by SlowBootTimeout", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({ phase: "wedged", holder: null, message: "a listener accepted the connection but gave no answer — frozen or wedged, still held by pid(s) 4242" });
    hang();
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: false })).rejects.toBeInstanceOf(SlowBootTimeout);
  });

  it("RED: a boot-log fatal ends the wait with a named refusal; a uds error names its cause", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(PARKED);
    hang();
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, holderAlive: () => true, bootLog: () => "phase → boot\nfatal: no hearth\n" }))
      .rejects.toSatisfy((e: unknown) => { expect((e as StoreDoorEnded).ended).toBe("boot-fault"); expect((e as Error).message).toContain("fatal:"); return true; });
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, holderAlive: () => true, bootLog: () => "uds error: EADDRINUSE\n" }))
      .rejects.toSatisfy((e: unknown) => { expect((e as StoreDoorEnded).ended).toBe("boot-refused"); expect((e as Error).message).toContain("EADDRINUSE"); return true; });
  });

  it("RED: a stand-socket exit ends the wait by name", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(PARKED);
    hang();
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, holderAlive: () => true, bootLog: () => "", standExited: () => true }))
      .rejects.toSatisfy((e: unknown) => { expect((e as StoreDoorEnded).ended).toBe("stand-exited"); return true; });
  });
});

describe("a wait with no person at the keys ends on the seat's own word", () => {
  const never = () => vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => new Promise((_resolve, reject) => {
    opts?.signal?.addEventListener("abort", () => { reject(new Error("aborted")); }, { once: true });
  }));

  it("RED: a seat that held the act and holds it no more, with no answer arrived, refuses `request-lost` naming the id to read back", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    let reads = 0;
    vi.mocked(whoHolds).mockImplementation(async () => ({ ...SERVING, held: (reads += 1) <= 3 }));
    never();
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: true, progress: () => {} }))
      .rejects.toSatisfy((e: unknown) => {
        expect(e).toBeInstanceOf(RequestLost);
        const id = (e as RequestLost).requestId;
        expect((e as Error).message).toContain(`lares vessel request ${id}`);
        expect(storeFailure(e).code).toBe("request-lost");
        return true;
      });
    expect(reads).toBeGreaterThanOrEqual(5);
  });

  it("CONTROL: a probe that reads the act not yet held before the seat took it ends nothing: the act answers", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    let reads = 0;
    let release!: () => void;
    const answered = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(whoHolds).mockImplementation(async () => { reads += 1; if (reads === 6) release(); return { ...SERVING, held: reads > 3 }; });
    vi.mocked(invokeLocal).mockImplementation(async (_v, _a, _b, opts) => { await answered; return { status: "done", requestId: opts?.requestId ?? "" }; });
    const r = await throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: true, progress: () => {} });
    expect(r.via).toBe("daemon");
  });

  it("RED: unattended, a seat that names no hold for the act ends the wait by name; attended, the same seat is waited on", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    const { held: _held, ...unconfirmed } = SERVING;
    vi.mocked(whoHolds).mockResolvedValue(unconfirmed);
    never();
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: false, progress: () => {} })).rejects.toBeInstanceOf(RequestLost);
    // Attended: the same seat, waited on until the person's interrupt.
    const interrupt = new AbortController();
    let paced = 0;
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: true, interrupt: interrupt.signal, progress: () => { if ((paced += 1) === 3) interrupt.abort(); } }))
      .rejects.toBeInstanceOf(StoreDoorInterrupted);
  });

  it("unattended, a seat that confirms the hold is waited on, and the lines name the cure and no Ctrl-C", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(SERVING);
    let release!: () => void;
    const answered = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(invokeLocal).mockImplementation(async (_v, _a, _b, opts) => { await answered; return { status: "done", requestId: opts?.requestId ?? "" }; });
    const lines: string[] = [];
    await throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interactive: false, progress: (line) => { lines.push(line); if (lines.length === 3) release(); } });
    expect(lines[0]).not.toMatch(/Ctrl-C/);
    expect(lines[0]).toMatch(/lares vessel request/);
  });
});
