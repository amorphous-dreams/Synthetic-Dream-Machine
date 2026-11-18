#!/usr/bin/env node
/**
 * ci-cells — the Test and Witnesses jobs of `.github/workflows/ci.yml` run as CELLS behind one fail-closed gate each.
 *
 * ── WHY CELLS ────────────────────────────────────────────────────────────────────────────────────
 * One serial `pnpm test` walked every package in turn (29 minutes of a 31-minute run) and one witness job walked the
 * whole fleet then the tool self-tests (19 minutes). A cell runs a slice on its own runner; the slowest cell sets the
 * wall clock. The two tables below are the one statement of the slices: the workflow's matrix rows, the workspace's
 * packages and `tools/witness-all.sh`'s roster are each held to them by `ci-cells.test.mjs`.
 *
 * ── THE GATES ────────────────────────────────────────────────────────────────────────────────────
 * `verify-tests` and `verify-witnesses` read what every cell uploaded and refuse, by cell name, on a missing, empty, red,
 * unparseable or unexpected answer, as the e2e merge gate does for its shards. A skipped or cancelled cell uploads
 * nothing, so it reads as missing. The evaluators are pure so the tests plant each refusal without a run.
 *
 * Usage:
 *   ci-cells.mjs run-test <cell> --out <dir>        run the cell's packages, a JSON report each (also the per-file timing)
 *   ci-cells.mjs run-witness <cell> --out <dir>     run the cell's witnesses or self-tests, its log in <dir>
 *   ci-cells.mjs verify-tests --artifacts-dir <dir>
 *   ci-cells.mjs verify-witnesses --artifacts-dir <dir>
 */
import { execFileSync, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = (name, dir, shard, extra = {}) => ({ name, dir, ...(shard ? { shard } : {}), ...extra });
/** A dealt part: file `part` of `parts` by measured weight (see `nodeUnitFiles`), where vitest's own `--shard` would hash by path. */
const dealt = (name, dir, part, parts) => pkg(name, dir, null, { deal: "node-unit", part, parts });

/**
 * The package-suite cells. A `shard` of `i/n` runs vitest's own shard; the n rows of one package are the whole package.
 * `vitest: false` marks a suite that writes no vitest JSON report (the TiddlyWiki5 jasmine edition): the cell's own exit
 * answers for it.
 *
 * NODE RIDES TWO DEALT CELLS, NEVER VITEST SHARDS. Measured on runs 40977288914 and 40985431558: vitest's `--shard` ran
 * two node shards in 1350 s together and three in 1437 s, against 841 s serial. Each shard runs the config's serial
 * `heavy` project beside its parallel `main` project, and the path hash clusters the heavy files, so a shard's wall clock
 * barely falls with its file count. The cells below deal FILES instead, as the e2e shards do: `nodeUnitFiles` pins every
 * `heavy` file to the last part (the serial project runs after `main`, so one cell carries it whole), and deals the `main`
 * files by measured weight (`node-unit` in e2e-shard-weights.json) so the two parts finish together. The test gate holds
 * the two reports to the tracked file set (each file once, every heavy file in the last part), the law vitest's shard no
 * longer gives. Measured on run 41280151942: `main` 417 files, 3653 file-seconds across 4 workers (window 0-1050 s), then
 * 67 `heavy` files serial (1052-1293 s).
 *
 * TEN JOBS A RUN, BECAUSE THE RUNNER POOL IS SHARED. The account runs about twenty jobs at once, so a full run raises at
 * most ten (tools/ci-graph.test.mjs holds the workflow to it) and a second full run starts beside it. Every cell repeats
 * checkout, install and build (0.9 to 2 minutes measured on run 41280151942), so the cells are few and full, with each run's
 * critical path held at the slowest e2e shard (about 17 minutes). Run seconds (run 41280151942): node 1297 · web 576 ·
 * cli 296 · mesh 256 · tw5 172 · browser 99 · keyhive 46 · tiddlywiki jasmine ~27.
 */
export const TEST_CELLS = Object.freeze([
  { cell: "node-a", packages: [dealt("@lararium/node", "packages/lararium-node", 1, 2)] },
  { cell: "node-b", packages: [dealt("@lararium/node", "packages/lararium-node", 2, 2)] },
  { cell: "web-tw5", packages: [
    pkg("@lararium/web", "packages/lararium-web"),
    pkg("@lararium/tw5", "packages/lararium-tw5"),
  ] },
  { cell: "cli-mesh", packages: [
    pkg("@lares/cli", "packages/lares-cli"),
    pkg("@lares/harness", "tests"),
    pkg("@lararium/memetic-frame", "packages/lararium-memetic-frame"),
    pkg("@lararium/mempalace", "packages/lararium-mempalace"),
    pkg("@lararium/sensorium", "packages/lararium-sensorium"),
    pkg("@lararium/mesh", "packages/lararium-mesh"),
    pkg("@lararium/browser", "packages/lararium-browser"),
    pkg("@lararium/keyhive", "packages/lararium-keyhive"),
    pkg("tiddlywiki", "TiddlyWiki5", null, { vitest: false }),
  ] },
]);

const CLEAN = /^witness-all: every witness clean$/m;
/**
 * The witness cells. `host` names the job that runs a cell when it has no matrix row of its own. `only` names an apart witness (`APART` in witness-all.sh), which rides a cell of its own; the `rest`
 * cell runs the fleet without it, then the tool self-tests, and its log must carry the fleet's held-out roll call and the
 * self-tests' summary. `must` is what a green log carries.
 * Measured (seconds): contract-witness 373 · the rest of the fleet ~460 · self-tests 258.
 */
export const WITNESS_CELLS = Object.freeze([
  // `host: "quick"` rides the quick job (a job of its own would spend one of the ten); the gate keys on the cell's artifact name.
  { cell: "contract-witness", only: "contract-witness", host: "quick", runs: [["tools/witness-all.sh", "--only", "contract-witness"]], must: [CLEAN] },
  { cell: "rest", runs: [["tools/witness-all.sh", "--except-apart"], "self-tests"], must: [CLEAN, /held out of this run/, /^ℹ tests [1-9]\d*$/m, /^ℹ fail 0$/m] },
]);

export const cellIds = (cells) => cells.map((c) => c.cell);

// ── the node deal: files to the two node cells by measured weight ────────────────────────────────

/** The serial `heavy` project runs on one worker where `main` runs on four: a heavy file's seconds weigh this much more in the deal. */
export const HEAVY_FACTOR = 4;
const NODE_DIR = "packages/lararium-node";
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * The files of part `part` of `parts`, relative to the node package (`tests/x.test.ts`). Every `heavy` file goes to the last
 * part; the rest deal heaviest first, each to the lightest part so far, the last part starting loaded with its heavy files.
 * A file with no weight weighs the median. Pure and order-free: every runner computes the same deal from the same list.
 */
export function nodeUnitFiles({ files, heavy = [], weights = {}, part, parts = 2 }) {
  const known = Object.values(weights).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const median = known.length > 0 ? known[Math.floor(known.length / 2)] : 5;
  const isHeavy = new Set(heavy);
  const weigh = (f) => (weights[f] ?? median) * (isHeavy.has(f) ? HEAVY_FACTOR : 1);
  const loads = Array(parts).fill(0);
  const dealtTo = Array.from({ length: parts }, () => []);
  for (const f of files.filter((x) => isHeavy.has(x))) { dealtTo[parts - 1].push(f); loads[parts - 1] += weigh(f); }
  const rest = files.filter((x) => !isHeavy.has(x)).sort((a, b) => weigh(b) - weigh(a) || (a < b ? -1 : 1));
  for (const f of rest) {
    const at = loads.indexOf(Math.min(...loads));
    dealtTo[at].push(f);
    loads[at] += weigh(f);
  }
  return dealtTo[part - 1].sort();
}

/** The node package's tracked suites the vitest include selects (`tests/**\/*.test.ts` beside `tests/e2e`), relative to the package. */
export function trackedNodeFiles(root = REPO_ROOT) {
  const out = execFileSync("git", ["ls-files", `${NODE_DIR}/tests`], { cwd: root, encoding: "utf8" });
  return out.split("\n").map((s) => s.trim()).filter((f) => /\.test\.ts$/.test(f)).map((f) => f.slice(NODE_DIR.length + 1)).filter((f) => !f.startsWith("tests/e2e/")).sort();
}

/** The `heavy` roster of the package's vitest config, read off the config's own array (the one place it stands). */
export function readNodeHeavy(root = REPO_ROOT) {
  const text = readFileSync(join(root, NODE_DIR, "vitest.config.ts"), "utf8");
  const start = text.indexOf("export const heavy");
  const end = text.indexOf("export const mainExclude");
  if (start === -1 || end === -1 || end < start) throw new Error("ci-cells: vitest.config.ts no longer names `heavy` and `mainExclude` in that order");
  return [...text.slice(start, end).matchAll(/^\s*"(tests\/[^"]+\.test\.ts)",?/gm)].map((m) => m[1]).sort();
}

const nodeWeights = () => JSON.parse(readFileSync(new URL("./e2e-shard-weights.json", import.meta.url), "utf8"))["node-unit"] ?? {};

const slug = (dir) => dir.split("/").pop();
/** The JSON report one package of one cell writes, which is also that cell's per-file timing. */
export const testReportName = (cell, p) => `report-${cell}-${slug(p.dir)}.json`;

/** Every report the matrix owes: `{ cell, file, pkg }`. */
export function expectedTestReports(cells = TEST_CELLS) {
  return cells.flatMap((c) => c.packages.filter((p) => p.vitest !== false).map((p) => ({ cell: c.cell, file: testReportName(c.cell, p), pkg: p.name })));
}

/**
 * The test gate's whole law. `reports` maps a report file name to `{ cell, report, parseError? }`. `tracked` maps a dealt
 * package's dir to `{ files, heavy }` (relative to it): the files the dealt cells together must run, each once.
 */
export function evaluateTestCells({ reports, cells = TEST_CELLS, tracked }) {
  const problems = [];
  const owed = expectedTestReports(cells);
  const owedFiles = new Map(owed.map((r) => [r.file, r]));
  let totalTests = 0;
  for (const want of owed) {
    const got = reports.get(want.file);
    if (!got || got.cell !== want.cell) { problems.push(`missing report: cell ${want.cell} (${want.pkg}) never reported ${want.file}`); continue; }
    if (got.parseError || got.report == null) { problems.push(`unparseable report: cell ${want.cell} (${want.pkg}): ${got.parseError ?? "no report body"}`); continue; }
    const r = got.report;
    const failed = Number(r.numFailedTests ?? 0);
    const passed = Number(r.numPassedTests ?? 0);
    totalTests += Number(r.numTotalTests ?? 0);
    if (failed > 0 || r.success === false) problems.push(`red report: cell ${want.cell} (${want.pkg}) failed ${failed} test(s)`);
    else if (passed === 0) problems.push(`empty report: cell ${want.cell} (${want.pkg}) ran zero passing tests (total=${Number(r.numTotalTests ?? 0)})`);
  }
  for (const [file, got] of reports) {
    if (owedFiles.get(file)?.cell !== got.cell) problems.push(`unexpected report: cell ${got.cell} sent ${file}, which the table does not owe`);
  }
  problems.push(...dealtFileProblems({ reports, cells, tracked }));
  return { ok: problems.length === 0, problems, totalTests, reportCount: reports.size };
}

/** The dealt packages' file law: each tracked file ran in exactly one cell, every heavy file in the last part, no file ran that nobody tracks. */
function dealtFileProblems({ reports, cells, tracked }) {
  const problems = [];
  const rows = cells.flatMap((c) => c.packages.filter((p) => p.deal).map((p) => ({ cell: c.cell, ...p })));
  for (const dir of new Set(rows.map((r) => r.dir))) {
    const mine = rows.filter((r) => r.dir === dir);
    const want = tracked?.[dir];
    if (!want || !Array.isArray(want.files) || want.files.length === 0) { problems.push(`unread file set: ${dir} is dealt across cells and the gate was handed no tracked list for it`); continue; }
    const last = Math.max(...mine.map((r) => r.part));
    const ranBy = new Map();
    for (const r of mine) {
      const got = reports.get(testReportName(r.cell, r));
      if (!got?.report?.testResults) continue; // a missing or unparseable report already read red above
      for (const t of got.report.testResults) {
        const at = String(t.name).replaceAll("\\", "/").lastIndexOf(`${dir}/`);
        const rel = at === -1 ? String(t.name) : String(t.name).replaceAll("\\", "/").slice(at + dir.length + 1);
        ranBy.set(rel, [...(ranBy.get(rel) ?? []), r]);
      }
    }
    const tracks = new Set(want.files);
    const heavy = new Set(want.heavy ?? []);
    for (const f of want.files) {
      const by = ranBy.get(f) ?? [];
      if (by.length === 0) problems.push(`file run by no cell: ${dir}/${f} is tracked and ran in no cell`);
      else if (by.length > 1) problems.push(`file run twice: ${dir}/${f} ran in more than one cell (${by.map((r) => r.cell).join(", ")})`);
      else if (heavy.has(f) && by[0].part !== last) problems.push(`heavy file outside the last part: ${dir}/${f} is heavy and ran in ${by[0].cell}, not in the last part`);
    }
    for (const f of ranBy.keys()) if (!tracks.has(f)) problems.push(`untracked file ran: ${dir}/${f} ran and the tracked list does not name it`);
  }
  return problems;
}

/** The witness gate's whole law. `logs` maps a cell to its log text. */
export function evaluateWitnessCells({ logs, cells = WITNESS_CELLS }) {
  const problems = [];
  for (const c of cells) {
    const text = logs.get(c.cell);
    if (typeof text !== "string") { problems.push(`missing log: cell ${c.cell} never uploaded its log`); continue; }
    const lacks = c.must.filter((rx) => !rx.test(text));
    if (text.trim() === "" || lacks.length > 0) problems.push(`red log: cell ${c.cell} lacks ${lacks.map(String).join(" and ") || "any output"}`);
  }
  const known = new Set(cellIds(cells));
  for (const cell of logs.keys()) if (!known.has(cell)) problems.push(`unexpected log: cell ${cell} is no cell of the table`);
  return { ok: problems.length === 0, problems };
}

// ── disk readers for the gates ───────────────────────────────────────────────────────────────────

function dirsOf(artifactsDir, prefix) {
  return existsSync(artifactsDir) ? readdirSync(artifactsDir).filter((d) => d.startsWith(prefix)).sort() : [];
}

export function readTestReports(artifactsDir) {
  const reports = new Map();
  for (const dir of dirsOf(artifactsDir, "test-cell-")) {
    const cell = dir.slice("test-cell-".length);
    for (const file of readdirSync(join(artifactsDir, dir)).filter((f) => /^report-.*\.json$/.test(f))) {
      try { reports.set(file, { cell, report: JSON.parse(readFileSync(join(artifactsDir, dir, file), "utf8")) }); }
      catch (err) { reports.set(file, { cell, report: null, parseError: String(err?.message ?? err) }); }
    }
  }
  return reports;
}

export function readWitnessLogs(artifactsDir) {
  const logs = new Map();
  for (const dir of dirsOf(artifactsDir, "witness-cell-")) {
    const cell = dir.slice("witness-cell-".length);
    const file = join(artifactsDir, dir, `${cell}.log`);
    if (existsSync(file)) logs.set(cell, readFileSync(file, "utf8"));
  }
  return logs;
}

// ── running a cell ───────────────────────────────────────────────────────────────────────────────

/** Run one command to its end, inheriting output (and copying it to `logFile` when given); resolves its exit code. */
function runCommand(cmd, args, logFile) {
  return new Promise((done) => {
    const log = logFile ? createWriteStream(logFile, { flags: "a" }) : null;
    const child = spawn(cmd, args, { stdio: log ? ["ignore", "pipe", "pipe"] : "inherit" });
    if (log) for (const [from, to] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) from.on("data", (b) => { to.write(b); log.write(b); });
    child.on("error", (e) => { console.error(`ci-cells: ${cmd} did not start: ${e.message}`); done(127); });
    child.on("close", (code) => { log?.end(); done(code ?? 1); });
  });
}

/** A cell never short-circuits: every package runs, and the worst exit wins. */
async function runTestCell(id, out) {
  const cell = TEST_CELLS.find((c) => c.cell === id);
  if (!cell) throw new Error(`no test cell ${id}; the table names ${cellIds(TEST_CELLS).join(", ")}`);
  mkdirSync(out, { recursive: true });
  let worst = 0;
  for (const p of cell.packages) {
    const args = ["--filter", p.name, "test"];
    if (p.deal) {
      const files = nodeUnitFiles({ files: trackedNodeFiles(), heavy: readNodeHeavy(), weights: nodeWeights(), part: p.part, parts: p.parts });
      if (files.length === 0) throw new Error(`ci-cells: the deal gave ${id} no file`);
      args.push(...files);
    }
    if (p.vitest !== false) {
      if (p.shard) args.push(`--shard=${p.shard}`);
      args.push("--reporter=default", "--reporter=json", `--outputFile.json=${resolve(out, testReportName(id, p))}`);
    }
    console.log(`── ${id}: ${p.name}${p.shard ? ` ${p.shard}` : ""}${p.deal ? ` part ${p.part}/${p.parts}` : ""} ──`);
    worst = Math.max(worst, await runCommand("pnpm", args));
  }
  return worst;
}

async function runWitnessCell(id, out) {
  const cell = WITNESS_CELLS.find((c) => c.cell === id);
  if (!cell) throw new Error(`no witness cell ${id}; the table names ${cellIds(WITNESS_CELLS).join(", ")}`);
  mkdirSync(out, { recursive: true });
  const logFile = join(out, `${id}.log`);
  // Every run of the cell happens whatever the one before answered; the worst exit wins.
  let worst = 0;
  for (const run of cell.runs) {
    if (run === "self-tests") {
      const files = readdirSync("tools").filter((f) => f.endsWith(".test.mjs")).sort().map((f) => join("tools", f));
      worst = Math.max(worst, await runCommand("node", ["--test", ...files], logFile));
    } else worst = Math.max(worst, await runCommand(run[0], run.slice(1), logFile));
  }
  return worst;
}

const flag = (args, name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };

async function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (sub === "run-test") { process.exitCode = await runTestCell(rest[0], flag(rest, "--out") ?? "test-cell-out"); return; }
  if (sub === "run-witness") { process.exitCode = await runWitnessCell(rest[0], flag(rest, "--out") ?? "witness-cell-out"); return; }
  if (sub === "verify-tests" || sub === "verify-witnesses") {
    const dir = resolve(flag(rest, "--artifacts-dir") ?? "artifacts");
    const tests = sub === "verify-tests";
    const verdict = tests ? evaluateTestCells({ reports: readTestReports(dir), tracked: { [NODE_DIR]: { files: trackedNodeFiles(), heavy: readNodeHeavy() } } }) : evaluateWitnessCells({ logs: readWitnessLogs(dir) });
    console.log(`${tests ? "TEST-CELLS" : "WITNESS-CELLS"}: ok=${verdict.ok} cells=${cellIds(tests ? TEST_CELLS : WITNESS_CELLS).length}${tests ? ` totalTests=${verdict.totalTests}` : ""}`);
    for (const p of verdict.problems) console.error(`${tests ? "TEST-CELLS" : "WITNESS-CELLS"} problem: ${p}`);
    process.exitCode = verdict.ok ? 0 : 1;
    return;
  }
  console.error("usage: ci-cells.mjs run-test|run-witness <cell> [--out <dir>] | verify-tests|verify-witnesses --artifacts-dir <dir>");
  process.exitCode = 1;
}

if (process.argv[1] && basename(process.argv[1]) === "ci-cells.mjs") await main();
