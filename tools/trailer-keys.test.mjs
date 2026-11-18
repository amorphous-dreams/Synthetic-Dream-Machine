// trailer-keys: every trailer key a range's lane commits carry belongs to the closed set, read through git's own parser.
// Each case builds a scratch repository (real `git init`, real commits, `--no-ff` merges); none reads this repo's history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KNOWN_KEYS, canonicalKey, nearestKey, checkRange } from "./trailer-keys.mjs";

const TOOL = join(import.meta.dirname, "trailer-keys.mjs");
// The scratch repos answer to no global or system config (hooks, signing, templates) and no inherited repo env.
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete process.env[k];
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "trailer-keys-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "config", "user.name", "Scratch");
  git(dir, "config", "user.email", "scratch@example.invalid");
  git(dir, "commit", "-q", "--allow-empty", "-m", "root");
  return dir;
}

const commit = (dir, message) => { git(dir, "commit", "-q", "--allow-empty", "-m", message); return git(dir, "rev-parse", "HEAD"); };
const run = (dir, ...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd: dir, encoding: "utf8" });

test("the known set names the house's record keys and the attribution keys, each in its canonical spelling", () => {
  assert.deepEqual([...KNOWN_KEYS], ["Breaking", "Changed", "Amends", "Co-Authored-By", "Claude-Session", "Signed-off-by"]);
});

test("canonicalKey matches case-insensitively, as git does, and answers the canonical spelling; an unknown key answers null", () => {
  assert.equal(canonicalKey("co-authored-by"), "Co-Authored-By");
  assert.equal(canonicalKey("BREAKING"), "Breaking");
  // Operator acts live in the house, never in git history: the key reads unknown.
  assert.equal(canonicalKey("Operator-Act"), null);
  assert.equal(canonicalKey("Braking"), null);
});

test("nearestKey points a misspelling at the known key it sits closest to", () => {
  assert.equal(nearestKey("Braking"), "Breaking");
  assert.equal(nearestKey("Changd"), "Changed");
  assert.equal(nearestKey("Amend"), "Amends");
  assert.equal(nearestKey("Claude-Sesion"), "Claude-Session");
});

test("a range whose lane commits carry only known keys reads clean and exits 0", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  commit(dir, "lar:///a.b.c/one — first\n\nBody prose.\n\nChanged: the first thing\nCo-Authored-By: Someone <s@example.invalid>");
  commit(dir, "lar:///a.b.c/two — second\n\nBreaking: the old flag leaves\nClaude-Session: https://example.invalid/s");
  assert.deepEqual(checkRange(`${base}..HEAD`, { cwd: dir }).unknown, []);
  const r = run(dir, `${base}..HEAD`);
  assert.equal(r.status, 0, r.stderr);
});

test("RED: an unknown key exits 1 and names the commit, the key and the nearest known key", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  commit(dir, "lar:///a.b.c/fine — fine\n\nChanged: fine");
  const bad = commit(dir, "lar:///a.b.c/typo — typo\n\nBraking: the old flag leaves");
  const found = checkRange(`${base}..HEAD`, { cwd: dir }).unknown;
  assert.deepEqual(found, [{ sha: bad, key: "Braking", nearest: "Breaking" }]);
  const r = run(dir, `${base}..HEAD`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, new RegExp(bad.slice(0, 9)));
  assert.match(r.stderr, /Braking/);
  assert.match(r.stderr, /nearest known key: Breaking/);
});

test("a case variant of a known key passes, and the check names the canonical spelling", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  commit(dir, "lar:///a.b.c/case — case\n\nCo-authored-by: Someone <s@example.invalid>");
  const r = run(dir, `${base}..HEAD`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Co-authored-by/);
  assert.match(r.stdout, /Co-Authored-By/);
});

test("a trailer-shaped line buried mid-body does not parse as a trailer: git's own parser decides, never a grep", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  commit(dir, "lar:///a.b.c/body — body\n\nBraking: this line sits mid-body\n\nand prose follows it, so it is no trailer.");
  assert.equal(run(dir, `${base}..HEAD`).status, 0);
});

test("merge commits stay out of the key check: the lane commits carry the record", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-q", "-b", "lane");
  commit(dir, "lar:///a.b.c/lane — lane\n\nChanged: lane work");
  git(dir, "checkout", "-q", "develop");
  git(dir, "merge", "-q", "--no-ff", "lane", "-m", "Merge pull request #1 from x/lane", "-m", "Mystery: a merge trailer the key check leaves alone");
  assert.equal(run(dir, `${base}..HEAD`).status, 0);
});

test("an argument that names no range exits 2 with a usage line", (t) => {
  const dir = scratch(t);
  const r = run(dir, "HEAD");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/i);
});
