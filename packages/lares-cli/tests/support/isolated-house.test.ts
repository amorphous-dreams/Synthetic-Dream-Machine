import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { openIsolatedHouse } from "./isolated-house.js";

afterEach(() => vi.unstubAllEnvs());

test.each([undefined, "", "outer value"])("restores each owned key to %j even when the case changes it", (prior) => {
  for (const key of ["LAR_ROOT", "HOME", "GIT_CONFIG_GLOBAL"]) vi.stubEnv(key, prior);
  const house = openIsolatedHouse({ home: true, gitConfig: true });
  try {
    expect(process.env["LAR_ROOT"]).toBe(house.root);
    expect(process.env["HOME"]).toBe(house.home);
    expect(existsSync(house.home!)).toBe(true);
    const config = process.env["GIT_CONFIG_GLOBAL"]!;
    expect(dirname(config)).toBe(house.scratchDir);
    expect(existsSync(config)).toBe(false);

    delete process.env["HOME"];
    process.env["LAR_ROOT"] = "moved";
    process.env["GIT_CONFIG_GLOBAL"] = "moved";
  } finally {
    house.close();
  }
  for (const key of ["LAR_ROOT", "HOME", "GIT_CONFIG_GLOBAL"]) expect(process.env[key]).toBe(prior);
  expect(existsSync(house.scratchDir)).toBe(false);
});

test("a root-only house nested inside another gives the outer house back intact", () => {
  const outer = openIsolatedHouse({ home: true, gitConfig: true });
  try {
    const outerConfig = process.env["GIT_CONFIG_GLOBAL"];
    const inner = openIsolatedHouse();
    try {
      expect(process.env["LAR_ROOT"]).toBe(inner.root);
      expect(inner.root).not.toBe(outer.root);
      expect(process.env["HOME"]).toBe(outer.home);
      expect(process.env["GIT_CONFIG_GLOBAL"]).toBe(outerConfig);
    } finally {
      inner.close();
    }
    expect(process.env["LAR_ROOT"]).toBe(outer.root);
    expect(existsSync(outer.root)).toBe(true);
  } finally {
    outer.close();
  }
});
