/**
 * The ack-paced drain: one write in flight, its durable ack paces the next; lifecycle only requests (kick) or awaits.
 * Rewritten onto the one Drain (src/drain.ts) once AckPacedTrigger and HandGate burned; it also carries the HandGate suites' claims
 * (coalescing, shared waiters, fault isolation, no clock consulted).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { Drain } from "../src/drain.js";

function rig() {
  const state = new Map<string, string>();
  const writes: Array<{ title: string; text: string }> = [];
  const acks: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
  let failNext = false;
  // One drain write: the title's latest state leaves, then the durable ack paces the next.
  const drain = new Drain({
    write: (title) => {
      writes.push({ title, text: state.get(title)! });
      return new Promise<void>((resolve, reject) => {
        if (failNext) { failNext = false; reject(new Error("no ack")); return; }
        acks.push({ resolve, reject });
      });
    },
  });
  const mark = (title: string, text: string): number => { state.set(title, text); return drain.mark(title); };
  return { drain, mark, writes, acks, failOnce: () => { failNext = true; } };
}
const turns = async (n = 4): Promise<void> => { for (let i = 0; i < n; i++) await new Promise<void>((r) => setImmediate(r)); };

afterEach(() => vi.restoreAllMocks());

describe("the ack-paced drain", () => {
  test("(a) N rapid marks while one write is in flight produce exactly ONE follow-up write carrying the latest state", async () => {
    const r = rig();
    r.mark("d", "k0"); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "k0" }]);
    for (let i = 1; i <= 12; i++) { r.mark("d", `k${i}`); r.drain.kick(); }
    await turns();
    expect(r.writes, "nothing new is written while the first write awaits its ack").toHaveLength(1);
    r.acks.shift()!.resolve(); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "k0" }, { title: "d", text: "k12" }]);
    r.acks.shift()!.resolve(); await turns();
    expect(r.drain.size(), "at rest after the last ack").toBe(0);
    expect(r.writes).toHaveLength(2);
  });

  test("(b) a stalled ack holds the obligation and nothing is written in parallel", async () => {
    const r = rig();
    r.mark("a", "1"); await turns();
    r.mark("b", "2"); r.drain.kick(); await turns(10);
    expect(r.writes.map((w) => w.title)).toEqual(["a"]);
    expect(r.drain.owes("a"), "a stays in flight").toBe(true);
    expect(r.drain.pending(), "b stays owed").toEqual(["b"]);
  });

  test("(c) a failed ack keeps the obligation and the next request retries the latest generation", async () => {
    const r = rig();
    r.failOnce();
    r.mark("d", "one"); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "one" }]);
    expect(r.drain.pending()).toEqual(["d"]);
    r.mark("d", "two"); await turns();
    expect(r.writes.at(-1)).toEqual({ title: "d", text: "two" });
  });

  test("(d) a write whose ack never comes leaves the flight standing", async () => {
    const r = rig();
    r.mark("d", "x"); await turns(10);
    expect(r.writes).toHaveLength(1);
    expect(r.drain.owes("d"), "written but not acked: still in flight").toBe(true);
    expect(r.drain.pending(), "nothing waits for a second write").toEqual([]);
  });

  test("a failed durable ack retries the same obligation on request without another edit", async () => {
    const r = rig();
    r.failOnce();
    r.mark("d", "unacknowledged"); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "unacknowledged" }]);
    r.drain.kick(); await turns();
    expect(r.writes).toEqual([
      { title: "d", text: "unacknowledged" },
      { title: "d", text: "unacknowledged" },
    ]);
    expect(r.acks).toHaveLength(1);
    r.acks.shift()!.resolve(); await turns();
    expect(r.drain.size()).toBe(0);
  });

  test("a rejected ack waits for a request and retries the latest of several newer generations", async () => {
    const r = rig();
    r.mark("d", "old"); await turns();
    r.mark("d", "middle"); r.mark("d", "latest");
    r.acks.shift()!.reject(new Error("no ack")); await turns();
    expect(r.writes, "generations marked during the failed flight never re-arm it").toEqual([{ title: "d", text: "old" }]);
    r.drain.kick(); await turns();
    expect(r.writes).toEqual([{ title: "d", text: "old" }, { title: "d", text: "latest" }]);
    r.acks.shift()!.resolve(); await turns();
    expect(r.drain.size()).toBe(0);
    expect(r.writes).toHaveLength(2);
  });

  test("an ack failure never retries without a new request", async () => {
    const r = rig();
    r.mark("d", "held"); await turns();
    const outcome = r.drain.whenSettled("d");
    r.acks.shift()!.reject(new Error("first")); await turns(10);
    expect((await outcome).kind, "the waiter reads the failure as terminal").toBe("failed");
    expect(r.writes).toHaveLength(1);
  });

  test("(e) a lifecycle request with nothing in flight starts exactly one write, and one with nothing owed starts none", async () => {
    const r = rig();
    r.drain.kick(); await turns();
    expect(r.writes).toEqual([]);
    r.mark("d", "held"); r.drain.kick(); r.drain.kick(); r.drain.kick();
    expect(r.writes, "the request starts the idle pump at once").toHaveLength(1);
    await turns();
    expect(r.writes).toHaveLength(1);
  });

  test("three marks of one title coalesce into one write and settle one shared waiter; two titles stay separate", async () => {
    const r = rig();
    r.mark("A", "1"); r.mark("A", "2"); r.mark("A", "3"); r.mark("B", "b");
    const shared = [r.drain.whenSettled("A"), r.drain.whenSettled("A"), r.drain.whenSettled("A")];
    expect(new Set(shared).size, "one waiter per title").toBe(1);
    await turns();
    r.acks.shift()!.resolve(); await turns();
    r.acks.shift()!.resolve(); await turns();
    expect(r.writes).toEqual([{ title: "A", text: "3" }, { title: "B", text: "b" }]);
    expect((await shared[0]!).kind).toBe("acked");
  });

  test("a refusal settles only the refused title's waiters", async () => {
    const r = rig();
    r.failOnce();
    r.mark("bad", "x"); r.mark("good", "y");
    const bad = r.drain.whenSettled("bad");
    const good = r.drain.whenSettled("good");
    await turns();
    expect((await bad).kind).toBe("failed");
    r.acks.shift()!.resolve();
    expect((await good).kind).toBe("acked");
    expect((await r.drain.whenAcked()).kind, "the refused title still stands owed").toBe("failed");
  });

  test("CONTROL: no clock is consulted while marking, writing, failing, requesting or closing", async () => {
    const clockFault = () => { throw new Error("clock consulted"); };
    vi.spyOn(globalThis, "setTimeout").mockImplementation(clockFault as typeof setTimeout);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(clockFault as typeof clearTimeout);
    vi.spyOn(Date, "now").mockImplementation(clockFault);
    vi.spyOn(performance, "now").mockImplementation(clockFault);
    // Known positive: the instrument catches a timer arm.
    expect(() => { setTimeout(() => {}, 1); }).toThrow("clock consulted");
    const r = rig();
    r.failOnce();
    r.mark("A", "1"); await turns();
    r.mark("A", "2"); r.drain.kick(); await turns();
    r.acks.shift()!.resolve(); await turns();
    const closing = r.drain.close();
    expect((await closing).kind).toBe("acked");
  });
});
