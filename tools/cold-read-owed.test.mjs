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
import { DEVELOP, LIST, MATCHER, ROOT, SELF, checkMerge, coldRead, gitAt, lines, parseRawZ, recordHash, shown } from "./cold-read-owed.mjs";

const LISTED = { paths: [LIST, SELF, MATCHER, "tools/ci-verdict.mjs", ".github/**", "vendor/**"], tokens: ["custody"] };
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
const sh = (cwd, ...args) => {
  const r = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8", env: ENV });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const GIT = ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"];
/** A git call allowed to refuse (a merge that conflicts): its exit status. */
const shStatus = (cwd, ...args) => spawnSync("git", [...GIT, ...args], { cwd, encoding: "utf8", env: ENV }).status;
const put = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };

/** A fixture repo on `develop`, its `refs/remotes/origin/develop` standing at the same commit (`sync()` brings it along after
 *  develop moves; `commit(message)` commits the whole bench tree and syncs): the judge's own bytes, `list` (text or object; null leaves it out), the real matcher (false leaves it out). */
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
  const sync = () => { sh(root, "update-ref", DEVELOP, "HEAD"); return sh(root, "rev-parse", "HEAD"); };
  const commit = (message) => { sh(root, "add", "-A"); sh(root, "commit", "-q", "-m", message); return sync(); };
  sync();
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
  /** One more commit on an existing lane branch. */
  const advance = (name, edit) => {
    sh(root, "checkout", "-q", name);
    edit(root);
    sh(root, "add", "-A");
    sh(root, "commit", "-q", "-m", `${name} moves`);
    const head = sh(root, "rev-parse", "HEAD");
    sh(root, "checkout", "-q", "develop");
    return head;
  };
  return { root, base, lane, advance, sync, commit };
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
  assert.equal(lines(r).length, 3);
  assert.ok(lines(r)[2].startsWith(`land: git merge --no-ff ${head} `), "the landing command names the pinned sha, never the branch");
  assert.ok(lines(r)[2].includes(`"Cold-Read: ${r.hash}"`) && lines(r)[2].includes(`--check-merge HEAD ${head}`));

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

test("RED: a lane head that equals the base refuses, by name or by sha, with or without --base: nothing stands there to merge", (t) => {
  const f = fixture(t);
  for (const r of [coldRead({ root: f.root, lane: "develop" }), coldRead({ root: f.root, lane: f.base }), coldRead({ root: f.root, lane: "HEAD", base: "HEAD" }), coldRead({ root: f.root, lane: f.base, base: f.base })]) {
    assert.equal(r.unread, true);
    assert.equal(r.owed, true);
    assert.match(r.paths[0], /equals the base/);
    assert.equal(lines(r).length, 2, "no landing command rides a refusal of place");
  }
});

test("RED: run from the lane's own worktree the judge refuses: the lane never judges itself against itself", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  const laneTree = mkdtempSync(join(tmpdir(), "cold-read-lane-"));
  t.after(() => { rmSync(laneTree, { recursive: true, force: true }); });
  const wt = join(laneTree, "wt");
  sh(f.root, "worktree", "add", "-q", wt, "lane");
  for (const lane of ["HEAD", "lane", head]) {
    const r = coldRead({ root: wt, lane });
    assert.equal(r.unread, true, lane);
    assert.match(r.paths[0], /differs from refs\/remotes\/origin\/develop/);
    assert.equal(r.landable, false);
  }
  // The lane's own copy of the judge, run as a command from the lane's tree: the same refusal.
  const ran = spawnSync(process.execPath, [join(wt, SELF), "HEAD"], { encoding: "utf8", env: ENV, cwd: wt });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /^COLD READ OWED: \(unread: this bench's HEAD /);
  assert.ok(!ran.stdout.includes("none owed") && !ran.stdout.includes("land: "));
  assert.deepEqual(coldRead({ root: f.root, lane: "lane" }).paths, [".github/a.yml"], "CONTROL: the landing bench reads it");
  // A lane that drags the shared develop ref onto its own head lands on the other refusal.
  sh(f.root, "update-ref", DEVELOP, head);
  const dragged = coldRead({ root: wt, lane: "HEAD" });
  assert.equal(dragged.unread, true);
  assert.match(dragged.paths[0], /equals the base/);
  assert.match(coldRead({ root: f.root, lane: "lane" }).paths[0], /differs from refs\/remotes\/origin\/develop/, "and the landing bench, now off that ref, refuses too");
});

test("a lane owes nothing only where its tree equals the base's: an empty commit, a change and its undoing", (t) => {
  const f = fixture(t);
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
  f.commit("develop moves");
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
  const r = coldRead({ root: f.root, lane: "lane", git: (args, o) => { asked.push(args); return real(args, o); } });
  assert.deepEqual(r.paths, [".github/a.yml"]);
  const names = asked.map((a) => a[0]);
  assert.deepEqual([...new Set(names)].sort(), ["cat-file", "diff-tree", "merge-tree", "rev-parse"]);
  assert.deepEqual(asked.filter((a) => a[0] === "rev-parse").map((a) => a.at(-1)), [`${DEVELOP}^{commit}`, "HEAD^{commit}", "lane^{commit}"], "the base, the bench and the lane each pin once");
  assert.deepEqual(asked.find((a) => a[0] === "merge-tree").slice(-2), [f.base, r.head], "the trial merge names the two pinned shas");
  for (const a of asked.filter((x) => x[0] === "diff-tree")) assert.equal(a.at(-2), f.base, "every diff starts at the pinned base");
  for (const a of asked.filter((x) => x[0] === "cat-file")) assert.ok(a.at(-1).startsWith(`${f.base}:`), `every blob comes from the pinned base: ${a.at(-1)}`);
  assert.deepEqual(asked.find((a) => a[0] === "diff-tree").slice(-2), [f.base, r.head], "the diff names the two pinned shas, never a ref");
});

test("RED: a ref or a HEAD that moves after the pin changes nothing: both ends stay the shas read at the start", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  const real = gitAt(f.root);
  let pins = 0;
  const git = (args, o) => {
    const out = real(args, o);
    if (args[0] === "rev-parse" && ++pins === 3) {
      // The tampering a lane's own steps could do in a shared repo: the lane ref falls back onto the base, and develop (so the
      // bench's HEAD) jumps onto the lane, either of which would empty a diff read by name.
      sh(f.root, "update-ref", "refs/heads/lane", f.base);
      sh(f.root, "update-ref", "refs/heads/develop", head);
      sh(f.root, "update-ref", DEVELOP, head);
    }
    return out;
  };
  const r = coldRead({ root: f.root, lane: "lane", git });
  assert.equal(pins, 3);
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
  f.commit("the list moves");
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
  assert.equal(out.length, 3);
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
  assert.match(owed.stdout, /^COLD READ OWED: \.github\/a\.yml\ncold-read: owed · head [0-9a-f]{40} · base [0-9a-f]{40} · list [0-9a-f]{64} · paths 1 · record-hash [0-9a-f]{64}\nland: git merge --no-ff [0-9a-f]{40} .*\n$/);
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
  for (const bad of [[], ["a", "b"], ["--base"], ["--list"], ["--check-merge"], ["--check-merge", "HEAD", "a", "b"], ["lane", "--base", "--check-merge"]]) {
    const r = run(...bad);
    assert.equal(r.status, 2, bad.join(" "));
    assert.match(r.stdout, /^COLD READ OWED: \(unread: /);
    assert.match(r.stderr, /usage: cold-read-owed\.mjs/);
  }
});

test("RED: a lane pushed after the read lands another head, and --check-merge catches it by the message's hash and by the pinned sha", (t) => {
  const f = fixture(t);
  const read = f.lane("lane", (r) => put(r, "notes/plain.md", "moved\n"));
  const r = coldRead({ root: f.root, lane: "lane" });
  assert.deepEqual(r.paths, [], "the read saw a plain lane");
  const late = f.advance("lane", (r2) => put(r2, ".github/late.yml", "late\n"));
  // The landing by BRANCH NAME takes the later head; the message still quotes the read's hash.
  sh(f.root, "merge", "-q", "--no-ff", "-m", "land the lane", "-m", `Cold-Read: ${r.hash}`, "lane");
  const byMessage = checkMerge({ root: f.root, merge: "HEAD" });
  assert.equal(byMessage.unread, true);
  assert.equal(byMessage.head, late);
  assert.match(byMessage.paths[0], /quotes another read's hash/);
  const bySha = checkMerge({ root: f.root, merge: "HEAD", head: read });
  assert.equal(bySha.unread, true);
  assert.match(bySha.paths[0], /lane moved after the read/);
  assert.match(lines(bySha)[0], /^COLD READ OWED: \(unread: /);
  assert.match(checkMerge({ root: f.root, merge: "HEAD", head: "lane" }).paths.join(), /\.github\/late\.yml/, "CONTROL: held to the head it truly merged, the judge names what that head owes");

  // CONTROL: the landing by the pinned sha, message intact, reads through, and its record covers the merge sha.
  sh(f.root, "reset", "-q", "--hard", f.base);
  sh(f.root, "merge", "-q", "--no-ff", "-m", "land the lane", "-m", `Cold-Read: ${r.hash}`, read);
  const merge = sh(f.root, "rev-parse", "HEAD");
  for (const ok of [checkMerge({ root: f.root, merge: "HEAD" }), checkMerge({ root: f.root, merge, head: read })]) {
    assert.equal(ok.unread, false, ok.paths[0]);
    assert.deepEqual(ok.paths, []);
    assert.deepEqual([ok.merge, ok.base, ok.head], [merge, f.base, read]);
    assert.equal(ok.hash, recordHash({ head: merge, base: f.base, listSha: ok.listSha, paths: [] }));
    assert.deepEqual(lines(ok), ["cold read: none owed", `cold-read: none · merge ${merge} · head ${read} · base ${f.base} · list ${ok.listSha} · paths 0 · record-hash ${ok.hash}`]);
  }
  // A message carrying no line, and no sha handed over: nothing ties the merge to a read.
  sh(f.root, "reset", "-q", "--hard", f.base);
  sh(f.root, "merge", "-q", "--no-ff", "-m", "land the lane", read);
  assert.match(checkMerge({ root: f.root, merge: "HEAD" }).paths[0], /quotes 0 Cold-Read lines/);
  // A commit of another shape, and a merge whose first parent stands off the base.
  assert.match(checkMerge({ root: f.root, merge: read, head: read }).paths[0], /holds 1 parent/);
  const landed = f.sync();
  assert.match(checkMerge({ root: f.root, merge: landed, head: read }).paths[0], /first parent .* differs from the base/);
  assert.equal(checkMerge({ root: f.root, merge: landed, head: read, base: f.base }).unread, false, "--base names the first parent on the caller's own word");
});

test("RED: a directory renamed on the lane carries develop's new file to a path neither tree holds, and the class still names it", (t) => {
  const f = fixture(t, { list: { paths: [LIST, SELF, MATCHER, "e/x.txt"], tokens: [] } });
  put(f.root, "d/a.txt", "first file, long enough to pair\n");
  put(f.root, "d/b.txt", "second file, long enough to pair\n");
  f.commit("a directory");
  const head = f.lane("lane", (r) => sh(r, "mv", "d", "e"));
  put(f.root, "d/x.txt", "develop's new file\n");
  const base = f.commit("develop adds d/x.txt");
  // The two trees alone: develop holds d/x.txt, the lane holds no x.txt anywhere, so e/x.txt appears in neither.
  assert.ok(!parseRawZ(gitAt(f.root)(["diff-tree", "-r", "--no-renames", "--raw", "-z", base, head])).includes("e/x.txt"), "CONTROL: the two-tree diff never names e/x.txt");
  // git's default asks a hand to place the file: a conflict, so unread.
  const asked = coldRead({ root: f.root, lane: head });
  assert.equal(asked.unread, true);
  assert.match(asked.paths[0], /conflicts or refuses/);
  assert.equal(asked.landable, true, "the familiar still lands it by hand, by the pinned sha");
  // Where the bench's git places the file itself, the trial merge's tree names e/x.txt; a git whose plumbing reads no such
  // setting keeps answering the conflict. Either way the read never comes back clean.
  sh(f.root, "config", "merge.directoryRenames", "true");
  const placed = coldRead({ root: f.root, lane: head });
  assert.equal(placed.owed, true);
  if (!placed.unread) assert.deepEqual(placed.paths, ["e/x.txt"]);
  // The real merge, re-judged against its own tree.
  sh(f.root, "merge", "-q", "--no-ff", "-m", "land the rename", head);
  assert.equal(sh(f.root, "ls-files", "e/x.txt"), "e/x.txt", "CONTROL: the merge did place the file there");
  const merged = checkMerge({ root: f.root, merge: "HEAD", head });
  assert.equal(merged.unread, false, merged.paths[0]);
  assert.deepEqual(merged.paths, ["e/x.txt"]);
});

test("RED: a hand-resolved merge whose resolution touches a class path owes that path, and a quiet extra in a clean merge reads as beyond the read", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, "notes/plain.md", "the lane's line\n"));
  put(f.root, "notes/plain.md", "develop's line\n");
  const base = f.commit("develop moves the same line");
  const read = coldRead({ root: f.root, lane: head });
  assert.equal(read.unread, true);
  assert.match(read.paths[0], /conflicts or refuses/);
  assert.ok(lines(read)[2].startsWith(`land: git merge --no-ff ${head} `));
  assert.notEqual(shStatus(f.root, "merge", "-q", "--no-ff", "-m", "land by hand", head), 0, "CONTROL: the real merge conflicts too");
  put(f.root, "notes/plain.md", "both lines, by hand\n");
  put(f.root, ".github/slipped-in.yml", "on: push\n");
  sh(f.root, "add", "-A");
  sh(f.root, "commit", "-q", "-m", "land by hand");
  const resolved = checkMerge({ root: f.root, merge: "HEAD", head });
  assert.equal(resolved.unread, false, resolved.paths[0]);
  assert.deepEqual(resolved.paths, [".github/slipped-in.yml"]);
  assert.deepEqual([resolved.base, resolved.head], [base, head]);
  assert.deepEqual(resolved.beyond, [], "an unread read named no paths to stand beyond");

  // A clean merge that a hand amends before committing: the read owed nothing, the merge owes the extra.
  const next = f.sync();
  const plain = f.lane("plain", (r) => put(r, "notes/other.md", "other\n"));
  const clean = coldRead({ root: f.root, lane: plain });
  assert.deepEqual(clean.paths, []);
  sh(f.root, "merge", "-q", "--no-ff", "--no-commit", plain);
  put(f.root, ".github/amended.yml", "on: push\n");
  sh(f.root, "add", "-A");
  sh(f.root, "commit", "-q", "-m", "land plain", "-m", `Cold-Read: ${clean.hash}`);
  for (const amended of [checkMerge({ root: f.root, merge: "HEAD" }), checkMerge({ root: f.root, merge: "HEAD", head: plain })]) {
    assert.equal(amended.unread, false, amended.paths[0]);
    assert.equal(amended.base, next);
    assert.deepEqual(amended.paths, [".github/amended.yml"]);
    assert.deepEqual(amended.beyond, [".github/amended.yml"]);
    assert.equal(lines(amended)[0], "COLD READ OWED: .github/amended.yml");
    assert.equal(lines(amended)[2], "cold-read: beyond the read: .github/amended.yml");
  }
});

test("the command line re-judges a merge: `--check-merge HEAD <head-sha>` after the landing, from the bench", (t) => {
  const f = fixture(t);
  const head = f.lane("lane", (r) => put(r, ".github/a.yml", "a\n"));
  sh(f.root, "merge", "-q", "--no-ff", "-m", "land", head);
  const run = (...args) => spawnSync(process.execPath, [join(f.root, SELF), ...args], { encoding: "utf8", env: ENV, cwd: tmpdir() });
  const ok = run("--check-merge", "HEAD", head);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^COLD READ OWED: \.github\/a\.yml\ncold-read: owed · merge [0-9a-f]{40} · head [0-9a-f]{40} · base [0-9a-f]{40} · list [0-9a-f]{64} · paths 1 · record-hash [0-9a-f]{64}\n$/);
  const unbound = run("--check-merge", "HEAD");
  assert.equal(unbound.status, 0);
  assert.match(unbound.stdout, /^COLD READ OWED: \(unread: .*quotes 0 Cold-Read lines/);
  const wrong = run("--check-merge", "HEAD", f.base);
  assert.match(wrong.stdout, /^COLD READ OWED: \(unread: .*lane moved after the read/);
});
