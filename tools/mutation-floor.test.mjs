// mutation-floor.test — the reading a Stryker report yields, the floor three equal readings stand, and the check
// that holds a later report to the floor's score and kill set; synthetic reports, no Stryker run here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkReading, digestOf, foldReadings, MAX_TIMEOUT_SHARE, mutantKey, readReading, SilentReport } from "./mutation-floor.mjs";

const TOOL = fileURLToPath(new URL("./mutation-floor.mjs", import.meta.url));
const dir = () => mkdtempSync(join(tmpdir(), "mutation-floor-"));

const mutant = (id, status, line, mutatorName = "ConditionalExpression", replacement = "true") => ({
  id: String(id), mutatorName, replacement, status, testsCompleted: status === "NoCoverage" ? 0 : 1,
  location: { start: { line, column: 3 }, end: { line, column: 9 } },
});
const report = (mutants, run, file = "src/a.ts") => ({ ...(run === undefined ? {} : { actionsRun: run }), files: { [file]: { language: "typescript", source: "", mutants } } });
const steady = (run) => report([mutant(1, "Killed", 1), mutant(2, "Killed", 2), mutant(3, "Killed", 3), mutant(4, "Survived", 4)], run);
const lowered = (run) => report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Killed", 3), mutant(4, "Survived", 4)], run);
/** Fold [run, make] pairs: each report carries the run that made it, as the nightly stamps it. */
const fold = (base, pairs) => foldReadings(base, "pkg", pairs.map(([run, make]) => [run, readReading(make(run))]));
const stood = () => fold({ packages: {} }, [["101", steady], ["102", steady], ["103", steady]]);

test("a reading scores kills alone over valid; a timeout counts apart and never as a kill", () => {
  const r = readReading(report([
    mutant(1, "Killed", 1), mutant(2, "Timeout", 2), mutant(3, "Survived", 3), mutant(4, "NoCoverage", 4),
    mutant(5, "CompileError", 5), mutant(6, "Ignored", 6),
  ]));
  assert.deepEqual({ mutants: r.mutants, killed: r.killed, timeout: r.timeout, survived: r.survived, noCoverage: r.noCoverage, errors: r.errors, ignored: r.ignored },
    { mutants: 6, killed: 1, timeout: 1, survived: 1, noCoverage: 1, errors: 1, ignored: 1 });
  assert.equal(r.score, 25);
  assert.equal(r.timeoutShare, 0.25);
  assert.deepEqual(r.detected, [mutantKey("src/a.ts", mutant(1, "Killed", 1))]);
  assert.ok(r.undetected.includes(mutantKey("src/a.ts", mutant(2, "Timeout", 2))));
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
  const one = fold({ packages: {} }, [["101", steady], ["102", steady]]);
  assert.equal(one.packages.pkg.floor, null);
  const two = fold(one, [["103", steady]]);
  assert.equal(two.packages.pkg.floor.score, 75);
  assert.deepEqual(two.packages.pkg.floor.runs, ["101", "102", "103"]);
  assert.equal(two.packages.pkg.floor.detected.length, 3);
  assert.equal(two.packages.pkg.readings.length, 3);
});

test("a run counts once: the same label folded again refuses, so one nightly never stands as three", () => {
  const base = fold({ packages: {} }, [["101", steady]]);
  assert.throws(() => fold(base, [["101", steady]]), /101 already counted/);
  assert.throws(() => fold({ packages: {} }, [["102", steady], ["102", steady]]), /102 already counted/);
});

test("a label evicted from the kept readings stays counted, so an old run never folds in again", () => {
  const base = fold({ packages: {} }, [["101", lowered], ["102", steady], ["103", steady], ["104", steady]]);
  assert.deepEqual(base.packages.pkg.readings.map((r) => r.run), ["102", "103", "104"]);
  assert.throws(() => fold(base, [["101", steady]]), /101 already counted/);
});

test("a fold label reads a numeric Actions run id, and the report must carry that same run inside it", () => {
  assert.throws(() => fold({ packages: {} }, [["run-1", steady]]), /run-1 names no Actions run id/);
  assert.throws(() => foldReadings({ packages: {} }, "pkg", [["101", readReading(steady())]]), /carries no run/);
  assert.throws(() => foldReadings({ packages: {} }, "pkg", [["101", readReading(steady("999"))]]), /carries run 999, not 101/);
});

test("readings that differ stand no floor; a later run of three equal ones does", () => {
  const base = fold({ packages: {} }, [["101", steady], ["102", lowered], ["103", steady]]);
  assert.equal(base.packages.pkg.floor, null);
  const later = fold(base, [["104", steady], ["105", steady]]);
  assert.equal(later.packages.pkg.floor.score, 75);
  assert.deepEqual(later.packages.pkg.floor.runs, ["103", "104", "105"]);
});

test("a floor only rises: three equal readings under a standing floor leave it where it stands", () => {
  const after = fold(stood(), [["104", lowered], ["105", lowered], ["106", lowered]]);
  assert.equal(after.packages.pkg.floor.score, 75);
  assert.deepEqual(after.packages.pkg.floor.runs, ["101", "102", "103"]);
});

test("a stalled run never counts: a fold refuses a reading whose timeout share passes the named limit", () => {
  const stalled = (run) => report([mutant(1, "Killed", 1), mutant(2, "Timeout", 2), mutant(3, "Killed", 3), mutant(4, "Survived", 4)], run);
  assert.throws(() => fold({ packages: {} }, [["101", stalled]]), /timeout share 0\.25 passes the limit/);
});

test("with no floor the check reports and names how many equal readings it still waits on", () => {
  const base = fold({ packages: {} }, [["101", steady]]);
  const v = checkReading(base, "pkg", readReading(steady()));
  assert.equal(v.red.length, 0);
  assert.match(v.lines.join("\n"), /advisory: no floor stands for pkg; it waits on 2 more equal readings/);
});

test("a timeout share past the limit reads red, floor or none: a stalled runner never reads green", () => {
  assert.ok(MAX_TIMEOUT_SHARE > 0 && MAX_TIMEOUT_SHARE < 0.25);
  const stalled = report([mutant(1, "Killed", 1), mutant(2, "Timeout", 2), mutant(3, "Killed", 3), mutant(4, "Survived", 4)]);
  assert.match(checkReading({ packages: {} }, "pkg", readReading(stalled)).red.join("\n"), /timeout share 0\.25 passes the limit/);
  assert.match(checkReading(stood(), "pkg", readReading(stalled)).red.join("\n"), /timeout share 0\.25 passes the limit/);
});

test("under a floor, a floor-killed mutant that now times out reads as let through, never as kept", () => {
  const many = Array.from({ length: 200 }, (_, i) => mutant(10 + i, "Killed", 10 + i));
  const make = (run, two = "Killed") => report([mutant(1, "Killed", 1), mutant(2, two, 2), ...many], run);
  const base = fold({ packages: {} }, [["101", make], ["102", make], ["103", make]]);
  const v = checkReading(base, "pkg", readReading(make(undefined, "Timeout")));
  assert.match(v.red.join("\n"), /src\/a\.ts:2:3:ConditionalExpression:true .* this run lets it through/);
});

test("under a floor, a lower score reads red and so does each floor-killed mutant that now survives", () => {
  const v = checkReading(stood(), "pkg", readReading(lowered()));
  assert.equal(v.red.length, 2);
  assert.match(v.red.join("\n"), /score 50 under the floor's 75/);
  assert.match(v.red.join("\n"), /src\/a\.ts:2:3:ConditionalExpression:true .* the floor's run killed it, this run lets it through/);
});

test("containment holds a score that stays level: one kill traded for another still reads red", () => {
  const traded = report([mutant(1, "Killed", 1), mutant(2, "Survived", 2), mutant(3, "Killed", 3), mutant(4, "Killed", 4)]);
  const v = checkReading(stood(), "pkg", readReading(traded));
  assert.equal(v.red.length, 1);
  assert.match(v.red[0], /src\/a\.ts:2:3/);
});

test("a floor-killed mutant the source stops yielding reads as moved, counted, never as a kill", () => {
  const refactored = report([mutant(1, "Killed", 1), mutant(3, "Killed", 3), mutant(4, "Killed", 4), mutant(5, "Killed", 5)]);
  const v = checkReading(stood(), "pkg", readReading(refactored));
  assert.equal(v.red.length, 0);
  assert.match(v.lines.join("\n"), /1 floor-killed mutant\(s\) the source stops yielding/);
});

test("the check re-derives the floor's digest from its kill set and refuses a floor whose keys were edited", () => {
  const base = stood();
  assert.equal(base.packages.pkg.floor.detectedDigest, digestOf(base.packages.pkg.floor.detected));
  base.packages.pkg.floor.detected = base.packages.pkg.floor.detected.slice(1);
  const v = checkReading(base, "pkg", readReading(steady()));
  assert.equal(v.red.length, 1);
  assert.match(v.red[0], /the floor's kill set does not match its digest/);
});

test("the CLI folds labelled reports into a baseline, then checks a report against it, red on a breach", () => {
  const d = dir();
  const baseline = join(d, "baseline.json");
  writeFileSync(baseline, JSON.stringify({ packages: {} }));
  for (const n of ["101", "102", "103"]) writeFileSync(join(d, `${n}.json`), JSON.stringify(steady(n)));
  const folded = spawnSync("node", [TOOL, "fold", "pkg", ...["101", "102", "103"].map((n) => `${n}=${join(d, `${n}.json`)}`), "--baseline", baseline], { encoding: "utf8" });
  assert.equal(folded.status, 0, folded.stdout + folded.stderr);
  assert.match(folded.stdout, /the floor stands for pkg at 75/);
  assert.equal(JSON.parse(readFileSync(baseline, "utf8")).packages.pkg.floor.score, 75);
  writeFileSync(join(d, "cut.json"), JSON.stringify(lowered()));
  const red = spawnSync("node", [TOOL, "check", "pkg", join(d, "cut.json"), "--baseline", baseline], { encoding: "utf8" });
  assert.equal(red.status, 1, red.stdout + red.stderr);
  const green = spawnSync("node", [TOOL, "check", "pkg", join(d, "101.json"), "--baseline", baseline], { encoding: "utf8" });
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
