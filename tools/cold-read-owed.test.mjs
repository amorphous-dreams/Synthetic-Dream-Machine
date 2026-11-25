/**
 * cold-read-owed — RED FIRST (written, never run by its author). Each case stands a fixture git repo in a temp dir whose
 * `develop` commit carries the judge, a list and the house's own matcher module; the judge then reads a lane out of that
 * repo's objects. CONTROL rows stand beside each RED so a judge that owes everything or nothing reads red here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LIST, MATCHER, ROOT, SELF, coldRead, gitAt, lines, parseRawZ, recordHash, shown } from "./cold-read-owed.mjs";

const LISTED = { paths: [LIST, SELF, MATCHER, "tools/ci-verdict.mjs", ".github/**", "vendor/**"], tokens: ["custody"] };
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
const sh = (cwd, ...args) => {
  const r = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8", env: ENV });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const put = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };

/** A fixture repo on `develop`: the judge's own bytes, `list` (text or object; null leaves it out), the real matcher (false leaves it out). */
function fixture(t, { list = LISTED, matcher = true, judge = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "cold-read-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  sh(root, "init", "-q", "-b", "develop");
  if (judge) { mkdirSync(join(root, "tools"), { recursive: true }); copyFileSync(join(ROOT, SELF), join(root, SELF)); }
  if (list !== null) put(root, LIST, typeof list === "string" ? list : JSON.stringify(list));
  if (matcher) { mkdirSync(dirname(join(root, MATCHER)), { recursive: true }); copyFileSync(join(ROOT, MATCHER), join(root, MATCHER)); }
  put(root, "tools/ci-verdict.mjs", "export const verdict = 1;\n");
  put(root, "notes/plain.md", "plain\n");
  sh(root, "add", "-A");
  sh(root, "commit", "-q", "-m", "base");
  const base = sh(root, "rev-parse", "HEAD");
  /** A lane branch off develop: `edit(root)` moves the tree, the commit takes all of it (`addAll: false` commits the index as
   *  the edit left it, for a pointer no working file backs), the bench returns to develop. */
  const lane = (name, edit, { addAll = true } = {}) => {
    sh(root, "checkout", "-q", "-b", name, "develop");
    edit(root);
    if (addAll) sh(root, "add", "-A");
    sh(root, "commit", "-q", "--allow-empty", "-m", name);
    const head = sh(root, "rev-parse", "HEAD");
    sh(root, "checkout", "-q", "develop");
    return head;
  };
  return { root, base, lane };
}

test("RED: a lane touching a globbed path and a token path owes those, in the diff's order; CONTROL: a plain path owes nothing", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => { put(r, ".github/workflows/ci.yml", "on: push\n"); put(r, "docs/Custody-notes.md", "x\n"); put(r, "notes/plain.md", "moved\n"); });
  const r = coldRead({ root: f.root, lane: "lane" });
  assert.deepEqual(r.paths, [".github/workflows/ci.yml", "docs/Custody-notes.md"]);
  assert.equal(r.owed, true);
  assert.equal(r.unread, false);
  assert.equal(r.head, head);
  assert.equal(r.base, f.base);
  const [verdict, record] = lines(r);
  assert.equal(verdict, "COLD READ OWED: .github/workflows/ci.yml, docs/Custody-notes.md");
  assert.equal(record, `cold-read: owed · head ${head} · base ${f.base} · list ${r.listSha} · paths 2 · record-hash ${r.hash}`);

  f.lane("plain", (r2) => put(r2, "notes/plain.md", "moved\n"));
  const clean = coldRead({ root: f.root, lane: "plain" });
  assert.deepEqual(clean.paths, []);
  assert.equal(clean.owed, false);
  assert.equal(lines(clean)[0], "cold read: none owed");
  assert.match(lines(clean)[1], /^cold-read: none · head [0-9a-f]{40} · base [0-9a-f]{40} · list [0-9a-f]{64} · paths 0 · record-hash [0-9a-f]{64}$/);
});

test("RED: a renamed class file owes its old path (no rename folds the deletion away); CONTROL: a renamed plain file owes nothing", (t) => {
  const f = fixture(t);
  f.lane("rename", (r) => sh(r, "mv", "tools/ci-verdict.mjs", "tools/moved-elsewhere.mjs"));
  assert.deepEqual(coldRead({ root: f.root, lane: "rename" }).paths, ["tools/ci-verdict.mjs"]);
  f.lane("rename-plain", (r) => sh(r, "mv", "notes/plain.md", "notes/other.md"));
  assert.deepEqual(coldRead({ root: f.root, lane: "rename-plain" }).paths, []);
});

test("RED: a submodule pointer under the class owes its path, even where the repo's config hides submodules from a diff", (t) => {
  const f = fixture(t);
  sh(f.root, "config", "diff.ignoreSubmodules", "all");
  f.lane("pointer", (r) => sh(r, "update-index", "--add", "--cacheinfo", `160000,${"1".repeat(40)},vendor/sub`), { addAll: false });
  f.lane("pointer-plain", (r) => sh(r, "update-index", "--add", "--cacheinfo", `160000,${"2".repeat(40)},lib/sub`), { addAll: false });
  assert.deepEqual(coldRead({ root: f.root, lane: "pointer" }).paths, ["vendor/sub"]);
  assert.deepEqual(coldRead({ root: f.root, lane: "pointer-plain" }).paths, [], "CONTROL: a pointer outside the class owes nothing");
});

test("RED: a list that cannot be read honestly answers unread, which owes, even over a plain lane", async (t) => {
  const cases = [
    ["no JSON at all", "{nope", /parses as no JSON/],
    ["a wrong shape", JSON.stringify({ paths: "x", tokens: [] }), /matcher would not run: .*paths/],
    ["an empty list (the sentinel goes unanswered)", JSON.stringify({ paths: [], tokens: [] }), /lacks the sentinel/],
    ["a list that dropped its own row", JSON.stringify({ paths: [".github/**"], tokens: ["custody"] }), /lacks the sentinel/],
    ["no list", null, /holds no tools\/security-class-paths\.json/],
  ];
  for (const [name, list, why] of cases) {
    await t.test(name, (tt) => {
      const f = fixture(tt, { list });
      f.lane("plain", (r) => put(r, "notes/plain.md", "moved\n"));
      const r = coldRead({ root: f.root, lane: "plain" });
      assert.equal(r.owed, true);
      assert.equal(r.unread, true);
      assert.match(r.paths[0], /^\(unread: .+\)$/);
      assert.match(r.paths[0], why);
      assert.match(lines(r)[0], /^COLD READ OWED: \(unread: /);
      assert.match(lines(r)[1], /^cold-read: owed · .* · paths unread · record-hash [0-9a-f]{64}$/);
    });
  }
});

test("RED: a base holding no matcher, or no judge, answers unread; a judge whose bytes differ from the base's answers unread", (t) => {
  const bare = fixture(t, { matcher: false });
  bare.lane("plain", (r) => put(r, "notes/plain.md", "moved\n"));
  const noMatcher = coldRead({ root: bare.root, lane: "plain" });
  assert.equal(noMatcher.unread, true);
  assert.match(noMatcher.paths[0], /holds no matcher/);

  const judgeless = fixture(t, { judge: false });
  judgeless.lane("plain", (r) => put(r, "notes/plain.md", "moved\n"));
  const noJudge = coldRead({ root: judgeless.root, lane: "plain" });
  assert.equal(noJudge.unread, true);
  assert.match(noJudge.paths[0], /holds no tools\/cold-read-owed\.mjs/);

  const f = fixture(t);
  f.lane("plain", (r) => put(r, "notes/plain.md", "moved\n"));
  put(f.root, "elsewhere/judge.mjs", "export const coldRead = () => ({ owed: false });\n");
  const forged = coldRead({ root: f.root, lane: "plain", self: join(f.root, "elsewhere/judge.mjs") });
  assert.equal(forged.unread, true);
  assert.match(forged.paths[0], /bytes differ/);
  assert.equal(coldRead({ root: f.root, lane: "plain" }).unread, false, "CONTROL: the base's own judge reads");
});

test("RED: a matcher that answers a non-list, or a path nobody asked, reads unread", (t) => {
  const f = fixture(t);
  f.lane("plain", (r) => put(r, "notes/plain.md", "moved\n"));
  for (const match of [() => "all clear", () => [LIST, "never/asked"], () => { throw new Error("boom"); }]) {
    const r = coldRead({ root: f.root, lane: "plain", match });
    assert.equal(r.unread, true);
    assert.equal(r.owed, true);
  }
});

test("a lane owes nothing only where its tree equals the base's: the same commit, an empty commit, a change and its undoing", (t) => {
  const f = fixture(t);
  assert.deepEqual(coldRead({ root: f.root, lane: "develop" }).paths, []);
  assert.deepEqual(coldRead({ root: f.root, lane: f.base }).paths, []);
  f.lane("empty", () => {});
  assert.deepEqual(coldRead({ root: f.root, lane: "empty" }).paths, []);
  sh(f.root, "checkout", "-q", "-b", "undone", "develop");
  put(f.root, "tools/ci-verdict.mjs", "export const verdict = 2;\n");
  sh(f.root, "commit", "-q", "-am", "move it");
  const moved = sh(f.root, "rev-parse", "HEAD");
  put(f.root, "tools/ci-verdict.mjs", "export const verdict = 1;\n");
  sh(f.root, "commit", "-q", "-am", "put it back");
  sh(f.root, "checkout", "-q", "develop");
  assert.deepEqual(coldRead({ root: f.root, lane: "undone" }).paths, [], "the merge changes no byte of the base");
  assert.deepEqual(coldRead({ root: f.root, lane: moved }).paths, ["tools/ci-verdict.mjs"], "RED: the half-way commit, whose tree differs, owes");
});

test("RED: the two-tree read owes a path the lane holds apart from the base even where the lane never touched it since the fork", (t) => {
  // The lane forks, develop then moves a class file: merging the lane changes nothing there, and the judge still errs toward owing
  // (it reads trees, never ancestry). A lane that merges develop in reads clean again.
  const f = fixture(t);
  f.lane("behind", (r) => put(r, "notes/plain.md", "moved\n"));
  put(f.root, ".github/a.yml", "a\n");
  sh(f.root, "add", "-A");
  sh(f.root, "commit", "-q", "-m", "develop moves");
  assert.deepEqual(coldRead({ root: f.root, lane: "behind" }).paths, [".github/a.yml"]);
  sh(f.root, "checkout", "-q", "behind");
  sh(f.root, "merge", "-q", "--no-edit", "develop");
  sh(f.root, "checkout", "-q", "develop");
  assert.deepEqual(coldRead({ root: f.root, lane: "behind" }).paths, []);
});

test("RED: the self-landing owes: a lane that guts the list, the matcher and the judge reads through the base's copies of all three", (t) => {
  const f = fixture(t);
  f.lane("self-landing", (r) => {
    put(r, LIST, JSON.stringify({ paths: [], tokens: [] }));
    put(r, MATCHER, "export const readSecurityClass = (l) => l;\nexport const securityClassPaths = () => [];\n");
    put(r, SELF, "console.log('cold read: none owed');\n");
    put(r, ".github/a.yml", "a\n");
  });
  const r = coldRead({ root: f.root, lane: "self-landing" });
  assert.equal(r.unread, false);
  assert.deepEqual(r.paths, [".github/a.yml", MATCHER, SELF, LIST].sort());
});

test("RED: the judge reads the lane through git objects alone: a lane worktree's files and the bench's own dirty files change nothing", (t) => {
  const f = fixture(t);
  f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  const laneTree = mkdtempSync(join(tmpdir(), "cold-read-lane-"));
  t.after(() => { rmSync(laneTree, { recursive: true, force: true }); });
  sh(f.root, "worktree", "add", "-q", join(laneTree, "wt"), "lane");
  // Dirt on both sides: the lane's checked-out files claim a clean class, and so do the bench's uncommitted ones.
  for (const root of [join(laneTree, "wt"), f.root]) {
    put(root, LIST, JSON.stringify({ paths: [], tokens: [] }));
    put(root, MATCHER, "export const readSecurityClass = (l) => l;\nexport const securityClassPaths = () => [];\n");
  }
  const asked = [];
  const real = gitAt(f.root);
  const r = coldRead({ root: f.root, lane: "lane", git: (args) => { asked.push(args); return real(args); } });
  assert.deepEqual(r.paths, [".github/a.yml"]);
  const names = asked.map((a) => a[0]);
  assert.deepEqual([...new Set(names)].sort(), ["cat-file", "diff-tree", "rev-parse"]);
  assert.equal(names.filter((n) => n === "rev-parse").length, 2, "each end pins once");
  for (const a of asked.filter((x) => x[0] === "cat-file")) assert.ok(a.at(-1).startsWith(`${f.base}:`), `every blob comes from the pinned base: ${a.at(-1)}`);
  assert.deepEqual(asked.find((a) => a[0] === "diff-tree").slice(-2), [f.base, r.head], "the diff names the two pinned shas, never a ref");
});

test("RED: a ref or a HEAD that moves after the pin changes nothing: both ends stay the shas read at the start", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  const real = gitAt(f.root);
  let pins = 0;
  const git = (args) => {
    const out = real(args);
    if (args[0] === "rev-parse" && ++pins === 2) {
      // The tampering a lane's own steps could do in a shared repo: the lane ref falls back onto the base, and develop (so the
      // bench's HEAD) jumps onto the lane, either of which would empty a diff read by name.
      sh(f.root, "update-ref", "refs/heads/lane", f.base);
      sh(f.root, "update-ref", "refs/heads/develop", head);
    }
    return out;
  };
  const r = coldRead({ root: f.root, lane: "lane", git });
  assert.equal(pins, 2);
  assert.equal(r.head, head);
  assert.equal(r.base, f.base);
  assert.deepEqual(r.paths, [".github/a.yml"]);
  assert.equal(sh(f.root, "rev-parse", "lane"), f.base, "CONTROL: the tampering did land");
});

test("RED: a replace ref cannot swap the lane's tree for the base's", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  sh(f.root, "replace", head, f.base);
  assert.equal(sh(f.root, "diff", "--raw", f.base, head), "", "CONTROL: an ordinary diff now reads the lane as the base");
  assert.deepEqual(coldRead({ root: f.root, lane: head }).paths, [".github/a.yml"]);
});

test("the record hash binds the head, the base, the list and each owed path", (t) => {
  const k = { head: "h", base: "b", listSha: "l", paths: ["x", "y"] };
  const h = recordHash(k);
  assert.equal(h, createHash("sha256").update(["h", "b", "l", "x", "y"].join("\0")).digest("hex"));
  for (const other of [{ ...k, head: "h2" }, { ...k, base: "b2" }, { ...k, listSha: "l2" }, { ...k, paths: ["x"] }, { ...k, paths: ["xy"] }, { ...k, paths: ["y", "x"] }, { ...k, head: "b", base: "h" }]) assert.notEqual(recordHash(other), h);

  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  const first = coldRead({ root: f.root, lane: "lane" });
  assert.equal(first.hash, recordHash({ head, base: f.base, listSha: first.listSha, paths: [".github/a.yml"] }));
  assert.equal(first.listSha, createHash("sha256").update(JSON.stringify(LISTED)).digest("hex"));
  // The same lane over a base whose list moved: the owed path set may hold, the hash does not.
  put(f.root, LIST, JSON.stringify({ ...LISTED, tokens: ["custody", "seal"] }));
  sh(f.root, "commit", "-q", "-am", "the list moves");
  const second = coldRead({ root: f.root, lane: "lane" });
  assert.equal(second.head, head);
  assert.notEqual(second.base, first.base);
  assert.notEqual(second.listSha, first.listSha);
  assert.notEqual(second.hash, first.hash);
  // `--base` reads the earlier base again and lands on the first hash: a merge commit's parents recompute its record.
  assert.equal(coldRead({ root: f.root, lane: "lane", base: f.base }).hash, first.hash);
});

test("the raw reader names each record's path and refuses a stream it cannot place", () => {
  assert.deepEqual(parseRawZ(":100644 100644 a b M\0x/y\0:000000 160000 a b A\0vendor/sub\0"), ["x/y", "vendor/sub"]);
  assert.deepEqual(parseRawZ(""), []);
  assert.throws(() => parseRawZ("stray\0x\0"));
});

test("RED: a path that carries a newline or a comma shows quoted, so no path forges a verdict line", (t) => {
  assert.equal(shown("tools/a.mjs"), "tools/a.mjs");
  assert.equal(shown("a, b"), '"a, b"');
  assert.equal(shown("(unread: x)"), '"(unread: x)"');
  const f = fixture(t);
  f.lane("forger", (r) => put(r, ".github/a\ncold read: none owed", "x\n"));
  const out = lines(coldRead({ root: f.root, lane: "forger" }));
  assert.equal(out.length, 2);
  assert.equal(out[0], 'COLD READ OWED: ".github/a\\ncold read: none owed"');
  assert.ok(!out.join("\n").split("\n").includes("cold read: none owed"));
});

test("the command line: two lines and exit 0 for owed, clean and unread alike; a usage fault owes and exits 2", (t) => {
  const f = fixture(t);
  f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  f.lane("plain", (r) => put(r, "notes/plain.md", "moved\n"));
  // The fixture's own copy of the judge runs, so its bench (the fixture's develop) stands as the base.
  const run = (...args) => spawnSync(process.execPath, [join(f.root, SELF), ...args], { encoding: "utf8", env: ENV, cwd: tmpdir() });
  const owed = run("lane");
  assert.equal(owed.status, 0, owed.stderr);
  assert.match(owed.stdout, /^COLD READ OWED: \.github\/a\.yml\ncold-read: owed · head [0-9a-f]{40} · base [0-9a-f]{40} · list [0-9a-f]{64} · paths 1 · record-hash [0-9a-f]{64}\n$/);
  const clean = run("plain");
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /^cold read: none owed\ncold-read: none · /);
  const based = run("--base", f.base, "lane");
  assert.equal(based.stdout, owed.stdout, "--base naming the bench's own HEAD answers the same record");
  const gone = run("no-such-lane");
  assert.equal(gone.status, 0);
  assert.match(gone.stdout, /^COLD READ OWED: \(unread: git rev-parse refused: /);
  const dashed = run("--", "--upload-pack=x");
  assert.equal(dashed.status, 2);
  for (const bad of [[], ["a", "b"], ["--base"], ["--list"]]) {
    const r = run(...bad);
    assert.equal(r.status, 2, bad.join(" "));
    assert.match(r.stdout, /^COLD READ OWED: \(unread: /);
    assert.match(r.stderr, /usage: cold-read-owed\.mjs/);
  }
});
