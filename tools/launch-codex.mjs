#!/usr/bin/env node
/**
 * launch-codex — the Codex seat's one launcher (mixed-model-swarm#/the-launch, #/the-seat-law).
 *
 *   node tools/launch-codex.mjs --seat-dir <dir> --model <slug> --effort <level> --mode build|lead|read|research [--worktree <dir>] [--dry-run] [--canary]
 *   node tools/launch-codex.mjs --check-canary --seat-dir <dir>
 *
 * One walled `codex exec`, after a preflight. The brief is `<seat-dir>/brief.md`; the hand-back lands in `final.md`
 * (`-o`), the log in `run.log`, each attempt in `attempts.log`. The canon seat law or the lead law rides
 * the brief once, appended here. Hand-back: wait on `until [ -f <seat-dir>/final.md ]`.
 *
 *   build    workspace-write in the worktree, network off, both tmp excludes, `-C <worktree> --add-dir <seat-dir>`
 *   lead     workspace-write in a scratch worktree, network on, with seat, common Git, and lane root dirs added
 *   read     `-s read-only -C <seat-dir>`
 *   research workspace-write in the seat dir alone, networked, the only mode with `--search`
 *
 * EVERY mode carries `-c approval_policy="never"`, so a step past the wall fails by name instead of being reviewed out
 * of the sandbox; no mode carries `--ephemeral`, so each seat keeps the rollout the spend tally counts.
 * PREFLIGHT refuses (exit 2, `SEAT-REFUSED: …`): a seat dir outside `<scratch>/<lane>/`, a missing brief, a model absent
 * from Codex's models cache, `gpt-6-sol`, a Codex pool line unreadable twice (never read as zero), a pool at or under
 * its floor (20% for build, lead or research, 0% for read), a build or lead seat on the main checkout, a lead worktree
 * outside scratch, or a build seat over a stale dist.
 * Pool-used lines (seat-harness#/the-spend-guard): a lead refuses above 50% used, build or research above 60%. A detached
 * watchdog (`--watch`, spawned beside every seat) tails the seat's rollout and stops it at its token ceiling (`--ceiling N`;
 * lead 15M, others 8M), writing `ceiling.md`.
 * `--lead-step --lane-root <dir> --model --effort --worktree` launches ONE fresh lead step over `<lane-root>/state.json`
 * (tools/lane-state.mjs): the step dir `<lane-root>/steps/step-NNN` is the seat dir, the counter is spent only when the
 * preflight passes, and the lead ceiling bounds the step.
 * `--dry-run` runs the preflight and prints the argument array, spawns nothing and writes nothing.
 *
 * The Codex cache, auth and rollouts live under the PASSWD home (`os.userInfo().homedir`), never `$HOME`: a lead runs
 * under a scratch HOME. Every reader injects, so a test stands nothing. The tool never writes `~/.codex`.
 */
import { execFileSync, spawn as nodeSpawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, readSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leadStepBrief, peekStep, writeState } from "./lane-state.mjs";
import { globalStampPath, packageStampPath, sourceDigest, workspacePackageDirs } from "./stamp-build.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANON = "bags/lares/ha.ka.ba/lares/docs/pono/mixed-model-swarm.mem";
const FLOOR = 20;
/** A read seat's own floor: the operator lets readers spend the pool to its end for now (2026-10-31: "temp bump that limit to 0%"; it stood at 5); builders and research keep FLOOR. */
const READ_FLOOR = 0;
const MODES = ["build", "lead", "read", "research"];
export const COMPACT_LIMIT = 120000;
export const TOOL_OUTPUT_LIMIT = 8000;
/** The pool's used-percent ceiling by mode (seat-harness#/owed row 2): a read seat spends to its own floor. */
const MAX_USED = { lead: 50, build: 60, research: 60 };
/** The per-seat token ceiling by mode (row 1): total_token_usage.total_tokens, cached input counted. */
const CEILINGS = { lead: 15_000_000, build: 8_000_000, read: 8_000_000, research: 8_000_000 };

/** The ceiling for a mode: the default, or a positive-integer override (a number or its digits). */
export function ceilingFor(mode, override) {
  if (override === undefined) return CEILINGS[mode];
  const n = typeof override === "string" && /^[0-9]+$/.test(override) ? Number(override) : override;
  if (!Number.isInteger(n) || n <= 0) throw refuse(`ceiling must be a positive integer of tokens (got "${override}")`);
  return n;
}

/** The last total_token_usage.total_tokens in a rollout's lines, or null when none. */
export function rolloutTokens(lines) {
  let total = null;
  for (const line of lines ?? []) {
    if (!line.includes('"total_token_usage"')) continue;
    try { const t = JSON.parse(line)?.payload?.info?.total_token_usage?.total_tokens; if (typeof t === "number") total = t; } catch { /* a torn tail line */ }
  }
  return total;
}

/** Every rollout path under the home's sessions dir. */
export function listRollouts(home) {
  const out = [];
  const walk = (d, depth) => {
    let es; try { es = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = join(d, e.name);
      if (e.isDirectory() && depth < 5) walk(p, depth + 1);
      else if (e.isFile() && /^rollout-.*\.jsonl$/.test(e.name)) out.push(p);
    }
  };
  walk(join(home, ".codex", "sessions"), 0);
  return out;
}

/** The pid's start tick from /proc: its identity, since a reused pid carries another. */
export function startTick(n) { try { return readFileSync(`/proc/${n}/stat`, "utf8").replace(/^.*\) /, "").split(" ")[19]; } catch { return null; } }

/** The rollout of one seat: among the files NOT in `before` (the set the launcher listed ahead of the spawn), the one whose opening lines carry the seat's own marker. The marker rides the prompt, so a rollout names its seat; no cwd or start order decides. */
export function findRollout(home, { marker, before }) {
  for (const p of listRollouts(home)) {
    if (before.has(p)) continue;
    try {
      const fd = openSync(p, "r"); const buf = Buffer.alloc(262144);
      const n = readSync(fd, buf, 0, buf.length, 0); closeSync(fd);
      // The FIRST line that names the marker must be the user's prompt, so a marker a seat later copies into tool output never claims a rollout.
      const first = buf.toString("utf8", 0, n).split("\n").find((l) => l.includes(marker));
      if (first && /"role":"user"|"type":"user_message"/.test(first)) return p;
    } catch { /* unreadable or torn */ }
  }
  return null;
}

/** The watchdog loop over injected readers: stops the seat at its ceiling (SIGTERM, then SIGKILL after `graceTicks` ticks) and writes ceiling.md; returns "ceiling" or "exited". */
export function watchSeat({ seatDir, pid, ceiling, mode, tokens, alive, kill, sleep, graceTicks = 10 }) {
  while (alive()) {
    const t = tokens();
    if (typeof t === "number" && t >= ceiling) {
      kill("SIGTERM");
      for (let i = 0; i < graceTicks && alive(); i++) sleep();
      if (alive()) kill("SIGKILL");
      writeFileSync(join(seatDir, "ceiling.md"), `# Ceiling reached\n\nThe ${mode} seat (pid ${pid}) read ${t} total tokens in its rollout (total_token_usage.total_tokens, cached input counted) against a ceiling of ${ceiling}. The watchdog stopped it (SIGTERM, then SIGKILL if it lived).\n`);
      return "ceiling";
    }
    sleep();
  }
  return "exited";
}

/** The passwd home, never `$HOME`. */
export function realHome() { return userInfo().homedir; }

/** The argument array after `codex` and before the brief. */
export function seatArgs({ mode, model, effort, seatDir, worktree, laneRoot, compactLimit }) {
  if (!MODES.includes(mode)) throw new Error(`mode must be build, lead, read or research (got "${mode}")`);
  const common = ["exec", "-m", model, "-c", `model_reasoning_effort=${effort}`, "-c", 'approval_policy="never"', "--skip-git-repo-check", "-o", join(seatDir, "final.md"), "-c", `model_auto_compact_token_limit=${compactLimit ?? COMPACT_LIMIT}`, "-c", `tool_output_token_limit=${TOOL_OUTPUT_LIMIT}`];
  const tmpWall = ["-c", "sandbox_workspace_write.exclude_slash_tmp=true", "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true"];
  if (mode === "build") {
    if (!worktree) throw new Error("a builder needs its worktree");
    return [...common, "-s", "workspace-write", ...tmpWall, "-c", "sandbox_workspace_write.network_access=false", "-C", worktree, "--add-dir", seatDir];
  }
  if (mode === "lead") {
    if (!worktree) throw new Error("a lead needs its worktree");
    // A lead edits its worktree and asks the broker for every git act, so it holds NO git dir and no network flag: the model API rides the codex process itself, outside the sandbox (a read seat works the same way).
    return [...common, "-s", "workspace-write", ...tmpWall, "-c", "sandbox_workspace_write.network_access=false", "-C", worktree, "--add-dir", seatDir, ...(laneRoot ? ["--add-dir", laneRoot] : [])];
  }
  if (mode === "research") return ["--search", ...common, "-s", "workspace-write", ...tmpWall, "-c", "sandbox_workspace_write.network_access=true", "-C", seatDir];
  return [...common, "-s", "read-only", "-C", seatDir];
}

/** Canary verdict from one rollout's lines: compaction signals, function calls and final token reading. */
export function canaryVerdict(lines) {
  let events = 0;
  let calls = 0;
  for (const line of lines ?? []) {
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d?.type === "compacted" || d?.payload?.type === "context_compacted" || d?.payload?.type === "compaction") events++;
    if (["function_call", "custom_tool_call", "local_shell_call"].includes(d?.payload?.type)) calls++;
  }
  const tokens = rolloutTokens(lines);
  return { fired: events > 0, events, calls, tokens };
}

/** The canary brief: force many small read-only tool calls and a fixed completion line. */
export function canaryBrief() {
  return `# Compaction canary

Read-only seat. Do exactly this sequence and nothing else:

1. Read /home/joshu/.lares-scratch/seat-harness/wt/tools/launch-codex.mjs in 40-line slices with \`sed -n\`.
2. Read /home/joshu/.lares-scratch/seat-harness/wt/tools/launch-codex.test.mjs in 40-line slices with \`sed -n\`.
3. Read /home/joshu/.lares-scratch/seat-harness/wt/bags/lares/ha.ka.ba/lares/docs/pono/seat-harness.mem in 40-line slices with \`sed -n\`.
4. Keep one tool call per slice.
5. Make about 100 slices total (target 100).
6. No summary until all slices are done.
7. Final message must be exactly:
CANARY DONE 100 calls
`;
}

/** The newest rollout's rate_limits record, from its lines: the pool, or null when no line carries one. */
export function readPool(lines, mode = "build") {
  const floor = mode === "read" ? READ_FLOOR : FLOOR;
  let primary = null;
  for (const line of lines ?? []) {
    if (!line.includes('"rate_limits"')) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    const p = (d?.payload?.rate_limits ?? d?.payload?.info?.rate_limits)?.primary;
    if (p && typeof p.used_percent === "number" && p.window_minutes && p.resets_at) primary = p;
  }
  if (!primary) return null;
  const left = 100 - primary.used_percent;
  const above = left > floor;
  const winDays = Math.floor(primary.window_minutes / 1440);
  const summary = `codex pool: ${primary.used_percent.toFixed(1)}% used of a ${winDays}-day window, resets ${new Date(primary.resets_at * 1000).toISOString().slice(0, 16)}Z; ${left.toFixed(1)}% left, floor ${floor}% -> ${above ? "ABOVE FLOOR" : "AT OR BELOW FLOOR: launch no new Codex seat"}`;
  return { used: primary.used_percent, winDays, reset: primary.resets_at, left, above, summary };
}

/** Whether the tree's dists were built from its source: the global stamp, else every built package's own stamp (a `--pkg` build). */
export function distFresh(repo) {
  const digest = (dir) => sourceDigest(dir);
  const read = (p) => { try { return readFileSync(p, "utf8").trim(); } catch { return null; } };
  if (read(globalStampPath(repo)) === digest(join(repo, "packages"))) return true;
  const built = workspacePackageDirs(repo).filter((d) => existsSync(join(repo, "packages", d, "dist")));
  return built.length > 0 && built.every((d) => read(packageStampPath(repo, d)) === digest(join(repo, "packages", d)));
}

/** The canon seat-law bullets as the section a brief carries. */
export function seatLaw(canonText) {
  const m = /<<~ ahu slot=`#\/the-seat-law`>>([\s\S]*?)<<~\/ahu>>/.exec(canonText);
  const bullets = m ? m[1].split("\n").filter((l) => l.startsWith("* ")) : [];
  if (!bullets.length) throw new Error(`no seat-law bullets in ${CANON} #/the-seat-law`);
  return `## SEAT LAW (appended by tools/launch-codex.mjs to every brief; it binds this seat)\n${bullets.join("\n")}\n`;
}

/** The lead's separate wall permits work a builder's canon law forbids. */
export function leadLaw() {
  return `## LEAD LAW (appended by tools/launch-codex.mjs to a lead brief; it binds this lead)
* You hold no git write access and no credential. Every git act goes through the broker: write a request file \`req-<id>.json\` (zero-padded, in order) into \`<lane-root>/relay/\` and read its \`res-<id>.json\` on your next step. The doors are \`commit\` (named paths, a message file in the lane root, the expected old head), \`push\` (only when the controller's go names the branch and the head), \`worktree\`, \`worktree-remove\`, \`install\` and \`launch\`.
* A commit message follows the \`lar:///w1.w2.w3 — summary\` convention and ends with the two trailers the session's attribution reminder gives. No \`git stash\` in any form, no \`--no-verify\`, no \`git push -u\`, no force-push, no edit of .git/config.
* Never write the main checkout (~/Synthetic-Dream-Machine) or its submodule worktrees; work in your own worktree under ~/.lares-scratch only.
* Never read a credential file or the controller's directory.
* Never boot a daemon in-tree bare; any boot uses a scratch LAR_ROOT and no global LAR_BAGS.
* No local e2e loops (unit first; e2e in CI via tools/e2e-shards.mjs or a raw ci/* branch).
* Seats start only through the broker's launch door; a Sol seat only through the controller.
* A stop that needs more than this wall names itself in out.md and stops.
* Report to the controller (final.md) for any push beyond the lane's go, and never push without its go.
`;
}

/** Replace sections under the selected law heading, preserving the exact law once. */
export function appendSeatLaw(brief, law, title = "SEAT LAW") {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^## ${escaped}(?: \\(|$)[^\\n]*\\n?`, "gm");
  if (brief.includes(law) && (brief.match(heading) ?? []).length === 1) return brief;
  const section = new RegExp(`^## ${escaped}(?: \\(|$)[^\\n]*\\n[\\s\\S]*?(?=^## (?!${escaped}(?: \\(|$))|(?![\\s\\S]))`, "gm");
  const kept = brief.replace(section, "");
  return `${kept}${kept.endsWith("\n") ? "" : "\n"}\n${law}`;
}

function newestRolloutLines(home) {
  const files = [];
  const walk = (d, depth) => {
    let es; try { es = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = join(d, e.name);
      if (e.isDirectory() && depth < 5) walk(p, depth + 1);
      else if (e.isFile() && /^rollout-.*\.jsonl$/.test(e.name)) { try { files.push([statSync(p).mtimeMs, p]); } catch { /* left mid-walk */ } }
    }
  };
  walk(join(home, ".codex", "sessions"), 0);
  files.sort((a, b) => b[0] - a[0]);
  // The NEWEST rollout alone answers: an older record is a stale pool, and a newest one with none reads unreadable.
  const newest = files[0]?.[1];
  if (!newest) return null;
  const lines = readFileSync(newest, "utf8").split("\n").filter((l) => l.includes('"rate_limits"'));
  return lines.length ? lines : null;
}

/** The main checkout `repo` belongs to: the git common dir's parent (a lane worktree's launcher still guards the real main). */
export function mainCheckout(repo) {
  try {
    const common = execFileSync("git", ["-C", repo, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return basename(common) === ".git" ? dirname(realpathSync(common)) : real(repo);
  } catch { return repo; }
}

/** The real readers; `home` defaults to the passwd home. */
export function realReaders(home = realHome(), repo = REPO) {
  return {
    realHome: home, repo: mainCheckout(repo),
    modelsCache: () => { try { return readFileSync(join(home, ".codex", "models_cache.json"), "utf8"); } catch { return null; } },
    rolloutLines: () => { try { return newestRolloutLines(home); } catch { return null; } },
    distFresh: (wt) => { try { return distFresh(wt); } catch { return false; } },
    canon: () => readFileSync(join(repo, CANON), "utf8"),
  };
}

const refuse = (why) => Object.assign(new Error(why), { refused: true });
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** Throws a refusal naming why a seat must not start; else returns `{ pool }` (the pool summary line). */
export function preflight({ mode, model, seatDir, worktree, briefless }, readers) {
  // The REAL paths decide: a symlinked seat dir that leaves the lane reads as outside it.
  const scratch = real(join(readers.realHome, ".lares-scratch"));
  const there = real(seatDir);
  const rel = there.startsWith(`${scratch}/`) ? there.slice(scratch.length + 1).split("/") : [];
  if (rel.length < 2) throw refuse(`seat dir must sit under ${scratch}/<lane>/ (the spend tally reads the lane from it): ${seatDir}`);
  if (!briefless && !existsSync(join(seatDir, "brief.md"))) throw refuse(`no ${join(seatDir, "brief.md")}`);
  if (!MODES.includes(mode)) throw refuse("mode must be build, lead, read or research");
  if (model === "gpt-6-sol") throw refuse("gpt-6-sol never launches; use gpt-6.1-sol");
  const cache = readers.modelsCache();
  if (!cache || !new RegExp(`"slug": *"${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(cache)) throw refuse(`model ${model} is not in Codex's models cache`);
  // An empty read names itself and reads once more; it never stands in for a pool at zero.
  const pool = readPool(readers.rolloutLines(), mode) ?? readPool(readers.rolloutLines(), mode);
  if (!pool) throw refuse("Codex pool line unreadable (no rate_limits record in the newest rollout, read twice); read it by hand before launching");
  if (!pool.above) throw refuse(`Codex pool at or below its floor: ${pool.summary}`);
  if (MAX_USED[mode] !== undefined && pool.used > MAX_USED[mode]) throw refuse(`Codex pool used ${pool.used.toFixed(1)}%, above the ${mode} seat's ${MAX_USED[mode]}% used ceiling: ${pool.summary}`);
  if (mode === "build" || mode === "lead") {
    const role = mode === "lead" ? "lead" : "builder";
    if (!worktree) throw refuse(`a ${role} needs its worktree`);
    if (real(worktree) === real(readers.repo)) throw refuse(`a ${role} never writes the main checkout`);
    if (mode === "lead" && !real(worktree).startsWith(`${scratch}/`)) throw refuse(`a lead worktree must sit under ${scratch}/: ${worktree}`);
    if (mode === "build" && !readers.distFresh(worktree)) throw refuse(`the worktree's dist is stale (or unreadable): the lead runs 'pnpm build' in ${worktree} before launching a build seat`);
  }
  return { pool: pool.summary };
}

function parse(argv) {
  const o = { dryRun: false };
  const keys = { "--mode": "mode", "--model": "model", "--effort": "effort", "--seat-dir": "seatDir", "--worktree": "worktree", "--ceiling": "ceiling", "--pid": "pid", "--marker": "marker", "--born": "born", "--before": "before", "--lane-root": "laneRoot" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") o.dryRun = true;
    else if (argv[i] === "--watch") o.watch = true;
    else if (argv[i] === "--lead-step") o.leadStep = true;
    else if (argv[i] === "--canary") o.canary = true;
    else if (argv[i] === "--check-canary") o.checkCanary = true;
    else if (keys[argv[i]]) { if (argv[i + 1] === undefined) throw new Error(`${argv[i]} wants a value`); o[keys[argv[i]]] = argv[++i]; }
    else throw new Error(`unknown option ${argv[i]}`);
  }
  if (o.watch) return o;
  if (o.checkCanary) {
    if (!o.seatDir) throw new Error("--seat-dir is required");
    return o;
  }
  if (o.leadStep) {
    for (const k of ["laneRoot", "model", "effort", "worktree"]) if (!o[k]) throw new Error(`--lead-step needs --${k === "laneRoot" ? "lane-root" : k}`);
    return { ...o, mode: "lead" };
  }
  for (const k of ["mode", "model", "effort", "seatDir"]) if (!o[k]) throw new Error(`--${k === "seatDir" ? "seat-dir" : k} is required`);
  return o;
}

/** The detached watchdog entry: tails the seat's rollout every few seconds until the seat exits or crosses its ceiling. */
function watchMain(o) {
  const pid = Number(o.pid), marker = o.marker, before = new Set(JSON.parse(readFileSync(o.before, "utf8"))), home = realHome();
  // The launcher read the pid's start tick right after the spawn and passed it as --born: a reused pid reads as a different process, and the seat as gone.
  const born = o.born ?? null;
  const alive = () => { try { process.kill(pid, 0); } catch { return false; } return born === null || startTick(pid) === born; };
  const nap = new Int32Array(new SharedArrayBuffer(4));
  let file = null;
  watchSeat({
    seatDir: o.seatDir, pid, ceiling: Number(o.ceiling), mode: o.mode, alive,
    kill: (sig) => { if (!alive()) return; try { process.kill(-pid, sig); } catch { /* gone */ } },
    sleep: () => Atomics.wait(nap, 0, 0, 3000),
    tokens: () => { file ??= findRollout(home, { marker, before }); return file ? rolloutTokens(readFileSync(file, "utf8").split("\n")) : null; },
  });
  return 0;
}

/** The launcher over injected readers, spawn and writers; returns the exit code. */
export function run(argv, { readers, spawn = nodeSpawn, log = console.log, err = console.error } = {}) {
  let o;
  try { o = parse(argv); } catch (e) { err(`[launch-codex] ${e.message}`); return 2; }
  if (o.watch) return watchMain(o);
  if (o.checkCanary) {
    const seatDir = real(o.seatDir);
    readers ??= realReaders();
    const beforePath = join(seatDir, "rollouts-before.json");
    let before = new Set();
    if (existsSync(beforePath)) {
      try { before = new Set(JSON.parse(readFileSync(beforePath, "utf8"))); } catch { before = new Set(); }
    }
    const markerPath = join(seatDir, "marker.txt");
    const marker = existsSync(markerPath) ? readFileSync(markerPath, "utf8").trim() : null;
    const rollout = marker ? findRollout(readers.realHome, { marker, before }) : null;
    if (!rollout) { err(`no rollout found for ${o.seatDir}`); return 2; }
    const verdict = canaryVerdict(readFileSync(rollout, "utf8").split("\n"));
    log(`${verdict.fired ? "COMPACTION-FIRED" : "COMPACTION-NOT-FIRED"} events=${verdict.events} calls=${verdict.calls} tokens=${verdict.tokens}`);
    return verdict.fired ? 0 : 1;
  }
  let stepPlan;
  if (o.leadStep) {
    try {
      const laneRoot = real(o.laneRoot);
      stepPlan = { ...peekStep(laneRoot), laneRoot };
      o.seatDir = stepPlan.stepDir;
    } catch (e) { err(`SEAT-REFUSED: ${e.message}`); return 2; }
  }
  const seatDir = real(o.seatDir);
  try {
    if (o.canary && o.mode !== "read") throw refuse("--canary only runs with --mode read");
    const ceiling = ceilingFor(o.mode, o.ceiling);
    readers ??= realReaders();
    const worktree = o.worktree ? real(o.worktree) : undefined;
    if (stepPlan) {
      const scratch = real(join((readers ??= realReaders()).realHome, ".lares-scratch"));
      if (!stepPlan.laneRoot.startsWith(`${scratch}/`)) throw refuse(`the lane root must sit under ${scratch}/<lane>: ${o.laneRoot}`);
    }
    const { pool } = preflight({ ...o, seatDir, worktree, briefless: Boolean(stepPlan) }, readers);
    const laneRoot = o.mode === "lead" ? (stepPlan?.laneRoot ?? dirname(seatDir)) : undefined;
    const args = seatArgs({ ...o, seatDir, worktree, laneRoot, compactLimit: o.canary ? 50_000 : undefined });
    log(pool);
    if (o.dryRun) { log(`DRY-RUN ${JSON.stringify(["codex", ...args, "<brief>"])}`); return 0; }
    if (o.canary) writeFileSync(join(seatDir, "brief.md"), canaryBrief());
    if (stepPlan) {
      // The dir is the claim: two launches reading the same counter cannot both make step N.
      mkdirSync(dirname(stepPlan.stepDir), { recursive: true });
      try { mkdirSync(stepPlan.stepDir); } catch (e) { throw refuse(`step ${stepPlan.n} is already claimed (${stepPlan.stepDir}): ${e.code ?? e.message}`); }
      writeFileSync(join(stepPlan.stepDir, "brief.md"), leadStepBrief(stepPlan.state, { laneRoot: stepPlan.laneRoot, stepDir: stepPlan.stepDir }));
      writeState(stepPlan.laneRoot, { ...stepPlan.state, step: stepPlan.n });
    }
    const law = o.mode === "lead" ? leadLaw() : seatLaw(readers.canon());
    mkdirSync(join(seatDir, ".tmp"), { recursive: true });
    const briefPath = join(seatDir, "brief.md");
    const brief = appendSeatLaw(readFileSync(briefPath, "utf8"), law, o.mode === "lead" ? "LEAD LAW" : "SEAT LAW");
    writeFileSync(briefPath, brief);
    appendFileSync(join(seatDir, "attempts.log"), `attempt model=${o.model} effort=${o.effort} mode=${o.mode}\n`);
    const fd = openSync(join(seatDir, "run.log"), "w");
    const env = { ...process.env, HOME: readers.realHome, TMPDIR: join(seatDir, ".tmp"), TMPPREFIX: join(seatDir, ".tmp", "zsh") };
    const beforeFile = join(seatDir, "rollouts-before.json");
    writeFileSync(beforeFile, JSON.stringify(listRollouts(readers.realHome)));
    const marker = `SEAT-MARKER ${randomUUID()}`;
    writeFileSync(join(seatDir, "marker.txt"), `${marker}\n`);
    const child = spawn("codex", [...args, `${marker}\n\n${brief}`], { cwd: seatDir, env, detached: true, stdio: ["ignore", fd, fd] });
    child.unref?.();
    const born = (readers.startTick ?? startTick)(child.pid);
    // A seat whose start tick cannot be read has already exited; no watchdog guards a pid that may be reused.
    if (!born) { log(`SEAT-LAUNCHED ${seatDir} (${o.model} ${o.effort} ${o.mode}) pid ${child.pid}; it exited before the watchdog could pin it; wait on: until [ -f ${join(seatDir, "final.md")} ]`); return 0; }
    const dog = spawn(process.execPath, [fileURLToPath(import.meta.url), "--watch", "--seat-dir", seatDir, "--pid", String(child.pid), "--ceiling", String(ceiling), "--mode", o.mode, "--marker", marker, "--before", beforeFile, "--born", born], { cwd: seatDir, env: { ...process.env, HOME: readers.realHome }, detached: true, stdio: "ignore" });
    dog.unref?.();
    log(`SEAT-LAUNCHED ${seatDir} (${o.model} ${o.effort} ${o.mode}) pid ${child.pid}; wait on: until [ -f ${join(seatDir, "final.md")} ]`);
    return 0;
  } catch (e) {
    if (!e.refused) throw e;
    err(`SEAT-REFUSED: ${e.message}`);
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(run(process.argv.slice(2)));
