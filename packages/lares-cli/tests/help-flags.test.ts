/**
 * ONE HELP SPELLING: `lares help` lists every door and exits 0; `lares help <door>` prints that door's own help; a dash
 * spelling (`--help`) refuses `dash-flag-burned`, naming `lares help`; an unknown name still refuses by name.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { dispatch, COMMANDS } from "../src/bin/lares.js";
import { helpLines } from "../src/command-help.js";

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []; const err: string[] = [];
  const lo = vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
  const le = vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
  try { const code = await dispatch(argv); return { code, out: out.join("\n"), err: err.join("\n") }; }
  finally { lo.mockRestore(); le.mockRestore(); }
}
afterEach(() => vi.restoreAllMocks());

describe("help flags", () => {
  test("★ `help` prints the door list and exits 0; a dash spelling refuses, naming `lares help` ★", async () => {
    const base = await run(["help"]);
    expect(base.code).toBe(0);
    expect(base.err).toBe("");
    const dash = await run(["--help"]);
    expect(dash.code).toBe(2);
    expect(dash.out).toBe("");
    expect(dash.err).toContain("dash-flag-burned: dash flags burned; params ride as name=value (lares help)");
  });
  test("`lares help <door>` prints its own help; `lares <door> --help` refuses, naming it", async () => {
    const own = await run(["help", "bag"]);
    expect(own.code).toBe(0);
    expect(own.out).not.toContain("Commands:");
    const dash = await run(["bag", "--help"]);
    expect(dash.code).toBe(2);
    expect(dash.err).toContain("(lares help bag)");
  });
  test("CONTROL: an unknown command still refuses by name, through the help door too", async () => {
    for (const argv of [["nope"], ["help", "nope"]]) {
      const r = await run(argv);
      expect(r.code).toBe(2);
      expect(r.err).toContain('unknown command "nope"');
    }
  });

  test("★ the top-level list reads as the first rung of progressive display: one line per door, every verb named once ★", async () => {
    // The width law lives at the carrier (a role holds 72 characters or fewer, api/pono/affordance), and depth unfolds per door
    // (`lares help <door>`, then a slot, then the whole), so the list names each door on one line and caps no terminal width.
    const r = await run(["help"]);
    for (const c of COMMANDS) {
      const rows = r.out.split("\n").filter((l) => new RegExp(`^\\s+(✍ )?${c.name}\\s`).test(l));
      expect(rows.length, c.name).toBe(1);
    }
  });

  test("the bundle verbs name the roster sealed under the keep key, never a cleartext bundle (bundle-manifest.ts)", () => {
    // `rite` flipped to its carriers (comms landings 10 + 23): the keep verb's carrier carries the words.
    for (const [name, text] of [["export", COMMANDS.find((x) => x.name === "export")!.summary], ["rite keep", helpLines("rite keep").join(" ")]] as const) {
      expect(text, name).not.toMatch(/cleartext/i);
      expect(text, name).toMatch(/sealed under the (house's )?keep key/);
    }
  });

  test("★ the footer promise holds: every door's `lares help <door>` exits 0 and carries its long account ★", async () => {
    for (const c of COMMANDS) {
      const long = await run(["help", c.name]);
      expect(long.code, `${c.name}: ${long.err}`).toBe(0);
      expect(long.out.replace(/\s+/g, " "), c.name).toContain(c.summary.replace(/\s+/g, " "));
    }
  });
});
