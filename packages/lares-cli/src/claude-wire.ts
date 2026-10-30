/**
 * claude-wire — `lares vessel stand --claude`: wire the Lares hooks into ~/.claude/settings.json (so a Claude
 * harness auto-wakes on SessionStart and auto-keeps verbatim memory on Stop/SessionEnd) and register
 * the LARES MCP seat in ~/.claude.json (so recall reaches the memory sensorium THROUGH the lares
 * house). A harness reaches memory through that seat and holds no palace holder of its own: N sessions
 * on one Chroma index is the contention that truncates the HNSW segment.
 *
 * Pono shape: a DEEP MERGE that PRESERVES everything already in settings.json (the
 * operator's permissions, model, theme, …). Idempotent — a hook already pointing at
 * our script is left untouched. The hooks reference the repo's plugin scripts by
 * ABSOLUTE path (`${CLAUDE_PLUGIN_ROOT}` does not expand in settings.json), so the
 * plugin files stay in the repo; home just points at them. A `.bak` is written
 * before any change, and the result is JSON-validated before it replaces the file.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { repoRoot } from "@lararium/mesh/node";
import { claimName, NameHeld, type ClaimedName } from "@lararium/node";
import { resolveLaresMcp } from "./mcp-resolve.js";
import { liftSeedLines, mainCloneOf, tendSeatRule } from "./seed-seat.js";

/**
 * Acquire an exclusive write-lock to serialize concurrent writers — Claude's home JSON has a
 * logged corruption-under-concurrency bug (anthropics/claude-code#28842), and parallel sessions
 * share this tree.
 *
 * OS-NATIVE, NEVER A PID FILE (M6). A pid lockfile probed with `process.kill(pid, 0)` holds four
 * holes: (a) two contenders racing a dead holder's steal (`rmSync` then `wx`) can BOTH win, each
 * deleting the other's fresh lock; (b) a crash between the file's create and its pid write leaves an
 * unparseable lock that reads "indeterminate, never steal" FOREVER — a permanent wedge only a hand
 * `rm` clears; (c) pid reuse makes a dead holder read alive; (d) a holder in another pid namespace (a
 * container, the WSL/Windows split sharing `~/.claude`) reads dead while alive. The house's own socket-claim primitive (`claimName`, extracted from `owned-store.ts`'s rendezvous
 * claim) has none of these: no pid is ever read, so neither reuse nor a namespace split can lie,
 * and the kernel's own listener state — not a file's parseable content — decides dead vs. live.
 */
export async function acquireLock(lockPath: string): Promise<ClaimedName> {
  const refuse = (): NameHeld => new NameHeld(
    `${lockPath} held by another writer — another \`lares vessel stand --claude\` is running; retry shortly`,
  );
  // A bounded retry, never an unbounded wait: each attempt either wins a REAL claim (nothing to
  // leak) or fails cleanly (nothing held) — so bounding the loop here, rather than asking
  // `claimName`'s own `await` option to wait out the holder, never strands an acquired-but-abandoned
  // claim behind a timeout race.
  for (let i = 0; i < 50; i++) {
    try { return await claimName(lockPath, { refuse }); }
    catch (err) {
      if (!(err instanceof NameHeld)) throw err;
      await new Promise((r) => setTimeout(r, 100)); // async backoff — never blocks the main thread
    }
  }
  throw refuse();
}

/**
 * Register the LARES MCP seat in the store Claude Code actually reads (~/.claude.json, via
 * `claude mcp add`) — NOT settings.json, which Claude ignores for mcpServers.
 *
 * The lares house owns this seat: the harness reaches memory THROUGH it (recall · recall_structure ·
 * the sensorium lifecycle — the list lives in `lares_mcp.py`, never transcribed) rather than opening a palace of
 * its own. One owner, one writer.
 *
 * Idempotent by CONVERGENCE, never by presence: an aligned seat passes untouched, a drifted one re-aims
 * at the resolved script. Graceful when the `claude` CLI is absent.
 */
function registerLaresMcp(): ClaudeWireStep {
  const mcp = resolveLaresMcp();
  if (mcp === null) {
    return { item: "mcp:lares", action: "missing-script", detail: "lares_mcp.py / python / sensorium not found — run `lares vessel stand --init`" };
  }
  const got = spawnSync("claude", ["mcp", "get", "lares"], { encoding: "utf8", timeout: 10_000 });
  if (got.error !== undefined) {
    return { item: "mcp:lares", action: "missing-script", detail: "`claude` CLI not found — cannot register the lares seat" };
  }
  // A registration STANDING never proves it points ANYWHERE real. Presence-idempotence lets a moved
  // holder script leave this seat aimed at a deleted file while the wire reports success — the harness
  // door shuts silently and every `vessel stand --init` after it skips the cure. So converge on the RESOLVED
  // spawn, never on mere presence: a seat whose command/script drifts from what resolves now gets
  // RE-POINTED (remove → re-add), and an aligned seat passes untouched.
  let repointed = false;
  if (got.status === 0) {
    const registered = String(got.stdout ?? "");
    const aligned = registered.includes(mcp.command) && mcp.args.every((a) => registered.includes(a));
    if (aligned) {
      return { item: "mcp:lares", action: "present", detail: "registered + aimed at the resolved sensorium seat" };
    }
    const rm = spawnSync("claude", ["mcp", "remove", "-s", "user", "lares"], { encoding: "utf8", timeout: 10_000 });
    if (rm.status !== 0) {
      return { item: "mcp:lares", action: "missing-script", detail: `stale seat drifted; \`claude mcp remove\` failed: ${(rm.stderr ?? "").trim().slice(0, 80)}` };
    }
    repointed = true;   // the stale seat cleared — the add below re-aims it at the resolved script
  }
  // Arg order matters: the NAME must precede `-e`. `claude mcp add`'s env flag is VARIADIC, so a
  // trailing positional after it gets swallowed as another KEY=VAL and rejected ("Invalid environment
  // variable format: lares"). The documented form is `claude mcp add <name> -e K=V -- <cmd> [args]`.
  const env = Object.entries(mcp.env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  const r = spawnSync("claude", ["mcp", "add", "--scope", "user", "lares", ...env, "--", mcp.command, ...mcp.args], { encoding: "utf8", timeout: 15_000 });
  return r.status === 0
    ? { item: "mcp:lares", action: "wired", detail: `${repointed ? "re-aimed a drifted seat" : "claude mcp add"} — the memory sensorium via ${mcp.args[0] ?? "lares_mcp.py"}` }
    : { item: "mcp:lares", action: "missing-script", detail: `claude mcp add failed: ${(r.stderr ?? "").trim().slice(0, 80)}` };
}

interface HookCommand {
  readonly type: string;
  readonly command: string;
  readonly args?: string[];
  readonly timeout?: number;
}
interface HookGroup {
  hooks?: HookCommand[];
  matcher?: string;
}
interface ClaudeSettings {
  hooks?: Record<string, HookGroup[]>;
  mcpServers?: Record<string, { command: string; args?: string[] }>;
  // Index signature preserves every other key (permissions, model, …) on re-serialize.
  [key: string]: unknown;
}

interface HookSpec {
  readonly event: string;
  readonly script: string; // repo-relative path to the hook
  readonly timeout: number;
  /** node = exec-form, fully cross-platform; bash = needs Git-for-Windows on native Windows. */
  readonly runner: "node" | "bash";
}

const HOOK_SPECS: readonly HookSpec[] = [
  // The session-start hook is node (exec-form) → no shell, identical on Windows + Unix.
  { event: "SessionStart", script: "packages/lares-cli/.claude-plugin/hooks/lares-wake-hook.mjs", timeout: 15, runner: "node" },
  // OUR two-leg ingest hook (per-project mine + lar_* declared writeback), NOT the
  // submodule's hardcoded `--wing sessions` hook. mempalace's own plugin hooks still
  // fire, but `hooks.auto_save=false` (set by `--init`) makes them no-ops, so only
  // ours mines — into the right per-project wing. Stop catches mid-session; SessionEnd
  // finalizes. bash → needs Git-for-Windows on native Windows (Claude Code requires it).
  { event: "Stop", script: "packages/lares-cli/.claude-plugin/hooks/lares-mempalace-ingest-hook.sh", timeout: 30, runner: "bash" },
  { event: "SessionEnd", script: "packages/lares-cli/.claude-plugin/hooks/lares-mempalace-ingest-hook.sh", timeout: 60, runner: "bash" },
];

/**
 * The retention floor for `cleanupPeriodDays` — how many days Claude Code keeps a session
 * file before deleting it at startup (docs: default 30, minimum 1, `0` REJECTED as invalid,
 * so a large finite number is the only "keep forever" idiom). 99999 ≈ 274 years.
 *
 * Those session files (~/.claude/projects/…) ARE the mempalace's verbatim-memory harvest
 * source; a low cleanup window evaporates the raw ground before the ingest hook mines it,
 * so `lares vessel stand --claude` raises the floor as part of standing the memory shore.
 */
export const CLEANUP_PERIOD_DAYS_FLOOR = 99999;

export type WireAction = "wired" | "present" | "missing-script";

export interface ClaudeWireStep {
  readonly item: string;
  readonly action: WireAction;
  readonly detail: string;
}

export interface ClaudeWireResult {
  readonly settingsPath: string;
  readonly backedUp: boolean;
  readonly changed: boolean;
  readonly steps: readonly ClaudeWireStep[];
}

/** Wire the plugin hooks + the lares MCP seat into ~/.claude/settings.json. Idempotent; preserves existing settings. */
export async function wireClaudeHome(opts: { home?: string } = {}): Promise<ClaudeWireResult> {
  const home = opts.home ?? homedir();
  const claudeDir = join(home, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  const settingsPath = join(claudeDir, "settings.json");
  const lockPath = settingsPath + ".lock";
  const lock = await acquireLock(lockPath);
  try {
    return wireUnderLock(settingsPath);
  } finally {
    await lock.release();
  }
}

/** The read-modify-write body, run under the settings.json lock. */
function wireUnderLock(settingsPath: string): ClaudeWireResult {
  let settings: ClaudeSettings = {};
  let backedUp = false;
  if (existsSync(settingsPath)) {
    let raw: string;
    try {
      raw = readFileSync(settingsPath, "utf8");
      settings = JSON.parse(raw) as ClaudeSettings;
    } catch {
      throw new Error(`${settingsPath} is not valid JSON — refusing to overwrite (fix it, then re-run \`lares vessel stand --claude\`)`);
    }
    copyFileSync(settingsPath, settingsPath + ".bak");
    backedUp = true;
  }

  const steps: ClaudeWireStep[] = [];
  let changed = false;

  const hooks = (settings.hooks ??= {});
  for (const spec of HOOK_SPECS) {
    // Forward-slash the absolute path: works in JSON, node, and bash on every OS
    // (Windows backslashes break bash-arg + JSON-string handling).
    const abs = join(repoRoot, spec.script).replace(/\\/g, "/");
    const base = spec.script.slice(spec.script.lastIndexOf("/") + 1);
    if (!existsSync(abs)) {
      steps.push({ item: spec.event, action: "missing-script", detail: `${abs} not found — skipped` });
      continue;
    }
    // No chmod: node/bash invoke the file by path, so +x is not required — and
    // chmod'ing would dirty the read-only mempalace submodule.
    const groups = (hooks[spec.event] ??= []);
    const mentions = (h: HookCommand): boolean =>
      (typeof h.command === "string" && h.command.includes(base)) ||
      (Array.isArray(h.args) && h.args.some((a) => typeof a === "string" && a.includes(base)));
    const already = groups.some((g) => g.hooks?.some(mentions));
    if (already) {
      steps.push({ item: spec.event, action: "present", detail: `${base} already wired (${spec.runner})` });
      continue;
    }
    const entry: HookCommand =
      spec.runner === "node"
        ? { type: "command", command: "node", args: [abs], timeout: spec.timeout }
        : { type: "command", command: `bash "${abs}"`, timeout: spec.timeout };
    groups.push({ hooks: [entry] });
    steps.push({ item: spec.event, action: "wired", detail: `${spec.runner}: ${abs}` });
    changed = true;
  }

  // ⚠ THE ONE SETTING THIS HOUSE RAISES RATHER THAN OFFERS (operator ruling).
  //
  // Everything else here yields to a value the operator already chose. This one cannot: the session
  // files under ~/.claude/projects ARE the mempalace's verbatim harvest source, and MEMORY RECOVERS
  // FROM DISK. A short cleanup window evaporates the raw ground before the ingest hook mines it, so a
  // low value here does not degrade a convenience — it silently ends the house's ability to remember.
  //
  // So a value below the floor RISES to it, every install, every time. A value at or above the floor
  // stands: someone who chose to keep MORE serves this purpose better than we would by lowering them.
  const cur = settings["cleanupPeriodDays"];
  const held = typeof cur === "number" ? cur : null;
  if (held !== null && held >= CLEANUP_PERIOD_DAYS_FLOOR) {
    steps.push({ item: "cleanupPeriodDays", action: "present", detail: `${String(held)} days — at or above the floor` });
  } else {
    settings["cleanupPeriodDays"] = CLEANUP_PERIOD_DAYS_FLOOR;
    steps.push({
      item: "cleanupPeriodDays",
      action: "wired",
      detail: held === null
        ? `set ${CLEANUP_PERIOD_DAYS_FLOOR} (session files kept ~forever — the mempalace harvest source)`
        : `raised ${String(held)} → ${CLEANUP_PERIOD_DAYS_FLOOR} (memory recovers from these files; a short window loses it)`,
    });
    changed = true;
  }

  // Memory reaches the harness through the LARES seat, never a palace holder of the harness's own.
  steps.push(registerLaresMcp());

  // The seed seat. The operator's home seats the house through one owned rule importing the main
  // clone's link (lar:///ha.ka.ba/lares/docs/pono/seed-seat); the repo excludes that rule, so inside the
  // clone a session seats its own tree's seed alone. A seed line in ~/.claude/CLAUDE.md lifts.
  const claudeHome = dirname(settingsPath);
  for (const step of [
    liftSeedLines(join(claudeHome, "CLAUDE.md"), "CLAUDE.md"),
    tendSeatRule(dirname(claudeHome), mainCloneOf(repoRoot)),
  ]) {
    steps.push(step);
    if (step.action === "wired") changed = true;
  }

  if (changed) {
    const tmp = settingsPath + ".tmp";
    const serialized = JSON.stringify(settings, null, 2) + "\n";
    writeFileSync(tmp, serialized, "utf8");
    JSON.parse(readFileSync(tmp, "utf8")); // validate before replacing
    renameSync(tmp, settingsPath);
  }

  return { settingsPath, backedUp, changed, steps };
}

/** Resolve ~/.claude/settings.json for the given (or default) home. */
function claudeSettingsPath(home?: string): string {
  return join(home ?? homedir(), ".claude", "settings.json");
}

/**
 * Read the current `cleanupPeriodDays` from ~/.claude/settings.json (pure inspection,
 * no lock). Returns the number, or null if unset / the file is absent-or-unreadable —
 * a null reads as "Claude's 30-day default applies" at the surface.
 */
export function readClaudeCleanupPeriod(opts: { home?: string } = {}): number | null {
  const path = claudeSettingsPath(opts.home);
  if (!existsSync(path)) return null;
  try {
    const s = JSON.parse(readFileSync(path, "utf8")) as ClaudeSettings;
    const v = s["cleanupPeriodDays"];
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

export interface CleanupPeriodResult {
  readonly settingsPath: string;
  readonly previous: number | null;
  readonly value: number;
  readonly changed: boolean;
}

/**
 * Set `cleanupPeriodDays` in ~/.claude/settings.json EXPLICITLY (operator intent — forces
 * the value even over an existing lower one, unlike the set-if-absent wire step). Same
 * lock + backup + validate-before-replace discipline as the wire flow. Rejects a value
 * below Claude's minimum of 1 (0 is invalid to Claude, and would evaporate everything).
 */
export async function setClaudeCleanupPeriod(days: number, opts: { home?: string } = {}): Promise<CleanupPeriodResult> {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`cleanupPeriodDays must be a whole number ≥ 1 (Claude rejects 0); got ${days}. Use a large number like ${CLEANUP_PERIOD_DAYS_FLOOR} to keep session files ~forever.`);
  }
  const settingsPath = claudeSettingsPath(opts.home);
  mkdirSync(join(opts.home ?? homedir(), ".claude"), { recursive: true });
  const lockPath = settingsPath + ".lock";
  const lock = await acquireLock(lockPath);
  try {
    let settings: ClaudeSettings = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
      } catch {
        throw new Error(`${settingsPath} is not valid JSON — refusing to overwrite (fix it, then re-run).`);
      }
      copyFileSync(settingsPath, settingsPath + ".bak");
    }
    const prev = typeof settings["cleanupPeriodDays"] === "number" ? (settings["cleanupPeriodDays"] as number) : null;
    settings["cleanupPeriodDays"] = days;
    const tmp = settingsPath + ".tmp";
    writeFileSync(tmp, JSON.stringify(settings, null, 2) + "\n", "utf8");
    JSON.parse(readFileSync(tmp, "utf8")); // validate before replacing
    renameSync(tmp, settingsPath);
    return { settingsPath, previous: prev, value: days, changed: prev !== days };
  } finally {
    await lock.release();
  }
}
