import { describe, expect, test } from "vitest";
import { durabilityCovers, validateDurabilityReceipt } from "../src/durability-receipt.js";

describe("durability receipt", () => {
  test("accepts and freezes the exact stored fence", () => {
    const heads = ["h1", "h2"];
    const receipt = validateDurabilityReceipt({ docUrl: "automerge:one", heads, ownerEpoch: "owner" });
    expect(receipt).not.toBeNull();
    heads.push("h3");
    expect(receipt?.heads).toEqual(["h1", "h2"]);
    expect(Object.isFrozen(receipt?.heads)).toBe(true);
    expect(durabilityCovers(receipt!, ["h2"])).toBe(true);
    expect(durabilityCovers(receipt!, ["h3"])).toBe(false);
  });
  test("rejects a smuggled clock or a throwing getter", () => {
    expect(validateDurabilityReceipt({ docUrl: "doc", heads: ["h"], ownerEpoch: "o", timestamp: "2026-01-01" })).toBeNull();
    expect(validateDurabilityReceipt({ get docUrl() { throw Error("trap"); }, heads: ["h"], ownerEpoch: "o" })).toBeNull();
    expect(validateDurabilityReceipt({ docUrl: "doc", heads: [], ownerEpoch: "o" })).toBeNull();
  });
});
