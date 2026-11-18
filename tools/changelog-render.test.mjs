// changelog-render: the change record projected from git history. It walks the integration branch's first-parent merges,
// newest first, and reads the trailers of the lane commits each merge brought in (M^1..M^2) through git's own parser.
// Each case builds a scratch repository (real `git init`, `--no-ff` merges); none reads this repo's history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderRange, toMarkdown } from "./changelog-render.mjs";

const TOOL = join(import.meta.dirname, "changelog-render.mjs");
for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete process.env[k];
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "changelog-render-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q", "-b", "develop");
  git(dir, "config", "user.name", "Scratch");
  git(dir, "config", "user.email", "scratch@example.invalid");
  git(dir, "commit", "-q", "--allow-empty", "-m", "root");
  return dir;
}

const commit = (dir, message) => { git(dir, "commit", "-q", "--allow-empty", "-m", message); return git(dir, "rev-parse", "HEAD"); };

/** One lane: branch off develop, carry the commits, merge back `--no-ff` the way the forge does (title as the body's first line). */
function land(dir, n, title, messages, mergeTrailers = "") {
  git(dir, "checkout", "-q", "-b", `lane-${n}`, "develop");
  const shas = messages.map((m) => commit(dir, m));
  git(dir, "checkout", "-q", "develop");
  git(dir, "merge", "-q", "--no-ff", `lane-${n}`, "-m", `Merge pull request #${n} from x/lane-${n}`, "-m", title + (mergeTrailers ? `\n\n${mergeTrailers}` : ""));
  return { merge: git(dir, "rev-parse", "HEAD"), shas };
}

const run = (dir, ...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd: dir, encoding: "utf8" });

test("merges render newest first, each by its PR title, each carrying its own Changed lines", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  const one = land(dir, 1, "the first lane", ["lar:///a.b.c/one — one\n\nChanged: the first change"]);
  const two = land(dir, 2, "the second lane", ["lar:///a.b.c/two — two\n\nChanged: the second change", "lar:///a.b.c/three — three\n\nChanged: the third change"]);
  const quiet = land(dir, 3, "a quiet lane", ["lar:///a.b.c/quiet — no trailers"]);
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  assert.deepEqual(data.merges.map((m) => m.sha), [quiet.merge, two.merge, one.merge]);
  assert.deepEqual(data.merges.map((m) => m.title), ["a quiet lane", "the second lane", "the first lane"]);
  assert.deepEqual(data.merges[1].changed, ["the second change", "the third change"]);
  assert.deepEqual(data.merges[0].changed, []);
  assert.deepEqual(data.problems, []);
});

test("Breaking comes first, each naming its merge's PR title; no operator-acts section renders, since acts live in the house", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  land(dir, 1, "the keep moves", ["lar:///a.b.c/keep — keep\n\nBreaking: the old keep path leaves"]);
  land(dir, 2, "a plain lane", ["lar:///a.b.c/plain — plain\n\nChanged: plain work"]);
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  assert.equal("operatorActs" in data, false);
  assert.deepEqual(data.breaking.map((b) => [b.text, b.title]), [["the old keep path leaves", "the keep moves"]]);
  const md = toMarkdown(data);
  assert.doesNotMatch(md, /Operator acts/);
  const breaking = md.indexOf("## Breaking");
  const merges = md.indexOf("## Merges");
  assert.ok(breaking >= 0 && merges > breaking, md);
  assert.ok(md.indexOf("### a plain lane") < md.indexOf("### the keep moves"), "newest merge first");
  assert.match(md, /### a plain lane[^\n]*\n+- Changed: plain work/);
});

test("Amends: a later commit replaces the named commit's trailer lines of the same key, and leaves its other keys standing", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  const one = land(dir, 1, "the first lane", ["lar:///a.b.c/one — one\n\nChanged: the wrong note\nChanged: a second wrong note\nBreaking: the old flag leaves"]);
  const target = one.shas[0];
  land(dir, 2, "the amending lane", [
    `lar:///a.b.c/amend — amend\n\nAmends: ${target.slice(0, 10)}\nChanged: the right note`,
    "lar:///a.b.c/own — own\n\nChanged: the amending lane's own change",
  ]);
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  const first = data.merges.find((m) => m.title === "the first lane");
  const second = data.merges.find((m) => m.title === "the amending lane");
  assert.deepEqual(first.changed, ["the right note"], "the amendment replaces every Changed line of the target");
  assert.deepEqual(data.breaking.map((b) => b.text), ["the old flag leaves"], "a key the amendment does not carry stays");
  assert.deepEqual(second.changed, ["the amending lane's own change"], "the replacement renders once, under the target's merge");
  assert.deepEqual(data.problems, []);
  assert.match(toMarkdown(data), /### the first lane[^\n]*\n+- Changed: the right note/);
});

test("RED: an Amends naming no commit reads red", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  land(dir, 1, "a lane", ["lar:///a.b.c/amend — amend\n\nAmends: 0123456789abcdef0123456789abcdef01234567\nChanged: a note"]);
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  assert.equal(data.problems.length, 1);
  assert.match(data.problems[0], /Amends/);
  assert.equal(run(dir, `${base}..HEAD`).status, 1);
});

test("RED: a merge commit carrying a record trailer reads red rather than double counting", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  const one = land(dir, 1, "a lane", ["lar:///a.b.c/one — one\n\nBreaking: the lane's own break"], "Breaking: the lane's own break");
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  assert.deepEqual(data.breaking.map((b) => b.text), ["the lane's own break"], "counted once, from the lane commit");
  assert.equal(data.problems.length, 1);
  assert.match(data.problems[0], new RegExp(one.merge.slice(0, 9)));
  assert.match(data.problems[0], /Breaking/);
  const r = run(dir, `${base}..HEAD`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Breaking/);
});

test("a merge whose PR title reads as a `lar:` trailer to git's parser does not read red: only record keys count", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  land(dir, 1, "lar:///x.y.z/slug — a title git parses as a trailer", ["lar:///a.b.c/one — one\n\nChanged: a note"]);
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  assert.deepEqual(data.problems, []);
  assert.equal(data.merges[0].title, "lar:///x.y.z/slug — a title git parses as a trailer");
});

test("the walk follows the first parent only: a lane's own merge of develop brings no record twice", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-q", "-b", "lane-2", "develop");
  commit(dir, "lar:///a.b.c/early — early\n\nChanged: the long lane's work");
  land(dir, 1, "a short lane", ["lar:///a.b.c/short — short\n\nChanged: the short lane's work"]);
  git(dir, "checkout", "-q", "lane-2");
  git(dir, "merge", "-q", "--no-ff", "develop", "-m", "carry develop into the long lane");
  git(dir, "checkout", "-q", "develop");
  git(dir, "merge", "-q", "--no-ff", "lane-2", "-m", "Merge pull request #2 from x/lane-2", "-m", "the long lane");
  const data = renderRange(`${base}..HEAD`, { cwd: dir });
  assert.deepEqual(data.merges.map((m) => [m.title, m.changed]), [
    ["the long lane", ["the long lane's work"]],
    ["a short lane", ["the short lane's work"]],
  ]);
});

test("--json gives the same data structured; plain output gives the markdown", (t) => {
  const dir = scratch(t);
  const base = git(dir, "rev-parse", "HEAD");
  land(dir, 1, "a lane", ["lar:///a.b.c/one — one\n\nChanged: a note"]);
  const json = run(dir, `${base}..HEAD`, "--json");
  assert.equal(json.status, 0, json.stderr);
  const data = JSON.parse(json.stdout);
  assert.deepEqual(data, renderRange(`${base}..HEAD`, { cwd: dir }));
  assert.deepEqual(data.merges[0].changed, ["a note"]);
  const md = run(dir, `${base}..HEAD`);
  assert.equal(md.status, 0, md.stderr);
  assert.equal(md.stdout, toMarkdown(data));
});

test("an argument that names no range exits 2 with a usage line", (t) => {
  const dir = scratch(t);
  const r = run(dir, "HEAD");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/i);
});
