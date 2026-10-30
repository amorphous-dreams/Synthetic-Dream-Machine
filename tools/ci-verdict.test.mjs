// ci-verdict.test — the reader's law over a RECORDED reading of this repository's own CI (`ci-verdict.fixture.json`):
// twelve runs of one branch, of which one still ran, six got cancelled by a newer push and five completed red, plus the
// job view of the newest whole run. No network, no `gh`: `readVerdict` takes the JSON as data.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DRIVERS } from "./held-out-cells.mjs";
import { MERGE_JOB, classifyFailure, driverOf, exitOf, failing, heldOutDrivers, heldOutUnreadable, jobMinutes, main, readHeldOut, readVerdict, render, renderHeldOut, renderJobMinutes } from "./ci-verdict.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { runs, views, heldOutRuns, heldOutViews } = JSON.parse(readFileSync(join(HERE, "ci-verdict.fixture.json"), "utf8"));
const HELD_RUN = 38491127984;
const HELD_HEAD = heldOutRuns.find((r) => r.databaseId === HELD_RUN).headSha;
const RED_RUN = 38393357077;
const shaOf = (id) => runs.find((r) => r.databaseId === id).headSha;
const clone = (v) => JSON.parse(JSON.stringify(v));

test("CONTROL: the recording holds what the cases lean on — a running run, cancelled runs, and whole red runs", () => {
  const tally = Object.groupBy(runs, (r) => (r.status === "completed" ? r.conclusion : r.status));
  assert.equal(runs.length, 12);
  assert.equal(tally.in_progress.length, 1);
  assert.equal(tally.cancelled.length, 6);
  assert.equal(tally.failure.length, 5);
  assert.equal(tally.success, undefined, "the recording holds no green run; the green case plants one");
});

test("the failing jobs and steps of the recorded red run read by name", () => {
  assert.deepEqual(failing(views[RED_RUN]), [
    { job: "Witnesses", conclusion: "failure", steps: ["Run every witness (never short-circuits; the worst exit wins)", "Run every tool self-test (tools/*.test.mjs)"] },
    { job: "Test", conclusion: "failure", steps: ["Run all package suites"] },
  ]);
  assert.deepEqual(failing(undefined), [], "an unread view names no failing job, and the caller says the jobs went unread");
});

test("RED: a head whose run completed with a failed job reads red, names the jobs, and exits 1", () => {
  const v = readVerdict({ runs, head: shaOf(RED_RUN), views });
  assert.equal(v.state, "red");
  assert.equal(v.run, RED_RUN);
  assert.deepEqual(v.failing.map((f) => f.job), ["Witnesses", "Test"]);
  assert.equal(exitOf(v.state), 1);
  assert.match(render(v).join("\n"), /RED for 7ad33d8ac[\s\S]*failure: Witnesses[\s\S]*step: Run every tool self-test/);
});

test("UNREAD: a head whose run a newer push cancelled never reads green, and the last whole verdict stands beside it", () => {
  const cancelled = runs.find((r) => r.conclusion === "cancelled");
  const v = readVerdict({ runs, head: cancelled.headSha, views });
  assert.equal(v.state, "unread");
  assert.equal(exitOf(v.state), 2);
  assert.match(v.why, /cancelled it before it measured this head/);
  assert.equal(v.last.run, RED_RUN);
  assert.equal(v.last.conclusion, "failure");
  assert.equal(v.last.coversHead, false);
  const text = render(v).join("\n");
  assert.match(text, /last whole verdict the branch holds: FAILURE at 7ad33d8ac/);
  assert.match(text, /failure: Test/);
  assert.match(text, /UNREAD never reads as green/);
});

test("UNREAD: a head whose run still runs, and a head no run names", () => {
  const running = runs.find((r) => r.status === "in_progress");
  const a = readVerdict({ runs, head: running.headSha, views });
  assert.equal(a.state, "unread");
  assert.match(a.why, /still reads in_progress/);
  assert.equal(a.last.cancelledSince, 0, "the running run sits above the last whole run and counts as no cancellation");
  const b = readVerdict({ runs, head: "0".repeat(40), views });
  assert.equal(b.state, "unread");
  assert.match(b.why, /no run names this head/);
  assert.equal(readVerdict({ runs: [], head: "0".repeat(40) }).last, null);
});

test("the count of runs cancelled since the last whole verdict reads off the list, in any order", () => {
  // Drop the two newest rows: the newest left is a cancelled run, with two more between it and the red run before them.
  const older = [...runs].sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(2);
  const v = readVerdict({ runs: [...older].reverse(), head: older[0].headSha, views: {} });
  assert.equal(v.state, "unread");
  assert.equal(v.last.run, 38373405073);
  assert.equal(v.last.cancelledSince, 3);
});

test("RED: a run cancelled AFTER a job failed still reads red", () => {
  const planted = clone(runs);
  const row = planted.find((r) => r.databaseId === RED_RUN);
  row.conclusion = "cancelled";
  const v = readVerdict({ runs: planted, head: row.headSha, views });
  assert.equal(v.state, "red");
  assert.match(v.why, /reads cancelled, and a job in it already failed/);
});

test("GREEN: only a completed success on the head itself reads green; CONTROL: one failed job turns it red", () => {
  const planted = clone(runs);
  const row = planted.find((r) => r.databaseId === RED_RUN);
  row.conclusion = "success";
  const greenView = { jobs: views[RED_RUN].jobs.map((j) => ({ ...j, conclusion: "success", steps: [] })) };
  const v = readVerdict({ runs: planted, head: row.headSha, views: { [RED_RUN]: greenView } });
  assert.equal(v.state, "green");
  assert.equal(exitOf(v.state), 0);
  assert.equal(v.last.coversHead, true);
  // A green verdict on an OLDER head says nothing about a newer one.
  assert.equal(readVerdict({ runs: planted, head: planted.find((r) => r.status === "in_progress").headSha }).state, "unread");
  greenView.jobs[0].conclusion = "failure";
  assert.equal(readVerdict({ runs: planted, head: row.headSha, views: { [RED_RUN]: greenView } }).state, "red");
});

test("a whole red run with no job view handed over reads red, and says its jobs went unread", () => {
  const v = readVerdict({ runs, head: shaOf(RED_RUN) });
  assert.equal(v.state, "red");
  assert.match(v.why, /its jobs went unread/);
});

// ── the third reading: the held-out drivers ──────────────────────────────────────────────────────────────────

/** A held-out run in the unfolded shape: one job per cell, with the plan, image and merge jobs beside them. */
const unfolded = (over = {}) => ({ jobs: [
  { name: "Plan the cells", status: "completed", conclusion: "success" },
  { name: "Build the product image", status: "completed", conclusion: "success" },
  { name: "Held-out · browser-weld", status: "completed", conclusion: "success" },
  { name: "Held-out · civic", status: "completed", conclusion: "success" },
  { name: "Held-out · crossing", status: "completed", conclusion: "success" },
  { name: "Held-out · herm-mesh", status: "completed", conclusion: "success" },
  { name: "Held-out · herm-mesh-roll", status: "completed", conclusion: "success" },
  { name: "Held-out · mesh-scenarios-crossing", status: "completed", conclusion: "success" },
  { name: "Held-out · mesh-scenarios-meme", status: "completed", conclusion: "success" },
  { name: "Merge the cells", status: "completed", conclusion: "success" },
].map((j) => ({ ...j, ...(over[j.name] ?? {}) })) });
const heldRun = (over = {}) => [{ databaseId: 7, headSha: "c".repeat(40), status: "completed", conclusion: "success", createdAt: "2026-10-14T02:00:00Z", url: "https://example.invalid/7", ...over }];

test("CONTROL: the held-out recording holds a whole red run of one job per driver, and a job name reads its driver", () => {
  assert.equal(heldOutRuns[0].databaseId, HELD_RUN);
  assert.equal(heldOutRuns[0].conclusion, "failure");
  assert.equal(heldOutViews[HELD_RUN].jobs.length, 5);
  assert.equal(driverOf("Held-out · mesh-scenarios"), "mesh-scenarios");
  assert.equal(driverOf("Held-out · mesh-scenarios-realm-crossing"), "mesh-scenarios");
  assert.equal(driverOf("Held-out · crossing"), "crossing", "the crossing driver never takes the crossing scenario's cell, nor gives its own away");
  assert.equal(driverOf("Held-out · herm-mesh"), "herm-mesh");
  assert.equal(driverOf("Held-out · herm-mesh-roll"), "herm-mesh-roll", "the roll cell is its own driver, never a herm-mesh scenario");
  assert.equal(driverOf("Held-out · meshless"), null);
  assert.equal(driverOf("Merge the cells"), null);
});

test("RED: the recorded held-out run reads red for its own head and names each driver's result", () => {
  const h = readHeldOut({ runs: heldOutRuns, head: HELD_HEAD, views: heldOutViews });
  assert.equal(h.state, "red");
  assert.equal(h.coversHead, true);
  assert.equal(h.behind, 0);
  assert.deepEqual(Object.fromEntries(h.drivers.map((d) => [d.driver, d.result])),
    // The recorded run predates the roll cell, so that driver answered no job there.
    { "browser-weld": "failure", civic: "success", crossing: "success", "herm-mesh": "failure", "herm-mesh-roll": "unread", "mesh-scenarios": "success" });
  const text = renderHeldOut(h).join("\n");
  assert.match(text, /^held-out: RED for cb8a1a9a8 — run 38491127984 reads failure: browser-weld, herm-mesh failed/);
  assert.match(text, /herm-mesh: failure — red: herm-mesh/);
  assert.match(text, /civic: success/);
});

test("UNREAD: a head no held-out run names reads unread, beside the newest run, its head and the commits between", () => {
  const h = readHeldOut({ runs: heldOutRuns, head: "0".repeat(40), views: heldOutViews, behind: 44 });
  assert.equal(h.state, "unread");
  assert.equal(h.run, HELD_RUN);
  assert.equal(h.runHead, HELD_HEAD);
  assert.equal(h.behind, 44);
  const text = renderHeldOut(h).join("\n");
  assert.match(text, /no held-out run names this head; the newest \(run 38491127984, failure\) measured cb8a1a9a8, 44 commit\(s\) behind it/);
  assert.match(text, /browser-weld: failure/, "the newest run's drivers still print");
  assert.match(text, /UNREAD never reads as green/);
  // A green newest run on ANOTHER head still reads unread for this one: the mutation that would hide the dark spot.
  const green = readHeldOut({ runs: heldRun(), head: "0".repeat(40), views: { 7: unfolded() }, behind: 1 });
  assert.equal(green.state, "unread");
  assert.match(green.why, /1 commit\(s\) behind it/);
  assert.match(readHeldOut({ runs: heldRun(), head: "0".repeat(40), views: { 7: unfolded() } }).why, /cannot place/);
});

test("UNREAD: a branch that holds no held-out run names every driver unread", () => {
  const h = readHeldOut({ runs: [], head: "0".repeat(40) });
  assert.equal(h.state, "unread");
  assert.equal(h.run, null);
  assert.ok(h.drivers.length >= 5 && h.drivers.every((d) => d.result === "unread"));
  assert.match(renderHeldOut(h).join("\n"), /no held-out run stands on this branch/);
});

test("GREEN: an unfolded run on the head reads green only with every driver green; CONTROL: one red cell, a red gate, a missing driver", () => {
  const head = "c".repeat(40);
  const g = readHeldOut({ runs: heldRun(), head, views: { 7: unfolded() } });
  assert.equal(g.state, "green");
  assert.deepEqual(g.drivers.find((d) => d.driver === "mesh-scenarios"), { driver: "mesh-scenarios", result: "success", cells: 2, green: 2, red: [] });
  assert.match(renderHeldOut(g).join("\n"), /mesh-scenarios: success \(2\/2 cells\)/);

  const cell = readHeldOut({ runs: heldRun({ conclusion: "failure" }), head, views: { 7: unfolded({ "Held-out · mesh-scenarios-meme": { conclusion: "timed_out" } }) } });
  assert.equal(cell.state, "red");
  assert.match(renderHeldOut(cell).join("\n"), /mesh-scenarios: failure \(1\/2 cells\) — red: mesh-scenarios-meme/);
  assert.equal(cell.drivers.find((d) => d.driver === "crossing").result, "success", "a red scenario cell never reddens the crossing driver");

  const gate = readHeldOut({ runs: heldRun({ conclusion: "failure" }), head, views: { 7: unfolded({ "Merge the cells": { conclusion: "failure" } }) } });
  assert.equal(gate.state, "red");
  assert.match(renderHeldOut(gate).join("\n"), /failure: Merge the cells/);
  assert.match(gate.why, /Merge the cells failed/, "a red gate reds the reading by its own name, with every driver green");

  // A run that says success while a driver holds no cell measured less than the drivers: never green.
  const thin = unfolded();
  thin.jobs = thin.jobs.filter((j) => j.name !== "Held-out · herm-mesh");
  const t = readHeldOut({ runs: heldRun(), head, views: { 7: thin } });
  assert.equal(t.state, "unread");
  assert.match(t.why, /herm-mesh answered no green cell/);

  // A run that says success with no successful merge gate in its view: nothing says every planned cell ran.
  const gateless = unfolded();
  gateless.jobs = gateless.jobs.filter((j) => j.name !== MERGE_JOB);
  const u = readHeldOut({ runs: heldRun(), head, views: { 7: gateless } });
  assert.equal(u.state, "unread");
  assert.match(u.why, /merge gate .* answered no success/);
  assert.equal(readHeldOut({ runs: heldRun(), head, views: { 7: unfolded({ [MERGE_JOB]: { conclusion: "skipped" } }) } }).state, "unread");

  const running = readHeldOut({ runs: heldRun({ status: "in_progress", conclusion: "" }), head, views: { 7: unfolded({ "Held-out · civic": { status: "in_progress", conclusion: "" } }) } });
  assert.equal(running.state, "unread");
  assert.equal(running.drivers.find((d) => d.driver === "civic").result, "running");
  assert.equal(readHeldOut({ runs: heldRun({ conclusion: "cancelled" }), head, views: { 7: unfolded({ "Held-out · civic": { conclusion: "cancelled" } }) } }).state, "unread");
  assert.deepEqual(heldOutDrivers(undefined).rows.map((r) => r.result), DRIVERS.map(() => "unread"));
});

test("the third reading says and never blocks: the door's exit code follows the CI reading alone", () => {
  const dark = heldOutUnreadable("0".repeat(40), "gh: no such workflow");
  assert.equal(dark.state, "unread");
  assert.match(renderHeldOut(dark).join("\n"), /held-out: UNREAD for 000000000 — the held-out runs could not be read \(gh: no such workflow\)[\s\S]*UNREAD never reads as green/);
});

test("the door answers exit 3 when it cannot read, never 0", () => {
  // No `gh` and no `git` on this PATH: the reader must say so and refuse to answer green.
  const r = spawnSync(process.execPath, [join(HERE, "ci-verdict.mjs"), "--branch", "x", "--head", "HEAD"], { encoding: "utf8", env: { PATH: "/nonexistent" } });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /ci-verdict: could not read/);
});

test("a detached checkout refuses an unnamed branch before reading runs; an attached checkout reads its branch", () => {
  const dir = mkdtempSync(join(tmpdir(), "ci-verdict-branch-"));
  const git = join(dir, "git");
  const gh = join(dir, "gh");
  const queried = join(dir, "queried");
  try {
    writeFileSync(git, '#!/bin/sh\nif [ "$2" = "--abbrev-ref" ]; then printf "%s\\n" "$TEST_BRANCH"; else printf "%040d\\n" 0; fi\n');
    writeFileSync(gh, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_QUERIED"\nprintf "[]\\n"\n');
    chmodSync(git, 0o755);
    chmodSync(gh, 0o755);
    const run = (branch) => spawnSync(process.execPath, [join(HERE, "ci-verdict.mjs")], {
      encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_BRANCH: branch, TEST_QUERIED: queried },
    });
    const detached = run("HEAD");
    assert.equal(detached.status, 3, detached.stderr);
    assert.match(detached.stderr, /detached HEAD: name --branch/);
    assert.doesNotMatch(detached.stdout, /UNREAD/);
    assert.equal(existsSync(queried), false, "a detached default must not ask GitHub about branch HEAD");

    const attached = run("topic/ci-reader");
    assert.equal(attached.status, 2, attached.stderr);
    assert.match(attached.stdout, /ci-verdict: branch topic\/ci-reader/);
    assert.match(readFileSync(queried, "utf8"), /run list --branch topic\/ci-reader --workflow CI/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the shard lane's push door ends on the line that names this reader", async () => {
  const { HALF_VERDICT } = await import("./e2e-shards.mjs");
  assert.match(HALF_VERDICT, /node tools\/ci-verdict\.mjs --branch$/);
  const src = readFileSync(join(HERE, "e2e-shards.mjs"), "utf8");
  const push = src.slice(src.indexOf("async function cliPush("), src.indexOf("\n}\n", src.indexOf("async function cliPush(")));
  assert.match(push, /console\.log\(`\$\{HALF_VERDICT\} \$\{fullCiBranchOf\(repoRoot, result\.headSha\) \?\? "<the branch this head rides>"\} --head \$\{result\.headSha\.slice\(0, 9\)\}`\)/,
    "the push door must name the branch whose full run measures the head it pushed, never the ci/ lane");
  assert.match(src, /return \{ ok, runId, headSha, /);
});

test("the shard lane names a run whose verdict it could not read, and the command that reads it", async () => {
  const { unreadVerdict } = await import("./e2e-shards.mjs");
  assert.match(unreadVerdict(42), /^UNREAD: run 42 .*gh run view 42 --json status,conclusion,url,jobs$/);
  const src = readFileSync(join(HERE, "e2e-shards.mjs"), "utf8");
  const watch = src.slice(src.indexOf("const watch = spawnSync("), src.indexOf("function deleteBranch("));
  const { WATCH_INTERVAL_S } = await import("./e2e-shards.mjs");
  assert.ok(Number(WATCH_INTERVAL_S) >= 30, "a watch that looks more often than every half minute spends the shared API budget");
  assert.match(watch, /"run", "watch", String\(runId\), "--exit-status", "--interval", WATCH_INTERVAL_S\]/);
  assert.match(watch, /catch \(err\) \{[\s\S]*throw new Error\(`\$\{unreadVerdict\(runId\)\}/, "a failed read of the run stopped naming the run as unread");
});

// ── B3: the three-state verdict, --wait, and the job-minutes line ─────────────────────────────────────────────
const T0 = "2026-10-30T10:00:00Z", T1 = "2026-10-30T10:06:00Z";
const SHA = "a".repeat(40);
const mkRun = (o = {}) => ({ databaseId: 11, headSha: SHA, status: "completed", conclusion: "success", createdAt: T0, url: "https://example/run/11", ...o });
const mkHeld = (o = {}) => mkRun({ databaseId: 22, url: "https://example/run/22", ...o });
const mkJob = (name, startedAt, completedAt, o = {}) => ({ name, status: "completed", conclusion: "success", startedAt, completedAt, steps: [], ...o });
const heldGreenView = () => ({ jobs: [...DRIVERS.map((d) => mkJob(`Held-out · ${d.driver}`, T0, T1)), mkJob(MERGE_JOB, T0, T1)] });
const bad502 = () => Object.assign(new Error("Command failed: gh run list"), { stderr: "HTTP 502: Bad Gateway (https://api.github.com/repos/x/actions/runs)" });

/** A scripted `gh`/`git`: each key's value is data, an Error, or a function of that key's call count (1-based). */
function fake(table) {
  const n = {}, calls = [];
  const sh = (cmd, args) => {
    calls.push([cmd, ...args]);
    let key;
    if (cmd === "git") key = args.includes("--abbrev-ref") ? "branch" : "rev";
    else if (args[1] === "list") key = `${args[args.indexOf("--workflow") + 1] === "CI" ? "runs" : "heldRuns"}${args.includes("--commit") ? "AtSha" : ""}`;
    else key = `view:${args[2]}`;
    n[key] = (n[key] ?? 0) + 1;
    const v = table[key];
    if (v === undefined) throw Object.assign(new Error(`unscripted ${key}`), { stderr: `no such ${key}` });
    const r = typeof v === "function" ? v(n[key]) : v;
    if (r instanceof Error) throw r;
    return typeof r === "string" ? r : JSON.stringify(r);
  };
  return { sh, calls, n };
}
const door = async (table, extra = []) => {
  const f = fake({ rev: SHA, ...table });
  const out = [], err = [], slept = [];
  const code = await main(["--branch", "topic", "--head", SHA, ...extra], { sh: f.sh, sleep: async (ms) => { slept.push(ms); }, log: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join("\n"), err: err.join("\n"), slept, ...f };
};
const GREEN_TABLE = () => ({ runs: [mkRun()], "view:11": { jobs: [mkJob("Test", T0, T1)] }, heldRuns: [mkHeld()], "view:22": heldGreenView() });

test("CONTROL: a recorded green CI and green held-out exit 0, and print the job-minutes line beside the CI reading", async () => {
  const r = await door(GREEN_TABLE());
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /ci-verdict: GREEN/);
  assert.match(r.out, /held-out: GREEN/);
  assert.match(r.out, /^job-minutes: 6\.0 \(critical path 6\.0 min\)$/m);
  assert.deepEqual(r.slept, []);
});

test("classifyFailure: a 5xx, a timeout and a dropped network read UNREADABLE; a missing gh and an unknown branch are hard", () => {
  for (const e of [bad502(), Object.assign(new Error("x"), { stderr: "HTTP 503 Service Unavailable" }), Object.assign(new Error("spawnSync gh ETIMEDOUT"), { code: "ETIMEDOUT" }),
    Object.assign(new Error("x"), { killed: true, signal: "SIGTERM" }), Object.assign(new Error("x"), { stderr: 'Post "https://api.github.com/graphql": dial tcp: lookup api.github.com: no such host' }),
    Object.assign(new Error("x"), { stderr: "error connecting to api.github.com: could not resolve host" }), Object.assign(new Error("x"), { stderr: "HTTP 429: API rate limit exceeded" })]) {
    assert.equal(classifyFailure(e), "unreadable", String(e.stderr ?? e.message));
  }
  for (const e of [Object.assign(new Error("spawnSync gh ENOENT"), { code: "ENOENT" }), Object.assign(new Error("x"), { stderr: "HTTP 404: Not Found" }), Object.assign(new Error("x"), { stderr: "no such branch" })]) {
    assert.equal(classifyFailure(e), "hard", String(e.stderr ?? e.message));
  }
  assert.equal(exitOf("unreadable"), 4);
  assert.ok(![0, 1, 2, 3].includes(exitOf("unreadable")), "UNREADABLE owns its exit code");
});

test("RED: a recorded 502 then green returns green after one wait", async () => {
  const r = await door({ ...GREEN_TABLE(), runs: (n) => (n === 1 ? bad502() : [mkRun()]) });
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.slept.length, 1);
  assert.equal(r.slept[0], 30000, "the default interval is thirty seconds");
});

test("RED: a 502 forever exits UNREADABLE (its own code), never RED and never GREEN", async () => {
  const r = await door({ ...GREEN_TABLE(), runs: bad502 });
  assert.equal(r.code, 4, r.out + r.err);
  assert.match(r.out, /ci-verdict: UNREADABLE for aaaaaaaaa/);
  assert.doesNotMatch(r.out, /ci-verdict: (RED|GREEN)/);
  assert.equal(r.slept.length, 6, "six reads again, then it says so");
  const wait = await door({ ...GREEN_TABLE(), runs: bad502 }, ["--wait"]);
  assert.equal(wait.code, 4, "under --wait the same bounded wait ends in UNREADABLE");
});

test("RED: a run whose jobs endpoint stays 502 falls back to that run's own conclusion at the exact sha", async () => {
  const jobs502 = () => Object.assign(new Error("x"), { stderr: "HTTP 502: Bad Gateway (https://api.github.com/repos/x/actions/runs/11/jobs)" });
  const g = await door({ runs: [mkRun()], "view:11": jobs502, heldRuns: [mkHeld()], "view:22": jobs502 });
  assert.equal(g.code, 0, g.out + g.err);
  assert.match(g.out, /ci-verdict: GREEN[^\n]*run conclusion only/);
  assert.match(g.out, /held-out: GREEN[^\n]*run conclusion only/);
  assert.match(g.out, /^job-minutes: unread \(the run's jobs endpoint stayed unreadable\)$/m);
  const red = await door({ runs: [mkRun({ conclusion: "failure" })], "view:11": jobs502, heldRuns: [mkHeld()], "view:22": heldGreenView() });
  assert.equal(red.code, 1, "a failure conclusion still reads RED with its jobs unread");
  const live = await door({ runs: [mkRun({ status: "in_progress", conclusion: null })], "view:11": jobs502, heldRuns: [mkHeld()], "view:22": heldGreenView() });
  assert.equal(live.code, 2, "a run still running reads unread, not green");
});

test("a head the branch list's window misses is asked for by sha (`gh run list --commit`)", async () => {
  const r = await door({ ...GREEN_TABLE(), runs: [mkRun({ headSha: "b".repeat(40), databaseId: 99 })], "view:99": { jobs: [] }, runsAtSha: [mkRun()], heldRuns: [], heldRunsAtSha: [mkHeld()] });
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(r.calls.some((c) => c.includes("--commit") && c.includes(SHA)));
});

test("RED: --wait returns once neither reading is unread: unread, unread, green returns green on the third read", async () => {
  const r = await door({ ...GREEN_TABLE(), runs: (n) => (n < 3 ? [mkRun({ status: "in_progress", conclusion: null })] : [mkRun()]) }, ["--wait", "--interval", "7"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.n.runs, 3);
  assert.deepEqual(r.slept, [7000, 7000]);
});

test("RED: without --wait an unread head exits 2 at once; a cancelled-clean run keeps --wait waiting", async () => {
  const once = await door({ ...GREEN_TABLE(), runs: [mkRun({ status: "in_progress", conclusion: null })] });
  assert.equal(once.code, 2);
  assert.equal(once.n.runs, 1);
  const w = await door({ ...GREEN_TABLE(), runs: (n) => (n === 1 ? [mkRun({ conclusion: "cancelled" })] : [mkRun()]) }, ["--wait"]);
  assert.equal(w.code, 0);
  assert.equal(w.n.runs, 2, "the cancelled-clean run measured nothing, so the wait read again");
});

test("RED: --wait also waits for a held-out run that does not name the head yet", async () => {
  const r = await door({ ...GREEN_TABLE(), heldRuns: (n) => (n < 3 ? [] : [mkHeld()]), heldRunsAtSha: [] }, ["--wait"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.n.heldRuns, 3);
});

test("job-minutes: a recorded jobs JSON sums to the figure by hand; critical path is the run's first start to last end", () => {
  const view = { jobs: [
    mkJob("Test", "2026-10-30T10:00:00Z", "2026-10-30T10:10:00Z"),            // 10
    mkJob("Witnesses", "2026-10-30T10:00:30Z", "2026-10-30T10:04:30Z"),       // 4
    mkJob("Lint", "2026-10-30T10:10:00Z", "2026-10-30T10:12:30Z"),            // 2.5
    mkJob("Skipped", "0001-01-01T00:00:00Z", "0001-01-01T00:00:00Z", { conclusion: "skipped" }),
  ] };
  const jm = jobMinutes(view);
  assert.equal(jm.partial, false);
  assert.equal(jm.minutes, 16.5);
  assert.equal(jm.criticalMin, 12.5);
  assert.equal(renderJobMinutes(jm), "job-minutes: 16.5 (critical path 12.5 min)");
});

test("job-minutes: a job with no completion reads PARTIAL, never a smaller number", () => {
  const view = { jobs: [mkJob("Test", T0, T1), mkJob("Slow", T0, null, { status: "in_progress", conclusion: null })] };
  const jm = jobMinutes(view);
  assert.equal(jm.partial, true);
  const line = renderJobMinutes(jm);
  assert.match(line, /^job-minutes: partial /);
  assert.doesNotMatch(line, /^job-minutes: \d/);
  assert.equal(renderJobMinutes(jobMinutes(undefined)).startsWith("job-minutes: unread"), true);
});

test("the door still exits 3 when gh is absent, and 3 for a hard read failure (not UNREADABLE)", async () => {
  const r = await door({ ...GREEN_TABLE(), runs: () => Object.assign(new Error("x"), { stderr: "HTTP 404: Not Found" }) });
  assert.equal(r.code, 3);
  assert.match(r.err, /ci-verdict: could not read/);
  assert.deepEqual(r.slept, [], "a hard failure never waits");
});
