#!/usr/bin/env node
/**
 * launch-copilot — the Copilot seat's one launcher, read-only or walled builder (mixed-model-swarm#/the-copilot-seat).
 *
 *   node tools/launch-copilot.mjs read  --name <seat> --model <id> --cwd <dir>      --brief <file> --seat-dir <dir> [--add-dir <dir>]... [--effort <level>]
 *   node tools/launch-copilot.mjs build --name <seat> --model <id> --cwd <worktree> --brief <file> --seat-dir <dir> [--effort <level>]
 *
 * READ: every write, commit and push denied; git and file reads alone.
 * BUILD: file writes inside the worktree it runs in alone (path verification stays on, so `write` reaches the
 *   working directory and nothing past it), `npx vitest` and `npx tsc` there; every git write, push, network fetch,
 *   `rm`, `mv`, `npm` and `pnpm` denied. It refuses to start without a scratch `LAR_ROOT` outside the repository, refuses
 *   the main checkout as its worktree, and drops `LAR_BAGS`.
 * BOTH: no URL, no built-in MCP server (the GitHub server reaches the network and writes), no system temp directory, no
 *   prompt, no auto-update, stdin closed, `COPILOT_ALLOW_ALL` dropped from the environment. A launch never widens these
 *   walls: no `shell(bash)`, no `shell(env)`, never `--allow-all-*` or `--yolo`.
 *
 * The seat's handback lands in `<seat-dir>/<name>.out.md` (stdout), its log in `<name>.log`, the session share in
 * `<name>.share.md`. It prints the premium allowance before and after, read from Copilot's own entitlement cache.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const READS = ["git log", "git show", "git diff", "git status", "git grep", "rg", "grep", "cat", "sed", "ls", "head", "tail", "wc", "find"];
const GIT_WRITES = ["git push", "git commit", "git stash", "git reset", "git checkout", "git switch", "git add", "git rm", "git mv",
  "git worktree", "git rebase", "git merge", "git cherry-pick", "git revert", "git tag", "git branch", "git config", "git restore", "git clean"];
const NEVER = ["bash", "sh", "zsh", "env", "sudo", "rm", "mv", "curl", "wget", "npm", "pnpm", "yarn", "gh"];

/** The permission flags for one mode, as an argument array (no shell ever reads them). */
export function permissionArgs(mode) {
  if (mode !== "read" && mode !== "build") throw new Error(`unknown mode "${mode}" (read | build)`);
  const args = [];
  for (const c of [...GIT_WRITES, ...NEVER]) args.push("--deny-tool", `shell(${c})`);
  args.push("--deny-tool", "url");
  if (mode === "read") args.push("--deny-tool", "write");
  else args.push("--allow-tool", "write", "--allow-tool", "shell(npx vitest:*)", "--allow-tool", "shell(npx tsc:*)");
  for (const c of READS) args.push("--allow-tool", `shell(${c})`);
  return args;
}

/** The whole copilot argument array for a launch. */
export function copilotArgs({ mode, prompt, model, effort, share, addDirs = [] }) {
  const args = ["-p", prompt, "--model", model, "--no-ask-user", "--no-auto-update", "--disable-builtin-mcps", "--disallow-temp-dir"];
  if (effort) args.push("--reasoning-effort", effort);
  args.push(...permissionArgs(mode));
  if (mode === "build" && addDirs.length) throw new Error("a builder writes in its own worktree alone; --add-dir widens it");
  for (const d of addDirs) args.push("--add-dir", d);
  args.push("--share", share);
  for (const a of args) if (/^--(allow-all|yolo)/.test(a)) throw new Error(`a launch never widens the walls: ${a}`);
  return args;
}

const inside = (child, parent) => { const r = relative(parent, child); return r === "" || (!r.startsWith("..") && !isAbsolute(r)); };

/** Why this launch must not start, or null. `repo` is the main checkout. */
export function refusal({ mode, cwd, env, repo = REPO, tmp = tmpdir() }) {
  if (!cwd || !existsSync(cwd)) return `no working directory at ${cwd}`;
  // `--disallow-temp-dir` walls the system temp directory, the seat's own cwd included: a seat there reads blind.
  if (inside(realpathSync(cwd), realpathSync(tmp))) return `${cwd} sits in the system temp directory, which the seat cannot read; use a dir under ~/.lares-scratch`;
  if (mode !== "build") return null;
  const real = realpathSync(cwd);
  if (real === realpathSync(repo)) return "a builder never runs in the main checkout; provision a worktree (tools/provision-worktree.mjs)";
  if (!existsSync(join(real, ".git"))) return `${cwd} reads as no git worktree`;
  const root = env.LAR_ROOT;
  if (!root) return "a builder needs a scratch LAR_ROOT outside the repository";
  if (inside(resolve(root), realpathSync(repo)) || inside(resolve(root), real)) return `LAR_ROOT ${root} sits inside a checkout; use a scratch root outside it`;
  return null;
}

/** The environment a seat runs under: LAR_BAGS and COPILOT_ALLOW_ALL dropped. */
export function seatEnv(env) {
  const out = { ...env };
  delete out.LAR_BAGS;
  delete out.COPILOT_ALLOW_ALL;
  return out;
}

/** "<remaining>/<entitlement> (as of …, resets …)" from Copilot's entitlement cache, or why it cannot read. */
export function allowance(path = join(homedir(), ".cache/copilot/copilot-user-cache.json")) {
  try {
    const text = readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, "");
    // The cache nests its entries at whatever depth its version chose; every object carrying a premium snapshot counts.
    let newest = null;
    const walk = (o, depth) => {
      if (!o || typeof o !== "object" || depth > 6) return;
      const p = o.quota_snapshots?.premium_interactions;
      if (p) {
        const at = String(p.timestamp_utc ?? p.quota_reset_at ?? "");
        if (!newest || at > newest.at) newest = { p, at, reset: o.quota_reset_date };
        return;
      }
      for (const v of Object.values(o)) walk(v, depth + 1);
    };
    walk(JSON.parse(text), 0);
    if (!newest) return `no premium_interactions snapshot in ${path}`;
    return `${newest.p.quota_remaining}/${newest.p.entitlement}${newest.p.timestamp_utc ? ` (as of ${newest.p.timestamp_utc}` : " ("}${newest.p.timestamp_utc ? ", " : ""}resets ${newest.reset})`;
  } catch (error) {
    return `unreadable: ${error.message}`;
  }
}

function parse(argv) {
  const [mode, ...rest] = argv;
  const o = { mode, addDirs: [] };
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i], v = rest[i + 1];
    if (v === undefined) throw new Error(`${k} wants a value`);
    if (k === "--add-dir") o.addDirs.push(v);
    else if (["--name", "--model", "--cwd", "--brief", "--seat-dir", "--effort"].includes(k)) o[k.slice(2).replace("-dir", "Dir")] = v;
    else throw new Error(`unknown option ${k}`);
  }
  for (const k of ["name", "model", "cwd", "brief", "seatDir"]) if (!o[k]) throw new Error(`--${k === "seatDir" ? "seat-dir" : k} is required`);
  return o;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let o;
  try { o = parse(process.argv.slice(2)); } catch (e) { console.error(`[launch-copilot] ${e.message}`); process.exit(2); }
  const why = refusal({ mode: o.mode, cwd: o.cwd, env: process.env });
  if (why) { console.error(`[launch-copilot] refused: ${why}`); process.exit(2); }
  mkdirSync(o.seatDir, { recursive: true });
  const out = join(o.seatDir, `${o.name}.out.md`), log = join(o.seatDir, `${o.name}.log`), share = join(o.seatDir, `${o.name}.share.md`);
  let args;
  try { args = copilotArgs({ mode: o.mode, prompt: readFileSync(o.brief, "utf8"), model: o.model, effort: o.effort, share, addDirs: o.addDirs }); }
  catch (e) { console.error(`[launch-copilot] ${e.message}`); process.exit(2); }
  console.log(`allowance before: ${allowance()}`);
  const r = spawnSync("copilot", args, { cwd: o.cwd, env: seatEnv(process.env), stdio: ["ignore", openSync(out, "w"), openSync(log, "w")] });
  console.log(`${o.name} exit ${r.status ?? r.signal}${r.error ? ` (${r.error.message})` : ""}`);
  console.log(`allowance after: ${allowance()}`);
  process.exit(r.status ?? 1);
}
