#!/usr/bin/env node
/**
 * ci-verdict — what the full CI workflow says about ONE head, the last whole verdict the branch holds, and what
 * the held-out container drivers say beside both.
 *
 * ── THE BLIND SPOT THIS READS ───────────────────────────────────────────────────────────────────
 * `.github/workflows/ci.yml` groups its runs per ref and cancels a run in progress when a newer push lands
 * (`concurrency: cancel-in-progress`). A branch that takes a push every half hour therefore cancels run after
 * run, and a red workflow hides behind a column of `cancelled`. The e2e shards answer on their own lane
 * (`ci/<lane>`) and never run the `Test` job's package suites, the witness fleet or the tool self-tests, so a
 * shard-green head says nothing about any of them.
 *
 * ── THREE READINGS, NEVER TWO ───────────────────────────────────────────────────────────────────
 *   green   the run that names this head completed, and every job in it succeeded
 *   red     a job in the head's run failed (a run cancelled AFTER a job failed still reads red)
 *   unread  nothing measured this head: no run names it, its run still runs, or its run got cancelled clean
 * `unread` never reads as green. Beside it the reader prints the LAST WHOLE VERDICT the branch holds: the
 * newest run that ran to its own end, with the count of runs cancelled since, and every failing job and step.
 *
 * ── THE THIRD READING: THE HELD-OUT DRIVERS ─────────────────────────────────────────────────────
 * The CI workflow and the e2e shards raise no container mesh and no browser weld; those drivers ride
 * `.github/workflows/held-out.yml`. A reader of the CI workflow alone would read "green" for a head those drivers
 * never measured, so this one prints a third reading under the same three words: the held-out run
 * that names this head, or else the newest one the branch holds, with that run's head, how many commits behind
 * the asked head it stands, and each driver's result. No held-out run on the branch reads `unread`. The third
 * reading SAYS and never blocks: the exit code follows the CI workflow's reading alone.
 *
 * Usage:  node tools/ci-verdict.mjs [--branch <name>] [--head <sha>] [--workflow <name>] [--held-out <file>] [--limit <n>] [--json]
 *   --branch    default: the checked-out branch
 *   --head      default: `git rev-parse HEAD` (the commit a controller means to call green)
 *   --workflow  default: CI
 *   --held-out  default: held-out.yml (the workflow's file name: a workflow absent from the default branch
 *               answers to no display name)
 *   --wait      read again every --interval seconds (default 30) until neither the CI reading nor the held-out reading
 *               reads `unread`; the exit code is the CI reading's, unchanged. A run cancelled clean, a run still
 *               running and a held-out run that does not name the head yet are all `unread`, so the wait goes on.
 *   --retries   how many times an UNREADABLE read (network, 5xx, timeout, rate limit) reads again before the door
 *               says so (default 6). Applies with or without --wait.
 * Exit: 0 green · 1 red · 2 unread · 3 the reader itself could not read (gh absent, no such branch, a 4xx)
 *       · 4 UNREADABLE (GitHub could not be reached, or answered 5xx, for every one of the reads).
 *
 * ── THREE VERDICTS, AND A FOURTH THING THAT IS NO VERDICT ───────────────────────────────────────
 * GREEN, RED, and UNREAD (nothing measured the head yet) are readings of the CI. UNREADABLE says the reader could not
 * reach GitHub: it never reads as red, never reads as green, never ends a vigil early, and never calls for a rerun.
 * A run whose jobs endpoint stays unreadable falls back to that run's own conclusion at the exact sha, and says so.
 *
 * The line `job-minutes: N (critical path M min)` sums each job's started-to-completed minutes from the head's run;
 * M is the run's first start to its last completion. A job with no completion reads `partial`, never a smaller number.
 *
 * `readVerdict`, `readHeldOut` and `failing` carry the whole law as pure functions over `gh`'s JSON, so
 * `ci-verdict.test.mjs` plants a recorded reading and needs no network.
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { DRIVERS } from "./held-out-cells.mjs";

/** A run that reached its own end: it measured something. A cancelled or skipped run measured nothing whole. */
const WHOLE = new Set(["success", "failure", "timed_out", "startup_failure", "action_required"]);
/** A job or step conclusion that counts as a red. */
const RED = new Set(["failure", "timed_out", "startup_failure", "action_required"]);

/** The failing jobs of one run view (`gh run view <id> --json jobs`), each with its failing steps. */
export function failing(view) {
  return (view?.jobs ?? [])
    .filter((j) => RED.has(j.conclusion))
    .map((j) => ({ job: j.name, conclusion: j.conclusion, steps: (j.steps ?? []).filter((s) => RED.has(s.conclusion)).map((s) => s.name) }));
}

/**
 * Read the verdict for `head` off a branch's runs.
 *
 * @param runs   `gh run list --json databaseId,headSha,status,conclusion,createdAt,url`, in any order
 * @param head   the full sha asked about
 * @param views  run views by `databaseId` (`gh run view --json jobs`); only the head's run and the last whole run get read
 */
export function readVerdict({ runs, head, views = {} }) {
  const newestFirst = [...runs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const own = newestFirst.find((r) => r.headSha === head) ?? null;
  const lastWhole = newestFirst.find((r) => r.status === "completed" && WHOLE.has(r.conclusion)) ?? null;
  const cancelledSince = lastWhole === null ? 0
    : newestFirst.slice(0, newestFirst.indexOf(lastWhole)).filter((r) => r.status === "completed" && !WHOLE.has(r.conclusion)).length;
  const last = lastWhole === null ? null : {
    run: lastWhole.databaseId, headSha: lastWhole.headSha, conclusion: lastWhole.conclusion, url: lastWhole.url ?? null,
    coversHead: lastWhole.headSha === head, cancelledSince, failing: failing(views[lastWhole.databaseId]),
  };

  let state, why, reds = [];
  if (own === null) {
    state = "unread";
    why = `no ${runs.length === 0 ? "run stands on this branch" : "run names this head"}: nothing measured it`;
  } else {
    reds = failing(views[own.databaseId]);
    if (reds.length > 0) {
      state = "red";
      why = own.status === "completed" && WHOLE.has(own.conclusion)
        ? `run ${own.databaseId} completed ${own.conclusion}`
        : `run ${own.databaseId} reads ${own.status === "completed" ? own.conclusion : own.status}, and a job in it already failed`;
    } else if (own.status !== "completed") {
      state = "unread"; why = `run ${own.databaseId} still reads ${own.status}: wait for it, and push nothing that cancels it`;
    } else if (own.conclusion === "success") {
      state = "green"; why = `run ${own.databaseId} completed success`;
    } else if (WHOLE.has(own.conclusion)) {
      // A whole red run whose jobs this reader was handed no view of: red, with the steps unread.
      state = "red"; why = `run ${own.databaseId} completed ${own.conclusion}; its jobs went unread`;
    } else {
      state = "unread"; why = `run ${own.databaseId} completed ${own.conclusion}: a newer push cancelled it before it measured this head`;
    }
  }
  return { state, why, head, run: own?.databaseId ?? null, url: own?.url ?? null, failing: reds, last };
}

/** The driver a held-out job belongs to, read off its name (`Held-out · <driver>` or `Held-out · <driver>-<scenario>`). */
export function driverOf(jobName, drivers = DRIVERS.map((d) => d.driver)) {
  const m = /^Held-out · (.+)$/.exec(jobName ?? "");
  if (!m) return null;
  // The longest driver name wins, so a driver whose name opens another's never takes its cells.
  return [...drivers].sort((a, b) => b.length - a.length).find((d) => m[1] === d || m[1].startsWith(`${d}-`)) ?? null;
}

/** The held-out run's own fail-closed gate: the job that holds every cell's verdict against the cell list. */
export const MERGE_JOB = "Merge the cells";

/**
 * Each driver's result in one held-out run view, every driver named even where no job of it answered.
 *   success   every cell of the driver succeeded
 *   failure   a cell failed or timed out (each red cell named)
 *   running   no cell failed and one still runs or waits
 *   unread    no job of the driver stands in the view, or its cells got skipped or cancelled clean
 * `other` names every failing job that belongs to no driver (the plan, the image build, the merge gate).
 */
export function heldOutDrivers(view, drivers = DRIVERS.map((d) => d.driver)) {
  const jobs = view?.jobs ?? [];
  const rows = drivers.map((driver) => {
    const cells = jobs.filter((j) => driverOf(j.name, drivers) === driver);
    const red = cells.filter((j) => RED.has(j.conclusion)).map((j) => j.name.replace(/^Held-out · /, ""));
    const done = cells.filter((j) => j.status === "completed");
    let result;
    if (red.length > 0) result = "failure";
    else if (cells.length === 0) result = "unread";
    else if (done.length < cells.length) result = "running";
    else if (cells.every((j) => j.conclusion === "success")) result = "success";
    else result = "unread";
    return { driver, result, cells: cells.length, green: cells.filter((j) => j.conclusion === "success").length, red };
  });
  const other = jobs.filter((j) => driverOf(j.name, drivers) === null && RED.has(j.conclusion)).map((j) => ({ job: j.name, conclusion: j.conclusion }));
  // This reader cannot know how many cells the run's own head planned, so one green cell per driver proves
  // little. The run's merge gate knows: it read every planned cell, and only its success says none went missing.
  const gate = jobs.find((j) => j.name === MERGE_JOB)?.conclusion === "success";
  return { rows, other, gate };
}

/**
 * The third reading: what the held-out drivers say about `head`.
 *
 * @param runs    `gh run list --workflow held-out.yml --json databaseId,headSha,status,conclusion,createdAt,url`
 * @param head    the full sha asked about
 * @param views   run views by `databaseId`; only the run shown gets read
 * @param behind  how many commits the shown run's head stands behind `head` (`git rev-list --count`), or null
 *                where the checkout cannot say
 */
export function readHeldOut({ runs, head, views = {}, behind = null }) {
  const newestFirst = [...runs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const shown = newestFirst.find((r) => r.headSha === head) ?? newestFirst[0] ?? null;
  if (shown === null) {
    return { state: "unread", why: "no held-out run stands on this branch: no container driver measured any head of it", head, run: null, runHead: null, coversHead: false, behind: null, url: null, drivers: heldOutDrivers(undefined).rows, other: [] };
  }
  const coversHead = shown.headSha === head;
  const { rows, other, gate } = heldOutDrivers(views[shown.databaseId]);
  const reds = rows.filter((r) => r.result === "failure");
  const ended = shown.status === "completed" ? shown.conclusion : shown.status;
  let state, why;
  if (!coversHead) {
    state = "unread";
    const gap = behind === null ? "a head this checkout cannot place against it" : behind === 0 ? "a head no commit behind it, and never this one" : `${behind} commit(s) behind it`;
    why = `no held-out run names this head; the newest (run ${shown.databaseId}, ${ended}) measured ${String(shown.headSha).slice(0, 9)}, ${gap}`;
  } else if (reds.length > 0 || other.length > 0) {
    state = "red"; why = `run ${shown.databaseId} reads ${ended}: ${[...reds.map((r) => r.driver), ...other.map((o) => o.job)].join(", ")} failed`;
  } else if (shown.status !== "completed") {
    state = "unread"; why = `run ${shown.databaseId} still reads ${shown.status}`;
  } else if (shown.conclusion === "success" && gate && rows.every((r) => r.result === "success")) {
    state = "green"; why = `run ${shown.databaseId} completed success, every driver green and its merge gate with them`;
  } else if (shown.conclusion === "success" && !rows.every((r) => r.result === "success")) {
    // A green run whose view names a driver with no green cell: the run measured less than the drivers.
    state = "unread"; why = `run ${shown.databaseId} completed success, and ${rows.filter((r) => r.result !== "success").map((r) => r.driver).join(", ")} answered no green cell in it`;
  } else if (shown.conclusion === "success") {
    state = "unread"; why = `run ${shown.databaseId} completed success, and its merge gate ("${MERGE_JOB}") answered no success: nothing says every planned cell ran`;
  } else if (WHOLE.has(shown.conclusion)) {
    state = "red"; why = `run ${shown.databaseId} completed ${shown.conclusion}; its jobs went unread`;
  } else {
    state = "unread"; why = `run ${shown.databaseId} completed ${shown.conclusion}: it measured this head in no whole way`;
  }
  return { state, why, head, run: shown.databaseId, runHead: shown.headSha, coversHead, behind: coversHead ? 0 : behind, url: shown.url ?? null, drivers: rows, other };
}

/** The third reading where the reader itself could not read the held-out runs: unread, with the reason. */
export function heldOutUnreadable(head, reason) {
  return { state: "unread", why: `the held-out runs could not be read (${reason})`, head, run: null, runHead: null, coversHead: false, behind: null, url: null, drivers: heldOutDrivers(undefined).rows, other: [] };
}

/** The third reading as the lines a person reads. */
export function renderHeldOut(h) {
  const lines = [`held-out: ${h.state.toUpperCase()} for ${String(h.head).slice(0, 9)} — ${h.why}`];
  if (h.url) lines.push(`  ${h.url}`);
  if (h.run !== null) {
    for (const d of h.drivers) {
      lines.push(`    ${d.driver}: ${d.result}${d.cells > 1 ? ` (${d.green}/${d.cells} cells)` : ""}${d.red.length ? ` — red: ${d.red.join(", ")}` : ""}`);
    }
    for (const o of h.other) lines.push(`    ${o.conclusion}: ${o.job}`);
  }
  if (h.state === "unreadable") lines.push("  UNREADABLE is no verdict: GitHub could not be reached. It reads again, and never stands for red or green.");
  if (h.state === "unread") lines.push("  UNREAD never reads as green: the CI workflow and the shards raise no container mesh and no browser weld.");
  return lines;
}

/** The verdict as the lines a person reads. */
export function render(v) {
  const short = (sha) => String(sha).slice(0, 9);
  const lines = [`ci-verdict: ${v.state.toUpperCase()} for ${short(v.head)} — ${v.why}`];
  if (v.state === "unreadable") return [...lines, "  UNREADABLE is no verdict: GitHub could not be reached. It reads again, and never stands for red or green."];
  if (v.url) lines.push(`  ${v.url}`);
  const reds = (list) => list.flatMap((f) => [`    ${f.conclusion}: ${f.job}`, ...f.steps.map((s) => `      step: ${s}`)]);
  lines.push(...reds(v.failing));
  if (v.last === null) lines.push("  the branch holds NO whole verdict: every run listed got cancelled or still runs");
  else if (!v.last.coversHead) {
    lines.push(`  last whole verdict the branch holds: ${v.last.conclusion.toUpperCase()} at ${short(v.last.headSha)} (run ${v.last.run}), `
      + `${v.last.cancelledSince} run(s) cancelled since`);
    if (v.last.url) lines.push(`  ${v.last.url}`);
    lines.push(...reds(v.last.failing));
  }
  if (v.state === "unread") lines.push("  UNREAD never reads as green: the shards run no package suite, no witness and no tool self-test.");
  return lines;
}

export const exitOf = (state) => ({ green: 0, red: 1, unread: 2, unreadable: 4 })[state];

/** Whether a failed `gh`/`git` call says GitHub could not be reached ("unreadable": read again) or the question is wrong ("hard"). */
export function classifyFailure(err) {
  if (err?.code === "ENOENT") return "hard";
  const text = `${err?.stderr ?? ""}\n${err?.message ?? ""}\n${err?.code ?? ""}`;
  if (err?.killed || err?.signal === "SIGTERM" || err?.code === "ETIMEDOUT") return "unreadable";
  // An explicit HTTP status decides before any word in the text: a 404 that names `timeout.yml` is still a 404.
  const status = /HTTP (\d{3})/.exec(text);
  if (status) return Number(status[1]) >= 500 || Number(status[1]) === 429 ? "unreadable" : "hard";
  if (/Bad Gateway|Service Unavailable|Gateway Time-?out|timed? ?out|timeout|ETIMEDOUT|ECONN\w*|EAI_AGAIN|ENOTFOUND|no such host|could not resolve host|dial tcp|network is unreachable|connection (reset|refused|closed)|TLS handshake|rate limit|error connecting to|check your internet connection|githubstatus|unexpected EOF/i.test(text)) return "unreadable";
  return "hard";
}

const MIN = 60000;
const stampMs = (t) => { const ms = Date.parse(t ?? ""); return Number.isFinite(ms) && ms > Date.parse("1970-01-02T00:00:00Z") ? ms : null; };

/** Job minutes from one run view: `{ minutes, criticalMin, partial, jobs }`, or `null` where no view stands. */
export function jobMinutes(view) {
  if (!view || !Array.isArray(view.jobs)) return null;
  let total = 0, first = Infinity, last = -Infinity, partial = false, counted = 0;
  for (const j of view.jobs) {
    if (j.conclusion === "skipped") continue;
    const a = stampMs(j.startedAt), b = stampMs(j.completedAt);
    if (j.status !== "completed" || a === null || b === null) { partial = true; continue; }
    total += (b - a) / MIN; first = Math.min(first, a); last = Math.max(last, b); counted++;
  }
  const round = (x) => Math.round(x * 10) / 10;
  return { minutes: round(total), criticalMin: counted ? round((last - first) / MIN) : 0, partial, jobs: view.jobs.length };
}

/** The job-minutes line; `partial` never prints a figure that could pass for the whole. */
export function renderJobMinutes(jm) {
  if (jm === null || jm === undefined) return "job-minutes: unread (the run's jobs endpoint stayed unreadable)";
  if (jm.partial) return `job-minutes: partial (a job in the run has no completion time yet; the finished jobs alone sum to ${jm.minutes})`;
  return `job-minutes: ${jm.minutes.toFixed(1)} (critical path ${jm.criticalMin.toFixed(1)} min)`;
}

/** The verdict where the reader could not reach GitHub for every one of its reads. */
export function unreadableVerdict(head, reason) {
  return { state: "unreadable", why: `GitHub could not be read (${reason}); this is no verdict, so it never stands for red or green`, head, run: null, url: null, failing: [], last: null };
}

/** The held-out reading where GitHub could not be reached. */
export function heldOutDark(head, reason) {
  return { ...heldOutUnreadable(head, reason), state: "unreadable", why: `GitHub could not be read for the held-out runs (${reason})` };
}

/** The held-out reading from the run's own conclusion alone, where its jobs endpoint stayed unreadable. */
export function heldOutByConclusion({ runs, head }) {
  const run = [...runs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).find((r) => r.headSha === head);
  const base = heldOutUnreadable(head, "no held-out run names this head");
  if (!run) return base;
  const note = "run conclusion only; its jobs endpoint stayed unreadable";
  const out = { ...base, run: run.databaseId, runHead: run.headSha, coversHead: true, behind: 0, url: run.url ?? null };
  if (run.status !== "completed") return { ...out, state: "unread", why: `run ${run.databaseId} still reads ${run.status} (${note})` };
  if (run.conclusion === "success") return { ...out, state: "green", why: `run ${run.databaseId} completed success (${note})` };
  if (WHOLE.has(run.conclusion)) return { ...out, state: "red", why: `run ${run.databaseId} completed ${run.conclusion} (${note})` };
  return { ...out, state: "unread", why: `run ${run.databaseId} completed ${run.conclusion}: it measured this head in no whole way (${note})` };
}

const defaultSh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000, maxBuffer: 64 * 1024 * 1024 }).trim();
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIELDS = "databaseId,headSha,status,conclusion,createdAt,url";
const reasonOf = (e) => String(e?.stderr || e?.message || e).trim().split("\n")[0].slice(0, 200);

/** One whole reading of `head`, every UNREADABLE call read again up to `retries` times. Throws a hard failure as it stands. */
async function readOnce({ sh, sleep, branch, head, opt }) {
  const retries = Number(opt.retries), waitMs = Number(opt.interval) * 1000;
  // A call that reads UNREADABLE reads again; the last failure is marked and handed up.
  const settle = async (fn) => {
    for (let i = 0; ; i++) {
      try { return fn(); } catch (e) {
        if (classifyFailure(e) !== "unreadable") throw e;
        if (i >= retries) throw Object.assign(e, { dark: true });
        await sleep(waitMs);
      }
    }
  };
  const list = (workflow, withSha) => settle(() => JSON.parse(sh("gh", ["run", "list", "--branch", branch, "--workflow", workflow, "--limit", opt.limit, ...(withSha ? ["--commit", head] : []), "--json", FIELDS])));
  // The branch list holds a window; a head older than it is asked for by its sha.
  const runsFor = async (workflow) => {
    const runs = await list(workflow, false);
    if (runs.some((r) => r.headSha === head)) return runs;
    const own = await list(workflow, true);
    return [...runs, ...own.filter((r) => !runs.some((x) => x.databaseId === r.databaseId))];
  };
  const viewOf = async (id) => {
    try { return await settle(() => JSON.parse(sh("gh", ["run", "view", String(id), "--json", "jobs"]))); }
    catch (e) { if (e.dark) return null; throw e; }
  };

  let runs;
  try {
    runs = await runsFor(opt.workflow);
    // A branch that holds no run at all may not exist: a typo would hold a vigil forever. A 404 here is a hard read.
    if (runs.length === 0) await settle(() => sh("gh", ["api", `repos/{owner}/{repo}/branches/${encodeURI(branch)}`, "--jq", ".name"]));
  } catch (e) { if (e.dark) { const reason = reasonOf(e); return { v: unreadableVerdict(head, reason), heldOut: heldOutDark(head, reason), jm: null }; } throw e; }
  const first = readVerdict({ runs, head });
  const views = {}; let jobsDark = false;
  for (const id of new Set([first.run, first.last?.run])) {
    if (id == null) continue;
    const view = await viewOf(id);
    if (view === null) { if (id === first.run) jobsDark = true; } else views[id] = view;
  }
  const v = readVerdict({ runs, head, views });
  if (jobsDark && v.run !== null) v.why += " (run conclusion only; its jobs endpoint stayed unreadable)";
  const jm = first.run !== null && views[first.run] ? jobMinutes(views[first.run]) : null;

  // The third reading says and never blocks: a failure to read IT leaves the CI reading where it stands.
  let heldOut;
  try {
    const heldRuns = await runsFor(opt.heldOut);
    const firstHeld = readHeldOut({ runs: heldRuns, head });
    if (firstHeld.run === null) heldOut = firstHeld;
    else {
      const view = await viewOf(firstHeld.run);
      if (view === null && firstHeld.coversHead) heldOut = heldOutByConclusion({ runs: heldRuns, head });
      else {
        let behind = null;
        if (!firstHeld.coversHead) { try { behind = Number(sh("git", ["rev-list", "--count", `${firstHeld.runHead}..${head}`])); } catch { behind = null; } }
        heldOut = readHeldOut({ runs: heldRuns, head, views: view === null ? {} : { [firstHeld.run]: view }, behind });
      }
    }
  } catch (err) {
    heldOut = err.dark ? heldOutDark(head, reasonOf(err)) : Object.assign(heldOutUnreadable(head, reasonOf(err)), { hard: true });
  }
  return { v, heldOut, jm, jobsDark };
}

/** The door: returns the exit code. `sh`, `sleep`, `log` and `err` inject, so a test plants a recorded sequence. */
export async function main(argv, { sh = defaultSh, sleep = defaultSleep, log = console.log, err = console.error } = {}) {
  const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
  const opt = { workflow: arg("workflow", "CI"), heldOut: arg("held-out", "held-out.yml"), limit: arg("limit", "30"), retries: arg("retries", "6"), interval: arg("interval", "30") };
  for (const k of ["retries", "interval"]) if (!Number.isFinite(Number(opt[k])) || Number(opt[k]) < 0) { err(`ci-verdict: --${k} wants a non-negative number`); return 3; }
  let r, branch;
  try {
    const namedBranch = arg("branch", null);
    branch = namedBranch ?? sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (namedBranch === null && branch === "HEAD") throw new Error("detached HEAD: name --branch");
    const head = sh("git", ["rev-parse", arg("head", "HEAD")]);
    for (;;) {
      r = await readOnce({ sh, sleep, branch, head, opt });
      const waiting = r.v.state === "unread" || (r.heldOut.state === "unread" && !r.heldOut.hard);
      if (!argv.includes("--wait") || !waiting) break;
      await sleep(Number(opt.interval) * 1000);
    }
  } catch (e) {
    err(`ci-verdict: could not read — ${reasonOf(e)}`);
    return 3;
  }
  const { v, heldOut, jm } = r;
  log(argv.includes("--json") ? JSON.stringify({ branch, ...v, heldOut, jobMinutes: jm }, null, 2)
    : [`ci-verdict: branch ${branch}`, ...render(v), ...(v.state === "unreadable" || r.jobsDark ? [] : [renderJobMinutes(jm)]), ...(r.jobsDark ? [renderJobMinutes(null)] : []), ...renderHeldOut(heldOut)].join("\n"));
  // A vigil never ends in success over a held-out reading it could not read: outside --wait the third reading only says.
  if (argv.includes("--wait") && v.state === "green") {
    if (heldOut.state === "unreadable") return exitOf("unreadable");
    if (heldOut.hard) { err("ci-verdict: could not read — the held-out runs"); return 3; }
  }
  return exitOf(v.state);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(await main(process.argv.slice(2)));
