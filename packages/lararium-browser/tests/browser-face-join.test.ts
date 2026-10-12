import { describe, expect, test } from "vitest";
import { requireAdmittedFaceIsland } from "../src/browser-walk.js";

describe("admitted browser face binding", () => {
  test("CONTROL: a node-carried island scope binds the browser to that face's island", () => {
    expect(() => requireAdmittedFaceIsland({ hearthIslandKind: "anchor", hearthIslandScope: "gate-key" }))
      .not.toThrow();
  });

  test("a missing resolved island refuses before the browser derives a private island", () => {
    expect(() => requireAdmittedFaceIsland({ hearthIslandKind: undefined, hearthIslandScope: undefined }))
      .toThrow("[face-join] admission lacks the hearth's resolved island kind and scope");
    expect(() => requireAdmittedFaceIsland({ hearthIslandKind: "anchor", hearthIslandScope: undefined }))
      .toThrow("[face-join] admission lacks the hearth's resolved island kind and scope");
  });
});
