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

// ── the run law: which jobs one event raises, read off each job's `if:` ──────────────────────────

/**
 * THE FOUR CHECKS THE `develop` RULESET REQUIRES (ruleset 27537551, `required_status_checks`). A lane enters the merge queue
 * only when each one reports on its head sha, so each name must stand on every run that sha raises: run, or skipped by its
 * own `if:` (GitHub reads a skipped required check as passing). A name the run never raises reads "expected" and holds the
 * lane out of the queue for good; a name two jobs raise lets a skipped twin answer for a red one. The list lives ONCE, in
 * tools/land-rule.json (the land rule's own file); this reads it.
 */
export const REQUIRED_CHECKS = Object.freeze(
  JSON.parse(readFileSync(new URL("./land-rule.json", import.meta.url), "utf8")).requiredChecks,
);

const STATUS_FN = /\b(always|success|failure|cancelled)\(\)/;

/** Tokens of one Actions expression (the `${{ }}` stripped). */
function tokens(src) {
  const out = [];
  const re = /\s*(?:(\|\||&&|==|!=|!|\(|\)|,)|'((?:[^']|'')*)'|([A-Za-z_][\w-]*(?:\.[\w-]+)*)|(-?\d+(?:\.\d+)?))/y;
  while (re.lastIndex < src.length) {
    if (/^\s*$/.test(src.slice(re.lastIndex))) break;
    const at = re.lastIndex;
    const m = re.exec(src);
    if (!m) throw new Error(`ci-graph: the expression reader does not know "${src.slice(at).trim()}" in ${src}`);
    if (m[1]) out.push({ op: m[1] });
    else if (m[2] !== undefined) out.push({ str: m[2].replace(/''/g, "'") });
    else if (m[3] !== undefined) out.push({ id: m[3] });
    else out.push({ num: Number(m[4]) });
  }
  return out;
}

/**
 * Evaluate one `if:` expression against a context: `{ github, inputs, needsOk }`. It takes the shapes the house's
 * workflows write (`||`, `&&`, `==`, `!=`, `!`, parentheses, quoted strings, numbers, context paths, `always()`, `success()`,
 * `failure()`, `cancelled()`, `startsWith()`, `endsWith()`, `contains()`); any other shape throws, never a quiet answer.
 * `==` compares strings case-blind, as Actions does; an unknown context path reads null. `success()` reads whether every
 * job the one asked about needs ran; `failure()` and `cancelled()` read false (the plan reads a run with no red in it).
 */
export function evalExpr(text, ctx) {
  const src = text.trim().replace(/^\$\{\{\s*/, "").replace(/\s*\}\}$/, "");
  const t = tokens(src);
  let i = 0;
  const peek = () => t[i];
  const eat = (op) => { if (t[i]?.op !== op) throw new Error(`ci-graph: expected "${op}" in ${src}`); i++; };
  const lookup = (path) => path.split(".").reduce((v, k) => (v === null || v === undefined ? null : v[k] ?? null), ctx);
  const loose = (v) => (typeof v === "string" ? v.toLowerCase() : v ?? null);
  const fns = {
    always: () => true, cancelled: () => false, failure: () => false, success: () => ctx.needsOk !== false,
    startsWith: (a, b) => String(a ?? "").toLowerCase().startsWith(String(b ?? "").toLowerCase()),
    endsWith: (a, b) => String(a ?? "").toLowerCase().endsWith(String(b ?? "").toLowerCase()),
    contains: (a, b) => String(a ?? "").toLowerCase().includes(String(b ?? "").toLowerCase()),
  };
  let or;
  const primary = () => {
    const tok = t[i++];
    if (!tok) throw new Error(`ci-graph: the expression ends early: ${src}`);
    if (tok.op === "!") return !primary();
    if (tok.op === "(") { const v = or(); eat(")"); return v; }
    if (tok.str !== undefined) return tok.str;
    if (tok.num !== undefined) return tok.num;
    if (tok.id === "true") return true;
    if (tok.id === "false") return false;
    if (tok.id === "null") return null;
    if (tok.id && peek()?.op === "(") {
      const fn = fns[tok.id];
      if (!fn) throw new Error(`ci-graph: the expression reader does not know ${tok.id}() in ${src}`);
      eat("(");
      const args = [];
      while (peek()?.op !== ")") { args.push(or()); if (peek()?.op === ",") i++; }
      eat(")");
      return fn(...args);
    }
    if (tok.id) return lookup(tok.id);
    throw new Error(`ci-graph: unexpected "${tok.op}" in ${src}`);
  };
  const cmp = () => {
    let v = primary();
    while (peek()?.op === "==" || peek()?.op === "!=") {
      const op = t[i++].op;
      const w = primary();
      // Actions coerces two different types to numbers before it compares them.
      const same = typeof v === typeof w ? loose(v) === loose(w) : Number(v ?? 0) === Number(w ?? 0);
      v = op === "==" ? same : !same;
    }
    return v;
  };
  const and = () => { let v = cmp(); while (peek()?.op === "&&") { i++; const w = cmp(); v = Boolean(v) && Boolean(w); } return v; };
  or = () => { let v = and(); while (peek()?.op === "||") { i++; const w = and(); v = Boolean(v) || Boolean(w); } return v; };
  const v = or();
  if (i !== t.length) throw new Error(`ci-graph: the expression reader stopped short in ${src}`);
  return Boolean(v);
}

/** One job's display name, its `with:` map and its steps (name and `if:` text), off the workflow text. */
export function jobDetail(text, id) {
  const lines = stripComments(text).split("\n");
  const at = lines.findIndex((l) => l.trimEnd() === `  ${id}:`);
  if (at === -1) throw new Error(`ci-graph: no job ${id}`);
  const body = blockOf(lines, at, 2);
  const name = /^ {4}name:\s*(.+?)\s*$/m.exec(body.join("\n"))?.[1]?.replace(/^"(.*)"$/, "$1") ?? id;
  const withAt = body.findIndex((l) => /^ {4}with:\s*$/.test(l));
  const withMap = {};
  if (withAt !== -1) for (const l of blockOf(body, withAt, 4)) { const m = /^ {6}([\w-]+):\s*(.+?)\s*$/.exec(l); if (m) withMap[m[1]] = m[2]; }
  const steps = [];
  for (const l of body) {
    if (/^ {6}- /.test(l)) steps.push({ name: /^ {6}- name:\s*(.+?)\s*$/.exec(l)?.[1] ?? null, ifText: /^ {6}- if:\s*(.+?)\s*$/.exec(l)?.[1] ?? null });
    else if (steps.length && /^ {8}name:/.test(l)) steps.at(-1).name = l.replace(/^ {8}name:\s*/, "").trim();
    else if (steps.length && /^ {8}if:/.test(l)) steps.at(-1).ifText = l.replace(/^ {8}if:\s*/, "").trim();
  }
  return { name, with: withMap, steps };
}

/**
 * Every job one event raises, each with what it answers: `run`, or `skipped` (its own `if:` read false, or a job it needs
 * did not run and its `if:` names no status function), and the names of the steps a running job would walk. `ctx`
 * carries `github` (`event_name`, `ref`, `event`); a called workflow reads `inputs` off the caller's `with:`. A called job
 * reads under the name GitHub gives its check, `Caller / Callee`; a skipped caller raises its own name and none of the
 * callee's, which is how a required `Caller / Callee` check goes missing.
 */
export function runPlan(rootName, files, ctx, prefix = "", namePrefix = "") {
  const text = files[rootName];
  const state = new Map();
  const out = [];
  for (const j of readJobs(text)) {
    const d = jobDetail(text, j.id);
    const needsOk = j.needs.every((n) => state.get(n) === "run");
    const cond = j.ifText ?? "success()";
    const runs = STATUS_FN.test(cond) ? evalExpr(cond, { ...ctx, needsOk }) : needsOk && evalExpr(cond, { ...ctx, needsOk });
    state.set(j.id, runs ? "run" : "skipped");
    if (j.uses && runs) {
      const called = /^\.\/\.github\/workflows\/(.+)$/.exec(j.uses)[1];
      const inputs = Object.fromEntries(Object.entries(d.with).map(([k, v]) => [k, /^\$\{\{/.test(v) ? evalExpr(v, ctx) : v]));
      out.push(...runPlan(called, files, { github: ctx.github, inputs }, `${prefix}${j.id}/`, `${namePrefix}${d.name} / `));
      continue;
    }
    const steps = runs ? d.steps.filter((s) => s.ifText === null || STATUS_FN.test(s.ifText) || evalExpr(s.ifText, { ...ctx, needsOk: true })).map((s) => s.name) : [];
    out.push({ key: `${prefix}${j.id}`, name: `${namePrefix}${d.name}`, state: runs ? "run" : "skipped", steps });
  }
  return out;
}

/** The `github` context of one event for `runPlan`: a `push` to a branch, a `pull_request` (a fork's or not), `merge_group`, `workflow_dispatch`. */
export function eventContext(event_name, { branch = "develop", fork = false } = {}) {
  const ref = event_name === "merge_group" ? "refs/heads/gh-readonly-queue/develop/pr-1-0000000000000000000000000000000000000000"
    : event_name === "pull_request" ? "refs/pull/1/merge" : `refs/heads/${branch}`;
  const event = event_name === "pull_request" ? { pull_request: { head: { repo: { fork } } } } : {};
  return { github: { event_name, ref, event } };
}

if (process.argv[1] && basename(process.argv[1]) === "ci-graph.mjs") {
  const files = liveFiles();
  const n = graphNumbers("ci.yml", files);
  console.log(`ci-graph: concurrent=${n.concurrent} total=${n.total}`);
  for (const j of n.jobs) console.log(`  ${j}`);
  console.log(`ci-graph: runs per lane push with an open PR: ci=${runsPerLanePush(files["ci.yml"])} held-out=${runsPerLanePush(files["held-out.yml"])}`);
}
