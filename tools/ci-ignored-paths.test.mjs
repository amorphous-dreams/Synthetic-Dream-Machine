// ci-ignored-paths.test.mjs — one list of meme, docs and wiki paths: held-out's push trigger skips them, CI's scope job reads
// whether a push changes them alone (the canon doorstep), and the land guard reads them. GitHub Actions cannot read a file
// into `paths-ignore`, so held-out's globs are pinned equal to the file here; CI's push trigger carries none, since a
// trigger filter cannot vary by branch and stops the run before any job (and so any required check) is read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IGNORED_PATHS, isIgnoredPath, laneScope, onlyIgnoredPaths, pushScope, scopeLines } from "./ci-ignored-paths.mjs";
import { TEST_CELLS } from "./ci-cells.mjs";

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
    return typeof v === "function" ? v(args) : v;
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

// ── the lane's targeted cells: the packages a lane diff touches, closed over their in-repo dependents ──────────
// The planted git serves the live tree's own package.json files, so each vector reads the workspace graph that stands.
function liveGit(paths) {
  return plantedGit({
    fetch: "",
    [`merge-base FETCH_HEAD ${SHA}`]: BASE,
    [`diff --no-renames --name-only -z ${BASE} ${SHA}`]: diff(...paths),
    [`ls-tree --name-only ${SHA} packages/`]: readdirSync(join(ROOT, "packages")).map((d) => `packages/${d}`).join("\n") + "\n",
    [`show ${SHA}:`]: (args) => readFileSync(join(ROOT, args.at(-1).slice(SHA.length + 1)), "utf8"),
  });
}
const lanePush = (paths, ref = "refs/heads/develop--x") => laneScope({ event: "push", ref, before: BEFORE, sha: SHA }, liveGit(paths).git);
const ALL_CELLS = TEST_CELLS.map((c) => c.cell);

test("RED: a lane diff inside packages/lares-cli selects @lares/cli alone (nothing in the repo depends on it), and its one cell", () => {
  const s = lanePush(["packages/lares-cli/src/x.ts"]);
  assert.equal(s.canon, false);
  assert.deepEqual(s.packages, ["@lares/cli"], s.why);
  assert.deepEqual(s.cells, ["cli-mesh"]);
  assert.equal(s.witnesses, false, "a lane code diff that moved no canon runs no witness cell");
  const harness = lanePush(["tests/e2e/x.test.ts"]);
  assert.deepEqual([harness.packages, harness.cells], [["@lares/harness"], ["cli-mesh"]]);
});

test("RED: a mesh diff selects mesh and every in-repo package that depends on it, so every cell runs", () => {
  const s = lanePush(["packages/lararium-mesh/src/x.ts"]);
  for (const name of ["@lararium/mesh", "@lararium/mempalace", "@lararium/sensorium", "@lararium/tw5", "@lararium/keyhive", "@lararium/browser", "@lararium/node", "@lararium/web", "@lares/cli"]) {
    assert.ok(s.packages.includes(name), `${name} depends on mesh and was not selected: ${s.packages}`);
  }
  assert.ok(!s.packages.includes("@lararium/memetic-frame"), "memetic-frame does not depend on mesh");
  assert.deepEqual(s.cells, ALL_CELLS);
});

test("RED: a workflow edit, a tools/ edit, the root package.json or lockfile, and an unmapped path select the full battery", () => {
  for (const p of [".github/workflows/ci.yml", "tools/ci-cells.mjs", "package.json", "pnpm-lock.yaml", "bags/lares/x.json", "mempalace", "packages/tree-sitter-memetic-wikitext/grammar.js"]) {
    const s = lanePush(["packages/lares-cli/src/x.ts", p]);
    assert.equal(s.packages, "all", `${p}: ${s.why}`);
    assert.deepEqual(s.cells, ALL_CELLS, p);
    assert.equal(s.witnesses, true, `${p}: the full battery runs the witness cells`);
  }
});

test("RED: canon beside code on a lane runs the code's cells and the witness cells; canon alone keeps the doorstep", () => {
  const mixed = lanePush(["packages/lares-cli/src/x.ts", "bags/lares/ha.ka.ba/x.mem"]);
  assert.deepEqual(mixed.packages, ["@lares/cli"]);
  assert.equal(mixed.witnesses, true, "canon moved: the witnesses that read it run");
  const canon = lanePush(["bags/lares/ha.ka.ba/x.mem", "README.md"]);
  assert.equal(canon.canon, true);
  assert.deepEqual([canon.packages, canon.cells, canon.witnesses], ["none", [], false]);
});

test("RED: a lane that moves a source genesis carries (the engine's inputs, a packed plugin file) runs the witness cells, so genesis-parity reads it before the merge", () => {
  for (const p of ["packages/lararium-tw5/plugins/lares-memetic-wikitext.json", "packages/lararium-tw5/plugins/lares-lararium.json", "packages/lararium-tw5/plugins/lararium-boot-shadows.json",
    "packages/lararium-tw5/src/generated-tw5-version.ts", "packages/lararium-tw5/scripts/build-tw5-vendor.ts", "TiddlyWiki5"]) {
    const s = lanePush([p]);
    assert.equal(s.witnesses, true, `${p}: ${s.why}`);
    assert.match(s.why, /genesis/, `${p}: the scope names why the witnesses run`);
  }
  // A nested plugin file never packs (`genesisPackedPluginFiles`), and any other tw5 source keeps the narrow lane.
  for (const p of ["packages/lararium-tw5/plugins/standalone/lares-memetic-wikitext.tid", "packages/lararium-tw5/plugins/standalone/lares-lararium.tid", "packages/lararium-tw5/src/carrier-edges.ts"]) {
    assert.equal(lanePush([p]).witnesses, false, p);
  }
});

test("RED: develop, main, a feature span and every other event run the full battery whatever the diff; a git fault fails open", () => {
  for (const ref of ["refs/heads/develop", "refs/heads/main", "refs/heads/feature/span"]) {
    const s = laneScope({ event: "push", ref, before: BEFORE, sha: SHA }, plantedGit({ fetch: "", "merge-base": BASE, diff: diff("packages/lares-cli/src/x.ts") }).git);
    assert.deepEqual([s.packages, s.cells, s.witnesses], ["all", ALL_CELLS, true], ref);
  }
  for (const event of ["merge_group", "workflow_dispatch", "pull_request"]) {
    const s = laneScope({ event, ref: "refs/heads/develop--x", before: BEFORE, sha: SHA }, plantedGit({}).git);
    assert.deepEqual([s.packages, s.witnesses], ["all", true], event);
  }
  const broken = laneScope({ event: "push", ref: "refs/heads/develop--x", before: BEFORE, sha: SHA }, plantedGit({ fetch: "", "merge-base": BASE, diff: diff("packages/lares-cli/a.ts"), "ls-tree": new Error("fatal: no tree") }).git);
  assert.equal(broken.packages, "all", "an unread workspace graph would select fewer cells than it owes");
});

test("RED: the scope prints the GITHUB_OUTPUT lines the cells read, and no cell id hides inside another (the steps match by contains())", () => {
  assert.equal(scopeLines(lanePush(["packages/lares-cli/src/x.ts"])), "canon=false\npackages=@lares/cli\ncells=cli-mesh\nwitnesses=false");
  for (const a of ALL_CELLS) for (const b of ALL_CELLS) if (a !== b) assert.ok(!b.includes(a), `${a} hides inside ${b}`);
});
