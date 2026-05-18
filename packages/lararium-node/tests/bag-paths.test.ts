import { describe, expect, test } from "vitest";
import { namedBagPath, wikiBagPath } from "../src/bag-paths.js";

describe("namedBagPath", () => {
  test("maps bare canon @lares titles into the @lares mirror", () => {
    const toRelPath = namedBagPath("@lares");

    expect(toRelPath("lar:///ha.ka.ba/docs/lares/the-lares-protocols")).toBe("docs/lares/the-lares-protocols.md");
    expect(toRelPath("lar:///ha.ka.ba/docs/lares/the-lares-protocols#thesis")).toBe("docs/lares/the-lares-protocols/thesis.md");
  });

  test("still maps explicit scoped @lares titles", () => {
    const toRelPath = namedBagPath("@lares");

    expect(toRelPath("lar:///ha.ka.ba/@lares/api/v0.1/mu")).toBe("api/v0.1/mu.md");
  });

  test("rejects @lararium titles for the @lares mirror", () => {
    const toRelPath = namedBagPath("@lares");

    expect(toRelPath("lar:///ha.ka.ba/@lararium/tw5/modules/lar-promote")).toBeNull();
  });
});

describe("wikiBagPath", () => {
  test("maps bare ha.ka.ba titles into the lares wiki shadow tree", () => {
    const toRelPath = wikiBagPath();

    expect(toRelPath("lar:///ha.ka.ba/docs/lares/the-lares-protocols")).toBe("lares/docs/lares/the-lares-protocols.md");
    expect(toRelPath("lar:///ha.ka.ba/docs/lares/the-lares-protocols#thesis")).toBe("lares/docs/lares/the-lares-protocols/thesis.md");
  });
});