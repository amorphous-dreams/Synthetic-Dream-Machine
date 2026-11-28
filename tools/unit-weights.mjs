#!/usr/bin/env node
/**
 * unit-weights — the seconds table every bench tiers by (`tools/unit-weights.json`: `{ <package dir>: { <file under it>: seconds } }`).
 * A file the table measures under SWIFT_SECONDS rides every bench's swift tier; a file it never measured rides it too.
 *
 *   node tools/unit-weights.mjs --weigh <vitest-report-dir> [--run <id>]   re-measure the table off a green CI run's test-cell artifacts
 *
 * It reads JSON reports and writes one file: no build, no test, so it runs anywhere, off the floor.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_CELLS } from "./ci-cells.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const WEIGHTS_FILE = join(ROOT, "tools/unit-weights.json");
/** A file the table measures under this many seconds rides the swift tier of every bench. */
export const SWIFT_SECONDS = 5;

/** The vitest packages: CI's test-cell table, the one roster (a package without vitest writes no weights). */
export const PACKAGES = Object.freeze([...new Map(TEST_CELLS.flatMap((c) => c.packages).filter((p) => p.vitest !== false).map((p) => [p.dir, p])).values()].map((p) => p.dir).sort());

export const isE2e = (f) => /(^|\/)e2e\//.test(f);

export function readWeights(file = WEIGHTS_FILE) {
  const all = JSON.parse(readFileSync(file, "utf8"));
  return Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith("_")));
}

/** Re-measures the weights table from vitest JSON reports (a green CI run's test-cell artifacts). */
export function weigh(reports, note) {
  const files = [];
  for (const r of reports) for (const t of r.testResults ?? []) if (Number.isFinite(t.endTime - t.startTime)) files.push([t.name, (t.endTime - t.startTime) / 1000]);
  if (files.length === 0) throw new Error("unit-weights: the reports hold no timed file");
  // The checkout root every report shares: the longest common directory prefix of all the names.
  let prefix = files[0][0].slice(0, files[0][0].lastIndexOf("/") + 1);
  for (const [n] of files) while (!n.startsWith(prefix)) prefix = prefix.slice(0, prefix.slice(0, -1).lastIndexOf("/") + 1);
  const out = { _measured: note };
  for (const [abs, secs] of files) {
    const rel = abs.slice(prefix.length);
    const dir = PACKAGES.filter((d) => rel.startsWith(`${d}/`)).sort((a, b) => b.length - a.length)[0];
    if (!dir) continue;
    const f = rel.slice(dir.length + 1);
    if (isE2e(f)) continue;
    (out[dir] ??= {})[f] = Math.max(out[dir][f] ?? 0, Math.round(secs * 10) / 10);
  }
  for (const dir of PACKAGES) if (out[dir]) out[dir] = Object.fromEntries(Object.entries(out[dir]).sort(([a], [b]) => (a < b ? -1 : 1)));
  return out;
}

export function reportsIn(dir) {
  const found = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/^report-.*\.json$/.test(n)) found.push(JSON.parse(readFileSync(p, "utf8"))); } };
  walk(dir);
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] !== "--weigh" && args[i] !== "--run") { console.error(`unit-weights: unknown argument ${args[i]}\nusage: node tools/unit-weights.mjs --weigh <vitest-report-dir> [--run <id>]`); process.exit(2); }
    if (!args[i + 1]) { console.error(`unit-weights: ${args[i]} wants a value`); process.exit(2); }
  }
  if (!flag("--weigh")) { console.error("usage: node tools/unit-weights.mjs --weigh <vitest-report-dir> [--run <id>]"); process.exit(2); }
  const table = weigh(reportsIn(flag("--weigh")), `CI run ${flag("--run") ?? "?"}: seconds per file off the test cells' vitest JSON reports (endTime - startTime); a file under ${SWIFT_SECONDS} s rides every bench's swift tier`);
  writeFileSync(WEIGHTS_FILE, `${JSON.stringify(table, null, 1)}\n`);
  console.log(`unit-weights: wrote ${relative(ROOT, WEIGHTS_FILE)} (${PACKAGES.filter((d) => table[d]).map((d) => `${d} ${Object.keys(table[d]).length}`).join(", ")})`);
}
