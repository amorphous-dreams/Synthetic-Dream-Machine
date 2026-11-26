#!/usr/bin/env node
/**
 * summon-launch — the house's launch cap: one host process started for one hash-pinned mandate (plan/mandate-summons).
 *
 *   node tools/summon-launch.mjs --cap claude-cli --prompt '<the one line>' [--model <slug>] [--allowed-tools <rules>] [--cwd <dir>] [--log <file>] [--dry-run]
 *
 * A launch cap gates a host process, so it stands here beside the floor; everything a wiki can hold (the mandate's shape, its
 * hash, the edge, the lane ceiling, the custody read) stands in `@lararium/mesh/spirit-summons` and `lares spirit summon`.
 *
 * THE CAP CARRIES ONE LINE AND A MODEL, NOTHING ELSE. The prompt reads
 *   wake as <pet>#<n>: lares spirit om <pet> --mandate <lar uri>@<64 hex> [--face <N>]
 * and any other prompt refuses (`launch-prompt-malformed`), so no brief rides the harness: the instance reads its seed, its card
 * and its affordances from the house. `WAKE_LINE` carries the same pattern as the mesh core's (`spirit-summons.ts`); this
 * tool's suite reads that source and the core's suite runs its `wakeLine` through `launchPlan`, so neither drifts alone.
 *
 * THE REACH RIDES IN FROM THE HOUSE. A headless process holds no hand to answer a permission ask, so a tool its settings never
 * allowed gets denied. `lares spirit summon` resolves the instance's reach (the guest's reach, the one table `GUEST_REACH` in
 * the mesh core, as the mandate's hash-covered `allowed-tools` narrowed or widened it) and hands it here as
 * `--allowed-tools <rules>`, which passes through to the binary exactly; this tool keeps no table of its own, so the reach
 * widens in one place. A bare run naming none passes no permission flag. A value outside `ALLOWED_TOOLS` refuses
 * `launch-allowed-tools-malformed`. The cap passes no permission mode and skips no check.
 *
 *   claude-cli   `claude -p <the one line> [--allowedTools <rules>] [--model <slug>]`, detached, in `--cwd` (default: the
 *                caller's; a directory the host holds none of refuses `launch-workdir-absent`), its stream appended to `--log`
 *
 * It prints one JSON line: `{"ok":true,"cap":…,"pid":…,"argv":[…]}`, or `{"ok":false,"code":…,"message":…}` with exit 2.
 * `--dry-run` prints the argv and spawns nothing. Every reader injects (`deps.spawn`), so a test starts no model.
 */
import { spawn as nodeSpawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** The one line a launch carries (the mesh core's `wakeLine` writes it). */
export const WAKE_LINE = /^wake as ([a-z0-9][a-z0-9-]{0,62})#([A-Za-z0-9_-]{1,128}): lares spirit om ([a-z0-9][a-z0-9-]{0,62}) --mandate (lar:\/\/\/[^\s@]+)@([0-9a-f]{64})(?: --face (0|[1-9][0-9]{0,5}))?$/;
/** A model's slug: it leads with a letter or digit, so it never reads as a flag. */
export const MODEL_SLUG = /^[A-Za-z0-9][A-Za-z0-9._:[\]-]{0,63}$/;

/** The tool rules a mandate names (the mesh core carries the same pattern): comma-joined `Tool` or `Tool(spec)`, so the value rides one argv word and never reads as a flag. */
export const ALLOWED_TOOLS = /^[A-Za-z][A-Za-z0-9_]{0,63}(?:\([^(),\n]{1,200}\))?(?:,[A-Za-z][A-Za-z0-9_]{0,63}(?:\([^(),\n]{1,200}\))?){0,63}$/;

/** Each launch cap: the binary it starts and the argv it builds from the one line and the model. */
export const LAUNCH_CAPS = {
  "claude-cli": { bin: "claude", argv: (prompt, model, allowedTools) => ["-p", prompt, ...(allowedTools ? ["--allowedTools", allowedTools] : []), ...(model ? ["--model", model] : [])] },
};

export class LaunchRefused extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** The command a launch runs, checked: a cap this table names, the one line, a model slug. */
export function launchPlan({ cap, prompt, model = null, allowedTools = null }) {
  const held = Object.hasOwn(LAUNCH_CAPS, cap ?? "") ? LAUNCH_CAPS[cap] : null;
  if (held === null) throw new LaunchRefused("launch-cap-unknown", `launch-cap-unknown: this host holds ${Object.keys(LAUNCH_CAPS).join(", ")}, and the launch names "${cap ?? ""}"; nothing started. Name one: --cap ${Object.keys(LAUNCH_CAPS)[0]}`);
  const m = WAKE_LINE.exec(prompt ?? "");
  if (m === null || m[1] !== m[3]) throw new LaunchRefused("launch-prompt-malformed", "launch-prompt-malformed: a launch carries the one wake line alone (`wake as <pet>#<n>: lares spirit om <pet> --mandate <uri>@<hash>`); nothing started. Start an instance through its mandate: `lares spirit summon <pet>#<n> --mandate <uri>@<hash>`");
  if (model !== null && !MODEL_SLUG.test(model)) throw new LaunchRefused("launch-model-malformed", "launch-model-malformed: --model names a slug (letters, digits, `.`, `_`, `:`, `-`); nothing started. Name the model as the mandate does: --model <slug>");
  if (allowedTools !== null && !ALLOWED_TOOLS.test(allowedTools)) throw new LaunchRefused("launch-allowed-tools-malformed", "launch-allowed-tools-malformed: --allowed-tools names comma-joined tool rules (`Tool` or `Tool(spec)`, no blank line, no nested parenthesis); nothing started. Land the mandate again naming them: `lares spirit mandate <pet>#<n> --file <carrier> --allowed-tools 'Bash(lares:*)'`");
  return { cap, bin: held.bin, argv: held.argv(prompt, model, allowedTools), instance: `${m[1]}#${m[2]}`, mandate: `${m[4]}@${m[5]}` };
}

/**
 * Start the process, detached, and answer once it stands or fails to: `{pid}` on the child's `spawn` event, a refusal
 * (`launch-cap-absent`) where the host holds no such binary, (`launch-workdir-absent`) where it holds no such directory,
 * (`launch-log-unwritable`) where the log takes no append. The child outlives this tool; its output appends to `log` where one
 * rides (its directory made where absent), else lands nowhere (the instance hands back through the house).
 */
export function launch(plan, { cwd = process.cwd(), log = null } = {}, deps = {}) {
  const spawn = deps.spawn ?? nodeSpawn;
  const holdsDir = deps.holdsDir ?? ((dir) => { try { return statSync(dir).isDirectory(); } catch { return false; } });
  const openLog = deps.openLog ?? ((file) => { mkdirSync(dirname(file), { recursive: true }); return openSync(file, "a"); });
  if (!holdsDir(cwd)) return Promise.reject(new LaunchRefused("launch-workdir-absent", `launch-workdir-absent: this host holds no directory at ${cwd}, so nothing started. Make it, or land the mandate again naming one that stands: \`lares spirit mandate <pet>#<n> --file <carrier> --workdir /absolute/path\``));
  let out = "ignore";
  if (log !== null) {
    try { out = openLog(log); }
    catch (error) { return Promise.reject(new LaunchRefused("launch-log-unwritable", `launch-log-unwritable: the log ${log} took no append (${String(error?.message ?? error)}), so nothing started. Land the mandate again naming a file this host writes: \`lares spirit mandate <pet>#<n> --file <carrier> --log /absolute/file\``)); }
  }
  return new Promise((resolve, reject) => {
    let child;
    const done = () => { if (typeof out === "number") closeSync(out); };
    try { child = spawn(plan.bin, plan.argv, { cwd, detached: true, stdio: ["ignore", out, out], env: { ...process.env, LARES_SUMMONED: plan.instance } }); }
    catch (error) { done(); reject(new LaunchRefused("launch-cap-absent", `launch-cap-absent: \`${plan.bin}\` started nothing on this host (${String(error?.message ?? error)}). Check the binary: \`command -v ${plan.bin}\``)); return; }
    child.once("error", (error) => { done(); reject(new LaunchRefused("launch-cap-absent", `launch-cap-absent: \`${plan.bin}\` started nothing on this host (${String(error?.message ?? error)}). Check the binary: \`command -v ${plan.bin}\``)); });
    child.once("spawn", () => { done(); child.unref?.(); resolve({ pid: child.pid ?? null }); });
  });
}

function parse(argv) {
  const o = { cap: null, prompt: null, model: null, allowedTools: null, cwd: null, log: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { o.dryRun = true; continue; }
    const key = { "--cap": "cap", "--prompt": "prompt", "--model": "model", "--allowed-tools": "allowedTools", "--cwd": "cwd", "--log": "log" }[a];
    if (key === undefined || i + 1 >= argv.length) throw new LaunchRefused("usage", `usage: node tools/summon-launch.mjs --cap <cap> --prompt '<the one line>' [--model <slug>] [--allowed-tools <rules>] [--cwd <dir>] [--log <file>] [--dry-run] (got "${a}")`);
    o[key] = argv[++i];
  }
  return o;
}

export async function run(argv, deps = {}) {
  const say = deps.out ?? ((line) => process.stdout.write(`${line}\n`));
  try {
    const o = parse(argv);
    const plan = launchPlan(o);
    if (o.dryRun) { say(JSON.stringify({ ok: true, dryRun: true, cap: plan.cap, argv: [plan.bin, ...plan.argv] })); return 0; }
    const started = await launch(plan, { cwd: o.cwd ?? process.cwd(), log: o.log }, deps);
    say(JSON.stringify({ ok: true, cap: plan.cap, pid: started.pid, argv: [plan.bin, ...plan.argv] }));
    return 0;
  } catch (error) {
    if (!(error instanceof LaunchRefused)) throw error;
    say(JSON.stringify({ ok: false, code: error.code, message: error.message }));
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await run(process.argv.slice(2));
