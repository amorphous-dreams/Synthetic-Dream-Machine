// ci-verdict.test — the reader's law over a RECORDED reading of this repository's own CI (`ci-verdict.fixture.json`):
// twelve runs of one branch, of which one still ran, six got cancelled by a newer push and five completed red, plus the
// job view of the newest whole run. No network, no `gh`: `readVerdict` takes the JSON as data.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exitOf, failing, readVerdict, render } from "./ci-verdict.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { runs, views } = JSON.parse(readFileSync(join(HERE, "ci-verdict.fixture.json"), "utf8"));
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

test("the door answers exit 3 when it cannot read, never 0", () => {
  // No `gh` and no `git` on this PATH: the reader must say so and refuse to answer green.
  const r = spawnSync(process.execPath, [join(HERE, "ci-verdict.mjs"), "--branch", "x", "--head", "HEAD"], { encoding: "utf8", env: { PATH: "/nonexistent" } });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /ci-verdict: could not read/);
});

test("the shard lane's push door ends on the line that names this reader", async () => {
  const { HALF_VERDICT } = await import("./e2e-shards.mjs");
  assert.match(HALF_VERDICT, /node tools\/ci-verdict\.mjs --head$/);
  const src = readFileSync(join(HERE, "e2e-shards.mjs"), "utf8");
  const push = src.slice(src.indexOf("async function cliPush("), src.indexOf("\n}\n", src.indexOf("async function cliPush(")));
  assert.match(push, /console\.log\(`\$\{HALF_VERDICT\} \$\{result\.headSha\.slice\(0, 9\)\}`\)/,
    "the push door stopped naming the head it pushed (the checkout's head moves while the run goes)");
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
