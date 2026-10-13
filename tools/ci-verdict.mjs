#!/usr/bin/env node
/**
 * ci-verdict — what the full CI workflow says about ONE head, and the last whole verdict the branch holds.
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
 * Usage:  node tools/ci-verdict.mjs [--branch <name>] [--head <sha>] [--workflow <name>] [--limit <n>] [--json]
 *   --branch    default: the checked-out branch
 *   --head      default: `git rev-parse HEAD` (the commit a controller means to call green)
 *   --workflow  default: CI
 * Exit: 0 green · 1 red · 2 unread · 3 the reader itself could not read (gh absent, no such branch).
 *
 * `readVerdict` and `failing` carry the whole law as pure functions over `gh`'s JSON, so
 * `ci-verdict.test.mjs` plants a recorded reading and needs no network.
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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
    console.log(argv.includes("--json") ? JSON.stringify({ branch, ...v }, null, 2) : [`ci-verdict: branch ${branch}`, ...render(v)].join("\n"));
  } catch (err) {
    console.error(`ci-verdict: could not read — ${String(err?.stderr || err?.message || err).trim()}`);
    return 3;
  }
  return exitOf(v.state);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exit(main(process.argv.slice(2)));
