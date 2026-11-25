#!/usr/bin/env node
/**
 * mutation-floor — gate B's ratchet: a package's mutation floor stands by evidence, and a cut passes kill-set
 * containment against it.
 *
 * A Stryker JSON report yields a READING: each mutant's status counted apart, the score as KILLED over valid, and
 * the set of killed mutants keyed by file, start, operator and replacement (never Stryker's per-run id).
 *
 * NO CLOCK DECIDES A KILL. A Timeout means a wall clock ran out, and whoever owns the runner's clock (or a stalled
 * runner) picks when that happens; so a timeout never raises a score and never joins the killed set. It counts
 * apart, and a timeout share past MAX_TIMEOUT_SHARE reads red in `check` and refuses a fold: a stalled runner
 * reads red, never green.
 *
 * FOLD records readings, each labelled by the numeric GitHub Actions run id that made it; the report carries the
 * same id (`actionsRun`, stamped by the nightly) or the fold refuses. A label counts once, ever: the baseline keeps
 * every counted label, evicted readings' too. When the last three readings agree on every count and on the
 * killed set's digest, the floor stands at their score and keeps that set. A floor only rises.
 *
 * CHECK holds one report to the package's floor. With no floor it reports (advisory) and names how many equal
 * readings it still waits on. Under a floor it first re-derives the digest of the floor's kill set and refuses a
 * mismatch; then a lower score reads red, and so does every mutant the floor killed that this run lets through,
 * a timeout included (kill-set containment: a level score that trades one kill for another still reads red). A
 * floor mutant the source stops yielding reads as moved, counted, never as a kill.
 *
 * Silence never passes: a report with no file, no valid mutant or no test run refuses by name (`SilentReport`).
 *
 * Usage:  node tools/mutation-floor.mjs check <package> <report.json> [--baseline <file>]
 *         node tools/mutation-floor.mjs fold  <package> <actions-run-id>=<report.json> … [--baseline <file>]
 * Exit:   0 green (or advisory) · 1 red, a silent or unreadable report, or a refused fold · 2 usage
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const BASELINE = fileURLToPath(new URL("./mutation-baseline.json", import.meta.url));
const EQUAL_READINGS = 3;
/** The share of valid mutants that may time out before a run reads as stalled (the pilot's first reading: 0.001). */
export const MAX_TIMEOUT_SHARE = 0.01;
const DETECTED = new Set(["Killed"]);
const UNDETECTED = new Set(["Survived", "NoCoverage", "Timeout"]);
const ERRORS = new Set(["CompileError", "RuntimeError"]);

/** A report that carries nothing to measure. */
export class SilentReport extends Error {
  constructor(why) { super(`SilentReport: ${why}; a report that measures nothing never passes`); this.name = "SilentReport"; }
}

export const mutantKey = (file, m) => `${file}:${m.location.start.line}:${m.location.start.column}:${m.mutatorName}:${m.replacement ?? ""}`;

/** The reading a Stryker (mutation-testing-report-schema) JSON report yields. */
export function readReading(report) {
  const files = report && typeof report === "object" && report.files && typeof report.files === "object" ? report.files : null;
  if (!files || Object.keys(files).length === 0) throw new SilentReport("the report names no mutated file");
  const r = { run: typeof report.actionsRun === "string" ? report.actionsRun : null, mutants: 0, killed: 0, timeout: 0, survived: 0, noCoverage: 0, errors: 0, ignored: 0, score: 0, detected: [], undetected: [] };
  let testsRan = 0;
  for (const [file, entry] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    for (const m of entry.mutants ?? []) {
      r.mutants++;
      testsRan += Number(m.testsCompleted ?? 0) + (Array.isArray(m.killedBy) ? m.killedBy.length : 0);
      const key = mutantKey(file, m);
      if (m.status === "Killed") r.killed++;
      else if (m.status === "Timeout") r.timeout++;
      else if (m.status === "Survived") r.survived++;
      else if (m.status === "NoCoverage") r.noCoverage++;
      else if (ERRORS.has(m.status)) r.errors++;
      else r.ignored++;
      if (DETECTED.has(m.status)) r.detected.push(key);
      else if (UNDETECTED.has(m.status)) r.undetected.push(key);
    }
  }
  const valid = r.killed + r.timeout + r.survived + r.noCoverage;
  if (valid === 0) throw new SilentReport(`no valid mutant among ${r.mutants} (errors ${r.errors}, ignored ${r.ignored})`);
  if (testsRan === 0) throw new SilentReport(`no test ran against any of ${valid} valid mutants`);
  r.score = Math.round((r.killed / valid) * 10000) / 100;
  r.timeoutShare = Math.round((r.timeout / valid) * 10000) / 10000;
  r.detected.sort();
  r.undetected.sort();
  r.detectedDigest = digestOf(r.detected);
  return r;
}

const stalled = (r) => r.timeoutShare > MAX_TIMEOUT_SHARE
  ? `timeout share ${r.timeoutShare} passes the limit ${MAX_TIMEOUT_SHARE}: a clock decided ${r.timeout} of the run's mutants, so the run reads as stalled`
  : null;
const COUNTS = ["score", "mutants", "killed", "timeout", "survived", "noCoverage", "errors", "ignored"];
/** The detected set's digest: what a kept reading holds in place of its keys, so three readings compare by content. */
export const digestOf = (keys) => `sha256:${createHash("sha256").update(keys.join("\n")).digest("hex")}`;
const sameReading = (a, b) => COUNTS.every((k) => a[k] === b[k]) && a.detectedDigest === b.detectedDigest;

/** Fold labelled readings into a baseline; returns the next baseline and leaves the given one untouched. */
export function foldReadings(baseline, pkg, labelled) {
  const next = structuredClone(baseline ?? { packages: {} });
  next.packages ??= {};
  const held = next.packages[pkg] ?? { readings: [], floor: null };
  held.readings ??= [];
  held.floor ??= null;
  const latest = new Map();
  const counted = new Set([...(held.counted ?? []), ...held.readings.map((r) => r.run), ...(held.floor?.runs ?? [])]);
  for (const [run, reading] of labelled) {
    if (!/^[1-9][0-9]*$/.test(run)) throw new Error(`mutation-floor: ${run} names no Actions run id; label each report with the numeric run that made it`);
    if (reading.run === null) throw new Error(`mutation-floor: the report for ${run} carries no run; the nightly stamps actionsRun into it`);
    if (reading.run !== run) throw new Error(`mutation-floor: the report labelled ${run} carries run ${reading.run}, not ${run}`);
    if (counted.has(run)) throw new Error(`mutation-floor: ${run} already counted for ${pkg}; a run counts once`);
    const stall = stalled(reading);
    if (stall) throw new Error(`mutation-floor: run ${run}: ${stall}; it never counts toward a floor`);
    counted.add(run);
    held.readings.push({ run, ...reading });
    latest.set(run, reading.detected);
  }
  held.readings = held.readings.slice(-EQUAL_READINGS);
  const last = held.readings;
  if (last.length === EQUAL_READINGS && last.every((r) => sameReading(r, last[0]))) {
    if (latest.has(last.at(-1).run) && (held.floor === null || last[0].score > held.floor.score)) {
      const keys = latest.get(last.at(-1).run);
      held.floor = { score: last[0].score, runs: last.map((r) => r.run), detectedDigest: last[0].detectedDigest, detected: [...keys] };
    }
  }
  // A kept reading holds its counts and its detected set's digest; the keys ride the floor and the report alone.
  held.readings = held.readings.map(({ detected: _d, undetected: _u, ...rest }) => rest);
  held.counted = [...counted];
  next.packages[pkg] = held;
  return next;
}

/** Hold one reading to the package's floor: `red` lists each breach, `lines` the whole account. */
export function checkReading(baseline, pkg, reading) {
  const held = baseline?.packages?.[pkg];
  const lines = [`mutation-floor: ${pkg} reads ${reading.score} (killed ${reading.killed} · timeout ${reading.timeout} · survived ${reading.survived} · no coverage ${reading.noCoverage} · errors ${reading.errors} of ${reading.mutants})`];
  const red = [];
  const stall = stalled(reading);
  if (stall) red.push(stall);
  if (!held?.floor) {
    const agree = (held?.readings ?? []).filter((r) => sameReading(r, reading)).length;
    lines.push(`advisory: no floor stands for ${pkg}; it waits on ${Math.max(0, EQUAL_READINGS - agree)} more equal readings, this one among them (fold each run's report: node tools/mutation-floor.mjs fold ${pkg} <run>=<report.json>)`);
    return { red, lines };
  }
  const floor = held.floor;
  if (digestOf(floor.detected ?? []) !== floor.detectedDigest) {
    red.push(`the floor's kill set does not match its digest (${floor.detectedDigest}); the baseline was edited outside a fold`);
    return { red, lines };
  }
  if (reading.score < floor.score) red.push(`score ${reading.score} under the floor's ${floor.score} (runs ${floor.runs.join(", ")})`);
  const now = new Set(reading.detected);
  const through = new Set(reading.undetected);
  let moved = 0;
  for (const key of floor.detected) {
    if (now.has(key)) continue;
    if (through.has(key)) red.push(`${key} — the floor's run killed it, this run lets it through`);
    else moved++;
  }
  if (moved) lines.push(`${moved} floor-killed mutant(s) the source stops yielding (moved, counted, never a kill)`);
  lines.push(red.length ? `mutation-floor: ${red.length} breach(es) of ${pkg}'s floor` : `mutation-floor: ${pkg} holds its floor of ${floor.score} and every kill it keeps`);
  return { red, lines };
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function main(argv) {
  const at = argv.indexOf("--baseline");
  const baselinePath = at === -1 ? BASELINE : argv[at + 1];
  const args = at === -1 ? argv : [...argv.slice(0, at), ...argv.slice(at + 2)];
  const [verb, pkg, ...rest] = args;
  if (!pkg || (verb !== "check" && verb !== "fold") || rest.length === 0 || !baselinePath) {
    console.log("usage: node tools/mutation-floor.mjs check <package> <report.json> | fold <package> <run>=<report.json> … [--baseline <file>]");
    return 2;
  }
  try {
    const baseline = readJson(baselinePath);
    if (verb === "check") {
      const { red, lines } = checkReading(baseline, pkg, readReading(readJson(rest[0])));
      for (const l of lines) console.log(l);
      for (const r of red) console.log(`  RED  ${r}`);
      return red.length ? 1 : 0;
    }
    const labelled = rest.map((pair) => {
      const eq = pair.indexOf("=");
      if (eq <= 0) throw new Error(`mutation-floor: ${pair} names no run; write <run>=<report.json>`);
      return [pair.slice(0, eq), readReading(readJson(pair.slice(eq + 1)))];
    });
    const next = foldReadings(baseline, pkg, labelled);
    writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    const floor = next.packages[pkg].floor;
    console.log(floor ? `mutation-floor: the floor stands for ${pkg} at ${floor.score} (runs ${floor.runs.join(", ")})` : `mutation-floor: ${pkg} holds ${next.packages[pkg].readings.length} reading(s); no floor stands yet`);
    return 0;
  } catch (err) {
    console.log(err instanceof SilentReport ? err.message : `mutation-floor: ${err.message}`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
