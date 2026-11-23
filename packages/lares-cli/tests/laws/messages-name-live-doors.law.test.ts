/**
 * L2 · A DECLARATION AGREES WITH WHAT THE DOOR ANSWERS: every `lares …` command a message names is a door the CLI answers.
 *
 * A refusal or a hand-act line that names its cure as a command (`run \`lares vessel request <id>\``) makes a promise the
 * registry has to keep. A verb that folds or renames leaves the old spelling standing in every message that pointed at
 * it, and nothing fails: the operator copies the line and meets `unknown command`. This law walks the CLI's own source
 * for every command a message names and asks the registry whether it answers.
 *
 * Collected mechanically, never listed: every backtick-quoted `lares …` span in `src/` (the house spells a command in a
 * message that way), and every string constant whose whole value reads as a `lares …` line (`HAND_ACT`,
 * `WORKBENCH_LAY_LINE`). Checked against the registry, never a list here: the first word against `COMMAND_NAMES` and the
 * host shim's verbs; the second, where it reads as a bare sub-verb, against the door's declared verb table where one
 * stands, else the sub-door keys and the door's usage spine (`<a|b|c>`), else the door's own help account.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L2
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_HELP, helpLines } from "../../src/command-help.js";
import { COMMAND_NAMES, COMMANDS, MOVED } from "../../src/bin/lares.js";
import { BAG_VERBS } from "../../src/commands/bag.js";
import { SENSE_VERBS } from "../../src/commands/sense.js";
import { SHORE_ACTS } from "../../src/commands/shore.js";
import { SHIM_VERBS, shimHelpLines } from "../../src/host-bridge.js";
import { verbTables } from "./harness.js";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** Every `lares …` command line a message in `text` names: backtick-quoted spans, and whole-string constants. */
export function namedCommands(text: string): string[] {
  // A doc comment names history and design, never a line an operator copies: only the messages count.
  const code = text.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
  const plain = code.replace(/\\`/g, "`");
  const spans = [...plain.matchAll(/`(lares [a-z][^`\n]*)`/g)].map((m) => m[1]!);
  const consts = [...code.matchAll(/=\s*"(lares [a-z][^"\n]*)"\s*;/g)].map((m) => m[1]!);
  // A span whose first word ends in `:` opens a message (`lares act: …`), never a command line.
  return [...spans, ...consts].filter((s) => !/^lares [^\s]*:/.test(s));
}

/** The doors whose verbs stand in an exported table: the law harness's tables, and the three doors that keep their own. */
const tables = new Map<string, ReadonlySet<string>>([
  ...verbTables().map((t) => [t.door, new Set(t.verbs)] as const),
  ["bag", new Set(BAG_VERBS)], ["sense", new Set(SENSE_VERBS)], ["shore", new Set(SHORE_ACTS)],
]);
/** A door that hands its sub-verbs to another program's grammar (`mempalace <vendored verb>`) holds no sub-verb to check. */
const passes = new Set(COMMANDS.filter((c) => c.passesThrough !== undefined).map((c) => c.name));
const doors = new Set<string>([...COMMAND_NAMES, ...SHIM_VERBS, "help"]);

/** A door's own account: its registry entry and sub-door keys, the door's own sub-verb table, and its summary. */
function account(door: string): string {
  const cmd = COMMANDS.find((c) => c.name === door);
  return [
    ...(shimHelpLines(door) ?? helpLines(door)),
    ...Object.keys(COMMAND_HELP).filter((k) => k.startsWith(`${door} `)),
    ...(cmd?.help?.() ?? []),
    cmd?.summary ?? "",
  ].join("\n");
}

/** Why `line` names no door the CLI answers, or null where it does. An interpolated word (`${…}`) reads as unchecked. */
export function deadDoor(line: string): string | null {
  const words = line.split(/\s+/).slice(1).map((w) => w.split("${")[0]!);
  const door = words[0]!;
  if (door === "") return null;
  if (!doors.has(door)) return `no door "${door}"`;
  const sub = words[1];
  if (sub === undefined || !/^[a-z][a-z0-9-]*$/.test(sub) || passes.has(door)) return null;
  const table = tables.get(door);
  if (table) return table.has(sub) ? null : `"${door}" declares no verb "${sub}"`;
  return new RegExp(`(^|[^a-z-])${sub}([^a-z-]|$)`).test(account(door)) ? null : `"${door}" names no verb "${sub}" in its own account`;
}

const named = [
  ...sources(SRC).flatMap((file) => namedCommands(readFileSync(file, "utf8")).map((line) => ({ file: relative(SRC, file), line }))),
  // The retired spellings' table: each row's cure is a line an operator copies.
  ...MOVED.filter((m) => m.to.startsWith("lares ")).map((m) => ({ file: "bin/lares.ts#MOVED", line: m.to })),
];

describe("L2 · every `lares …` command a message names is a door the CLI answers", () => {
  test("the walk finds the messages (a silent zero proves nothing)", () => {
    expect(named.length).toBeGreaterThan(200);
    // The hand-act constants, the lag line's cures, the local wait's read-back, and the retired spellings' new seats.
    expect(named.map((n) => n.line)).toEqual(expect.arrayContaining([
      "lares rite kukulu", "lares vessel lay --workbench --apply",
      "lares meme offer promote <cid>", "lares nexus release <manifest-file> --cut",
      "lares vessel request ${requestId}", "lares persona raise-sign <challenge-json-text>",
    ]));
  });

  test("★ every named command answers ★", () => {
    const dead = named.map((n) => ({ ...n, why: deadDoor(n.line) })).filter((n) => n.why !== null);
    expect(dead).toEqual([]);
  });

  test("CONTROL: a retired verb, an unknown door and an undeclared sub-verb each read as dead", () => {
    expect(deadDoor("lares receipt req-1")).not.toBeNull();
    expect(deadDoor("lares zz-no-such-name")).not.toBeNull();
    expect(deadDoor("lares vessel zz-no-such-name")).not.toBeNull();
    expect(deadDoor("lares vessel request <id>")).toBeNull();
    expect(deadDoor("lares sense zz-no-such-name <transcript>")).not.toBeNull();
    expect(deadDoor("lares mempalace search <q>"), "a pass-through door's vendored verb").toBeNull();
    expect(namedCommands("/**\n * `lares zz-no-such-name` in a doc comment\n */")).toEqual([]);
    expect(namedCommands("x = `run \\`lares vessel request ${id}\\` now`")).toEqual(["lares vessel request ${id}"]);
  });
});
