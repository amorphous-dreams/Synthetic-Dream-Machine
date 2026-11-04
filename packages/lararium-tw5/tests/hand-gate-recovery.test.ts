import { expect, it, vi } from "vitest";
import { HandGate } from "../src/hand-gate.js";

it("retains a failed generation and retries its latest state on the next fire", async () => {
  const gate = new HandGate();
  const fault = new Error("refused");
  const flush = vi.fn().mockRejectedValueOnce(fault).mockResolvedValue(undefined);
  const marks = Array.from({ length: 20 }, () => gate.mark("draft", flush, true));
  expect(new Set(marks).size).toBe(1);
  const outcomes = Promise.allSettled(marks);
  await expect(gate.flush("draft")).rejects.toBe(fault);
  expect((await outcomes).every((outcome) => outcome.status === "rejected")).toBe(true);
  expect(gate.has("draft")).toBe(true);
  await gate.flush("draft");
  expect(flush).toHaveBeenCalledTimes(2);
  expect(gate.has("draft")).toBe(false);
});

it("never fires ordinary marks without a causal fire", async () => {
  const gate = new HandGate();
  const flush = vi.fn(async () => {});
  const marks = Array.from({ length: 20 }, () => gate.mark("ordinary", flush));
  expect(flush).not.toHaveBeenCalled();
  await gate.boundary();
  await Promise.all(marks);
});
