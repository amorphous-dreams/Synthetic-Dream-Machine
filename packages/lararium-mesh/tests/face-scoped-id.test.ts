import { describe, expect, test } from "vitest";
import { FaceScopedIdError, faceScopedId } from "../src/face-scoped-id.js";

describe("face scoped ids", () => {
  test("the same subject and id have one stable namespace", () => {
    expect(faceScopedId("proof-a", "request")).toBe(faceScopedId("proof-a", "request"));
    expect(faceScopedId("proof-a", "request")).toMatch(/^[0-9a-f]{32}-request$/);
    expect(faceScopedId("proof-a", "request")).not.toBe(faceScopedId("proof-b", "request"));
    expect(faceScopedId("proof-a", "request")).not.toBe(faceScopedId("proof-a", "effect"));
  });
  test("empty inputs refuse by name", () => {
    expect(() => faceScopedId("", "id")).toThrow(FaceScopedIdError);
    expect(() => faceScopedId("face", "")).toThrow(FaceScopedIdError);
  });
});
