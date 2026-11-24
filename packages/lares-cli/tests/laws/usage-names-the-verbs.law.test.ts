/**
 * L2 · A DECLARATION AGREES WITH WHAT THE DOOR ANSWERS: a door's usage spine names exactly the verbs
 * its dispatch table declares, so a verb the table gains or loses moves the spine in the same act.
 *
 * Inputs: every door whose verbs stand in an exported table. Control: a spine that drops a verb reads
 * as disagreeing.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L2
 */
import { describe, expect, test } from "vitest";
import { COMMAND_HELP, helpLines } from "../../src/command-help.js";
import { COMMANDS } from "../../src/bin/lares.js";
import { MEMPALACE_OWN_VERBS } from "../../src/commands/mempalace.js";
import { verbTables } from "./harness.js";

/**
 * The verbs a usage spine names: every `<a|b|c>` group on the usage line, and each bare word a `lares <door> <verb>` clause
 * spells out (`lares sense analyze --lens <lens>`). A spine of one clause reads its one group, as before.
 */
const spineVerbs = (door: string): string[] => {
  const line = helpLines(door)[0] ?? "";
  const groups = [...line.matchAll(/<\s*([a-z-]+(?:\s*\|\s*[a-z-]+)+)\s*>/g)].flatMap((m) => m[1]!.split("|").map((v) => v.trim()));
  // A clause spells its verb, or its verbs bare (`lares lei show|kui|unstring|restring`).
  const spelled = [...line.matchAll(new RegExp(`lares ${door} ([a-z][a-z-]*(?:\\|[a-z][a-z-]*)*)(?![a-z-])`, "g"))].flatMap((m) => m[1]!.split("|"));
  return [...new Set([...groups, ...spelled])];
};

/** A door's whole account: its registry help, and the sub-verb table it prints where it keeps one (`wiki`, `bag`). */
const account = (door: string): string => [...helpLines(door), ...(door.includes(" ") ? [] : COMMANDS.find((c) => c.name === door)?.help?.() ?? [])].join("\n");
const names = (text: string, verb: string): boolean => new RegExp(`(^|[^a-z_-])${verb}([^a-z_-]|$)`).test(text);

// A door, and each sub-door that holds its own registry row (`nexus approve`, `meme offer`), answers for its spine.
const tables = verbTables().filter((t) => !t.door.includes(" ") || t.door in COMMAND_HELP)
  .map((t) => (t.door === "mempalace" ? { door: t.door, verbs: MEMPALACE_OWN_VERBS.filter((v) => v !== "help") } : t))
  .map((t) => ({ door: t.door, verbs: t.verbs.filter((v) => v !== "help") }));
const spined = tables.filter((t) => spineVerbs(t.door).length > 1);

describe("L2 · a door's usage spine names exactly the verbs its table declares", () => {
  test.each(spined.map((t) => [t.door, t.verbs] as const))("`%s`", (door, verbs) => {
    expect([...spineVerbs(door)].sort()).toEqual([...verbs].sort());
  });

  test.each(tables.map((t) => [t.door, t.verbs] as const))("`%s`: its help names every verb its table answers", (door, verbs) => {
    const text = account(door);
    expect(verbs.filter((v) => !names(text, v))).toEqual([]);
  });

  test("the spine reader reads every spelling the house writes: bracketed, spaced, bare, and a spelled clause", () => {
    expect(spineVerbs("lei")).toEqual(expect.arrayContaining(["show", "kui", "unstring", "restring"]));
    expect(spineVerbs("edge")).toEqual(expect.arrayContaining(["kapae", "un-kapae"]));
    expect(spineVerbs("sense")).toEqual(expect.arrayContaining(["search", "analyze", "harden"]));
  });

  test("CONTROL: a spine missing a verb disagrees with its table", () => {
    const [door, verbs] = [spined[0]!.door, spined[0]!.verbs];
    expect(spineVerbs(door).slice(1).sort()).not.toEqual([...verbs].sort());
    expect(names(account(door), "zz-no-such-name")).toBe(false);
  });
});
