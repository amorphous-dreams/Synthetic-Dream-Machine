#!/usr/bin/env node
/**
 * bench-gate — the one command a spirit runs in its own bench before it hands back (ruling/2026-11-25-branches-not-prs):
 * the cheap, deterministic laws that read the SUM of lanes, run on the lane with develop merged in.
 *
 *   node tools/bench-gate.mjs [--list] [--base <ref>]
 *   node tools/bench-gate.mjs --weigh <vitest-report-dir> [--run <id>]   (re-measure tools/unit-weights.json)
 *
 * ── THE STEPS (research/test-corpus-mu, "the bench gate") ────────────────────────────────────────
 *   merge-develop   the bench holds `origin/develop` (fetched now): the gate reads the sum, never the lane alone
 *   build           `pnpm build`: every package built and the source digest stamped (the suites' dist guard reads it)
 *   witnesses-fast  `witness-all.sh --fast`: the static fleet without docker or the slow three; typecheck-witness and
 *                   typecheck-tests-witness (the tests ratchet) ride it, so no second typecheck runs
 *   carrier-pins    `rite-walk.mjs --bind`
 *   tool-tests      every `tools/*.test.mjs` but the VESSEL ones, which stand real houses and ride CI
 *   swift-<pkg>     each package's files the weights table measures under SWIFT_SECONDS (and every file it never measured)
 *   heavy-<pkg>     the rest of each package the lane's diff touches (e2e aside: it rides CI after the merge)
 * merge-develop and build stop the gate when red: every later step would read a tree that is not the sum. Past them every
 * step runs, none short-circuits, and the last line carries ONE verdict with the wall time, the line a hand-back quotes:
 *   BENCH GATE GREEN at <sha> over develop <sha> · <n> steps · <s> s
 *   BENCH GATE REFUSES: <step> (exit n), ... · <s> s           (exit 1; a usage fault exits 2)
 * When the lane's diff touches the security class (tools/security-class-paths.json, read from develop's tree) either verdict
 * line ends ` · COLD READ OWED: <paths>`, and one more line follows it, the one the familiar quotes in the --no-ff merge message:
 *   cold-read: owed · head <sha> · paths <n> · record-hash <sha256 of head, then each path, newline-joined>
 * The familiar's cold Opus read of that head files its record under that hash; the merge message carries `Cold-Read: <hash>`.
 * The matcher lives in the wiki (packages/lararium-tw5/src/filters/security-class.ts): the host reads the git diff and asks
 * `lares wiki filter` through the doors; where the doors stand dark the same module's built form answers in-process.
 * It stands as a spirit's own step, never a git hook.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_CELLS } from "./ci-cells.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const WEIGHTS_FILE = join(ROOT, "tools/unit-weights.json");
/** A file the table measures under this many seconds rides the swift tier of every bench. */
export const SWIFT_SECONDS = 5;

/** Self-tests that stand real vessels (measured in CI run 45587908073's witness cell: together about 1,100 of 2,096
 *  test-seconds). The bench leaves them to CI; every other `tools/*.test.mjs` runs here. */
export const VESSEL = Object.freeze([
  "census-drill.test.mjs", // P2 two real houses 272 s, a face born after the stand 54 s
  "house-keep.test.mjs", // the keep rite 229 s
  "keep-cold.test.mjs", // W2 170 s, W1 134 s
  "vault-restore-door.test.mjs", // a face cut restores onto a fresh vessel 153 s
  "custody-door.test.mjs", // the custody door opens the vessel key 137 s
  "floor-unlock-door.test.mjs", // the floor stands over the marker's user wiki 82 s
  "vault-backup-door.test.mjs", // a standing vessel cuts one face's backup bundle 54 s
  "two-phase-boot.test.mjs", // a composition tears down off its floor 54 s
]);

/** The vitest packages: CI's test-cell table, the one roster (a package without vitest writes no weights). */
export const PACKAGES = Object.freeze([...new Map(TEST_CELLS.flatMap((c) => c.packages).filter((p) => p.vitest !== false).map((p) => [p.dir, p])).values()].map((p) => p.dir).sort());

const isE2e = (f) => /(^|\/)e2e\//.test(f);

/** Every test file a package's tree holds (relative to the package), e2e aside. */
export function treeTests(dir, root = ROOT) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, dir, rel);
    if (!existsSync(abs)) return;
    for (const name of readdirSync(abs)) {
      if (name === "node_modules" || name === "dist") continue;
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(join(abs, name)).isDirectory()) walk(r);
      else if (/\.test\.[cm]?[jt]sx?$/.test(name) && !isE2e(r)) out.push(r);
    }
  };
  // The harness package IS `tests/`: its unit files sit under `harness/` (its config's include); every other package
  // keeps them under `tests/` and `src/`.
  if (dir === "tests") walk("harness");
  else { walk("tests"); walk("src"); }
  return out.sort();
}

/** Splits a package's files by measured weight: swift (under SWIFT_SECONDS, or never measured: a new file rides the bench) and heavy. */
export function tiers(files, weights = {}) {
  const swift = [], heavy = [];
  for (const f of files) ((weights[f] ?? 0) < SWIFT_SECONDS ? swift : heavy).push(f);
  return { swift, heavy };
}

/** The packages a diff touches, by path (a dependent package rides its swift tier here and its whole run in CI). */
export function touchedPackages(paths, packages = PACKAGES) {
  const hit = new Set();
  for (const p of paths) for (const dir of packages) if (p === dir || p.startsWith(`${dir}/`)) hit.add(dir);
  return [...hit].sort();
}

/** The vitest command a package's own `test` script names, with the files appended. */
export function vitestStep(name, dir, files, root = ROOT) {
  const script = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")).scripts?.test ?? "";
  const words = script.trim().split(/\s+/);
  if (words[0] !== "vitest" || words[1] !== "run") throw new Error(`bench-gate: ${dir}'s test script reads "${script}", not a plain vitest run`);
  return { name, cmd: "npx", args: [...words, ...files], cwd: dir };
}

/** The whole plan for a bench: the fixed steps, then the swift tier of every package and the heavy files of the touched ones. */
export function plan({ weights = readWeights(), touched = [], root = ROOT } = {}) {
  const tools = readdirSync(join(root, "tools")).filter((f) => f.endsWith(".test.mjs") && !VESSEL.includes(f)).sort().map((f) => `tools/${f}`);
  const steps = [
    { name: "merge-develop", stop: true, check: "develop" },
    { name: "build", stop: true, cmd: "pnpm", args: ["build"], cwd: "." },
    { name: "witnesses-fast", cmd: "bash", args: ["tools/witness-all.sh", "--fast"], cwd: "." },
    { name: "carrier-pins", cmd: "node", args: ["tools/rite-walk.mjs", "--bind"], cwd: "." },
    { name: "tool-tests", cmd: "node", args: ["--test", ...tools], cwd: "." },
  ];
  const slug = (dir) => dir.split("/").pop();
  for (const dir of PACKAGES) {
    const { swift } = tiers(treeTests(dir, root), weights[dir]);
    if (swift.length) steps.push(vitestStep(`swift-${slug(dir)}`, dir, swift, root));
  }
  for (const dir of touched) {
    const { heavy } = tiers(treeTests(dir, root), weights[dir]);
    if (heavy.length) steps.push(vitestStep(`heavy-${slug(dir)}`, dir, heavy, root));
  }
  return steps;
}

export function readWeights(file = WEIGHTS_FILE) {
  const all = JSON.parse(readFileSync(file, "utf8"));
  return Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith("_")));
}

export const SECURITY_CLASS_FILE = "tools/security-class-paths.json";

/** The paths a `git diff --no-renames --raw -z` answer names (each record: `:modes shas status NUL path NUL`). */
export function parseRawZ(out) {
  const f = out.split("\0");
  const paths = [];
  for (let i = 0; i + 1 < f.length; i += 2) if (f[i].startsWith(":")) paths.push(f[i + 1]);
  return paths;
}

/** The record hash the familiar quotes: SHA-256 of the head, then each owed path, newline-joined. */
export const coldReadHash = (head, paths) => createHash("sha256").update([head, ...paths].join("\n")).digest("hex");

/** The security class's own answer over a diff's paths: the wiki door first (the matcher lives there), the module's built
 *  form in-process where the doors stand dark; the one list rides both, read by the caller from develop's tree. */
export function coldReadOwed(paths, listJson, { door = askDoor, local = askLocal } = {}) {
  if (paths.length === 0) return [];
  try { return door(paths, listJson); } catch { return local(paths, listJson); }
}

function askDoor(paths, listJson) {
  if (paths.some((p) => /[\][\n]/.test(p))) throw new Error("a path the filter cannot carry");
  const filter = `${paths.map((p) => `[[${p}]]`).join(" ")} +[security-class[${encodeURIComponent(JSON.stringify(JSON.parse(listJson)))}]]`;
  const r = spawnSync(process.env.LARES_BIN ? "node" : "lares", [...(process.env.LARES_BIN ? [process.env.LARES_BIN] : []), "wiki", "filter", filter, "--recipe", "default", "--all", "--fields", "title"], { cwd: ROOT, encoding: "utf8", input: "" });
  if (r.status !== 0) throw new Error(`the wiki door stands dark: ${r.stderr.trim()}`);
  const answered = r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  return paths.filter((p) => answered.includes(p));
}

function askLocal(paths, listJson) {
  const built = join(ROOT, "packages/lararium-tw5/dist/filters/security-class.js");
  if (!existsSync(built)) throw new Error(`bench-gate: the doors stand dark and ${relative(ROOT, built)} stands unbuilt; run \`pnpm build\``);
  const { readSecurityClass, securityClassPaths } = createRequire(import.meta.url)(built);
  return securityClassPaths(paths, readSecurityClass(JSON.parse(listJson)));
}

/** Runs every step through `run(step) -> exit code`; a red `stop` step ends the run. Returns { code, red, line }. */
export function runGate(steps, run, say = console.log, { head = "", base = "", clock = () => performance.now(), cold = [], hash = "" } = {}) {
  const red = [];
  const t0 = clock();
  for (const s of steps) {
    const t = clock();
    say(`── gate step ${s.name} ──`);
    const rc = run(s);
    say(`── ${s.name}: ${rc === 0 ? "ok" : `RED exit ${rc}`} (${((clock() - t) / 1000).toFixed(1)} s) ──`);
    if (rc !== 0) {
      red.push(`${s.name} (exit ${rc})`);
      if (s.stop) { say(`── ${s.name} stops the gate: every later step would read a tree that is not the sum ──`); break; }
    }
  }
  const secs = `${Math.round((clock() - t0) / 1000)} s`;
  const line = red.length
    ? `BENCH GATE REFUSES: ${red.join(", ")} · ${secs}`
    : `BENCH GATE GREEN at ${head || "?"} over develop ${base || "?"} · ${steps.length} steps · ${secs}`;
  const owed = cold.length ? ` · COLD READ OWED: ${cold.join(", ")}` : "";
  say(line + owed);
  if (cold.length) say(`cold-read: owed · head ${head || "?"} · paths ${cold.length} · record-hash ${hash}`);
  if (red.length) say("pono: cure each named step's finding (a red merge-develop: `git fetch origin && git merge origin/develop`), then run the gate again");
  return { code: red.length ? 1 : 0, red, line: line + owed };
}

const git = (args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });

/** The merge-develop check: fetch develop, then hold the bench to it. */
function checkDevelop(base) {
  const fetched = git(["fetch", "-q", "origin", "develop"]);
  if (fetched.status !== 0) { console.error(`bench-gate: git fetch origin develop refused: ${fetched.stderr.trim()}`); return 1; }
  const held = git(["merge-base", "--is-ancestor", base, "HEAD"]);
  if (held.status === 0) { console.log(`bench-gate: HEAD holds ${base} (${git(["rev-parse", "--short", base]).stdout.trim()})`); return 0; }
  console.error(`bench-gate: HEAD lacks ${base}; merge it in (\`git merge ${base}\`) so the gate reads the sum`);
  return 1;
}

/** Re-measures the weights table from a directory of vitest JSON reports (a green CI run's test-cell artifacts). */
export function weigh(reports, note) {
  const files = [];
  for (const r of reports) for (const t of r.testResults ?? []) if (Number.isFinite(t.endTime - t.startTime)) files.push([t.name, (t.endTime - t.startTime) / 1000]);
  if (files.length === 0) throw new Error("bench-gate: the reports hold no timed file");
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

const reportsIn = (dir) => {
  const found = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/^report-.*\.json$/.test(n)) found.push(JSON.parse(readFileSync(p, "utf8"))); } };
  walk(dir);
  return found;
};

const exec = (s) => spawnSync(s.cmd, s.args, { cwd: join(ROOT, s.cwd), stdio: "inherit", env: process.env }).status ?? 1;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
  const known = new Set(["--list", "--base", "--weigh", "--run"]);
  const valued = new Set(["--base", "--weigh", "--run"]);
  for (let i = 0; i < args.length; i++) {
    if (!known.has(args[i])) { console.error(`bench-gate: unknown argument ${args[i]}`); process.exit(2); }
    if (valued.has(args[i])) { if (!args[i + 1]) { console.error(`bench-gate: ${args[i]} wants a value`); process.exit(2); } i++; }
  }
  if (flag("--weigh")) {
    const table = weigh(reportsIn(flag("--weigh")), `CI run ${flag("--run") ?? "?"}: seconds per file off the test cells' vitest JSON reports (endTime - startTime); a file under ${SWIFT_SECONDS} s rides every bench's swift tier`);
    writeFileSync(WEIGHTS_FILE, `${JSON.stringify(table, null, 1)}\n`);
    console.log(`bench-gate: wrote ${relative(ROOT, WEIGHTS_FILE)} (${PACKAGES.filter((d) => table[d]).map((d) => `${d} ${Object.keys(table[d]).length}`).join(", ")})`);
    process.exit(0);
  }
  const base = flag("--base") ?? "origin/develop";
  const changed = git(["diff", "--name-only", `${base}...HEAD`]);
  const touched = changed.status === 0 ? touchedPackages(changed.stdout.split("\n").filter(Boolean)) : [];
  const steps = plan({ touched });
  if (args.includes("--list")) {
    for (const s of steps) console.log(s.check ? `${s.name}: HEAD holds ${base}` : `${s.name}: ${s.cmd} ${s.args.length > 8 ? `${s.args.slice(0, 4).join(" ")} … (${s.args.length - 4} more)` : s.args.join(" ")} (in ${s.cwd})`);
    process.exit(0);
  }
  const head = git(["rev-parse", "--short", "HEAD"]).stdout.trim();
  // The class reads from develop's tree, never the lane's; the diff is the sum of the lane against develop, renames unfollowed.
  const listed = git(["show", `${base}:${SECURITY_CLASS_FILE}`]);
  const rawDiff = git(["diff", "--no-renames", "--raw", "-z", `${base}..HEAD`]);
  if (listed.status !== 0 || rawDiff.status !== 0) { console.error(`bench-gate: the security class reads ${SECURITY_CLASS_FILE} and the diff of ${base}..HEAD; one refused: ${(listed.stderr || rawDiff.stderr).trim()}`); process.exit(2); }
  const cold = coldReadOwed(parseRawZ(rawDiff.stdout), listed.stdout);
  const full = git(["rev-parse", "HEAD"]).stdout.trim();
  const r = runGate(steps, (s) => (s.check ? checkDevelop(base) : exec(s)), console.log, { head, base: git(["rev-parse", "--short", base]).stdout.trim(), cold, hash: coldReadHash(full, cold) });
  process.exit(r.code);
}
