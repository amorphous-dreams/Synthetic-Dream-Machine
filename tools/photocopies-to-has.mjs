#!/usr/bin/env node
/**
 * photocopies-to-has — the eighty-four local shorthands become one relation.
 *
 * Thirty-five carriers each declared their own copy of ONE procedure, hard-coding the entity into
 * the procedure's own name:
 *
 *     ```
 *     \procedure ~Verb(Type:"" Params:"") ~Verb <<Type>> holds [{{{ [<Params>] }}}]
 *     ```
 *     <<~Verb run "args/<path> ~ EPHEMERAL-DEFAULT">>
 *
 * The boot seed already carries that relation — an ENTITY, a NAME, and what it HOLDS — with the
 * entity as a parameter. So the head becomes the first positional and the definition goes:
 *
 *     <<~ has Verb run "args/<path> ~ EPHEMERAL-DEFAULT">>
 *
 * THE REWRITE TOUCHES ONLY THE OPENING. A call's parameters carry quoted prose holding `>>`, nested
 * sigils and newlines; a rewrite that had to find the call's END would have to parse all of that
 * correctly to insert three characters at its start. Inserting at the head needs none of it.
 *
 * Usage: node tools/photocopies-to-has.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const REPO  = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");

const DIST = join(REPO, "packages/lararium-tw5/dist");
const { positionalsOf } = await import(join(DIST, "sigil-attrs.js"));

/** The photocopy, alone in its fence — the only shape this moves. */
const FENCED = /\n```\n\\procedure ~([A-Za-z][\w-]*)\((?:Type|Name):""\s+Params:""\)\s*~\1\s*<<(?:Type|Name)>>\s*holds\s*\[\{\{\{\s*\[<Params>\]\s*\}\}\}\]\n```\n/g;

const files = execSync("git ls-files 'bags/**/*.mem' 'bags/**/*.md' 'packages/**/*.mem'", { cwd: REPO, encoding: "utf8" })
  .split("\n").filter(Boolean).filter((f) => !f.includes("lares-history"));

let carriers = 0, defs = 0, calls = 0;
const refused = [];

for (const rel of files) {
  const path = join(REPO, rel);
  const before = readFileSync(path, "utf8");
  const names = [...before.matchAll(FENCED)].map((m) => m[1]);
  if (names.length === 0) continue;

  // The pattern spans the newline on BOTH sides of the fence, so it takes the blank line the fence
  // stood in along with it — replacing with one newline would leave that blank behind.
  let after = before.replace(FENCED, "");
  for (const name of new Set(names)) {
    const open = new RegExp(`<<~\\s*${name}\\b`, "g");
    const hits = (after.match(open) ?? []).length;
    after = after.replace(open, `<<~ has ${name}`);
    calls += hits;
  }

  // ── EACH MOVED CALL READS BACK AS THREE SLOTS ────────────────────────────────────────────────
  // The entity it hard-coded, the name it carried, and what it holds — in that order, and the third
  // whole. A call whose slots do not read back that way is REPORTED and the carrier left alone.
  for (const m of after.matchAll(/<<~ has ([\w-]+)((?:[^>]|>(?!>))*)>>/g)) {
    const slots = positionalsOf(`${m[1]}${m[2]}`);
    if (slots[0] !== m[1]) refused.push(`${rel}: ${m[0].slice(0, 70)}`);
  }

  if (after === before) continue;
  if (!CHECK) writeFileSync(path, after);
  carriers++; defs += names.length;
}

console.log(`${CHECK ? "WOULD move" : "moved"} ${defs} photocopied definition(s) and ${calls} call(s) in ${carriers} carrier(s)`);
if (refused.length) console.log(`\n  REFUSED — slots did not read back (${refused.length}):\n    ` + refused.join("\n    "));
