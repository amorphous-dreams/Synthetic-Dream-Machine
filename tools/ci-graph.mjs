#!/usr/bin/env node
/**
 * ci-graph — the job graph a full CI run raises, read off the workflow files, and the numbers the account's
 * concurrent-job cap cares about.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────────────────────────
 * The account runs about twenty jobs at once. A run that raises more than ten of them at one moment leaves no room for
 * a second full run to start beside it. The cap binds on jobs RUNNING together, so the number that matters is the widest
 * set of jobs with no `needs` path between them (an antichain of the DAG), and beside it the plain job total. The
 * workflow files are the one statement of the graph; this reader expands their matrices and the called e2e workflow and
 * answers both numbers, so a test holds the workflow to them and a later edit cannot widen the run quietly.
 *
 * The reader takes the shapes these two files use (block `needs:`, `include:` rows, `uses: ./.github/workflows/…`). A
 * shape it does not know throws, so a rewrite of the workflow reads red here and never reads as a quiet zero.
 *
 * Usage:  node tools/ci-graph.mjs      print the jobs, the widest concurrent set and the total
 */
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stripComments = (text) => text.replace(/^\s*#.*$/gm, "").replace(/\s+#\s.*$/gm, "");

/** The lines of one top-level key's block: everything indented deeper than the key. */
function blockOf(lines, startIndex, indent) {
  const out = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") { out.push(line); continue; }
    const lead = line.length - line.trimStart().length;
    if (lead <= indent) break;
    out.push(line);
  }
  return out;
}

/** `jobs:` of one workflow text -> `[{ id, needs: [ids], rows, uses, ifText }]`; `rows` is the matrix row count (1 with no matrix). */
export function readJobs(text) {
  const lines = stripComments(text).split("\n");
  const at = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (at === -1) throw new Error("ci-graph: no `jobs:` block");
  const body = blockOf(lines, at, 0);
  const jobs = [];
  let current = null;
  for (const line of body) {
    const head = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (head) { current = { id: head[1], lines: [] }; jobs.push(current); continue; }
    if (current) current.lines.push(line);
  }
  return jobs.map((j) => {
    const own = j.lines.filter((l) => /^ {4}\S/.test(l));
    const needsLine = own.find((l) => /^ {4}needs:/.test(l));
    let needs = [];
    if (needsLine) {
      const v = needsLine.replace(/^ {4}needs:\s*/, "").trim();
      if (v.startsWith("[")) needs = v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      else if (v) needs = [v];
      else throw new Error(`ci-graph: job ${j.id} carries a block-form needs, which this reader does not know`);
    }
    const uses = /^ {4}uses:\s*(\S+)/m.exec(j.lines.join("\n"))?.[1] ?? null;
    const ifText = own.find((l) => /^ {4}if:/.test(l))?.replace(/^ {4}if:\s*/, "").trim() ?? null;
    let rows = 1;
    const inc = j.lines.findIndex((l) => /^ {8}include:\s*$/.test(l));
    if (inc !== -1) {
      rows = 0;
      for (let i = inc + 1; i < j.lines.length; i++) {
        const l = j.lines[i];
        if (l.trim() === "") continue;
        const lead = l.length - l.trimStart().length;
        if (lead <= 8) break;
        if (/^ {10}- /.test(l)) rows++;
      }
      if (rows === 0) throw new Error(`ci-graph: job ${j.id} has an include: block with no rows`);
    } else if (/^ {6}matrix:\s*\S/m.test(j.lines.join("\n"))) {
      throw new Error(`ci-graph: job ${j.id} matrix comes from an expression; the reader cannot count it`);
    }
    return { id: j.id, needs, rows, uses, ifText };
  });
}

/**
 * Every job INSTANCE of one workflow, the called workflows expanded in place. `files` maps a workflow's path under
 * `.github/workflows/` to its text. An instance is `{ key, needs: [keys] }`; a job depending on a matrix job depends on
 * every row of it, and a caller's dependants depend on every job of the called workflow.
 */
export function expandInstances(rootName, files, prefix = "") {
  const jobs = readJobs(files[rootName]);
  const keysOf = new Map();
  const out = [];
  for (const j of jobs) {
    if (j.uses) {
      const called = /^\.\/\.github\/workflows\/(.+)$/.exec(j.uses)?.[1];
      if (!called || files[called] === undefined) throw new Error(`ci-graph: job ${j.id} calls ${j.uses}, which was not handed in`);
      const inner = expandInstances(called, files, `${prefix}${j.id}/`);
      const gate = j.needs.flatMap((n) => keysOf.get(n) ?? []);
      for (const i of inner) out.push({ ...i, needs: [...i.needs, ...(i.needs.length === 0 ? gate : [])], ifText: i.ifText });
      keysOf.set(j.id, inner.map((i) => i.key));
      continue;
    }
    const keys = Array.from({ length: j.rows }, (_, k) => `${prefix}${j.id}${j.rows > 1 ? `#${k + 1}` : ""}`);
    keysOf.set(j.id, keys);
    for (const key of keys) out.push({ key, needs: j.needs.flatMap((n) => keysOf.get(n) ?? []), ifText: j.ifText });
  }
  return out;
}

/** Widest set of instances with no needs path between any two (the most jobs that can run at once). Exact, by search. */
export function widestConcurrent(instances) {
  const keys = instances.map((i) => i.key);
  const direct = new Map(instances.map((i) => [i.key, i.needs]));
  const below = new Map();
  const reach = (k) => {
    if (below.has(k)) return below.get(k);
    const set = new Set();
    below.set(k, set);
    for (const n of direct.get(k) ?? []) { set.add(n); for (const m of reach(n)) set.add(m); }
    return set;
  };
  for (const k of keys) reach(k);
  const ordered = (a, b) => below.get(a).has(b) || below.get(b).has(a);
  let best = 0;
  const grow = (chosen, rest) => {
    best = Math.max(best, chosen.length);
    if (chosen.length + rest.length <= best) return;
    for (let i = 0; i < rest.length; i++) {
      if (chosen.length + rest.length - i <= best) return;
      const k = rest[i];
      grow([...chosen, k], rest.slice(i + 1).filter((o) => !ordered(k, o)));
    }
  };
  grow([], keys);
  return best;
}

/** A job that runs on the queue's merge_group event alone: a push or a pull request never raises it. */
export const mergeGroupOnly = (ifText) => ifText !== null && /github\.event_name\s*==\s*'merge_group'/.test(ifText) && !/always\(\)\s*\|\|/.test(ifText);

/**
 * The two numbers for one workflow set: the most jobs running at once, and every job raised. `event` names the run:
 * "push" (the default: a lane push) leaves out the jobs that stand on merge_group alone; "merge_group" keeps them.
 */
export function graphNumbers(rootName, files, { event = "push" } = {}) {
  const all = expandInstances(rootName, files);
  const instances = event === "push" ? all.filter((i) => !mergeGroupOnly(i.ifText)) : all;
  return { concurrent: widestConcurrent(instances), total: instances.length, jobs: instances.map((i) => i.key) };
}

/** Read the live workflow files. */
export function liveFiles(root = ROOT) {
  const dir = join(root, ".github/workflows");
  return Object.fromEntries(["ci.yml", "e2e-shards.yml", "held-out.yml"].map((n) => [n, readFileSync(join(dir, n), "utf8")]));
}

// ── the events: how many runs one lane push raises ───────────────────────────────────────────────

/** The guard a job carries so a same-repository pull request raises no run beside its push: only a fork's PR is the PR trigger's own. */
export const FORK_GUARD = /github\.event_name\s*!=\s*'pull_request'\s*\|\|\s*github\.event\.pull_request\.head\.repo\.fork/;

/** Which `on:` events a workflow text lists. */
export function triggers(text) {
  const lines = stripComments(text).split("\n");
  const at = lines.findIndex((l) => /^on:\s*$/.test(l));
  if (at === -1) throw new Error("ci-graph: no `on:` block");
  return blockOf(lines, at, 0).filter((l) => /^ {2}[a-z_]+:/.test(l)).map((l) => /^ {2}([a-z_]+):/.exec(l)[1]);
}

/**
 * How many runs of one workflow a push to a lane branch raises while a same-repository PR is open on it: one for the
 * push, plus one for the pull_request event unless every job of the workflow stands guarded off by the fork guard.
 * Held-out lists no pull_request trigger and so stays at its push alone.
 */
export function runsPerLanePush(workflowText) {
  const on = triggers(workflowText);
  let runs = on.includes("push") ? 1 : 0;
  if (on.includes("pull_request")) {
    const guarded = readJobs(workflowText).every((j) => j.ifText !== null && (FORK_GUARD.test(j.ifText) || mergeGroupOnly(j.ifText)));
    if (!guarded) runs += 1;
  }
  return runs;
}

if (process.argv[1] && basename(process.argv[1]) === "ci-graph.mjs") {
  const files = liveFiles();
  const n = graphNumbers("ci.yml", files);
  console.log(`ci-graph: concurrent=${n.concurrent} total=${n.total}`);
  for (const j of n.jobs) console.log(`  ${j}`);
  console.log(`ci-graph: runs per lane push with an open PR: ci=${runsPerLanePush(files["ci.yml"])} held-out=${runsPerLanePush(files["held-out.yml"])}`);
}
