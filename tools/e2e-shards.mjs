#!/usr/bin/env node
/**
 * e2e-shards — the sharded e2e lane's tables and its merge gate, the one that fails closed inside
 * `.github/workflows/e2e-shards.yml`. It reads files and git alone; it pushes nothing and reads no
 * GitHub run.
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
 *   - any failing test, in any shard, and any file that failed outside a test (a hook that threw), by name;
 *   - a zero total across every shard combined;
 *   - a union of executed files that differs from the tracked set (each set in `E2E_SETS` against its own glob) — a file
 *     no shard ran, or a file more than one shard ran, both read here.
 */

import { execFileSync } from "node:child_process";
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
 *   companion    `{ of, shard }`: the set has no runner of its own and rides shard `shard` of set `of` as a second run
 *                in the same job (a runner is one of the ten jobs a full CI run may raise; its gate artifact keeps the
 *                set's own name, so the merge gate reads it as it always did)
 */
export const E2E_SETS = Object.freeze([
  Object.freeze({ name: "tests", dir: "tests", config: "vitest.config.ts", trackedGlob: "tests/e2e/*.test.ts", shards: 4 }),
  Object.freeze({ name: "node", dir: "packages/lararium-node", config: "vitest.e2e.config.ts", trackedGlob: "packages/lararium-node/tests/e2e/*.test.ts", shards: 1, companion: Object.freeze({ of: "tests", shard: 3 }) }),
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
      // A FILE that failed outside any case (a hook that threw, a load error) skips its cases and counts no failing
      // test, yet vitest exits 1: the file names itself with the first line of its own message.
      const hooked = (r.testResults ?? [])
        .filter((tr) => tr.status === "failed" && !(tr.assertionResults ?? []).some((t) => t.status === "failed"))
        .map((tr) => `${typeof tr.name === "string" ? relativeToE2eDir(tr.name) : "?"} failed outside any test${typeof tr.message === "string" && tr.message.trim() ? `: ${tr.message.trim().split("\n")[0].slice(0, 300)}` : ""}`);
      const reds = [...named, ...hooked];
      problems.push(`red shard: shard ${shard} failed (${nFailed} failing test(s))${reds.length > 0 ? `: ${reds.join(" | ")}` : ""}`);
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

// ── the deal: files to shards by measured weight ─────────────────────────────────────────────────

/**
 * Which files shard `shard` of `shards` runs. Vitest's own `--shard=k/n` deals files out by a hash of their path, so a
 * set's heaviest files can all land in one shard (measured: 21.6 min against 11.9 min). This deals them by weight:
 * heaviest first, each to the lightest shard so far. `weights` maps a file's name under `e2e/` to seconds; a file
 * with no row weighs the median of the rows, so a new file lands somewhere lawful before anyone measures it.
 * Pure and order-free: every shard's runner computes the same deal from the same tracked list.
 */
export function shardFiles({ files, weights = {}, shards, shard }) {
  const known = Object.values(weights).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const median = known.length > 0 ? known[Math.floor(known.length / 2)] : 60;
  const weigh = (f) => weights[relativeToE2eDir(f)] ?? median;
  const order = [...files].sort((a, b) => weigh(b) - weigh(a) || (a < b ? -1 : 1));
  const loads = Array(shards).fill(0);
  const dealt = Array.from({ length: shards }, () => []);
  for (const f of order) {
    const at = loads.indexOf(Math.min(...loads));
    dealt[at].push(f);
    loads[at] += weigh(f);
  }
  return dealt[shard - 1].sort();
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

  // One grep-able line in the run's log: a reader greps it and never re-derives the verdict from raw JSON.
  console.log(
    `MERGE-VERIFY: ok=${verdict.ok} shards=${shards} totalTests=${verdict.totalTests} ` +
    `executedFiles=${verdict.executedFileCount} trackedFiles=${trackedCount}`,
  );
  for (const problem of verdict.problems) console.error(`MERGE-VERIFY problem: ${problem}`);

  process.exitCode = verdict.ok ? 0 : 1;
}

/** `shard-files --set <name> --shard <k>`: the set's files for shard k, one per line, relative to the set's directory. */
function cliShardFiles(args) {
  const repoRoot = resolve(readFlag(args, "--repo-root") ?? ".");
  const set = E2E_SETS.find((s) => s.name === readFlag(args, "--set"));
  const shard = Number(readFlag(args, "--shard"));
  if (!set || !Number.isInteger(shard) || shard < 1 || shard > set.shards) {
    console.error("usage: e2e-shards.mjs shard-files --set <name> --shard <k> [--repo-root <dir>]");
    process.exitCode = 1;
    return;
  }
  const weights = JSON.parse(readFileSync(new URL("./e2e-shard-weights.json", import.meta.url), "utf8"))[set.name] ?? {};
  const files = trackedE2eFiles(repoRoot, set.trackedGlob);
  for (const f of shardFiles({ files, weights, shards: set.shards, shard })) console.log(f.startsWith(`${set.dir}/`) ? f.slice(set.dir.length + 1) : f);
}

function readFlag(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

// ── CLI entry ───────────────────────────────────────────────────────────────────────────────────

async function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (sub === "merge-verify") { cliMergeVerify(rest); return; }
  if (sub === "shard-files") { cliShardFiles(rest); return; }
  if (sub === "sets") { for (const set of E2E_SETS) console.log(`${set.name} ${set.dir} ${set.config}`); return; }
  console.error("usage: e2e-shards.mjs merge-verify --artifacts-dir <dir> [--repo-root <dir>]");
  console.error("       e2e-shards.mjs shard-files --set <name> --shard <k> [--repo-root <dir>]");
  console.error("       e2e-shards.mjs sets");
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
