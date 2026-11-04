import { describe, expect, it, vi } from "vitest";
import { HandGate } from "../src/hand-gate.js";

describe("HandGate shared waiters", () => {
  it("shares one promise across held marks and resolves every caller on flush", async () => {
    const gate = new HandGate();
    const flush = vi.fn(async () => {});
    const promises = Array.from({ length: 50 }, () => gate.mark("draft", flush, true));
    expect(new Set(promises).size).toBe(1);
    expect(flush).not.toHaveBeenCalled();
    await gate.flush("draft");
    await expect(Promise.all(promises)).resolves.toHaveLength(50);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("rejects every held caller when a flush fails", async () => {
    const gate = new HandGate();
    const fault = new Error("flush failed");
    const flush = vi.fn(async () => { throw fault; });
    const promises = Array.from({ length: 50 }, () => gate.mark("draft", flush, true));
    const results = Promise.allSettled(promises);
    expect(new Set(promises).size).toBe(1);
    await expect(gate.flush("draft")).rejects.toBe(fault);
    expect(await results).toEqual(Array.from({ length: 50 }, () => ({ status: "rejected", reason: fault })));
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("counts every ordinary mark toward the eight-mark cap", async () => {
    const gate = new HandGate();
    const flush = vi.fn(async () => {});
    const promises = Array.from({ length: 7 }, () => gate.mark("title", flush));
    expect(flush).not.toHaveBeenCalled();
    promises.push(gate.mark("title", flush));
    expect(flush).toHaveBeenCalledTimes(1);
    await Promise.all(promises);
  });
});
