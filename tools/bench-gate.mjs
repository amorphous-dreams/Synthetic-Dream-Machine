#!/usr/bin/env node
/**
 * bench-gate — the cheap, deterministic laws that read the SUM of lanes, run on the lane with develop merged in
 * (ruling/2026-11-25-branches-not-prs). Since mandate/floor-gate-1 only the familiar runs it, on the floor: a tasked spirit
 * hands back a floor ticket naming it, and the familiar runs `node tools/floor-run.mjs --ticket <id> -- node tools/bench-gate.mjs`
 * (outside the floor lock the gate refuses with exit 64; `--list` reads and runs anywhere).
 *
 *   node tools/bench-gate.mjs [--list] [--base <ref>]
 *   node tools/bench-gate.mjs --verdict <file>                           (the keeper's local witness; below)
 *
 * THE ONE PLAN: `plan()` below serves this gate and the landing door (`tools/floor-gate.mjs`, the small and whole tiers over a
 * `floor-run --ref` bench). The seconds table and its re-measure live in `tools/unit-weights.mjs`; the vessel roster rides as
 * data in `tools/vessel-tests.json`.
 *
 * ── THE STEPS (research/test-corpus-mu, "the bench gate") ────────────────────────────────────────
 *   merge-develop   the bench holds `origin/develop` (fetched now): the gate reads the sum, never the lane alone
 *   build           `pnpm build`: every package built and the source digest stamped (the suites' dist guard reads it)
 *   witnesses-fast  `witness-all.sh --fast`: the static fleet without docker or the slow three; typecheck-witness and
 *                   typecheck-tests-witness (the tests ratchet) ride it, so no second typecheck runs
 *   carrier-pins    `rite-walk.mjs --bind`
 *   tool-tests      every `tools/*.test.mjs` but the VESSEL ones, which stand real houses and ride CI
 *   swift-<pkg>     each package's files the weights table measures under SWIFT_SECONDS (and every file it never measured)
 *   floor-owes      the ticket rule (research/corpus-seams): the lane's diff, folded over the seam table by the wiki's
 *                   `floor-owes` filter (`tools/floor-owes.mjs` gathers the facts and asks). A touched path in no seam
 *                   REFUSES here, by name, and stops the gate before the build.
 *   owed-<pkg>      the unit files the rule names in a package, past its swift tier (`heavy-<pkg>` where the rule owes the
 *                   package whole: a hub, a barrel or config, a `whole=` seam, eight seams hit)
 *   e2e-node        the node package's e2e files the rule names, or its whole set (a trunk seam, a hub, a barrel or config)
 *   e2e-root        the root `tests/e2e` files the rule names, or the whole set
 *   vessel-tools    the VESSEL tool tests the rule names
 *   witness-<name>  a slow witness a seam declares
 * Where no fold answers (the doors dark and develop holding none), the gate FAILS WIDE: `heavy-<pkg>` for every package the
 * diff touches, and the whole node e2e set whenever node, mesh, tw5, keyhive or cli moved.
 * merge-develop and build stop the gate when red: every later step would read a tree that is not the sum. Past them every
 * step runs, none short-circuits, and the last line carries ONE verdict with the wall time, the line a hand-back quotes:
 *   BENCH GATE GREEN at <sha> over develop <sha> · <n> steps · <s> s · owes=<digest>
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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireFloor } from "./floor-lock.mjs";
import { lines as owesLines, owes as floorOwes } from "./floor-owes.mjs";
import { PACKAGES, SWIFT_SECONDS, isE2e, readWeights } from "./unit-weights.mjs";

export { PACKAGES, SWIFT_SECONDS, readWeights };
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Self-tests that stand real vessels: the bench leaves them to CI; every other `tools/*.test.mjs` runs here. The roster
 *  rides as data (`tools/vessel-tests.json`, each file with its measured why). */
export const VESSEL = Object.freeze(JSON.parse(readFileSync(join(ROOT, "tools/vessel-tests.json"), "utf8")).vessel.map((v) => v.file));


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

/** The packages whose movement owes the whole node e2e set where no fold answers. */
export const E2E_BEARING = Object.freeze(["packages/lararium-node", "packages/lararium-mesh", "packages/lararium-tw5", "packages/lararium-keyhive", "packages/lares-cli"]);
/** The two e2e sets a bench can run: where each stands, the files under it, and its vitest words. */
export const NODE_E2E = Object.freeze({ dir: "packages/lararium-node", under: "tests/e2e/", args: ["vitest", "run", "--config", "vitest.e2e.config.ts"] });
export const ROOT_E2E = Object.freeze({ dir: "tests", under: "e2e/", args: ["vitest", "run"] });
/** Packages whose lamps stand dim (tools/ci-cells.mjs): a named file outside the lit slice collects nothing, and that passes. */
export const DIM = Object.freeze(["packages/lararium-browser", "packages/lararium-web"]);

/** The tracked files a glob names (git's own glob magic), sorted; empty where git answers nothing. */
export function tracked(glob, root = ROOT) {
  const r = spawnSync("git", ["ls-files", "-z", "--", `:(glob)${glob}`], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\0").filter(Boolean).sort() : [];
}

/**
 * The steps the ticket rule owes past the fixed floor. `owed` as `tools/floor-owes.mjs` answers it: { via, touched, refuse,
 * sets, globs, files }. A `dark` answer fails wide; a refusal adds nothing here (the `floor-owes` step stops the gate).
 */
export function owedSteps({ owed, weights = {}, touched = [], root = ROOT, expand = (glob) => tracked(glob, root) }) {
  const slug = (dir) => dir.split("/").pop();
  const steps = [];
  const e2e = (name, set, files) => ({ name, cmd: "npx", args: [...set.args, ...files], cwd: set.dir, scratch: true });
  const heavyOf = (dir) => tiers(treeTests(dir, root), weights[dir]).heavy;
  // A `dark` FILE (its test lane lit by no lamp) rides receipted and unrun, the DARK line names it; going wide would not run it either.
  if (owed.via === "dark") {
    for (const dir of touched) { const heavy = heavyOf(dir); if (heavy.length) steps.push(vitestStep(`heavy-${slug(dir)}`, dir, heavy, root)); }
    const moved = owed.touched ?? [];
    if (moved.length === 0 || moved.some((p) => E2E_BEARING.some((dir) => p.startsWith(`${dir}/`)))) steps.push(e2e("e2e-node", NODE_E2E, []));
    return steps;
  }
  const sets = new Set(owed.sets.map((s) => s.name));
  const named = new Set(owed.files.filter((f) => f.tier !== "dark").map((f) => f.path));
  for (const g of owed.globs) for (const f of expand(g.glob)) named.add(f);
  const under = (dir, lead) => [...named].filter((p) => p.startsWith(`${dir}/${lead}`)).map((p) => p.slice(dir.length + 1)).sort();
  const everything = sets.has("all");
  for (const dir of PACKAGES) {
    const whole = everything || sets.has(`pkg:${dir}`);
    const swift = new Set(tiers(treeTests(dir, root), weights[dir]).swift);
    const own = [...named].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1));
    const files = [...new Set([...(whole ? heavyOf(dir) : []), ...own.filter((f) => !isE2e(f) && !swift.has(f))])].sort();
    if (files.length === 0) continue;
    const step = vitestStep(`${whole ? "heavy" : "owed"}-${slug(dir)}`, dir, files, root);
    if (DIM.includes(dir)) step.args.push("--passWithNoTests");
    steps.push(step);
  }
  const nodeFiles = under(NODE_E2E.dir, NODE_E2E.under), rootFiles = under(ROOT_E2E.dir, ROOT_E2E.under);
  if (sets.has("e2e-node")) steps.push(e2e("e2e-node", NODE_E2E, []));
  else if (nodeFiles.length) steps.push(e2e("e2e-node", NODE_E2E, nodeFiles));
  if (sets.has("e2e-root")) steps.push(e2e("e2e-root", ROOT_E2E, []));
  else if (rootFiles.length) steps.push(e2e("e2e-root", ROOT_E2E, rootFiles));
  const vessel = [...named].filter((p) => p.startsWith("tools/") && VESSEL.includes(p.slice("tools/".length))).sort();
  if (vessel.length) steps.push({ name: "vessel-tools", cmd: "node", args: ["--test", ...vessel], cwd: ".", scratch: true });
  for (const name of [...sets].filter((s) => s.startsWith("witness:")).map((s) => s.slice("witness:".length)).sort()) {
    if (/^[A-Za-z0-9._-]+$/.test(name)) steps.push({ name: `witness-${name.replace(/-witness$/, "")}`, cmd: "bash", args: [`tools/${name}.sh`], cwd: "." });
  }
  return steps;
}

/** The bench tiers: `whole` runs the fixed floor, every package's swift tier and what the ticket rule owes; `small` runs the
 *  lane's own touched test files, the named packages whole, the two door tool suites and the holder's pytest pair. */
export const TIERS = Object.freeze(["small", "whole"]);
/** The tool suites every small bench runs beside the lane's own touched ones: the two doors most landings move. */
export const SMALL_TOOLS = Object.freeze(["tools/lares-container.test.mjs", "tools/launch-codex.test.mjs"]);
/** The holder's pytest pair every small bench runs (the venv that holds mempalace, as CI names it, else python3). */
export const SMALL_PYTEST = Object.freeze(["packages/lararium-sensorium/scripts/test_lares_mcp.py", "packages/lararium-sensorium/scripts/test_affordance_skin.py"]);
export const pythonOf = (home = homedir()) => (existsSync(join(home, ".venv/bin/python3")) ? join(home, ".venv/bin/python3") : "python3");
/**
 * THE DOOR'S OWN STEPS (`door`, the landing door): the bench MERGES develop (never only checks it), and after the build every
 * generated carrier re-renders and the build's writes commit, so the tree the tests read stands committed and the verdict
 * names it. Each stops the gate when red: a later step would read a tree no commit names.
 */
export const REGEN = Object.freeze([
  { name: "cli-verbs", stop: true, cmd: "node", args: ["packages/lararium-sensorium/scripts/gen_cli_verbs.mjs"], cwd: "." },
  { name: "heleuma", stop: true, cmd: "pnpm", args: ["--filter", "@lararium/tw5", "build:heleuma", "--sync-modules"], cwd: "." },
  { name: "affordance-pack", stop: true, cmd: "npx", args: ["tsx", "scripts/build-affordance-pack.ts"], cwd: "packages/lararium-tw5" },
  { name: "redeclare-unbaked", stop: true, check: "unbaked" },
  { name: "commit-build", stop: true, check: "commit" },
]);

/** The test files a diff touches in each package (relative to it; e2e aside, deleted files dropped by the tree walk). */
export function touchedTests(changed, root = ROOT, packages = PACKAGES) {
  const out = {};
  for (const dir of packages) {
    const mine = changed.filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1));
    if (mine.length === 0) continue;
    const tree = new Set(treeTests(dir, root));
    const files = mine.filter((f) => tree.has(f)).sort();
    if (files.length) out[dir] = files;
  }
  return out;
}

/**
 * THE ONE PLAN, every bench's: the bench gate (`door` false: merge-develop only CHECKS develop), the keeper's `--verdict` (no
 * merge, no fold) and the landing door (`door` true: merge, build, re-render, commit; `tier` small or whole).
 * whole: the fixed steps, the swift tier of every package, then what the ticket rule owes (`owed`, as `tools/floor-owes.mjs`
 *   answers it); with no `owed` the heavy files of the touched packages ride. `whole` names packages whose heavy files ride too.
 * small: the lane's own touched test files per package (`changed`, the diff's paths), each package `whole` names run whole, the
 *   door tool suites and the lane's touched tool suites (VESSEL aside), the holder's pytest pair.
 */
export function plan({ tier = "whole", door = false, weights = readWeights(), touched = [], changed = [], whole = [], root = ROOT, verdict = false, owed, expand, python = pythonOf() } = {}) {
  if (!TIERS.includes(tier)) throw new Error(`bench-gate: tier reads "${tier}"; name one of ${TIERS.join(", ")}`);
  const slug = (dir) => dir.split("/").pop();
  const folds = tier === "whole" && owed && !verdict;
  const steps = [
    ...(door ? [{ name: "merge-develop", stop: true, check: "merge" }] : verdict ? [] : [{ name: "merge-develop", stop: true, check: "develop" }]),
    ...(folds ? [{ name: "floor-owes", stop: true, check: "owes" }] : []),
    { name: "build", stop: true, cmd: "pnpm", args: ["build"], cwd: "." },
    ...(door ? REGEN.map((s) => ({ ...s, ...(s.args ? { args: [...s.args] } : {}) })) : []),
    { name: "witnesses-fast", cmd: "bash", args: ["tools/witness-all.sh", "--fast"], cwd: "." },
  ];
  if (tier === "small") {
    const hit = touchedTests(changed, root);
    for (const dir of PACKAGES) {
      if (whole.includes(dir)) { const s = vitestStep(`whole-${slug(dir)}`, dir, [], root); if (DIM.includes(dir)) s.args.push("--passWithNoTests"); steps.push(s); continue; }
      if (!hit[dir]) continue;
      const s = vitestStep(`touched-${slug(dir)}`, dir, hit[dir], root);
      if (DIM.includes(dir)) s.args.push("--passWithNoTests");
      steps.push(s);
    }
    const own = changed.filter((p) => /^tools\/[^/]+\.test\.mjs$/.test(p) && !VESSEL.includes(p.slice("tools/".length)) && existsSync(join(root, p)));
    const tools = [...new Set([...SMALL_TOOLS.filter((t) => existsSync(join(root, t))), ...own])].sort();
    if (tools.length) steps.push({ name: "tool-tests", cmd: "node", args: ["--test", ...tools], cwd: "." });
    const py = SMALL_PYTEST.filter((t) => existsSync(join(root, t)));
    if (py.length) steps.push({ name: "pytest", cmd: python, args: ["-m", "pytest", "-q", ...py], cwd: "." });
    return steps;
  }
  const tools = readdirSync(join(root, "tools")).filter((f) => f.endsWith(".test.mjs") && !VESSEL.includes(f)).sort().map((f) => `tools/${f}`);
  steps.push(
    { name: "carrier-pins", cmd: "node", args: ["tools/rite-walk.mjs", "--bind"], cwd: "." },
    { name: "tool-tests", cmd: "node", args: ["--test", ...tools], cwd: "." },
  );
  for (const dir of PACKAGES) {
    const { swift } = tiers(treeTests(dir, root), weights[dir]);
    if (swift.length) steps.push(vitestStep(`swift-${slug(dir)}`, dir, swift, root));
  }
  const heavyFor = (dirs) => {
    for (const dir of dirs) {
      if (steps.some((s) => s.name === `heavy-${slug(dir)}`)) continue;
      const { heavy } = tiers(treeTests(dir, root), weights[dir]);
      if (heavy.length) steps.push(vitestStep(`heavy-${slug(dir)}`, dir, heavy, root));
    }
  };
  // A PATH IN NO SEAM RUNS THE WHOLE GATE: the fold reads develop's table, so a wave adding files cannot seat them first; it pays the full floor instead of stopping.
  if (folds && owed.refuse.length === 0) steps.push(...owedSteps({ owed, weights, touched, root, ...(expand ? { expand } : {}) }));
  else heavyFor(touched);
  heavyFor(whole);
  return steps;
}

/** Runs every step through `run(step) -> exit code`; a red `stop` step ends the run. Returns { code, red, line, steps, secs }. */
export function runGate(steps, run, say = console.log, { head = "", base = "", owes = "", clock = () => performance.now() } = {}) {
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
    : `BENCH GATE GREEN at ${head || "?"} over develop ${base || "?"} · ${steps.length} steps · ${secs}${owes ? ` · owes=${owes}` : ""}`;
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

/** The floor-owes step: the owed set printed, red where a touched path stands in no seam. */
export function checkOwes(owed, say = console.log) {
  for (const l of owesLines(owed)) say(l);
  const dark = owed.files.filter((f) => f.tier === "dark");
  if (dark.length) say(`DARK ${dark.length} · owed and unrun, no lamp lit: ${dark.map((f) => f.path).join(", ")}`);
  if (owed.via === "dark") say("floor-owes: no fold answered, so the gate fails wide; land the fold on develop or light the doors for the narrow ticket");
  if (owed.refuse.length === 0) return 0;
  say(`floor-owes: ${owed.refuse.length} path(s) stand in no seam on develop's table, so the gate runs whole; seat them in packages/lararium-tw5/tiddlers-lararium/floor-seams.tid (a MOVES row, or FREE, or CONFIG) and the next ticket narrows`);
  return 0;
}

/** A step that stands vessels runs under a scratch LAR_ROOT of its own and no LAR_BAGS (the e2e isolation law), as CI's shards do. */
export function scratchEnv(name) {
  const at = mkdtempSync(join(process.env.LAR_STAGE_DIR ?? tmpdir(), `bench-${name}-`));
  const env = { ...process.env, LAR_ROOT: join(at, "lar-root") };
  delete env.LAR_BAGS;
  mkdirSync(env.LAR_ROOT, { recursive: true });
  return env;
}
const exec = (s) => spawnSync(s.cmd, s.args, { cwd: join(ROOT, s.cwd), stdio: "inherit", env: s.scratch ? scratchEnv(s.name) : process.env }).status ?? 1;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i === -1 ? undefined : args[i + 1]; };
  const known = new Set(["--list", "--base", "--verdict"]);
  const valued = new Set(["--base", "--verdict"]);
  for (let i = 0; i < args.length; i++) {
    if (!known.has(args[i])) { console.error(`bench-gate: unknown argument ${args[i]}`); process.exit(2); }
    if (valued.has(args[i])) { if (!args[i + 1]) { console.error(`bench-gate: ${args[i]} wants a value`); process.exit(2); } i++; }
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
  // THE TICKET RULE: the diff's facts, folded by the wiki's `floor-owes` filter; an unreadable diff rides in as an UNREAD fact.
  const owed = floorOwes({ root: ROOT, base, head: "HEAD" });
  const steps = plan({ touched, owed });
  if (args.includes("--list")) {
    checkOwes(owed);
    for (const s of steps) console.log(s.check === "owes" ? `${s.name}: via ${owed.via}, ${owed.refuse.length} refused` : s.check ? `${s.name}: HEAD holds ${base}` : `${s.name}: ${s.cmd} ${s.args.length > 8 ? `${s.args.slice(0, 4).join(" ")} … (${s.args.length - 4} more)` : s.args.join(" ")} (in ${s.cwd})`);
    process.exit(0);
  }
  // THE FLOOR (mandate/floor-gate-1): the gate builds and tests, so it runs only inside the one floor lock; the familiar runs
  // it through `node tools/floor-run.mjs -- node tools/bench-gate.mjs`, and a tasked spirit hands that line back.
  requireFloor("bench-gate.mjs", args);
  const head = git(["rev-parse", "--short", "HEAD"]).stdout.trim();
  const r = runGate(steps, (s) => (s.check === "owes" ? checkOwes(owed) : s.check ? checkDevelop(base) : exec(s)), console.log, { head, base: git(["rev-parse", "--short", base]).stdout.trim(), owes: owed.digest.slice(0, 16) });
  process.exit(r.code);
}
