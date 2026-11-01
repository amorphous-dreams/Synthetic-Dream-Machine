// ci-node-deal.test.mjs — the node package rides two cells, dealt by file and measured weight, and the test gate holds
// the two reports to the tracked file set: each file runs once, every heavy file in the last part.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import * as cells from "./ci-cells.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NODE_DIR = "packages/lararium-node";
const live = () => ({ files: cells.trackedNodeFiles(ROOT), heavy: cells.readNodeHeavy(ROOT), weights: JSON.parse(readFileSync(join(ROOT, "tools/e2e-shard-weights.json"), "utf8"))["node-unit"] ?? {} });

const report = (names) => ({ numTotalTests: names.length, numPassedTests: names.length, numFailedTests: 0, success: true, testResults: names.map((n) => ({ name: `/runner/work/x/${NODE_DIR}/${n}`, startTime: 0, endTime: 1 })) });
const toy = { files: ["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts", "tests/h.test.ts"], heavy: ["tests/h.test.ts"] };
const only = (...parts) => cells.TEST_CELLS.filter((c) => c.packages.some((p) => p.dir === NODE_DIR));

test("D0 RED: the deal and its readers exist", () => {
  for (const name of ["nodeUnitFiles", "trackedNodeFiles", "readNodeHeavy"]) assert.equal(typeof cells[name], "function", `ci-cells.mjs exports no ${name}`);
});

test("D1 RED: the live tracked set deals into two parts, each file once, every heavy file in the last part, loads within 15%", () => {
  const { files, heavy, weights } = live();
  assert.ok(files.length > 400 && heavy.length >= 60, `read ${files.length} files and ${heavy.length} heavy`);
  const a = cells.nodeUnitFiles({ files, heavy, weights, part: 1, parts: 2 });
  const b = cells.nodeUnitFiles({ files, heavy, weights, part: 2, parts: 2 });
  assert.deepEqual([...a, ...b].sort(), [...files].sort());
  assert.equal(new Set([...a, ...b]).size, files.length);
  for (const h of heavy) assert.ok(b.includes(h) && !a.includes(h), `${h} is heavy and left the last part`);
  const med = Object.values(weights).sort((x, y) => x - y)[Math.floor(Object.keys(weights).length / 2)] ?? 5;
  const load = (list) => list.reduce((s, f) => s + (weights[f] ?? med) * (heavy.includes(f) ? cells.HEAVY_FACTOR : 1), 0);
  assert.ok(Math.abs(load(a) - load(b)) / Math.max(load(a), load(b)) < 0.15, `parts weigh ${load(a)} and ${load(b)}`);
});

test("D1b CONTROL: the deal is pure and order-free, and a file with no weight lands lawfully", () => {
  const w = { "tests/a.test.ts": 50, "tests/b.test.ts": 40 };
  const one = cells.nodeUnitFiles({ ...toy, weights: w, part: 1, parts: 2 });
  const two = cells.nodeUnitFiles({ ...toy, files: [...toy.files].reverse(), weights: w, part: 1, parts: 2 });
  assert.deepEqual(one, two);
  const all = [...one, ...cells.nodeUnitFiles({ ...toy, weights: w, part: 2, parts: 2 })].sort();
  assert.deepEqual(all, [...toy.files].sort());
});

const gate = (reports, tracked) => cells.evaluateTestCells({ reports, cells: only(), tracked: { [NODE_DIR]: tracked } });
const toyReports = (a, b) => new Map([
  ["report-node-a-lararium-node.json", { cell: "node-a", report: report(a) }],
  ["report-node-b-lararium-node.json", { cell: "node-b", report: report(b) }],
]);

test("D2 RED: the test gate refuses a tracked file no node cell ran, a file two ran, a heavy file outside the last part and a file nobody tracks", () => {
  const ok = gate(toyReports(["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts"], ["tests/h.test.ts"]), toy);
  assert.deepEqual(ok.problems, [], "CONTROL: a lawful pair of reports reads green");
  const lost = gate(toyReports(["tests/a.test.ts", "tests/b.test.ts"], ["tests/h.test.ts"]), toy);
  assert.match(lost.problems.join("\n"), /tests\/c\.test\.ts.*no cell/);
  const twice = gate(toyReports(["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts"], ["tests/h.test.ts", "tests/c.test.ts"]), toy);
  assert.match(twice.problems.join("\n"), /tests\/c\.test\.ts.*(twice|two cells|more than one)/);
  const heavyA = gate(toyReports(["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts", "tests/h.test.ts"], ["tests/b.test.ts"]), toy);
  assert.match(heavyA.problems.join("\n"), /tests\/h\.test\.ts.*heavy/);
  const stray = gate(toyReports(["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts", "tests/z.test.ts"], ["tests/h.test.ts"]), toy);
  assert.match(stray.problems.join("\n"), /tests\/z\.test\.ts.*tracked/);
  const unread = cells.evaluateTestCells({ reports: toyReports(["tests/a.test.ts"], ["tests/h.test.ts"]), cells: only() });
  assert.match(unread.problems.join("\n"), /tracked list/, "no tracked list handed in reads red, never a skipped law");
});

test("D3 RED: the table runs node as two dealt parts and no other cell holds the package", () => {
  const rows = cells.TEST_CELLS.flatMap((c) => c.packages.filter((p) => p.dir === NODE_DIR).map((p) => ({ cell: c.cell, ...p })));
  assert.deepEqual(rows.map((r) => [r.cell, r.deal, r.part, r.parts]), [["node-a", "node-unit", 1, 2], ["node-b", "node-unit", 2, 2]]);
});
