import { afterEach, describe, expect, it, vi } from "vitest";
import { HandGate } from "../src/hand-gate.js";

afterEach(() => vi.restoreAllMocks());

describe("HandGate causal boundaries", () => {
  it("coalesces three marks of one title and settles all three at a boundary", async () => {
    const gate = new HandGate();
    const flush = vi.fn(async () => {});
    const settled = [gate.mark("A", flush), gate.mark("A", flush), gate.mark("A", flush)];
    expect(flush).not.toHaveBeenCalled();
    await gate.boundary();
    await expect(Promise.all(settled)).resolves.toEqual([undefined, undefined, undefined]);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("keeps two titles separate while one boundary carries both", async () => {
    const gate = new HandGate();
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    const marks = [gate.mark("A", a), gate.mark("B", b)];
    await gate.boundary();
    await Promise.all(marks);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("flushes on the eighth mark without a boundary and leaves seven resting", async () => {
    const gate = new HandGate();
    const flush = vi.fn(async () => {});
    const marks = Array.from({ length: 7 }, () => gate.mark("A", flush));
    expect(flush).not.toHaveBeenCalled();
    marks.push(gate.mark("A", flush));
    await Promise.all(marks);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("consumes act members and flushes remaining entries at teardown", async () => {
    const gate = new HandGate();
    const a = vi.fn(async () => {});
    const b = vi.fn(async () => {});
    const first = gate.mark("A", a);
    const second = gate.mark("B", b);
    gate.consume(["A"]).settle();
    await first;
    expect(a).not.toHaveBeenCalled();
    await gate.flushAll();
    await second;
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("settles only the faulting entry's waiters when a boundary flush fails", async () => {
    const gate = new HandGate();
    const fault = new Error("store refused");
    const bad = gate.mark("bad", async () => { throw fault; });
    const good = gate.mark("good", async () => {});
    await expect(gate.boundary()).rejects.toBe(fault);
    await expect(bad).rejects.toBe(fault);
    await expect(good).resolves.toBeUndefined();
  });

  it("never asks a clock while marking, crossing a boundary, acting, capping or tearing down", async () => {
    const clockFault = () => { throw new Error("clock consulted"); };
    vi.spyOn(globalThis, "setTimeout").mockImplementation(clockFault as typeof setTimeout);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(clockFault as typeof clearTimeout);
    vi.spyOn(Date, "now").mockImplementation(clockFault);
    vi.spyOn(performance, "now").mockImplementation(clockFault);
    // Known positive: this instrument catches the pre-change gate's timer arm.
    expect(() => { setTimeout(() => {}, 1); }).toThrow("clock consulted");
    const gate = new HandGate();
    const a = gate.mark("A", async () => {});
    const joined = gate.mark("A", async () => {});
    await gate.boundary();
    await Promise.all([a, joined]);
    const consumed = gate.mark("B", async () => {});
    gate.consume(["B"]).settle();
    await consumed;
    await Promise.all(Array.from({ length: 8 }, () => gate.mark("C", async () => {})));
    const last = gate.mark("D", async () => {});
    await gate.flushAll();
    await last;
  });
});
