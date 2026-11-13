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
import { helpLines } from "../../src/command-help.js";
import { MEMPALACE_OWN_VERBS } from "../../src/commands/mempalace.js";
import { verbTables } from "./harness.js";

/** The verbs a usage spine names in its first `<a|b|c>` group. */
const spineVerbs = (door: string): string[] =>
  (/<([a-z|-]+)>/.exec(helpLines(door)[0] ?? "")?.[1] ?? "").split("|").filter(Boolean);

const tables = [
  ...verbTables(),
  { door: "mempalace", verbs: MEMPALACE_OWN_VERBS.filter((v) => v !== "help") },
];

describe("L2 · a door's usage spine names exactly the verbs its table declares", () => {
  test.each(tables.map((t) => [t.door, t.verbs] as const))("`%s`", (door, verbs) => {
    expect([...spineVerbs(door)].sort()).toEqual([...verbs].sort());
  });

  test("CONTROL: a spine missing a verb disagrees with its table", () => {
    const [door, verbs] = [tables[0]!.door, tables[0]!.verbs];
    expect(spineVerbs(door).slice(1).sort()).not.toEqual([...verbs].sort());
  });
});
