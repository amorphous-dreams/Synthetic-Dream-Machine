#!/usr/bin/env node
/**
 * e2e-shards — the sharded e2e lane's only two doors: the merge gate that fails closed inside
 * `.github/workflows/e2e-shards.yml`, and the push/watch/delete helper that runs that lane from a
 * desk or from any other spirit's hand.
 *
 * ── THE MERGE GATE (`merge-verify`) ──────────────────────────────────────────────────────────────
 * `evaluateMergeGate` is the whole law, exported as a pure function so `e2e-shards.test.mjs` can
 * plant a bad report set and watch it refuse WITHOUT a GitHub run, a network call, or a real
 * vitest process. The CLI door (`merge-verify`) only reads files off disk and git, then hands them
 * to the same function the merge job calls in anger — there is no second copy of the law.
 *
 * `vitest --merge-reports` (the documented sharded-report merge) reads SILENT ZERO when a shard's
 * blob never arrived: it exits 0 and prints "no tests" rather than naming what is missing. This
 * gate never trusts that exit code. It reads each shard's OWN per-shard JSON report instead — the
 * `--outputFile.json=.vitest/blob/report-shard-<k>.json` every shard writes alongside its blob —
 * and refuses closed on every one of:
 *   - a missing or unparseable artifact (a shard directory absent, or its JSON corrupt);
 *   - a shard reporting zero tests;
 *   - any failing test, in any shard;
 *   - a zero total across every shard combined;
 *   - a union of executed files that differs from the tracked set (each set in `E2E_SETS` against its own glob) — a file
 *     no shard ran, or a file more than one shard ran, both read here.
 *
 * ── THE HELPER (`push`) ──────────────────────────────────────────────────────────────────────────
 * Pushes HEAD to `ci/<lane>`, finds the ONE run that push triggered (by head SHA, never by name
 * alone — a reused lane name must never pick up a stale run), watches it with `gh run watch`,
 * reads its conclusion, deletes the branch, and exits non-zero on any red. It NEVER also dispatches
 * — `e2e-shards.yml` carries `workflow_dispatch` for a human's own hand, not for this helper to
 * double-fire on top of its own push.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── the merge gate's pure law ───────────────────────────────────────────────────────────────────

/**
 * The e2e dir's test-file name relative to `e2e/` — strips whatever absolute-path prefix a runner
 * (desk or hosted, their checkouts never sit at the same path) put in front of it, so a path from
 * a local run and a path from `${{ runner.temp }}` compare equal. Vitest's JSON reporter names a
 * test FILE by its absolute path (`testResults[].name`); `git ls-files` names it repo-relative.
 * Both carry a literal `e2e/<rest>` tail, which is the one thing they agree on.
 */
export function relativeToE2eDir(path) {
  const posix = path.replaceAll("\\", "/");
  const marker = "e2e/";
  const at = posix.lastIndexOf(marker);
  if (at === -1) return posix;
  return posix.slice(at + marker.length);
}

/**
 * THE E2E SETS — the one table every door reads: the merge gate, the workflow's matrix rows
 * (a test holds the yml to this table), and `tools/tree-clean-witness.sh` (via the `sets` verb).
 * A set the repo carries and this table omits is a set no lane measures; a set this table names and
 * the lane never ran refuses the merge, by set name.
 *
 *   name         the set's short name (an artifact-name segment, the witness's `--set` argument)
 *   dir          the directory its vitest config sits in (the run's working directory)
 *   config       the vitest config that selects its files
 *   trackedGlob  `git ls-files` pathspec of the files the set owns — the gate's own file union
 *   shards       how many shards the set splits across
 */
export const E2E_SETS = Object.freeze([
  Object.freeze({ name: "tests", dir: "tests", config: "vitest.config.ts", trackedGlob: "tests/e2e/*.test.ts", shards: 4 }),
  Object.freeze({ name: "node", dir: "packages/lararium-node", config: "vitest.e2e.config.ts", trackedGlob: "packages/lararium-node/tests/e2e/*.test.ts", shards: 1 }),
]);

/**
 * Every set's own merge law, pure. `setReports` maps set name to that set's `shardReports` array;
 * `trackedBySet` maps set name to its tracked files. A set with no entry reads as every shard
 * missing, so a set the lane never ran refuses by name. A set carried only by the argument and not
 * by `sets` is ignored — the table decides what must run.
 */
export function evaluateAllSets({ setReports, trackedBySet, sets = E2E_SETS }) {
  const problems = [];
  let totalTests = 0;
  let executedFileCount = 0;
  const bySet = {};
  for (const set of sets) {
    const verdict = evaluateMergeGate({
      shardCount: set.shards,
      shardReports: setReports?.[set.name] ?? [],
      trackedFiles: trackedBySet?.[set.name] ?? [],
    });
    bySet[set.name] = verdict;
    totalTests += verdict.totalTests;
    executedFileCount += verdict.executedFileCount;
    for (const p of verdict.problems) problems.push(`set ${set.name}: ${p}`);
  }
  return { ok: problems.length === 0, problems, totalTests, executedFileCount, bySet };
}

/**
 * The merge law, pure: no filesystem, no process, no git. `shardReports` is an array of
 * `{ shard, report, parseError }` for shard numbers `1..shardCount` (a shard absent from the array
 * reads as missing, exactly as an absent artifact directory would). `trackedFiles` is the
 * `tests/e2e/*.test.ts` set, in whatever path form `git ls-files` gives it.
 *
 * Returns `{ ok, problems, totalTests, executedFileCount }`. `problems` is empty iff `ok`; every
 * entry names ONE of the five refusals above, never a bundled "something is wrong".
 */
export function evaluateMergeGate({ shardCount, shardReports, trackedFiles }) {
  const problems = [];
  let totalTests = 0;
  // Which shard(s) ran each file — `--shard=k/N` partitions test FILES disjointly by design, so a
  // file read by more than one shard is a sharding fault, never a lawful overlap to collapse quietly.
  const shardsOfFile = new Map();
  // Per-FILE passed/skipped/failed tallies, summed across whichever shard(s) ran it (L2, L-f).
  const passedByFile = new Map();
  const skippedByFile = new Map();
  const failedByFile = new Map();
  const byShard = new Map(shardReports.map((r) => [r.shard, r]));

  for (let shard = 1; shard <= shardCount; shard++) {
    const entry = byShard.get(shard);
    if (!entry) {
      problems.push(`missing artifact: shard ${shard} of ${shardCount} never reported`);
      continue;
    }
    if (entry.parseError || entry.report == null) {
      problems.push(`unparseable artifact: shard ${shard} (${entry.parseError ?? "no report body"})`);
      continue;
    }
    const r = entry.report;
    const nTotal = Number(r.numTotalTests ?? 0);
    const nFailed = Number(r.numFailedTests ?? 0);
    // `numPassedTests`, never `numTotalTests` alone — an all-skipped/all-pending shard counts its
    // skips as "tests" and would otherwise read as a clean run that verified nothing (the silent-zero
    // door the episkopos named: numTotalTests:3, numPendingTests:3, numPassedTests:0 read ok:true).
    const nPassed = Number(r.numPassedTests ?? 0);
    const success = r.success !== false;
    if (nPassed === 0) {
      problems.push(
        `zero-test shard: shard ${shard} reported zero passing tests (total=${nTotal}, pending=${Number(r.numPendingTests ?? 0)})`,
      );
    }
    if (nFailed > 0 || !success) {
      // THE RED NAMES ITS TEST. A shard writes its report as JSON alone, so its job log names no failing case;
      // without the names here a reader downloads the artifact to learn which file went red.
      const named = (r.testResults ?? []).flatMap((tr) => (tr.assertionResults ?? [])
        .filter((t) => t.status === "failed")
        .map((t) => `${typeof tr.name === "string" ? relativeToE2eDir(tr.name) : "?"} :: ${t.fullName ?? t.title ?? "?"}`));
      problems.push(`red shard: shard ${shard} failed (${nFailed} failing test(s))${named.length > 0 ? `: ${named.join(" | ")}` : ""}`);
    }
    totalTests += nTotal;
    for (const tr of r.testResults ?? []) {
      if (typeof tr.name !== "string") continue;
      const file = relativeToE2eDir(tr.name);
      const shards = shardsOfFile.get(file) ?? new Set();
      shards.add(shard);
      shardsOfFile.set(file, shards);
      // L2: a shard's OWN zero-pass check (above) reads the whole shard, so a file whose tests all
      // skipped — a `describe.skipIf`, a skipping `beforeAll` that never throws — reads clean the
      // instant one OTHER file in the same shard passes anything at all. Count each file's own
      // passed/skipped tally too, off `assertionResults` when the reporter carries it, else off the
      // file's own aggregate `status` (one test's worth, best-effort, when no per-assertion detail
      // rides along) — so an all-skipped FILE refuses by name even inside an otherwise-green shard.
      const assertions = Array.isArray(tr.assertionResults) ? tr.assertionResults : null;
      const filePassed = assertions
        ? assertions.filter((a) => a?.status === "passed").length
        : (tr.status === "passed" ? 1 : 0);
      const fileSkipped = assertions
        ? assertions.filter((a) => a?.status === "pending" || a?.status === "skipped" || a?.status === "todo").length
        : (tr.status === "skipped" || tr.status === "pending" || tr.status === "todo" ? 1 : 0);
      const fileFailed = assertions
        ? assertions.filter((a) => a?.status === "failed").length
        : (tr.status === "failed" ? 1 : 0);
      passedByFile.set(file, (passedByFile.get(file) ?? 0) + filePassed);
      skippedByFile.set(file, (skippedByFile.get(file) ?? 0) + fileSkipped);
      failedByFile.set(file, (failedByFile.get(file) ?? 0) + fileFailed);
    }
  }

  for (const [file, skipped] of skippedByFile) {
    if (skipped > 0 && (passedByFile.get(file) ?? 0) === 0) {
      problems.push(`all-skipped file: ${file} ran 0 passing tests (skipped/pending=${skipped})`);
    }
  }
  // L-f: a file that registered zero tests at all — zero passed, zero skipped, zero failed — names
  // nothing the per-file skip check above can catch (that check fires only on a NONZERO skip count).
  // `describe.skip`'ing an entire file, or a suite the reporter otherwise records no assertions for,
  // read as a lawfully "executed" file (it appears in `testResults`) that verified literally nothing.
  for (const file of shardsOfFile.keys()) {
    const total = (passedByFile.get(file) ?? 0) + (skippedByFile.get(file) ?? 0) + (failedByFile.get(file) ?? 0);
    if (total === 0) problems.push(`empty file: ${file} registered zero tests of any kind (0 passed, 0 skipped, 0 failed)`);
  }

  if (totalTests === 0) problems.push("zero total: every shard combined reported zero tests");

  const executedFiles = new Set(shardsOfFile.keys());
  const tracked = new Set(trackedFiles.map(relativeToE2eDir));
  const missing = [...tracked].filter((f) => !executedFiles.has(f)).sort();
  const extra = [...executedFiles].filter((f) => !tracked.has(f)).sort();
  const duplicated = [...shardsOfFile.entries()]
    .filter(([, shards]) => shards.size > 1)
    .map(([file, shards]) => `${file} (shards=[${[...shards].sort((a, b) => a - b).join(",")}])`)
    .sort();
  if (missing.length > 0 || extra.length > 0 || duplicated.length > 0) {
    const parts = [];
    if (missing.length > 0) parts.push(`never run=[${missing.join(", ")}]`);
    if (extra.length > 0) parts.push(`run but untracked=[${extra.join(", ")}]`);
    if (duplicated.length > 0) parts.push(`run by more than one shard=[${duplicated.join(", ")}]`);
    problems.push(`file-union mismatch: the shards' executed files differ from the tracked e2e set (${parts.join("; ")})`);
  }

  return { ok: problems.length === 0, problems, totalTests, executedFileCount: executedFiles.size };
}

// ── reading the merge job's disk state into the pure law ──────────────────────────────────────────

/**
 * Reads `<artifactsDir>/e2e-shard-<set>-<k>/report-shard-<set>-<k>.json` for every `k` in `1..shardCount` —
 * the exact layout `e2e-shards.yml` uploads under (one artifact per shard, downloaded by
 * `download-artifact` into one subdirectory per artifact name). A shard whose directory or file
 * is absent reads as missing; a shard whose file fails to parse reads as unparseable — neither
 * throws here, because the GATE names both, not this reader.
 */
export function readShardReports(artifactsDir, shardCount, setName) {
  const out = [];
  const tag = (shard) => `${setName}-${shard}`;
  for (let shard = 1; shard <= shardCount; shard++) {
    const dir = join(artifactsDir, `e2e-shard-${tag(shard)}`);
    const file = join(dir, `report-shard-${tag(shard)}.json`);
    if (!existsSync(file)) continue; // the gate reads this as "missing artifact"
    try {
      const report = JSON.parse(readFileSync(file, "utf8"));
      out.push({ shard, report });
    } catch (err) {
      out.push({ shard, report: null, parseError: String(err && err.message ? err.message : err) });
    }
  }
  return out;
}

/** `git ls-files tests/e2e/*.test.ts`, run from `repoRoot` — the tracked set the gate compares against. */
export function trackedE2eFiles(repoRoot, glob = "tests/e2e/*.test.ts") {
  const out = execFileSync("git", ["ls-files", glob], { cwd: repoRoot, encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

function cliMergeVerify(args) {
  const artifactsDir = resolve(readFlag(args, "--artifacts-dir") ?? "artifacts");
  const repoRoot = resolve(readFlag(args, "--repo-root") ?? ".");

  // EVERY set in `E2E_SETS`, each against its own tracked-file union.
  const setReports = {};
  const trackedBySet = {};
  let trackedCount = 0;
  let shards = 0;
  for (const set of E2E_SETS) {
    setReports[set.name] = readShardReports(artifactsDir, set.shards, set.name);
    trackedBySet[set.name] = trackedE2eFiles(repoRoot, set.trackedGlob);
    trackedCount += trackedBySet[set.name].length;
    shards += set.shards;
  }
  const verdict = evaluateAllSets({ setReports, trackedBySet });

  // One grep-able line, read both by a human in the log and by `e2e-shards.mjs push` watching the
  // same run from outside — the helper never re-derives the verdict from raw JSON over the wire.
  console.log(
    `MERGE-VERIFY: ok=${verdict.ok} shards=${shards} totalTests=${verdict.totalTests} ` +
    `executedFiles=${verdict.executedFileCount} trackedFiles=${trackedCount}`,
  );
  for (const problem of verdict.problems) console.error(`MERGE-VERIFY problem: ${problem}`);

  process.exitCode = verdict.ok ? 0 : 1;
}

function readFlag(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

// ── the push/watch/delete helper ───────────────────────────────────────────────────────────────────

/** `git`/`gh`, run synchronously; throws with the command's own stderr on a non-zero exit. */
function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    const label = `${cmd} ${cmdArgs.join(" ")}`;
    throw new Error(`${label} exited ${result.status}: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result.stdout;
}

/** `core.bare` must read `false` both sides of any git-structure operation this helper performs. */
function assertNotBare(repoRoot) {
  const bare = run("git", ["-C", repoRoot, "config", "--get", "core.bare"], { stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (bare === "true") throw new Error(`core.bare reads true at ${repoRoot} — refusing to push or delete a branch here`);
}

/**
 * Pushes HEAD to `ci/<lane>`, finds the ONE run that push triggered (matched by head SHA, within
 * `findBudgetMs`), watches it with `gh run watch --exit-status`, reads the merge job's own
 * `MERGE-VERIFY` log line as the verdict, deletes the remote branch, and returns
 * `{ ok, shardCounts, totalTests, run }`. Always deletes the branch, even on a red run — a proof
 * branch left standing after a red read is exactly the kind of debris this lane must not leave.
 */
export async function pushLaneAndWatch({ repoRoot, lane, findBudgetMs = 120_000, pollMs = 3000 }) {
  assertNotBare(repoRoot);
  const branch = `ci/${lane}`;
  const headSha = run("git", ["-C", repoRoot, "rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "pipe"] }).trim();

  run("git", ["-C", repoRoot, "push", "origin", `HEAD:refs/heads/${branch}`], { stdio: ["ignore", "pipe", "pipe"] });

  let runId;
  const deadline = Date.now() + findBudgetMs;
  while (Date.now() < deadline) {
    // NEVER `--workflow e2e-shards.yml` here: GitHub's API only resolves a workflow BY FILENAME
    // once that file exists on the repo's default branch, and this lane's whole point is to prove
    // a workflow file that lives only on a throwaway `ci/<lane>` branch. `--branch` + `--event
    // push` finds the same run without that registration — the headSha match right below is what
    // keeps it the ONE run this push triggered, never a stale run of a reused lane name.
    const listed = run(
      "gh",
      ["run", "list", "--branch", branch, "--event", "push", "--json", "databaseId,headSha", "--limit", "10"],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    const runs = JSON.parse(listed);
    const match = runs.find((r) => r.headSha === headSha);
    if (match) { runId = match.databaseId; break; }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  if (!runId) {
    deleteBranch(repoRoot, branch);
    throw new Error(`no e2e-shards.yml run appeared for ${branch}@${headSha} within ${findBudgetMs}ms`);
  }

  // Watches to completion; a red run makes `gh run watch --exit-status` itself exit non-zero, so
  // the watch result alone already answers "red or not" — this helper still reads the log line
  // below for the shard counts and totals the report asks for.
  // ONE LOOK EVERY HALF MINUTE. `gh run watch` polls every three seconds by default, and each poll spends
  // several calls of the 5000 an hour every lane, lead and tool on this account shares: a few lanes watching
  // at once spend the hour's whole budget, and then every `gh` read refuses, this one included.
  const watch = spawnSync("gh", ["run", "watch", String(runId), "--exit-status", "--interval", WATCH_INTERVAL_S], { cwd: repoRoot, encoding: "utf8" });
  const watchOk = watch.status === 0;

  // The run exists on the remote and MUST be deleted whether or not reading its log succeeds — a
  // throw from either `gh run view` call here must never leave `ci/<lane>` standing. `finally`
  // deletes once regardless of which branch below returns or throws.
  let verdictLine = null;
  let verdictLines = [];
  let viewed;
  try {
    const log = run("gh", ["run", "view", String(runId), "--log"], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    // L2: EVERY `MERGE-VERIFY` line, not only the one-line summary — a red merge names its problems
    // on their OWN `MERGE-VERIFY problem:` lines, and a caller that read only the summary line saw
    // `ok=false` with no idea which of the five refusals fired.
    verdictLines = log.split("\n").filter((l) => l.includes("MERGE-VERIFY"));
    verdictLine = verdictLines.find((l) => l.includes("MERGE-VERIFY:")) ?? null;
    viewed = JSON.parse(run("gh", ["run", "view", String(runId), "--json", "conclusion,createdAt,updatedAt,url"], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }));
  } catch (err) {
    // A READ THAT FAILED SAYS NOTHING ABOUT THE RUN. `gh` refuses under the shared API rate limit, and a watch
    // that died of it returns before the run ends: the run goes on and may well read green. The refusal names
    // the run and the one command that reads it, so nobody takes this exit for a red.
    throw new Error(`${unreadVerdict(runId)}\n  cause: ${String(err?.message ?? err).split("\n")[0]}`);
  } finally {
    deleteBranch(repoRoot, branch);
  }

  const ok = watchOk && viewed.conclusion === "success";
  return { ok, runId, headSha, verdictLine, verdictLines, conclusion: viewed.conclusion, url: viewed.url, createdAt: viewed.createdAt, updatedAt: viewed.updatedAt };
}

/** Seconds between the watch's looks at a run. */
export const WATCH_INTERVAL_S = "30";

/** What `push` says when it pushed a run and could not read its verdict: neither green nor red. */
export const unreadVerdict = (runId) =>
  `UNREAD: run ${runId} stands pushed and its verdict went unread; it may still run. Read it by hand: `
  + `gh run view ${runId} --json status,conclusion,url,jobs`;

function deleteBranch(repoRoot, branch) {
  // Best-effort: a branch already gone (deleted by a retry, or never actually pushed because the
  // run-discovery failed first) must not mask the real verdict with a cleanup error.
  spawnSync("git", ["-C", repoRoot, "push", "origin", "--delete", branch], { stdio: ["ignore", "pipe", "pipe"] });
}

/** The line `push` ends on, whatever the shards answered: where the other half of the verdict gets read. */
export const HALF_VERDICT = "HALF A VERDICT: the shards ran the e2e sets alone — read the full CI workflow before calling this head green: node tools/ci-verdict.mjs --head";

async function cliPush(args, repoRoot) {
  const lane = args[0];
  if (!lane) { console.error("usage: e2e-shards.mjs push <lane>"); process.exitCode = 1; return; }
  assertNotBare(repoRoot);
  const result = await pushLaneAndWatch({ repoRoot, lane });
  console.log(`run ${result.runId}: conclusion=${result.conclusion} url=${result.url}`);
  // L2: print every MERGE-VERIFY line this run logged, not just the one-line summary — the problem
  // lines are the ONLY place a red merge names which of the five refusals fired.
  for (const line of result.verdictLines?.length ? result.verdictLines : (result.verdictLine ? [result.verdictLine] : [])) {
    console.log(line);
  }
  // ONE HALF OF GREEN. This lane runs the e2e sets alone; the package suites, the witness fleet and the tool
  // self-tests answer only in the full CI workflow, where a newer push cancels a run before it reports.
  // The head this lane PUSHED, never the checkout's head at print time: other hands commit while the run goes.
  console.log(`${HALF_VERDICT} ${result.headSha.slice(0, 9)}`);
  assertNotBare(repoRoot);
  process.exitCode = result.ok ? 0 : 1;
}

// ── CLI entry ───────────────────────────────────────────────────────────────────────────────────

async function main() {
  const [sub, ...rest] = process.argv.slice(2);
  const repoRoot = resolve(".");
  if (sub === "merge-verify") { cliMergeVerify(rest); return; }
  if (sub === "sets") { for (const set of E2E_SETS) console.log(`${set.name} ${set.dir} ${set.config}`); return; }
  if (sub === "push") { await cliPush(rest, repoRoot); return; }
  console.error("usage: e2e-shards.mjs merge-verify --artifacts-dir <dir> [--repo-root <dir>]");
  console.error("       e2e-shards.mjs push <lane>");
  console.error("       e2e-shards.mjs sets");
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
