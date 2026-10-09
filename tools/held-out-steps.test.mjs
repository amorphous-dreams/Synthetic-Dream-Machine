// held-out-steps.test.mjs — the workflow reader runs a held-out job with the runner's semantics, and a red step
// reads red through it. A reader that skipped what it could not parse, or read a failed step as passed, would
// turn every local proof of the held-out workflow into a silent zero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkflow, planFor, runJob, shouldRun, readEnvFile } from "./held-out-steps.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HELD_OUT = readFileSync(join(ROOT, ".github/workflows/held-out.yml"), "utf8");

/** A small workflow in the held-out shape: one job, a matrix of drivers, steps keyed by driver. */
const fixture = (steps, { timeout = "${{ matrix.timeout_minutes }}", minutes = "5" } = {}) => `name: fixture
on:
  workflow_dispatch:
jobs:
  held-out:
    runs-on: ubuntu-latest
    timeout-minutes: ${timeout}
    strategy:
      matrix:
        include:
          - driver: green
            timeout_minutes: ${minutes}
          - driver: red
            timeout_minutes: ${minutes}
            mesh: true
    env:
      GREETING: "aloha"
    steps:
${steps}
`;

async function run(text, driver) {
  const temp = mkdtempSync(join(tmpdir(), "held-out-steps-"));
  const lines = [];
  try {
    const r = await runJob(parseWorkflow(text), driver, { cwd: temp, env: { PATH: process.env.PATH, RUNNER_TEMP: temp }, log: (l) => lines.push(l) });
    return { ...r, lines };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

const STEPS = `      - name: Set a value later steps read
        run: |
          echo "CARRIED=from-step-one" >> "$GITHUB_ENV"
      - name: Read the carried value
        run: test "$CARRIED" = from-step-one && test "$GREETING" = aloha
      - name: Fail on the red driver
        if: matrix.driver == 'red'
        shell: bash
        run: |
          false | true
          echo "pipefail never let the line above pass"
          exit 7
      - name: A step after a failure
        run: echo should-not-run
      - name: A keyed step after a failure
        if: matrix.driver == 'red'
        run: echo should-not-run-either
      - name: Always holds evidence
        if: always()
        run: echo held`;

test("CONTROL: a red step reads RED through the reader, later steps skip, and an always() step still runs", async () => {
  const r = await run(fixture(STEPS), "red");
  assert.equal(r.verdict, "RED");
  assert.equal(r.failed, "Fail on the red driver");
  assert.ok(r.lines.includes("[held-out] ✗ Fail on the red driver — exit 1"), r.lines.join("\n"));
  assert.ok(r.lines.includes("[held-out] skip  A step after a failure"));
  assert.ok(r.lines.includes("[held-out] skip  A keyed step after a failure"), "a condition without a status function carries success()");
  assert.ok(r.lines.includes("[held-out] ✓ Always holds evidence"));
});

test("a green job reads GREEN, and $GITHUB_ENV reaches every later step", async () => {
  const r = await run(fixture(STEPS), "green");
  assert.equal(r.verdict, "GREEN", r.lines.join("\n"));
  assert.ok(r.lines.includes("[held-out] ✓ Read the carried value"));
  assert.ok(r.lines.includes("[held-out] skip  Fail on the red driver"));
});

test("`shell: bash` carries pipefail and the default shell does not, as on the runner", async () => {
  const steps = `      - name: Default shell ignores a failed pipe head
        run: false | true
      - name: Bash shell fails it
        shell: bash
        run: false | true`;
  const r = await run(fixture(steps), "green");
  assert.equal(r.verdict, "RED");
  assert.equal(r.failed, "Bash shell fails it");
});

test("the job timeout cancels a step and its process group; only always() steps run after it", async () => {
  const steps = `      - name: Outlives the job
        run: sleep 30 & wait
      - name: Never reached
        run: "true"
      - name: Teardown
        if: always()
        run: "true"`;
  const started = Date.now();
  const r = await run(fixture(steps, { minutes: "0.02" }), "green");
  assert.ok(Date.now() - started < 8_000, "the deadline signalled the group at once, well before the kill fallback");
  assert.equal(r.verdict, "CANCELLED");
  assert.ok(r.lines.includes("[held-out] skip  Never reached"));
  assert.ok(r.lines.includes("[held-out] ✓ Teardown"));
});

test("CONTROL: an unknown step key, condition, expression or action throws instead of skipping", async () => {
  assert.throws(() => parseWorkflow(fixture(`      - name: x\n        continue-on-error: true\n        run: "true"`)), /continue-on-error/);
  assert.throws(() => shouldRun("hashFiles('x') != ''", { matrix: {} }, "success"), /no local reading/);
  await assert.rejects(run(fixture(`      - name: x\n        run: echo \${{ secrets.TOKEN }}`), "green"), /secrets.TOKEN/);
  await assert.rejects(run(fixture(`      - uses: someone/unknown-action@v1`), "green"), /no local reading/);
});

test("a bare boolean in the matrix never equals the string 'true', as the runner compares them", () => {
  assert.equal(shouldRun("matrix.mesh == 'true'", { matrix: { mesh: true } }, "success"), false);
  assert.equal(shouldRun("matrix.mesh == 'true'", { matrix: { mesh: "true" } }, "success"), true);
  assert.equal(shouldRun("always() && matrix.mesh == 'true'", { matrix: {} }, "failure"), false);
  assert.equal(shouldRun("always() && matrix.mesh == 'true'", { matrix: { mesh: "true" } }, "failure"), true);
});

test("$GITHUB_ENV reads plain and heredoc lines, and refuses a line it cannot read", () => {
  assert.deepEqual(readEnvFile("A=1\nB<<EOF\ntwo\nlines\nEOF\n"), { A: "1", B: "two\nlines" });
  assert.throws(() => readEnvFile("not an assignment\n"), /no reading/);
});

test("every held-out job installs, renders, builds, stamps, then drives, and uploads its evidence", () => {
  const wf = parseWorkflow(HELD_OUT);
  const drivers = wf.matrix.map((m) => m.driver);
  assert.deepEqual(drivers, ["browser-weld", "civic", "crossing", "herm-mesh", "mesh-scenarios"]);
  for (const driver of drivers) {
    const plan = planFor(wf, driver);
    const at = (pred, what) => {
      const i = plan.findIndex(pred);
      assert.ok(i >= 0, `${driver}: no step ${what}`);
      return i;
    };
    const order = [
      at((s) => s.uses?.startsWith("actions/checkout@"), "checks out"),
      at((s) => /pnpm install --frozen-lockfile/.test(s.run ?? ""), "installs"),
      at((s) => /build:tw5-vendor/.test(s.run ?? ""), "renders the engine blob"),
      at((s) => /^pnpm -r build\s*$/.test(s.run ?? ""), "builds"),
      at((s) => /^node tools\/stamp-build\.mjs \.\s*$/.test(s.run ?? ""), "stamps"),
      at((s) => s.name === `Run ${driver}`, "drives"),
      at((s) => s.uses?.startsWith("actions/upload-artifact@"), "uploads evidence"),
    ];
    assert.deepEqual([...order].sort((a, b) => a - b), order, `${driver}: the job runs its acts in order`);
  }
  const herm = planFor(wf, "herm-mesh");
  const stand = herm.findIndex((s) => /node tools\/mesh-pins\.mjs --up herm-source herm-relay herm-relay-2/.test(s.run ?? ""));
  assert.ok(stand >= 0 && stand < herm.findIndex((s) => s.name === "Run herm-mesh"), "herm-mesh stands its pins before it drives");
  assert.ok(!/docker compose -f docker-compose\.mesh\.yml up/.test(HELD_OUT), "no step stands the mesh bare, without pins");
});

test("no held-out step leans on this machine: no home paths, no host lock files, no pre-existing ~/.lares", () => {
  for (const line of HELD_OUT.split("\n").filter((l) => !l.trim().startsWith("#"))) {
    assert.doesNotMatch(line, /\/home\/|~\/\.lares|\$HOME\/\.lares|lar-e2e\.lock|\/tmp\//, line);
  }
  assert.ok(existsSync(join(ROOT, "tools/held-out-steps.mjs")));
});
