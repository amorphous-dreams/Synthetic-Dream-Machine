/**
 * `-h` AND `--help` BOTH ASK FOR HELP (clig.dev): bare `lares --help` / `lares -h` print what `lares help` prints
 * and exit 0; `lares <verb> --help|-h` print that verb's own help; an unknown name still refuses by name.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch, COMMANDS } from "../src/bin/lares.js";

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []; const err: string[] = [];
  const lo = vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  const le = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  try { const code = await dispatch(argv); return { code, out: out.join("\n"), err: err.join("\n") }; }
  finally { lo.mockRestore(); le.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe("help flags", () => {
  test("★ --help and -h print the same text as `help`, exit 0 ★", async () => {
    const base = await run(["help"]);
    expect(base.code).toBe(0);
    for (const flag of ["--help", "-h"]) {
      const r = await run([flag]);
      expect(r.code, r.err).toBe(0);
      expect(r.out).toBe(base.out);
      expect(r.err).toBe("");
    }
  });
  test("a verb's --help and -h print its own help", async () => {
    const long = await run(["bag", "--help"]);
    const short = await run(["bag", "-h"]);
    expect(long.code).toBe(0);
    expect(short.code).toBe(0);
    expect(short.out).toBe(long.out);
    expect(long.out).not.toContain("Commands:");
  });
  test("CONTROL: an unknown command still refuses by name", async () => {
    for (const argv of [["nope"], ["nope", "--help"], ["nope", "-h"]]) {
      const r = await run(argv);
      expect(r.code).toBe(2);
      expect(r.err).toContain('unknown command "nope"');
    }
  });

  test("★ the top-level list reads as the first rung of progressive display: one line per door, every verb named once ★", async () => {
    // The width law lives at the carrier (a role holds 72 characters or fewer, api/pono/affordance), and depth unfolds per door
    // (`lares <door> --help`, then a slot, then the whole), so the list names each door on one line and caps no terminal width.
    const r = await run(["help"]);
    for (const c of COMMANDS) {
      const rows = r.out.split("\n").filter((l) => new RegExp(`^\\s+(✍ )?${c.name}\\s`).test(l));
      expect(rows.length, c.name).toBe(1);
    }
  });

  test("the bundle verbs name the roster sealed under the keep key, never a cleartext bundle (bundle-manifest.ts)", () => {
    for (const name of ["export", "rite"]) {
      const c = COMMANDS.find((x) => x.name === name)!;
      expect(c.summary, name).not.toMatch(/cleartext/i);
      expect(c.summary, name).toMatch(/sealed under the (house's )?keep key/);
    }
  });

  test("★ the footer promise holds: every verb's --help and -h exit 0 and carry its long account ★", async () => {
    for (const c of COMMANDS) {
      const long = await run([c.name, "--help"]);
      const short = await run([c.name, "-h"]);
      expect(long.code, `${c.name}: ${long.err}`).toBe(0);
      expect(short.out).toBe(long.out);
      expect(long.out.replace(/\s+/g, " "), c.name).toContain(c.summary.replace(/\s+/g, " "));
    }
  });
});
