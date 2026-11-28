/**
 * burned-words-witness — the words leave with the machine. The shore cut burned the disk projector's held-carrier machine
 * and the name its ingest gate once wore; no tracked source under `packages/<pkg>/src`, no script under
 * `packages/<pkg>/scripts`, and no `.mem` under `bags/` or `wikis/` carries either word again. A red names each file:line
 * where one stands. This file alone stays exempt, since it spells the words it hunts.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const self = relative(repo, fileURLToPath(import.meta.url));
const ROOTS = ["packages/*/src/**", "packages/*/scripts/**", "bags/**/*.mem", "wikis/**/*.mem"];
const BURNED = /standoff|stand-off|confluence/i;

/** Every tracked path under the witnessed roots, read through git so ignored and untracked files stay out. */
function tracked() {
  const r = spawnSync("git", ["ls-files", "-z", "--", ...ROOTS.map((g) => `:(glob)${g}`)], { cwd: repo, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  assert.equal(r.status, 0, `git ls-files refused: ${r.stderr}`);
  return r.stdout.split("\0").filter((p) => p !== "" && p !== self);
}

/** Each `file:line` where a burned word stands in one text. */
export function burnedLines(path, text) {
  const out = [];
  text.split("\n").forEach((line, i) => { if (BURNED.test(line)) out.push(`${path}:${i + 1}`); });
  return out;
}

test("CONTROL: the hunt catches each spelling and passes the words that replaced them", () => {
  assert.deepEqual(burnedLines("a.ts", "// the Confluence gate\nconst ok = 1;\n// a stand-off\n// STANDOFF strata"), ["a.ts:1", "a.ts:3", "a.ts:4"]);
  assert.deepEqual(burnedLines("a.ts", "// the three-way gate\n// a conflict at the shore\n// span strata"), []);
});

test("no tracked source, script or .mem carries a burned word", () => {
  const paths = tracked();
  assert.ok(paths.length > 100, `the witness read only ${paths.length} path(s): the roots match nothing`);
  const hits = [];
  for (const p of paths) {
    let bytes;
    try { bytes = readFileSync(join(repo, p)); } catch { continue; }   // a tracked path deleted in the working tree reads nothing
    if (bytes.includes(0)) continue;                                   // a binary blob carries no prose
    hits.push(...burnedLines(p, bytes.toString("utf8")));
  }
  assert.deepEqual(hits, [], `burned words still stand (name what the code does instead):\n${hits.join("\n")}`);
});
