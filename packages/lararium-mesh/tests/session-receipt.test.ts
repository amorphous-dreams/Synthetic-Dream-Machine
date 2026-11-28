import { describe, expect, test } from "vitest";
import { renderSessionReceipt, validateSessionReceipt } from "../src/session-receipt.js";

describe("session receipt", () => {
  const base = { requestId: "r1", action: "load", face: "proof-a",
    position: { ownerEpoch: "owner" } };
  test("renders each required line without a clock", () => {
    for (const state of ["pending", "unknown", "done"] as const) {
      const receipt = validateSessionReceipt({ ...base, state });
      expect(receipt).not.toBeNull();
      const lines = renderSessionReceipt(receipt!);
      expect(lines).toHaveLength(5);
      expect(lines[0]).toContain("r1");
      expect(lines[1]).toContain("load");
      expect(lines[2]).toContain("proof-a");
      expect(lines[3]).toContain(state);
      expect(lines[4]).toContain("owner epoch owner");
      expect(lines.join(" ")).not.toMatch(/\d{4}-\d\d-\d\dT|\b1\d{12}\b/);
    }
  });
  test("refuses a second epoch beside the owner epoch: one name, one relation", () => {
    expect(validateSessionReceipt({ ...base, state: "pending", position: { ...base.position, epoch: 2 } })).toBeNull();
  });
  test("refuses extra clock fields", () => {
    expect(validateSessionReceipt({ ...base, state: "pending", timestamp: "2026-01-01" })).toBeNull();
    expect(validateSessionReceipt({ ...base, state: "done", position: { ...base.position, durable:
      { docUrl: "doc", heads: ["h"], ownerEpoch: "owner", timestamp: "2026-01-01" } } })).toBeNull();
  });
  test("the receipt holds the states the door's memory answers, and no seq, interruption or eviction", () => {
    for (const state of ["interrupted", "evicted"]) expect(validateSessionReceipt({ ...base, state })).toBeNull();
    expect(validateSessionReceipt({ ...base, state: "pending", position: { ownerEpoch: "owner", seq: 3 } })).toBeNull();
    expect(validateSessionReceipt({ ...base, state: "abandoned" })).not.toBeNull();
  });
});
