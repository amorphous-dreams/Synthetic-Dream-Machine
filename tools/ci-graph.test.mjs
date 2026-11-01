// ci-graph.test.mjs — a full CI run stands at most ten concurrent jobs, so two full runs fit the account's twenty.
// The reader's controls plant a graph with a known width; the REDs hold the live workflow files to the cap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { graphNumbers, liveFiles, mergeGroupOnly, runsPerLanePush, readJobs, triggers, widestConcurrent } from "./ci-graph.mjs";

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

test("G2b CONTROL: a workflow with no fork guard raises a run per event, a guarded one only its push", () => {
  const open = "on:\n  push:\n  pull_request:\njobs:\n  a:\n    name: A\n";
  const guarded = "on:\n  push:\n  pull_request:\njobs:\n  a:\n    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork }}\n";
  const partly = guarded + "  b:\n    name: B\n";
  assert.equal(runsPerLanePush(open), 2);
  assert.equal(runsPerLanePush(guarded), 1);
  assert.equal(runsPerLanePush(partly), 2, "one unguarded job still raises the PR run");
  assert.equal(runsPerLanePush("on:\n  schedule:\n"), 0);
});

test("G2c: the merge queue's hook stands as a comment in ci.yml's on: block, and no job guards merge_group off", () => {
  const files = liveFiles(ROOT);
  assert.match(files["ci.yml"], /^ {2}# MERGE QUEUE HOOK \(not wired yet\)/m, "ci.yml lost the comment hook where merge_group will go");
  assert.ok(!triggers(files["ci.yml"]).includes("merge_group"), "merge_group is wired: its lane (trigger, ref ignore, security-read gate) owns that");
  for (const j of readJobs(files["ci.yml"])) if (j.ifText && !mergeGroupOnly(j.ifText)) assert.doesNotMatch(j.ifText, /merge_group/, `${j.id} guards merge_group off`);
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
    "noosphere-boot.mem must stay under the 40000-char ceiling", "generate-parity — the committed parser.c stays the truth",
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
