#!/usr/bin/env node
/**
 * held-out-cells — the cells the held-out workflow runs, and the one verdict a run of them hands back.
 *
 * ── ONE TABLE, THREE READERS ────────────────────────────────────────────────────────────────────
 * `.github/workflows/held-out.yml` runs one hosted job per CELL. A driver that walks independent
 * scenarios unfolds into one cell per scenario; a driver that reads whole stays one cell. The workflow
 * writes no cell by hand: its `plan` job prints this tool's `matrix`, its merge job reads the same
 * matrix back, and `tools/held-out-steps.mjs` (the local reader) asks this module for it. A scenario a
 * hand adds to `tools/mesh-scenarios.sh` gains its cell on the next run, and a cell that never answers
 * reads red by name.
 *
 * ── THE MERGE FAILS CLOSED ──────────────────────────────────────────────────────────────────────
 * Each cell records its own verdict file (`record`) once its driver exits. `merge-verify` holds every
 * recorded verdict against the matrix: a cell with no verdict (its job died, timed out or never
 * started), a red cell, a verdict for another head and a verdict no cell owns each read red, each by
 * name. It prints one `HELD-OUT-DRIVER:` line per driver and one `HELD-OUT-VERIFY:` line for the run.
 *
 *   node tools/held-out-cells.mjs matrix                     print `matrix=<json>` (a `$GITHUB_OUTPUT` line)
 *   node tools/held-out-cells.mjs cells                      print one cell per line
 *   node tools/held-out-cells.mjs record --dir <d> --cell <slug> --status <n> --seconds <n> --head <sha>
 *   node tools/held-out-cells.mjs merge-verify --artifacts-dir <d> --head <sha>
 * Exit: 0 every cell green · 1 any red, missing or foreign cell · 2 usage.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const VERDICT_FILE = "held-out-verdict.json";

/**
 * The drivers. `image` says the driver's containers run the product image the `image` job built; `mesh`
 * says it stands the mesh compose file, under its own compose project. `seconds` holds a whole driver's
 * measured wall time on a hosted runner; a driver that unfolds reads each cell's time from `unfold`.
 *
 * WHY TWO DRIVERS STAY WHOLE. The crossing matrix and the civic families each walk in under four
 * minutes, most of it the runner's own setup. One cell per scenario would spend a setup per scenario to
 * save seconds, and would spend nine more of the account's concurrent jobs.
 */
export const DRIVERS = [
  { driver: "browser-weld", seconds: 150 },
  { driver: "civic", seconds: 200, image: true },
  { driver: "crossing", seconds: 150, image: true },
  { driver: "herm-mesh", seconds: 120, image: true, mesh: true },
  { driver: "mesh-scenarios", image: true, mesh: true, unfold: "tools/mesh-scenarios.sh" },
];

/**
 * A cell's job budget, in minutes: three times its measured walk, plus the fixed cost every cell pays before
 * its driver starts (checkout, install, build, the image's download and load, a browser image's first pull).
 * A cell that outruns its budget gets cancelled, records no verdict, and reads red at the merge by name.
 */
export const budgetMinutes = (seconds) => Math.ceil((seconds * 3) / 60) + 12;

/** Parse a scenario script's `--list` answer: `<name> <seconds>` per line. Throws on any other shape. */
export function parseScenarioList(text) {
  const rows = text.split("\n").filter((l) => l.trim() !== "").map((line) => {
    const m = /^([a-z0-9][a-z0-9-]*) ([1-9][0-9]*)$/.exec(line);
    if (!m) throw new Error(`held-out-cells: the scenario list line reads as no <name> <seconds>: ${JSON.stringify(line)}`);
    return { scenario: m[1], seconds: Number(m[2]) };
  });
  if (rows.length === 0) throw new Error("held-out-cells: the scenario list names no scenario");
  const names = rows.map((r) => r.scenario);
  const twice = names.find((n, i) => names.indexOf(n) !== i);
  if (twice) throw new Error(`held-out-cells: the scenario list names "${twice}" twice`);
  return rows;
}

const listScenarios = (script) => execFileSync("bash", [join(ROOT, script), "--list"], { encoding: "utf8" });

/**
 * Every cell, in run order. Flags ride as the strings "true" and "": a workflow condition compares against a
 * string, and a JSON boolean meets a string by number there, so `matrix.mesh == 'true'` over a bare `true`
 * reads false.
 */
export function cellMatrix({ drivers = DRIVERS, list = listScenarios } = {}) {
  const flag = (v) => (v ? "true" : "");
  const cells = [];
  for (const d of drivers) {
    const base = { driver: d.driver, image: flag(d.image), mesh: flag(d.mesh) };
    if (d.unfold) {
      for (const s of parseScenarioList(list(d.unfold))) {
        cells.push({ cell: `${d.driver}-${s.scenario}`, ...base, scenario: s.scenario, timeout_minutes: budgetMinutes(s.seconds) });
      }
    } else {
      cells.push({ cell: d.driver, ...base, scenario: "", timeout_minutes: budgetMinutes(d.seconds) });
    }
  }
  const slugs = cells.map((c) => c.cell);
  const twice = slugs.find((n, i) => slugs.indexOf(n) !== i);
  if (twice) throw new Error(`held-out-cells: two cells share the name "${twice}"`);
  return cells;
}

/** The verdict one cell records: its driver's own exit status and wall time, for one head. */
export function cellVerdict({ cell, status, seconds, head }) {
  if (!Number.isInteger(status) || status < 0) throw new Error(`held-out-cells: status ${JSON.stringify(status)} reads as no exit status`);
  return { schema: "held-out-verdict/v1", cell, ok: status === 0, status, seconds, head };
}

/**
 * Hold the recorded verdicts against the matrix.
 *
 * @param cells     the matrix (`cellMatrix()`)
 * @param verdicts  every verdict file found, parsed; a file that would not parse arrives as `{ unreadable: <path> }`
 * @param head      the head the run measured
 */
export function evaluateMerge({ cells, verdicts, head }) {
  const owned = new Set(cells.map((c) => c.cell));
  const problems = [];
  const byCell = new Map();
  for (const v of verdicts) {
    if (v.unreadable) { problems.push(`unreadable verdict: ${v.unreadable}`); continue; }
    if (!owned.has(v.cell)) { problems.push(`a verdict names "${v.cell}", and no cell of the matrix owns that name`); continue; }
    if (byCell.has(v.cell)) { problems.push(`two verdicts name the cell "${v.cell}"`); continue; }
    if (v.head !== head) { problems.push(`the verdict for "${v.cell}" measured ${String(v.head).slice(0, 9)}, never this head`); continue; }
    byCell.set(v.cell, v);
  }
  const drivers = [];
  for (const c of cells) {
    let row = drivers.find((d) => d.driver === c.driver);
    if (!row) drivers.push(row = { driver: c.driver, cells: 0, green: [], red: [], missing: [], seconds: 0 });
    row.cells++;
    const v = byCell.get(c.cell);
    const label = c.scenario || c.cell;
    if (!v) row.missing.push(label);
    else { (v.ok === true && v.status === 0 ? row.green : row.red).push(label); row.seconds += Number(v.seconds) || 0; }
  }
  for (const d of drivers) d.ok = d.red.length === 0 && d.missing.length === 0;
  const sum = (k) => drivers.reduce((n, d) => n + d[k].length, 0);
  const ok = problems.length === 0 && drivers.length > 0 && drivers.every((d) => d.ok);
  return { ok, head, drivers, cells: cells.length, green: sum("green"), red: sum("red"), missing: sum("missing"), problems };
}

/** The merge as the lines a person and `tools/ci-verdict.mjs` read. */
export function renderMerge(m) {
  const lines = m.drivers.map((d) => `HELD-OUT-DRIVER: ${d.driver} ok=${d.ok} cells=${d.green.length}/${d.cells} seconds=${d.seconds}`
    + (d.red.length ? ` red=${d.red.join(",")}` : "") + (d.missing.length ? ` missing=${d.missing.join(",")}` : ""));
  for (const p of m.problems) lines.push(`HELD-OUT-PROBLEM: ${p}`);
  lines.push(`HELD-OUT-VERIFY: ok=${m.ok} drivers=${m.drivers.length} cells=${m.cells} green=${m.green} red=${m.red} missing=${m.missing} head=${m.head}`);
  return lines;
}

/** Every verdict file under a directory of downloaded artifacts, at any depth. */
export function collectVerdicts(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((rel) => rel === VERDICT_FILE || rel.endsWith(`/${VERDICT_FILE}`))
    .sort()
    .map((rel) => {
      try { return JSON.parse(readFileSync(join(dir, rel), "utf8")); } catch { return { unreadable: rel }; }
    });
}

function main(argv) {
  const [verb, ...rest] = argv;
  const opt = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
  switch (verb) {
    case "matrix":
      console.log(`matrix=${JSON.stringify({ include: cellMatrix() })}`);
      return 0;
    case "cells":
      for (const c of cellMatrix()) console.log(`${c.cell}\t${c.timeout_minutes}m`);
      return 0;
    case "record": {
      const dir = opt("dir"), cell = opt("cell"), head = opt("head");
      const status = Number(opt("status")), seconds = Number(opt("seconds"));
      if (!dir || !cell || !head || !Number.isInteger(status) || !Number.isFinite(seconds)) break;
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, VERDICT_FILE), `${JSON.stringify(cellVerdict({ cell, status, seconds, head }), null, 2)}\n`);
      return 0;
    }
    case "merge-verify": {
      const dir = opt("artifacts-dir"), head = opt("head");
      if (!dir || !head) break;
      const merged = evaluateMerge({ cells: cellMatrix(), verdicts: collectVerdicts(dir), head });
      console.log(renderMerge(merged).join("\n"));
      return merged.ok ? 0 : 1;
    }
    default:
  }
  console.error("usage: held-out-cells.mjs matrix | cells | record --dir <d> --cell <slug> --status <n> --seconds <n> --head <sha> | merge-verify --artifacts-dir <d> --head <sha>");
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
