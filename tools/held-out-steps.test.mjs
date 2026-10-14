// held-out-steps.test.mjs — the workflow reader runs a held-out job with the runner's semantics, and a red step
// reads red through it. A reader that skipped what it could not parse, or read a failed step as passed, would
// turn every local proof of the held-out workflow into a silent zero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseWorkflow, planFor, runJob, shouldRun, readEnvFile, expand, githubContext, versionStands, cellOf } from "./held-out-steps.mjs";

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

/** A git checkout on a branch with one commit and a GitHub origin, as the runner's checkout leaves the job. */
function checkout(dir, { branch = "main", origin = "git@github.com:someone/somewhere.git" } = {}) {
  const git = (...args) => {
    const r = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
    return String(r.stdout).trim();
  };
  git("init", "-q", "-b", branch);
  git("config", "user.name", "Kahu Runner");
  git("config", "user.email", "kahu@example.invalid");
  git("commit", "-q", "--allow-empty", "-m", "seed");
  if (origin) git("remote", "add", "origin", origin);
  return { git, sha: git("rev-parse", "HEAD") };
}

async function run(text, driver, { env = {} } = {}) {
  const temp = mkdtempSync(join(tmpdir(), "held-out-steps-"));
  const lines = [];
  try {
    checkout(temp);
    const r = await runJob(parseWorkflow(text), driver, { cwd: temp, env: { PATH: process.env.PATH, RUNNER_TEMP: temp, ...env }, log: (l) => lines.push(l) });
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
  assert.throws(() => parseWorkflow(fixture(`      - name: x\n        working-directory: tests\n        run: "true"`)), /working-directory/);
  assert.throws(() => parseWorkflow(fixture(`      - name: x\n        continue-on-error: \${{ matrix.soft }}\n        run: "true"`)), /continue-on-error/);
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

test("a property the context lacks reads empty, as on the runner, and an upload over nothing reads RED", async () => {
  assert.equal(expand("[${{ env.NEVER_SET }}]", { env: {} }), "[]");
  const r = await run(fixture(`      - uses: actions/upload-artifact@v4
        with:
          name: evidence
          path: \${{ env.NEVER_SET }}
          if-no-files-found: error`), "green");
  assert.equal(r.verdict, "RED");
  assert.equal(r.failed, "actions/upload-artifact@v4");
});

test("the github context reads off the checkout as the runner fills it, and every run step reads it as GITHUB_*", async () => {
  const temp = mkdtempSync(join(tmpdir(), "held-out-github-"));
  try {
    const { sha } = checkout(temp, { branch: "feature/ring" });
    const gh = githubContext(temp, {});
    assert.deepEqual(gh, {
      sha, ref: "refs/heads/feature/ring", ref_name: "feature/ring", repository: "someone/somewhere",
      workspace: temp, event_name: "workflow_dispatch", actor: "Kahu Runner", run_id: "local", run_attempt: "1",
    });
    assert.equal(githubContext(temp, { GITHUB_EVENT_NAME: "schedule", GITHUB_ACTOR: "kahu" }).event_name, "schedule", "a caller's GITHUB_* wins");
  } finally { rmSync(temp, { recursive: true, force: true }); }
  const fields = ["sha", "ref", "ref_name", "repository", "workspace", "event_name", "actor"];
  const r = await run(fixture(`      - name: Every github field reads non-empty, in the expression and in the env
        shell: bash
        run: |
${fields.map((f) => `          test -n "\${{ github.${f} }}" && test "\${{ github.${f} }}" = "$GITHUB_${f.toUpperCase()}"`).join("\n")}
          test "\${{ github.repository }}" = someone/somewhere && test "\${{ github.ref }}" = refs/heads/main
          test "\${{ github.workspace }}" = "$PWD"`), "green");
  assert.equal(r.verdict, "GREEN", r.lines.join("\n"));
});

test("CONTROL: a checkout that cannot fill the github context throws instead of reading empty", () => {
  const temp = mkdtempSync(join(tmpdir(), "held-out-github-"));
  try {
    assert.throws(() => githubContext(temp, {}), /holds no git checkout/);
    const { git } = checkout(temp, { origin: "" });
    assert.throws(() => githubContext(temp, {}), /names no GitHub repository/);
    git("remote", "add", "origin", "https://github.com/someone/somewhere.git");
    assert.equal(githubContext(temp, {}).repository, "someone/somewhere");
    git("checkout", "-q", "--detach");
    assert.throws(() => githubContext(temp, {}), /nothing names its ref/, "a detached checkout that nothing names a ref for refuses");
    assert.equal(githubContext(temp, { GITHUB_REF: "refs/heads/main" }).ref_name, "main");
    git("config", "user.name", "");
    assert.throws(() => githubContext(temp, { GITHUB_REF: "refs/heads/main" }), /nothing names an actor/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("RED: a detached checkout reads the runner's own GITHUB_* first, as a pull request's merge-ref checkout stands", () => {
  const temp = mkdtempSync(join(tmpdir(), "held-out-github-"));
  try {
    const { git, sha } = checkout(temp);
    git("checkout", "-q", "--detach");
    const merge = "f".repeat(40);
    const runner = { GITHUB_REF: "refs/pull/7/merge", GITHUB_REF_NAME: "7/merge", GITHUB_SHA: merge, GITHUB_ACTOR: "kahu-login", GITHUB_EVENT_NAME: "pull_request" };
    const gh = githubContext(temp, runner);
    assert.deepEqual([gh.ref, gh.ref_name, gh.sha, gh.actor, gh.event_name], ["refs/pull/7/merge", "7/merge", merge, "kahu-login", "pull_request"]);
    assert.notEqual(gh.sha, sha, "the runner's sha wins over the checkout's HEAD");
    assert.equal(githubContext(temp, { GITHUB_REF: "refs/pull/7/merge" }).ref_name, "7/merge", "a pull ref with no named ref_name reads as the runner names it");
    assert.equal(githubContext(temp, { GITHUB_REF: "refs/heads/main" }).actor, "Kahu Runner", "CONTROL: an env that names no actor reads the committer");
    // The reader's own defaults read the process env, so a runner's GITHUB_REF reaches a plan with no env passed.
    const saved = process.env.GITHUB_REF;
    process.env.GITHUB_REF = "refs/pull/7/merge";
    try { assert.equal(githubContext(temp).ref, "refs/pull/7/merge"); }
    finally { if (saved === undefined) delete process.env.GITHUB_REF; else process.env.GITHUB_REF = saved; }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("RED: a job-level defaults, services or container block throws, wherever it sits and in whichever job", () => {
  const head = fixture(`      - name: x\n        run: "true"`);
  const atJob = (block) => head.replace("    runs-on: ubuntu-latest\n", `    runs-on: ubuntu-latest\n${block}`);
  assert.doesNotThrow(() => parseWorkflow(head), "CONTROL: the fixture's own job keys read");
  assert.throws(() => parseWorkflow(atJob("    defaults:\n      run:\n        shell: sh\n")), /job key "defaults"/);
  assert.throws(() => parseWorkflow(atJob("    services:\n      redis:\n        image: redis\n")), /job key "services"/);
  assert.throws(() => parseWorkflow(atJob("    container: node:24\n")), /job key "container"/);
  assert.throws(() => parseWorkflow(`${head}    container: node:24\n`), /job key "container"/, "a key after the steps still reads");
  // A second job reads, and its keys bind the reader as the first job's do: the job it runs leans on the others.
  assert.doesNotThrow(() => parseWorkflow(`${head}  second:\n    runs-on: ubuntu-latest\n`), "CONTROL: a second job of known keys reads");
  assert.throws(() => parseWorkflow(`${head}  build2:\n    runs-on: ubuntu-latest\n    container: node:24\n`), /job key "container"/, "a second job's unknown key still throws");
  assert.throws(() => parseWorkflow(head, { job: "absent" }), /names no job "absent"/);
  assert.throws(() => parseWorkflow(atJob("    timeout2: 5\n")), /job key "timeout2"/, "a job key carrying digits still reads");
  assert.throws(() => parseWorkflow(head.replace("jobs:\n", "defaults:\n  run:\n    shell: sh\njobs:\n")), /workflow key "defaults"/);
  assert.doesNotThrow(() => parseWorkflow(HELD_OUT), "the held-out workflow itself reads");
});

test("$GITHUB_ENV reads plain and heredoc lines, and refuses a line it cannot read", () => {
  assert.deepEqual(readEnvFile("A=1\nB<<EOF\ntwo\nlines\nEOF\n"), { A: "1", B: "two\nlines" });
  assert.throws(() => readEnvFile("not an assignment\n"), /no reading/);
});

test("every held-out job installs, renders, builds, stamps, then drives, and uploads its evidence", () => {
  const wf = parseWorkflow(HELD_OUT);
  const drivers = wf.matrix.map(cellOf);
  assert.deepEqual([...new Set(wf.matrix.map((m) => m.driver))], ["browser-weld", "civic", "crossing", "herm-mesh", "mesh-scenarios"]);
  // The scenario driver unfolds: one cell per scenario its own script lists, and none written in the workflow.
  const listed = spawnSync("bash", [join(ROOT, "tools/mesh-scenarios.sh"), "--list"], { encoding: "utf8" }).stdout.trim().split("\n").map((l) => l.split(" ")[0]);
  assert.ok(listed.length > 1, "CONTROL: the scenario script lists its scenarios");
  assert.deepEqual(wf.matrix.filter((m) => m.driver === "mesh-scenarios").map((m) => m.scenario), listed);
  assert.match(HELD_OUT, /bash tools\/mesh-scenarios\.sh "\$\{\{ matrix\.scenario \}\}"/, "the cell names its scenario from the matrix");
  assert.doesNotMatch(HELD_OUT, /mesh-scenarios\.sh (all|[a-z])/, "no step names a scenario, or the whole walk, by hand");
  // The plan reads this process's env, as the runner hands it: on a pull request's detached checkout the runner
  // names the ref there. A local detached checkout names none, so the plan names the dispatched branch it stands for.
  const env = { ...process.env, GITHUB_REF: process.env.GITHUB_REF || "refs/heads/main" };
  for (const driver of drivers) {
    const plan = planFor(wf, driver, { env });
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
  const herm = planFor(wf, "herm-mesh", { env });
  const stand = herm.findIndex((s) => /node tools\/mesh-pins\.mjs --up herm-source herm-relay herm-relay-2/.test(s.run ?? ""));
  assert.ok(stand >= 0 && stand < herm.findIndex((s) => s.name === "Run herm-mesh"), "herm-mesh stands its pins before it drives");
  assert.ok(!/docker compose -f docker-compose\.mesh\.yml up/.test(HELD_OUT), "no step stands the mesh bare, without pins");
});

/** A workflow in the held-out shape of several jobs: a plan job, a job fed by its matrix, and a job holding none. */
const planned = ({ planRun = "node tools/held-out-cells.mjs matrix >> \"$GITHUB_OUTPUT\"", cellSteps = `      - name: say \${{ matrix.cell }}\n        run: echo "cell=\${{ matrix.cell }} pnpm=\${{ env.PNPM_VERSION }} local=\${{ env.LOCAL }}"` } = {}) => `name: fixture
on:
  workflow_dispatch:
env:
  PNPM_VERSION: "11.28.5"
  LOCAL: "workflow"
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: \${{ steps.cells.outputs.matrix }}
    steps:
      - name: derive
        id: cells
        run: ${planRun}
  held-out:
    needs: [plan]
    runs-on: ubuntu-latest
    timeout-minutes: \${{ matrix.timeout_minutes }}
    strategy:
      fail-fast: false
      matrix: \${{ fromJSON(needs.plan.outputs.matrix) }}
    env:
      LOCAL: "job"
    steps:
${cellSteps}
  merge:
    needs: [plan, held-out]
    if: \${{ !cancelled() }}
    runs-on: ubuntu-latest
    steps:
      - name: gate
        run: echo "merge sees \${{ env.LOCAL }}"
`;
const twoCells = () => [{ cell: "one", driver: "d", timeout_minutes: 5 }, { cell: "two", driver: "d", timeout_minutes: 5 }];

test("a matrix read from the plan job arrives from the tool that job runs, and from nowhere else", () => {
  const wf = parseWorkflow(planned(), { cells: twoCells });
  assert.deepEqual(wf.matrix.map(cellOf), ["one", "two"]);
  assert.deepEqual(wf.steps.map((s) => s.name), ["say ${{ matrix.cell }}"], "the cell job's own steps, and no other job's");
  // RED: a plan job that stopped running the tool would hand the runner a matrix this reader never sees.
  assert.throws(() => parseWorkflow(planned({ planRun: "echo matrix=[] >> \"$GITHUB_OUTPUT\"" }), { cells: twoCells }), /plan job never runs/);
  // RED: the wire cut at the output file, at the step's id, and at the job's own output.
  assert.throws(() => parseWorkflow(planned({ planRun: "node tools/held-out-cells.mjs matrix" }), { cells: twoCells }), /plan job never runs/);
  assert.throws(() => parseWorkflow(planned().replace("        id: cells\n", ""), { cells: twoCells }), /hands on no step's `matrix` output/);
  assert.throws(() => parseWorkflow(planned().replace("steps.cells.outputs.matrix", "steps.cells.outputs.rows"), { cells: twoCells }), /hands on no step's `matrix` output/);
  // RED: any other dynamic matrix has no local reading.
  assert.throws(() => parseWorkflow(planned().replace("needs.plan.outputs.matrix", "needs.other.outputs.rows"), { cells: twoCells }), /no local reading/);
  assert.throws(() => parseWorkflow(planned(), { cells: () => [] }), /names no matrix cells/);
});

test("the workflow's env reaches every job, a job's own env overrides it, and a job with no matrix takes no cell", async () => {
  const temp = mkdtempSync(join(tmpdir(), "held-out-steps-"));
  try {
    checkout(temp);
    const env = { PATH: process.env.PATH, RUNNER_TEMP: temp };
    const cell = parseWorkflow(planned(), { cells: twoCells });
    assert.equal(planFor(cell, "two", { cwd: temp, env })[0].run, "echo \"cell=two pnpm=11.28.5 local=job\"");
    const merge = parseWorkflow(planned(), { job: "merge", cells: twoCells });
    assert.equal(merge.matrix, null);
    assert.equal(planFor(merge, undefined, { cwd: temp, env })[0].run, "echo \"merge sees workflow\"");
    const r = await runJob(merge, undefined, { cwd: temp, env, log: () => {} });
    assert.equal(r.verdict, "GREEN");
    assert.throws(() => planFor(merge, "one", { cwd: temp, env }), /holds no matrix/);
    assert.throws(() => planFor(cell, "three", { cwd: temp, env }), /no matrix cell "three" \(one, two\)/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("a download reads what an upload left, a pattern reads every match, and continue-on-error lets the job go on", async () => {
  const steps = `      - name: write
        run: |
          mkdir -p "$RUNNER_TEMP/out" && echo payload > "$RUNNER_TEMP/out/file.txt"
          echo "OUT=$RUNNER_TEMP/out" >> "$GITHUB_ENV"
          echo "IN=$RUNNER_TEMP/in" >> "$GITHUB_ENV"
          echo "ALL=$RUNNER_TEMP/all" >> "$GITHUB_ENV"
      - uses: actions/upload-artifact@v4
        with:
          name: cell-\${{ matrix.driver }}
          path: \${{ env.OUT }}
      - uses: actions/download-artifact@v4
        with:
          name: cell-\${{ matrix.driver }}
          path: \${{ env.IN }}
      - uses: actions/download-artifact@v4
        with:
          pattern: cell-*
          path: \${{ env.ALL }}
      - name: read
        run: test "$(cat "$IN/file.txt")" = payload && test "$(cat "$ALL/cell-green/file.txt")" = payload
      - name: soft
        uses: actions/download-artifact@v4
        with:
          pattern: absent-*
          path: \${{ env.ALL }}
        continue-on-error: true
      - name: after
        run: echo went-on`;
  const r = await run(fixture(steps), "green");
  assert.equal(r.verdict, "GREEN", r.lines.join("\n"));
  assert.ok(r.lines.some((l) => /✗ soft .*continue-on-error/.test(l)), "the soft step's fault still prints");
  assert.ok(r.lines.some((l) => l.includes("✓ after")));
  // RED: the same absent download without the key fails the job, and a named artifact nobody uploaded reads red.
  const hard = await run(fixture(steps.replace("        continue-on-error: true\n", "")), "green");
  assert.equal(hard.verdict, "RED");
  assert.equal(hard.failed, "soft");
  const never = await run(fixture(`      - uses: actions/download-artifact@v4\n        with:\n          name: nobody\n          path: \${{ env.GREETING }}`), "green");
  assert.equal(never.verdict, "RED");
});

test("no held-out step leans on this machine: no home paths, no host lock files, no pre-existing ~/.lares", () => {
  for (const line of HELD_OUT.split("\n").filter((l) => !l.trim().startsWith("#"))) {
    assert.doesNotMatch(line, /\/home\/|~\/\.lares|\$HOME\/\.lares|lar-e2e\.lock|\/tmp\//, line);
  }
  assert.ok(existsSync(join(ROOT, "tools/held-out-steps.mjs")));
});

test("RED: an exact pnpm pin stands only on that exact release; a major pin stands on any release of its major", () => {
  assert.equal(versionStands("11.28.5", "11.28.5"), true);
  assert.equal(versionStands("11.28.5", "11.5.0"), false, "a sibling release of the same major must not stand for an exact pin");
  assert.equal(versionStands("11.28.5", "12.10.1"), false);
  assert.equal(versionStands("11.28.5", null), false, "a tool that does not run never stands");
  // CONTROL: the major grain still reads as the runner reads `node-version: "24"`.
  assert.equal(versionStands("24", "v24.15.0"), true);
  assert.equal(versionStands("24", "26.1.0"), false);
});

test("every workflow pins ONE exact pnpm, the same release package.json `packageManager` names", () => {
  const pm = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).packageManager;
  assert.match(pm ?? "", /^pnpm@\d+\.\d+\.\d+$/, "package.json names no exact pnpm");
  const exact = pm.slice("pnpm@".length);
  for (const name of ["ci.yml", "held-out.yml"]) {
    const pins = [...readFileSync(join(ROOT, ".github/workflows", name), "utf8").matchAll(/PNPM_VERSION:\s*"([^"]*)"/g)].map((m) => m[1]);
    assert.ok(pins.length > 0, `${name} declares no PNPM_VERSION`);
    for (const pin of pins) assert.equal(pin, exact, `${name} pins pnpm ${pin}, package.json names ${exact}`);
  }
  assert.match(readFileSync(join(ROOT, "Dockerfile"), "utf8"), new RegExp(`npm install -g pnpm@${exact.replaceAll(".", "\\.")}\\b`), "the Dockerfile installs another pnpm");
});

test("RED: an action pinned by SHA reads its ref without the trailing tag comment, as the runner reads it", async () => {
  const sha = "cf430e030ddbb5b0abf93d22962f4752f3646cd9";
  const wf = parseWorkflow(fixture(`      - uses: actions/upload-artifact@${sha} # v7.0.2
        with:
          name: evidence # the comment never reaches the input
          path: "\${{ env.NEVER_SET }}" # nor after a closing quote
          if-no-files-found: error`));
  const [step] = wf.steps;
  assert.equal(step.uses, `actions/upload-artifact@${sha}`);
  assert.equal(step.with.name, "evidence");
  assert.equal(step.with.path, "${{ env.NEVER_SET }}");
  const r = await run(fixture(`      - uses: actions/upload-artifact@${sha} # v7.0.2
        with:
          name: evidence
          path: \${{ env.NEVER_SET }}
          if-no-files-found: error`), "green");
  assert.equal(r.failed, `actions/upload-artifact@${sha}`);
});

test("every action every workflow uses is pinned by a full commit SHA, with its release tag beside it", () => {
  for (const name of ["ci.yml", "held-out.yml", "notify-pages.yml"]) {
    const uses = [...readFileSync(join(ROOT, ".github/workflows", name), "utf8").matchAll(/^\s*(?:-\s+)?uses:\s*(.*)$/gm)].map((m) => m[1].trim());
    assert.ok(uses.length > 0, `${name} uses no action`);
    for (const u of uses) {
      // A workflow of this repository called by path rides the caller's own commit: the checkout pins it, and
      // the file must stand. Every other `uses` names an action by full SHA with its tag beside it.
      if (u.startsWith("./")) { assert.ok(existsSync(join(ROOT, u)), `${name}: "${u}" names no file`); continue; }
      assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, `${name}: "${u}" is not pinned by SHA with its tag`);
    }
  }
});
