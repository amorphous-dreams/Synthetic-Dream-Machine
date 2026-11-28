/**
 * L1 · AN UNKNOWN DOOR, VERB OR FLAG REFUSES BY NAME, EXIT 2, BEFORE ANY HANDLER RUNS.
 *
 * Inputs: every live command crossed with a dash flag; every declared verb table crossed with an
 * unknown verb; an unknown top-level name, bare and through `lares help`. Seeds: the literal cases fixed bugs
 * left (an unknown param, a retired door). Control: a declared param and a live door never refuse.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L1
 */
import { describe, expect, test } from "vitest";
import { UNKNOWN, commands, door, flagReadingCommands, verbTables } from "./harness.js";

describe("L1 · an unknown door, verb or flag refuses by name, exit 2", () => {
  test.each(flagReadingCommands().map((c) => [c.name]))("`%s --unknown` refuses `dash-flag-burned`, naming the door's help", async (name) => {
    const r = await door([name, `--${UNKNOWN}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("dash-flag-burned");
    expect(r.err).toContain(`lares help ${name}`);
  });

  // A pass-through door hands an unknown word to another program's grammar, whose own parser owns that exit (`mempalace`).
  const passes = new Set(commands().filter((c) => c.passesThrough !== undefined).map((c) => c.name));
  test.each(verbTables().filter((t) => !passes.has(t.door.split(" ")[0]!)).map((t) => [t.door]))("`%s <unknown verb>` refuses with exit 2", async (name) => {
    expect((await door([name, UNKNOWN])).code).toBe(2);
  });

  test("an unknown top-level name refuses, bare and through `lares help`", async () => {
    expect((await door([UNKNOWN])).code).toBe(2);
    expect((await door(["help", UNKNOWN])).code).toBe(2);
  });

  describe("seeds: the literal cases fixed bugs left", () => {
    test.each([
      ["an unknown param", ["repo", "read", `${UNKNOWN}=1`]],
      ["a retired door", ["cleanup-days"]],
      ["a retired sub-door", ["vessel", "wire"]],
      ["a retired posture", ["vessel", "stand", "install=true"]],
      ["a sub-verb a read never answers", ["vessel", "read", "sensorium"]],
    ])("%s refuses with exit 2, naming what it refused", async (_why, argv) => {
      const r = await door(argv);
      expect(r.code).toBe(2);
      expect(`${r.err}\n${r.out}`).toContain(argv.at(-1)!.replace(/=.*$/, ""));
    });
  });

  describe("CONTROL: a live door answers, so the law can tell a refusal from a door", () => {
    test("a live door's help renders and returns 0", async () => {
      expect((await door(["help", "vessel"])).code).toBe(0);
      expect((await door(["help", "repo"])).code).toBe(0);
    });
    test("a declared param never reads as unknown", async () => {
      const r = await door(["repo", "read", "brief=true"]);
      expect(r.err).not.toMatch(/unknown param/i);
    });
  });
});
