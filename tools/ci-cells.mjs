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
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const pkg = (name, dir, shard, extra = {}) => ({ name, dir, ...(shard ? { shard } : {}), ...extra });
const node = (i) => ({ cell: `node-${i}`, packages: [pkg("@lararium/node", "packages/lararium-node", `${i}/2`)] });

/**
 * The package-suite cells. A `shard` of `i/n` runs vitest's own shard; the n rows of one package are the whole package.
 * `vitest: false` marks a suite that writes no vitest JSON report (the TiddlyWiki5 jasmine edition): the cell's own exit
 * answers for it.
 *
 * FEW CELLS, BECAUSE THE RUNNER POOL IS SHARED. Every cell repeats checkout, install, build and engines (60 to 260 seconds
 * measured on run 40977288914), and the lanes of this repository draw on one capped pool, so the number that decides is
 * total job-minutes, with each run's critical path held at or under the slowest e2e shard (about 16 minutes). Run seconds
 * of the serial job (run 40956130282): node 841 · web 390 · cli 171 · mesh 141 · tw5 100 · browser 58 · keyhive 27.
 */
export const TEST_CELLS = Object.freeze([
  node(1), node(2),
  { cell: "web-cli", packages: [
    pkg("@lararium/web", "packages/lararium-web"),
    pkg("@lares/cli", "packages/lares-cli"),
    pkg("@lares/harness", "tests"),
    pkg("@lararium/memetic-frame", "packages/lararium-memetic-frame"),
    pkg("@lararium/mempalace", "packages/lararium-mempalace"),
    pkg("@lararium/sensorium", "packages/lararium-sensorium"),
  ] },
  { cell: "mesh-tw5", packages: [
    pkg("@lararium/mesh", "packages/lararium-mesh"),
    pkg("@lararium/tw5", "packages/lararium-tw5"),
    pkg("@lararium/browser", "packages/lararium-browser"),
    pkg("@lararium/keyhive", "packages/lararium-keyhive"),
    pkg("tiddlywiki", "TiddlyWiki5", null, { vitest: false }),
  ] },
]);

const CLEAN = /^witness-all: every witness clean$/m;
/**
 * The witness cells. `only` names an apart witness (`APART` in witness-all.sh), which rides a cell of its own; the `rest`
 * cell runs the fleet without it, then the tool self-tests, and its log must carry the fleet's held-out roll call and the
 * self-tests' summary. `must` is what a green log carries.
 * Measured (seconds): contract-witness 373 · the rest of the fleet ~460 · self-tests 258.
 */
export const WITNESS_CELLS = Object.freeze([
  { cell: "contract-witness", only: "contract-witness", runs: [["tools/witness-all.sh", "--only", "contract-witness"]], must: [CLEAN] },
  { cell: "rest", runs: [["tools/witness-all.sh", "--except-apart"], "self-tests"], must: [CLEAN, /held out of this run/, /^ℹ tests [1-9]\d*$/m, /^ℹ fail 0$/m] },
]);

export const cellIds = (cells) => cells.map((c) => c.cell);

const slug = (dir) => dir.split("/").pop();
/** The JSON report one package of one cell writes, which is also that cell's per-file timing. */
export const testReportName = (cell, p) => `report-${cell}-${slug(p.dir)}.json`;

/** Every report the matrix owes: `{ cell, file, pkg }`. */
export function expectedTestReports(cells = TEST_CELLS) {
  return cells.flatMap((c) => c.packages.filter((p) => p.vitest !== false).map((p) => ({ cell: c.cell, file: testReportName(c.cell, p), pkg: p.name })));
}

/** The test gate's whole law. `reports` maps a report file name to `{ cell, report, parseError? }`. */
export function evaluateTestCells({ reports, cells = TEST_CELLS }) {
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
  return { ok: problems.length === 0, problems, totalTests, reportCount: reports.size };
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
    if (p.vitest !== false) {
      if (p.shard) args.push(`--shard=${p.shard}`);
      args.push("--reporter=default", "--reporter=json", `--outputFile.json=${resolve(out, testReportName(id, p))}`);
    }
    console.log(`── ${id}: ${p.name}${p.shard ? ` ${p.shard}` : ""} ──`);
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
    const verdict = tests ? evaluateTestCells({ reports: readTestReports(dir) }) : evaluateWitnessCells({ logs: readWitnessLogs(dir) });
    console.log(`${tests ? "TEST-CELLS" : "WITNESS-CELLS"}: ok=${verdict.ok} cells=${cellIds(tests ? TEST_CELLS : WITNESS_CELLS).length}${tests ? ` totalTests=${verdict.totalTests}` : ""}`);
    for (const p of verdict.problems) console.error(`${tests ? "TEST-CELLS" : "WITNESS-CELLS"} problem: ${p}`);
    process.exitCode = verdict.ok ? 0 : 1;
    return;
  }
  console.error("usage: ci-cells.mjs run-test|run-witness <cell> [--out <dir>] | verify-tests|verify-witnesses --artifacts-dir <dir>");
  process.exitCode = 1;
}

if (process.argv[1] && basename(process.argv[1]) === "ci-cells.mjs") await main();
