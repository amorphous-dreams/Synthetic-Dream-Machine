/**
 * L1 · AN UNKNOWN DOOR, VERB OR FLAG REFUSES BY NAME, EXIT 2, BEFORE ANY HANDLER RUNS.
 *
 * Inputs: every live command crossed with an unknown flag; every declared verb table crossed with an
 * unknown verb; an unknown top-level name, bare and under `--help`. Seeds: the literal cases fixed bugs
 * left (an `=` spelling, a retired door). Control: a declared flag and a live door never refuse.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L1
 */
import { describe, expect, test } from "vitest";
import { UNKNOWN, door, flagReadingCommands, verbTables } from "./harness.js";

describe("L1 · an unknown door, verb or flag refuses by name, exit 2", () => {
  test.each(flagReadingCommands().map((c) => [c.name]))("`%s --unknown` refuses, naming the flag and the door", async (name) => {
    const r = await door([name, `--${UNKNOWN}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain(`--${UNKNOWN}`);
    expect(r.err).toContain(`lares ${name}`);
  });

  test.each(verbTables().map((t) => [t.door]))("`%s <unknown verb>` refuses with exit 2", async (name) => {
    expect((await door([name, UNKNOWN])).code).toBe(2);
  });

  test("an unknown top-level name refuses, bare and under --help", async () => {
    expect((await door([UNKNOWN])).code).toBe(2);
    expect((await door([UNKNOWN, "--help"])).code).toBe(2);
  });

  describe("seeds: the literal cases fixed bugs left", () => {
    test.each([
      ["the `=` spelling of an unknown flag", ["repo", "read", `--${UNKNOWN}=1`]],
      ["a retired door", ["cleanup-days"]],
      ["a retired sub-door", ["vessel", "wire"]],
      ["a retired posture", ["vessel", "stand", "--install"]],
      ["a sub-verb a read never answers", ["vessel", "read", "sensorium"]],
    ])("%s refuses with exit 2, naming what it refused", async (_why, argv) => {
      const r = await door(argv);
      expect(r.code).toBe(2);
      expect(`${r.err}\n${r.out}`).toContain(argv.at(-1)!.replace(/=.*$/, "").replace(/^--/, ""));
    });
  });

  describe("CONTROL: a live door answers, so the law can tell a refusal from a door", () => {
    test("a live door under --help renders and returns 0", async () => {
      expect((await door(["vessel", "--help"])).code).toBe(0);
      expect((await door(["repo", "--help"])).code).toBe(0);
    });
    test("a declared flag never reads as unknown", async () => {
      const r = await door(["repo", "read", "--brief"]);
      expect(r.err).not.toMatch(/unknown flag/i);
    });
  });
});
