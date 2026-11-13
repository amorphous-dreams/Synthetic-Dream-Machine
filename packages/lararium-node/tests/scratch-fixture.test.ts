/**
 * scratch-fixture — the one scratch root every node suite takes, and the leak it refuses.
 *
 * RED: a test that moves LAR_ROOT, HOME or GIT_CONFIG_GLOBAL and forgets to put it back reads red at the close,
 * naming the key. The fixture twin (a test that restores) stays green, and the env the fixture set reads right
 * inside the test.
 */
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect } from "vitest";
import { closeScratch, openScratch, ScratchEnvLeak, scratchHome, scratchRoot, test } from "./support/scratch-fixture.js";

const KEYS = ["LAR_ROOT", "HOME", "GIT_CONFIG_GLOBAL"] as const;

describe("the scratch fixture", () => {
  test("TWIN: the env the fixture set reads right inside the test", ({ scratch }) => {
    expect(process.env["LAR_ROOT"]).toBe(scratch.root);
    expect(process.env["HOME"]).toBe(scratch.home);
    expect(process.env["GIT_CONFIG_GLOBAL"]).toBe("/dev/null");
    expect(scratchRoot).toBe(scratch.root);
    expect(scratchHome).toBe(scratch.home);
    expect(scratch.root.startsWith(tmpdir())).toBe(true);
    expect(existsSync(scratch.root) && existsSync(scratch.home)).toBe(true);
  });

  test("a close removes both directories and gives every prior value back", () => {
    const before = KEYS.map((k) => process.env[k]);
    const s = openScratch("lares-fixture-twin-");
    closeScratch(s);
    expect(existsSync(s.root) || existsSync(s.home)).toBe(false);
    expect(KEYS.map((k) => process.env[k])).toEqual(before);
  });

  test("a prior key that stood unset comes back unset, never the string \"undefined\"", () => {
    // Inside the auto fixture all three keys stand set; open a second scratch over an env with one key removed.
    const held = process.env["LAR_ROOT"];
    delete process.env["LAR_ROOT"];
    const s = openScratch("lares-fixture-unset-");
    closeScratch(s);
    expect("LAR_ROOT" in process.env).toBe(false);
    process.env["LAR_ROOT"] = held!;
  });

  test.each(KEYS)("RED: a test that leaves %s moved fails by name, and the next test reads the restored value", (key) => {
    const before = process.env[key];
    const s = openScratch("lares-fixture-leak-");
    process.env[key] = "/somewhere/else"; // the leak: moved, never put back
    let thrown: unknown;
    try { closeScratch(s); } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(ScratchEnvLeak);
    expect((thrown as ScratchEnvLeak).key).toBe(key);
    expect(process.env[key], "the close restored the prior value before it reported").toBe(before);
    expect(existsSync(s.root)).toBe(false);
  });
});
