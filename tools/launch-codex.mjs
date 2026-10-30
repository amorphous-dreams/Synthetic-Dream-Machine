#!/usr/bin/env node
/**
 * launch-codex — the Codex seat's one launcher (mixed-model-swarm#/the-launch, #/the-seat-law).
 *
 *   node tools/launch-codex.mjs --seat-dir <dir> --model <slug> --effort <level> --mode build|read|research [--worktree <dir>] [--dry-run]
 *
 * One walled `codex exec`, after a preflight. The brief is `<seat-dir>/brief.md`; the hand-back lands in `final.md`
 * (`-o`), the log in `run.log`, each attempt in `attempts.log`. The seat law (the canon section #/the-seat-law) rides
 * the brief once, appended here. Hand-back: wait on `until [ -f <seat-dir>/final.md ]`.
 *
 *   build    workspace-write in the worktree, network off, both tmp excludes, `-C <worktree> --add-dir <seat-dir>`
 *   read     `-s read-only -C <seat-dir>`
 *   research workspace-write in the seat dir alone, networked, the only mode with `--search`
 *
 * EVERY mode carries `-c approval_policy="never"`, so a step past the wall fails by name instead of being reviewed out
 * of the sandbox; no mode carries `--ephemeral`, so each seat keeps the rollout the spend tally counts.
 * PREFLIGHT refuses (exit 2, `SEAT-REFUSED: …`): a seat dir outside `<scratch>/<lane>/`, a missing brief, a model absent
 * from Codex's models cache, `gpt-6-sol`, a Codex pool line unreadable twice (never read as zero), a pool at or under
 * its 20% floor, a build seat on the main checkout, a build seat over a stale dist.
 * `--dry-run` runs the preflight and prints the argument array, spawns nothing and writes nothing.
 *
 * The Codex cache, auth and rollouts live under the PASSWD home (`os.userInfo().homedir`), never `$HOME`: a lead runs
 * under a scratch HOME. Every reader injects, so a test stands nothing. The tool never writes `~/.codex`.
 */
import { execFileSync, spawn as nodeSpawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { globalStampPath, packageStampPath, sourceDigest, workspacePackageDirs } from "./stamp-build.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANON = "bags/lares/ha.ka.ba/lares/docs/pono/mixed-model-swarm.mem";
const FLOOR = 20;
const MODES = ["build", "read", "research"];

/** The passwd home, never `$HOME`. */
export function realHome() { return userInfo().homedir; }

/** The argument array after `codex` and before the brief. */
export function seatArgs({ mode, model, effort, seatDir, worktree }) {
  if (!MODES.includes(mode)) throw new Error(`mode must be build, read or research (got "${mode}")`);
  const common = ["exec", "-m", model, "-c", `model_reasoning_effort=${effort}`, "-c", 'approval_policy="never"', "--skip-git-repo-check", "-o", join(seatDir, "final.md")];
  const tmpWall = ["-c", "sandbox_workspace_write.exclude_slash_tmp=true", "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true"];
  if (mode === "build") {
    if (!worktree) throw new Error("a builder needs its worktree");
    return [...common, "-s", "workspace-write", ...tmpWall, "-c", "sandbox_workspace_write.network_access=false", "-C", worktree, "--add-dir", seatDir];
  }
  if (mode === "research") return ["--search", ...common, "-s", "workspace-write", ...tmpWall, "-c", "sandbox_workspace_write.network_access=true", "-C", seatDir];
  return [...common, "-s", "read-only", "-C", seatDir];
}

/** The newest rollout's rate_limits record, from its lines: the pool, or null when no line carries one. */
export function readPool(lines) {
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
  const above = left > FLOOR;
  const winDays = Math.floor(primary.window_minutes / 1440);
  const summary = `codex pool: ${primary.used_percent.toFixed(1)}% used of a ${winDays}-day window, resets ${new Date(primary.resets_at * 1000).toISOString().slice(0, 16)}Z; ${left.toFixed(1)}% left, floor ${FLOOR}% -> ${above ? "ABOVE FLOOR" : "AT OR BELOW FLOOR: launch no new Codex seat"}`;
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
  const m = /<<~ ahu #\/the-seat-law>>([\s\S]*?)<<~\/ahu>>/.exec(canonText);
  const bullets = m ? m[1].split("\n").filter((l) => l.startsWith("* ")) : [];
  if (!bullets.length) throw new Error(`no seat-law bullets in ${CANON} #/the-seat-law`);
  return `## SEAT LAW (appended by tools/launch-codex.mjs to every brief; it binds this seat)\n${bullets.join("\n")}\n`;
}

/** The brief carrying the canon law exactly once: every section under the SEAT LAW heading that is not the law alone is replaced, never trusted. */
export function appendSeatLaw(brief, law) {
  const heading = /^## SEAT LAW(?: \(|$)[^\n]*\n?/gm;
  if (brief.includes(law) && (brief.match(heading) ?? []).length === 1) return brief;
  const kept = brief.replace(/^## SEAT LAW(?: \(|$)[^\n]*\n[\s\S]*?(?=^## (?!SEAT LAW(?: \(|$))|(?![\s\S]))/gm, "");
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
export function preflight({ mode, model, seatDir, worktree }, readers) {
  // The REAL paths decide: a symlinked seat dir that leaves the lane reads as outside it.
  const scratch = real(join(readers.realHome, ".lares-scratch"));
  const there = real(seatDir);
  const rel = there.startsWith(`${scratch}/`) ? there.slice(scratch.length + 1).split("/") : [];
  if (rel.length < 2) throw refuse(`seat dir must sit under ${scratch}/<lane>/ (the spend tally reads the lane from it): ${seatDir}`);
  if (!existsSync(join(seatDir, "brief.md"))) throw refuse(`no ${join(seatDir, "brief.md")}`);
  if (!MODES.includes(mode)) throw refuse("mode must be build, read or research");
  if (model === "gpt-6-sol") throw refuse("gpt-6-sol never launches; use gpt-6.1-sol");
  const cache = readers.modelsCache();
  if (!cache || !new RegExp(`"slug": *"${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(cache)) throw refuse(`model ${model} is not in Codex's models cache`);
  // An empty read names itself and reads once more; it never stands in for a pool at zero.
  const pool = readPool(readers.rolloutLines()) ?? readPool(readers.rolloutLines());
  if (!pool) throw refuse("Codex pool line unreadable (no rate_limits record in the newest rollout, read twice); read it by hand before launching");
  if (!pool.above) throw refuse(`Codex pool at or below its floor: ${pool.summary}`);
  if (mode === "build") {
    if (!worktree) throw refuse("a builder needs its worktree");
    if (real(worktree) === real(readers.repo)) throw refuse("a builder never writes the main checkout");
    if (!readers.distFresh(worktree)) throw refuse(`the worktree's dist is stale (or unreadable): the lead runs 'pnpm build' in ${worktree} before launching a build seat`);
  }
  return { pool: pool.summary };
}

function parse(argv) {
  const o = { dryRun: false };
  const keys = { "--mode": "mode", "--model": "model", "--effort": "effort", "--seat-dir": "seatDir", "--worktree": "worktree" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") o.dryRun = true;
    else if (keys[argv[i]]) { if (argv[i + 1] === undefined) throw new Error(`${argv[i]} wants a value`); o[keys[argv[i]]] = argv[++i]; }
    else throw new Error(`unknown option ${argv[i]}`);
  }
  for (const k of ["mode", "model", "effort", "seatDir"]) if (!o[k]) throw new Error(`--${k === "seatDir" ? "seat-dir" : k} is required`);
  return o;
}

/** The launcher over injected readers, spawn and writers; returns the exit code. */
export function run(argv, { readers, spawn = nodeSpawn, log = console.log, err = console.error } = {}) {
  let o;
  try { o = parse(argv); } catch (e) { err(`[launch-codex] ${e.message}`); return 2; }
  const seatDir = real(o.seatDir);
  try {
    readers ??= realReaders();
    const worktree = o.worktree ? real(o.worktree) : undefined;
    const { pool } = preflight({ ...o, seatDir, worktree }, readers);
    const args = seatArgs({ ...o, seatDir, worktree });
    log(pool);
    if (o.dryRun) { log(`DRY-RUN ${JSON.stringify(["codex", ...args, "<brief>"])}`); return 0; }
    const law = seatLaw(readers.canon());
    mkdirSync(join(seatDir, ".tmp"), { recursive: true });
    const briefPath = join(seatDir, "brief.md");
    const brief = appendSeatLaw(readFileSync(briefPath, "utf8"), law);
    writeFileSync(briefPath, brief);
    appendFileSync(join(seatDir, "attempts.log"), `attempt model=${o.model} effort=${o.effort} mode=${o.mode}\n`);
    const fd = openSync(join(seatDir, "run.log"), "w");
    const env = { ...process.env, HOME: readers.realHome, TMPDIR: join(seatDir, ".tmp"), TMPPREFIX: join(seatDir, ".tmp", "zsh") };
    const child = spawn("codex", [...args, brief], { cwd: seatDir, env, detached: true, stdio: ["ignore", fd, fd] });
    child.unref?.();
    log(`SEAT-LAUNCHED ${seatDir} (${o.model} ${o.effort} ${o.mode}) pid ${child.pid}; wait on: until [ -f ${join(seatDir, "final.md")} ]`);
    return 0;
  } catch (e) {
    if (!e.refused) throw e;
    err(`SEAT-REFUSED: ${e.message}`);
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(run(process.argv.slice(2)));
