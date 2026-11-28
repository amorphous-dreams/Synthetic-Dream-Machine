/**
 * THE VERB DOOR KEEPS ONE HOME FOR ITS WORDS, AND NAMES THE MEME BEHIND IT.
 *
 * Two homes for one door's help text drift, and the reader never learns which half lies. Every door's words ride its carriers
 * through the baked pack, so this file fences BOTH directions —
 *
 *   1. a door's help names the memes behind it in its carriers' `Law:` lines, each a WELL-FORMED `lar:` URI,
 *   2. no module hand-rolls help text: the refusal path draws from the pack, the one home.
 *
 * The help module stays PURE DATA: no `node:fs`, so any vessel that can hold the module can read the door. A carrier reads
 * whole through the one read door (`lares get title=<carrier> recipe=lares aperture=arc`), never a file read.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import * as commandHelp from "../src/command-help.js";
import { helpLines } from "../src/command-help.js";

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

describe("★ a door's help names the meme behind it, in its carriers' law lines ★", () => {
  test("store verbs name their container on the carrier: `lares help meme project` reads recipe= and bag=", () => {
    const text = helpLines("meme project").join("\n");
    expect(text).toMatch(/\[recipe=<word>\]/);
    expect(text).toMatch(/\[bag=<word>\]/);
    // The family verbs moved to the call door: no meme line teaches a retired spelling.
    for (const verb of ["put", "patch", "list", "delete"]) expect(helpLines("meme").join("\n"), `meme ${verb}`).not.toMatch(new RegExp(`\\blares meme ${verb}\\b`));
  });

  test("★ each law line a door's carriers name reads as a well-formed lar: URI, and the vessel and meme doors name theirs ★", () => {
    const laws = (door: string): string[] => {
      const lines = helpLines(door);
      const out: string[] = [];
      for (let i = lines.indexOf("Law:") + 1; i > 0 && i < lines.length && lines[i]!.startsWith("  "); i++) out.push(lines[i]!.trim());
      return out;
    };
    expect(laws("vessel request")).toContain("lar:///ha.ka.ba/lares/cli/vessel-door");
    expect(laws("meme check")).toContain("lar:///ha.ka.ba/lares/api/pono/meme");
    for (const door of ["vessel request", "meme check", "sense search", "wiki init"]) {
      const bad = laws(door).filter((uri) => !wellFormed(uri.split("#")[0]!));
      expect(bad, door).toEqual([]);
    }
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

  test("★ no module hand-rolls help text: the pack holds every door's words ★", () => {
    expect(
      [...handRolled()].map(([d, f]) => `${d} (${f})`),
      "these doors keep a SECOND home for their words; move the text into the door's carriers",
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

  test("no registry stands beside the pack", () => {
    expect(Object.keys(commandHelp)).not.toContain("COMMAND_HELP");
  });

});

describe("★ the core verbs' help reads their carriers, one home ★", () => {
  async function helpOf(argv: string[]): Promise<string[]> {
    const { dispatch } = await import("../src/bin/lares.js");
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["help", ...argv])).toBe(0);
    return out;
  }


  test("★ each call verb's help prints its carrier whole, its call-shaped usage spine first ★", async () => {
    for (const [verb, carrier] of [["get", "engine.record.reads"], ["put", "engine.record.puts"], ["delete", "engine.record.removes"], ["rename", "engine.record.renames"]] as const) {
      const out = await helpOf([verb]);
      // The spine leads with name=value params; an optional dial (`[mu=<carry>]`) may ride first.
      expect(out[0], verb).toMatch(new RegExp(`^usage: lares ${verb} (\\[[a-z][a-z0-9-]*=<[^>]+>\\] )*\\[?[a-z][a-z0-9-]*=`));
      expect(out.join("\n"), verb).toContain(`lar:///ha.ka.ba/lares/afford/${carrier}`);
      vi.restoreAllMocks();
    }
  });

  test("the burned spellings answer no help: `lares help tiddler` refuses as an unknown command, and the wiki door's table names no filter", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const err: string[] = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.map(String).join(" ")); });
    expect(await dispatch(["help", "tiddler"])).toBe(2);
    expect(err.join("\n")).toContain('unknown command "tiddler"');
    vi.restoreAllMocks();
    const text = (await helpOf(["wiki"])).join("\n");
    expect(text).not.toMatch(/^  filter /m);
    expect(text).toContain("switch");
  });
});

describe("★ `lares help <door>` reads the door's carriers, each naming its law ★", () => {
  test("`lares help vessel` lists the door's verbs off the pack, `request` and `roster` among them", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["help", "vessel"])).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("lares vessel request");
    expect(text).toContain("lares vessel roster");
  });

  test("a SUB-DOOR carries its own entry — `lares help vessel rite` renders the rite door, not the vessel one", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["help", "vessel", "rite"])).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/^usage: lares vessel rite/m);
    expect(text, "the sub-door's own petnames reach the reader").toContain("refresh");
  });
});
