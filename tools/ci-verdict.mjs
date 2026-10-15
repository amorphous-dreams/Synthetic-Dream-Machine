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
 * `.github/workflows/held-out.yml`. A head they never measured used to read "green" here, because this reader
 * looked at the CI workflow alone. So it prints a third reading under the same three words: the held-out run
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
 * Exit: 0 green · 1 red · 2 unread · 3 the reader itself could not read (gh absent, no such branch).
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
  if (h.state === "unread") lines.push("  UNREAD never reads as green: the CI workflow and the shards raise no container mesh and no browser weld.");
  return lines;
}

/** The verdict as the lines a person reads. */
export function render(v) {
  const short = (sha) => String(sha).slice(0, 9);
  const lines = [`ci-verdict: ${v.state.toUpperCase()} for ${short(v.head)} — ${v.why}`];
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

export const exitOf = (state) => ({ green: 0, red: 1, unread: 2 })[state];

function main(argv) {
  const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
  const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  let v;
  try {
    const branch = opt("branch", null) ?? sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const head = sh("git", ["rev-parse", opt("head", "HEAD")]);
    const runs = JSON.parse(sh("gh", ["run", "list", "--branch", branch, "--workflow", opt("workflow", "CI"), "--limit", opt("limit", "30"),
      "--json", "databaseId,headSha,status,conclusion,createdAt,url"]));
    const view = (id) => JSON.parse(sh("gh", ["run", "view", String(id), "--json", "jobs"]));
    const first = readVerdict({ runs, head });
    const views = {};
    for (const id of new Set([first.run, first.last?.run])) if (id != null) views[id] = view(id);
    v = readVerdict({ runs, head, views });
    // The third reading says and never moves the exit code, so a failure to read IT reads unread and stops
    // nothing: the CI reading above still decides how this door exits.
    let heldOut;
    try {
      const heldRuns = JSON.parse(sh("gh", ["run", "list", "--branch", branch, "--workflow", opt("held-out", "held-out.yml"), "--limit", opt("limit", "30"),
        "--json", "databaseId,headSha,status,conclusion,createdAt,url"]));
      const firstHeld = readHeldOut({ runs: heldRuns, head });
      let behind = null;
      if (firstHeld.run !== null && !firstHeld.coversHead) {
        // A run head this checkout never fetched names no ancestor it can count from: the gap stays unsaid.
        try { behind = Number(sh("git", ["rev-list", "--count", `${firstHeld.runHead}..${head}`])); } catch { behind = null; }
      }
      heldOut = readHeldOut({ runs: heldRuns, head, views: firstHeld.run === null ? {} : { [firstHeld.run]: view(firstHeld.run) }, behind });
    } catch (err) {
      heldOut = heldOutUnreadable(head, String(err?.stderr || err?.message || err).trim());
    }
    console.log(argv.includes("--json") ? JSON.stringify({ branch, ...v, heldOut }, null, 2)
      : [`ci-verdict: branch ${branch}`, ...render(v), ...renderHeldOut(heldOut)].join("\n"));
  } catch (err) {
    console.error(`ci-verdict: could not read — ${String(err?.stderr || err?.message || err).trim()}`);
    return 3;
  }
  return exitOf(v.state);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
