/**
 * THE VERB DOOR KEEPS ONE HOME FOR ITS WORDS, AND NAMES THE MEME BEHIND IT.
 *
 * Two homes for one door's help text drift, and the reader never learns which half lies. Measured before
 * this weld stood: TEN command modules hand-rolled a `usage()` text the help registry never held, so
 * `lares <cmd> --help` rendered a one-line dispatch summary while the better words sat unreachable in the
 * same binary. This file fences BOTH directions —
 *
 *   1. a door that carries a `meme` carries a WELL-FORMED `lar:` URI, harvested from the module's own
 *      `Meme:` header (never invented here),
 *   2. a module that still hand-rolls help text names a door the registry ALSO holds — so the words have
 *      one home and the refusal path draws from it.
 *
 * The registry stays PURE DATA: no `node:fs`, no imports, so any vessel that can hold the module can read
 * the door. The `--meme` reach rides the daemon verb rail (`lares meme get`), never a file read.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { COMMAND_HELP, memeForDoor, helpLines, renderCommandHelp } from "../src/command-help.js";
import { COMMAND_NAMES } from "../src/bin/lares.js";

const CLI = join(repoRoot, "packages", "lares-cli", "src");
const CMD_DIR = join(CLI, "commands");

afterEach(() => vi.restoreAllMocks());

/** Every `lar:` URI any command module declares in its own `Meme:` header. The harvest, never an invention. */
function declaredMemes(): Set<string> {
  const out = new Set<string>();
  for (const f of readdirSync(CMD_DIR).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(join(CMD_DIR, f), "utf8");
    for (const m of src.matchAll(/\*\s+Meme:\s+(lar:\/\/\/[^\s·]+)/g)) out.add(m[1]!);
  }
  return out;
}

/** The `lar:` local form: `lar:///t1.t2.t3/path…[#frag]` — the root MUST carry exactly three terms. */
function wellFormed(uri: string): boolean {
  const m = /^lar:\/\/\/([^/#]+)(\/[^#]*)?(#[^\s]+)?$/.exec(uri);
  if (!m) return false;
  return m[1]!.split(".").length === 3 && m[1]!.split(".").every((t) => t.length > 0);
}

describe("★ the help registry names the meme behind each verb door ★", () => {
  test("every `meme` a door carries reads as a well-formed lar: URI", () => {
    const bad = Object.entries(COMMAND_HELP)
      .filter(([, h]) => h.meme !== undefined)
      .filter(([, h]) => !h.meme!.trim() || !wellFormed(h.meme!))
      .map(([k, h]) => `${k} → ${JSON.stringify(h.meme)}`);
    expect(bad, `malformed door memes: ${bad.join(" · ")}`).toEqual([]);
  });

  test("★ every door meme was HARVESTED — each one appears in some module's own `Meme:` header ★", () => {
    const declared = declaredMemes();
    const invented = Object.entries(COMMAND_HELP)
      .filter(([, h]) => h.meme !== undefined)
      .filter(([, h]) => !declared.has(h.meme!))
      .map(([k, h]) => `${k} → ${h.meme}`);
    expect(invented, `door memes no module declares: ${invented.join(" · ")}`).toEqual([]);
  });

  test("CONTROL — the harvest reads real headers, and a made-up URI would FAIL that check", () => {
    const declared = declaredMemes();
    expect(declared.size, "no `Meme:` headers found — the harvest regex reads nothing").toBeGreaterThan(10);
    expect(declared.has("lar:///ha.ka.ba/lares/cli/vessel-door")).toBe(true);
    expect(declared.has("lar:///not.a.header/invented-here")).toBe(false);
  });

  test("CONTROL — the well-formed check refuses a two-term root and a bare word", () => {
    expect(wellFormed("lar:///ha.ka/lares/api/x")).toBe(false);
    expect(wellFormed("vessel-door")).toBe(false);
    expect(wellFormed("lar:///ha.ka.ba/lares/cli/vessel-door")).toBe(true);
    expect(wellFormed("lar:///ha.ka.ba/lararium/mesh/membership-doctrine#the-two-stacks")).toBe(true);
  });

  test("a door with no meme answers `undefined`, never an empty string", () => {
    expect(memeForDoor("vessel")).toBe("lar:///ha.ka.ba/lares/cli/vessel-door");
    expect(memeForDoor("no-such-door")).toBeUndefined();
  });
});

describe("★ ONE HOME for a verb door's words ★", () => {
  /**
   * The doors a module speaks for out of a help text IT holds. A module qualifies only when it BOTH
   * declares a `usage` sink of its own AND carries a literal `usage: lares <door>` spine — a module that
   * merely prints a usage line assembled from the registry names no second home.
   */
  function scanDoors(src: string): string[] {
    if (!/\bfunction usage\(|\bconst USAGE\b/.test(src)) return [];
    return [...src.matchAll(/"usage: lares ([a-z][a-z-]*(?: [a-z][a-z-]*)?)/g)].map((m) => m[1]!);
  }

  function handRolled(): Map<string, string> {
    const out = new Map<string, string>();
    for (const f of readdirSync(CMD_DIR).filter((n) => n.endsWith(".ts"))) {
      for (const door of scanDoors(readFileSync(join(CMD_DIR, f), "utf8"))) out.set(door, f);
    }
    return out;
  }

    test("★ no module hand-rolls help text the registry does not hold ★", () => {
    const split = [...handRolled()]
      .filter(([door]) => !(door in COMMAND_HELP));

    expect(
      split.map(([d, f]) => `${d} (${f})`),
      "these doors keep a SECOND home for their words — migrate the text into COMMAND_HELP",
    ).toEqual([]);
  });

  test("CONTROL — the scanner CATCHES a re-split, and ignores a registry-fed usage sink", () => {
    // A module holding both a `usage` sink and its own spine reads as a second home.
    expect(scanDoors('function usage() {\n  console.error("usage: lares zzz-ghost <a|b>");\n}')).toEqual(["zzz-ghost"]);
    // A module whose sink draws the words from the registry names no door of its own.
    expect(scanDoors('function usage() { return refuseUsage(args, "library", helpLines("library")); }')).toEqual([]);
    // And a spine with no sink beside it (a sub-verb menu inside a handler) never counts.
    expect(scanDoors('console.error("usage: lares bag <pin|unpin>");')).toEqual([]);
  });

  test("every registry key names a live command (a sub-door keys on its parent verb)", () => {
    const live = new Set(COMMAND_NAMES);
    const orphans = Object.keys(COMMAND_HELP).filter((k) => !live.has(k.split(" ")[0]!));
    expect(orphans).toEqual([]);
  });

  test("the refusal path and the help path render the SAME lines", () => {
    const lines = helpLines("library");
    expect(lines[0], "the refusal spine an operator greps for").toMatch(/^usage: lares library/);
    const printed: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { printed.push(a.map(String).join(" ")); });
    renderCommandHelp("library");
    expect(printed.join("\n"), "one home, two channels — the same bytes").toBe(lines.join("\n"));
    expect(lines.join("\n"), "the migrated words survived the move").toContain("acquire");
  });
});

describe("★ `--help --meme` reaches the wiki through the meme rail ★", () => {
  test("a door that names NO meme says so plainly and exits clean", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const errs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { errs.push(a.map(String).join(" ")); });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await dispatch(["raise", "--help", "--meme"]);
    expect(code, "naming no meme is not a failure").toBe(0);
    expect(errs.join("\n")).toMatch(/names no meme/i);
  });

  test("★ a door that names one hands the URI to the meme rail, shaped as `meme get <uri>` ★", async () => {
    const { reachHelpMeme } = await import("../src/help-meme.js");
    const seen: { command: string | null; positional: readonly string[] }[] = [];
    const code = await reachHelpMeme(
      "vessel",
      { command: "vessel", positional: [], options: {}, flags: { help: true, meme: true } },
      async (a) => { seen.push(a); return 0; },
    );
    expect(code).toBe(0);
    expect(seen, "the help path never wrote a second meme reader").toHaveLength(1);
    expect(seen[0]!.command).toBe("meme");
    expect(seen[0]!.positional).toEqual(["get", "lar:///ha.ka.ba/lares/cli/vessel-door"]);
  });

  test("`--json` on the help call rides through to the meme rail; a bare call carries no flag", async () => {
    const { reachHelpMeme } = await import("../src/help-meme.js");
    const seen: { flags: Readonly<Record<string, boolean>> }[] = [];
    const push = async (a: { flags: Readonly<Record<string, boolean>> }) => { seen.push(a); return 0; };
    await reachHelpMeme("vessel", { command: "vessel", positional: [], options: {}, flags: { help: true, meme: true, json: true } }, push);
    await reachHelpMeme("vessel", { command: "vessel", positional: [], options: {}, flags: { help: true, meme: true } }, push);
    expect(seen[0]!.flags).toEqual({ json: true });
    expect(seen[1]!.flags, "CONTROL — nothing invents a --json the operator never typed").toEqual({});
  });

  test("CONTROL — a plain `--help` (no `--meme`) touches the meme rail not at all", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(await dispatch(["vessel", "--help"])).toBe(0);
    // The help names the meme and stops there — reading it takes the deliberate `--meme`.
    const text = out.join("\n");
    expect(text).toContain("lar:///ha.ka.ba/lares/cli/vessel-door");
    expect(text).toContain("lares vessel --help --meme");
  });

  test("a SUB-DOOR carries its own entry — `vessel wire --help` renders the wire door, not the vessel one", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["vessel", "wire", "--help"])).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/^usage: lares vessel wire/m);
    expect(text, "the sub-door's own flags reach the reader").toContain("--copilot");
  });
});
