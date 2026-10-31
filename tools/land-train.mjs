#!/usr/bin/env node
/**
 * land-train — land green lanes onto the span by ONE repo tool (controller-handoff#/the-lanes).
 *
 *   node tools/land-train.mjs [--plan] [--span <branch>] [--scratch <dir>] <name> <base> <suffix:pr:head:msgfile>...
 *   run from the main checkout, which stands on the span; wrap it in tools/battery.sh (a train is the heavy battery).
 *
 * Each lane `<span>--<suffix>` stands GREEN (its CI alone, read by tools/ci-verdict.mjs; held-out runs per train, on the span,
 * so a lane's held-out reading prints but never gates, and a lane with no run reads `held-out: not run (per train)`) on a head that carries <base>,
 * the last span commit no lane here wrote. The span may stand past <base> only by LANDS (a first-parent subject carrying
 * ` — merge PR #`) or by ROAD commits the span's own CI and held-out read GREEN: the newest road commit at its exact sha, and
 * an older one at its own sha or carried by a newer road commit read GREEN, whose run tested a tree holding it. A road commit
 * whose push changed only the paths of tools/ci-ignored-paths.json (meme, docs, wiki) raised no run; it passes when every commit
 * between it and the nearest first-parent ancestor reading GREEN changed ignored paths alone, and a code commit with no run refuses.
 *
 *   TRAIN   merge every lane over the span in a provisioned worktree, install when the lockfile moved, build, run the suites of
 *           every package two lanes both touch, witness-all, evergreen; read each verdict from its tally, never an exit alone.
 *           Then write one commit per lane, chained, each with the train's own merge tree, and check the last tree IS the
 *           train's tree before anything pushes.
 *   DIRECT  one lane whose head already holds the span head lands with no train: the land commit takes the lane head's tree,
 *           which the lane's own CI already read.
 *   --plan  runs the read-only preflight and prints the commits it would write; it pushes nothing, builds nothing.
 *
 * A verdict reads THREE states. UNREADABLE (GitHub unreachable, a 5xx) reads again six times, thirty seconds apart, and then
 * exits 10 with its own code: it never reads as red or as green, so a land guard never refuses on weather.
 *
 * Exit: 0 landed · 2 usage/identity/message/checkout · 3 a head moved or the span moved by a non-land commit not read green
 *       · 4 merge conflict · 5 train red or the chain broke · 6 disk floor, worktree cap, or a run in flight on the span
 *       · 7 provision, install or build failed · 8 a lane not green · 9 a lane lacks the base · 10 UNREADABLE.
 *
 * Author identity reads `git config user.name/email`. Disk floor: LARES_DISK_MIN_C_GB (60) and 40 on /. The Docker prune
 * stays the controller's own (an operator-scoped standing permission), outside this tool.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statfsSync, writeFileSync } from "node:fs";
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

import { onlyIgnoredPaths } from "./ci-ignored-paths.mjs";

const short = (sha) => String(sha).slice(0, 9);
const isAncestor = (git, a, b) => { try { git(["merge-base", "--is-ancestor", a, b]); return true; } catch { return false; } };

const touchesIgnoredOnly = (git, c) => onlyIgnoredPaths(git(["diff-tree", "--no-commit-id", "--name-only", "-r", "-m", "--first-parent", c]).split("\n").filter(Boolean));
/** The nearest first-parent ancestor of `c` reading GREEN at its sha, or null where a commit between holds a run that is not green or touches code. */
async function greenAncestor(ops, git, span, c) {
  for (const a of git(["rev-list", "--first-parent", "-n", "50", `${c}^`]).split("\n").filter(Boolean)) {
    const v = await settled(ops, span, a);
    if (classify(v) === "green") return a;
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

/**
 * The whole land over injected `ops` (git, verdict, disk, houseWorktrees, spanRuns, cancelRuns, readMsg, removeWorktree,
 * train, sleep, env, log). Returns `{ code }`; every line it says goes through `ops.log`.
 */
export async function landTrain({ name, base, specs, plan = false, span = SPAN, cwd }, ops) {
  const say = ops.log;
  const git = (args, o = {}) => ops.git(args, { cwd, ...o });
  const stop = (code, ...lines) => { for (const l of lines) say(l); return { code }; };
  let lanes;
  try { lanes = specs.map(parseSpec); } catch (e) { return stop(2, e.message); }
  if (lanes.length === 0) return stop(2, "no lane named");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(String(name))) return stop(2, `train name "${name}" must be one plain path component`);

  let who;
  try { who = { name: git(["config", "user.name"]), email: git(["config", "user.email"]) }; } catch { who = { name: "", email: "" }; }
  if (!who.name || !who.email) return stop(2, "NO AUTHOR IDENTITY: set git config user.name and git config user.email");
  const env = { GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email, GIT_COMMITTER_NAME: who.name, GIT_COMMITTER_EMAIL: who.email };

  if (git(["rev-parse", "--abbrev-ref", "HEAD"]) !== span) return stop(2, `MAIN CHECKOUT NOT ON THE SPAN ${span}`);
  git(["fetch", "-q", "origin"]);
  const SP = git(["rev-parse", `origin/${span}`]);
  let baseSha;
  try { baseSha = git(["rev-parse", base]); } catch { return stop(3, `BASE ${base} IS NOT A COMMIT`); }
  if (!isAncestor(git, baseSha, SP)) return stop(3, `BASE ${base} IS NOT ON THE SPAN`);

  // The span stands past <base> only by lands or by road commits read green. The walk runs newest first: a road commit read
  // GREEN carries every older commit beneath it, since its run tested a tree that holds them (a push that lands while a run
  // flies cancels that run, so an older sha may hold no verdict of its own). The newest road commit always reads at its sha.
  let carrier = null, spanCarried = false;
  for (const c of git(["rev-list", "--first-parent", `${baseSha}..${SP}`]).split("\n").filter(Boolean)) {
    if (git(["log", "-1", "--format=%s", c]).includes(LAND_SUBJECT)) continue;
    if (carrier) { say(`road commit ${short(c)} carried by ${short(carrier)} GREEN`); continue; }
    const v = await settled(ops, span, c);
    const k = classify(v);
    if (k === "green") { say(`road commit ${short(c)} GREEN on the span`); carrier = c; continue; }
    if (v.ci === "unread" && touchesIgnoredOnly(git, c)) {
      // The push of this commit changed ignored paths alone (tools/ci-ignored-paths.json), so the push raised no run. It passes only over
      // a green ancestor, reached first-parent through commits that also changed ignored paths alone and hold no run of their own.
      const anchor = await greenAncestor(ops, git, span, c);
      if (anchor) { say(`road commit ${short(c)} touches ignored paths only; no run stands; carried by green ancestor ${short(anchor)}`); carrier = anchor; if (c === SP) spanCarried = true; continue; }
    }
    if (k === "unreadable") return stop(10, `UNREADABLE: the verdict of road commit ${short(c)} could not be read (${v.ci}/${v.heldOut}); read again later, it is no red`);
    return stop(3, `SPAN MOVED BY A NON-LAND COMMIT NOT READ GREEN since ${short(baseSha)}: ${git(["log", "-1", "--oneline", c]).slice(0, 80)}`);
  }

  for (const l of lanes) {
    const branch = `${span}--${l.suffix}`;
    let LH;
    try { LH = git(["rev-parse", `origin/${branch}`]); } catch { return stop(3, `NO LANE BRANCH origin/${branch}`); }
    if (LH !== l.head) return stop(3, `HEAD MOVED: ${l.suffix} is ${LH}, not ${l.head}`);
    if (!isAncestor(git, baseSha, LH)) return stop(9, `LANE LACKS THE BASE: ${l.suffix}`);
    if (!ops.readMsg(l.msg).trim()) return stop(2, `NO MESSAGE FILE: ${l.msg}`);
    const v = await settled(ops, branch, LH, { lane: true });
    const k = classifyLane(v);
    if (k === "unreadable") return stop(10, `UNREADABLE: lane ${l.suffix}'s CI verdict could not be read (${v.ci}); read again later, it is no red`);
    if (k !== "green") return stop(8, `LANE NOT GREEN: ${l.suffix}`, `  ci ${v.ci} · held-out ${heldOutNote(v)}`);
    l.subject = ops.readMsg(l.msg).split("\n")[0];
    say(`lane ${l.suffix} GREEN at ${short(LH)} (PR #${l.pr}) · held-out: ${heldOutNote(v)}`);
  }

  const direct = lanes.length === 1 && isAncestor(git, SP, lanes[0].head);
  if (!direct) {
    // The train reads every lane over the span as it stands: the span head itself must read GREEN (the shell's SPAN NOT GREEN).
    // A span head whose push the ignore list skipped holds no run; the walk above already carried it over a green ancestor.
    const sv = spanCarried ? { ci: "green", heldOut: "green" } : await settled(ops, span, SP), sk = classify(sv);
    if (sk === "unreadable") return stop(10, `UNREADABLE: the span head ${short(SP)}'s verdict could not be read (${sv.ci}/${sv.heldOut}); read again later, it is no red`);
    if (sk !== "green") return stop(5, `SPAN NOT GREEN at ${short(SP)}: ci ${sv.ci} · held-out ${sv.heldOut}`);
    const d = diskRefusal(ops.disk(), ops.env); if (d) return stop(6, d);
    const c = worktreeCapRefusal(ops.houseWorktrees()); if (c) return stop(6, c);
  }

  if (plan) {
    say(`PLAN ${direct ? "DIRECT land (no train)" : `TRAIN ${name}`} over span ${short(SP)}, base ${short(baseSha)}; nothing pushed, nothing built`);
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

  // The checkout must hold the span head exactly, so the fast-forward after the span push is a fast-forward and a local
  // commit the span never published can neither ride the push nor strand the lane branches.
  if (git(["rev-parse", "HEAD"]) !== SP && isAncestor(git, "HEAD", SP)) { try { git(["merge", "--ff-only", "-q", SP]); } catch { /* the check below says it */ } }
  if (git(["rev-parse", "HEAD"]) !== SP) return stop(2, `MAIN CHECKOUT IS NOT AT ORIGIN'S SPAN HEAD ${short(SP)}; bring it there first`);

  let worktree = null, lands = [], finalTree;
  if (direct) {
    const l = lanes[0];
    const tree = git(["rev-parse", `${l.head}^{tree}`]);
    const land = git(["commit-tree", tree, "-p", SP, "-p", l.head, "-F", l.msg], { env });
    if (git(["rev-parse", `${land}^{tree}`]) !== tree) return stop(5, "LAND TREE DIFFERS FROM THE LANE'S");
    lands = [{ lane: l, land }]; finalTree = tree;
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
    let prev = SP;
    for (const [i, l] of lanes.entries()) {
      const M = merges[i];
      if (git(["rev-parse", `${M}^2`], { cwd: worktree }) !== l.head) return stop(5, `TRAIN ORDER BROKE at ${l.suffix}`, `  the train worktree stands at ${worktree}`);
      const land = git(["commit-tree", git(["rev-parse", `${M}^{tree}`], { cwd: worktree }), "-p", prev, "-p", l.head, "-F", l.msg], { env });
      lands.push({ lane: l, land }); prev = land;
    }
    finalTree = git(["rev-parse", `${T}^{tree}`], { cwd: worktree });
    if (git(["rev-parse", `${prev}^{tree}`]) !== finalTree) return stop(5, "FINAL TREE DIFFERS FROM THE TRAIN'S", `  the train worktree stands at ${worktree}`);
  }

  // Nothing moves while a run flies on the span. The SPAN pushes first, as the one decision, under a lease on the head this
  // land read: a writer that moved it during the train refuses the land and leaves every lane branch where it stood.
  const g = spanPushRefusal(ops.spanRuns(span)); if (g) return stop(6, g);
  const last = lands.at(-1).land;
  try { git(["push", "-q", `--force-with-lease=refs/heads/${span}:${SP}`, "origin", `${last}:refs/heads/${span}`]); }
  catch (e) { return stop(6, `SPAN PUSH REFUSED: the span moved during the train (expected ${short(SP)}); nothing landed and no lane branch moved`, `  ${String(e?.stderr ?? e?.message ?? e).trim().split("\n")[0]}`); }
  say(`pushed ${short(last)} to ${span}`);
  try { git(["merge", "--ff-only", "-q", last]); } catch { say(`WARNING: the local ${span} did not fast-forward to ${short(last)}; run git fetch and fast-forward it`); }
  const moved = [];
  for (const { lane, land } of lands) {
    const branch = `${span}--${lane.suffix}`;
    say(`landed ${lane.suffix} (PR #${lane.pr}) as ${land}`);
    try { git(["push", "-q", `--force-with-lease=${branch}:${lane.head}`, "origin", `${land}:refs/heads/${branch}`]); moved.push({ lane, land }); }
    catch { say(`LANE BRANCH NOT MOVED: ${lane.suffix} (its lease on ${short(lane.head)} failed; the span holds its head, so its PR reads merged)`); }
  }
  if (worktree) ops.removeWorktree(worktree);
  // The lane-branch push starts a run on a commit the span's own run already measures; those runs only crowd the queue ahead
  // of live lanes. Cancel by the pushed land sha (the lane's next feature keeps its runs), once the runs have appeared.
  let pending = moved;
  for (let round = 0; round < 3 && pending.length; round++) {
    await ops.sleep(20000);
    const still = [];
    for (const m of pending) {
      const ids = await ops.cancelRuns(`${span}--${m.lane.suffix}`, m.land);
      if (ids.length === 0) still.push(m); else for (const id of ids) say(`cancelled the landed lane's run ${m.lane.suffix} ${id}`);
    }
    pending = still;
  }
  return stop(0, direct ? "DIRECT-LANDED" : "BATCH-LANDED");
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
  };
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
  const span = take("--span", SPAN), scratch = resolve(take("--scratch", join(userInfo().homedir, ".lares-scratch", "train")));
  const plan = argv.includes("--plan"); if (plan) argv.splice(argv.indexOf("--plan"), 1);
  const [name, base, ...specs] = argv;
  if (!name || !base || specs.length === 0) { console.error("usage: land-train.mjs [--plan] [--span <branch>] [--scratch <dir>] <name> <base> <suffix:pr:head:msgfile>..."); process.exit(2); }
  const cwd = process.cwd();
  const { code } = await landTrain({ name, base, specs, plan, span, cwd }, realOps({ cwd, scratch }));
  process.exit(code);
}
