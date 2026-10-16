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
import { MERGE_JOB, driverOf, exitOf, failing, heldOutDrivers, heldOutUnreadable, readHeldOut, readVerdict, render, renderHeldOut } from "./ci-verdict.mjs";

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
  assert.equal(driverOf("Held-out · meshless"), null);
  assert.equal(driverOf("Merge the cells"), null);
});

test("RED: the recorded held-out run reads red for its own head and names each driver's result", () => {
  const h = readHeldOut({ runs: heldOutRuns, head: HELD_HEAD, views: heldOutViews });
  assert.equal(h.state, "red");
  assert.equal(h.coversHead, true);
  assert.equal(h.behind, 0);
  assert.deepEqual(Object.fromEntries(h.drivers.map((d) => [d.driver, d.result])),
    { "browser-weld": "failure", civic: "success", crossing: "success", "herm-mesh": "failure", "mesh-scenarios": "success" });
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
  assert.deepEqual(heldOutDrivers(undefined).rows.map((r) => r.result), ["unread", "unread", "unread", "unread", "unread"]);
});

test("the third reading says and never blocks: the door's exit code follows the CI reading alone", () => {
  const src = readFileSync(join(HERE, "ci-verdict.mjs"), "utf8");
  assert.match(src, /return exitOf\(v\.state\);/);
  assert.doesNotMatch(src, /exitOf\(heldOut/);
  assert.match(src, /\.\.\.render\(v\), \.\.\.renderHeldOut\(heldOut\)/, "the door stopped printing the third reading");
  // A held-out lookup that fails reads unread and leaves the exit code where the CI reading put it.
  assert.match(src, /\} catch \(err\) \{\n\s+heldOut = heldOutUnreadable\(head, /);
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
  assert.match(push, /console\.log\(`\$\{HALF_VERDICT\} \$\{result\.branch\} --head \$\{result\.headSha\.slice\(0, 9\)\}`\)/,
    "the push door must name the branch and head it pushed");
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
