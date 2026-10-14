#!/usr/bin/env node
// held-out-steps — run one held-out job the way a hosted runner runs it, read off the workflow itself.
//
// The held-out workflow stands each cell on a fresh runner. A local proof that retypes those steps by hand
// proves the retyping, so this reader takes the steps from `.github/workflows/held-out.yml` and runs them in
// order with the runner's own semantics:
//   - a step's `if:` decides, with an implicit `success()` unless it names a status function;
//   - a `run:` step runs under the runner's shell line (`bash -e`, or `bash --noprofile --norc -eo pipefail`
//     for `shell: bash`), and the lines it appends to `$GITHUB_ENV` reach every later step;
//   - the job's `timeout-minutes` cancels the job, and only `always()` steps run after that;
//   - a `uses:` step maps onto the local fact it guarantees: the checkout holds its submodules at their recorded
//     commits, pnpm and node stand at the declared majors, an upload copies a non-empty directory into the
//     evidence root, and a download copies it back out (so the image job's upload feeds a cell's download);
//   - a matrix the workflow reads from its `plan` job arrives from the same tool that job runs
//     (`tools/held-out-cells.mjs`), and only while the plan job still runs that tool;
//   - the `github` context (sha, ref, ref_name, repository, workspace, event_name, actor, run_id, run_attempt)
//     reads the runner's own `GITHUB_*` variables first, then the checkout the job runs in, and every `run:` step
//     reads it as `GITHUB_*`, as the runner exports it.
//
// THE READER KNOWS ONLY THE SHAPES THIS WORKFLOW WRITES. An unknown key (a step's, the job's or the workflow's),
// expression or action throws rather than skipping: a step this reader cannot run must never read as a step that
// passed, and a job-level `defaults:`, `services:` or `container:` would change how every step runs.
//
//   node tools/held-out-steps.mjs <cell>               run that cell's job; exit 0 only when every step that ran passed
//   node tools/held-out-steps.mjs <cell> --plan        print the steps a green job runs, and run nothing
//   node tools/held-out-steps.mjs --job <name>         run a job that holds no matrix (`plan`, `image`, `merge`)
//   node tools/held-out-steps.mjs --cells              print the matrix's cells
// Env:  HELD_OUT_WORKFLOW (the workflow file), HELD_OUT_EVIDENCE (where uploads land; default under RUNNER_TEMP).
//       RUNNER_TEMP must name a scratch directory; the caller owns HOME, XDG and docker isolation.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cellMatrix } from "./held-out-cells.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STEP_KEYS = new Set(["name", "id", "if", "run", "uses", "shell", "with", "continue-on-error"]);
// The workflow-level and job-level keys this reader reads or that change nothing it runs. Any other key, such as a
// job's `defaults:` (a different shell line), `services:` (sidecar containers) or `container:` (a different
// image), changes how the runner runs every step, so it throws rather than reading as absent.
const WORKFLOW_KEYS = new Set(["name", "on", "concurrency", "permissions", "env", "jobs"]);
const JOB_KEYS = new Set(["name", "needs", "if", "runs-on", "timeout-minutes", "outputs", "strategy", "env", "steps"]);
// The one dynamic matrix this reader knows: the plan job's output, which `tools/held-out-cells.mjs matrix` prints.
const PLAN_MATRIX = /^\s*matrix:\s*\$\{\{\s*fromJSON\(needs\.plan\.outputs\.matrix\)\s*\}\}\s*$/;
const PLAN_TOOL = 'node tools/held-out-cells.mjs matrix >> "$GITHUB_OUTPUT"';
const PLAN_OUTPUT = /^      matrix:\s*\$\{\{\s*steps\.([a-z0-9_-]+)\.outputs\.matrix\s*\}\}\s*$/;

// A ` #` after a plain scalar, or after a quoted one's closing quote, opens a YAML comment: an action pinned
// by SHA carries its release tag there (`uses: actions/checkout@<sha> # v7.0.1`), and the runner never reads it.
const unquote = (v) => {
  const t = v.trim();
  const quoted = /^(["'])(.*)\1(?:\s+#.*)?$/.exec(t);
  return quoted ? quoted[2] : t.replace(/\s+#.*$/, "");
};
// A matrix value keeps its YAML type: a bare `true` reads boolean, and the runner compares a boolean against a
// string by number, so `matrix.x == 'true'` over a bare `true` reads FALSE there and must read false here.
const scalar = (v) => {
  const t = v.trim();
  if (t === "true" || t === "false") return t === "true";
  return unquote(t);
};

/**
 * One job's env, matrix and steps, read from the workflow text. Throws on any shape it cannot read.
 *
 * @param job     the job to read (default: the cell job, `held-out`)
 * @param cells   the matrix a plan-fed job runs; default: what `tools/held-out-cells.mjs` derives
 * @returns `matrix: null` for a job that declares no strategy
 */
export function parseWorkflow(text, { job = "held-out", cells = cellMatrix } = {}) {
  const all = text.split("\n");
  const env = {};
  let matrix = null;
  const steps = [];
  let timeout = null;
  const indentOf = (l) => l.length - l.trimStart().length;
  const skippable = (l) => l.trim() === "" || l.trim().startsWith("#");

  // Every key at indent 0 (the workflow) and 4 (a job's own keys) must be one this reader reads, in EVERY job:
  // the job it runs leans on what the others hand it.
  let inJobs = false;
  const keyAt = (l, n) => {
    if (skippable(l)) return;
    const m = new RegExp(`^${" ".repeat(n)}([A-Za-z0-9_-]+):`).exec(l);
    if (!m || indentOf(l) !== n) return;
    if (n === 0) {
      inJobs = m[1] === "jobs";
      if (!WORKFLOW_KEYS.has(m[1])) throw new Error(`held-out-steps: workflow key "${m[1]}" has no local reading`);
    } else if (n === 4 && inJobs && !JOB_KEYS.has(m[1])) {
      throw new Error(`held-out-steps: job key "${m[1]}" has no local reading`);
    }
  };
  for (const l of all) { keyAt(l, 0); keyAt(l, 4); }

  // The workflow's own env reaches every job; a job's env block overrides it below.
  const top = all.findIndex((l) => /^env:\s*$/.test(l));
  if (top >= 0) {
    for (let k = top + 1; k < all.length && (skippable(all[k]) || indentOf(all[k]) > 0); k++) {
      const m = /^  ([A-Z0-9_]+):\s*(.*)$/.exec(all[k]);
      if (m) env[m[1]] = unquote(m[2]);
    }
  }

  // The job's own block: from its name to the next key at its indent.
  const blockOf = (name) => {
    const start = all.findIndex((l) => l === `  ${name}:`);
    if (start < 0) return null;
    let end = start + 1;
    while (end < all.length && (skippable(all[end]) || indentOf(all[end]) > 2)) end++;
    return all.slice(start + 1, end);
  };
  const lines = blockOf(job);
  if (!lines) throw new Error(`held-out-steps: the workflow names no job "${job}"`);
  let i = 0;

  // Job-level scalars and blocks sit at indent 4 under the job.
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^    timeout-minutes:/.test(l)) timeout = unquote(l.split(":").slice(1).join(":"));
    if (/^    strategy:\s*$/.test(l)) matrix = [];
    if (/^      matrix:\s*\S/.test(l)) {
      // A MATRIX READ FROM ANOTHER JOB. The reader runs the tool that job runs; a plan job that stopped running
      // it would hand the runner a matrix this reader never sees, so that throws.
      if (!PLAN_MATRIX.test(l)) throw new Error(`held-out-steps: matrix "${l.trim()}" has no local reading`);
      // The whole wire, end to end: the tool's line lands in the step's output file, the step carries an id, and
      // the job hands that step's `matrix` on. A wire cut anywhere leaves the runner with no matrix.
      const plan = blockOf("plan") ?? [];
      const handed = plan.map((p) => PLAN_OUTPUT.exec(p)?.[1]).find(Boolean);
      if (!plan.some((p) => p.includes(PLAN_TOOL))) {
        throw new Error(`held-out-steps: the matrix reads the plan job's output, and the plan job never runs \`${PLAN_TOOL}\``);
      }
      if (!handed || !plan.some((p) => p.trim() === `id: ${handed}`)) {
        throw new Error("held-out-steps: the plan job hands on no step's `matrix` output (outputs.matrix must read a step that carries that id)");
      }
      matrix = cells();
    }
    if (/^    env:\s*$/.test(l)) {
      for (i++; i < lines.length && (skippable(lines[i]) || indentOf(lines[i]) > 4); i++) {
        const m = /^      ([A-Z0-9_]+):\s*(.*)$/.exec(lines[i]);
        if (m) env[m[1]] = unquote(m[2]);
      }
      i--;
    }
    if (/^        include:\s*$/.test(l)) {
      for (i++; i < lines.length && (skippable(lines[i]) || indentOf(lines[i]) > 8); i++) {
        const item = /^          - ([a-z_]+):\s*(.*)$/.exec(lines[i]);
        const more = /^            ([a-z_]+):\s*(.*)$/.exec(lines[i]);
        if (item) matrix.push({ [item[1]]: scalar(item[2]) });
        else if (more) matrix[matrix.length - 1][more[1]] = scalar(more[2]);
      }
      i--;
    }
    if (/^    steps:\s*$/.test(l)) { i++; break; }
  }
  if (matrix !== null && !matrix.length) throw new Error(`held-out-steps: the job "${job}" names no matrix cells`);

  let step = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (skippable(l)) continue;
    const ind = indentOf(l);
    if (ind < 6) break;
    const open = /^      - ([a-z-]+):\s*(.*)$/.exec(l);
    const field = /^        ([a-z-]+):\s*(.*)$/.exec(l);
    const m = open ?? field;
    if (!m) throw new Error(`held-out-steps: cannot read workflow line ${i + 1}: ${l.trim()}`);
    if (open) { step = {}; steps.push(step); }
    const [, key, raw] = m;
    if (!STEP_KEYS.has(key)) throw new Error(`held-out-steps: step key "${key}" (line ${i + 1}) has no local reading`);
    if (key === "run" && /^[|>]-?$/.test(raw.trim())) {
      const body = [];
      for (i++; i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > 8); i++) body.push(lines[i]);
      i--;
      while (body.length && body[body.length - 1].trim() === "") body.pop();
      const cut = Math.min(...body.filter((b) => b.trim()).map(indentOf));
      step.run = body.map((b) => b.slice(cut)).join("\n") + "\n";
    } else if (key === "with") {
      step.with = {};
      for (i++; i < lines.length && (skippable(lines[i]) || indentOf(lines[i]) > 8); i++) {
        const w = /^          ([a-z-]+):\s*(.*)$/.exec(lines[i]);
        if (w) step.with[w[1]] = unquote(w[2]);
      }
      i--;
    } else if (key === "continue-on-error") {
      const v = scalar(raw);
      if (typeof v !== "boolean") throw new Error(`held-out-steps: continue-on-error "${raw.trim()}" (line ${i + 1}) has no local reading`);
      step.continueOnError = v;
    } else {
      step[key] = unquote(raw);
    }
  }
  for (const s of steps) {
    if (!!s.run === !!s.uses) throw new Error(`held-out-steps: step "${s.name ?? s.uses}" must carry exactly one of run/uses`);
  }
  return { job, env, matrix, steps, timeout };
}

/**
 * Expand `${{ … }}` against the job context. A property the context lacks reads empty, as on the runner; a
 * context or expression shape this reader cannot resolve throws.
 */
export function expand(text, ctx) {
  return text.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const m = /^(matrix|env|github)\.([A-Za-z0-9_]+)$/.exec(expr);
    if (!m) throw new Error(`held-out-steps: expression "${expr}" has no local value`);
    return String(ctx[m[1]]?.[m[2]] ?? "");
  });
}

/** Whether a step runs, given the job's state ("success" | "failure" | "cancelled"). Unknown atoms throw. */
export function shouldRun(cond, ctx, state) {
  if (cond === undefined) return state === "success";
  const statusFns = { "always()": true, "success()": state === "success", "failure()": state === "failure", "cancelled()": state === "cancelled" };
  const atom = (a) => {
    const t = a.trim();
    if (t in statusFns) return statusFns[t];
    const cmp = /^(matrix|env)\.([A-Za-z0-9_]+)\s*(==|!=)\s*'([^']*)'$/.exec(t);
    if (!cmp) throw new Error(`held-out-steps: condition "${t}" has no local reading`);
    const raw = ctx[cmp[1]]?.[cmp[2]] ?? "";
    // Strings compare case-insensitively; a boolean meets a string by number, which a word never equals.
    const same = typeof raw === "boolean" ? Number(raw) === Number(cmp[4]) : String(raw).toLowerCase() === cmp[4].toLowerCase();
    return cmp[3] === "==" ? same : !same;
  };
  const value = cond.split("||").some((part) => part.split("&&").every(atom));
  const namesStatus = /\b(always|success|failure|cancelled)\(\)/.test(cond);
  // A condition without a status function carries the runner's implicit `success() &&`.
  return namesStatus ? value : state === "success" && value;
}

/**
 * The `github` context a hosted runner fills for this job. The runner names it in its env (`GITHUB_REF`,
 * `GITHUB_REF_NAME`, `GITHUB_SHA`, `GITHUB_ACTOR`, …), and every variable it names wins; the checkout fills only
 * what the env leaves unnamed. A pull request's checkout stands detached on its merge ref, which the env names,
 * so a detached checkout reads its ref from there, and throws only when nothing names one.
 */
export function githubContext(cwd, env = process.env) {
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    return r.status === 0 ? String(r.stdout).trim() : "";
  };
  const sha = env.GITHUB_SHA || git("rev-parse", "--verify", "HEAD");
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`held-out-steps: the job directory ${cwd} holds no git checkout to read github.sha from`);
  const ref = env.GITHUB_REF || git("symbolic-ref", "-q", "HEAD");
  if (!ref) throw new Error("held-out-steps: the checkout stands detached and nothing names its ref — check out a branch or set GITHUB_REF");
  let repository = env.GITHUB_REPOSITORY || "";
  if (!repository) {
    const m = /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/.exec(git("remote", "get-url", "origin"));
    if (!m) throw new Error("held-out-steps: the checkout's origin names no GitHub repository — set GITHUB_REPOSITORY");
    repository = m[1];
  }
  // The runner names the GitHub login that started the run. A local checkout holds no login, so the committer's
  // own name stands for it there.
  const actor = env.GITHUB_ACTOR || git("config", "user.name");
  if (!actor) throw new Error("held-out-steps: nothing names an actor (GITHUB_ACTOR, or git config user.name) — set GITHUB_ACTOR");
  return {
    sha,
    ref,
    ref_name: env.GITHUB_REF_NAME || ref.replace(/^refs\/(heads|tags|pull)\//, ""),
    repository,
    workspace: resolve(cwd),
    event_name: env.GITHUB_EVENT_NAME || "workflow_dispatch",
    actor,
    run_id: env.GITHUB_RUN_ID || "local",
    run_attempt: env.GITHUB_RUN_ATTEMPT || "1",
  };
}

/** The variables the runner exports for its `github` context, so a `run:` step reads them as it does there. */
export function githubEnv(github) {
  return Object.fromEntries(Object.entries(github).map(([k, v]) => [`GITHUB_${k.toUpperCase()}`, v]));
}

/** A matrix row's own name: the cell the plan names, or the driver of a matrix written in the workflow. */
export const cellOf = (row) => row.cell ?? row.driver;

/**
 * The job context for one cell, its `github` context read off `env`, then the checkout at `cwd`. A job that
 * holds no matrix takes no cell and reads an empty `matrix` context.
 */
export function jobContext(wf, cell, { cwd = ROOT, env = process.env } = {}) {
  let row = {};
  if (wf.matrix === null) {
    if (cell != null) throw new Error(`held-out-steps: the job "${wf.job}" holds no matrix, so it takes no cell ("${cell}")`);
  } else {
    row = wf.matrix.find((m) => cellOf(m) === cell);
    if (!row) throw new Error(`held-out-steps: no matrix cell "${cell}" (${wf.matrix.map(cellOf).join(", ")})`);
  }
  const ctx = { matrix: row, github: githubContext(cwd, env), env: {} };
  for (const [k, v] of Object.entries(wf.env)) ctx.env[k] = expand(v, ctx);
  return ctx;
}

const SHELLS = {
  default: ["bash", ["-e"]],
  bash: ["bash", ["--noprofile", "--norc", "-eo", "pipefail"]],
};

/** Run one shell file in its own process group; the deadline signals the whole group. */
function runShell(shell, file, { cwd, env, deadline }) {
  const [bin, flags] = SHELLS[shell ?? "default"] ?? (() => { throw new Error(`held-out-steps: shell "${shell}" has no local reading`); })();
  return new Promise((done) => {
    const child = spawn(bin, [...flags, file], { cwd, env, stdio: "inherit", detached: true });
    let timedOut = false;
    const left = deadline - Date.now();
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* gone */ }
      setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } }, 10_000).unref();
    }, Math.max(left, 0));
    child.on("exit", (code, signal) => { clearTimeout(timer); done({ code: code ?? (signal ? 128 : 1), timedOut }); });
  });
}

/** A tool's version stands at the grain the workflow declares it: `"24"` names a major, so any 24.x
 *  stands; `"11.28.5"` names one exact release, so only that release stands. */
export function versionStands(declared, found) {
  if (found == null) return false;
  const want = String(declared).replace(/^v/, "");
  const got = String(found).trim().replace(/^v/, "");
  return want.includes(".") ? got === want : got.split(".")[0] === want;
}

/** The local fact each action guarantees on a hosted runner. */
function runAction(step, ctx, { cwd, env, evidence }) {
  const [action] = step.uses.split("@");
  const w = Object.fromEntries(Object.entries(step.with ?? {}).map(([k, v]) => [k, expand(v, { ...ctx, env: { ...ctx.env, ...env } })]));
  const version = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
    return r.status === 0 ? String(r.stdout).trim().replace(/^v/, "") : null;
  };
  const major = (cmd, args) => version(cmd, args)?.split(".")[0] ?? null;
  switch (action) {
    case "actions/checkout": {
      const head = spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd, encoding: "utf8" });
      if (head.status !== 0) return "the job directory holds no git checkout";
      if (w.submodules) {
        const sub = spawnSync("git", ["submodule", "status", ...(w.submodules === "recursive" ? ["--recursive"] : [])], { cwd, encoding: "utf8" });
        const off = String(sub.stdout).split("\n").filter((l) => /^[-+U]/.test(l));
        if (sub.status !== 0 || off.length) return `submodules stand off their recorded commits:\n${off.join("\n")}`;
      }
      return null;
    }
    case "pnpm/action-setup": {
      // The action INSTALLS the declared version. Locally corepack provisions it under the job's own HOME.
      if (!versionStands(w.version, version("pnpm", ["--version"]))) spawnSync("corepack", ["install", "-g", `pnpm@${w.version}`], { cwd, env, stdio: "inherit" });
      return versionStands(w.version, version("pnpm", ["--version"])) ? null : `pnpm ${w.version} does not stand (found ${version("pnpm", ["--version"])})`;
    }
    case "actions/setup-node":
      return major("node", ["--version"]) === String(w["node-version"]) ? null : `node ${w["node-version"]} does not stand (found ${major("node", ["--version"])})`;
    case "actions/download-artifact": {
      // The runner fetches what an earlier job uploaded. Locally an upload lands under the evidence root, so a
      // download copies it back out: one named artifact into `path`, or every artifact a pattern names into
      // `path/<artifact name>`.
      const names = existsSync(evidence) ? readdirSync(evidence) : [];
      if (w.name) {
        if (!names.includes(w.name)) return `no artifact named ${w.name} under ${evidence} — run the job that uploads it first`;
        mkdirSync(w.path, { recursive: true });
        cpSync(join(evidence, w.name), w.path, { recursive: true });
        return null;
      }
      if (!w.pattern) return "a download names neither an artifact nor a pattern";
      const shape = new RegExp(`^${w.pattern.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
      const hits = names.filter((n) => shape.test(n));
      if (hits.length === 0) return `no artifact matches ${w.pattern} under ${evidence}`;
      for (const n of hits) { mkdirSync(join(w.path, n), { recursive: true }); cpSync(join(evidence, n), join(w.path, n), { recursive: true }); }
      return null;
    }
    case "actions/upload-artifact": {
      const path = w.path;
      const files = existsSync(path) ? readdirSync(path, { recursive: true }) : [];
      if (files.length === 0 && (w["if-no-files-found"] ?? "warn") === "error") return `no evidence under ${path}`;
      const out = join(evidence, w.name);
      mkdirSync(out, { recursive: true });
      if (files.length) cpSync(path, out, { recursive: true });
      console.log(`[held-out] evidence ${w.name} → ${out}`);
      return null;
    }
    default:
      throw new Error(`held-out-steps: action "${step.uses}" has no local reading`);
  }
}

/** Read a `$GITHUB_ENV` file: `KEY=value` lines and `KEY<<DELIM` blocks. */
export function readEnvFile(text) {
  const out = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const heredoc = /^([A-Za-z_][A-Za-z0-9_]*)<<(.+)$/.exec(lines[i]);
    const plain = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(lines[i]);
    if (heredoc) {
      const body = [];
      for (i++; i < lines.length && lines[i] !== heredoc[2]; i++) body.push(lines[i]);
      out[heredoc[1]] = body.join("\n");
    } else if (plain) out[plain[1]] = plain[2];
    else if (lines[i].trim()) throw new Error(`held-out-steps: $GITHUB_ENV line has no reading: ${lines[i]}`);
  }
  return out;
}

/** Run one job, for one cell where it holds a matrix. Resolves to { verdict, failed } — verdict GREEN | RED | CANCELLED. */
export async function runJob(wf, driver, { cwd = ROOT, env = process.env, log = console.log } = {}) {
  const runnerTemp = env.RUNNER_TEMP;
  if (!runnerTemp) throw new Error("held-out-steps: RUNNER_TEMP must name a scratch directory");
  const ctx = jobContext(wf, driver, { cwd, env });
  const minutes = Number(expand(wf.timeout ?? "360", ctx));
  const deadline = Date.now() + minutes * 60_000;
  const evidence = env.HELD_OUT_EVIDENCE ?? join(runnerTemp, "uploaded");
  const stepDir = mkdtempSync(join(runnerTemp, "steps-"));
  let jobEnv = { ...env, ...githubEnv(ctx.github), ...ctx.env, RUNNER_TEMP: runnerTemp, GITHUB_ACTIONS: "true", CI: "true" };
  let state = "success";
  let failed = null;
  for (const [n, step] of wf.steps.entries()) {
    const label = expand(step.name ?? step.uses, { ...ctx, env: { ...ctx.env, ...jobEnv } });
    if (state === "success" && Date.now() >= deadline) { state = "cancelled"; failed ??= "the job timeout"; }
    if (!shouldRun(step.if, { ...ctx, env: { ...ctx.env, ...jobEnv } }, state)) { log(`[held-out] skip  ${label}`); continue; }
    log(`[held-out] ▶ ${label}`);
    let fault = null;
    if (step.uses) {
      fault = runAction(step, ctx, { cwd, env: jobEnv, evidence });
    } else {
      const file = join(stepDir, `step-${n}.sh`);
      const envFile = join(stepDir, `env-${n}`);
      const outFile = join(stepDir, `output-${n}`);
      writeFileSync(file, expand(step.run, { ...ctx, env: { ...ctx.env, ...jobEnv } }));
      writeFileSync(envFile, "");
      writeFileSync(outFile, "");
      // After a cancel, an always() step runs on its own bounded clock, as the runner grants it.
      const stepDeadline = state === "cancelled" ? Date.now() + 10 * 60_000 : deadline;
      const r = await runShell(step.shell, file, { cwd, env: { ...jobEnv, GITHUB_ENV: envFile, GITHUB_OUTPUT: outFile }, deadline: stepDeadline });
      jobEnv = { ...jobEnv, ...readEnvFile(readFileSync(envFile, "utf8")) };
      if (r.timedOut && state === "success") { state = "cancelled"; failed ??= label; log(`[held-out] ✗ ${label} — the job timeout (${minutes}m) cancelled it`); continue; }
      if (r.code !== 0) fault = `exit ${r.code}`;
    }
    if (fault && step.continueOnError) {
      // The runner records the fault and lets the job go on as if the step had passed.
      log(`[held-out] ✗ ${label} — ${fault} (continue-on-error: the job goes on)`);
    } else if (fault) {
      log(`[held-out] ✗ ${label} — ${fault}`);
      if (state === "success") state = "failure";
      failed ??= label;
    } else log(`[held-out] ✓ ${label}`);
  }
  const verdict = state === "success" ? "GREEN" : state === "failure" ? "RED" : "CANCELLED";
  log(`[held-out] ${driver ?? wf.job}: ${verdict}${failed ? ` (first failure: ${failed})` : ""}`);
  return { verdict, failed };
}

/** The step labels a GREEN job runs for one driver, in order — the plan, with nothing run. */
export function planFor(wf, driver, { cwd = ROOT, env = process.env } = {}) {
  const ctx = jobContext(wf, driver, { cwd, env });
  ctx.env = { ...ctx.env, ARTIFACT_DIR: "$ARTIFACT_DIR" };
  return wf.steps
    .filter((s) => shouldRun(s.if, ctx, "success"))
    .map((s) => ({ name: expand(s.name ?? s.uses, ctx), uses: s.uses, run: s.run && expand(s.run, ctx) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = readFileSync(process.env.HELD_OUT_WORKFLOW ?? join(ROOT, ".github/workflows/held-out.yml"), "utf8");
  const [first, second] = process.argv.slice(2);
  const runAndExit = async (wf, cell) => {
    const { verdict } = await runJob(wf, cell, { env: { ...process.env, RUNNER_TEMP: process.env.RUNNER_TEMP ?? mkdtempSync(join(tmpdir(), "held-out-")) } });
    process.exit(verdict === "GREEN" ? 0 : 1);
  };
  if (first === "--cells") {
    console.log(parseWorkflow(text).matrix.map(cellOf).join("\n"));
  } else if (first === "--job" && second) {
    await runAndExit(parseWorkflow(text, { job: second }), undefined);
  } else if (!first || first.startsWith("--")) {
    console.error("usage: held-out-steps.mjs <cell> [--plan] | --job <name> | --cells");
    process.exit(2);
  } else if (second === "--plan") {
    for (const p of planFor(parseWorkflow(text), first)) console.log(`── ${p.name}\n${p.run ?? `(uses ${p.uses})`}`);
  } else {
    await runAndExit(parseWorkflow(text), first);
  }
}
