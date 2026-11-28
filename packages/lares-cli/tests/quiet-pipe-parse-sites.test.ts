/**
 * quiet-pipe-parse-sites — A READ THAT ANSWERS A PIPE IN PROSE IS PARSED ONLY UNDER `json=true`.
 *
 * The reads render.ts names in `PROSE_FIRST_READS` print the terminal's prose through a pipe too (the operator, 2026-11-19:
 * the re-stand's output read "spammy"). A script that pipes one of them and parses the answer would then parse prose, so
 * every parse site in the tree names `json=true`:
 *
 *   - the shim (tools/lares-container.sh and .ps1): a line that runs the CLI on one of these reads and captures or pipes
 *     its stdout names `json=true`; a line that only runs it (the `up` chain's unlock and wear) reads the prose by design;
 *   - every other shell script under tools/: the same, for a CLI it names `$LARES`, `$CLI` or `lares`;
 *   - every scripted argv under tools/ and the plugin's hooks (`["vault", "status", …]`) in a file that parses JSON names
 *     `json=true` or `json=false` on its line, unless it rides a pty (a terminal reads prose either way).
 *
 * tools/lares-container.test.mjs drives the shim against a fake engine and parses no CLI answer, so it stands outside.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { PROSE_FIRST_READS } from "../src/render.js";

const REPO = fileURLToPath(new URL("../../..", import.meta.url));

/** `vault status` → a pattern for the words as a shell line spells them. */
const shellRead = (read: string): RegExp => new RegExp(`(?:\\$\\{?(?:CLI|Cli|LARES)\\}?|\\blares(?:\\.mjs)?)["']?\\s+${read.split(" ").join("\\s+")}\\b`);
/** `vault status` → a pattern for the words as a quoted argv spells them. */
const argvRead = (read: string): RegExp => new RegExp(read.split(" ").map((w) => `["']${w}["']`).join("\\s*,\\s*"));

const isComment = (line: string): boolean => /^\s*(#|\/\/|\*|\/\*)/.test(line);

/** Does this shell line read the CLI's stdout (a capture, or a pipe AFTER the invocation)? */
export function shellParses(line: string, at: number): boolean {
  const before = line.slice(0, at);
  // A capture that holds the invocation: the last `$(` before it stands unclosed (`$(pass_env)` before it closes, so no).
  const open = before.lastIndexOf("$(");
  if (open >= 0 && !before.slice(open).includes(")")) return true;
  if (/^\s*\$\w+\s*=\s*(&|\()/.test(before)) return true;                       // PowerShell: `$out = & docker …`
  return /\|/.test(line.slice(at).replace(/\|\|/g, ""));
}

/** Every shell-line site that runs a prose-first read and reads its stdout without naming `json=true`. */
export function shellBreaches(text: string, reads: readonly string[]): string[] {
  const out: string[] = [];
  text.split("\n").forEach((line, i) => {
    if (isComment(line)) return;
    for (const read of reads) {
      const m = shellRead(read).exec(line);
      if (m && shellParses(line, m.index) && !/(?<![\w-])json=true\b/.test(line)) out.push(`${i + 1}: ${line.trim()}`);
    }
  });
  return out;
}

/** Every scripted argv of a prose-first read, in a file that parses JSON, that names neither form on its line. */
export function argvBreaches(text: string, reads: readonly string[]): string[] {
  if (!/JSON\.parse|\bjson\(/.test(text)) return [];
  const out: string[] = [];
  text.split("\n").forEach((line, i) => {
    if (isComment(line) || /\bpty\(/.test(line)) return;
    for (const read of reads) {
      if (argvRead(read).test(line) && !/["']json=(true|false)["']/.test(line)) out.push(`${i + 1}: ${line.trim()}`);
    }
  });
  return out;
}

function walk(dir: string, keep: (p: string) => boolean): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...walk(p, keep));
    else if (keep(p)) found.push(p);
  }
  return found;
}

const OUTSIDE = new Set(["tools/lares-container.test.mjs"]);

describe("every parse site of a prose-first read names json=true", () => {
  test("the list names the reads the doors make prose-first", () => {
    expect(PROSE_FIRST_READS).toEqual(expect.arrayContaining(["vault status", "vault unlock", "vessel read", "wear"]));
  });

  test("★ the shim's parse sites (lares-container.sh and .ps1) name json=true ★", () => {
    for (const shim of ["tools/lares-container.sh", "tools/lares-container.ps1"]) {
      const text = readFileSync(join(REPO, shim), "utf8");
      expect(shellBreaches(text, PROSE_FIRST_READS), shim).toEqual([]);
      // CONTROL: the shim does run these reads, so the scan reads real lines.
      expect(PROSE_FIRST_READS.some((r) => shellRead(r).test(text)), shim).toBe(true);
    }
  });

  test("★ every shell script and scripted argv under tools/ and the plugin hooks names its form ★", () => {
    const files = [
      ...walk(join(REPO, "tools"), (p) => /\.(sh|ps1|mjs|js)$/.test(p)),
      ...walk(join(REPO, "packages/lares-cli/.claude-plugin/hooks"), (p) => /\.mjs$/.test(p)),
    ].filter((p) => !OUTSIDE.has(relative(REPO, p)));
    const breaches: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      const found = /\.(sh|ps1)$/.test(f) ? shellBreaches(text, PROSE_FIRST_READS) : argvBreaches(text, PROSE_FIRST_READS);
      for (const b of found) breaches.push(`${relative(REPO, f)}:${b}`);
    }
    expect(breaches).toEqual([]);
  });

  test("CONTROL: the scan catches a parse site that drops json=true, and passes the lines that only run the read", () => {
    expect(shellBreaches(`  compose exec -T lares node "$CLI" vault status 2>/dev/null | grep -q '"unlocked"'`, PROSE_FIRST_READS)).toHaveLength(1);
    expect(shellBreaches(`  out=$(compose exec -T lares node "$CLI" vessel read)`, PROSE_FIRST_READS)).toHaveLength(1);
    expect(shellBreaches(`  $out = & docker compose @Base exec -T lares node $Cli vault status 2>$null`, PROSE_FIRST_READS)).toHaveLength(1);
    expect(shellBreaches(`  compose exec -T lares node "$CLI" vault status json=true 2>/dev/null | grep -q '"unlocked"'`, PROSE_FIRST_READS)).toEqual([]);
    expect(shellBreaches(`    if waited_exec $(pass_env) -T lares node "$CLI" vault unlock all=true </dev/null; then`, PROSE_FIRST_READS)).toEqual([]);
    expect(shellBreaches(`  $null | & docker compose @Base exec -T lares node $Cli wear $face`, PROSE_FIRST_READS)).toEqual([]);
    expect(argvBreaches(`const j = JSON.parse(run(root, ["vessel", "read", \`root=\${root}\`]).stdout);`, PROSE_FIRST_READS)).toHaveLength(1);
    expect(argvBreaches(`const j = JSON.parse(run(root, ["vessel", "read", "json=true"]).stdout);`, PROSE_FIRST_READS)).toEqual([]);
  });
});
