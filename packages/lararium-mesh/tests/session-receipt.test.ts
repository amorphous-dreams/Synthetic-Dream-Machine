import { describe, expect, test } from "vitest";
import { renderSessionReceipt, validateSessionReceipt } from "../src/session-receipt.js";
import { buildReceiptFact, parseReceiptFact } from "../src/verb-tiddler.js";

describe("session receipt", () => {
  const base = { requestId: "r1", action: "load", face: "proof-a",
    position: { ownerEpoch: "owner", bootEpoch: 2, seq: 3 } };
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
      expect(lines[4]).toContain("owner epoch owner; boot epoch 2; fence 3");
      expect(lines.join(" ")).not.toMatch(/\d{4}-\d\d-\d\dT|\b1\d{12}\b/);
    }
  });
  test("refuses extra clock fields", () => {
    expect(validateSessionReceipt({ ...base, state: "pending", timestamp: "2026-01-01" })).toBeNull();
    expect(validateSessionReceipt({ ...base, state: "done", position: { ...base.position, durable:
      { docUrl: "doc", heads: ["h"], ownerEpoch: "owner", timestamp: "2026-01-01" } } })).toBeNull();
  });
  test("fact fields carry face and action; eviction keeps both", () => {
    const fact = buildReceiptFact({ requestId: "r", state: "committed", seq: 1, bootEpoch: 2,
      inputDigest: "digest", face: "proof-a", action: "load" });
    expect(parseReceiptFact(fact.tiddler as Record<string, unknown>)).toMatchObject({ face: "proof-a", action: "load" });
    expect(parseReceiptFact({ ...fact.tiddler, face: 1 })).toBeNull();
    expect(parseReceiptFact({ ...fact.tiddler, action: "" })).toBeNull();
    const evicted = buildReceiptFact({ requestId: "r", state: "evicted", seq: 1, inputDigest: "digest",
      face: "proof-a", action: "load" });
    expect(parseReceiptFact(evicted.tiddler as Record<string, unknown>)).toMatchObject({ face: "proof-a", action: "load", state: "evicted" });
  });
});
