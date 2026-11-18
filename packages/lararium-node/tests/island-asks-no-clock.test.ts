/**
 * THE ISLAND'S ASKS END ON THE VESSEL'S ANSWER, NEVER ON A CLOCK (operator, 2026-11-06: no timeout, no global now).
 *
 * A daemon island asks its vessel for a CAS block, a dyad standing, a receipt, a custody write and a session reading.
 * The vessel answers every ask (`capability-record.ts`: a missing member or a fault answers by name), and the island
 * dies with its vessel, so silence decides nothing: each ask stands however long the clock runs, and the vessel's
 * answer settles it. Each test carries its control: the answer, once it comes, settles the ask as it reads.
 */
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { portTransit, vesselCustodyWriter, vesselDyadAsker, vesselReceiptAsker, vesselSessionDoor } from "../src/sovereign-island-model.js";

const LONG_PAST_ANY_PATIENCE = 10 * 60_000;

function portPair() {
  const island = new EventEmitter();
  const posted: Array<Record<string, unknown>> = [];
  const port = {
    postMessage: (msg: unknown) => { posted.push(msg as Record<string, unknown>); },
    on: (ev: "message", fn: (m: unknown) => void) => { island.on(ev, fn); },
  };
  return { island, posted, port };
}

function watch<T>(p: Promise<T>): { settled: () => boolean; promise: Promise<T> } {
  let done = false;
  const promise = p.finally(() => { done = true; });
  promise.catch(() => {});
  return { settled: () => done, promise };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("the island's asks end on the vessel's answer, never on a clock", () => {
  test("a CAS want stands past any clock; the vessel's miss answers it (control)", async () => {
    const w = portPair();
    const ask = watch(portTransit(w.port).fetchBlock("bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy"));
    await vi.advanceTimersByTimeAsync(LONG_PAST_ANY_PATIENCE);
    expect(ask.settled()).toBe(false);
    w.island.emit("message", { type: "cas:block", requestId: w.posted[0]?.["requestId"], bytes: null });
    await expect(ask.promise).resolves.toBeNull();
  });

  test("a dyad ask stands past any clock and never reads aside on silence; the vessel's standing answers it (control)", async () => {
    const w = portPair();
    const ask = watch(vesselDyadAsker(w.port)("fleet", "device"));
    await vi.advanceTimersByTimeAsync(LONG_PAST_ANY_PATIENCE);
    expect(ask.settled()).toBe(false);
    w.island.emit("message", { type: "dyad:read", requestId: w.posted[0]?.["requestId"], standing: "clear" });
    await expect(ask.promise).resolves.toBe("clear");
  });

  test("a receipt ask stands past any clock; the vessel's receipt answers it (control)", async () => {
    const w = portPair();
    const ask = watch(vesselReceiptAsker(w.port)(["doc-a"]));
    await vi.advanceTimersByTimeAsync(LONG_PAST_ANY_PATIENCE);
    expect(ask.settled()).toBe(false);
    w.island.emit("message", { type: "receipt:issued", requestId: w.posted[0]?.["requestId"], issued: true, proof: { documentIds: ["doc-a"] } });
    await expect(ask.promise).resolves.toBeUndefined();
  });

  test("a custody write stands past any clock; the vessel's refusal answers it by name (control)", async () => {
    const w = portPair();
    const ask = watch(vesselCustodyWriter(w.port)("veil", new Uint8Array([1])));
    await vi.advanceTimersByTimeAsync(LONG_PAST_ANY_PATIENCE);
    expect(ask.settled()).toBe(false);
    w.island.emit("message", { type: "custody:written", requestId: w.posted[0]?.["requestId"], written: false, why: "the seal store refused the write" });
    await expect(ask.promise).rejects.toThrow(/the seal store refused the write/);
  });

  test("a session reading stands past any clock; the vessel's refusal answers it by its own name (control)", async () => {
    const w = portPair();
    const ask = watch(vesselSessionDoor(w.port).signer({ requestId: "ask-1", verb: "mint" }));
    await vi.advanceTimersByTimeAsync(LONG_PAST_ANY_PATIENCE);
    expect(ask.settled()).toBe(false);
    w.island.emit("message", { type: "session:signed", requestId: w.posted[0]?.["requestId"], refusal: "signer-refused" });
    await expect(ask.promise).resolves.toEqual({ refusal: "signer-refused" });
  });
});
