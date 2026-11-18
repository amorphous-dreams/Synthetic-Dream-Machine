// ci-graph.test.mjs — a full CI run stands at most ten concurrent jobs, so two full runs fit the account's twenty.
// The reader's controls plant a graph with a known width; the REDs hold the live workflow files to the cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { evalExpr, eventContext, graphNumbers, liveFiles, mergeGroupOnly, REQUIRED_CHECKS, runPlan, runsPerLanePush, readJobs, triggers, widestConcurrent } from "./ci-graph.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CAP = 10;
const GATES = 3;

const planted = `name: x
on:
  push:
jobs:
  a:
    name: A
  b:
    name: B
    strategy:
      matrix:
        include:
          - { k: 1 }
          - { k: 2 }
          - { k: 3 }
  gate:
    needs: b
    if: always()
  c:
    needs: [a, gate]
`;

test("G0 CONTROL: the reader counts a planted graph's width and total (a, three b rows and the gate; c waits on both)", () => {
  const n = graphNumbers("x.yml", { "x.yml": planted });
  assert.equal(n.total, 6);
  // a, b#1..3 stand free of each other: 4 wide. The gate waits on the b rows, so {a, gate} is 2; c waits on all.
  assert.equal(n.concurrent, 4);
  assert.deepEqual(readJobs(planted).map((j) => [j.id, j.rows, j.needs]), [["a", 1, []], ["b", 3, []], ["gate", 1, ["b"]], ["c", 1, ["a", "gate"]]]);
  assert.equal(widestConcurrent([]), 0);
});

test("G0b CONTROL: a shape the reader does not know throws, never a quiet zero", () => {
  assert.throws(() => graphNumbers("x.yml", { "x.yml": "jobs:\n  a:\n    needs:\n      - b\n" }), /block-form needs/);
  assert.throws(() => graphNumbers("x.yml", { "x.yml": "jobs:\n  a:\n    strategy:\n      matrix: ${{ fromJSON(x) }}\n" }), /expression/);
});

test("G1 RED: a full CI run raises at most ten jobs that can run at once, and at most thirteen in all", () => {
  const n = graphNumbers("ci.yml", liveFiles(ROOT));
  assert.ok(n.concurrent <= CAP, `ci.yml raises ${n.concurrent} concurrent jobs (cap ${CAP}): ${n.jobs.join(", ")}`);
  assert.ok(n.total <= CAP + GATES, `ci.yml raises ${n.total} jobs in all (cap ${CAP + GATES}: ${CAP} cells and ${GATES} gates)`);
});

test("G2 RED: a lane push with an open pull request raises ONE CI run, and a fork's pull request still raises its own", () => {
  const ci = liveFiles(ROOT)["ci.yml"];
  assert.equal(runsPerLanePush(ci), 1, "push and pull_request each raise a full run for one sha");
  assert.ok(triggers(ci).includes("push"));
  assert.ok(triggers(ci).includes("pull_request"), "a fork's pull request has no push in this repository: the trigger stays");
});

test("G2d RED: a pull request into `develop` (the integration branch) or `main` raises CI, and the merge queue answers on `develop`", () => {
  const ci = liveFiles(ROOT)["ci.yml"];
  assert.match(ci, /^ {2}pull_request:\n {4}branches: \[develop, main\]$/m);
  assert.match(ci, /^ {2}merge_group:\n {4}types: \[checks_requested\]\n {4}branches: \[develop\]$/m);
});

test("G2b CONTROL: a workflow with no fork guard raises a run per event, a guarded one only its push", () => {
  const open = "on:\n  push:\n  pull_request:\njobs:\n  a:\n    name: A\n";
  const guarded = "on:\n  push:\n  pull_request:\njobs:\n  a:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork }}\n";
  const partly = guarded + "  b:\n    name: B\n";
  assert.equal(runsPerLanePush(open), 2);
  assert.equal(runsPerLanePush(guarded), 1);
  assert.equal(runsPerLanePush(partly), 2, "one unguarded job still raises the PR run");
  assert.equal(runsPerLanePush("on:\n  schedule:\n"), 0);
});

test("G2c RED: the merge queue raises ONE full CI run per group, and held-out waits for the group's merge onto develop", () => {
  const files = liveFiles(ROOT);
  const ci = files["ci.yml"];
  assert.ok(triggers(ci).includes("merge_group"), "ci.yml answers no merge_group: the queue would wait on a check that never comes");
  // The queue pushes each group to `gh-readonly-queue/<base>/...`; the push trigger skipping those refs leaves merge_group the one run.
  const ignore = /^ {4}branches-ignore: \[(.*)\]$/m.exec(ci)?.[1] ?? "";
  assert.match(ignore, /"gh-readonly-queue\/\*\*"/, "a queue group's ref push raises a second full run beside merge_group");
  for (const j of readJobs(ci)) if (j.ifText && !mergeGroupOnly(j.ifText)) assert.doesNotMatch(j.ifText, /merge_group/, `${j.id} guards merge_group off`);
  assert.equal(graphNumbers("ci.yml", files, { event: "merge_group" }).total, graphNumbers("ci.yml", files).total, "the queue's run raises fewer jobs than a push run");
  const heldOut = readFileSync(join(ROOT, ".github/workflows/held-out.yml"), "utf8");
  assert.ok(!triggers(heldOut).includes("merge_group"), "held-out rides the queue: its container cells would hold every group past the CI verdict");
});

test("G3a CONTROL: held-out holds its cells to the cap already (the row retires: it read green at the cut)", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/held-out.yml"), "utf8");
  const parallel = Number(/^ {6}max-parallel:\s*(\d+)\s*$/m.exec(text)?.[1]);
  assert.ok(Number.isInteger(parallel) && parallel <= CAP, `held-out cells run ${parallel} at once (cap ${CAP})`);
  assert.equal(runsPerLanePush(text), 1);
});

test("G3 RED: a span push, CI beside held-out, stays inside the account's twenty running jobs", () => {
  const text = readFileSync(join(ROOT, ".github/workflows/held-out.yml"), "utf8");
  const parallel = Number(/^ {6}max-parallel:\s*(\d+)\s*$/m.exec(text)?.[1]);
  const n = graphNumbers("ci.yml", liveFiles(ROOT));
  assert.ok(n.concurrent + parallel <= 20, `CI ${n.concurrent} + held-out ${parallel} overflows twenty`);
});

test("G4 RED: the quick job keeps every folded gate as a named step that runs whatever the steps before it answered", () => {
  const yml = liveFiles(ROOT)["ci.yml"];
  const at = yml.search(/^  quick:\n/m);
  assert.ok(at >= 0, "ci.yml has no quick job");
  const rest = yml.slice(at + 1);
  const block = rest.slice(0, rest.search(/^  [a-z][\w-]*:\n/m));
  const steps = [...block.matchAll(/^      - (?:name: (.+)|uses: (\S+)|run: .*)$[\s\S]*?(?=^      - |(?![\s\S]))/gm)];
  const named = new Map();
  for (const m of steps) if (m[1]) named.set(m[1], m[0]);
  for (const want of [
    "Every dependency names ONE version", "Generated artifacts must be fresh (build emits no tracked diff)", "Typecheck all packages",
    "noosphere-boot.mem stands where the hooks load it", "generate-parity — the committed parser.c stays the truth",
    "fold + golden manifest gates (py host)", "wasm builds under the pinned CLI", "fold + parity gates (ts host)",
    "Run the floor crossing under a scratch home", "meme-routes + standalone single-file contact against the pristine engine",
    "The log names the engine it met", "Run the hosted witness cell contract-witness",
  ]) {
    assert.ok(named.has(want), `the quick job lost the step "${want}"`);
    assert.match(named.get(want), /^        if: \$\{\{ !cancelled\(\)/m, `"${want}" stops behind a red step: one red gate would hide the rest`);
  }
  assert.match(block, /name: witness-cell-contract-witness$/m, "the hosted cell uploads no log under its own name");
});

test("G5 CONTROL: a merge_group-only job joins the merge_group run's graph and no push run's", () => {
  const text = planted + "  q:\n    needs: a\n    if: ${{ always() && github.event_name == 'merge_group' }}\n";
  assert.equal(graphNumbers("x.yml", { "x.yml": text }).total, 6);
  assert.equal(graphNumbers("x.yml", { "x.yml": text }, { event: "merge_group" }).total, 7);
  assert.equal(mergeGroupOnly("${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork }}"), false);
});

// ── DOORSTEP QUICK, FORD FULL (the operator's ruling, 2026-11-18) ────────────────────────────────
// A push to a lane branch (`develop--*`, `lane/*`, the names held-out.yml and tools/disk-guard.mjs read) runs the Quick gates
// alone. The full battery runs on `merge_group`, on a push to `develop` or `main`, on a fork's pull request and by hand.
// Every required check still reports on a lane head, or no lane enters the queue.

const ran = (plan) => plan.filter((j) => j.state === "run").map((j) => j.key);
const FULL = [
  ["merge_group", eventContext("merge_group")],
  ["a push to develop", eventContext("push", { branch: "develop" })],
  ["a push to main", eventContext("push", { branch: "main" })],
  ["a push to a feature span", eventContext("push", { branch: "feature/green-jello-dinosaur-5" })],
  ["a dispatch on a lane branch", eventContext("workflow_dispatch", { branch: "develop--ford-quick" })],
  ["a fork's pull request", eventContext("pull_request", { fork: true })],
];
const LANES = ["develop--ford-quick", "lane/x"];

test("D0 CONTROL: the run reader evaluates guards, implicit success() and always() over a planted graph", () => {
  const text = `on:\n  push:\njobs:\n  a:\n    name: A\n    if: \${{ !startsWith(github.ref, 'refs/heads/lane/') }}\n  b:\n    name: B\n    needs: a\n  c:\n    name: C\n    needs: a\n    if: \${{ always() && github.event_name == 'push' }}\n`;
  const at = (branch) => runPlan("x.yml", { "x.yml": text }, eventContext("push", { branch })).map((j) => `${j.key}:${j.state}`);
  assert.deepEqual(at("develop"), ["a:run", "b:run", "c:run"]);
  assert.deepEqual(at("lane/x"), ["a:skipped", "b:skipped", "c:run"], "b skips behind a (implicit success()); c's always() runs it");
  assert.equal(evalExpr("${{ github.event_name == 'PUSH' }}", eventContext("push")), true, "== compares case-blind");
  assert.throws(() => evalExpr("${{ hashFiles('x') }}", eventContext("push")), /does not know hashFiles/);
  assert.throws(() => evalExpr("${{ a < b }}", eventContext("push")), /does not know/);
});

test("D0b CONTROL: a skipped caller raises its own name alone, a running one raises `Caller / Callee` with the caller's inputs", () => {
  const caller = (guard) => `on:\n  push:\njobs:\n  e:\n    name: E\n    if: \${{ ${guard} }}\n    uses: ./.github/workflows/y.yml\n    with:\n      flag: \${{ github.event_name == 'push' }}\n`;
  const callee = `on:\n  workflow_call:\njobs:\n  m:\n    name: M\n    steps:\n      - name: one\n        if: \${{ inputs.flag }}\n        run: x\n      - name: two\n        if: \${{ !inputs.flag }}\n        run: x\n`;
  const on = runPlan("x.yml", { "x.yml": caller("true"), "y.yml": callee }, eventContext("push"));
  assert.deepEqual(on.map((j) => [j.name, j.state, j.steps]), [["E / M", "run", ["one"]]]);
  const off = runPlan("x.yml", { "x.yml": caller("false"), "y.yml": callee }, eventContext("push"));
  assert.deepEqual(off.map((j) => j.name), ["E"], "the callee's check never appears under a skipped caller");
});

test("D1 RED: a lane push runs the Quick gates alone; the e2e gate answers on its doorstep step and walks no shard", () => {
  const files = liveFiles(ROOT);
  for (const branch of LANES) {
    const plan = runPlan("ci.yml", files, eventContext("push", { branch }));
    assert.deepEqual(ran(plan), ["quick", "e2e/merge"], `${branch}: ${ran(plan).join(", ")}`);
    const merge = plan.find((j) => j.key === "e2e/merge");
    assert.equal(merge.steps.length, 1, `${branch}: the e2e gate walks ${merge.steps.join(" · ")} on a lane push`);
    assert.match(merge.steps[0], /^Doorstep/, "the one step the e2e gate walks on a lane push names the doorstep");
  }
});

test("D2 RED: merge_group, develop and main pushes, a feature span's push, a dispatch and a fork's PR run every job", () => {
  const files = liveFiles(ROOT);
  const every = readJobs(files["ci.yml"]).length - 1 + readJobs(files["e2e-shards.yml"]).length;
  for (const [what, ctx] of FULL) {
    const plan = runPlan("ci.yml", files, ctx);
    assert.equal(plan.length, every, `${what}: a job went missing`);
    assert.deepEqual(plan.filter((j) => j.state !== "run").map((j) => j.key), [], `${what} skips a job`);
    const merge = plan.find((j) => j.key === "e2e/merge");
    assert.ok(merge.steps.includes("Merge gate — fails closed on any missing, empty, red or mismatched shard"), `${what}: the e2e merge gate walks no gate`);
    assert.ok(!merge.steps.some((s) => /^Doorstep/.test(s ?? "")), `${what}: the doorstep step answers on a full run`);
  }
  // The same-repository pull request still raises nothing: the push owns its sha.
  assert.deepEqual(ran(runPlan("ci.yml", files, eventContext("pull_request", { fork: false }))), []);
});

test("D3 RED: every required check stands defined ONCE and reports on a lane push (run or skipped), and runs on every full event", () => {
  const files = liveFiles(ROOT);
  for (const [what, ctx] of [...LANES.map((b) => [b, eventContext("push", { branch: b })]), ...FULL]) {
    const plan = runPlan("ci.yml", files, ctx);
    for (const name of REQUIRED_CHECKS) {
      const twins = plan.filter((j) => j.name === name);
      assert.equal(twins.length, 1, `${what}: the required check "${name}" stands ${twins.length} times (0 reads "expected" forever; 2 lets a skipped twin answer for a red one)`);
      if (FULL.some(([w]) => w === what)) assert.equal(twins[0].state, "run", `${what}: the required check "${name}" skips on a full run`);
    }
  }
});
