#!/usr/bin/env node
/**
 * land-train — land green lanes onto the span by ONE repo tool (controller-handoff#/the-lanes), the merge-queue way.
 *
 *   node tools/land-train.mjs [--plan] [--local] [flags] <suffix:pr:head:msgfile>...   land these lanes now
 *   node tools/land-train.mjs enqueue <suffix:pr:head:msgfile>...                       queue lanes for the next run
 *   node tools/land-train.mjs run [flags]                                               drain the queue
 *   node tools/land-train.mjs status                                                    exit 1 while a train flies
 *   flags: --span <branch> --queue <dir> --ship <dir> --scratch <dir> --k <n> --depth <n> --name <name>
 *   run from the main checkout, which stands on the span.
 *
 * A lane `<span>--<suffix>` enters on its own green (its CI at its exact head, read by tools/ci-verdict.mjs; a head whose push
 * changed ignored paths alone rides a CI-green lane ancestor). Its land message's subject carries ` — merge PR #<pr>` for its
 * own PR, so every later reader knows the commit for a land. No base is typed: each lane's base derives as its merge-base
 * with the span.
 *
 *   QUEUE   (the default) the train IS the chained land commits: one per lane, in owner order, each built by `git merge-tree`
 *           over the land before it (no worktree, no install, no build) with the lane's own message and parents
 *           (prev land, lane head). The chain head pushes to `<span>--train-<n>-<sha9>`; that sha's own CI run is the
 *           verdict, and on green the span FAST-FORWARDS to that exact sha under a lease: nothing lands that CI did not read.
 *           A red reruns its failed jobs once (the wait ends when the attempt advances), then bisects by halves over the
 *           chain's own commits (each one already a prefix train): a green prefix lands at once, and the culprit is named
 *           only between a green prefix and a red one whose green is a REAL run at that sha. A span head with no run of its
 *           own gets one (`gh workflow run CI`) before any lane takes blame; a red span pauses the queue and drops nothing.
 *           While train N verifies, train N+1 chains on N's head and pushes (`--depth`, default 2); a red N re-chains it.
 *           A conflict drops its lane, and every later lane carrying that lane's commits. A lane whose diff changes
 *           ignored paths alone refuses the queue (no run would come): it lands DIRECT, canon goes direct.
 *   DIRECT  one lane whose head already holds the span head lands with no train: the land commit takes the lane head's tree,
 *           which the lane's own CI already read.
 *   --local today's battery verifies the train in a provisioned worktree instead of the cloud, and keeps the road walk: the
 *           span may stand past the lanes' base only by LANDS or by ROAD commits read GREEN (an ignored-only one carried by
 *           its nearest green ancestor).
 *   --plan  prints the commits it would write; it pushes nothing.
 *
 * The security class: a lane whose own diff or whose LAND (each chain link's diff over the land before it: merge-tree and
 * `git merge` follow renames) meets tools/security-class-paths.json, both read `--no-renames --raw -z` (read
 * from the SPAN HEAD's tree, never the lane's: a glob in `paths`, or a `tokens` word anywhere in a path) lands only with a
 * SHIP the controller wrote, `<ship>/<suffix>-<full head sha>.md`, naming that sha and a `read:` line. Every mode checks.
 * SHIP guards against a mistake on a one-operator box, never against a hostile process running as the same user.
 *
 * The held-out gate: before a train builds on the span, the newest COMPLETED held-out run on the span must not read red,
 * and no more than M=3 lands may stand past the sha it covered; past that the queue waits on the held-out run in flight,
 * or pauses where none flies. No clock decides: every wait ends on a result (a verdict, an attempt, a run) or the process's
 * exit, and a train whose run never appears says `NO RUN YET <sha>` each round. The queue lock (`<queue>/lock`, a pid) of a
 * dead process is taken over, and a standing train ref that chains the queued lanes over the span resumes as it stands.
 *
 * Exit: 0 landed · 2 usage/identity/message/checkout/no common base/meme-only · 3 a head moved or the span moved by a non-land
 *       commit not read green (--local) · 4 merge conflict (--local) · 5 nothing landed (every lane red) or the chain broke
 *       · 6 disk floor, worktree cap or a run in flight on the span (--local, DIRECT), or the queue locked · 7 provision,
 *       install or build failed (--local) · 8 a lane not green · 10 UNREADABLE · 11 some landed, the rest dropped (each named)
 *       · 12 a security-class lane lacks its SHIP · 13 VOID (a train run cancelled clean, or its ref moved) · 14 some
 *       landed, dark queued entries skipped (kept queued) · 15 held-out red or lagging · 16 the span itself reads red.
 *
 * Author identity reads `git config user.name/email`. Disk floor: LARES_DISK_MIN_C_GB (60) and 40 on /. The Docker prune
 * stays the controller's own (an operator-scoped standing permission), outside this tool.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SPAN = "feature/green-jello-dinosaur-5";
const WORKTREE_CAP = 6;
const LAND_SUBJECT = " — merge PR #";
const FULL = /^[0-9a-f]{40}$/;

/** `suffix:pr:head:msgfile` → the lane's fields. */
export function parseSpec(spec) {
  const [suffix, pr, head, ...rest] = String(spec).split(":");
  const msg = rest.join(":");
  if (!suffix || !pr || !head || !msg) throw new Error(`lane spec "${spec}" wants suffix:pr:head:msgfile`);
  if (!/^\d+$/.test(pr)) throw new Error(`lane spec "${spec}": the pull request number reads digits`);
  if (!FULL.test(head)) throw new Error(`lane spec "${spec}": the head wants the full 40-hex head`);
  return { suffix, pr, head, msg };
}

/** A suite's verdict from its log and exit code: the tally decides, never the exit alone. */
export function readSuiteLog(text, exit) {
  const plain = String(text).replace(/\x1b\[[0-9;]*m/g, "");
  const lines = plain.split("\n").filter((l) => /^ *(Test Files|Tests) /.test(l));
  if (!lines.some((l) => /^ *Test Files /.test(l))) return { ok: false, why: "no tally: the log holds no `Test Files` line (a load throw can exit 0)" };
  const tally = lines.at(-1).trim().replace(/\s+/g, " ");
  if (lines.some((l) => / failed/.test(l))) return { ok: false, why: `failed tally: ${tally}`, tally };
  if (exit !== 0) return { ok: false, why: `exit ${exit} over a clean tally: ${tally}`, tally };
  return { ok: true, tally };
}

/** The packages two or more lanes both touch, from each lane's changed paths. */
export function sharedPackages(diffsByLane) {
  const seen = new Map();
  for (const files of Object.values(diffsByLane)) {
    for (const pkg of new Set(files.map((f) => /^packages\/[^/]+/.exec(f)?.[0]).filter(Boolean))) seen.set(pkg, (seen.get(pkg) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n >= 2).map(([pkg]) => pkg).sort();
}

export function diskRefusal({ cGb, rootGb }, env = process.env) {
  const minC = Number(env.LARES_DISK_MIN_C_GB ?? 60), minRoot = 40;
  return cGb >= minC && rootGb >= minRoot ? null : `DISK REFUSED: C: ${cGb}G, /: ${rootGb}G free (floors ${minC}G and ${minRoot}G)`;
}

export function worktreeCapRefusal(house) {
  return house <= WORKTREE_CAP - 1 ? null : `WORKTREE CAP: ${house} house worktrees stand; the train adds one past the cap of ${WORKTREE_CAP}. Remove a landed or idle lane worktree first.`;
}

export function spanPushRefusal(runs) {
  const live = runs.filter((r) => r.status !== "completed").length;
  return live === 0 ? null : `REFUSED: ${live} run(s) still in flight on the span; push after they complete`;
}

/** The unfinished runs of a landed lane branch at the pushed land sha: they measure a commit the span's own run already
 *  measures. With `sha`, a run of the lane's NEXT feature (another head) keeps running. */
export function runsToCancel(runs, sha) {
  return runs.filter((r) => r.status !== "completed" && (sha === undefined || r.headSha === sha)).map((r) => r.databaseId);
}

/** Every status that counts as a run in flight; the newest five runs say nothing of an older one still running. */
export const ACTIVE_STATUSES = ["queued", "in_progress", "waiting", "requested", "pending"];
export function activeRuns(gh, branch) {
  return ACTIVE_STATUSES.flatMap((status) => gh(["run", "list", "--branch", branch, "--status", status, "--limit", "100", "--json", "status"]));
}

/** `owner/name` of a GitHub remote url. */
export function repoOfRemote(url) {
  const m = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(String(url).trim());
  if (!m) throw new Error(`origin (${url}) names no GitHub repository`);
  return `${m[1]}/${m[2]}`;
}

/** The environment every `gh` call runs under: origin's repository (never an inherited GH_REPO) and the passwd home's gh config. */
export function ghEnv(env, home, slug) {
  return { ...env, HOME: home, GH_REPO: slug };
}

/** The two verdict words off a ci-verdict child's stdout and exit code; exit 4 with no word on a line is UNREADABLE. */
export function verdictWords(stdout, status) {
  const word = (re) => re.exec(stdout ?? "")?.[1]?.toLowerCase();
  let ci = word(/^ci-verdict: (GREEN|RED|UNREADABLE|UNREAD)\b/m), heldOut = word(/^held-out: (GREEN|RED|UNREADABLE|UNREAD)\b/m);
  if (status === 4) { ci ??= "unreadable"; heldOut ??= "unreadable"; }
  return { ci: ci ?? "unread", heldOut: heldOut ?? "unread" };
}

import { globToRegExp, onlyIgnoredPaths } from "./ci-ignored-paths.mjs";
import { classifyFailure } from "./ci-verdict.mjs";

const short = (sha) => String(sha).slice(0, 9);
const isAncestor = (git, a, b) => { try { git(["merge-base", "--is-ancestor", a, b]); return true; } catch { return false; } };

const touchesIgnoredOnly = (git, c) => onlyIgnoredPaths(git(["diff-tree", "-z", "--no-commit-id", "--name-only", "-r", "-m", "--first-parent", c]).split("\0").filter(Boolean));
/** The nearest first-parent ancestor of `c` reading GREEN at its sha, or null where a commit between holds a run that is not green or touches code. */
async function greenAncestor(ops, git, branch, c, { lane = false } = {}) {
  for (const a of git(["rev-list", "--first-parent", "-n", "50", `${c}^`]).split("\n").filter(Boolean)) {
    const v = await settled(ops, branch, a, { lane });
    if ((lane ? classifyLane(v) : classify(v)) === "green") return a;
    if (!(v.ci === "unread" && touchesIgnoredOnly(git, a))) return null;
  }
  return null;
}

/** A lane or road verdict read until it stops reading UNREADABLE (six reads, thirty seconds apart). */
async function settled(ops, branch, sha, { lane = false } = {}) {
  let v;
  for (let i = 0; i < 6; i++) {
    v = await ops.verdict(branch, sha);
    if (lane ? v.ci !== "unreadable" : v.ci !== "unreadable" && v.heldOut !== "unreadable") return v;
    if (v.ci === "red" || (!lane && v.heldOut === "red")) return v;
    await ops.sleep(30000);
  }
  return v;
}
/** A lane reads GREEN on its CI alone: its held-out reading prints but never gates (held-out runs per train, on the span). */
const classifyLane = (v) => (v.ci === "green" ? "green" : v.ci === "unreadable" ? "unreadable" : "notgreen");
const heldOutNote = (v) => (v.heldOut === "unread" ? "not run (per train)" : v.heldOut);
const classify = (v) => (v.ci === "red" || v.heldOut === "red" ? "notgreen"
  : v.ci === "unreadable" || v.heldOut === "unreadable" ? "unreadable"
  : v.ci === "green" && v.heldOut === "green" ? "green" : "notgreen");

// ── the queue's pure law ─────────────────────────────────────────────────────────────────────────────────────

/** A land subject carries its own lane's marker: a land without it passes for a road commit in every read after it. */
export function landMessageRefusal(text, pr) {
  const subject = String(text ?? "").split("\n")[0];
  return new RegExp(`${LAND_SUBJECT}${pr}(?!\\d)`).test(subject) ? null : `MESSAGE LACKS "${LAND_SUBJECT}${pr}"`;
}

/** The paths of `git diff --no-renames --raw -z` output (NUL-separated, so git never C-quotes a path out of its glob): a
 *  mode change or a retargeted symlink names its path too. */
export function rawPaths(raw) {
  const parts = String(raw).split("\0"), out = [];
  for (let i = 0; i < parts.length; i++) if (parts[i].startsWith(":") && parts[i + 1]) out.push(parts[++i]);
  return out;
}

/** The paths of a lane's diff that put it in the security class, against the table `{ paths, tokens }`. */
export function securityHits(table, paths) {
  const globs = (table?.paths ?? []).map(globToRegExp), tokens = (table?.tokens ?? []).map((t) => String(t).toLowerCase());
  return paths.filter((p) => globs.some((re) => re.test(p)) || tokens.some((t) => p.toLowerCase().includes(t)));
}

/** A SHIP names the exact full head sha and a `read:` line; anything else refuses. */
export function shipRefusal(text, sha) {
  const body = String(text ?? "");
  if (!body.trim()) return "no SHIP file";
  if (!body.includes(sha)) return "the SHIP names another sha";
  if (!/^read:\s*\S/m.test(body)) return "the SHIP names no read";
  return null;
}

const RED_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure", "action_required"]);
/** One sha's CI reading off `gh run list --commit <sha> --json …` rows, over the runs whose branch `branchOk` accepts:
 *  none (no run names it yet) · running · green · red · void (completed with no whole verdict: cancelled, skipped). */
export function readRunAt(runs, sha, branchOk = () => true) {
  // Only a push or a dispatch run measured the tree at that sha; a pull_request run tests a merge GitHub made.
  const own = runs.filter((r) => r.headSha === sha && branchOk(r.headBranch) && (!r.event || r.event === "push" || r.event === "workflow_dispatch"))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || Number(b.databaseId) - Number(a.databaseId));
  const done = own.find((r) => r.status === "completed" && (r.conclusion === "success" || RED_CONCLUSIONS.has(r.conclusion)));
  // A whole verdict at the sha decides, from any accepted branch: the span's own run and a train's measure the same tree.
  if (done?.conclusion === "success") return { state: "green", run: done };
  const live = own.find((r) => r.status !== "completed");
  if (live) return { state: "running", run: live };
  if (done) return { state: "red", run: done };
  if (own.length) return { state: "void", run: own[0] };
  return { state: "none", run: null };
}

/** The held-out gate over the span's newest completed held-out run, the lands past the sha it covered and the runs in flight. */
export function heldOutGate({ covered, state, inFlight }, landsPast, m = 3) {
  if (state === "red") return { pause: true, wait: false, why: `HELD-OUT RED at ${short(covered)}: the queue pauses until the span reads green again` };
  if (!covered) return inFlight > 0 ? { pause: true, wait: true, why: "HELD-OUT HAS NO COMPLETED RUN on the span; waiting on the one in flight" }
    : { pause: true, wait: false, why: "HELD-OUT HAS NO COMPLETED RUN on the span and none in flight" };
  if (landsPast > m) return inFlight > 0 ? { pause: true, wait: true, why: `HELD-OUT LAGS: ${landsPast} lands past ${short(covered)}; waiting on the run in flight` }
    : { pause: true, wait: false, why: `HELD-OUT LAGS: ${landsPast} lands past ${short(covered)}, none in flight` };
  return { pause: false };
}

// ── the land ─────────────────────────────────────────────────────────────────────────────────────────────────
const HOME_SCRATCH = () => join(userInfo().homedir, ".lares-scratch");
const defaultQueue = () => join(HOME_SCRATCH(), "train", "queue");
const defaultShip = () => join(HOME_SCRATCH(), "controller", "ship");
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e?.code === "EPERM"; } };

/** The shared preamble of every door: identity, the checkout on the span, a fresh fetch. */
function door({ span, cwd }, ops) {
  const say = ops.log;
  const git = (args, o = {}) => ops.git(args, { cwd, ...o });
  const stop = (code, ...lines) => { for (const l of lines) if (l) say(l); return { code }; };
  let who;
  try { who = { name: git(["config", "user.name"]), email: git(["config", "user.email"]) }; } catch { who = { name: "", email: "" }; }
  if (!who.name || !who.email) return { refusal: stop(2, "NO AUTHOR IDENTITY: set git config user.name and git config user.email") };
  const env = { GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email, GIT_COMMITTER_NAME: who.name, GIT_COMMITTER_EMAIL: who.email };
  if (git(["rev-parse", "--abbrev-ref", "HEAD"]) !== span) return { refusal: stop(2, `MAIN CHECKOUT NOT ON THE SPAN ${span}`) };
  git(["fetch", "-q", "--prune", "origin"]);
  return { say, git, stop, env, SP: git(["rev-parse", `origin/${span}`]) };
}

/** Read every lane against origin: head, common base, message marker, its own green, the security class and its SHIP.
 *  A named lane that fails refuses the whole land. A queued entry that fails (its lane moved on, went red, lost its message
 *  or its SHIP, or read a positive red) is marked `reject` and drops by name, so one stale entry never strands the queue.
 *  A dark entry (UNREADABLE, or a CI with no verdict yet) is marked `skip`: named, kept queued, the rest go on. */
async function validate(lanes, { span, SP, shipDir, git, say, stop }, ops) {
  let table = null;
  try { table = JSON.parse(git(["show", `${SP}:tools/security-class-paths.json`])); } catch { return { refusal: stop(2, `NO SECURITY TABLE at the span head ${short(SP)} (tools/security-class-paths.json)`) }; }
  const noShip = [];
  const read = async (l) => {
    const branch = `${span}--${l.suffix}`;
    let LH;
    try { LH = git(["rev-parse", `origin/${branch}`]); } catch { return [3, `NO LANE BRANCH origin/${branch}`]; }
    if (LH !== l.head) return [3, `HEAD MOVED: ${l.suffix} is ${LH}, not ${l.head}`];
    try { l.base = git(["merge-base", SP, LH]); } catch { return [2, `NO COMMON BASE: ${l.suffix} shares no history with the span`]; }
    const msg = ops.readMsg(l.msg);
    if (!msg.trim()) return [2, `NO MESSAGE FILE: ${l.msg}`];
    const bad = landMessageRefusal(msg, l.pr); if (bad) return [2, `${bad}: ${l.suffix} (${l.msg})`];
    l.subject = msg.split("\n")[0];
    const v = await settled(ops, branch, LH, { lane: true });
    let k = classifyLane(v);
    if (k !== "green" && v.ci === "unread" && touchesIgnoredOnly(git, LH)) {
      // The lane head's push changed ignored paths alone and raised no run; it reads GREEN over a CI-green ancestor on its own branch.
      const anchor = await greenAncestor(ops, git, branch, LH, { lane: true });
      if (anchor) { say(`lane ${l.suffix} head ${short(LH)} touches ignored paths only; no CI run stands; carried by green ancestor ${short(anchor)}`); k = "green"; }
    }
    if (k === "unreadable") return [10, `UNREADABLE: lane ${l.suffix}'s CI verdict could not be read (${v.ci}); read again later, it is no red`];
    // Only a positive red drops a queued entry; an unread lane (a run in flight, a hard read error) keeps the queue whole.
    if (k !== "green") { l.notRed = v.ci !== "red"; return [8, `LANE NOT GREEN: ${l.suffix}`, `  ci ${v.ci} · held-out ${heldOutNote(v)}`]; }
    l.paths = rawPaths(git(["diff", "--no-renames", "--raw", "-z", `${l.base}..${LH}`]));
    const hits = securityHits(table, l.paths);
    if (hits.length) {
      const file = join(shipDir, `${l.suffix}-${LH}.md`), why = shipRefusal(ops.readMsg(file), LH);
      if (why) return [12, `NO SHIP: ${l.suffix} is security-class (${hits.slice(0, 3).join(", ")}${hits.length > 3 ? ", …" : ""}): ${why} at ${file}`];
      say(`lane ${l.suffix} security-class; SHIP stands for ${short(LH)}`);
    }
    say(`lane ${l.suffix} GREEN at ${short(LH)} (PR #${l.pr}) · held-out: ${heldOutNote(v)}`);
    return null;
  };
  for (const l of lanes) {
    const f = await read(l);
    if (!f) continue;
    const [code, ...lines] = f;
    // A dark queued entry (UNREADABLE, or a CI with no verdict yet) is skipped by name and stays queued; the rest go on.
    if (l.entry && (code === 10 || (code === 8 && l.notRed))) { l.skip = lines.join(" "); l.skipCode = code; continue; }
    if (!l.entry) { if (code === 12) { noShip.push(...lines); continue; } return { refusal: stop(code, ...lines) }; }
    l.reject = lines.join(" ");
  }
  if (noShip.length) return { refusal: stop(12, ...noShip) };
  return { table };
}

/** The SHIP refusal for a lane whose paths (its own diff, unioned with what its land changes) meet the table, or null. */
function landShipRefusal(table, shipDir, lane, landed, ops) {
  const hits = securityHits(table, [...new Set([...(lane.paths ?? []), ...landed])]);
  if (!hits.length) return null;
  const file = join(shipDir, `${lane.suffix}-${lane.head}.md`), why = shipRefusal(ops.readMsg(file), lane.head);
  return why ? `NO SHIP: ${lane.suffix} is security-class (${hits.slice(0, 3).join(", ")}${hits.length > 3 ? ", …" : ""}, as it lands): ${why} at ${file}` : null;
}
const readTable = (git, SP) => { try { return JSON.parse(git(["show", `${SP}:tools/security-class-paths.json`])); } catch { return null; } };

/** A queue entry leaves `entries/` once its lane landed (`done/`) or dropped (`dropped/`); a named lane holds no entry. */
function settleEntry(queueDir, lane, to) {
  if (!lane.entry) return;
  try { mkdirSync(join(queueDir, to), { recursive: true }); renameSync(join(queueDir, "entries", lane.entry), join(queueDir, to, lane.entry)); } catch { /* already moved */ }
}
const readEntries = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : []);
function takeLock(queueDir, say) {
  mkdirSync(queueDir, { recursive: true });
  const lock = join(queueDir, "lock"), tmp = join(queueDir, `lock.${process.pid}`);
  const holder = () => { try { return Number(readFileSync(lock, "utf8").trim()) || null; } catch { return null; } };
  // The pid goes into a private file first and links into place: a link either creates the lock whole or fails, so the
  // lock never stands empty. A lock whose process has exited is removed and linked again, once. Two runs that both find
  // the same dead lock in the same instant can each take it: a narrow window the controller's one-run habit closes.
  writeFileSync(tmp, `${process.pid}\n`);
  try {
    for (let tries = 0; tries < 2; tries++) {
      try { linkSync(tmp, lock); return { release: () => { if (holder() === process.pid) { try { unlinkSync(lock); } catch { /* gone */ } } } }; }
      catch (e) {
        if (e?.code !== "EEXIST") throw e;
        const pid = holder();
        if (pid && pidAlive(pid)) return { held: pid };
        if (tries === 0) { say(`took over the queue lock of process ${pid ?? "(unreadable)"}, which has exited`); try { unlinkSync(lock); } catch { /* gone */ } }
      }
    }
    return { held: holder() ?? "unknown" };
  } finally { try { unlinkSync(tmp); } catch { /* gone */ } }
}

/**
 * The whole land over injected `ops` (git, verdict, ciRuns, rerun, cancelRun, heldOut, dispatchCI, disk, houseWorktrees,
 * spanRuns, cancelRuns, readMsg, removeWorktree, train, sleep, env, log). Returns `{ code }`; every line goes through `ops.log`.
 */
export async function landTrain({ name = "train", specs = [], plan = false, local = false, fromQueue = false, span = SPAN, cwd, k = 4, depth = 2, m = 3, shipDir = defaultShip(), queueDir = defaultQueue() }, ops) {
  const d = door({ span, cwd }, ops); if (d.refusal) return d.refusal;
  const { say, git, stop } = d;
  const entriesDir = join(queueDir, "entries");
  // The queue lock guards the queue's entries, ledger and train refs: a `run` takes it before reading the entries, a land
  // of named lanes once it knows it trains in the cloud. DIRECT and --local touch none of them.
  let lock = null;
  const locked = () => {
    if (plan || lock) return null;
    lock = takeLock(queueDir, say);
    return lock.held ? stop(6, `QUEUE LOCKED: process ${lock.held} drains the queue (${join(queueDir, "lock")})`) : null;
  };
  try {
    if (fromQueue) { const l = locked(); if (l) { lock = null; return l; } }
    let lanes, files = [];  // lanes narrows below once rejected entries drop
    try {
      files = fromQueue ? readEntries(entriesDir) : [];
      lanes = [...(fromQueue ? files.map((f) => JSON.parse(readFileSync(join(entriesDir, f), "utf8"))).map((e) => parseSpec(`${e.suffix}:${e.pr}:${e.head}:${e.msg}`)) : []), ...specs.map(parseSpec)];
    } catch (e) { return stop(2, e.message); }
    if (lanes.length === 0) return stop(2, "no lane named");
    files.forEach((f, i) => { lanes[i].entry = f; });
    if (local && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(name))) return stop(2, `train name "${name}" must be one plain path component`);
    const v = await validate(lanes, { span, SP: d.SP, shipDir, git, say, stop }, ops); if (v.refusal) return v.refusal;
    const rejected = lanes.filter((l) => l.reject), skipped = lanes.filter((l) => l.skip);
    for (const l of rejected) { if (!plan) settleEntry(queueDir, l, "dropped"); say(`DROPPED ${l.suffix}: ${l.reject}`); }
    for (const l of skipped) say(`SKIPPED ${l.suffix}: ${l.skip} (kept queued)`);
    lanes = lanes.filter((l) => !l.reject && !l.skip);
    if (lanes.length === 0) {
      if (rejected.length) return stop(5, `NOTHING LANDED: dropped ${rejected.map((l) => l.suffix).join(" ")}`);
      return stop(skipped.some((l) => l.skipCode === 10) ? 10 : 8, `NOTHING LANDED: every queued lane reads dark (${skipped.map((l) => l.suffix).join(" ")}), kept queued`);
    }
    const tally = (landed) => (skipped.length ? stop(14, `QUEUE-LANDED-SOME: landed ${landed}; skipped ${skipped.map((l) => l.suffix).join(" ")} (kept queued)${rejected.length ? `; dropped ${rejected.map((l) => l.suffix).join(" ")}` : ""}`)
      : rejected.length ? stop(11, `QUEUE-LANDED-SOME: landed ${landed}; dropped ${rejected.map((l) => l.suffix).join(" ")}`) : null);

    const direct = lanes.length === 1 && isAncestor(git, d.SP, lanes[0].head);
    if (direct || local) {
      const r = await landLocal({ name, lanes, plan, span, direct, d, table: v.table, shipDir }, ops);
      if (r.code !== 0 || plan) return r;
      for (const l of lanes) settleEntry(queueDir, l, "done");
      return tally(lanes.map((l) => l.suffix).join(" ")) ?? r;
    }
    for (const l of lanes) if (onlyIgnoredPaths(l.paths)) return stop(2, `MEME-ONLY LANE: ${l.suffix} changes ignored paths alone, so no train run would come; merge the span into it and it lands DIRECT`);
    { const l = locked(); if (l) { lock = null; return l; } }
    const q = await landQueue({ lanes, plan, span, k, depth, m, queueDir, shipDir, table: v.table, preDropped: rejected, d }, ops);
    // Skipped entries stay queued: a queue that landed every other lane says so with its own code.
    return q.code === 0 && skipped.length ? tally(q.landed.join(" ")) : q;
  } finally { lock?.release?.(); }
}

/** Queue lanes for the next `run`: the same reading as a land (head, marker, green, SHIP); one entry file per lane. */
export async function enqueue({ specs = [], span = SPAN, cwd, shipDir = defaultShip(), queueDir = defaultQueue() }, ops) {
  const d = door({ span, cwd }, ops); if (d.refusal) return d.refusal;
  let lanes;
  try { lanes = specs.map(parseSpec); } catch (e) { return d.stop(2, e.message); }
  if (lanes.length === 0) return d.stop(2, "no lane named");
  const v = await validate(lanes, { span, SP: d.SP, shipDir, git: d.git, say: d.say, stop: d.stop }, ops); if (v.refusal) return v.refusal;
  const dir = join(queueDir, "entries"); mkdirSync(dir, { recursive: true });
  let seq = readEntries(dir).length + readEntries(join(queueDir, "done")).length + readEntries(join(queueDir, "dropped")).length;
  for (const l of lanes) {
    const f = `${String(++seq).padStart(6, "0")}-${l.suffix}.json`;
    writeFileSync(join(dir, f), `${JSON.stringify({ suffix: l.suffix, pr: l.pr, head: l.head, msg: resolve(l.msg) })}\n`);
    d.say(`queued ${l.suffix} (PR #${l.pr}) at ${short(l.head)} as ${f}`);
  }
  return { code: 0 };
}

/** The standing trains: exit 1 while any `<span>--train-*` ref stands unlanded (a canon push waits), 0 when none does. */
export async function queueStatus({ span = SPAN, cwd, queueDir = defaultQueue() }, ops) {
  const git = (args) => ops.git(args, { cwd });
  git(["fetch", "-q", "--prune", "origin"]);
  const SP = git(["rev-parse", `origin/${span}`]);
  const flying = trainRefs(git, span).filter((t) => !isAncestor(git, t.sha, SP));
  for (const t of flying) ops.log(`train in flight: ${t.branch} at ${short(t.sha)}`);
  const lockFile = join(queueDir, "lock");
  if (existsSync(lockFile)) ops.log(`queue lock: process ${readFileSync(lockFile, "utf8").trim()}`);
  ops.log(`queued: ${readEntries(join(queueDir, "entries")).length} lane(s); span ${short(SP)}`);
  return { code: flying.length ? 1 : 0 };
}

const TRAIN_RE = (span) => new RegExp(`^origin/${span.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}--train-(\\d+)-[0-9a-f]+$`);
function trainRefs(git, span) {
  const re = TRAIN_RE(span);
  return git(["for-each-ref", "--format=%(refname:short) %(objectname)", `refs/remotes/origin/${span}--train-*`]).split("\n").filter(Boolean)
    .map((l) => { const [ref, sha] = l.split(" "); const m = re.exec(ref); return m ? { branch: ref.slice("origin/".length), sha, n: Number(m[1]) } : null; })
    .filter(Boolean).sort((a, b) => a.n - b.n);
}

/** DIRECT and --local: the land written before the push, from the lane tree or the local battery's merge trees. */
async function landLocal({ name, lanes, plan, span, direct, d, table, shipDir }, ops) {
  const { say, git, stop, env, SP } = d;
  // --local keeps the road walk from the lanes' common base: the battery reads only shared packages, so every road commit
  // between that base and the span head must read GREEN on its own (a land carries its train's verdict).
  const baseSha = lanes.length === 1 ? lanes[0].base : git(["merge-base", "--octopus", ...lanes.map((l) => l.base)]);
  let spanCarried = false;
  if (!direct) {
    let carrier = null;
    for (const c of git(["rev-list", "--first-parent", `${baseSha}..${SP}`]).split("\n").filter(Boolean)) {
      if (git(["log", "-1", "--format=%s", c]).includes(LAND_SUBJECT)) continue;
      if (carrier) { say(`road commit ${short(c)} carried by ${short(carrier)} GREEN`); continue; }
      const v = await settled(ops, span, c);
      const kk = classify(v);
      if (kk === "green") { say(`road commit ${short(c)} GREEN on the span`); carrier = c; continue; }
      if (v.ci === "unread" && touchesIgnoredOnly(git, c)) {
        const anchor = await greenAncestor(ops, git, span, c);
        if (anchor) { say(`road commit ${short(c)} touches ignored paths only; no run stands; carried by green ancestor ${short(anchor)}`); carrier = anchor; if (c === SP) spanCarried = true; continue; }
      }
      if (kk === "unreadable") return stop(10, `UNREADABLE: the verdict of road commit ${short(c)} could not be read (${v.ci}/${v.heldOut}); read again later, it is no red`);
      return stop(3, `SPAN MOVED BY A NON-LAND COMMIT NOT READ GREEN since ${short(baseSha)}: ${git(["log", "-1", "--oneline", c]).slice(0, 80)}`);
    }
    const sv = spanCarried ? { ci: "green", heldOut: "green" } : await settled(ops, span, SP), sk = classify(sv);
    if (sk === "unreadable") return stop(10, `UNREADABLE: the span head ${short(SP)}'s verdict could not be read (${sv.ci}/${sv.heldOut}); read again later, it is no red`);
    if (sk !== "green") return stop(5, `SPAN NOT GREEN at ${short(SP)}: ci ${sv.ci} · held-out ${sv.heldOut}`);
    const dk = diskRefusal(ops.disk(), ops.env); if (dk) return stop(6, dk);
    const c = worktreeCapRefusal(ops.houseWorktrees()); if (c) return stop(6, c);
  }

  if (plan) {
    say(`PLAN ${direct ? "DIRECT land (no train)" : `local TRAIN ${name}`} over span ${short(SP)}, base ${short(baseSha)}; nothing pushed, nothing built`);
    let prev = short(SP);
    for (const l of lanes) {
      const tree = direct ? `tree of the lane head (${short(git(["rev-parse", `${l.head}^{tree}`]))})` : "the train's merge tree for this lane";
      say(`PLAN lane ${l.suffix} (PR #${l.pr}) head ${short(l.head)}: commit-tree ${tree} -p ${prev} -p ${short(l.head)} -F ${l.msg}  subject: ${l.subject}`);
      say(`PLAN push --force-with-lease=${span}--${l.suffix}:${short(l.head)} origin <land>:refs/heads/${span}--${l.suffix}`);
      prev = `land(${l.suffix})`;
    }
    say(`PLAN fast-forward ${span} to the last land, push the span while no run flies on it, then cancel the landed lanes' runs`);
    return { code: 0 };
  }

  const at = checkoutAt(git, SP); if (at) return stop(2, at);
  let worktree = null, lands = [];
  if (direct) {
    const l = lanes[0];
    const tree = git(["rev-parse", `${l.head}^{tree}`]);
    const land = git(["commit-tree", tree, "-p", SP, "-p", l.head, "-F", l.msg], { env });
    if (git(["rev-parse", `${land}^{tree}`]) !== tree) return stop(5, "LAND TREE DIFFERS FROM THE LANE'S");
    lands = [{ lane: l, land }];
    say(`lane ${l.suffix} holds the span head ${short(SP)}: DIRECT land, no train`);
  } else {
    const t = await ops.train({ name, lanes, span, base: baseSha, SP, env: ops.env });
    if (t.state === "conflict") { if (t.worktree) ops.removeWorktree(t.worktree); return stop(4, `CONFLICT: ${(t.files ?? []).join(" ")}`); }
    if (t.state === "red") return stop(5, `TRAIN-RED: ${t.why ?? ""}`, t.worktree ? `  the train worktree stands at ${t.worktree}` : "");
    if (t.state !== "green") return stop(7, `TRAIN-${String(t.state).toUpperCase()}: ${t.why ?? ""}`);
    worktree = t.worktree;
    const T = t.head;
    const merges = git(["rev-list", "--first-parent", "--reverse", `${SP}..${T}`], { cwd: worktree }).split("\n").filter(Boolean);
    if (merges.length !== lanes.length) return stop(5, `TRAIN CHAIN HOLDS ${merges.length} merges for ${lanes.length} lanes`, `  the train worktree stands at ${worktree}`);
    let prev = SP, prevMerge = SP;
    for (const [i, l] of lanes.entries()) {
      const M = merges[i];
      if (git(["rev-parse", `${M}^2`], { cwd: worktree }) !== l.head) return stop(5, `TRAIN ORDER BROKE at ${l.suffix}`, `  the train worktree stands at ${worktree}`);
      // The class reads what lands: `git merge` follows renames, so the lane's own diff may never name the path it changes.
      const noShip = landShipRefusal(table, shipDir, l, rawPaths(git(["diff", "--no-renames", "--raw", "-z", prevMerge, M], { cwd: worktree })), ops);
      if (noShip) { ops.removeWorktree(worktree); return stop(12, noShip); }
      prevMerge = M;
      const land = git(["commit-tree", git(["rev-parse", `${M}^{tree}`], { cwd: worktree }), "-p", prev, "-p", l.head, "-F", l.msg], { env });
      lands.push({ lane: l, land }); prev = land;
    }
    if (git(["rev-parse", `${prev}^{tree}`]) !== git(["rev-parse", `${T}^{tree}`], { cwd: worktree })) return stop(5, "FINAL TREE DIFFERS FROM THE TRAIN'S", `  the train worktree stands at ${worktree}`);
  }

  // Nothing moves while a run flies on the span. The SPAN pushes first, as the one decision, under a lease on the head this
  // land read: a writer that moved it during the train refuses the land and leaves every lane branch where it stood.
  const g = spanPushRefusal(ops.spanRuns(span)); if (g) return stop(6, g);
  const last = lands.at(-1).land;
  try { git(["push", "-q", `--force-with-lease=refs/heads/${span}:${SP}`, "origin", `${last}:refs/heads/${span}`]); }
  catch (e) { return stop(6, `SPAN PUSH REFUSED: the span moved during the train (expected ${short(SP)}); nothing landed and no lane branch moved`, `  ${String(e?.stderr ?? e?.message ?? e).trim().split("\n")[0]}`); }
  say(`pushed ${short(last)} to ${span}`);
  try { git(["merge", "--ff-only", "-q", last]); } catch { say(`WARNING: the local ${span} did not fast-forward to ${short(last)}; run git fetch and fast-forward it`); }
  const moved = moveLaneBranches(git, say, span, lands);
  if (worktree) ops.removeWorktree(worktree);
  // A DIRECT land's lane push changes no file (the land tree IS the lane tree), so paths-ignore raises no run to cancel.
  if (!direct) await cancelLaneRuns(ops, say, span, moved);
  return stop(0, direct ? "DIRECT-LANDED" : "BATCH-LANDED");
}

/** The checkout must hold the span head exactly, so a span push's fast-forward stays one and strands no local commit. */
function checkoutAt(git, SP) {
  if (git(["rev-parse", "HEAD"]) !== SP && isAncestor(git, "HEAD", SP)) { try { git(["merge", "--ff-only", "-q", SP]); } catch { /* the check below says it */ } }
  return git(["rev-parse", "HEAD"]) === SP ? null : `MAIN CHECKOUT IS NOT AT ORIGIN'S SPAN HEAD ${short(SP)}; bring it there first`;
}

function moveLaneBranches(git, say, span, lands) {
  const moved = [];
  for (const { lane, land } of lands) {
    const branch = `${span}--${lane.suffix}`;
    say(`landed ${lane.suffix} (PR #${lane.pr}) as ${land}`);
    try { git(["push", "-q", `--force-with-lease=${branch}:${lane.head}`, "origin", `${land}:refs/heads/${branch}`]); moved.push({ lane, land }); }
    catch { say(`LANE BRANCH NOT MOVED: ${lane.suffix} (its lease on ${short(lane.head)} failed; the span holds its head, so its PR reads merged)`); }
  }
  return moved;
}

/** The lane-branch push starts a run on a commit the span's own run already measures; those runs only crowd the queue ahead
 *  of live lanes. Cancel by the pushed land sha (the lane's next feature keeps its runs), once the runs have appeared. */
async function cancelLaneRuns(ops, say, span, moved) {
  let pending = moved;
  for (let round = 0; round < 3 && pending.length; round++) {
    await ops.sleep(20000);
    const still = [];
    for (const mv of pending) {
      const ids = await ops.cancelRuns(`${span}--${mv.lane.suffix}`, mv.land);
      if (ids.length === 0) still.push(mv); else for (const id of ids) say(`cancelled the landed lane's run ${mv.lane.suffix} ${id}`);
    }
    pending = still;
  }
}

/** QUEUE: chain, push, read the train head's own CI, fast-forward the span; bisect a red over the chain; speculate one ahead. */
async function landQueue({ lanes, plan, span, k, depth, m, queueDir, shipDir, table: table0, preDropped = [], d }, ops) {
  const { say, git, stop, env } = d;
  let SP = d.SP, table = table0;
  const trainOk = (b) => b.startsWith(`${span}--train-`);
  const anyOk = (b) => b === span || trainOk(b);
  const landed = [], dropped = [...preDropped];
  const ledgerFile = join(queueDir, "ledger.json");
  const readN = () => { try { return Number(JSON.parse(readFileSync(ledgerFile, "utf8")).n) || 0; } catch { return 0; } };
  let n = Math.max(readN(), ...trainRefs(git, span).map((t) => t.n), 0);
  const nextBranch = (sha) => { n += 1; mkdirSync(queueDir, { recursive: true }); writeFileSync(ledgerFile, `${JSON.stringify({ n })}\n`); return `${span}--train-${n}-${sha.slice(0, 9)}`; };
  // A plan reads the queue and moves no entry: what its chain would drop stays queued.
  const drop = (lane, why) => { dropped.push(lane); if (!plan) settleEntry(queueDir, lane, "dropped"); say(`DROPPED ${lane.suffix}: ${why}`); };
  const deleteRef = (branch, sha) => { try { git(["push", "-q", `--force-with-lease=refs/heads/${branch}:${sha}`, "origin", `:refs/heads/${branch}`]); } catch { /* already gone */ } };

  /** The chain over `base`: one land per lane, merge-tree's tree, the lane's message; a conflict drops its lane and its carriers. */
  const chain = (base, group) => {
    const out = [], gone = [];
    let prev = base;
    for (const l of group) {
      const carried = gone.find((g) => { try { return !isAncestor(git, git(["merge-base", g.head, l.head]), base); } catch { return false; } });
      if (carried) { drop(l, `carries ${carried.suffix}'s commits, which did not land`); gone.push(l); continue; }
      let tree;
      try { tree = git(["merge-tree", "--write-tree", "--no-messages", prev, l.head]).split("\n")[0]; }
      catch (e) {
        if (e?.status !== 1) throw e;
        const files = String(e.stdout ?? "").split("\n").slice(1).map((x) => x.split("\t").pop()).filter(Boolean);
        drop(l, `conflict${files.length ? ` in ${[...new Set(files)].join(" ")}` : ""} over ${short(prev)}`); gone.push(l); continue;
      }
      // An empty link raises no run (paths-ignore over an empty diff) and lands nothing: it drops by name.
      if (tree === git(["rev-parse", `${prev}^{tree}`])) { drop(l, `its change already stands on the span or an earlier lane of this train (an empty land over ${short(prev)})`); continue; }
      const landed = rawPaths(git(["diff", "--no-renames", "--raw", "-z", prev, tree]));
      // A land that changes ignored paths alone raises no run either (its code already stands): it drops by name.
      if (onlyIgnoredPaths(landed)) { drop(l, `its land over ${short(prev)} changes ignored paths alone, so no run would come`); continue; }
      // The class reads what LANDS (merge-tree follows renames), unioned with the lane's own diff.
      // A queued entry drops by name (and its carriers with it); a named lane refuses the whole land.
      const noShip = landShipRefusal(table, shipDir, l, landed, ops);
      if (noShip && l.entry) { drop(l, noShip); gone.push(l); continue; }
      if (noShip) throw Object.assign(new Error(noShip), { ship: true });
      const land = git(["commit-tree", tree, "-p", prev, "-p", l.head, "-F", l.msg], { env });
      out.push({ lane: l, land }); prev = land;
    }
    return { links: out, head: prev };
  };

  // A standing train ref that chains the queued lanes over the span resumes as it stands (a dead run left it).
  const trains = [];
  for (const t of trainRefs(git, span)) {
    if (isAncestor(git, t.sha, SP)) { deleteRef(t.branch, t.sha); continue; }
    const base = trains.at(-1)?.head ?? SP, pending = lanes.filter((l) => !dropped.includes(l) && !trains.some((x) => x.links.some((y) => y.lane === l)));
    const firsts = isAncestor(git, base, t.sha) ? git(["rev-list", "--first-parent", "--reverse", `${base}..${t.sha}`]).split("\n").filter(Boolean) : [];
    let prev = base, ok = firsts.length > 0 && firsts.length <= pending.length, refusal = null;
    const links = [];
    for (const [i, c] of firsts.entries()) {
      if (!ok) break;
      const l = pending[i];
      // A resumed link meets the table and the SHIP as a fresh one does: a SHIP revoked since the push refuses it.
      const noShip = ok && git(["rev-parse", `${c}^`]) === prev ? landShipRefusal(table, shipDir, l, rawPaths(git(["diff", "--no-renames", "--raw", "-z", prev, c])), ops) : null;
      if (noShip) { refusal = { lane: l, why: noShip }; ok = false; break; }
      ok = git(["rev-parse", `${c}^`]) === prev && git(["rev-parse", `${c}^2`]) === l.head && git(["log", "-1", "--format=%s", c]) === l.subject
        && git(["rev-parse", `${c}^{tree}`]) === git(["merge-tree", "--write-tree", "--no-messages", prev, l.head]).split("\n")[0];
      links.push({ lane: l, land: c }); prev = c;
    }
    // A standing train resumes only when a run names its sha; one with none would wait on a run that never comes.
    if (ok) { const runs = await ops.ciRuns(t.sha).catch(() => []); ok = readRunAt(runs, t.sha, trainOk).state !== "none"; }
    if (refusal) {
      for (const r of await ops.ciRuns(t.sha).catch(() => [])) if (r.status !== "completed" && trainOk(r.headBranch)) await ops.cancelRun(r.databaseId).catch(() => {});
      deleteRef(t.branch, t.sha); say(`train ref ${t.branch} torn down: its land meets the table with no SHIP standing`);
      if (!refusal.lane.entry) return finish(12, refusal.why);
      drop(refusal.lane, refusal.why);
      continue;
    }
    if (ok) { trains.push({ branch: t.branch, head: t.sha, links }); say(`RESUMED ${t.branch} at ${short(t.sha)}: ${links.map((x) => x.lane.suffix).join(" ")}`); }
    else {
      for (const r of await ops.ciRuns(t.sha).catch(() => [])) if (r.status !== "completed" && trainOk(r.headBranch)) await ops.cancelRun(r.databaseId).catch(() => {});
      deleteRef(t.branch, t.sha); say(`stale train ref ${t.branch} (it chains no queued lane over the span): removed, its live runs cancelled`);
    }
  }
  let queue = lanes.filter((l) => !dropped.includes(l) && !trains.some((x) => x.links.some((y) => y.lane === l)));

  if (plan) {
    let links;
    try { ({ links } = chain(SP, queue.slice(0, k))); } catch (e) { if (!e.ship) throw e; return stop(12, e.message); }
    say(`PLAN QUEUE over span ${short(SP)}: train of ${links.length} lane(s); nothing pushed`);
    for (const { lane, land } of links) say(`PLAN lane ${lane.suffix} (PR #${lane.pr}) head ${short(lane.head)}: land ${short(land)} (merge-tree over the land before it)  subject: ${lane.subject}`);
    say(`PLAN push the chain head to ${span}--train-<n>-<sha9>, read its CI, fast-forward ${span} to it on green`);
    return { code: 0 };
  }
  const at = checkoutAt(git, SP); if (at) return stop(2, at);

  /** Wait on one sha's run until it reads a whole verdict (or VOID). After a rerun, `rerun` names the run and the attempt
   *  it must reach, so a stale reading of the prior attempt (or another run's green) never answers for it. `skip` names runs
   *  that answer nothing (a cancelled one a dispatch replaces). */
  const remoteRef = (ref) => { try { return git(["ls-remote", "origin", `refs/heads/${ref}`]).split(/\s/)[0] || null; } catch { return undefined; } };
  const awaitRun = async (sha, branchOk, { rerun = null, skip = new Set(), watchRef = null, watchSpan = false } = {}) => {
    let dark = 0, sawLive = false;
    for (;;) {
      let runs;
      try { runs = await ops.ciRuns(sha); dark = 0; }
      catch (e) { if (classifyFailure(e) !== "unreadable") throw e; if (++dark >= 6) return { state: "unreadable" }; await ops.sleep(30000); continue; }
      runs = runs.filter((x) => !skip.has(x.databaseId));
      if (rerun) {
        // A gh that answers `attempt` names the new attempt; one that answers none shows the run live, then whole again.
        runs = runs.filter((x) => x.databaseId === rerun.id);
        if (runs.some((x) => x.status !== "completed")) sawLive = true;
        runs = runs.filter((x) => (x.attempt !== undefined ? x.attempt >= rerun.attempt : sawLive));
      }
      const r = readRunAt(runs, sha, branchOk);
      if (r.state === "green" || r.state === "red" || r.state === "void") return r;
      // No wait outlives its subject: a train or probe ref that moved or vanished reads VOID; a span that moved re-chains.
      if (watchRef) { const at = remoteRef(watchRef); if (at !== undefined && at !== sha) return { state: "void", run: null, why: `${watchRef} no longer stands at ${short(sha)}` }; }
      if (watchSpan) { const at = remoteRef(span); if (at && at !== sha) return { state: "moved", run: null }; }
      if (r.state === "none") say(rerun ? `RERUN NOT YET READ: run ${rerun.id} attempt ${rerun.attempt} at ${sha}` : `NO RUN YET ${sha}`);
      await ops.sleep(30000);
    }
  };
  /** A red reruns its failed jobs once; the reading after it decides. */
  const verdictAt = async (sha, branchOk, { skip, watchRef, watchSpan } = {}) => {
    const r = await awaitRun(sha, branchOk, { skip, watchRef, watchSpan });
    if (r.state !== "red") return r;
    // A rerun GitHub refuses leaves the flake question open: UNREADABLE, never a red that would name a lane.
    try { await ops.rerun(r.run.databaseId); } catch (e) { say(`the rerun of run ${r.run.databaseId} was refused (${String(e?.message ?? e).split("\n")[0]})`); return { state: "unreadable", run: r.run }; }
    say(`rerun of the failed jobs in run ${r.run.databaseId} (${short(sha)}), once`);
    return awaitRun(sha, branchOk, { rerun: { id: r.run.databaseId, attempt: (r.run.attempt ?? 1) + 1 }, skip, watchRef, watchSpan });
  };
  const pushRef = (branch, sha, kind) => { git(["push", "-q", `--force-with-lease=refs/heads/${branch}:`, "origin", `${sha}:refs/heads/${branch}`]); say(`pushed ${kind} ${branch} ${sha}`); };
  const tearDown = async (t) => {
    for (const r of await ops.ciRuns(t.head).catch(() => [])) if (r.status !== "completed" && trainOk(r.headBranch)) { await ops.cancelRun(r.databaseId).catch(() => {}); say(`cancelled run ${r.databaseId} of ${t.branch}`); }
    deleteRef(t.branch, t.head);
  };
  /** Fast-forward the span to `sha` (a commit of a chain over SP) and move those lanes' branches. False when the span moved. */
  const fastForward = async (sha, links) => {
    try { git(["push", "-q", `--force-with-lease=refs/heads/${span}:${SP}`, "origin", `${sha}:refs/heads/${span}`]); }
    catch { say(`the span moved from ${short(SP)} while the train verified; re-chaining on its new head`); return false; }
    say(`fast-forwarded ${span} to ${short(sha)}`);
    try { git(["merge", "--ff-only", "-q", sha]); } catch { say(`WARNING: the local ${span} did not fast-forward to ${short(sha)}`); }
    SP = sha;
    const moved = moveLaneBranches(git, say, span, links);
    for (const x of links) { landed.push(x.lane); settleEntry(queueDir, x.lane, "done"); }
    await cancelLaneRuns(ops, say, span, moved);
    return true;
  };
  const restart = async () => {
    for (const t of trains) await tearDown(t);
    queue = [...trains.flatMap((t) => t.links.map((x) => x.lane)), ...queue];
    trains.length = 0;
    git(["fetch", "-q", "origin"]); SP = git(["rev-parse", `origin/${span}`]);
    const a = checkoutAt(git, SP); if (a) return stop(2, a);
    // The moved span may carry a new security table: every re-chained link reads it.
    table = readTable(git, SP);
    if (!table) return stop(2, `NO SECURITY TABLE at the span head ${short(SP)} (tools/security-class-paths.json)`);
    return null;
  };

  /** The span head's own reading: a REAL green at SP, never a carry. A missing run gets dispatched; a red reruns once. */
  const spanReads = async () => {
    let runs = [];
    try { runs = await ops.ciRuns(SP); } catch { /* awaitRun reads again */ }
    const now = readRunAt(runs, SP, anyOk);
    if (now.state === "none" || now.state === "void") {
      // No run, or only runs cancelled clean: none measured the span head, so it gets one of its own.
      const skip = new Set(runs.filter((x) => x.headSha === SP).map((x) => x.databaseId));
      await ops.dispatchCI(span); say(`the span head ${short(SP)} holds no whole run of its own: dispatched CI on ${span}`);
      return verdictAt(SP, anyOk, { skip, watchSpan: true });
    }
    return verdictAt(SP, anyOk, { watchSpan: true });
  };

  /** Bisect a red train over its own chain: land each green prefix, name the culprit between green and red. */
  const bisect = async (t) => {
    const s = await spanReads();
    if (s.state === "moved") return { moved: t.links };
    if (s.state === "unreadable") return { code: 10, why: `UNREADABLE: the span head ${short(SP)}'s verdict could not be read; it is no red` };
    if (s.state === "void") return { code: 13, why: `VOID: the span head ${short(SP)}'s run was cancelled clean; nothing measured it` };
    if (s.state !== "green") return { code: 16, why: `SPAN RED at ${short(SP)}: the span itself reads red, so no lane takes the blame; the queue pauses` };
    let links = t.links, lo = 0, hi = links.length;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2), c = links[mid - 1].land;
      const branch = nextBranch(c);
      pushRef(branch, c, "probe");
      const v = await verdictAt(c, trainOk, { watchRef: branch });
      deleteRef(branch, c);
      if (v.state === "unreadable") return { code: 10, why: `UNREADABLE: probe ${short(c)} could not be read; it is no red` };
      if (v.state === "void") return { code: 13, why: `VOID: probe ${branch}'s run was cancelled clean` };
      if (v.state === "green") {
        if (!(await fastForward(c, links.slice(lo, mid)))) return { moved: links.slice(lo) };
        lo = mid;
      } else hi = mid;
    }
    const culprit = links[hi - 1].lane;
    drop(culprit, `the train turned red at its land (prefix ${hi} red, prefix ${lo} green); read the train run's failing jobs`);
    const rest = links.slice(hi).map((x) => x.lane).filter((l) => {
      const carries = !isAncestor(git, git(["merge-base", culprit.head, l.head]), SP);
      if (carries) drop(l, `carries ${culprit.suffix}'s commits, which did not land`);
      return !carries;
    });
    return { rest };
  };

  for (;;) {
    // Build: the first train on the span after the held-out gate; one more on its head while depth allows.
    while (queue.length && (trains.length === 0 || trains.length + ops.spanRuns(span).length < depth)) {
      if (trains.length === 0) {
        let gate;
        for (;;) {
          const h = await ops.heldOut(span);
          const past = h.covered && isAncestor(git, h.covered, SP)
            ? git(["rev-list", "--first-parent", `${h.covered}..${SP}`]).split("\n").filter(Boolean).filter((c) => git(["log", "-1", "--format=%s", c]).includes(LAND_SUBJECT)).length
            : h.covered ? Infinity : 0;
          gate = heldOutGate(h, past, m);
          if (!gate.pause || !gate.wait) break;
          say(gate.why);
          await ops.sleep(30000);
        }
        if (gate.pause) return finish(15, gate.why);
      }
      const base = trains.at(-1)?.head ?? SP;
      let built;
      try { built = chain(base, queue.splice(0, k)); } catch (e) { if (!e.ship) throw e; for (const x of trains) await tearDown(x); trains.length = 0; return finish(12, e.message); }
      const { links, head } = built;
      if (links.length === 0) continue;
      const branch = nextBranch(head);
      pushRef(branch, head, "train");
      trains.push({ branch, head, links });
    }
    if (trains.length === 0) return finish();

    const t = trains[0];
    if (!isAncestor(git, SP, t.head)) { const r = await restart(); if (r) return r; continue; }
    const v = await verdictAt(t.head, trainOk, { watchRef: t.branch });
    if (v.state === "unreadable") return finish(10, `UNREADABLE: train ${t.branch}'s verdict could not be read; read again later, it is no red`);
    // VOID tears the train down, so no later run resumes a cancelled run and `status` frees canon pushes.
    if (v.state === "void") { for (const x of trains) await tearDown(x); trains.length = 0; return finish(13, `VOID: train ${t.branch}'s run at ${short(t.head)} was cancelled clean or its ref moved; nothing measured it (run the queue again)`); }
    if (v.state === "green") {
      git(["fetch", "-q", "origin"]);
      if (git(["rev-parse", `origin/${span}`]) !== SP || !(await fastForward(t.head, t.links))) { const r = await restart(); if (r) return r; continue; }
      deleteRef(t.branch, t.head);
      trains.shift();
      continue;
    }
    // Red: the speculative trains lose their base; the red train bisects over its own chain.
    for (const s of trains.slice(1)) await tearDown(s);
    const behind = trains.slice(1).flatMap((s) => s.links.map((x) => x.lane));
    trains.length = 0;
    const b = await bisect(t);
    deleteRef(t.branch, t.head);
    if (b.code) return finish(b.code, b.why);
    queue = [...(b.rest ?? b.moved.map((x) => x.lane)), ...behind, ...queue];
    if (b.moved) { const r = await restart(); if (r) return r; }
  }

  function finish(code, why) {
    if (why) say(why);
    if (code !== undefined) return { code };
    if (dropped.length === 0) return { ...stop(0, `QUEUE-LANDED: ${landed.map((l) => l.suffix).join(" ")}`), landed: landed.map((l) => l.suffix) };
    if (landed.length === 0) return stop(5, `NOTHING LANDED: dropped ${dropped.map((l) => l.suffix).join(" ")}`);
    return stop(11, `QUEUE-LANDED-SOME: landed ${landed.map((l) => l.suffix).join(" ")}; dropped ${dropped.map((l) => l.suffix).join(" ")}`);
  }
}

// ── the real ops ─────────────────────────────────────────────────────────────────────────────────────────────
const GB = 1024 ** 3;
function realOps({ cwd, scratch, env = process.env }) {
  const run = (cmd, args, o = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024, ...o, env: { ...env, ...o.env } }).trim();
  const git = (args, o = {}) => run("git", args, { cwd: o.cwd ?? cwd, env: o.env });
  const home = userInfo().homedir;
  const slug = repoOfRemote(git(["remote", "get-url", "origin"]));
  const ghe = ghEnv(env, home, slug);
  const gh = (args) => JSON.parse(run("gh", args, { cwd, timeout: 60000, env: ghe }));
  const free = (path) => { try { const s = statfsSync(path); return Math.floor((Number(s.bavail) * Number(s.bsize)) / GB * 10) / 10; } catch { return Infinity; } };
  return {
    git, env,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (l) => console.log(l),
    readMsg: (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } },
    disk: () => ({ cGb: existsSync("/mnt/c") ? free("/mnt/c") : Infinity, rootGb: free("/") }),
    houseWorktrees: () => (git(["worktree", "list", "--porcelain"]).match(/^worktree .*$/gm) ?? []).filter((l) => l.startsWith(`worktree ${join(home, ".lares-scratch")}/`)).length,
    spanRuns: (span) => activeRuns(gh, span),
    cancelRuns: async (branch, sha) => {
      const ids = runsToCancel(gh(["run", "list", "--branch", branch, "--limit", "30", "--json", "databaseId,status,headSha"]), sha);
      const done = [];
      for (const id of ids) { try { run("gh", ["run", "cancel", String(id)], { cwd, env: ghe }); done.push(id); } catch { /* finished meanwhile */ } }
      return done;
    },
    removeWorktree: (wt) => { try { git(["worktree", "remove", "--force", wt]); git(["worktree", "prune"]); } catch { /* already gone */ } },
    // ci-verdict reads once here (--retries 0): the waiting on UNREADABLE belongs to the land.
    verdict: async (branch, sha) => {
      const r = spawnSync(process.execPath, [join(HERE, "ci-verdict.mjs"), "--branch", branch, "--head", sha, "--retries", "0"], { cwd, encoding: "utf8", env: ghe });
      return verdictWords(r.stdout, r.status);
    },
    train: (ctx) => realTrain({ ...ctx, cwd, scratch, git, run, env }),
    // The queue's reads: one sha's CI runs on every branch (`--commit` with no `--branch`, measured 2026-11-01), the span's
    // held-out runs, and the writes it makes on its own trains: a rerun of failed jobs, a cancel, a dispatch on the span.
    ciRuns: async (sha) => gh(["run", "list", "--commit", sha, "--workflow", "CI", "--limit", "50", "--json", "databaseId,headBranch,headSha,status,conclusion,attempt,createdAt,event"]),
    rerun: async (id) => { run("gh", ["run", "rerun", String(id), "--failed"], { cwd, env: ghe }); },
    cancelRun: async (id) => { run("gh", ["run", "cancel", String(id)], { cwd, env: ghe }); },
    dispatchCI: async (ref) => { run("gh", ["workflow", "run", "CI", "--ref", ref], { cwd, env: ghe }); },
    heldOut: async (span) => heldOutReading(gh(["run", "list", "--branch", span, "--workflow", "held-out.yml", "--limit", "30", "--json", "headSha,status,conclusion,createdAt"])),
  };
}

/** The span's held-out runs as the gate reads them: the newest COMPLETED whole run (its sha, green or red) and the runs in flight. */
export function heldOutReading(runs) {
  const newestFirst = [...runs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const whole = newestFirst.find((r) => r.status === "completed" && (r.conclusion === "success" || RED_CONCLUSIONS.has(r.conclusion)));
  return { covered: whole?.headSha ?? null, state: whole ? (whole.conclusion === "success" ? "green" : "red") : null, inFlight: runs.filter((r) => r.status !== "completed").length };
}

/** The train: provision, merge, install if the lockfile moved, build, shared suites, witnesses, evergreen; reads each tally. */
async function realTrain({ name, lanes, span, SP, cwd, scratch, git, run, env }) {
  const W = join(scratch, `wt-${name}`), L = join(scratch, "logs", name);
  mkdirSync(L, { recursive: true });
  const step = (cmd, args, o = {}) => {
    const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...o, env: { ...env, ...o.env } });
    return { exit: r.status ?? 1, text: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  };
  const prov = step(process.execPath, [join(HERE, "provision-worktree.mjs"), W], { cwd });
  writeFileSync(join(L, "provision.log"), prov.text);
  if (prov.exit !== 0) return { state: "provision", worktree: null, why: `provision failed; read ${join(L, "provision.log")}` };
  git(["checkout", "-q", "--detach", `origin/${span}`], { cwd: W });
  for (const l of lanes) {
    try { git(["merge", "--no-ff", "--no-edit", `origin/${span}--${l.suffix}`], { cwd: W, env: { GIT_COMMITTER_NAME: env.GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL: env.GIT_COMMITTER_EMAIL } }); }
    catch { return { state: "conflict", worktree: W, files: git(["diff", "--name-only", "--diff-filter=U"], { cwd: W }).split("\n").filter(Boolean) }; }
  }
  const lockMoved = (() => { try { git(["diff", "--quiet", `origin/${span}`, "HEAD", "--", "pnpm-lock.yaml"], { cwd: W }); return false; } catch { return true; } })();
  if (lockMoved) {
    const i = step("pnpm", ["install", "--frozen-lockfile"], { cwd: W }); writeFileSync(join(L, "install.log"), i.text);
    if (i.exit !== 0) return { state: "build", worktree: W, why: `install failed; read ${join(L, "install.log")}` };
  }
  const b = step("pnpm", ["build"], { cwd: W }); writeFileSync(join(L, "build.log"), b.text);
  if (b.exit !== 0) return { state: "build", worktree: W, why: `build failed; read ${join(L, "build.log")}` };

  const diffs = Object.fromEntries(lanes.map((l) => [l.suffix, git(["diff", "--name-only", `origin/${span}...origin/${span}--${l.suffix}`], { cwd: W }).split("\n").filter(Boolean)]));
  const shared = sharedPackages(diffs);
  const iso = { LAR_ROOT: join(L, "root"), HOME: join(L, "home") };
  mkdirSync(iso.HOME, { recursive: true });
  const verdicts = [`shared packages: ${shared.join(" ") || "none"}`];
  for (const pkg of shared) {
    const home = /lararium-(browser|web)$/.test(pkg) ? env.HOME : iso.HOME;
    const s = step("npx", ["vitest", "run"], { cwd: join(W, pkg), env: { ...iso, HOME: home, LAR_BAGS: undefined } });
    writeFileSync(join(L, `suite-${pkg.split("/").pop()}.log`), s.text);
    const v = readSuiteLog(s.text, s.exit);
    verdicts.push(v.ok ? `ok ${pkg}: ${v.tally}` : `RED ${pkg}: ${v.why}`);
  }
  const wa = step("bash", ["tools/witness-all.sh"], { cwd: W, env: { ...iso, LAR_BAGS: undefined } }); writeFileSync(join(L, "witness.log"), wa.text);
  verdicts.push(wa.exit === 0 && wa.text.includes("every witness clean") ? "ok witness-all" : "RED witness-all");
  const eg = step(process.execPath, ["tools/evergreen-boundary.mjs"], { cwd: W }); writeFileSync(join(L, "evergreen.log"), eg.text);
  verdicts.push(eg.exit === 0 ? "ok evergreen" : "RED evergreen");
  if (git(["status", "--porcelain", "--untracked-files=no"], { cwd: W })) verdicts.push("RED tree dirty after build");
  writeFileSync(join(L, "verdict.txt"), `${verdicts.join("\n")}\n`);
  const reds = verdicts.filter((v) => v.startsWith("RED"));
  return { state: reds.length ? "red" : "green", worktree: W, head: git(["rev-parse", "HEAD"], { cwd: W }), why: reds.join("; ") };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const take = (flag, fallback) => { const i = argv.indexOf(flag); if (i < 0) return fallback; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const flag = (f) => { const i = argv.indexOf(f); if (i < 0) return false; argv.splice(i, 1); return true; };
  const span = take("--span", SPAN), scratch = resolve(take("--scratch", join(userInfo().homedir, ".lares-scratch", "train")));
  const queueDir = resolve(take("--queue", defaultQueue())), shipDir = resolve(take("--ship", defaultShip()));
  const k = Number(take("--k", 4)), depth = Number(take("--depth", 2)), name = take("--name", "train");
  const plan = flag("--plan"), local = flag("--local");
  const usage = "usage: land-train.mjs [--plan] [--local] [--span b] [--queue d] [--ship d] [--scratch d] [--k n] [--depth n] [--name n] <suffix:pr:head:msgfile>...\n       land-train.mjs enqueue <suffix:pr:head:msgfile>... | run | status";
  if (!(k >= 1) || !(depth >= 1)) { console.error(usage); process.exit(2); }
  const cwd = process.cwd(), ops = realOps({ cwd, scratch });
  const [verb, ...rest] = argv;
  let code;
  if (verb === "status") ({ code } = await queueStatus({ span, cwd, queueDir }, ops));
  else if (verb === "enqueue") ({ code } = rest.length ? await enqueue({ specs: rest, span, cwd, shipDir, queueDir }, ops) : { code: 2 });
  else if (verb === "run") ({ code } = await landTrain({ fromQueue: true, specs: rest, plan, local, span, cwd, k, depth, shipDir, queueDir, name }, ops));
  else if (argv.length) ({ code } = await landTrain({ specs: argv, plan, local, span, cwd, k, depth, shipDir, queueDir, name }, ops));
  else { console.error(usage); code = 2; }
  process.exit(code);
}
