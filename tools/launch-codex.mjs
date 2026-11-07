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
 * supervisor (`--supervise`, the seat's parent: it spawns codex itself) tails the seat's rollout and stops it at its token ceiling (`--ceiling N`;
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
import { appendFileSync, closeSync, existsSync, readSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leadStepBrief, peekStep, writeState } from "./lane-state.mjs";
import { heldBytes } from "./held-dir.mjs";
import { brokerRootPath, checkGrantedRoots, checkBrokerRoot, checkBrokerRootSize, ensureBrokerRoot, newSeatDir } from "./broker-root.mjs";
import { HAVE_BWRAP } from "./seat-walls.mjs";
import { treeSharedInodes } from "./module-inodes.mjs";
import { copyBack, heldOver, moveAside, removeHeldContents, mkdirHeld, openHeldSync, openLogHeld, readHeld, writeHeld } from "./held-dir.mjs";
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
/** A reader of one rollout's running token total that reads only the bytes appended since its last call; `.fresh` marks a call that parsed a new token_count event. */
export function tokenTail(file) {
  let pos = 0, carry = "", total = null;
  const buf = Buffer.alloc(262144);
  const read = () => {
    let fresh = false;
    const fd = openSync(file, "r");
    try {
      for (;;) {
        const n = readSync(fd, buf, 0, buf.length, pos);
        if (n === 0) break;
        pos += n;
        carry += buf.toString("utf8", 0, n);
        const lines = carry.split("\n");
        carry = lines.pop();
        const t = rolloutTokens(lines);
        if (t !== null) { if (t !== total) fresh = true; total = t; }
      }
    } finally { closeSync(fd); }
    read.fresh = fresh;
    return total;
  };
  read.fresh = false;
  return read;
}

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

/** The text items of a rollout event's user-prompt field (a list, possibly empty), or null when the event holds no user prompt. */
function promptTexts(event) {
  const p = event?.payload;
  if (!p) return null;
  if (p.type === "user_message") return typeof p.message === "string" ? [p.message] : [];
  if (p.type === "message" && p.role === "user") return Array.isArray(p.content) ? p.content.map((c) => c?.text).filter((t) => typeof t === "string") : [];
  return null;
}

/** Whether an event shows a turn answered or ended: a token count, an assistant message, a completed or aborted task (harness items such as a developer tool list never count). */
function answers(event) {
  const p = event?.payload;
  if (!p) return false;
  if (event.type === "event_msg") return p.type === "token_count" || p.type === "task_complete" || p.type === "turn_aborted";
  return event.type === "response_item" && p.type === "message" && p.role === "assistant";
}

const SEAT_PROMPT = "SEAT-MARKER ";

/**
 * Whether the rollout at `file` names `marker`'s seat (true or false), or null while that stands undecided. The launcher
 * writes the marker as the FIRST line of the seat's prompt, so the seat prompt reads as the first user-prompt text item
 * whose first line opens with `SEAT-MARKER `; it decides, true only when that line equals the marker. Every other user
 * text item (Codex's AGENTS.md project doc, its environment context, any harness block, a doc quoting a marker) decides
 * nothing, so the lookup holds no list of Codex's injection headers. An event showing the model answering with no seat
 * prompt ahead of it decides false (a session that no seat launched). Lines parse as JSONL events, no byte cap; an echoed
 * copy in tool output never counts; a file with no complete seat prompt and no answer yet reads as not yet.
 */
function rolloutHoldsMarker(file, marker) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(65536);
    let tail = Buffer.alloc(0), pos = 0;
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, pos);
      if (n === 0) return null;
      pos += n;
      tail = Buffer.concat([tail, buf.subarray(0, n)]);
      let nl;
      while ((nl = tail.indexOf(10)) !== -1) {
        const line = tail.subarray(0, nl).toString("utf8");
        tail = tail.subarray(nl + 1);
        if (!line.trim()) continue;
        let event; try { event = JSON.parse(line); } catch { continue; }
        const texts = promptTexts(event);
        if (texts === null) { if (answers(event)) return false; continue; }
        for (const text of texts) {
          const first = text.split("\n", 1)[0].trim();
          if (first.startsWith(SEAT_PROMPT)) return first === marker;
        }
      }
    }
  } finally { closeSync(fd); }
}

/** The rollout of one seat: among the files NOT in `before` (the set the launcher listed ahead of the spawn), the one whose seat prompt (the first user text opening with `SEAT-MARKER `, past any injected context) carries the seat's own marker on its first line. The marker rides the prompt, so a rollout names its seat. */
export function findRollout(home, { marker, before, seen = new Set() }) {
  for (const p of listRollouts(home)) {
    if (before.has(p) || seen.has(p)) continue;
    try {
      const held = rolloutHoldsMarker(p, marker);
      if (held === true) return p;
      if (held === false) seen.add(p);
    } catch { /* unreadable or torn: tried again next tick */ }
  }
  return null;
}

/**
 * The supervisor's loop over injected readers. At its ceiling, or when no NEW token event shows for `blindTicks` ticks, or
 * on any error while watching, it writes ceiling.md FIRST (so a failing stop still names itself), then runs the ladder:
 * SIGTERM to the group, `graceTicks` of grace, SIGKILL to the group, `hardTicks` more. A stop counts only when `alive()`
 * reads false (the child's exit event landed); a signal that throws never counts as stopped. Returns "ceiling", "blind",
 * "error" or "exited" once stopped, "unstopped" when the child still lives after the ladder.
 */
export async function watchSeat({ seatDir, pid, ceiling, mode, tokens, advanced = () => true, alive, kill, sleep, note, over = () => null, graceTicks = 10, hardTicks = 20, blindTicks = 200 }) {
  let blind = 0;
  const writeNote = note ?? (() => {});
  const stop = async (why, verdict) => {
    try { writeNote(`# Ceiling reached\n\nThe ${mode} seat (pid ${pid}) ${why} The supervisor stops it (SIGTERM, then SIGKILL, then waits for the exit).\n`); } catch { /* the stop still runs */ }
    try { kill("SIGTERM"); } catch { /* the ladder goes on */ }
    try { for (let i = 0; i < graceTicks && alive(); i++) await sleep(); } catch { /* fall through to SIGKILL */ }
    try { if (alive()) kill("SIGKILL"); } catch { /* the hard wait below decides */ }
    try { for (let i = 0; i < hardTicks && alive(); i++) await sleep(); } catch { /* alive() decides */ }
    return alive() ? "unstopped" : verdict;
  };
  try {
    while (alive()) {
      const tooBig = over();
      if (tooBig) return await stop(`${tooBig}.`, "size-ceiling");
      const t = tokens();
      // Blindness resets on a NEW token event only; a re-read of the last total is a stale reading.
      if (typeof t === "number" && advanced()) blind = 0; else blind++;
      if (typeof t === "number" && t >= ceiling) return await stop(`read ${t} total tokens in its rollout (total_token_usage.total_tokens, cached input counted) against a ceiling of ${ceiling}.`, "ceiling");
      if (blind >= blindTicks) return await stop(`showed no new token event for ${blindTicks} ticks (no reading, or a stale one), so no ceiling could be enforced (failing closed; ceiling ${ceiling}).`, "blind");
      await sleep();
    }
  } catch (error) {
    return await stop(`could not be watched (${error?.message ?? error}); failing closed.`, "error");
  }
  return "exited";
}

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
* You hold no git write access and no credential. Every git act goes through the broker: write a request file \`req-<id>.json\` (zero-padded, in order) into \`<lane-root>/relay/\` and read your own \`res-<id>.json\` in the same step: use \`node tools/wait-receipt.mjs <lane-root>/relay/res-<id>.json\` for an event wait for the file to appear, bounded by a named \`// LIVENESS: ... broker ... died\` timeout. Never poll for a receipt; never poll or wait inside your context for a seat. The doors are \`commit\` (\`paths\`, the commit message as inline \`message\` text up to 16 KiB, and \`expectHead\`), \`push\` (only when the controller's go names the branch and the head), \`worktree\`, \`worktree-remove\`, \`install\`, \`launch\` and \`test\` (\`runner\` Node or Vitest, nonempty named \`files\`).
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
  // Only one just-started rollout may lack a reading. A burst cannot reuse an arbitrarily old record.
  for (const [index, [, file]] of files.slice(0, 2).entries()) {
    try {
      const lines = readFileSync(file, 'utf8').split('\n').filter(line => line.includes('"rate_limits"'));
      if (readPool(lines)) return lines;
    } catch { /* an unreadable rollout carries no usable reading */ }
    if (index === 1) throw refuse("Codex pool unavailable: more than one newest rollout lacks a readable rate_limits record; wait for a recorded reading");
  }
  return null;
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
    rolloutLines: () => { try { return newestRolloutLines(home); } catch (error) { if (error.refused) throw error; return null; } },
    distFresh: (wt) => { try { return distFresh(wt); } catch { return false; } },
    sharedInodes: (wt) => { try { return treeSharedInodes(wt); } catch (error) { return `module farms unreadable: ${error.message}`; } },
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
  try { checkGrantedRoots(scratch, [there]); } catch (e) { throw refuse(e.message); }
  if (!briefless && !existsSync(join(seatDir, "brief.md"))) throw refuse(`no ${join(seatDir, "brief.md")}`);
  if (!MODES.includes(mode)) throw refuse("mode must be build, lead, read or research");
  if (model === "gpt-6-sol") throw refuse("gpt-6-sol never launches; use gpt-6.1-sol");
  const cache = readers.modelsCache();
  if (!cache || !new RegExp(`"slug": *"${model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(cache)) throw refuse(`model ${model} is not in Codex's models cache`);
  // An empty read names itself and reads once more; it never stands in for a pool at zero.
  const pool = readPool(readers.rolloutLines(), mode) ?? readPool(readers.rolloutLines(), mode);
  if (!pool) throw refuse("Codex pool line unreadable (no readable rate_limits record within the one-rollout fallback, read twice); read it by hand before launching");
  if (!pool.above) throw refuse(`Codex pool at or below its floor: ${pool.summary}`);
  if (MAX_USED[mode] !== undefined && pool.used > MAX_USED[mode]) throw refuse(`Codex pool used ${pool.used.toFixed(1)}%, above the ${mode} seat's ${MAX_USED[mode]}% used ceiling: ${pool.summary}`);
  if (mode === "build" || mode === "lead") {
    const role = mode === "lead" ? "lead" : "builder";
    if (!worktree) throw refuse(`a ${role} needs its worktree`);
    if (real(worktree) === real(readers.repo)) throw refuse(`a ${role} never writes the main checkout`);
    try { checkGrantedRoots(scratch, [real(worktree)]); } catch (e) { throw refuse(e.message); }
    if (!real(worktree).startsWith(`${scratch}/`)) throw refuse(`a ${role} worktree must sit under ${scratch}/ (the house law; a granted root outside it could be an ancestor of the broker root): ${worktree}`);
    // The wall never rests on how the tree was installed: a module file sharing an inode with another tree refuses by name.
    const shared = readers.sharedInodes(worktree);
    if (shared) throw refuse(`the ${role} worktree's ${shared}`);
    if (mode === "build" && !readers.distFresh(worktree)) throw refuse(`the worktree's dist is stale (or unreadable): the lead runs 'pnpm build' in ${worktree} before launching a build seat`);
  }
  return { pool: pool.summary };
}

function parse(argv) {
  const o = { dryRun: false };
  const keys = { "--mode": "mode", "--model": "model", "--effort": "effort", "--seat-dir": "seatDir", "--worktree": "worktree", "--ceiling": "ceiling", "--marker": "marker", "--held-fd": "heldFd", "--home": "home", "--blind-ticks": "blindTicks", "--lane-fd": "laneFd", "--done-name": "doneName", "--bsd-path": "bsdPath", "--contain": "contain", "--lane-root": "laneRoot" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") o.dryRun = true;
    else if (argv[i] === "--supervise") o.supervise = true;
    else if (argv[i] === "--") { o.rest = argv.slice(i + 1); break; }
    else if (argv[i] === "--lead-step") o.leadStep = true;
    else if (argv[i] === "--canary") o.canary = true;
    else if (argv[i] === "--check-canary") o.checkCanary = true;
    else if (keys[argv[i]]) { if (argv[i + 1] === undefined) throw new Error(`${argv[i]} wants a value`); o[keys[argv[i]]] = argv[++i]; }
    else throw new Error(`unknown option ${argv[i]}`);
  }
  if (o.supervise) return o;
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

/**
 * The supervisor: the seat's PARENT. It spawns codex itself, so the child's pid stays its own until the supervisor reaps it
 * (no reuse, no looked-up pid), and it works only through the seat directory the launcher held open and handed down as an
 * inherited fd (run.log, ceiling.md, the prompt and the snapshot all go through it, never a pathname). It tails the seat's
 * rollout until the seat exits, crosses its ceiling, or goes blind; a watch that ends with the child alive gets a SIGKILL
 * to its own child and waits for the exit event.
 */
/**
 * Signal a process GROUP, never "every process": `kill(-1)` reaches every process the user owns (it killed the
 * operator's systemd user manager, VS Code and Claude Code twice on 2026-11-04, from a test fake whose pid was 1),
 * and `kill(-0)` reaches the caller's own group. A pgid that is not an integer above 1 refuses by name.
 */
export function killGroup(pgid, sig) {
  if (!Number.isInteger(pgid) || pgid <= 1) throw new Error(`killGroup refuses pgid ${pgid}: only an integer above 1 names one process group`);
  process.kill(-pgid, sig);
}

const SEAT_MAX_BYTES = 2 * 1024 ** 3;

export async function superviseSeat(o, deps = {}) {
  // EVERY exit path ends in `finish`: the full completion marker and the broker seat dir's fate (removed, or kept and named while its group still lives).
  const st = { verdict: "error", exitCode: null, copied: [], handbackError: null, error: null, kept: null, pgid: null };
  let thrown = null;
  try { await superviseInner(o, deps, st); } catch (error) {
    thrown = error; st.error = String(error?.message ?? error);
    if (st.verdict === "error") st.verdict = "supervisor-error";
  } finally { finish(o, deps, st); }
  if (thrown) throw thrown;
  return st.verdict;
}

function finish(o, deps, st) {
  const groupAlive = deps.groupAlive ?? ((pgid) => { try { killGroup(pgid, 0); return true; } catch (error) { return error.code !== "ESRCH"; } });
  const live = st.pgid !== null && groupAlive(st.pgid);
  if (o.bsdPath) {
    if (live) st.kept = o.bsdPath; // nothing alive loses its cwd
    else { try { removeHeldContents(o.held); rmdirSync(o.bsdPath); } catch (error) { st.kept = o.bsdPath; st.cleanupError = String(error?.message ?? error); } } // broker-owned
  }
  // The completion marker is written LAST, so a wait on it never reads a stale or partial hand-back.
  if (o.laneHeld && o.doneName) {
    const body = { verdict: st.verdict, exitCode: st.exitCode, copied: st.copied, finalMd: st.copied.includes("final.md"), handbackError: st.handbackError, error: st.error, kept: st.kept };
    try { writeHeld(o.laneHeld, o.doneName, `${JSON.stringify(body)}\n`, "x"); } catch { /* the wait also watches the pid */ }
  }
}

async function superviseInner(o, deps, st) {
  // A test injects `signal` (it receives the negated pgid); the real path signals the group through killGroup alone.
  const signal = deps.signal ?? ((negPgid, sig) => killGroup(-negPgid, sig));
  const hit = (pgid, sig) => signal(-pgid, sig);
  const groupAlive = deps.groupAlive ?? ((pgid) => { try { killGroup(pgid, 0); return true; } catch (error) { return error.code !== "ESRCH"; } });
  const held = o.held;
  const marker = o.marker, before = new Set(JSON.parse(readHeld(held, "rollouts-before.json"))), home = o.home ?? realHome();
  const prompt = readHeld(held, "prompt.txt");
  const logFd = openLogHeld(held, "run.log");
  // Inside a PID namespace (bwrap --unshare-pid): when the namespace's init dies, EVERY descendant dies with it, setsid or not, so the child's exit reads as the whole seat's end.
  const command = o.contain ? ["/usr/bin/bwrap", ["--unshare-pid", "--die-with-parent", "--dev-bind", "/", "/", "--proc", "/proc", "codex", ...(o.rest ?? []), prompt]] : ["codex", [...(o.rest ?? []), prompt]];
  const child = (deps.spawn ?? nodeSpawn)(command[0], command[1], { cwd: held.at(), env: o.env ?? process.env, detached: true, stdio: ["ignore", logFd, logFd] });
  st.pgid = child.pid;
  let exited = false;
  // The moment the child's exit lands, its process group gets SIGKILL (ESRCH is fine): a descendant that outlives its parent dies here, before the pgid could be reused.
  const gone = new Promise((resolve) => {
    const done = (code) => { if (typeof code === "number") st.exitCode = code; if (!exited) { exited = true; try { hit(child.pid, "SIGKILL"); } catch { /* an empty group */ } } resolve(); };
    child.on("exit", done); child.on("error", () => done(null));
  });
  let tail = null;
  const seen = new Set();
  const maxBytes = o.maxBytes ?? (Number(process.env.LARES_SEAT_MAX_BYTES) || SEAT_MAX_BYTES);
  let verdict = "error";
  try {
    verdict = await watchSeat({
      seatDir: undefined, pid: child.pid, ceiling: Number(o.ceiling), mode: o.mode, blindTicks: o.blindTicks, graceTicks: o.graceTicks, hardTicks: o.hardTicks,
      alive: () => !exited,
      kill: (sig) => { if (!exited) signal(-child.pid, sig); },
      sleep: deps.sleep ?? (() => new Promise((r) => setTimeout(r, 3000))),
      note: (text) => writeHeld(held, "ceiling.md", text),
      over: () => { const bytes = heldBytes(held); return bytes > maxBytes ? `wrote ${bytes} bytes into its seat dir, over the ${maxBytes}-byte bound` : null; },
      tokens: () => { if (!tail) { const file = findRollout(home, { marker, before, seen }); if (file) tail = tokenTail(file); } return tail ? tail() : null; },
      advanced: () => Boolean(tail?.fresh),
    });
  } catch { /* the child is dealt with below */ }
  // The last resort uses the real group signal (not the injected one), then the child handle, so descendants die with it.
  if (!exited) { try { hit(child.pid, "SIGKILL"); } catch { /* the handle below */ } try { child.kill("SIGKILL"); } catch { /* gone */ } } // the handle is bound to this very child, so it can never reach another process
  await gone;
  // A stop reads as stopped only when the group answers ESRCH.
  for (let i = 0; i < (deps.groupPolls ?? 50) && groupAlive(child.pid); i++) { try { hit(child.pid, "SIGKILL"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, deps.pollMs ?? 100)); }
  if (groupAlive(child.pid)) { st.verdict = "unstopped"; return; }
  if (verdict === "unstopped") verdict = "forced";
  // A containment command that fails before Codex runs (no rollout ever matched, a nonzero exit) is a setup failure, never a finished seat.
  if (o.contain && st.exitCode !== 0 && !tail && verdict === "exited") verdict = "setup-failed";
  st.verdict = verdict;
  // The hand-back: Codex's own outputs sit in the broker-owned directory; they reach the lane's seat dir only now, through its held handle.
  if (o.laneHeld) { try { copyBack(held, o.laneHeld, st.copied); } catch (error) { st.handbackError = String(error?.message ?? error); } }
}

function superviseMain(o) {
  const held = heldOver(Number(o.heldFd));
  const laneHeld = o.laneFd ? heldOver(Number(o.laneFd)) : undefined;
  return superviseSeat({ held, laneHeld, doneName: o.doneName, bsdPath: o.bsdPath, contain: o.contain === "bwrap", marker: o.marker, home: o.home, ceiling: o.ceiling, mode: o.mode, rest: o.rest, blindTicks: o.blindTicks ? Number(o.blindTicks) : undefined }).then((v) => (["unstopped", "error", "setup-failed", "supervisor-error", "size-ceiling"].includes(v) ? 1 : 0), () => 1);
}

/** The launcher over injected readers, spawn and writers; returns the exit code. */
export function run(argv, { readers, spawn = nodeSpawn, log = console.log, err = console.error } = {}) {
  let o;
  try { o = parse(argv); } catch (e) { err(`[launch-codex] ${e.message}`); return 2; }
  if (o.supervise) return superviseMain(o);
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
  const guard = (fn) => { try { return fn(); } catch (e) { if (e.refused) throw e; throw refuse(e.message); } };
  let stepPlan, laneHeld;
  if (o.leadStep) {
    try {
      // The lane root is held open once: the state, the steps dir and the step claim all go through it.
      const laneRoot = real(o.laneRoot);
      laneHeld = openHeldSync(laneRoot, laneRoot);
      readers?.afterLaneHold?.();
      stepPlan = { ...peekStep(laneHeld, laneRoot), laneRoot };
      o.seatDir = stepPlan.stepDir;
    } catch (e) { laneHeld?.close(); err(`SEAT-REFUSED: ${e.message}`); return 2; }
  }
  const seatDir = real(o.seatDir);
  try {
    if (o.canary && o.mode !== "read") throw refuse("--canary only runs with --mode read");
    const ceiling = ceilingFor(o.mode, o.ceiling);
    if (o.blindTicks !== undefined) ceilingFor(o.mode, o.blindTicks);
    readers ??= realReaders();
    const worktree = o.worktree ? real(o.worktree) : undefined;
    const scratchReal = real(join(readers.realHome, ".lares-scratch"));
    if (stepPlan && !stepPlan.laneRoot.startsWith(`${scratchReal}/`)) throw refuse(`the lane root must sit under ${scratchReal}/<lane>: ${o.laneRoot}`);
    const { pool } = preflight({ ...o, seatDir, worktree, briefless: Boolean(stepPlan) }, readers);
    // THE SEAT RUNS IN A BROKER-OWNED DIRECTORY outside every lane tree: Codex's own writes (-o final.md, TMPDIR, run.log, ceiling.md) land where no lead can write, and reach the lane's seat dir only through the held hand-back copy.
    const laneDir = join(scratchReal, seatDir.slice(scratchReal.length + 1).split("/")[0]);
    // THE BROKER ROOT is fixed: no caller names it. It sits outside ~/.lares-scratch entirely; a dry run only checks what exists.
    const homeReal = real(readers.realHome);
    const root = brokerRootPath(homeReal, readers.brokerEnv ?? process.env);
    const guarded = [seatDir, worktree, stepPlan?.laneRoot, laneDir].filter(Boolean);
    guard(() => checkBrokerRoot(root, { realHome: homeReal, guarded }));
    const laneRoot = o.mode === "lead" ? (stepPlan?.laneRoot ?? dirname(seatDir)) : undefined;
    guard(() => checkGrantedRoots(scratchReal, [laneRoot]));
    log(pool);
    if (o.dryRun) { log(`DRY-RUN ${JSON.stringify(["codex", ...seatArgs({ ...o, seatDir: join(root, "seats", "seat-DRYRUN"), worktree, laneRoot, compactLimit: o.canary ? 50_000 : undefined }), "<brief>"])}`); return 0; }
    // A live seat runs inside a PID namespace or does not run: without the wall the launch refuses by name.
    if (!(readers.bwrap ?? HAVE_BWRAP)) throw refuse(`no wall available: refusing to launch the ${o.mode} seat in ${seatDir} uncontained (a descendant that leaves the process group would outlive it)`);
    guard(() => ensureBrokerRoot(root, { realHome: homeReal, guarded }));
    guard(() => checkBrokerRootSize(root, readers.maxGb));
    const bsdPath = guard(() => newSeatDir(root));
    const args = seatArgs({ ...o, seatDir: bsdPath, worktree, laneRoot, compactLimit: o.canary ? 50_000 : undefined });
    const doneName = `done-${randomUUID()}`;
    let held, bsd, launched = false;
    try {
      // The broker-owned seat dir comes first, so a refusal here spends no step and claims none.
      bsd = guard(() => openHeldSync(bsdPath, root));
      if (stepPlan) {
        guard(() => mkdirHeld(laneHeld, "steps"));
        const steps = guard(() => openHeldSync(laneHeld.at("steps"), stepPlan.laneRoot));
        try {
          // The dir is the claim: two launches reading the same counter cannot both make step N.
          try { mkdirSync(steps.at(basename(stepPlan.stepDir))); } catch (e) { throw refuse(`step ${stepPlan.n} is already claimed (${stepPlan.stepDir}): ${e.code ?? e.message}`); }
          held = guard(() => openHeldSync(steps.at(basename(stepPlan.stepDir)), stepPlan.laneRoot));
        } finally { steps.close(); }
        guard(() => writeHeld(held, "brief.md", leadStepBrief(stepPlan.state, { laneRoot: stepPlan.laneRoot, stepDir: stepPlan.stepDir })));
        guard(() => writeState(laneHeld, { ...stepPlan.state, step: stepPlan.n }));
      } else {
        held = guard(() => openHeldSync(seatDir, laneDir));
      }
      readers.afterHold?.();
      // An old hand-back moves aside through the held handle, so a wait never reads a stale result.
      guard(() => moveAside(held));
      if (o.canary) guard(() => writeHeld(held, "brief.md", canaryBrief()));
      const law = o.mode === "lead" ? leadLaw() : seatLaw(readers.canon());
      guard(() => mkdirHeld(bsd, ".tmp"));
      const brief = appendSeatLaw(guard(() => readHeld(held, "brief.md")), law, o.mode === "lead" ? "LEAD LAW" : "SEAT LAW");
      guard(() => writeHeld(held, "brief.md", brief));
      guard(() => writeHeld(held, "attempts.log", `attempt model=${o.model} effort=${o.effort} mode=${o.mode}\n`, "a"));
      const env = { ...process.env, HOME: readers.realHome, TMPDIR: join(bsdPath, ".tmp"), TMPPREFIX: join(bsdPath, ".tmp", "zsh") };
      const snapshot = JSON.stringify(listRollouts(readers.realHome));
      const marker = `SEAT-MARKER ${randomUUID()}`;
      for (const h of [held, bsd]) {
        guard(() => writeHeld(h, "rollouts-before.json", snapshot));
        guard(() => writeHeld(h, "marker.txt", `${marker}\n`));
        guard(() => writeHeld(h, "prompt.txt", `${marker}\n\n${brief}`));
        guard(() => writeHeld(h, "brief.md", brief));
      }
      // The supervisor is the seat's parent and spawns codex itself (see superviseSeat); it inherits the broker-owned directory as fd 3 and the lane's seat directory as fd 4 for the hand-back.
      const supervisor = spawn(process.execPath, [fileURLToPath(import.meta.url), "--supervise", "--held-fd", "3", "--lane-fd", "4", "--done-name", doneName, "--bsd-path", bsdPath, "--contain", "bwrap", "--ceiling", String(ceiling), "--mode", o.mode, "--marker", marker, "--home", readers.realHome, ...(o.blindTicks ? ["--blind-ticks", String(o.blindTicks)] : []), "--", ...args], { cwd: bsd.at(), env, detached: true, stdio: ["ignore", "ignore", "ignore", bsd.fd, held.fd] });
      supervisor.unref?.();
      launched = true;
      log(`SEAT-LAUNCHED ${seatDir} (${o.model} ${o.effort} ${o.mode}) pid ${supervisor.pid}; wait on: until [ -f ${join(seatDir, doneName)} ] || ! kill -0 ${supervisor.pid} (the completion marker, written last, carries the verdict; the hand-back is final.md beside it)`);
      return 0;
    } finally {
      held?.close(); bsd?.close(); laneHeld?.close();
      if (!launched) rmSync(bsdPath, { recursive: true, force: true }); // broker-owned
    }
  } catch (e) {
    laneHeld?.close();
    if (!e.refused) throw e;
    err(`SEAT-REFUSED: ${e.message}`);
    return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) Promise.resolve(run(process.argv.slice(2))).then((code) => process.exit(code));
