// ci-cells.test.mjs — the Test and Witnesses jobs run as cells behind one fail-closed gate each.
// The gate refuses a missing, empty, red or unexpected cell, as the e2e merge gate does; the tables in
// `ci-cells.mjs` are the one statement of the cells, and the workflow, the packages and the witness roster are held to them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  TEST_CELLS, WITNESS_CELLS, expectedTestReports, evaluateTestCells, evaluateWitnessCells, testReportName, cellIds,
} from "./ci-cells.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ci = () => readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
const code = (yml) => yml.replace(/^\s*#.*$/gm, "");

const lawful = (passed = 3) => ({ numTotalTests: passed, numPassedTests: passed, numFailedTests: 0, success: true, testResults: [] });
const allReports = () => new Map(expectedTestReports().map((r) => [r.file, { cell: r.cell, report: lawful() }]));
const allLogs = () => new Map(WITNESS_CELLS.map((c) => [c.cell, c.cell === "rest"
  ? "── x ──\nwitness-all: every witness clean\n── held out of this run ──\nℹ tests 485\nℹ pass 485\nℹ fail 0\n"
  : "── x ──\nwitness-all: every witness clean\n"]));

test("C1 CONTROL: a whole matrix reads green, every cell answering", () => {
  const verdict = evaluateTestCells({ reports: allReports() });
  assert.deepEqual(verdict.problems, []);
  assert.equal(verdict.ok, true);
  assert.deepEqual(evaluateWitnessCells({ logs: allLogs() }).problems, []);
});

test("C2 RED: a cell whose report never arrived refuses by name", () => {
  const reports = allReports();
  const gone = expectedTestReports().find((r) => r.cell === "mesh-tw5");
  reports.delete(gone.file);
  const v = evaluateTestCells({ reports });
  assert.equal(v.ok, false);
  assert.match(v.problems.join("\n"), /missing report: cell mesh-tw5/);
});

test("C3 RED: a cell that ran zero passing tests, one with a failure, and one with a corrupt report each refuse", () => {
  const [a, b, c] = expectedTestReports();
  assert.ok(c, "the table owes at least three reports");
  const reports = allReports();
  reports.set(a.file, { cell: a.cell, report: lawful(0) });
  reports.set(b.file, { cell: b.cell, report: { ...lawful(), numFailedTests: 1, success: false } });
  reports.set(c.file, { cell: c.cell, report: null, parseError: "Unexpected end of JSON input" });
  const text = evaluateTestCells({ reports }).problems.join("\n");
  assert.match(text, new RegExp(`empty report: cell ${a.cell}`));
  assert.match(text, new RegExp(`red report: cell ${b.cell}`));
  assert.match(text, new RegExp(`unparseable report: cell ${c.cell}`));
});

test("C4 RED: a report no cell of the table owns refuses (a cell renamed or added beside the table)", () => {
  const reports = allReports();
  reports.set("report-ghost-@lararium-x.json", { cell: "ghost", report: lawful() });
  assert.match(evaluateTestCells({ reports }).problems.join("\n"), /unexpected report: cell ghost/);
});

test("C5 RED: a witness cell with no log, a red log, a rest log with no roll call or no self-test summary each refuse", () => {
  const logs = allLogs();
  logs.delete("contract-witness");
  logs.set("rest", "witness-all: every witness clean\nℹ tests 485\nℹ fail 0\n");
  let text = evaluateWitnessCells({ logs }).problems.join("\n");
  assert.match(text, /missing log: cell contract-witness/);
  assert.match(text, /red log: cell rest/);
  logs.set("rest", "witness-all: every witness clean\n── held out of this run ──\nℹ tests 0\nℹ fail 0\n");
  assert.match(evaluateWitnessCells({ logs }).problems.join("\n"), /red log: cell rest/);
  logs.set("contract-witness", "── contract-witness ──\nwitness-all: 1 red\n");
  assert.match(evaluateWitnessCells({ logs }).problems.join("\n"), /red log: cell contract-witness/);
  logs.set("rogue", "witness-all: every witness clean\n");
  assert.match(evaluateWitnessCells({ logs }).problems.join("\n"), /unexpected log: cell rogue/);
});

test("C6 RED: every workspace package with a test script rides exactly its shards in the table", () => {
  const dirs = [...readdirSync(join(ROOT, "packages")).map((d) => `packages/${d}`), "tests", "TiddlyWiki5"];
  const withTest = dirs.filter((d) => existsSync(join(ROOT, d, "package.json")) && JSON.parse(readFileSync(join(ROOT, d, "package.json"), "utf8")).scripts?.test);
  assert.ok(withTest.length >= 11, `only ${withTest.length} packages carry a test script`);
  for (const dir of withTest) {
    const rows = TEST_CELLS.flatMap((c) => c.packages.filter((p) => p.dir === dir));
    assert.ok(rows.length > 0, `${dir} carries a test script and no cell runs it`);
    const counts = new Set(rows.map((p) => p.shard?.split("/")[1] ?? "1"));
    assert.equal(counts.size, 1, `${dir}: its rows disagree on the shard count`);
    const n = Number([...counts][0]);
    assert.deepEqual(rows.map((p) => p.shard ?? "1/1").sort(), Array.from({ length: n }, (_, i) => `${i + 1}/${n}`), `${dir}: its shards do not deal 1..${n} once each`);
  }
  for (const c of TEST_CELLS) for (const p of c.packages) assert.ok(withTest.includes(p.dir), `cell ${c.cell} runs ${p.dir}, which carries no test script`);
});

test("C7 RED: ci.yml carries one matrix row per cell, and a gate job named Test that fails closed over them", () => {
  const yml = code(ci());
  const tests = [...yml.matchAll(/^ {10}- cell: (\S+)$/gm)].map((m) => m[1]);
  assert.deepEqual(tests.filter((id) => cellIds(TEST_CELLS).includes(id)).sort(), cellIds(TEST_CELLS).sort());
  const witnesses = tests.filter((id) => cellIds(WITNESS_CELLS).includes(id)).sort();
  assert.deepEqual(witnesses, cellIds(WITNESS_CELLS).sort());
  const block = (id) => new RegExp(`^  ${id}:\\n((?: {4}.*\\n|\\n| {6}.*\\n)+)`, "m").exec(yml)?.[1] ?? "";
  for (const [gate, cells, verb] of [["test", "test-cells", "verify-tests"], ["witnesses", "witness-cells", "verify-witnesses"]]) {
    const g = block(gate);
    assert.match(g, /^ {4}name: (Test|Witnesses)$/m, `the ${gate} gate job lost its name`);
    assert.match(g, new RegExp(`^ {4}needs: ${cells}$`, "m"));
    assert.match(g, /^ {4}if: always\(\)$/m, `the ${gate} gate skips when a cell fails: a skipped required check reads as nothing to report`);
    assert.match(g, new RegExp(`ci-cells\\.mjs ${verb}`));
    assert.match(g, new RegExp(`needs\\.${cells}\\.result`), `the ${gate} gate never reads its cells' own result`);
    assert.match(block(cells), /fail-fast: false/, `${cells} cancels its siblings on one red`);
  }
});

test("C8 RED: the witness cells split witness-all.sh's roster with none lost and none run twice", () => {
  const list = (...args) => {
    const r = spawnSync("bash", ["tools/witness-all.sh", "--list", ...args], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split("\n").filter(Boolean);
  };
  const whole = list();
  const fleet = list("--except-apart");
  const apart = WITNESS_CELLS.filter((c) => c.only).map((c) => c.only);
  assert.ok(apart.length >= 1);
  const parts = [...fleet, ...apart.flatMap((w) => list("--only", w))];
  assert.deepEqual([...parts].sort(), [...whole].sort());
  assert.equal(new Set(parts).size, parts.length);
  for (const w of apart) assert.ok(!fleet.includes(w), `${w} runs in the fleet cell and in its own`);
  const refuse = spawnSync("bash", ["tools/witness-all.sh", "--list", "--only", "no-such-witness"], { cwd: ROOT, encoding: "utf8" });
  assert.notEqual(refuse.status, 0);
});

test("C9 RED: a cell's report name carries its cell and package, and the table keeps every package's script one plain vitest run", () => {
  assert.equal(testReportName("node", { dir: "packages/lararium-node" }), "report-node-lararium-node.json");
  for (const c of TEST_CELLS) for (const p of c.packages.filter((q) => q.vitest !== false)) {
    const script = JSON.parse(readFileSync(join(ROOT, p.dir, "package.json"), "utf8")).scripts.test;
    assert.match(script, /^vitest run( --config \S+)?$/, `${p.dir}: its test script is no plain vitest run, so a cell cannot append a shard and a reporter to it`);
  }
});
