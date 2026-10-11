// e2e-shards.test.mjs — the merge gate's own red-first proofs, plus the CONTROL that a lawful
// four-shard set holds. Each test plants ONE of the five refusals `evaluateMergeGate` owes
// (golden-path-p2-recipe.md REFINEMENT 4) and asserts the gate names it; the control proves the
// same inputs, lawful, pass clean — so a gate that refused everything would still read red here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
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
    mkdirSync(join(dir, "e2e-shard-1"), { recursive: true });
    writeFileSync(join(dir, "e2e-shard-1", "report-shard-1.json"), JSON.stringify(goodReport(["tests/e2e/alpha.test.ts"])));
    mkdirSync(join(dir, "e2e-shard-2"), { recursive: true });
    writeFileSync(join(dir, "e2e-shard-2", "report-shard-2.json"), "{ not json");
    // shard 3 directory absent entirely.

    const reports = readShardReports(dir, 3);
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
