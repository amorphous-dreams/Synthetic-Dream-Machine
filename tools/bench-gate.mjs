#!/usr/bin/env node
/**
 * bench-gate — the cheap, deterministic laws that read the SUM of lanes, run on the lane with develop merged in
 * (ruling/2026-11-25-branches-not-prs). Since mandate/floor-gate-1 only the familiar runs it, on the floor: a tasked spirit
 * hands back a floor ticket naming it, and the familiar runs `node tools/floor-run.mjs --ticket <id> -- node tools/bench-gate.mjs`
 * (outside the floor lock the gate refuses with exit 64; `--list` and `--weigh` read and run anywhere).
 *
 *   node tools/bench-gate.mjs [--list] [--base <ref>]
 *   node tools/bench-gate.mjs --weigh <vitest-report-dir> [--run <id>]   (re-measure tools/unit-weights.json)
 *   node tools/bench-gate.mjs --verdict <file>                           (the keeper's local witness; below)
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
 * It stands as the familiar's step on the floor, never a git hook.
 * The gate decides nothing about the security class: it runs the lane's own code, so the cold-read judge stands apart
 * (`node tools/cold-read-owed.mjs <lane-ref>`, run by the familiar from the landing bench at develop before the merge).
 *
 * ── THE KEEPER'S LOCAL WITNESS (`--verdict <file>`, ruling 2026-11-25-web2-annotates) ─────────────────────────────────────
 * `lares rite kukulu`'s keeper lei step runs the gate over the exact tree the image carries (the checkout at that revision, its
 * tracked tree clean) and writes ONE verdict document to <file>: {kind, v, rev, tree, code, line, steps, secs}, as
 * `JSON.stringify` writes it (the keeper hashes those very bytes). merge-develop drops out: the tree IS the sum the image
 * carries (the rite's own reach guard reads the revision on develop), and no fetch, no web2 service, decides it. No heavy tier
 * runs (no lane diff names one); CI's full run, where it answers, rides beside the vest as annotation alone.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_CELLS } from "./ci-cells.mjs";
import { requireFloor } from "./floor-lock.mjs";

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
export function plan({ weights = readWeights(), touched = [], root = ROOT, verdict = false } = {}) {
  const tools = readdirSync(join(root, "tools")).filter((f) => f.endsWith(".test.mjs") && !VESSEL.includes(f)).sort().map((f) => `tools/${f}`);
  const steps = [
    ...(verdict ? [] : [{ name: "merge-develop", stop: true, check: "develop" }]),
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

/** Runs every step through `run(step) -> exit code`; a red `stop` step ends the run. Returns { code, red, line, steps, secs }. */
export function runGate(steps, run, say = console.log, { head = "", base = "", clock = () => performance.now() } = {}) {
  const red = [], ran = [];
  const t0 = clock();
  for (const s of steps) {
    const t = clock();
    say(`── gate step ${s.name} ──`);
    const rc = run(s);
    const took = (clock() - t) / 1000;
    ran.push({ name: s.name, code: rc, secs: Math.round(took * 10) / 10 });
    say(`── ${s.name}: ${rc === 0 ? "ok" : `RED exit ${rc}`} (${took.toFixed(1)} s) ──`);
    if (rc !== 0) {
      red.push(`${s.name} (exit ${rc})`);
      if (s.stop) { say(`── ${s.name} stops the gate: every later step would read a tree that is not the sum ──`); break; }
    }
  }
  const wall = Math.round((clock() - t0) / 1000);
  const secs = `${wall} s`;
  const line = red.length
    ? `BENCH GATE REFUSES: ${red.join(", ")} · ${secs}`
    : `BENCH GATE GREEN at ${head || "?"} over develop ${base || "?"} · ${steps.length} steps · ${secs}`;
  say(line);
  if (red.length) say("pono: cure each named step's finding (a red merge-develop: `git fetch origin && git merge origin/develop`), then run the gate again");
  return { code: red.length ? 1 : 0, red, line, steps: ran, secs: wall };
}

/** The verdict document's kind: the keeper reads no other. */
export const VERDICT_KIND = "lares-bench-verdict";
/** THE KEEPER'S LOCAL WITNESS: one document over the revision and its tree, in a fixed key order (the keeper hashes the bytes). */
export function verdictOf(r, { rev, tree }) {
  if (!/^[0-9a-f]{40}$/.test(rev) || !/^[0-9a-f]{40}$/.test(tree)) throw new Error("bench-gate: a verdict names its revision and tree as 40 hex each");
  return { kind: VERDICT_KIND, v: 1, rev, tree, code: r.code, line: r.line, steps: r.steps.map(({ name, code, secs }) => ({ name, code, secs })), secs: r.secs };
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
  const known = new Set(["--list", "--base", "--weigh", "--run", "--verdict"]);
  const valued = new Set(["--base", "--weigh", "--run", "--verdict"]);
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
  const verdictFile = flag("--verdict");
  if (verdictFile) {
    // THE FLOOR first: the keeper's witness builds and tests like any gate run, so it too runs inside the one floor lock.
    requireFloor("bench-gate.mjs", args);
    // THE TREE IS THE SUM: no merge-develop, no fetch; a dirty tracked tree names no revision, so it refuses before any step.
    if (args.includes("--base") || args.includes("--list")) { console.error("bench-gate: --verdict runs over the checkout's own revision; it takes no --base or --list"); process.exit(2); }
    if (git(["status", "--porcelain", "--untracked-files=no"]).stdout.trim() !== "") { console.error("bench-gate: --verdict reads a clean tracked tree, and this checkout carries uncommitted changes; commit or drop them, then run it again"); process.exit(2); }
    const rev = git(["rev-parse", "HEAD"]).stdout.trim(), tree = git(["rev-parse", "HEAD^{tree}"]).stdout.trim();
    const r = runGate(plan({ verdict: true }), exec, console.log, { head: rev.slice(0, 9), base: "-" });
    // A STEP THAT MOVED THE TRACKED TREE voids the verdict: a moved tree reads another revision than the one the verdict names.
    const moved = git(["status", "--porcelain", "--untracked-files=no"]).stdout.trim() !== "" || git(["rev-parse", "HEAD"]).stdout.trim() !== rev;
    const out = moved ? { ...r, code: 1, line: `BENCH GATE REFUSES: the tracked tree moved under the gate · ${r.secs} s` } : r;
    writeFileSync(verdictFile, JSON.stringify(verdictOf(out, { rev, tree })));
    console.log(`bench-gate: verdict over ${rev.slice(0, 12)} written to ${verdictFile}${moved ? " (void: the tracked tree moved)" : ""}`);
    process.exit(out.code);
  }
  const base = flag("--base") ?? "origin/develop";
  const changed = git(["diff", "--name-only", `${base}...HEAD`]);
  const touched = changed.status === 0 ? touchedPackages(changed.stdout.split("\n").filter(Boolean)) : [];
  const steps = plan({ touched });
  if (args.includes("--list")) {
    for (const s of steps) console.log(s.check ? `${s.name}: HEAD holds ${base}` : `${s.name}: ${s.cmd} ${s.args.length > 8 ? `${s.args.slice(0, 4).join(" ")} … (${s.args.length - 4} more)` : s.args.join(" ")} (in ${s.cwd})`);
    process.exit(0);
  }
  // THE FLOOR (mandate/floor-gate-1): the gate builds and tests, so it runs only inside the one floor lock; the familiar runs
  // it through `node tools/floor-run.mjs -- node tools/bench-gate.mjs`, and a tasked spirit hands that line back.
  requireFloor("bench-gate.mjs", args);
  const head = git(["rev-parse", "--short", "HEAD"]).stdout.trim();
  const r = runGate(steps, (s) => (s.check ? checkDevelop(base) : exec(s)), console.log, { head, base: git(["rev-parse", "--short", base]).stdout.trim() });
  process.exit(r.code);
}
