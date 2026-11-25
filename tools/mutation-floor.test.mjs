// mutation-floor.test — the reading a Stryker report yields, the floor three equal readings stand, and the check
// that holds a later report to the floor's score and kill set; synthetic reports, no Stryker run here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkReading, foldReadings, mutantKey, readReading, SilentReport } from "./mutation-floor.mjs";

const TOOL = fileURLToPath(new URL("./mutation-floor.mjs", import.meta.url));
const dir = () => mkdtempSync(join(tmpdir(), "mutation-floor-"));

const mutant = (id, status, line, mutatorName = "ConditionalExpression", replacement = "true") => ({
  id: String(id), mutatorName, replacement, status, testsCompleted: status === "NoCoverage" ? 0 : 1,
  location: { start: { line, column: 3 }, end: { line, column: 9 } },
});
const report = (mutants, file = "src/a.ts") => ({ schemaVersion: "1.0", files: { [file]: { language: "typescript", source: "", mutants } } });
const steady = () => report([mutant(1, "Killed", 1), mutant(2, "Killed", 2), mutant(3, "Timeout", 3), mutant(4, "Survived", 4)]);

test("a reading counts each status apart and scores detected over valid, timeouts counted beside kills", () => {
  const r = readReading(report([
    mutant(1, "Killed", 1), mutant(2, "Timeout", 2), mutant(3, "Survived", 3), mutant(4, "NoCoverage", 4),
    mutant(5, "CompileError", 5), mutant(6, "Ignored", 6),
  ]));
  assert.deepEqual({ mutants: r.mutants, killed: r.killed, timeout: r.timeout, survived: r.survived, noCoverage: r.noCoverage, errors: r.errors, ignored: r.ignored },
    { mutants: 6, killed: 1, timeout: 1, survived: 1, noCoverage: 1, errors: 1, ignored: 1 });
  assert.equal(r.score, 50);
  assert.deepEqual(r.detected, [mutantKey("src/a.ts", mutant(1, "Killed", 1)), mutantKey("src/a.ts", mutant(2, "Timeout", 2))]);
});

test("a mutant's key names its file, start, operator and replacement, never Stryker's per-run id", () => {
  assert.equal(mutantKey("src/a.ts", mutant(41, "Killed", 7, "EqualityOperator", "a !== b")), "src/a.ts:7:3:EqualityOperator:a !== b");
  assert.equal(mutantKey("src/a.ts", mutant(1, "Killed", 7, "EqualityOperator", "a !== b")), mutantKey("src/a.ts", mutant(99, "Survived", 7, "EqualityOperator", "a !== b")));
});

test("silence never passes: a report with no file, no valid mutant or no test run refuses by name", () => {
  assert.throws(() => readReading({ files: {} }), SilentReport);
  assert.throws(() => readReading(report([mutant(1, "CompileError", 1), mutant(2, "Ignored", 2)])), SilentReport);
  assert.throws(() => readReading(report([mutant(1, "NoCoverage", 1), mutant(2, "NoCoverage", 2)])), SilentReport);
  assert.throws(() => readReading(null), SilentReport);
});

test("three equal readings from three distinct runs stand the floor at their score and kill set", () => {
  const base = { packages: {} };
  const one = foldReadings(base, "pkg", [["run-1", readReading(steady())], ["run-2", readReading(steady())]]);
  assert.equal(one.packages.pkg.floor, null);
  const two = foldReadings(one, "pkg", [["run-3", readReading(steady())]]);
  assert.equal(two.packages.pkg.floor.score, 75);
  assert.deepEqual(two.packages.pkg.floor.runs, ["run-1", "run-2", "run-3"]);
  assert.equal(two.packages.pkg.floor.detected.length, 3);
  assert.equal(two.packages.pkg.readings.length, 3);
});

test("a run counts once: the same label folded again refuses, so one nightly never stands as three", () => {
  const base = foldReadings({ packages: {} }, "pkg", [["run-1", readReading(steady())]]);
  assert.throws(() => foldReadings(base, "pkg", [["run-1", readReading(steady())]]), /run-1 already counted/);
  assert.throws(() => foldReadings({ packages: {} }, "pkg", [["run-2", readReading(steady())], ["run-2", readReading(steady())]]), /run-2 already counted/);
});

test("readings that differ stand no floor; a later run of three equal ones does", () => {
  const moved = report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Timeout", 3), mutant(4, "Survived", 4)]);
  const base = foldReadings({ packages: {} }, "pkg", [["r1", readReading(steady())], ["r2", readReading(moved)], ["r3", readReading(steady())]]);
  assert.equal(base.packages.pkg.floor, null);
  const later = foldReadings(base, "pkg", [["r4", readReading(steady())], ["r5", readReading(steady())]]);
  assert.equal(later.packages.pkg.floor.score, 75);
  assert.deepEqual(later.packages.pkg.floor.runs, ["r3", "r4", "r5"]);
});

test("a floor only rises: three equal readings under a standing floor leave it where it stands", () => {
  const stood = foldReadings({ packages: {} }, "pkg", [["r1", readReading(steady())], ["r2", readReading(steady())], ["r3", readReading(steady())]]);
  const lower = report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Timeout", 3), mutant(4, "Survived", 4)]);
  const after = foldReadings(stood, "pkg", [["r4", readReading(lower)], ["r5", readReading(lower)], ["r6", readReading(lower)]]);
  assert.equal(after.packages.pkg.floor.score, 75);
  assert.deepEqual(after.packages.pkg.floor.runs, ["r1", "r2", "r3"]);
});

test("with no floor the check reports and names how many equal readings it still waits on", () => {
  const base = foldReadings({ packages: {} }, "pkg", [["r1", readReading(steady())]]);
  const v = checkReading(base, "pkg", readReading(steady()));
  assert.equal(v.red.length, 0);
  assert.match(v.lines.join("\n"), /advisory: no floor stands for pkg; it waits on 2 more equal readings/);
});

test("under a floor, a lower score reads red and so does each floor-killed mutant that now survives", () => {
  const stood = foldReadings({ packages: {} }, "pkg", [["r1", readReading(steady())], ["r2", readReading(steady())], ["r3", readReading(steady())]]);
  const cut = report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Timeout", 3), mutant(4, "Survived", 4)]);
  const v = checkReading(stood, "pkg", readReading(cut));
  assert.equal(v.red.length, 2);
  assert.match(v.red.join("\n"), /score 50 under the floor's 75/);
  assert.match(v.red.join("\n"), /src\/a\.ts:2:3:ConditionalExpression:true .* the floor's run killed it, this run lets it through/);
});

test("containment holds a score that stays level: one kill traded for another still reads red", () => {
  const stood = foldReadings({ packages: {} }, "pkg", [["r1", readReading(steady())], ["r2", readReading(steady())], ["r3", readReading(steady())]]);
  const traded = report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Timeout", 3), mutant(4, "Killed", 4)]);
  const v = checkReading(stood, "pkg", readReading(traded));
  assert.equal(v.red.length, 1);
  assert.match(v.red[0], /src\/a\.ts:2:3/);
});

test("a floor-killed mutant the source no longer yields reads as moved, counted, never as a kill", () => {
  const stood = foldReadings({ packages: {} }, "pkg", [["r1", readReading(steady())], ["r2", readReading(steady())], ["r3", readReading(steady())]]);
  const refactored = report([mutant(1, "Killed", 1), mutant(3, "Timeout", 3), mutant(4, "Killed", 4), mutant(5, "Killed", 5)]);
  const v = checkReading(stood, "pkg", readReading(refactored));
  assert.equal(v.red.length, 0);
  assert.match(v.lines.join("\n"), /1 floor-killed mutant\(s\) the source no longer yields/);
});

test("the CLI folds labelled reports into a baseline, then checks a report against it, red on a breach", () => {
  const d = dir();
  const baseline = join(d, "baseline.json");
  writeFileSync(baseline, JSON.stringify({ packages: {} }));
  for (const n of [1, 2, 3]) writeFileSync(join(d, `r${n}.json`), JSON.stringify(steady()));
  const fold = spawnSync("node", [TOOL, "fold", "pkg", `run-1=${join(d, "r1.json")}`, `run-2=${join(d, "r2.json")}`, `run-3=${join(d, "r3.json")}`, "--baseline", baseline], { encoding: "utf8" });
  assert.equal(fold.status, 0, fold.stdout + fold.stderr);
  assert.match(fold.stdout, /the floor stands for pkg at 75/);
  assert.equal(JSON.parse(readFileSync(baseline, "utf8")).packages.pkg.floor.score, 75);
  writeFileSync(join(d, "cut.json"), JSON.stringify(report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Timeout", 3), mutant(4, "Survived", 4)])));
  const red = spawnSync("node", [TOOL, "check", "pkg", join(d, "cut.json"), "--baseline", baseline], { encoding: "utf8" });
  assert.equal(red.status, 1, red.stdout + red.stderr);
  const green = spawnSync("node", [TOOL, "check", "pkg", join(d, "r1.json"), "--baseline", baseline], { encoding: "utf8" });
  assert.equal(green.status, 0, green.stdout + green.stderr);
});

test("the CLI reads a missing or silent report as red, never as a pass", () => {
  const d = dir();
  const baseline = join(d, "baseline.json");
  writeFileSync(baseline, JSON.stringify({ packages: {} }));
  writeFileSync(join(d, "empty.json"), JSON.stringify({ files: {} }));
  const silent = spawnSync("node", [TOOL, "check", "pkg", join(d, "empty.json"), "--baseline", baseline], { encoding: "utf8" });
  assert.equal(silent.status, 1);
  assert.match(silent.stdout + silent.stderr, /SilentReport/);
  const missing = spawnSync("node", [TOOL, "check", "pkg", join(d, "nowhere.json"), "--baseline", baseline], { encoding: "utf8" });
  assert.equal(missing.status, 1);
});

test("the house baseline names the lares-cli pilot and its Stryker config", () => {
  const house = JSON.parse(readFileSync(fileURLToPath(new URL("./mutation-baseline.json", import.meta.url)), "utf8"));
  assert.equal(house.packages["lares-cli"].config, "packages/lares-cli/stryker.config.json");
  assert.ok(Array.isArray(house.packages["lares-cli"].readings));
});
