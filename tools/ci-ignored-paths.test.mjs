// ci-ignored-paths.test.mjs — one list of meme, docs and wiki paths both push triggers skip and the land guard reads.
// GitHub Actions cannot read a file into `paths-ignore`, so the workflow globs are pinned equal to the file here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IGNORED_PATHS, isIgnoredPath, onlyIgnoredPaths } from "./ci-ignored-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = (name) => readFileSync(join(ROOT, ".github/workflows", name), "utf8");

/** The `paths-ignore` globs under one event of a workflow's `on:` block. */
function pathsIgnore(yml, event) {
  const on = yml.slice(yml.indexOf("\non:"));
  const at = on.indexOf(`\n  ${event}:`);
  assert.ok(at >= 0, `no ${event} event`);
  const rest = on.slice(at + 1);
  const end = rest.slice(1).search(/\n {2}[a-z_]+:/);
  const block = end < 0 ? rest : rest.slice(0, end + 1);
  const m = /paths-ignore:\s*\n((?:\s+- .*\n?)+)/.exec(block);
  return m ? [...m[1].matchAll(/- "?([^"\n]+)"?/g)].map((x) => x[1].trim()) : null;
}

test("RED: the shared list names meme, docs and wiki paths, and the file is the one source", () => {
  const file = JSON.parse(readFileSync(join(ROOT, "tools/ci-ignored-paths.json"), "utf8"));
  assert.deepEqual(IGNORED_PATHS, file.paths);
  assert.deepEqual([...IGNORED_PATHS].sort(), ["**/*.md", "CHANGELOG.md", "bags/**/*.mem", "wikis/**"]);
});

test("RED: ci.yml and held-out.yml push triggers carry exactly the file's globs, and pull_request stays un-ignored", () => {
  for (const name of ["ci.yml", "held-out.yml"]) {
    const yml = workflow(name);
    assert.deepEqual(pathsIgnore(yml, "push"), IGNORED_PATHS, `${name} push paths-ignore drifted from tools/ci-ignored-paths.json`);
    if (/\n {2}pull_request:/.test(yml)) assert.equal(pathsIgnore(yml, "pull_request"), null, `${name} ignores paths on pull_request`);
  }
});

test("RED: the matcher reads GitHub globs; CONTROL: code paths stay un-ignored", () => {
  for (const p of ["bags/lares/ha.ka.ba/x.mem", "bags/a.mem", "README.md", "docs/deep/n.md", "wikis/w/working/t.tid", "CHANGELOG.md"]) assert.equal(isIgnoredPath(p), true, p);
  for (const p of ["tools/land-train.mjs", "packages/a/src/x.ts", "bags/lares/x.json", "bags/x.mem.ts", "wikis", "a/CHANGELOG.md.bak"]) assert.equal(isIgnoredPath(p), false, p);
  assert.equal(onlyIgnoredPaths(["a.md", "bags/q.mem"]), true);
  assert.equal(onlyIgnoredPaths(["a.md", "tools/x.mjs"]), false);
  assert.equal(onlyIgnoredPaths([]), false, "an empty change reads nothing ignored");
});
