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
import { throughStoreDoor, storeFailure, StoreDoorInterrupted, STORE_DOOR_PHASES } from "../src/store-door.js";

/** Every phase's figure tiny, so a clock-decided refusal, were one left, would fire many times over inside the wait. */
const TINY = [
  { name: "unbound", budgetMs: 5 },
  { name: "parked",  budgetMs: 5 },
  { name: "wedged",  budgetMs: 5 },
  { name: "serving", budgetMs: 5, paced: true as const },
];
const SERVING = { phase: "serving" as const, holder: "vessel", message: "the vessel (pid 4242) serves the store; 2 ask(s) in flight", inFlight: 2, oldest: { requestId: "req-walk", verb: "seal" } };

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
    expect(lines[0]).toContain("req-walk");
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
    const door = throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY, interrupt: interrupt.signal, progress: (line) => {
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

  it("CONTROL: a parked holder still spends its parked budget (the boot park keeps its bound until the molt)", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({ phase: "parked", holder: "vessel", message: "a vessel (pid 4242) holds the store at /tmp/x" });
    vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => new Promise((_resolve, reject) => {
      opts?.signal?.addEventListener("abort", () => { reject(new Error("aborted")); }, { once: true });
    }));
    await expect(throughStoreDoor({ verb: "tiddler-put", args: {}, direct: async () => ({}), phases: TINY })).rejects.toThrow(/phase "parked"/);
  });
});
