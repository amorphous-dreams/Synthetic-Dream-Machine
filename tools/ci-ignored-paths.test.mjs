// ci-ignored-paths.test.mjs — one list of meme, docs and wiki paths: held-out's push trigger skips them, CI's scope job reads
// whether a push changes them alone (the canon doorstep), and the land guard reads them. GitHub Actions cannot read a file
// into `paths-ignore`, so held-out's globs are pinned equal to the file here; CI's push trigger carries none, since a
// trigger filter cannot vary by branch and stops the run before any job (and so any required check) is read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IGNORED_PATHS, isIgnoredPath, onlyIgnoredPaths, pushScope } from "./ci-ignored-paths.mjs";

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

test("RED: held-out.yml's push trigger carries exactly the file's globs; ci.yml's push trigger carries none, and pull_request stays un-ignored", () => {
  assert.deepEqual(pathsIgnore(workflow("held-out.yml"), "push"), IGNORED_PATHS, "held-out.yml push paths-ignore drifted from tools/ci-ignored-paths.json");
  // A canon-only push raised no CI run at all, so a canon pull request never saw its four required checks and could not
  // enter the merge queue (measured on PR #242). The scope job reads the diff instead, and the push runs the doorstep.
  const ci = workflow("ci.yml");
  assert.equal(pathsIgnore(ci, "push"), null, "ci.yml's push trigger ignores paths: a canon-only push raises no run and its required checks never report");
  assert.equal(pathsIgnore(ci, "pull_request"), null, "ci.yml ignores paths on pull_request");
  for (const glob of IGNORED_PATHS) assert.ok(!ci.includes(`"${glob}"`), `ci.yml copies the glob ${glob}: the scope job reads tools/ci-ignored-paths.json, the one list`);
});

test("RED: ci.yml's scope job reads the push through this module, so the detector's list IS tools/ci-ignored-paths.json", () => {
  const ci = workflow("ci.yml");
  const at = ci.search(/^  scope:\n/m);
  assert.ok(at >= 0, "ci.yml carries no scope job");
  const rest = ci.slice(at + 1);
  const block = rest.slice(0, rest.search(/^  [a-z][\w-]*:\n/m));
  assert.match(block, /^ {4}outputs:\n {6}canon: \$\{\{ steps\.read\.outputs\.canon \}\}$/m, "the scope job hands on no canon output");
  assert.match(block, /^ {8}id: read$/m);
  assert.match(block, /^ {8}run: node tools\/ci-ignored-paths\.mjs scope >> "\$GITHUB_OUTPUT"$/m, "the scope step reads the push through some other list");
  // It reads the push off the runner's own GITHUB_* variables and event file, never off an interpolated ref: a branch name
  // spliced into a run line would run as shell.
  assert.doesNotMatch(block, /run:[^\n]*\$\{\{/, "the scope step splices an expression into its shell line");
});

// ── the scope reader: a planted git answers, and the reader names the base it read ────────────────
/** A planted git: `answers` maps a joined argv prefix to stdout (or an Error to throw); every call lands in `calls`. */
function plantedGit(answers) {
  const calls = [];
  const git = (args) => {
    calls.push(args.join(" "));
    const key = Object.keys(answers).find((k) => args.join(" ").startsWith(k));
    if (key === undefined) throw new Error(`planted git does not know: git ${args.join(" ")}`);
    const v = answers[key];
    if (v instanceof Error) throw v;
    return v;
  };
  return { git, calls };
}
const BEFORE = "a".repeat(40), SHA = "b".repeat(40), PARENT = "c".repeat(40), BASE = "d".repeat(40), ZERO = "0".repeat(40);
const diff = (...paths) => paths.join("\0") + (paths.length ? "\0" : "");

test("RED: a push to develop or main reads its change against the push's own `before` (the parent of a one-commit push)", () => {
  for (const branch of ["develop", "main"]) {
    const canon = plantedGit({ fetch: "", [`diff --no-renames --name-only -z ${BEFORE} ${SHA}`]: diff("bags/lares/x.mem", "README.md") });
    const r = pushScope({ event: "push", ref: `refs/heads/${branch}`, before: BEFORE, sha: SHA }, canon.git);
    assert.equal(r.canon, true, `${branch}: ${r.why}`);
    assert.equal(r.base, BEFORE);
    const mixed = plantedGit({ fetch: "", diff: diff("bags/lares/x.mem", "tools/x.mjs") });
    assert.equal(pushScope({ event: "push", ref: `refs/heads/${branch}`, before: BEFORE, sha: SHA }, mixed.git).canon, false, `${branch}: a mixed push reads as code`);
  }
});

test("RED: a develop push with no `before` (a new ref) reads against the commit's parent", () => {
  const p = plantedGit({ fetch: "", [`rev-parse ${SHA}^`]: PARENT, [`diff --no-renames --name-only -z ${PARENT} ${SHA}`]: diff("wikis/w/t.tid") });
  const r = pushScope({ event: "push", ref: "refs/heads/develop", before: ZERO, sha: SHA }, p.git);
  assert.equal(r.canon, true, r.why);
  assert.equal(r.base, PARENT);
});

test("RED: a lane push (and any other branch) reads its change against its merge base with develop", () => {
  for (const ref of ["refs/heads/develop--canon-doorstep", "refs/heads/lane/x", "refs/heads/feature/span"]) {
    const p = plantedGit({ fetch: "", [`merge-base FETCH_HEAD ${SHA}`]: BASE, [`diff --no-renames --name-only -z ${BASE} ${SHA}`]: diff("bags/a.mem") });
    const r = pushScope({ event: "push", ref, before: BEFORE, sha: SHA }, p.git);
    assert.equal(r.canon, true, `${ref}: ${r.why}`);
    assert.equal(r.base, BASE);
    assert.ok(p.calls.some((c) => /^fetch .*origin develop$/.test(c)), `${ref}: the reader fetched no develop to read the merge base from`);
  }
});

test("RED: every other event reads as code without a git call, and a git fault or an empty change fails closed to code", () => {
  for (const event of ["merge_group", "workflow_dispatch", "pull_request"]) {
    const p = plantedGit({});
    assert.equal(pushScope({ event, ref: "refs/heads/develop", before: BEFORE, sha: SHA }, p.git).canon, false, event);
    assert.deepEqual(p.calls, [], `${event}: the reader called git`);
  }
  const broken = plantedGit({ fetch: new Error("fatal: unreachable") });
  const r = pushScope({ event: "push", ref: "refs/heads/develop", before: BEFORE, sha: SHA }, broken.git);
  assert.equal(r.canon, false, "a git fault reads canon-only: the full battery would skip on a push nobody read");
  assert.match(r.why, /unreachable/);
  const empty = plantedGit({ fetch: "", diff: "" });
  assert.equal(pushScope({ event: "push", ref: "refs/heads/develop", before: BEFORE, sha: SHA }, empty.git).canon, false, "an empty change reads nothing ignored");
});

test("RED: the matcher reads GitHub globs; CONTROL: code paths stay un-ignored", () => {
  for (const p of ["bags/lares/ha.ka.ba/x.mem", "bags/a.mem", "README.md", "docs/deep/n.md", "wikis/w/working/t.tid", "CHANGELOG.md"]) assert.equal(isIgnoredPath(p), true, p);
  for (const p of ["tools/land-train.mjs", "packages/a/src/x.ts", "bags/lares/x.json", "bags/x.mem.ts", "wikis", "a/CHANGELOG.md.bak"]) assert.equal(isIgnoredPath(p), false, p);
  assert.equal(onlyIgnoredPaths(["a.md", "bags/q.mem"]), true);
  assert.equal(onlyIgnoredPaths(["a.md", "tools/x.mjs"]), false);
  assert.equal(onlyIgnoredPaths([]), false, "an empty change reads nothing ignored");
});
