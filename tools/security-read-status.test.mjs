// security-read-status.test.mjs — the merge queue's security-read gate: a queued PR that touches a security-class path
// passes only with a `security-read: success` status on its head, and the one path table serves the controller and the gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as sr from "./security-read-status.mjs";
import { graphNumbers, liveFiles, readJobs } from "./ci-graph.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ci = () => readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
const code = (t) => t.replace(/^\s*#.*$/gm, "");

test("S0 RED: the module exports the table, the matcher, the group law and the status poster", () => {
  for (const name of ["SECURITY_CLASS_PATHS", "isSecurityClassPath", "queuePrNumbers", "evaluateGroup", "postStatusArgs"]) assert.ok(name in sr, `security-read-status.mjs exports no ${name}`);
});

test("S1 RED: ONE table names the security-class paths, and the matcher reads GitHub globs against it", () => {
  assert.ok(Array.isArray(sr.SECURITY_CLASS_PATHS) && sr.SECURITY_CLASS_PATHS.length >= 5);
  for (const row of sr.SECURITY_CLASS_PATHS) assert.ok(row.glob && row.why, `a table row names no glob or no reason: ${JSON.stringify(row)}`);
  for (const p of [".github/workflows/ci.yml", "tools/land-train.mjs", "tools/security-read-status.mjs", "packages/lararium-node/src/custody/scratch-custody.ts", "packages/lararium-keyhive/src/index.ts"]) assert.equal(sr.isSecurityClassPath(p), true, p);
  for (const p of ["README.md", "bags/lares/x.mem", "packages/lararium-web/src/ui.ts", "tools/ci-graph.mjs", "wikis/w/working/t.tid"]) assert.equal(sr.isSecurityClassPath(p), false, p);
  // every table row stands on a real tracked file or a glob over tracked files, so a renamed path cannot silently empty its row
  const tracked = (readFileSync(join(ROOT, "tools/security-read-status.mjs"), "utf8"), sr.trackedFiles?.(ROOT) ?? []);
  for (const row of sr.SECURITY_CLASS_PATHS) assert.ok(tracked.some((f) => sr.matchesGlob(row.glob, f)), `row ${row.glob} matches no tracked file`);
});

test("S2 RED: a queue group's PRs read off the queue ref and the merge subjects, once each", () => {
  const ref = "refs/heads/gh-readonly-queue/feature/green-jello-dinosaur-5/pr-212-0a1b2c3d4e5f60718293a4b5c6d7e8f901234567";
  assert.deepEqual(sr.queuePrNumbers({ ref, subjects: ["Merge pull request #211 from x/y", "Merge pull request #212 from x/z", "lar:///ha.ka.ba/x — Merge pull request #210 note"] }), [210, 211, 212]);
  assert.deepEqual(sr.queuePrNumbers({ ref, subjects: [] }), [212]);
  assert.throws(() => sr.queuePrNumbers({ ref: "refs/heads/feature/x", subjects: [] }), /queue ref/);
});

const pr = (number, files, statuses = []) => ({ number, headSha: `sha${number}`, files, statuses });
test("S3 RED: the gate passes a group whose security-class PRs carry security-read success, and refuses by PR number the rest", () => {
  const sec = ["tools/land-train.mjs"], plain = ["README.md"];
  assert.deepEqual(sr.evaluateGroup({ prs: [pr(1, plain), pr(2, sec, [{ context: "security-read", state: "success" }])] }).problems, [], "CONTROL: plain PR needs no status, a read PR passes");
  const v = sr.evaluateGroup({ prs: [pr(3, sec), pr(4, sec, [{ context: "security-read", state: "pending" }]), pr(5, sec, [{ context: "security-read", state: "failure" }]), pr(6, plain)] });
  assert.equal(v.ok, false);
  for (const n of [3, 4, 5]) assert.match(v.problems.join("\n"), new RegExp(`PR #${n}\\b.*security-read`));
  assert.doesNotMatch(v.problems.join("\n"), /PR #6\b/);
  assert.equal(sr.evaluateGroup({ prs: [] }).ok, false, "an empty group reads red: the gate measured nothing");
  const noFiles = sr.evaluateGroup({ prs: [pr(7, [])] });
  assert.equal(noFiles.ok, false, "a PR with no file list read cannot be called plain");
  // the latest status for the context decides, so a later failure outranks an earlier success
  const flip = sr.evaluateGroup({ prs: [pr(8, sec, [{ context: "security-read", state: "success" }, { context: "security-read", state: "failure" }])] });
  assert.equal(flip.ok, false);
});

test("S4 RED: the poster builds the statuses call for the PR's own head sha, context security-read, and refuses a state it does not know", () => {
  const a = sr.postStatusArgs({ repo: "o/r", sha: "abc1234", state: "success", description: "SHIP: read at train 7" });
  assert.deepEqual(a.slice(0, 2), ["api", "repos/o/r/statuses/abc1234"]);
  assert.ok(a.includes("context=security-read") && a.includes("state=success"));
  assert.throws(() => sr.postStatusArgs({ repo: "o/r", sha: "abc1234", state: "maybe" }), /state/);
  assert.throws(() => sr.postStatusArgs({ repo: "o/r", sha: "main", state: "success" }), /sha/);
});

test("S5 RED: ci.yml wires the queue: merge_group checks_requested on the span, the queue refs ignored on push, and a security-read-gate job", () => {
  const yml = code(ci());
  assert.match(yml, /^  merge_group:\n    types: \[checks_requested\]\n    branches: \[feature\/green-jello-dinosaur-5\]$/m);
  assert.match(yml, /branches-ignore: \["ci\/\*\*", "gh-readonly-queue\/\*\*"\]/);
  const job = readJobs(ci()).find((j) => j.id === "security-read-gate");
  assert.ok(job, "ci.yml carries no security-read-gate job");
  assert.deepEqual(job.needs, ["quick"], "the gate waits on the quick job, so a merge_group run stays ten jobs wide");
  assert.match(job.ifText, /github\.event_name == 'merge_group'/);
  assert.match(yml, /node tools\/security-read-status\.mjs gate/);
  assert.match(yml, /^    name: security-read-gate$/m);
});

test("S6 RED: with the gate beside them the graph still holds ten concurrent jobs, and the gate runs on merge_group alone", () => {
  const push = graphNumbers("ci.yml", liveFiles(ROOT));
  assert.ok(!push.jobs.includes("security-read-gate"), "a push raises the merge_group gate");
  const n = graphNumbers("ci.yml", liveFiles(ROOT), { event: "merge_group" });
  assert.ok(n.concurrent <= 10, `the merge_group graph reads ${n.concurrent} wide`);
  assert.ok(n.jobs.includes("security-read-gate"));
  assert.ok(n.total <= 14, `${n.total} jobs`);
});
