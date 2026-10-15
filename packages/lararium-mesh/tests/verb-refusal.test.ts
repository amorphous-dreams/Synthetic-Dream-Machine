import { describe, test, expect } from "vitest";
import { VerbRefusal, isVerbRefusal } from "../src/verb-refusal.js";

describe("VerbRefusal", () => {
  test("a VerbRefusal carries its machine reason and its human message", () => {
    const err = new VerbRefusal("bag-retired", "the bag takes no writes");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("VerbRefusal");
    expect(err.reason).toBe("bag-retired");
    expect(err.message).toBe("the bag takes no writes");
    expect(isVerbRefusal(err)).toBe(true);
  });

  test("a structural twin from another realm reads as a refusal", () => {
    const twin = Object.assign(new Error("m"), { name: "VerbRefusal", reason: "bag-retired" });
    expect(isVerbRefusal(twin)).toBe(true);
  });

  test("control: a plain Error, a nameless reason and a non-error read as no refusal", () => {
    expect(isVerbRefusal(new Error("bag-retired: x"))).toBe(false);
    expect(isVerbRefusal(Object.assign(new Error("m"), { name: "VerbRefusal" }))).toBe(false);
    expect(isVerbRefusal(Object.assign(new Error("m"), { name: "VerbRefusal", reason: 3 }))).toBe(false);
    expect(isVerbRefusal(null)).toBe(false);
    expect(isVerbRefusal("VerbRefusal")).toBe(false);
  });
});
