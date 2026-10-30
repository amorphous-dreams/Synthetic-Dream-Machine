/**
 * L3 · HELP AND REFUSAL RENDER FROM ONE SOURCE: `--help` prints exactly the lines a refusal prints.
 *
 * Both halves run through the real dispatcher. Inputs: every key in the live help registry (a door, or
 * a `"<door> <sub>"` sub-door) for `--help`; and for the refusal, every door whose source refuses
 * through `refuseUsage(…, helpLines(door))`, read from the command sources, plus the tunnel doors.
 * Each door runs under a scratch LAR_ROOT and HOME, so a door that reads an unknown word as an
 * argument reaches nothing of the operator's. Control: two doors render different bytes, and a
 * refusal that drops its menu reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L3
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { helpLines } from "../../src/command-help.js";
import { door, helpKeys, UNKNOWN, verbTables } from "./harness.js";

const SRC = join(import.meta.dirname, "..", "..", "src", "commands");

/** The doors whose source refuses with the registry's lines, read from the command sources. */
function refusingDoors(): string[] {
  const found = new Set<string>();
  for (const f of readdirSync(SRC)) {
    if (!f.endsWith(".ts")) continue;
    for (const m of readFileSync(join(SRC, f), "utf8").matchAll(/refuseUsage\(args, "([a-z -]+)", helpLines\("\1"\)/g)) found.add(m[1]!);
  }
  for (const { door: d } of verbTables()) if (d !== "vessel") found.add(d);
  return [...found].sort();
}

/** A refusal reads true when it exits 2 and its stderr ends with the door's lines. */
const refusalCarries = (r: { code: number; err: string }, key: string): boolean =>
  r.code === 2 && r.err.trimEnd().endsWith(helpLines(key).join("\n").trimEnd());

const saved: Record<string, string | undefined> = {};
let scratch = "";
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "law-l3-"));
  for (const k of ["LAR_ROOT", "HOME", "XDG_STATE_HOME"]) saved[k] = process.env[k];
  process.env["LAR_ROOT"] = join(scratch, "root");
  process.env["HOME"] = join(scratch, "home");
  process.env["XDG_STATE_HOME"] = join(scratch, "state");
});
afterAll(() => {
  for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  rmSync(scratch, { recursive: true, force: true });
});

describe("L3 · help and refusal render the same bytes", () => {
  test.each(helpKeys().map((k) => [k]))("`%s --help` at the door prints exactly the registry's lines", async (key) => {
    const r = await door([...key.split(" "), "--help"]);
    expect(r.code).toBe(0);
    expect(r.out.trimEnd()).toBe(helpLines(key).join("\n").trimEnd());
  });

  test.each(refusingDoors().map((k) => [k]))("`%s` refuses an unknown verb with the same lines, exit 2", async (key) => {
    const r = await door([...key.split(" "), UNKNOWN, "--no-json"]);
    expect(refusalCarries(r, key)).toBe(true);
  });

  test.each(helpKeys().map((k) => [k]))("`%s`: the lines lead with its usage spine", (key) => {
    expect(helpLines(key)[0]).toMatch(new RegExp(`^usage: lares ${key}`));
  });

  test("the source scan finds the refusing doors, and each names a registry key", () => {
    const doors = refusingDoors();
    expect(doors.length).toBeGreaterThan(10);
    expect(doors.filter((d) => !helpKeys().includes(d))).toEqual([]);
  });

  test("seed: library's lines keep its verbs", () => {
    expect(helpLines("library").join("\n")).toContain("acquire");
  });

  test("CONTROL: two doors render different bytes; a refusal that drops its menu, or exits clean, reads red", async () => {
    const [a, b] = helpKeys();
    expect((await door([a!, "--help"])).out).not.toBe((await door([b!, "--help"])).out);
    const lines = helpLines("library").join("\n");
    expect(refusalCarries({ code: 2, err: `lares library: unknown sub-verb "x"\n${lines}` }, "library")).toBe(true);
    expect(refusalCarries({ code: 2, err: 'lares library: unknown sub-verb "x"' }, "library")).toBe(false);
    expect(refusalCarries({ code: 0, err: lines }, "library")).toBe(false);
  });
});
