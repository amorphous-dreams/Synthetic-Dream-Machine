/**
 * scratch-fixture — the one scratch root every node suite takes, and the leak it refuses.
 *
 * RED: a test that moves LAR_ROOT, HOME or GIT_CONFIG_GLOBAL and forgets to put it back reads red at the close,
 * naming the key. The fixture twin (a test that restores) stays green, and the env the fixture set reads right
 * inside the test.
 *
 * ONE FIXTURE: the lares-cli suites take this file too (their `isolated-house` folded in), so it carries the union of
 * both contracts: HOME may stand outside the scratch (`home: false`), the global git config may read empty (the
 * default) or stand private and writable inside the scratch (`gitConfig: "private"`), every prior value comes back
 * exactly (unset stays unset, empty stays empty), a nested scratch gives the outer one back intact, and a second close
 * reads as a no-op.
 */
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
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

/** Run `fn` over an env where each owned key stands at `prior` (undefined: unset), then put the fixture's values back. */
function overPrior(prior: string | undefined, fn: () => void): void {
  const held = KEYS.map((k) => process.env[k]);
  for (const k of KEYS) { if (prior === undefined) delete process.env[k]; else process.env[k] = prior; }
  try { fn(); } finally { KEYS.forEach((k, i) => { process.env[k] = held[i]!; }); }
}

describe("the one fixture: the union both packages take", () => {
  test.each([undefined, "", "outer value"])("every owned key comes back to %j exactly, with a private config and a home", (prior) => {
    overPrior(prior, () => {
      const s = openScratch({ gitConfig: "private" });
      expect(process.env["LAR_ROOT"]).toBe(s.root);
      expect(process.env["HOME"]).toBe(s.home);
      closeScratch(s);
      for (const k of KEYS) expect(process.env[k], k).toBe(prior);
      if (prior === undefined) for (const k of KEYS) expect(k in process.env, k).toBe(false);
    });
  });

  test("a private config stands inside the scratch, unwritten until a test writes it, and leaves with it", () => {
    const s = openScratch({ gitConfig: "private" });
    let config = "";
    try {
      config = process.env[KEYS[2]]!;
      expect(config).not.toBe("/dev/null");
      expect(dirname(config)).toBe(s.home);
      expect(existsSync(config)).toBe(false);
      writeFileSync(config, "[user]\n\tname = scratch\n");
    } finally { closeScratch(s); }
    expect(existsSync(config)).toBe(false);
  });

  test("home: false leaves HOME to the enclosing env and owns only the root and the config", () => {
    const outerHome = process.env["HOME"];
    const s = openScratch({ home: false });
    try {
      expect(process.env["HOME"]).toBe(outerHome);
      expect(process.env["LAR_ROOT"]).toBe(s.root);
      expect(process.env[KEYS[2]]).toBe("/dev/null");
      process.env["HOME"] = "/a/home/the/scratch/never/owned"; // HOME stands outside the scratch: no leak to report
    } finally {
      try { closeScratch(s); } finally { process.env["HOME"] = outerHome!; }
    }
    expect(existsSync(s.root)).toBe(false);
  });

  test("an unset HOME stays unset under a scratch that does not own it", () => {
    const outerHome = process.env["HOME"];
    delete process.env["HOME"];
    try {
      closeScratch(openScratch({ home: false }));
      expect("HOME" in process.env).toBe(false);
    } finally { process.env["HOME"] = outerHome!; }
  });

  test("a nested scratch gives the outer one back intact: env, live bindings and directories", ({ scratch }) => {
    const inner = openScratch({ home: false });
    expect(process.env["LAR_ROOT"]).toBe(inner.root);
    expect(process.env["HOME"]).toBe(scratch.home);
    expect(scratchRoot).toBe(inner.root);
    closeScratch(inner);
    expect(process.env["LAR_ROOT"]).toBe(scratch.root);
    expect(process.env["HOME"]).toBe(scratch.home);
    expect(scratchRoot).toBe(scratch.root);
    expect(scratchHome).toBe(scratch.home);
    expect(existsSync(scratch.root) && existsSync(scratch.home)).toBe(true);
  });

  test("a second close reads as a no-op: no leak reported, the env the first close restored left standing", () => {
    const s = openScratch();
    closeScratch(s);
    const after = KEYS.map((k) => process.env[k]);
    expect(() => closeScratch(s)).not.toThrow();
    expect(KEYS.map((k) => process.env[k])).toEqual(after);
  });
});
