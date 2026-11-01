// e2e-shards.test.mjs — the merge gate's own red-first proofs, plus the CONTROL that a lawful
// four-shard set holds. Each test plants ONE of the five refusals `evaluateMergeGate` owes
// (golden-path-p2-recipe.md REFINEMENT 4) and asserts the gate names it; the control proves the
// same inputs, lawful, pass clean — so a gate that refused everything would still read red here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { evaluateMergeGate, relativeToE2eDir, readShardReports, pushLaneAndWatch } from "./e2e-shards.mjs";

const TRACKED = ["tests/e2e/alpha.test.ts", "tests/e2e/beta.test.ts"];

/** A lawful per-shard report: `nTests` passing tests over the given absolute-ish test file paths. */
function goodReport(filePaths, nTestsPerFile = 1) {
  const testResults = filePaths.map((name) => ({ name, status: "passed" }));
  const nTotal = filePaths.length * nTestsPerFile;
  return { numTotalTests: nTotal, numPassedTests: nTotal, numFailedTests: 0, success: true, testResults };
}

function shardReportsFor(map) {
  // map: { [shard]: report | { parseError } | undefined (omit the key to mean "missing") }
  return Object.entries(map).map(([shard, v]) => ({ shard: Number(shard), ...v }));
}

// ── CONTROL: a lawful two-shard set, splitting the two tracked files, holds ──────────────────────
test("CONTROL — a lawful shard set, every file run exactly once, passes clean", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"], 3) },
      2: { report: goodReport(["/runner/a/tests/e2e/beta.test.ts"], 2) },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, true, verdict.problems.join("; "));
  assert.deepEqual(verdict.problems, []);
  assert.equal(verdict.totalTests, 5);
  assert.equal(verdict.executedFileCount, 2);
});

// ── RED 1: missing artifact ───────────────────────────────────────────────────────────────────────
test("RED — a shard that never reported refuses as a missing artifact", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) },
      // shard 2 omitted entirely — the artifact never arrived.
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.includes("missing artifact: shard 2")), verdict.problems.join("; "));
});

// ── RED 2: unparseable artifact ──────────────────────────────────────────────────────────────────
test("RED — a corrupt shard report refuses as unparseable", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) },
      2: { report: null, parseError: "Unexpected token } in JSON" },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.includes("unparseable artifact: shard 2")), verdict.problems.join("; "));
});

// ── RED 3: a zero-test shard ─────────────────────────────────────────────────────────────────────
test("RED — a shard that ran and reported zero tests refuses by name", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) },
      2: { report: { numTotalTests: 0, numFailedTests: 0, success: true, testResults: [] } },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.includes("zero-test shard: shard 2")), verdict.problems.join("; "));
});

// ── RED 4: any failure ───────────────────────────────────────────────────────────────────────────
test("RED — a failing test in one shard refuses the whole gate", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) },
      2: {
        report: {
          numTotalTests: 1,
          numFailedTests: 1,
          success: false,
          testResults: [{ name: "/runner/a/tests/e2e/beta.test.ts", status: "failed" }],
        },
      },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.includes("red shard: shard 2")), verdict.problems.join("; "));
});

test("RED — a red shard names each failing test by file and name, and a report without case rows still reads red", () => {
  // The shape a shard's JSON report carries (vitest's json reporter): one row per file, one per case.
  const red = {
    numTotalTests: 2, numPassedTests: 1, numFailedTests: 1, success: false,
    testResults: [{
      name: "/home/runner/work/x/x/tests/e2e/beta.test.ts", status: "failed",
      assertionResults: [
        { status: "passed", fullName: "the floor stands" },
        { status: "failed", fullName: "the floor R1 — a herm reaches live" },
      ],
    }],
  };
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({ 1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) }, 2: { report: red } }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.includes("red shard: shard 2 failed (1 failing test(s)): beta.test.ts :: the floor R1 — a herm reaches live"),
    verdict.problems.join("; "));
  assert.ok(!verdict.problems.join("; ").includes("the floor stands"), "a passing case got named as a red");
});

test("RED — a shard red with zero failing tests names the file whose hook failed, and why", () => {
  // A `beforeAll` that throws fails its FILE: vitest skips every case, reports zero failing tests, and exits 1.
  const red = {
    numTotalTests: 2, numPassedTests: 1, numFailedTests: 0, numPendingTests: 1, success: false,
    testResults: [{
      name: "/home/runner/work/x/x/tests/e2e/beta.test.ts", status: "failed",
      message: "Error: receiver never stood: staged vessel never unlocked\n  the daemon still stands; its log ends:",
      assertionResults: [{ status: "skipped", fullName: "replicates the board" }],
    }, { name: "/home/runner/work/x/x/tests/e2e/gamma.test.ts", status: "passed", assertionResults: [{ status: "passed", fullName: "g" }] }],
  };
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({ 1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) }, 2: { report: red } }),
    trackedFiles: [...TRACKED, "tests/e2e/gamma.test.ts"],
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.includes("red shard: shard 2 failed (0 failing test(s)): beta.test.ts failed outside any test: Error: receiver never stood: staged vessel never unlocked"),
    verdict.problems.join("; "));
  assert.ok(!verdict.problems.join("; ").includes("gamma.test.ts failed"), "a passing file got named as a red");
});

// ── RED 5a: zero total across every shard combined ─────────────────────────────────────────────
test("RED — every shard present but the combined total reads zero", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: { numTotalTests: 0, numFailedTests: 0, success: true, testResults: [] } },
      2: { report: { numTotalTests: 0, numFailedTests: 0, success: true, testResults: [] } },
    }),
    trackedFiles: [],
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.includes("zero total")), verdict.problems.join("; "));
});

// ── RED 5b: file-union differs — a tracked file nobody ran ─────────────────────────────────────
test("RED — a tracked e2e file that no shard ever ran refuses by name", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) },
      // beta.test.ts is tracked but no shard's testResults name it.
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.problems.some((p) => p.includes("file-union mismatch") && p.includes("beta.test.ts")),
    verdict.problems.join("; "),
  );
});

// ── RED 5c: file-union differs — a file run that is not in the tracked set ─────────────────────
test("RED — a file the shards ran that is not in the tracked set refuses by name", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts", "/runner/a/tests/e2e/zz-stray.test.ts"]) },
    }),
    trackedFiles: ["tests/e2e/alpha.test.ts"],
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.problems.some((p) => p.includes("file-union mismatch") && p.includes("zz-stray.test.ts")),
    verdict.problems.join("; "),
  );
});

// ── RED 5d: a file more than one shard ran refuses by name (never collapses silently) ───────────
test("RED — the same file run by two shards (a sharding overlap) refuses by name", () => {
  const verdict = evaluateMergeGate({
    shardCount: 2,
    shardReports: shardReportsFor({
      1: { report: goodReport(["/runner/a/tests/e2e/alpha.test.ts"]) },
      2: { report: goodReport(["/runner/b/tests/e2e/alpha.test.ts", "/runner/b/tests/e2e/beta.test.ts"]) },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.problems.some((p) => p.includes("file-union mismatch") && p.includes("alpha.test.ts") && p.includes("shards=[1,2]")),
    verdict.problems.join("; "),
  );
});

// ── RED: an all-skipped shard (zero PASSING tests) refuses even though numTotalTests > 0 ────────
test("RED — a shard with only pending/skipped tests (numPassedTests: 0) refuses as zero-test", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: {
        report: {
          numTotalTests: 3, numPendingTests: 3, numPassedTests: 0, numFailedTests: 0, success: true,
          testResults: [{ name: "/runner/a/tests/e2e/alpha.test.ts" }, { name: "/runner/a/tests/e2e/beta.test.ts" }],
        },
      },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.includes("zero-test shard") && p.includes("pending=3")), verdict.problems.join("; "));
});

// ── RED (L2): one FILE all-skipped inside an otherwise-passing shard — the shard's OWN zero-pass
// check never fires (SOME test in the shard passed), so only a per-file tally catches it. This is
// the exact shape gp2-episkopos measured live: `nexus-offering-replication`'s 2/2 skipped beforeAll
// read clean in CI except for `success:false` — a `describe.skipIf`, never throwing, would have
// read clean outright.
test("RED (L2) — a file that ran but every one of its tests skipped refuses by name, even beside a passing file in the same shard", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: {
        report: {
          numTotalTests: 3, numPassedTests: 1, numPendingTests: 2, numFailedTests: 0, success: true,
          testResults: [
            { name: "/runner/a/tests/e2e/alpha.test.ts", status: "passed", assertionResults: [{ status: "passed" }] },
            {
              name: "/runner/a/tests/e2e/beta.test.ts", status: "pending",
              assertionResults: [{ status: "pending" }, { status: "pending" }],
            },
          ],
        },
      },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.problems.some((p) => p.includes("all-skipped file") && p.includes("beta.test.ts") && p.includes("skipped/pending=2")),
    verdict.problems.join("; "),
  );
});

// ── CONTROL (L2): the same shape, but beta.test.ts carries at least one PASSED assertion — never refuses
test("CONTROL (L2) — a file with at least one passing assertion never reads as all-skipped", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: {
        report: {
          numTotalTests: 3, numPassedTests: 2, numPendingTests: 1, numFailedTests: 0, success: true,
          testResults: [
            { name: "/runner/a/tests/e2e/alpha.test.ts", status: "passed", assertionResults: [{ status: "passed" }] },
            {
              name: "/runner/a/tests/e2e/beta.test.ts", status: "passed",
              assertionResults: [{ status: "passed" }, { status: "pending" }],
            },
          ],
        },
      },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, true, verdict.problems.join("; "));
  assert.ok(!verdict.problems.some((p) => p.includes("all-skipped file")));
});

// ── RED (L-f): a file that registered ZERO tests of any kind (not even a skip) refuses by name ────
test("RED (L-f) — a file with zero passed, zero skipped, zero failed refuses as an empty file, even beside a passing file in the same shard", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: {
        report: {
          numTotalTests: 1, numPassedTests: 1, numPendingTests: 0, numFailedTests: 0, success: true,
          testResults: [
            { name: "/runner/a/tests/e2e/alpha.test.ts", status: "passed", assertionResults: [{ status: "passed" }] },
            // beta.test.ts ran (it appears in testResults — a `describe.skip`'d whole file, say) but
            // carries NO assertionResults at all and no useful top-level `status` either.
            { name: "/runner/a/tests/e2e/beta.test.ts", assertionResults: [] },
          ],
        },
      },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.problems.some((p) => p.includes("empty file") && p.includes("beta.test.ts") && p.includes("0 passed, 0 skipped, 0 failed")),
    verdict.problems.join("; "),
  );
});

// ── CONTROL (L-f): a file with at least a skip (never zero) never reads as empty ───────────────────
test("CONTROL (L-f) — a file with at least one skipped assertion never reads as empty (it still reads all-skipped instead)", () => {
  const verdict = evaluateMergeGate({
    shardCount: 1,
    shardReports: shardReportsFor({
      1: {
        report: {
          numTotalTests: 1, numPassedTests: 1, numPendingTests: 1, numFailedTests: 0, success: true,
          testResults: [
            { name: "/runner/a/tests/e2e/alpha.test.ts", status: "passed", assertionResults: [{ status: "passed" }] },
            { name: "/runner/a/tests/e2e/beta.test.ts", assertionResults: [{ status: "pending" }] },
          ],
        },
      },
    }),
    trackedFiles: TRACKED,
  });
  assert.equal(verdict.ok, false);
  assert.ok(!verdict.problems.some((p) => p.includes("empty file")));
  assert.ok(verdict.problems.some((p) => p.includes("all-skipped file") && p.includes("beta.test.ts")));
});

// ── relativeToE2eDir ─────────────────────────────────────────────────────────────────────────────
test("relativeToE2eDir strips whatever prefix sits in front of e2e/, on either path style", () => {
  assert.equal(relativeToE2eDir("/home/joshu/repo/tests/e2e/foo.test.ts"), "foo.test.ts");
  assert.equal(relativeToE2eDir("tests/e2e/foo.test.ts"), "foo.test.ts");
  assert.equal(relativeToE2eDir("D:\\a\\repo\\tests\\e2e\\foo.test.ts"), "foo.test.ts");
  assert.equal(relativeToE2eDir("no-e2e-marker.test.ts"), "no-e2e-marker.test.ts");
});

// ── readShardReports — missing and unparseable artifacts, read off real disk ────────────────────
test("readShardReports: a present, valid, and missing shard each read as the gate expects", () => {
  const dir = mkdtempSync(join(tmpdir(), "e2e-shards-test-"));
  try {
    mkdirSync(join(dir, "e2e-shard-tests-1"), { recursive: true });
    writeFileSync(join(dir, "e2e-shard-tests-1", "report-shard-tests-1.json"), JSON.stringify(goodReport(["tests/e2e/alpha.test.ts"])));
    mkdirSync(join(dir, "e2e-shard-tests-2"), { recursive: true });
    writeFileSync(join(dir, "e2e-shard-tests-2", "report-shard-tests-2.json"), "{ not json");
    // shard 3 directory absent entirely.

    const reports = readShardReports(dir, 3, "tests");
    const byShard = new Map(reports.map((r) => [r.shard, r]));

    assert.equal(byShard.get(1).report.numTotalTests, 1);
    assert.equal(byShard.get(2).report, null);
    assert.ok(byShard.get(2).parseError);
    assert.equal(byShard.has(3), false);

    const verdict = evaluateMergeGate({ shardCount: 3, shardReports: reports, trackedFiles: ["tests/e2e/alpha.test.ts"] });
    assert.equal(verdict.ok, false);
    assert.ok(verdict.problems.some((p) => p.includes("unparseable artifact: shard 2")));
    assert.ok(verdict.problems.some((p) => p.includes("missing artifact: shard 3")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── L7: a log-fetch throw must never leave the lane branch standing ─────────────────────────────
// Fake `git`/`gh` on PATH: the branch push, run-discovery and watch all succeed; `gh run view --log`
// throws (a non-zero exit). The docblock claims `pushLaneAndWatch` "always deletes the branch, even
// on a red run" — before this fix, that throw ran before `deleteBranch` and skipped it (gp1-episkopos
// L7). This test's marker file proves the delete call ran, even though the function itself still
// throws (the real error must still surface — cleanup must never swallow it).
test("L7 — a log-fetch throw inside pushLaneAndWatch still deletes the lane branch", async () => {
  const bin = mkdtempSync(join(tmpdir(), "e2e-shards-fakebin-"));
  const marker = join(bin, "deleted.marker");
  writeFileSync(
    join(bin, "git"),
    `#!/usr/bin/env bash
set -e
args="$*"
case "$args" in
  *"config --get core.bare"*) echo false; exit 0 ;;
  *"rev-parse HEAD"*) echo "deadbeefcafef00d"; exit 0 ;;
  *"push origin HEAD:refs/heads/"*) exit 0 ;;
  *"push origin --delete "*) echo ok > "${marker}"; exit 0 ;;
  *) exit 0 ;;
esac
`,
  );
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env bash
set -e
args="$*"
case "$args" in
  *"run list --branch"*) echo '[{"databaseId":42,"headSha":"deadbeefcafef00d"}]'; exit 0 ;;
  *"run watch 42"*) exit 0 ;;
  *"run view 42 --log"*) echo "gh: the log is gone" >&2; exit 1 ;;
  *) exit 0 ;;
esac
`,
  );
  chmodSync(join(bin, "git"), 0o755);
  chmodSync(join(bin, "gh"), 0o755);

  const prevPath = process.env.PATH;
  process.env.PATH = `${bin}:${prevPath}`;
  try {
    await assert.rejects(
      () => pushLaneAndWatch({ repoRoot: tmpdir(), lane: "l7-probe", findBudgetMs: 5000, pollMs: 10 }),
      /run view 42 --log/,
    );
  } finally {
    process.env.PATH = prevPath;
  }
  const { existsSync } = await import("node:fs");
  assert.ok(existsSync(marker), "deleteBranch must run even though the log fetch threw");
  rmSync(bin, { recursive: true, force: true });
});

test("the printed CI hint names the branch full CI runs on, from attached and detached checkouts", () => {
  const bin = mkdtempSync(join(tmpdir(), "e2e-shards-hint-"));
  const root = fileURLToPath(new URL("../", import.meta.url));
  try {
    writeFileSync(join(bin, "git"), `#!/usr/bin/env bash
case "$*" in
  *"config --get core.bare"*) echo false ;;
  *"rev-parse --abbrev-ref HEAD"*) echo "$TEST_BRANCH" ;;
  *"rev-parse HEAD"*|*"rev-parse deadbeefcafef00d"*) echo deadbeefcafef00d ;;
  *"branch -r --points-at"*) printf 'origin/ci/hint-probe\n%s' "$TEST_TIPS" ;;
esac
`);
    writeFileSync(join(bin, "gh"), `#!/usr/bin/env bash
case "$*" in
  *"run list"*"--event push"*) echo '[{"databaseId":42,"headSha":"deadbeefcafef00d"}]' ;;
  *"run list"*) echo '[]' ;;
  *"run view 42 --log"*) echo 'MERGE-VERIFY: ok=true shards=5 totalTests=10 executedFiles=2 trackedFiles=2' ;;
  *"run view 42 --json"*) echo '{"conclusion":"success","url":"https://example.test/42"}' ;;
esac
`);
    chmodSync(join(bin, "git"), 0o755);
    chmodSync(join(bin, "gh"), 0o755);
    const hintFor = (tips) => {
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_TIPS: tips };
      const pushed = spawnSync(process.execPath, [join(root, "tools/e2e-shards.mjs"), "push", "hint-probe"], { cwd: root, encoding: "utf8", env });
      assert.equal(pushed.status, 0, pushed.stderr);
      const hint = pushed.stdout.split("\n").find((line) => line.startsWith("HALF A VERDICT:"));
      assert.ok(hint, pushed.stdout);
      return { env, args: hint.slice(hint.indexOf("node tools/ci-verdict.mjs")).split(" ").slice(2) };
    };
    // The full run stands on the feature branch the head rides; `ci.yml` never runs on a `ci/` lane branch.
    const { env, args } = hintFor("origin/feature/hint-probe");
    assert.ok(!args.join(" ").includes("ci/hint-probe"), args.join(" "));
    for (const branch of ["feature/hint-probe", "HEAD"]) {
      const read = spawnSync(process.execPath, [join(root, "tools/ci-verdict.mjs"), ...args], {
        cwd: root, encoding: "utf8", env: { ...env, TEST_BRANCH: branch },
      });
      assert.equal(read.status, 2, `${branch}: ${read.stderr}`);
      assert.match(read.stdout, /ci-verdict: branch feature\/hint-probe/);
    }
    // CONTROL: a head no non-lane branch carries names no branch, rather than the lane branch.
    const bare = hintFor("");
    assert.match(bare.args.join(" "), /--branch <the branch this head rides>/);
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});

// ── EVERY SET RIDES THE SHARDS (B.c4) ─────────────────────────────────────────────────────────────
import { evaluateAllSets, E2E_SETS } from "./e2e-shards.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TWO_SETS = [
  { name: "main", shards: 1 },
  { name: "side", shards: 1 },
];
const trackedBySet = { main: ["main/e2e/a.test.ts"], side: ["side/e2e/b.test.ts"] };

test("CONTROL (sets) — every set ran its own files, the all-sets gate passes", () => {
  const verdict = evaluateAllSets({
    sets: TWO_SETS,
    trackedBySet,
    setReports: {
      main: shardReportsFor({ 1: { report: goodReport(["/r/main/e2e/a.test.ts"]) } }),
      side: shardReportsFor({ 1: { report: goodReport(["/r/side/e2e/b.test.ts"]) } }),
    },
  });
  assert.equal(verdict.ok, true, verdict.problems.join("; "));
  assert.equal(verdict.executedFileCount, 2);
});

test("RED (sets) — a set the lane never ran refuses the merge, by set name", () => {
  const verdict = evaluateAllSets({
    sets: TWO_SETS,
    trackedBySet,
    setReports: { main: shardReportsFor({ 1: { report: goodReport(["/r/main/e2e/a.test.ts"]) } }) },
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.startsWith("set side: missing artifact")), verdict.problems.join("; "));
  assert.ok(verdict.problems.some((p) => p.includes("set side: file-union mismatch")), verdict.problems.join("; "));
});

test("RED (sets) — a file of one set run under the other set's shard refuses the union", () => {
  const verdict = evaluateAllSets({
    sets: TWO_SETS,
    trackedBySet,
    setReports: {
      main: shardReportsFor({ 1: { report: goodReport(["/r/main/e2e/a.test.ts", "/r/side/e2e/b.test.ts"]) } }),
      side: shardReportsFor({ 1: { report: goodReport(["/r/side/e2e/b.test.ts"]) } }),
    },
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.problems.some((p) => p.startsWith("set main: file-union mismatch")), verdict.problems.join("; "));
});

test("the real E2E_SETS table names both sets, and an empty report map refuses every one", () => {
  assert.deepEqual(E2E_SETS.map((s) => s.name), ["tests", "node"]);
  const verdict = evaluateAllSets({ setReports: {}, trackedBySet: {} });
  assert.equal(verdict.ok, false);
  for (const s of E2E_SETS) assert.ok(verdict.problems.some((p) => p.startsWith(`set ${s.name}: missing artifact`)));
});

test("readShardReports reads a named set's artifacts under e2e-shard-<set>-<k>", () => {
  const dir = mkdtempSync(join(tmpdir(), "e2e-sets-"));
  try {
    mkdirSync(join(dir, "e2e-shard-node-1"), { recursive: true });
    writeFileSync(join(dir, "e2e-shard-node-1", "report-shard-node-1.json"), JSON.stringify(goodReport(["x/e2e/a.test.ts"])));
    assert.equal(readShardReports(dir, 1, "node").length, 1);
    assert.equal(readShardReports(dir, 1, "tests").length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("e2e-shards.yml carries exactly one matrix row per (set, shard) of E2E_SETS, a companion set riding the row its table names", () => {
  const yml = readFileSync(fileURLToPath(new URL("../.github/workflows/e2e-shards.yml", import.meta.url)), "utf8");
  const rows = [...yml.matchAll(/- \{ set: (\w+), dir: ([^,]+), config: ([^,]+), shard: (\d+), count: (\d+)(?:, companion: (\w+))? \}/g)]
    .map((m) => `${m[1]} ${m[2]} ${m[3]} ${m[4]}/${m[5]}${m[6] ? ` +${m[6]}` : ""}`).sort();
  const rider = (s) => E2E_SETS.find((o) => o.companion?.of === s.name);
  const want = E2E_SETS.filter((s) => !s.companion).flatMap((s) =>
    Array.from({ length: s.shards }, (_, i) => `${s.name} ${s.dir} ${s.config} ${i + 1}/${s.shards}${rider(s)?.companion.shard === i + 1 ? ` +${rider(s).name}` : ""}`)).sort();
  assert.deepEqual(rows, want);
});

test("E2E_SETS: the node set rides a tests shard as a companion (a shard of its own would spend one of the ten jobs), and its gate artifact keeps its own name", () => {
  const node = E2E_SETS.find((s) => s.name === "node");
  assert.deepEqual(node.companion, { of: "tests", shard: 3 });
  assert.equal(node.shards, 1);
  const yml = readFileSync(fileURLToPath(new URL("../.github/workflows/e2e-shards.yml", import.meta.url)), "utf8");
  assert.match(yml, /name: e2e-shard-\$\{\{ matrix\.companion \}\}-1$/m, "the companion run uploads no e2e-shard-<set>-1 artifact for the merge gate");
  assert.match(yml, /report-shard-\$\{\{ matrix\.companion \}\}-1\.json/, "the companion report loses the name the merge gate reads");
  assert.doesNotMatch(yml, /- \{ set: node,/, "the node set still has a shard row of its own");
});

// ── ONE E2E VERDICT PER PUSH: the full CI workflow CALLS the shard workflow ──────────────────────────────────
test("ci.yml takes its e2e verdict from the shard workflow, and runs no unsharded e2e job of its own", () => {
  const read = (name) => readFileSync(fileURLToPath(new URL(`../.github/workflows/${name}`, import.meta.url)), "utf8");
  const ci = read("ci.yml");
  // The e2e job's own block: from its key to the next top-level job key.
  const at = ci.search(/^  e2e:\n/m);
  assert.ok(at >= 0, "ci.yml carries no `e2e` job — the full workflow lost its e2e verdict");
  const rest = ci.slice(at + 1);
  const block = rest.slice(0, rest.search(/^  [a-z][\w-]*:\n/m));
  assert.match(block, /^    uses: \.\/\.github\/workflows\/e2e-shards\.yml$/m, "the e2e job stopped calling the shard workflow");
  assert.doesNotMatch(block, /^    steps:/m, "a job that calls a workflow carries no steps of its own");
  // No job of the full workflow walks the whole e2e set on one runner (comments aside).
  const code = ci.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.doesNotMatch(code, /test:e2e/, "ci.yml runs the unsharded e2e set beside the shards: two verdicts for one push");
  // The callee declares the door, keeps its lane trigger, and keeps a concurrency group apart from the caller's.
  const shards = read("e2e-shards.yml");
  assert.match(shards, /^  workflow_call: \{\}$/m, "e2e-shards.yml declares no workflow_call: ci.yml's call would refuse at startup");
  assert.match(shards, /^  push:\n    branches: \["ci\/\*\*"\]$/m, "the lane push trigger left");
  const group = (yml) => /^concurrency:\n(?:\s*#.*\n)*  group: (\S+)-\$\{\{ github\.ref \}\}$/m.exec(yml)?.[1];
  assert.equal(group(ci), "ci");
  assert.equal(group(shards), "e2e-shards", "caller and callee sharing one concurrency group wait on each other");
  // CONTROL: the comment filter left the workflow's real commands in place.
  assert.match(code, /ci-cells\.mjs run-test/);
});
