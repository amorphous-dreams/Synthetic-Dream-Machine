/**
 * L2 · A DECLARATION AGREES WITH WHAT THE DOOR ANSWERS: every `lares …` command the house writes is a door the CLI answers.
 *
 * A refusal or a hand-act line that names its cure as a command (`run \`lares vessel request <id>\``) makes a promise the
 * registry has to keep, and so does a doc comment or a canon meme that teaches a door. A verb that folds or renames leaves
 * the old spelling standing in every line that pointed at it, and nothing fails: the operator copies the line and meets
 * `unknown command`. This law walks every place the house writes such a line and asks the registry whether it answers.
 *
 * Collected mechanically, never listed: every backtick-quoted `lares …` span (the house spells a command that way, in a
 * message, a comment, a shell script or a meme) under `ROOTS`, every string constant whose whole value reads as a
 * `lares …` line (`HAND_ACT`, `WORKBENCH_LAY_LINE`), and every `lares …` cure in the dispatcher's `MOVED` table.
 * Checked against the registry, never a list here: the first word against `COMMAND_NAMES` and the host shim's verbs; each
 * word after it against the door's own verb table, read off its command row (`verbs`), as deep as the table runs
 * (`meme offer promote`). A door with no table takes arguments; a pass-through door hands its words to another grammar.
 * A verb not yet built reads in prose without the `lares ` prefix (`a \`kairos\` verb`), so it never poses as a door.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L2
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, COMMANDS, MOVED } from "../../src/bin/lares.js";
import { SHIM_VERBS } from "../../src/host-bridge.js";
import { verbTables } from "./harness.js";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Where the house writes a `lares …` line an operator copies: the CLI's own source, the vessel's (its refusals travel back
 * through the CLI), the host tools' shell scripts, and canon (`bags/`, `wikis/`), whose memes teach the doors.
 */
const ROOTS: ReadonlyArray<{ dir: string; ext: string }> = [
  { dir: "packages/lares-cli/src", ext: ".ts" },
  { dir: "packages/lararium-node/src", ext: ".ts" },
  { dir: "tools", ext: ".sh" },
  { dir: "bags", ext: ".mem" },
  { dir: "wikis", ext: ".mem" },
];

function sources(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n === "dist") return [];
    return statSync(p).isDirectory() ? sources(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

/** Every `lares …` command line a message in `text` names: backtick-quoted spans, and whole-string constants. */
export function namedCommands(text: string): string[] {
  const plain = text.replace(/\\`/g, "`");
  const spans = [...plain.matchAll(/`(lares [a-z][^`\n]*)`/g)].map((m) => m[1]!);
  const consts = [...text.matchAll(/=\s*"(lares [a-z][^"\n]*)"\s*;/g)].map((m) => m[1]!);
  // A span whose first word ends in `:` opens a message (`lares act: …`), never a command line.
  return [...spans, ...consts].filter((s) => !/^lares [^\s]*:/.test(s));
}

/** Every door table, read off the command rows (`meme` and `meme offer` each a key). */
const tables = new Map<string, ReadonlySet<string>>(verbTables().map((t) => [t.door, new Set(t.verbs)] as const));
const doors = new Set<string>([...COMMAND_NAMES, ...SHIM_VERBS, "help"]);
/** A door that hands its sub-verbs to another program's grammar (`mempalace <vendored verb>`) holds no sub-verb to check. */
const passes = new Set(COMMANDS.filter((c) => c.passesThrough !== undefined).map((c) => c.name));
/** A door whose row names an argument that may lead its verb (`sense <sensorium> <verb>`). */
const leads = new Set(COMMANDS.filter((c) => c.leads !== undefined).map((c) => c.name));
const isWord = (w: string | undefined): w is string => w !== undefined && /^[a-z][a-z0-9_-]*$/.test(w);

/**
 * Why `line` names no door the CLI answers, or null where it does. Each word past the door reads against the table at
 * its path (`meme` reads `offer`; `meme offer` reads `promote`) until a word reads as an argument, a flag, or a path with
 * no table: a door with no table takes arguments. An interpolated word (`${…}`) reads as unchecked.
 */
export function deadDoor(line: string): string | null {
  const words = line.split(/\s+/).slice(1).map((w) => w.split("${")[0]!);
  const door = words[0]!;
  if (door === "") return null;
  if (!doors.has(door)) return `no door "${door}"`;
  if (passes.has(door)) return null;
  let path = door;
  const rest = words.slice(1);
  // The row's leading argument stands before the verb only where the word after it is a verb the door answers.
  if (leads.has(door) && isWord(rest[0]) && !tables.get(door)?.has(rest[0]) && tables.get(door)?.has(rest[1] ?? "")) rest.shift();
  for (const word of rest) {
    const table = tables.get(path);
    if (table === undefined || !isWord(word)) return null;
    if (!table.has(word)) return `"${path}" declares no verb "${word}"`;
    path = `${path} ${word}`;
  }
  return null;
}

const named = [
  ...ROOTS.flatMap(({ dir, ext }) => sources(join(REPO, dir), ext))
    .flatMap((file) => namedCommands(readFileSync(file, "utf8")).map((line) => ({ file: relative(REPO, file), line }))),
  // The retired spellings' table: each row's cure is a line an operator copies.
  ...MOVED.filter((m) => m.to.startsWith("lares ")).map((m) => ({ file: "packages/lares-cli/src/bin/lares.ts#MOVED", line: m.to })),
];

describe("L2 · every `lares …` command a message names is a door the CLI answers", () => {
  test("the walk finds the messages (a silent zero proves nothing)", () => {
    expect(named.length).toBeGreaterThan(600);
    // Every root contributes: a root that silently yields nothing proves nothing.
    for (const { dir } of ROOTS) expect(named.some((n) => n.file.startsWith(`${dir}/`)), dir).toBe(true);
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
    // A doc comment teaches a door too, so it counts; a verb not yet built reads without the prefix.
    expect(namedCommands("/**\n * `lares zz-no-such-name` in a doc comment\n */")).toEqual(["lares zz-no-such-name"]);
    expect(namedCommands("a `zz-no-such-name` verb, not yet a door")).toEqual([]);
    expect(deadDoor("lares meme offer zz-no-such-name")).not.toBeNull();
    expect(deadDoor("lares meme offer promote <cid>")).toBeNull();
    // The sense row's leading `<sensorium>` reads through to the verb, and only where a verb follows it.
    expect(deadDoor("lares sense memory pour --all")).toBeNull();
    expect(deadDoor("lares sense memory zz-no-such-name")).not.toBeNull();
    expect(deadDoor("lares sense zz-no-such-name")).not.toBeNull();
    expect(namedCommands("x = `run \\`lares vessel request ${id}\\` now`")).toEqual(["lares vessel request ${id}"]);
  });
});
