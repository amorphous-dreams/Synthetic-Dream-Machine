/**
 * surface-help — `lares surface` stands in the command table with its own help entries, one per sub-door, and the
 * top-level list keeps its 66-line ceiling (help-flags.test.ts reads every row).
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { COMMANDS, dispatch } from "../src/bin/lares.js";
import { COMMAND_HELP } from "../src/command-help.js";

async function run(argv: string[]): Promise<{ code: number; out: string }> {
  const out: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  return { code: await dispatch(argv), out: out.join("\n") };
}
afterEach(() => vi.restoreAllMocks());

describe("lares surface help", () => {
  test("the command table holds `surface`, reading --face, --launch and --message", () => {
    const row = COMMANDS.find((c) => c.name === "surface");
    expect(row).toBeDefined();
    for (const f of ["face", "launch", "message"]) expect(row!.accepts).toContain(f);
  });

  test.each(["surface", "surface init", "surface check", "surface open", "surface commit"])("%s keeps a help entry with examples", (door) => {
    const entry = COMMAND_HELP[door];
    expect(entry, door).toBeDefined();
    expect(entry!.examples.length).toBeGreaterThan(0);
    expect(entry!.examples.every((e) => e.startsWith("lares surface"))).toBe(true);
  });

  test("`lares surface commit --help` reads the sub-door's own entry", async () => {
    const r = await run(["surface", "commit", "--help"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("lar:///surface.keeps.the-sitting/");
  });

  test("★ the top-level list stays within 66 lines with `surface` named ★", async () => {
    const r = await run(["help"]);
    expect(r.out.split("\n").length).toBeLessThanOrEqual(66);
    expect(r.out).toMatch(/^\s+surface\s/m);
  });
});
