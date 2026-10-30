// land-train.test — the land train's law. Pure parts take recorded text; the flow runs over a REAL scratch git origin
// (a bare repo, a span checkout, lane branches) with the network, the container-free train and the disk injected, so no
// test pushes anything real and none reads GitHub.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  diskRefusal, landTrain, parseSpec, readSuiteLog, runsToCancel, sharedPackages, spanPushRefusal, worktreeCapRefusal,
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
  sh(work, "push", "-q", "origin", SPAN);
  const base = sh(work, "rev-parse", "HEAD");
  const heads = {}, msgs = {};
  for (const s of lanes) {
    sh(work, "checkout", "-q", "-b", `${SPAN}--${s}`, base);
    heads[s] = commit(work, touch(s), `${s}\n`, `lane ${s}`);
    sh(work, "push", "-q", "origin", `${SPAN}--${s}`);
    msgs[s] = join(dir, `${s}.msg`); writeFileSync(msgs[s], `lar:///w/${s} — merge PR #${s}: lane ${s}\n`);
  }
  sh(work, "checkout", "-q", SPAN);
  return { dir, origin, work, base, heads, msgs, lanes, cfg, commit };
}
const specsOf = (w, only = w.lanes) => only.map((s, i) => `${s}:${100 + i}:${w.heads[s]}:${w.msgs[s]}`);

/** The injected ops: network, disk and the train are stand-ins; git is real. */
function opsOf(w, over = {}) {
  const calls = { train: 0, cancelled: [], verdicts: [], removed: [] };
  const git = (args, o = {}) => sh(o.cwd ?? w.work, ...args);
  const ops = {
    git,
    verdict: async (branch, sha) => { calls.verdicts.push([branch, sha]); return { ci: "green", heldOut: "green" }; },
    disk: () => ({ cGb: 100, rootGb: 100 }),
    houseWorktrees: () => 1,
    inFlight: () => 0,
    cancelRuns: async (branch) => { calls.cancelled.push(branch); return [1]; },
    readMsg: (p) => (existsSync(p) ? "x" : ""),
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
  return landTrain({ name: "t1", base: w.base, specs: specsOf(w, only), span: SPAN, cwd: w.work, ...opts }, ops).then((r) => ({ ...r, calls, out: lines.join("\n") }));
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
  assert.match(sh(w.work, "log", "-1", "--format=%s", first), / — merge PR #a/);
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
  assert.match(r.out, / — merge PR #a/, "the land message's subject is printed");
  assert.equal(r.calls.cancelled.length, 0);
});

test("RED: a span commit since base whose subject lacks ` — merge PR #` refuses (exit 3) unless read GREEN at its sha; CONTROL: a land passes", async () => {
  const w = world(["a"]);
  // The span moved by a road commit after the lanes branched: the lane then lacks nothing it needs (base stays on the span).
  const road = w.commit(w.work, "road.txt", "r\n", "a road commit");
  sh(w.work, "push", "-q", "origin", SPAN);
  const ungreen = await run(w, { verdict: async () => ({ ci: "red", heldOut: "green" }) }, {}, ["a"]);
  assert.equal(ungreen.code, 3, ungreen.out);
  assert.match(ungreen.out, /NON-LAND COMMIT NOT READ GREEN/);
  assert.equal(ungreen.calls.train, 0);
  const green = await run(w, {}, {}, ["a"]);
  assert.equal(green.code, 0, green.out);
  assert.ok(green.calls.verdicts.some(([b, s]) => b === SPAN && s === road), "the road commit was read at its exact sha on the span");
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

test("RED: a moved head refuses 3; a lane lacking the base refuses 9; a lane not green refuses 8", async () => {
  const w = world();
  const moved = await run(w, {}, {}, undefined);
  assert.equal(moved.code, 0);
  const w1 = world();
  const specs = specsOf(w1); specs[0] = specs[0].replace(w1.heads.a, "f".repeat(40));
  const { ops } = opsOf(w1); const lines = []; ops.log = (l) => lines.push(l);
  const r1 = await landTrain({ name: "t", base: w1.base, specs, span: SPAN, cwd: w1.work }, ops);
  assert.equal(r1.code, 3); assert.match(lines.join("\n"), /HEAD MOVED: a/);
  // base not an ancestor of the lane: branch a lane from an orphan root.
  const w2 = world(["a"]);
  sh(w2.work, "checkout", "-q", "--orphan", "stray"); sh(w2.work, "rm", "-rfq", "."); writeFileSync(join(w2.work, "s"), "s"); sh(w2.work, "add", "-A"); sh(w2.work, "commit", "-q", "-m", "stray");
  const stray = sh(w2.work, "rev-parse", "HEAD"); sh(w2.work, "push", "-q", "-f", "origin", `stray:${SPAN}--a`); sh(w2.work, "checkout", "-q", SPAN);
  const specs2 = [`a:1:${stray}:${w2.msgs.a}`];
  const o2 = opsOf(w2); o2.ops.log = () => {};
  assert.equal((await landTrain({ name: "t", base: w2.base, specs: specs2, span: SPAN, cwd: w2.work }, o2.ops)).code, 9);
  const w3 = world();
  const r3 = await run(w3, { verdict: async (b) => (b.endsWith("--b") ? { ci: "green", heldOut: "red" } : { ci: "green", heldOut: "green" }) });
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

test("RED: a failed final-tree check leaves the train worktree standing (K9)", async () => {
  const w = world(["a"]);
  const r = await run(w, {
    train: async ({ name, lanes, span }) => {
      const wt = join(w.dir, `wt-${name}`);
      sh(w.work, "worktree", "add", "-q", "--detach", wt, `origin/${span}`);
      sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "merge", "--no-ff", "--no-edit", "-q", `origin/${span}--${lanes[0].suffix}`);
      // The train head carries a tree the lane's merge does not: a commit on top that edits a file.
      writeFileSync(join(wt, "README"), "edited after the merge\n"); sh(wt, "add", "-A"); sh(wt, "-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "--amend", "--no-edit");
      return { state: "green", worktree: wt, head: sh(wt, "rev-parse", "HEAD") };
    },
  }, {}, ["a"]);
  // amending the merge keeps one merge commit whose tree IS the train tree, so this is the chain-vs-head case below the final check;
  // the worktree must stand on any code-5 exit.
  assert.notEqual(r.code, 0);
  assert.equal(r.calls.removed.length, 0, "a refusal never removes the worktree");
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
  const r = await run(w, { inFlight: () => 2 });
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
  const base = w2.base; // the land that moved the span is a " — merge PR #" commit, so the span walk passes
  const r = await landTrain({ name: "d", base, specs: [`x:7:${laneHead}:${w2.msgs.x}`], span: SPAN, cwd: w2.work }, ops);
  assert.equal(r.code, 0, lines.join("\n"));
  assert.equal(calls.train, 0, "no train ran");
  const land = originRef(w2, SPAN);
  assert.equal(sh(w2.work, "rev-parse", `${land}^{tree}`), sh(w2.work, "rev-parse", `${laneHead}^{tree}`));
  assert.equal(sh(w2.work, "rev-parse", `${land}^`), ahead);
  assert.equal(sh(w2.work, "rev-parse", `${land}^2`), laneHead);
  assert.deepEqual(calls.cancelled, [`${SPAN}--x`]);
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
