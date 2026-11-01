// land-train.test — the land train's law. Pure parts take recorded text; the flow runs over a REAL scratch git origin
// (a bare repo, a span checkout, lane branches) with the network, the container-free train and the disk injected, so no
// test pushes anything real and none reads GitHub.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as LT from "./land-train.mjs";
import {
  ACTIVE_STATUSES, activeRuns, diskRefusal, ghEnv, landTrain, parseSpec, readSuiteLog, repoOfRemote, runsToCancel, sharedPackages, spanPushRefusal, verdictWords, worktreeCapRefusal,
} from "./land-train.mjs";

const SPAN = "feature/span";
const sh = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// ── pure parts ───────────────────────────────────────────────────────────────────────────────────────────────
test("parseSpec reads suffix:pr:head:msgfile and refuses a malformed spec", () => {
  assert.deepEqual(parseSpec("k19:127:" + "a".repeat(40) + ":/m/k19.txt"), { suffix: "k19", pr: "127", head: "a".repeat(40), msg: "/m/k19.txt" });
  assert.throws(() => parseSpec("k19:127:abc"), /suffix:pr:head:msgfile/);
  assert.throws(() => parseSpec("k19:x:" + "a".repeat(40) + ":/m"), /pull request number/);
  assert.throws(() => parseSpec("k19:1:short:/m"), /full 40-hex head/);
});

test("RED: a suite log with no `Test Files` line reads RED (the measured exit-0 load throw); \"1 failed\" over exit 0 reads RED; CONTROL: a clean tally reads ok", () => {
  assert.equal(readSuiteLog("Error: cannot find module\n", 0).ok, false);
  assert.match(readSuiteLog("Error: cannot find module\n", 0).why, /no tally/);
  assert.equal(readSuiteLog(" Test Files  1 failed | 3 passed (4)\n      Tests  1 failed | 30 passed (31)\n", 0).ok, false);
  assert.match(readSuiteLog(" Test Files  1 failed | 3 passed (4)\n", 0).why, /failed/);
  assert.equal(readSuiteLog(" Test Files  4 passed (4)\n      Tests  31 passed (31)\n", 1).ok, false, "a clean tally over a non-zero exit is no green either");
  const ok = readSuiteLog("\x1b[32m Test Files \x1b[39m 4 passed (4)\n      Tests  31 passed (31)\n", 0);
  assert.equal(ok.ok, true);
  assert.match(ok.tally, /31 passed/);
});

test("the shared-package set derives from the lanes' diffs: two lanes touching mesh read mesh's suite", () => {
  const diffs = { a: ["packages/lararium-mesh/src/x.ts", "packages/lares-cli/y.ts", "tools/t.mjs"], b: ["packages/lararium-mesh/src/z.ts"], c: ["packages/lares-cli/w.ts"] };
  assert.deepEqual(sharedPackages(diffs), ["packages/lararium-mesh", "packages/lares-cli"]);
  assert.deepEqual(sharedPackages({ a: ["packages/p/x"], b: ["docs/y"] }), [], "one lane alone shares nothing");
});

test("the disk floor reads LARES_DISK_MIN_C_GB (default 60) and / (40); the worktree cap is 6 counting the train's own", () => {
  assert.equal(diskRefusal({ cGb: 60, rootGb: 40 }, {}), null);
  assert.match(diskRefusal({ cGb: 59.8, rootGb: 90 }, {}), /C: 59\.8G/);
  assert.equal(diskRefusal({ cGb: 45, rootGb: 90 }, { LARES_DISK_MIN_C_GB: "40" }), null);
  assert.match(diskRefusal({ cGb: 90, rootGb: 39 }, {}), /\/: 39G/);
  assert.equal(worktreeCapRefusal(5), null);
  assert.match(worktreeCapRefusal(6), /WORKTREE CAP: 6/);
});

test("the span takes a push only while no run flies on it; landed lanes' unfinished runs cancel, finished ones stay", () => {
  assert.equal(spanPushRefusal([{ status: "completed" }]), null);
  assert.match(spanPushRefusal([{ status: "completed" }, { status: "in_progress" }]), /1 run\(s\) still in flight/);
  assert.deepEqual(runsToCancel([{ databaseId: 1, status: "completed" }, { databaseId: 2, status: "queued" }, { databaseId: 3, status: "in_progress" }]), [2, 3]);
  // RED: cancel follows the pushed sha, never the branch: the lane's NEXT feature (another head) keeps its runs.
  assert.deepEqual(runsToCancel([{ databaseId: 2, status: "queued", headSha: "L" }, { databaseId: 3, status: "in_progress", headSha: "H2" }], "L"), [2]);
});

// ── the flow over a real scratch origin ──────────────────────────────────────────────────────────────────────
function world(lanes = ["a", "b"], { touch = (s) => `packages/p-${s}/f.txt` } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "land-train-"));
  const origin = join(dir, "origin.git"), work = join(dir, "work");
  sh(dir, "init", "-q", "--bare", "-b", SPAN, origin);
  sh(dir, "clone", "-q", origin, work);
  const cfg = (...a) => sh(work, "config", ...a);
  cfg("user.name", "Test Lane"); cfg("user.email", "test@example.com");
  const commit = (wt, file, body, msg) => { mkdirSync(join(wt, file, ".."), { recursive: true }); writeFileSync(join(wt, file), body); sh(wt, "add", "-A"); sh(wt, "commit", "-q", "-m", msg); return sh(wt, "rev-parse", "HEAD"); };
  commit(work, "README", "base\n", "base");
  // The security-class table stands in the span's tree (the queue reads it from the span head, never from a lane).
  commit(work, "tools/security-class-paths.json", `${JSON.stringify({ paths: ["tools/security-class-paths.json", "tools/land-train.mjs", ".github/**"], tokens: ["custody"] })}\n`, "the security table");
  sh(work, "push", "-q", "origin", SPAN);
  const base = sh(work, "rev-parse", "HEAD");
  const heads = {}, msgs = {};
  for (const s of lanes) {
    sh(work, "checkout", "-q", "-b", `${SPAN}--${s}`, base);
    heads[s] = commit(work, touch(s), `${s}\n`, `lane ${s}`);
    sh(work, "push", "-q", "origin", `${SPAN}--${s}`);
    msgs[s] = join(dir, `${s}.msg`); writeFileSync(msgs[s], `lar:///w/${s} — merge PR #${100 + lanes.indexOf(s)}: lane ${s}\n`);
  }
  sh(work, "checkout", "-q", SPAN);
  return { dir, origin, work, base, heads, msgs, lanes, cfg, commit };
}
const specsOf = (w, only = w.lanes) => only.map((s) => `${s}:${100 + w.lanes.indexOf(s)}:${w.heads[s]}:${w.msgs[s]}`);

/** The injected ops: network, disk and the train are stand-ins; git is real. */
function opsOf(w, over = {}) {
  const calls = { train: 0, cancelled: [], verdicts: [], removed: [] };
  const git = (args, o = {}) => execFileSync("git", args, { cwd: o.cwd ?? w.work, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...o.env } }).trim();
  const ops = {
    git,
    verdict: async (branch, sha) => { calls.verdicts.push([branch, sha]); return { ci: "green", heldOut: "green" }; },
    disk: () => ({ cGb: 100, rootGb: 100 }),
    houseWorktrees: () => 1,
    spanRuns: () => [],
    cancelRuns: async (branch, sha) => { calls.cancelled.push(branch); calls.cancelShas = [...(calls.cancelShas ?? []), sha]; return [1]; },
    readMsg: (p) => (existsSync(p) ? readFileSync(p, "utf8") : ""),
    removeWorktree: (wt) => { calls.removed.push(wt); sh(w.work, "worktree", "remove", "--force", wt); },
    sleep: async () => {},
    env: {},
    log: () => {},
    // The train stand-in: merges the lanes over the span in a real worktree and reads green.
    train: async ({ name, lanes, span }) => {
      calls.train++;
      const wt = join(w.dir, `wt-${name}`);
      sh(w.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      for (const l of lanes) sh(wt, "-c", "user.name=Train", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${l.suffix}`);
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
    ...over,
  };
  return { ops, calls };
}
const run = (w, over, opts = {}, only) => {
  const { ops, calls } = opsOf(w, over);
  const lines = []; ops.log = (l) => lines.push(l);
  return landTrain({ name: "t1", local: true, specs: specsOf(w, only), span: SPAN, cwd: w.work, ...opts }, ops).then((r) => ({ ...r, calls, out: lines.join("\n") }));
};
const originRef = (w, ref) => sh(w.origin, "rev-parse", ref);

test("CONTROL: a recorded clean batch of two lanes lands as chained commits whose last tree is the train's tree", async () => {
  const w = world();
  const r = await run(w);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.calls.train, 1);
  const spanHead = originRef(w, SPAN);
  assert.equal(spanHead, sh(w.work, "rev-parse", "HEAD"), "the span checkout fast-forwarded to what it pushed");
  const [second, first] = sh(w.work, "rev-list", "--first-parent", "-2", spanHead).split("\n");
  assert.equal(sh(w.work, "rev-parse", `${first}^`), w.base);
  assert.equal(sh(w.work, "rev-parse", `${first}^2`), w.heads.a);
  assert.equal(sh(w.work, "rev-parse", `${second}^`), first, "the second land chains on the first");
  assert.equal(sh(w.work, "rev-parse", `${second}^2`), w.heads.b);
  assert.match(sh(w.work, "log", "-1", "--format=%s", first), / — merge PR #100:/);
  assert.equal(originRef(w, `${SPAN}--a`), first, "each lane branch moves to its land commit");
  assert.equal(originRef(w, `${SPAN}--b`), second);
  assert.deepEqual(r.calls.cancelled.sort(), [`${SPAN}--a`, `${SPAN}--b`]);
  assert.equal(r.calls.removed.length, 1, "the train worktree leaves after the final-tree check passed");
});

test("author identity comes from git config, never hard-coded", async () => {
  const w = world(["a"]);
  w.cfg("user.name", "Some Other Operator"); w.cfg("user.email", "other@example.org");
  // A lane that does not hold the span head goes through the train; advance the span first.
  const r = await run(w, {}, {}, ["a"]);
  assert.equal(r.code, 0, r.out);
  assert.equal(sh(w.work, "log", "-1", "--format=%an <%ae>|%cn <%ce>", SPAN), "Some Other Operator <other@example.org>|Some Other Operator <other@example.org>");
  const w2 = world(["a"]);
  w2.cfg("user.name", ""); 
  const r2 = await run(w2, {}, {}, ["a"]);
  assert.equal(r2.code, 2);
  assert.match(r2.out, /git config user\.name/);
});

test("RED: --plan prints the commits it would write and pushes nothing, builds no worktree and runs no train", async () => {
  const w = world();
  const before = [originRef(w, SPAN), originRef(w, `${SPAN}--a`), originRef(w, `${SPAN}--b`)];
  const r = await run(w, {}, { plan: true });
  assert.equal(r.code, 0, r.out);
  assert.equal(r.calls.train, 0);
  assert.deepEqual([originRef(w, SPAN), originRef(w, `${SPAN}--a`), originRef(w, `${SPAN}--b`)], before);
  assert.equal(sh(w.work, "worktree", "list").split("\n").length, 1, "no worktree stands");
  assert.match(r.out, /PLAN .*lane a.*PR #100/);
  assert.match(r.out, /PLAN .*lane b.*PR #101/);
  assert.match(r.out, new RegExp(w.heads.a.slice(0, 9)));
  assert.match(r.out, / — merge PR #100:/, "the land message's subject is printed");
  assert.equal(r.calls.cancelled.length, 0);
});

test("RED: a span commit since base whose subject lacks ` — merge PR #` refuses (exit 3) unless read GREEN at its sha; CONTROL: a land passes", async () => {
  const w = world(["a"]);
  // The span moved by a road commit after the lanes branched: the lane then lacks nothing it needs (base stays on the span).
  const road = w.commit(w.work, "road.txt", "r\n", "a road commit");
  sh(w.work, "push", "-q", "origin", SPAN);
  const ungreen = await run(w, { verdict: async (b) => (b === SPAN ? { ci: "red", heldOut: "green" } : { ci: "green", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(ungreen.code, 3, ungreen.out);
  assert.match(ungreen.out, /NON-LAND COMMIT NOT READ GREEN/);
  assert.equal(ungreen.calls.train, 0);
  const green = await run(w, {}, {}, ["a"]);
  assert.equal(green.code, 0, green.out);
  assert.ok(green.calls.verdicts.some(([b, s]) => b === SPAN && s === road), "the road commit was read at its exact sha on the span");
});

test("RED: a newer road commit read GREEN carries the older road commits beneath it (their runs cancelled by the next push); CONTROL: the newest road commit not green still refuses", async () => {
  const w = world(["a"]);
  const older = w.commit(w.work, "road.txt", "r1\n", "an older road commit");
  const newer = w.commit(w.work, "road2.txt", "r2\n", "a newer road commit");
  sh(w.work, "push", "-q", "origin", SPAN);
  const cancelledBelow = async (branch, sha) => (sha === older ? { ci: "cancelled", heldOut: "cancelled" } : { ci: "green", heldOut: "green" });
  const carried = await run(w, { verdict: cancelledBelow }, {}, ["a"]);
  assert.equal(carried.code, 0, carried.out);
  assert.match(carried.out, /carried by .*GREEN/);
  // CONTROL: the newest road commit itself reads not green, so nothing carries it.
  const w2 = world(["a"]);
  w2.commit(w2.work, "road.txt", "r1\n", "an older road commit");
  const newest = w2.commit(w2.work, "road2.txt", "r2\n", "a newer road commit");
  sh(w2.work, "push", "-q", "origin", SPAN);
  const headRed = await run(w2, { verdict: async (b, sha) => (sha === newest ? { ci: "red", heldOut: "green" } : { ci: "green", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(headRed.code, 3, headRed.out);
  assert.match(headRed.out, /NON-LAND COMMIT NOT READ GREEN/);
  void newer;
});

test("RED: an UNREADABLE verdict is never not-green: it waits, then exits 10 (its own code), neither 3 nor 8", async () => {
  const w = world(["a"]);
  const road = w.commit(w.work, "road.txt", "r\n", "a road commit"); void road;
  sh(w.work, "push", "-q", "origin", SPAN);
  const dark = await run(w, { verdict: async () => ({ ci: "unreadable", heldOut: "unreadable" }) }, {}, ["a"]);
  assert.equal(dark.code, 10, dark.out);
  assert.match(dark.out, /UNREADABLE/);
  const w2 = world(["a"]);
  const dark2 = await run(w2, { verdict: async () => ({ ci: "unreadable", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(dark2.code, 10, "an unreadable lane verdict is no red either");
  // CONTROL: one dark read, then green, lands.
  const w3 = world(["a"]);
  let n = 0;
  const flaky = await run(w3, { verdict: async () => (++n === 1 ? { ci: "unreadable", heldOut: "green" } : { ci: "green", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(flaky.code, 0, flaky.out);
});

test("RED: a moved head refuses 3; a lane sharing no history with the span refuses 2; a lane not green refuses 8", async () => {
  const w = world();
  const moved = await run(w, {}, {}, undefined);
  assert.equal(moved.code, 0);
  const w1 = world();
  const specs = specsOf(w1); specs[0] = specs[0].replace(w1.heads.a, "f".repeat(40));
  const { ops } = opsOf(w1); const lines = []; ops.log = (l) => lines.push(l);
  const r1 = await landTrain({ name: "t", local: true, specs, span: SPAN, cwd: w1.work }, ops);
  assert.equal(r1.code, 3); assert.match(lines.join("\n"), /HEAD MOVED: a/);
  // a lane with no common base: branch it from an orphan root.
  const w2 = world(["a"]);
  sh(w2.work, "checkout", "-q", "--orphan", "stray"); sh(w2.work, "rm", "-rfq", "."); writeFileSync(join(w2.work, "s"), "s"); sh(w2.work, "add", "-A"); sh(w2.work, "commit", "-q", "-m", "stray");
  const stray = sh(w2.work, "rev-parse", "HEAD"); sh(w2.work, "push", "-q", "-f", "origin", `stray:${SPAN}--a`); sh(w2.work, "checkout", "-q", SPAN);
  const specs2 = [`a:100:${stray}:${w2.msgs.a}`];
  const o2 = opsOf(w2); const l2 = []; o2.ops.log = (l) => l2.push(l);
  assert.equal((await landTrain({ name: "t", local: true, specs: specs2, span: SPAN, cwd: w2.work }, o2.ops)).code, 2);
  assert.match(l2.join("\n"), /NO COMMON BASE: a/);
  const w3 = world();
  const r3 = await run(w3, { verdict: async (b) => (b.endsWith("--b") ? { ci: "red", heldOut: "green" } : { ci: "green", heldOut: "green" }) });
  assert.equal(r3.code, 8, r3.out);
  assert.match(r3.out, /LANE NOT GREEN: b/);
  assert.equal(r3.calls.train, 0);
  assert.equal(originRef(w3, SPAN), w3.base, "a refusal pushes nothing");
});

test("RED: a missing or empty message file refuses 2 before any train", async () => {
  const w = world(["a"]);
  const r = await run(w, { readMsg: () => "" }, {}, ["a"]);
  assert.equal(r.code, 2);
  assert.match(r.out, /NO MESSAGE FILE/);
  assert.equal(r.calls.train, 0);
});

test("RED: a train chain whose merge order breaks refuses (5); a final tree differing from the train's refuses (5) and the worktree stands", async () => {
  const w = world();
  const reversed = await run(w, {
    train: async ({ name, lanes, span }) => {
      const wt = join(w.dir, `wt-${name}`);
      sh(w.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      for (const l of [...lanes].reverse()) sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${l.suffix}`);
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
  });
  assert.equal(reversed.code, 5, reversed.out);
  assert.match(reversed.out, /TRAIN ORDER BROKE/);
  assert.equal(originRef(w, SPAN), w.base);

  // A final tree that differs: the train stand-in adds an uncommitted-in-lane file after its last merge, so the chain's last
  // tree (built from the merge commits' trees) differs from the train HEAD tree.
  const w2 = world();
  const dirty = await run(w2, {
    train: async ({ name, lanes, span }) => {
      const wt = join(w2.dir, `wt-${name}`);
      sh(w2.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      for (const l of lanes) sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${l.suffix}`);
      writeFileSync(join(wt, "extra.txt"), "x"); sh(wt, "add", "-A"); sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "-m", "fixup after the last merge");
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
  });
  assert.equal(dirty.code, 5, dirty.out);
  assert.match(dirty.out, /TRAIN CHAIN HOLDS 3 merges for 2 lanes|FINAL TREE DIFFERS/);
  assert.equal(originRef(w2, SPAN), w2.base);
});

test("RED: a refused chain leaves the train worktree standing (K9): the worktree goes only after the checks pass", async () => {
  const w = world(["a"]);
  w.commit(w.work, "ahead.txt", "a\n", "span ahead — merge PR #0: an earlier land"); sh(w.work, "push", "-q", "origin", SPAN);
  const r = await run(w, {
    train: async ({ name, lanes, span }) => {
      const wt = join(w.dir, `wt-${name}`);
      sh(w.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${lanes[0].suffix}`);
      writeFileSync(join(wt, "extra.txt"), "x"); sh(wt, "add", "-A"); sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "-m", "after the last merge");
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
  }, {}, ["a"]);
  assert.equal(r.code, 5, r.out);
  assert.equal(r.calls.removed.length, 0, "a refusal never removes the worktree");
  assert.ok(existsSync(join(w.dir, "wt-t1")));
});

test("RED: a conflict reads exit 4 and cleans the train's worktree; a red train reads 5; a provision/build failure reads 7; none pushes", async () => {
  const w = world();
  const conflict = await run(w, { train: async () => ({ state: "conflict", worktree: null, files: ["x"] }) });
  assert.equal(conflict.code, 4); assert.match(conflict.out, /CONFLICT/);
  const red = await run(w, { train: async () => ({ state: "red", worktree: null, why: "RED witness-all" }) });
  assert.equal(red.code, 5); assert.match(red.out, /TRAIN-RED/);
  const build = await run(w, { train: async () => ({ state: "build", worktree: null, why: "pnpm build" }) });
  assert.equal(build.code, 7);
  assert.equal(originRef(w, SPAN), w.base);
});

test("RED: the disk floor and the worktree cap refuse (6) before the train", async () => {
  const w = world();
  const disk = await run(w, { disk: () => ({ cGb: 59.8, rootGb: 90 }) });
  assert.equal(disk.code, 6); assert.match(disk.out, /DISK REFUSED/); assert.equal(disk.calls.train, 0);
  const cap = await run(w, { houseWorktrees: () => 6 });
  assert.equal(cap.code, 6); assert.match(cap.out, /WORKTREE CAP/); assert.equal(cap.calls.train, 0);
  const lowered = await run(w, { disk: () => ({ cGb: 45, rootGb: 90 }), env: { LARES_DISK_MIN_C_GB: "40" } });
  assert.equal(lowered.code, 0, lowered.out);
});

test("RED: the span push waits on no run in flight, checked BEFORE any lane branch moves", async () => {
  const w = world();
  const r = await run(w, { spanRuns: () => [{ status: "in_progress" }, { status: "queued" }] });
  assert.equal(r.code, 6, r.out);
  assert.match(r.out, /2 run\(s\) still in flight/);
  assert.equal(originRef(w, `${SPAN}--a`), w.heads.a, "no lane branch moved");
  assert.equal(originRef(w, SPAN), w.base);
});

test("RED: the DIRECT land: a lane whose head holds the span head lands with no train, and its land tree IS the lane tree", async () => {
  const w = world(["a"]);
  // Bring the span forward by a land, then make the lane hold the new span head.
  const r0 = await run(w, {}, {}, ["a"]);
  assert.equal(r0.code, 0);
  const w2 = world(["x"]);
  sh(w2.work, "checkout", "-q", `${SPAN}--x`);
  const laneHead0 = sh(w2.work, "rev-parse", "HEAD");
  // span moves ahead by a land of an unrelated commit; the lane merges the span, so it holds the span head.
  sh(w2.work, "checkout", "-q", SPAN);
  const ahead = w2.commit(w2.work, "ahead.txt", "a\n", "span ahead — merge PR #0: an earlier land");
  sh(w2.work, "push", "-q", "origin", SPAN);
  sh(w2.work, "checkout", "-q", `${SPAN}--x`);
  sh(w2.work, "merge", "-q", "--no-edit", SPAN);
  const laneHead = sh(w2.work, "rev-parse", "HEAD"); sh(w2.work, "push", "-q", "origin", `${SPAN}--x`); sh(w2.work, "checkout", "-q", SPAN);
  assert.notEqual(laneHead, laneHead0);
  const { ops, calls } = opsOf(w2); const lines = []; ops.log = (l) => lines.push(l);
  const r = await landTrain({ specs: [`x:100:${laneHead}:${w2.msgs.x}`], span: SPAN, cwd: w2.work }, ops);
  assert.equal(r.code, 0, lines.join("\n"));
  assert.equal(calls.train, 0, "no train ran");
  const land = originRef(w2, SPAN);
  assert.equal(sh(w2.work, "rev-parse", `${land}^{tree}`), sh(w2.work, "rev-parse", `${laneHead}^{tree}`));
  assert.equal(sh(w2.work, "rev-parse", `${land}^`), ahead);
  assert.equal(sh(w2.work, "rev-parse", `${land}^2`), laneHead);
  // The lane push of a DIRECT land changes no file (its tree IS the lane tree), so paths-ignore raises no run to cancel
  // (measured on four DIRECT lands, 2026-11-01): the land waits on none.
  assert.deepEqual(calls.cancelled, []);
  assert.match(lines.join("\n"), /DIRECT-LANDED/);
});

test("a single lane that lacks the span head is NOT direct: it takes the train", async () => {
  const w = world(["a"]);
  const road = w.commit(w.work, "road.txt", "r\n", "span ahead — merge PR #0: an earlier land");
  void road; sh(w.work, "push", "-q", "origin", SPAN);
  const r = await run(w, {}, {}, ["a"]);
  assert.equal(r.code, 0, r.out);
  assert.equal(r.calls.train, 1);
});

test("the main checkout must stand on the span, or the land refuses 2 before pushing", async () => {
  const w = world(["a"]);
  sh(w.work, "checkout", "-q", "-b", "elsewhere");
  const r = await run(w, {}, {}, ["a"]);
  assert.equal(r.code, 2);
  assert.match(r.out, /NOT ON THE SPAN/);
  assert.equal(originRef(w, SPAN), w.base);
});

// ── Luna and Sol read the land tool ──────────────────────────────────────────────────────────────────────────
test("RED: a local span ahead of origin's refuses (2) before any push; CONTROL: a local span behind fast-forwards", async () => {
  const w = world(["a"]);
  w.commit(w.work, "local-only.txt", "x\n", "an unpublished local commit");
  const r = await run(w, {}, {}, ["a"]);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /NOT AT ORIGIN'S SPAN HEAD/);
  assert.equal(originRef(w, `${SPAN}--a`), w.heads.a, "no lane branch moved");
});

test("RED: the span pushes FIRST under an expected-head lease; a writer that moved the span during the train refuses the land and no lane branch moves", async () => {
  const w = world();
  const r = await run(w, {
    train: async ({ name, lanes, span }) => {
      const wt = join(w.dir, `wt-${name}`);
      sh(w.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      for (const l of lanes) sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${l.suffix}`);
      // Another writer advances the span while the train runs (a push from a second clone).
      const other = join(w.dir, "other"); sh(w.dir, "clone", "-q", w.origin, other);
      sh(other, "config", "user.name", "O"); sh(other, "config", "user.email", "o@o"); w.commit(other, "other.txt", "o\n", "another writer"); sh(other, "push", "-q", "origin", SPAN);
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
  });
  assert.equal(r.code, 6, r.out);
  assert.match(r.out, /SPAN MOVED DURING THE TRAIN|SPAN PUSH REFUSED/);
  assert.equal(originRef(w, `${SPAN}--a`), w.heads.a, "a refused span leaves every lane branch where it stood");
  assert.equal(originRef(w, `${SPAN}--b`), w.heads.b);
});

test("the in-flight gate stands before any ref moves; a lane branch whose lease fails after the span landed warns and does not undo the land", async () => {
  const w = world();
  let atGate;
  const r = await run(w, {
    spanRuns: () => { atGate = [originRef(w, SPAN), originRef(w, `${SPAN}--a`), originRef(w, `${SPAN}--b`)]; return []; },
    train: async ({ name, lanes, span }) => {
      const wt = join(w.dir, `wt-${name}`);
      sh(w.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      for (const l of lanes) sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${l.suffix}`);
      // Lane b's author pushes a new commit after the train read its head: the lane branch's lease will fail.
      sh(w.work, "checkout", "-q", `${SPAN}--b`); w.commit(w.work, "b2.txt", "b2\n", "lane b moved on"); sh(w.work, "push", "-q", "origin", `${SPAN}--b`); sh(w.work, "checkout", "-q", SPAN);
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
  });
  assert.deepEqual(atGate.slice(0, 2), [w.base, w.heads.a], "the span and lane a had not moved when the gate read");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /LANE BRANCH NOT MOVED: b/);
  assert.notEqual(originRef(w, SPAN), w.base, "the span landed");
});

test("RED: the TRAIN needs the current span head GREEN (the shell's SPAN NOT GREEN); UNREADABLE there exits 10; the direct land does not ask", async () => {
  const w = world(["a"]);
  w.commit(w.work, "ahead.txt", "a\n", "span ahead — merge PR #0: an earlier land"); sh(w.work, "push", "-q", "origin", SPAN);
  const spanHead = originRef(w, SPAN);
  const red = await run(w, { verdict: async (b, sha) => (b === SPAN && sha === spanHead ? { ci: "red", heldOut: "green" } : { ci: "green", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(red.code, 5, red.out); assert.match(red.out, /SPAN NOT GREEN/); assert.equal(red.calls.train, 0);
  const dark = await run(w, { verdict: async (b, sha) => (b === SPAN && sha === spanHead ? { ci: "unreadable", heldOut: "unreadable" } : { ci: "green", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(dark.code, 10, dark.out);
});

test("RED: landed lanes' runs cancel by the pushed land sha, not by branch", async () => {
  const w = world();
  const r = await run(w, {});
  assert.equal(r.code, 0, r.out);
  const lands = sh(w.work, "rev-list", "--first-parent", "-2", SPAN).split("\n");
  assert.deepEqual([...r.calls.cancelShas].sort(), [...lands].sort());
});

test("RED: a train name that climbs out of scratch refuses (2)", async () => {
  const w = world(["a"]);
  const { ops } = opsOf(w); ops.log = () => {};
  for (const bad of ["../../tmp/pwn", "a/b", "", ".hidden"]) {
    assert.equal((await landTrain({ name: bad, local: true, specs: specsOf(w, ["a"]), span: SPAN, cwd: w.work }, ops)).code, 2, bad);
  }
});

test("RED: the in-flight gate asks every active status, not the newest five", () => {
  const asked = [];
  const gh = (args) => { asked.push(args[args.indexOf("--status") + 1]); return args[args.indexOf("--status") + 1] === "in_progress" ? [{ status: "in_progress" }] : []; };
  const runs = activeRuns(gh, "span");
  assert.deepEqual(asked, ACTIVE_STATUSES);
  assert.ok(ACTIVE_STATUSES.includes("queued") && ACTIVE_STATUSES.includes("in_progress") && ACTIVE_STATUSES.includes("waiting") && ACTIVE_STATUSES.includes("pending") && ACTIVE_STATUSES.includes("requested"));
  assert.equal(runs.length, 1);
});

test("RED: every gh call binds to the repo origin names, under the passwd home (a GH_REPO or scratch HOME elsewhere changes nothing)", () => {
  assert.equal(repoOfRemote("git@github.com:amorphous-dreams/Synthetic-Dream-Machine.git"), "amorphous-dreams/Synthetic-Dream-Machine");
  assert.equal(repoOfRemote("https://github.com/amorphous-dreams/Synthetic-Dream-Machine"), "amorphous-dreams/Synthetic-Dream-Machine");
  assert.equal(repoOfRemote("https://github.com/o/r.git/"), "o/r");
  assert.throws(() => repoOfRemote("/local/path"), /GitHub/);
  const e = ghEnv({ GH_REPO: "other/fork", HOME: "/scratch/home", PATH: "/bin" }, "/home/real", "o/r");
  assert.equal(e.GH_REPO, "o/r");
  assert.equal(e.HOME, "/home/real");
  assert.equal(e.PATH, "/bin");
});

test("RED: the verdict adapter reads the child's exit code: 4 with no words is UNREADABLE both, never unread", () => {
  assert.deepEqual(verdictWords("", 4), { ci: "unreadable", heldOut: "unreadable" });
  assert.deepEqual(verdictWords("ci-verdict: UNREADABLE for aaaaaaaaa — x\nheld-out: UNREADABLE for aaaaaaaaa — y\n", 4), { ci: "unreadable", heldOut: "unreadable" });
  assert.deepEqual(verdictWords("ci-verdict: GREEN for a\nheld-out: GREEN for a\n", 0), { ci: "green", heldOut: "green" });
  assert.deepEqual(verdictWords("ci-verdict: branch ci-verdict: GREEN\nci-verdict: RED for a — x\nheld-out: UNREAD for a", 1), { ci: "red", heldOut: "unread" });
  assert.deepEqual(verdictWords("", 3), { ci: "unread", heldOut: "unread" });
});

test("RED: a lane reads GREEN on its CI alone; a red or unread held-out prints and never gates. CONTROL: a red CI still refuses; the span keeps both", async () => {
  const w = world(["a"]);
  const red = await run(w, { verdict: async (b) => (b === SPAN ? { ci: "green", heldOut: "green" } : { ci: "green", heldOut: "red" }) }, {}, ["a"]);
  assert.notEqual(red.code, 8, red.out);
  assert.match(red.out, /lane a GREEN .*held-out: red/);
  const w2 = world(["a"]);
  const unread = await run(w2, { verdict: async (b) => (b === SPAN ? { ci: "green", heldOut: "green" } : { ci: "green", heldOut: "unread" }) }, {}, ["a"]);
  assert.notEqual(unread.code, 8, unread.out);
  assert.match(unread.out, /held-out: not run \(per train\)/);
  const w3 = world(["a"]);
  const ciRed = await run(w3, { verdict: async (b) => (b === SPAN ? { ci: "green", heldOut: "green" } : { ci: "red", heldOut: "unread" }) }, {}, ["a"]);
  assert.equal(ciRed.code, 8, ciRed.out);
  assert.match(ciRed.out, /held-out not run \(per train\)/);
});

test("RED: a meme-only road commit with no run, over a green ancestor, passes; CONTROL: a code commit with no run still refuses", async () => {
  const unreadAt = (sha) => async (b, s) => (s === sha ? { ci: "unread", heldOut: "unread" } : { ci: "green", heldOut: "green" });
  const w = world(["a"]);
  const meme = w.commit(w.work, "bags/lares/ha.ka.ba/doc.mem", "m\n", "a meme-only road commit");
  sh(w.work, "push", "-q", "origin", SPAN);
  const ok = await run(w, { verdict: unreadAt(meme) }, {}, ["a"]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /road commit .* touches ignored paths only/);
  const w2 = world(["a"]);
  const code = w2.commit(w2.work, "tools/x.mjs", "c\n", "a code road commit");
  sh(w2.work, "push", "-q", "origin", SPAN);
  const refused = await run(w2, { verdict: unreadAt(code) }, {}, ["a"]);
  assert.equal(refused.code, 3, refused.out);
  assert.match(refused.out, /NON-LAND COMMIT NOT READ GREEN/);
  // CONTROL: a meme-only commit over an ancestor that does NOT read green refuses (the carry needs a green ancestor).
  const w3 = world(["a"]);
  const m3 = w3.commit(w3.work, "notes.md", "m\n", "a docs-only road commit");
  sh(w3.work, "push", "-q", "origin", SPAN);
  const noAnc = await run(w3, { verdict: async (b, s) => (s === m3 ? { ci: "unread", heldOut: "unread" } : b === SPAN ? { ci: "red", heldOut: "green" } : { ci: "green", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(noAnc.code, 3, noAnc.out);
  // CONTROL: a mixed commit (meme and code) with no run refuses.
  const w4 = world(["a"]);
  w4.commit(w4.work, "bags/x.mem", "m\n", "mixed part one");
  const mixed = w4.commit(w4.work, "tools/y.mjs", "c\n", "mixed part two");
  sh(w4.work, "push", "-q", "origin", SPAN);
  const mx = await run(w4, { verdict: unreadAt(mixed) }, {}, ["a"]);
  assert.equal(mx.code, 3, mx.out);
});

test("RED: a lane head with no CI run reads GREEN when its nearest lane ancestor read CI GREEN and every commit since changed ignored paths alone; CONTROL: a code commit with no run, or a non-green ancestor, still refuses", async () => {
  const lane = (w, file, msg) => { sh(w.work, "checkout", "-q", `${SPAN}--a`); const h = w.commit(w.work, file, "x\n", msg); sh(w.work, "push", "-q", "origin", `${SPAN}--a`); sh(w.work, "checkout", "-q", SPAN); w.heads.a = h; return h; };
  const verdictFor = (head, rest) => async (b, s) => (s === head ? { ci: "unread", heldOut: "unread" } : rest);
  const w = world(["a"]);
  const meme = lane(w, "bags/lares/ha.ka.ba/note.mem", "a meme-only lane head");
  const ok = await run(w, { verdict: verdictFor(meme, { ci: "green", heldOut: "unread" }) }, {}, ["a"]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /lane a .*touches ignored paths only.*green ancestor/);
  const w2 = world(["a"]);
  const code = lane(w2, "tools/q.mjs", "a code lane head");
  const refused = await run(w2, { verdict: verdictFor(code, { ci: "green", heldOut: "unread" }) }, {}, ["a"]);
  assert.equal(refused.code, 8, refused.out);
  const w3 = world(["a"]);
  const m3 = lane(w3, "notes.md", "a docs-only lane head");
  const red = await run(w3, { verdict: verdictFor(m3, { ci: "red", heldOut: "unread" }) }, {}, ["a"]);
  assert.equal(red.code, 8, red.out);
});

// ── QUEUE: the train verifies in the cloud on the merge result ───────────────────────────────────────────────
// The CI stand-in answers per sha from the refs that hold it at the origin (the span and its `--train-*` branches), so
// a pushed train head, a probe of an existing chain commit and the span head each hold their own run. `red(sha, w,
// attempt)` decides each run's conclusion from the tree it would test.
const hasFile = (w, sha, path) => { try { sh(w.work, "cat-file", "-e", `${sha}:${path}`); return true; } catch { return false; } };
function opsQ(w, { red = () => false, extra = () => [], over = {} } = {}) {
  const { ops, calls } = opsOf(w);
  const localTrain = ops.train;
  Object.assign(calls, { local: 0, asked: [], reruns: [], cancelledRuns: [], dispatched: [] });
  const attempts = new Map(), ids = new Map();
  const refsAt = (sha) => sh(w.origin, "for-each-ref", "--points-at", sha, "--format=%(refname:short)", "refs/heads").split("\n").filter(Boolean);
  Object.assign(ops, {
    // The local battery: QUEUE never runs it (counted, and green, so a tool that still trains locally lands and says so).
    train: async (ctx) => { calls.local++; try { return await localTrain(ctx); } catch { return { state: "conflict", worktree: null, files: ["(the local merge stopped)"] }; } },
    ciRuns: async (sha) => {
      calls.asked.push(sha);
      return refsAt(sha).filter((b) => b === SPAN || b.startsWith(`${SPAN}--train-`)).map((b) => {
        const key = `${b}@${sha}`; if (!ids.has(key)) ids.set(key, ids.size + 1);
        const id = ids.get(key), attempt = attempts.get(id) ?? 1;
        return { databaseId: id, headBranch: b, headSha: sha, status: "completed", conclusion: red(sha, w, attempt) ? "failure" : "success", attempt, createdAt: "2026-11-01T00:00:00Z" };
      }).concat(extra(sha));
    },
    rerun: async (id) => { calls.reruns.push(id); attempts.set(id, (attempts.get(id) ?? 1) + 1); },
    cancelRun: async (id) => { calls.cancelledRuns.push(id); },
    heldOut: async () => ({ covered: originRef(w, SPAN), state: "green", inFlight: 0 }),
    dispatchCI: async (ref) => { calls.dispatched.push(ref); },
    ...over,
  });
  return { ops, calls };
}
const runQ = (w, { red, extra, over, only, ...opts } = {}) => {
  const { ops, calls } = opsQ(w, { red, extra, over });
  const lines = []; ops.log = (l) => lines.push(l);
  return LT.landTrain({ specs: specsOf(w, only), span: SPAN, cwd: w.work, shipDir: join(w.dir, "ship"), queueDir: join(w.dir, "q"), ...opts }, ops)
    .then((r) => ({ ...r, calls, out: lines.join("\n") }));
};
const pushedTrains = (out) => [...out.matchAll(/^pushed train (\S+) ([0-9a-f]{40})$/gm)].map((m) => ({ branch: m[1], sha: m[2] }));
const refAt = (w, ref) => { try { return originRef(w, ref); } catch { return null; } };
const isAnc = (w, a, b) => { try { sh(w.work, "merge-base", "--is-ancestor", a, b); return true; } catch { return false; } };
const spanAhead = (w) => { const c = w.commit(w.work, "ahead.txt", "a\n", "span ahead — merge PR #0: an earlier land"); sh(w.work, "push", "-q", "origin", SPAN); return c; };

test("RED: QUEUE: a lane lacking the span head lands through a train (exit 9 before the queue, when the controller typed the span head as the base); its land keeps the house subject", async () => {
  const w = world(["a"]);
  const SP = spanAhead(w);
  const r = await runQ(w);
  assert.equal(r.code, 0, r.out);
  const land = originRef(w, SPAN);
  assert.equal(sh(w.work, "rev-parse", `${land}^`), SP, "the land chains on the span head");
  assert.equal(sh(w.work, "rev-parse", `${land}^2`), w.heads.a);
  assert.match(sh(w.work, "log", "-1", "--format=%s", land), / — merge PR #100:/);
  assert.equal(r.calls.local, 0, "no local battery ran");
});

test("RED: QUEUE: the verdict reads the pushed train head's CI, and the span fast-forwards to that exact sha; CONTROL: a green on another sha of the train branch never lands", async () => {
  const w = world();
  const r = await runQ(w);
  assert.equal(r.code, 0, r.out);
  const [t] = pushedTrains(r.out);
  assert.ok(t && t.branch.startsWith(`${SPAN}--train-`), r.out);
  assert.equal(originRef(w, SPAN), t.sha, "the span IS the train head CI read (a fast-forward, no new commit)");
  assert.ok(r.calls.asked.includes(t.sha), "the train head's own runs were read");
  assert.equal(r.calls.local, 0, "the local battery never ran");
  // CONTROL: the train branch holds a GREEN run of another sha, and the train head's own run reads red.
  const w2 = world(["a"]);
  const SP2 = spanAhead(w2); // a lane holding the span head would land DIRECT
  const r2 = await runQ(w2, {
    red: (sha) => sha !== SP2,
    // The train branch also holds a GREEN run of another sha (the lane head): the reader matches the head, never the branch.
    extra: (sha) => (sha === SP2 ? [] : [{ databaseId: 99, headBranch: `${SPAN}--train-1-x`, headSha: w2.heads.a, status: "completed", conclusion: "success", attempt: 1, createdAt: "x" }]),
  });
  assert.equal(r2.code, 5, r2.out);
  assert.equal(originRef(w2, SPAN), SP2, "nothing landed");
});

test("RED: QUEUE: a red train of three drops the culprit by bisection over its own chain and lands the rest; the green prefix lands at its EXISTING chain sha", async () => {
  const w = world(["a", "b", "c"]);
  const r = await runQ(w, { red: (sha) => hasFile(w, sha, "packages/p-b/f.txt") });
  assert.equal(r.code, 11, r.out);
  assert.match(r.out, /DROPPED b: /);
  const final = originRef(w, SPAN);
  for (const s of ["a", "c"]) assert.ok(hasFile(w, final, `packages/p-${s}/f.txt`), `${s} landed`);
  assert.ok(!hasFile(w, final, "packages/p-b/f.txt"), "b never landed");
  const [t1] = pushedTrains(r.out);
  const prefix = sh(w.work, "rev-parse", `${final}^`);
  assert.equal(sh(w.work, "rev-parse", `${prefix}^2`), w.heads.a);
  assert.ok(isAnc(w, prefix, t1.sha), "lane a's land IS the first commit of the first train's chain, never a rebuild");
  assert.equal(sh(w.work, "rev-parse", `${final}^2`), w.heads.c);
});

test("RED: QUEUE: a security-class lane with no SHIP for its exact head refuses by name (12) and nothing pushes; CONTROL: the SHIP for that sha passes", async () => {
  const touch = (s) => (s === "s" ? "packages/p-s/custody-door.txt" : `packages/p-${s}/f.txt`);
  const w = world(["a", "s"], { touch });
  const r = await runQ(w);
  assert.equal(r.code, 12, r.out);
  assert.match(r.out, /NO SHIP: s/);
  assert.equal(originRef(w, SPAN), w.base);
  assert.equal(pushedTrains(r.out).length, 0, "no train pushed");
  // A SHIP for another sha does not count.
  mkdirSync(join(w.dir, "ship"), { recursive: true });
  writeFileSync(join(w.dir, "ship", `s-${"e".repeat(40)}.md`), `sha: ${"e".repeat(40)}\nread: controller diff read\n`);
  assert.equal((await runQ(w)).code, 12);
  // A lane that edits the table itself is security-class (the table sits in its own list).
  const w3 = world(["t"], { touch: () => "tools/security-class-paths.json" });
  const r3 = await runQ(w3);
  assert.equal(r3.code, 12, r3.out);
  // CONTROL: the SHIP naming the exact head passes.
  writeFileSync(join(w.dir, "ship", `s-${w.heads.s}.md`), `sha: ${w.heads.s}\nread: controller diff read + Sonnet cold read\n`);
  const ok = await runQ(w);
  assert.equal(ok.code, 0, ok.out);
});

test("RED: QUEUE: train N+1 builds on train N's head while N verifies, and re-chains when N reds", async () => {
  const w = world(["a", "b", "c", "d"]);
  const r = await runQ(w, { k: 2, depth: 2, red: (sha) => hasFile(w, sha, "packages/p-b/f.txt") });
  assert.equal(r.code, 11, r.out);
  const trains = pushedTrains(r.out);
  const [t1, t2] = trains;
  assert.ok(t2 && isAnc(w, t1.sha, t2.sha), "train 2 was pushed on train 1's head (speculation)");
  const final = originRef(w, SPAN);
  for (const s of ["a", "c", "d"]) assert.ok(hasFile(w, final, `packages/p-${s}/f.txt`), `${s} landed`);
  assert.ok(!hasFile(w, final, "packages/p-b/f.txt"));
  assert.ok(!isAnc(w, t2.sha, final), "the speculative train never landed: its base died with train 1");
  assert.equal(refAt(w, t2.branch), null, "the dead speculative train's branch is gone");
});

test("RED: a land message whose subject lacks ` — merge PR #<pr>` refuses (2) before any train; a later land would read it as a road commit", async () => {
  const w = world(["a"]);
  writeFileSync(w.msgs.a, "lar:///w/a — lane a with no marker\n");
  const r = await runQ(w);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /MESSAGE LACKS " — merge PR #100"/);
  // The marker names THIS pull request: #1000 does not stand for #100.
  writeFileSync(w.msgs.a, "lar:///w/a — merge PR #1000: lane a\n");
  assert.equal((await runQ(w)).code, 2);
  assert.equal(originRef(w, SPAN), w.base);
});

test("RED: QUEUE: a red train reruns its failed jobs once and reads the NEW attempt (a flake lands, no bisect); a train run cancelled clean is VOID (13), never a wait", async () => {
  const w = world();
  const r = await runQ(w, { red: (sha, _w, attempt) => sha !== w.base && attempt === 1 });
  assert.equal(r.code, 0, r.out);
  assert.equal(r.calls.reruns.length, 1, "one rerun of the failed jobs");
  assert.equal(pushedTrains(r.out).length, 1, "no probe: the rerun read green");
  const w2 = world(["a"]);
  const SP2 = spanAhead(w2);
  const r2 = await runQ(w2, {
    over: { ciRuns: async (sha) => [{ databaseId: 9, headBranch: sha === SP2 ? SPAN : `${SPAN}--train-x`, headSha: sha, status: "completed", conclusion: sha === SP2 ? "success" : "cancelled", attempt: 1, createdAt: "x" }] },
  });
  assert.equal(r2.code, 13, r2.out);
  assert.match(r2.out, /VOID/);
  assert.equal(originRef(w2, SPAN), SP2);
});

test("RED: QUEUE: a red over a span head with no real run probes the span (dispatch) before blaming a lane; a red span pauses (16) and drops no lane", async () => {
  const w = world();
  let dispatched = false, att = 1;
  const r = await runQ(w, {
    red: () => true,
    over: {
      dispatchCI: async () => { dispatched = true; },
      // The span head holds no run until the dispatch raises one (its push changed ignored paths alone); that run reads red.
      ciRuns: async (sha) => (sha === w.base
        ? (dispatched ? [{ databaseId: 50, headBranch: SPAN, headSha: sha, status: "completed", conclusion: "failure", attempt: att, createdAt: "x" }] : [])
        : [{ databaseId: 51, headBranch: `${SPAN}--train-x`, headSha: sha, status: "completed", conclusion: "failure", attempt: att, createdAt: "x" }]),
      rerun: async () => { att++; },
    },
  });
  assert.equal(r.code, 16, r.out);
  assert.match(r.out, /SPAN RED/);
  assert.doesNotMatch(r.out, /DROPPED/);
  assert.ok(dispatched, "the span head got its own run");
  assert.equal(originRef(w, SPAN), w.base);
});

test("RED: QUEUE: the held-out gate pauses on a RED newest completed run (15) and past M=3 lands beyond its covered sha with none in flight; CONTROL: a run in flight that turns green lets the queue go", async () => {
  const w = world(["a"]);
  const covered = spanAhead(w); // a lane holding the span head would land DIRECT, past the gate
  const r = await runQ(w, { over: { heldOut: async () => ({ covered, state: "red", inFlight: 0 }) } });
  assert.equal(r.code, 15, r.out);
  assert.match(r.out, new RegExp(`HELD-OUT RED at ${covered.slice(0, 9)}`));
  for (let i = 1; i <= 4; i++) w.commit(w.work, `l${i}.txt`, `${i}\n`, `land ${i} — merge PR #${i}: earlier`);
  sh(w.work, "push", "-q", "origin", SPAN);
  const lag = await runQ(w, { over: { heldOut: async () => ({ covered, state: "green", inFlight: 0 }) } });
  assert.equal(lag.code, 15, lag.out);
  assert.match(lag.out, /HELD-OUT LAGS: 4 lands past/);
  assert.equal(pushedTrains(lag.out).length, 0);
  let reads = 0;
  const go = await runQ(w, { over: { heldOut: async () => (++reads === 1 ? { covered, state: "green", inFlight: 1 } : { covered: originRef(w, SPAN), state: "green", inFlight: 0 }) } });
  assert.equal(go.code, 0, go.out);
  assert.ok(reads >= 2, "the gate waited on the run in flight");
});

test("RED: QUEUE: a conflict at chain build drops that lane by name, and every later lane carrying its commits, and lands the rest", async () => {
  const w = world(["a", "b"], { touch: () => "packages/shared/f.txt" });
  sh(w.work, "checkout", "-q", "-b", `${SPAN}--c`, w.heads.b);
  w.heads.c = w.commit(w.work, "packages/p-c/f.txt", "c\n", "lane c on b");
  sh(w.work, "push", "-q", "origin", `${SPAN}--c`); sh(w.work, "checkout", "-q", SPAN);
  w.lanes.push("c"); w.msgs.c = join(w.dir, "c.msg"); writeFileSync(w.msgs.c, "lar:///w/c — merge PR #102: lane c\n");
  const r = await runQ(w);
  assert.equal(r.code, 11, r.out);
  assert.match(r.out, /DROPPED b: conflict/);
  assert.match(r.out, /DROPPED c: carries b/);
  const final = originRef(w, SPAN);
  assert.equal(sh(w.work, "rev-parse", `${final}^2`), w.heads.a);
});

test("RED: QUEUE: a lane whose diff changes ignored paths alone refuses the queue (no run would come); CONTROL: it lands DIRECT once it holds the span head", async () => {
  const w = world(["a"], { touch: () => "bags/x/note.mem" });
  spanAhead(w);
  const r = await runQ(w);
  assert.equal(r.code, 2, r.out);
  assert.match(r.out, /MEME-ONLY LANE: a/);
  sh(w.work, "checkout", "-q", `${SPAN}--a`); sh(w.work, "merge", "-q", "--no-edit", SPAN);
  w.heads.a = sh(w.work, "rev-parse", "HEAD"); sh(w.work, "push", "-q", "origin", `${SPAN}--a`); sh(w.work, "checkout", "-q", SPAN);
  const d = await runQ(w);
  assert.equal(d.code, 0, d.out);
  assert.match(d.out, /DIRECT-LANDED/);
});

test("RED: QUEUE: enqueue validates and writes one entry per lane; run drains the queue; status exits 1 while a train ref stands unlanded and 0 when none does", async () => {
  const w = world();
  const { ops } = opsQ(w); const lines = []; ops.log = (l) => lines.push(l);
  const o = { span: SPAN, cwd: w.work, shipDir: join(w.dir, "ship"), queueDir: join(w.dir, "q") };
  assert.equal((await LT.enqueue({ ...o, specs: specsOf(w) }, ops)).code, 0, lines.join("\n"));
  const bad = specsOf(w, ["a"])[0].replace(w.heads.a, "f".repeat(40));
  assert.equal((await LT.enqueue({ ...o, specs: [bad] }, ops)).code, 3, "a moved head never enters");
  assert.equal((await LT.queueStatus(o, ops)).code, 0);
  const t = sh(w.work, "commit-tree", `${w.heads.a}^{tree}`, "-p", w.base, "-m", "stray train");
  sh(w.work, "push", "-q", "origin", `${t}:refs/heads/${SPAN}--train-9-${t.slice(0, 9)}`);
  assert.equal((await LT.queueStatus(o, ops)).code, 1, "a train ref stands unlanded");
  sh(w.work, "push", "-q", "origin", "--delete", `${SPAN}--train-9-${t.slice(0, 9)}`);
  const r = await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops);
  assert.equal(r.code, 0, lines.join("\n"));
  const final = originRef(w, SPAN);
  for (const s of ["a", "b"]) assert.ok(hasFile(w, final, `packages/p-${s}/f.txt`));
  assert.equal((await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops)).code, 2, "an empty queue names no lane");
});

test("RED: QUEUE: a run that finds the lock of a dead process takes it over and RESUMES the standing train ref that chains the queued lanes, landing that exact sha", async () => {
  const w = world(["a"]);
  const SP = spanAhead(w);
  const tree = sh(w.work, "merge-tree", "--write-tree", SP, w.heads.a);
  const t = sh(w.work, "commit-tree", tree, "-p", SP, "-p", w.heads.a, "-F", w.msgs.a);
  const branch = `${SPAN}--train-1-${t.slice(0, 9)}`;
  sh(w.work, "push", "-q", "origin", `${t}:refs/heads/${branch}`);
  mkdirSync(join(w.dir, "q"), { recursive: true });
  writeFileSync(join(w.dir, "q", "lock"), "999999\n");
  const r = await runQ(w);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /RESUMED/);
  assert.equal(originRef(w, SPAN), t, "the standing train's own sha landed");
  assert.equal(pushedTrains(r.out).length, 0, "no new train pushed");
});

test("RED: a non-ASCII path still reads its class: git's C-quoting never hides a security path (12) nor a meme-only lane (2)", async () => {
  const w = world(["a"], { touch: () => ".github/workflows/é.yml" });
  const r = await runQ(w);
  assert.equal(r.code, 12, r.out);
  assert.match(r.out, /NO SHIP: a/);
  const w2 = world(["b"], { touch: () => "bags/é/note.mem" });
  spanAhead(w2);
  const r2 = await runQ(w2);
  assert.equal(r2.code, 2, r2.out);
  assert.match(r2.out, /MEME-ONLY LANE: b/);
});

test("RED: a queued lane that lands DIRECT settles its entry, so the next run never re-reads a landed head", async () => {
  const w = world(["a"]);
  const { ops } = opsQ(w); const lines = []; ops.log = (l) => lines.push(l);
  const o = { span: SPAN, cwd: w.work, shipDir: join(w.dir, "ship"), queueDir: join(w.dir, "q") };
  assert.equal((await LT.enqueue({ ...o, specs: specsOf(w) }, ops)).code, 0);
  const r = await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops);
  assert.equal(r.code, 0, lines.join("\n"));
  assert.match(lines.join("\n"), /DIRECT-LANDED/);
  assert.deepEqual(readdirSync(join(w.dir, "q", "entries")), [], "the entry left the queue");
  assert.equal((await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops)).code, 2, "the next run finds no lane");
});

test("RED: run --plan reads the queue and moves no entry, even a lane its chain would drop", async () => {
  const w = world(["a", "b"], { touch: () => "packages/shared/f.txt" });
  spanAhead(w);
  const { ops } = opsQ(w); const lines = []; ops.log = (l) => lines.push(l);
  const o = { span: SPAN, cwd: w.work, shipDir: join(w.dir, "ship"), queueDir: join(w.dir, "q") };
  assert.equal((await LT.enqueue({ ...o, specs: specsOf(w) }, ops)).code, 0);
  const r = await LT.landTrain({ ...o, fromQueue: true, plan: true, specs: [] }, ops);
  assert.equal(r.code, 0, lines.join("\n"));
  assert.equal(readdirSync(join(w.dir, "q", "entries")).length, 2, "both entries still queued");
  assert.ok(!existsSync(join(w.dir, "q", "dropped")), "nothing moved to dropped/");
});

test("RED: a span head whose only run was cancelled clean gets a dispatched run before any lane takes blame, never a VOID stop", async () => {
  const w = world(["a"]);
  const SP = spanAhead(w);
  let dispatched = false;
  const r = await runQ(w, {
    red: (sha) => hasFile(w, sha, "packages/p-a/f.txt"),
    over: {
      dispatchCI: async () => { dispatched = true; },
      ciRuns: async (sha) => (sha === SP
        ? [{ databaseId: 70, headBranch: SPAN, headSha: sha, status: "completed", conclusion: "cancelled", attempt: 1, createdAt: "1" }, ...(dispatched ? [{ databaseId: 72, headBranch: SPAN, headSha: sha, status: "completed", conclusion: "success", attempt: 1, createdAt: "2" }] : [])]
        : [{ databaseId: 71, headBranch: `${SPAN}--train-x`, headSha: sha, status: "completed", conclusion: "failure", attempt: 1, createdAt: "1" }]),
      rerun: async () => { throw new Error("HTTP 403: rerun refused"); },
    },
  });
  assert.equal(r.code, 5, r.out);
  assert.ok(dispatched, "the span head got its own run");
  assert.match(r.out, /DROPPED a: /);
});

test("RED: a lane whose change already stands on the span adds nothing to the chain: it drops by name (no empty train waits on a run that never comes)", async () => {
  const w = world(["a", "b"]);
  w.commit(w.work, "packages/p-a/f.txt", "a\n", "the same change — merge PR #0: landed by another road");
  sh(w.work, "push", "-q", "origin", SPAN);
  const r = await runQ(w);
  assert.equal(r.code, 11, r.out);
  assert.match(r.out, /DROPPED a: its change already stands on the span/);
  assert.equal(sh(w.work, "rev-parse", `${originRef(w, SPAN)}^2`), w.heads.b);
});

test("RED: a stale queue entry (its lane moved on) drops by name and the run drains the rest; CONTROL: named lanes still refuse whole (3)", async () => {
  const w = world(["a", "b"]);
  const { ops } = opsQ(w); const lines = []; ops.log = (l) => lines.push(l);
  const o = { span: SPAN, cwd: w.work, shipDir: join(w.dir, "ship"), queueDir: join(w.dir, "q") };
  assert.equal((await LT.enqueue({ ...o, specs: specsOf(w) }, ops)).code, 0);
  sh(w.work, "checkout", "-q", `${SPAN}--a`); w.commit(w.work, "packages/p-a/g.txt", "g\n", "lane a moved on"); sh(w.work, "push", "-q", "origin", `${SPAN}--a`); sh(w.work, "checkout", "-q", SPAN);
  const r = await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops);
  assert.equal(r.code, 11, lines.join("\n"));
  assert.match(lines.join("\n"), /DROPPED a: HEAD MOVED/);
  assert.equal(readdirSync(join(w.dir, "q", "dropped")).length, 1);
  assert.equal(sh(w.work, "rev-parse", `${originRef(w, SPAN)}^2`), w.heads.b);
  const w2 = world(["a", "b"]);
  sh(w2.work, "checkout", "-q", `${SPAN}--a`); w2.commit(w2.work, "packages/p-a/g.txt", "g\n", "lane a moved on"); sh(w2.work, "push", "-q", "origin", `${SPAN}--a`); sh(w2.work, "checkout", "-q", SPAN);
  const named = await runQ(w2);
  assert.equal(named.code, 3, named.out);
  assert.match(named.out, /HEAD MOVED: a/);
});

test("RED: a queued entry whose CI reads no verdict (unread, a hard read error) stops the run and stays queued; only a positive red drops it", async () => {
  const w = world(["a", "b"]);
  const { ops } = opsQ(w); const lines = []; ops.log = (l) => lines.push(l);
  const o = { span: SPAN, cwd: w.work, shipDir: join(w.dir, "ship"), queueDir: join(w.dir, "q") };
  assert.equal((await LT.enqueue({ ...o, specs: specsOf(w) }, ops)).code, 0);
  ops.verdict = async (branch) => (branch.endsWith("--a") ? { ci: "unread", heldOut: "unread" } : { ci: "green", heldOut: "green" });
  const r = await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops);
  assert.equal(r.code, 8, lines.join("\n"));
  assert.equal(readdirSync(join(w.dir, "q", "entries")).length, 2, "nothing left the queue");
  // CONTROL: a positive red drops that entry and the run drains the rest.
  ops.verdict = async (branch) => (branch.endsWith("--a") ? { ci: "red", heldOut: "unread" } : { ci: "green", heldOut: "green" });
  const r2 = await LT.landTrain({ ...o, fromQueue: true, specs: [] }, ops);
  assert.equal(r2.code, 11, lines.join("\n"));
  assert.match(lines.join("\n"), /DROPPED a: LANE NOT GREEN/);
});
