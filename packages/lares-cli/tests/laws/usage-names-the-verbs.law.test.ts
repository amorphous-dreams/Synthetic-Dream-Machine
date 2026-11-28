/**
 * L2 · A DECLARATION AGREES WITH WHAT THE DOOR ANSWERS: a door's index names exactly the verbs
 * its dispatch table declares, so a verb the table gains or loses moves the index in the same act.
 *
 * Inputs: every door whose verbs stand in an exported table, its help read off the baked pack (a door of several carriers reads
 * an index, one `lares <door> <verb>` line per carrier and per `also` spelling). Control: an index that drops a verb reads as
 * disagreeing.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L2
 */
import { describe, expect, test } from "vitest";
import { packDoor } from "@lararium/tw5/affordance-pack";
import { helpLines } from "../../src/command-help.js";
import { MEMPALACE_OWN_VERBS } from "../../src/commands/mempalace.js";
import { verbTables } from "./harness.js";

/** The verbs a door's index names: the first word past `lares <door>` on each line that opens with the door's spelling. */
const spineVerbs = (door: string, lines: readonly string[] = helpLines(door)): string[] =>
  [...new Set(lines.flatMap((l) => [...l.matchAll(new RegExp(`^\\s*lares ${door} ([a-z][a-z_-]*)(?![a-z_-])`, "g"))].map((m) => m[1]!)))];

/** A door's whole account: its help, read off the pack. */
const account = (door: string): string => helpLines(door).join("\n");
const names = (text: string, verb: string): boolean => new RegExp(`(^|[^a-z_-])${verb}([^a-z_-]|$)`).test(text);

// A door answers for its index; a sub-door (`meme offer`) rides its parent's.
const tables = verbTables().filter((t) => !t.door.includes(" "))
  .map((t) => (t.door === "mempalace" ? { door: t.door, verbs: MEMPALACE_OWN_VERBS.filter((v) => v !== "help") } : t))
  .map((t) => ({ door: t.door, verbs: t.verbs.filter((v) => v !== "help") }));
// A door of several carriers reads an index; a door one carrier answers reads that carrier whole, whose examples spell flags.
const spined = tables.filter((t) => (packDoor(t.door)?.addresses.length ?? 0) > 1);

describe("L2 · a door's usage spine names exactly the verbs its table declares", () => {
  test.each(spined.map((t) => [t.door, t.verbs] as const))("`%s`", (door, verbs) => {
    expect([...spineVerbs(door)].sort()).toEqual([...verbs].sort());
  });

  test.each(tables.map((t) => [t.door, t.verbs] as const))("`%s`: its help names every verb its table answers", (door, verbs) => {
    const text = account(door);
    expect(verbs.filter((v) => !names(text, v))).toEqual([]);
  });

  test("SEED: the index reader reads the last four part doors' verbs off their carriers", () => {
    expect(spineVerbs("vessel")).toEqual(expect.arrayContaining(["unbound", "found", "rite", "roster"]));
    expect(spineVerbs("meme")).toEqual(expect.arrayContaining(["normalize", "check", "offer", "project"]));
    expect(spineVerbs("sense")).toEqual(expect.arrayContaining(["search", "analyze", "harden", "recall"]));
    expect(spineVerbs("wiki")).toEqual(expect.arrayContaining(["init", "render", "status", "compact"]));
  });

  test("CONTROL: an index missing a verb disagrees with its table", () => {
    const [door, verbs] = [spined[0]!.door, spined[0]!.verbs];
    expect(spineVerbs(door, helpLines(door).filter((l) => !l.includes(`lares ${door} ${verbs[0]}`))).sort()).not.toEqual([...verbs].sort());
    expect(names(account(door), "zz-no-such-name")).toBe(false);
  });
});
