#!/usr/bin/env node
// held-out-steps — run one held-out driver's job the way a hosted runner runs it, read off the workflow itself.
//
// The held-out workflow stands each driver on a fresh runner. A local proof that retypes those steps by hand
// proves the retyping, so this reader takes the steps from `.github/workflows/held-out.yml` and runs them in
// order with the runner's own semantics:
//   - a step's `if:` decides, with an implicit `success()` unless it names a status function;
//   - a `run:` step runs under the runner's shell line (`bash -e`, or `bash --noprofile --norc -eo pipefail`
//     for `shell: bash`), and the lines it appends to `$GITHUB_ENV` reach every later step;
//   - the job's `timeout-minutes` cancels the job, and only `always()` steps run after that;
//   - a `uses:` step maps onto the local fact it guarantees: the checkout holds its submodules at their recorded
//     commits, pnpm and node stand at the declared majors, and the evidence directory is non-empty, then copied.
//
// THE READER KNOWS ONLY THE SHAPES THIS WORKFLOW WRITES. An unknown key, expression or action throws rather than
// skipping: a step this reader cannot run must never read as a step that passed.
//
//   node tools/held-out-steps.mjs <driver>             run the job; exit 0 only when every step that ran passed
//   node tools/held-out-steps.mjs <driver> --plan      print the steps a green job runs, and run nothing
//   node tools/held-out-steps.mjs --drivers            print the matrix's drivers
// Env:  HELD_OUT_WORKFLOW (the workflow file), HELD_OUT_EVIDENCE (where uploads land; default under RUNNER_TEMP).
//       RUNNER_TEMP must name a scratch directory; the caller owns HOME, XDG and docker isolation.
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STEP_KEYS = new Set(["name", "if", "run", "uses", "shell", "with"]);

const unquote = (v) => {
  const t = v.trim();
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t;
};
// A matrix value keeps its YAML type: a bare `true` reads boolean, and the runner compares a boolean against a
// string by number, so `matrix.x == 'true'` over a bare `true` reads FALSE there and must read false here.
const scalar = (v) => {
  const t = v.trim();
  if (t === "true" || t === "false") return t === "true";
  return unquote(t);
};

/** The held-out job's env, matrix and steps, read from the workflow text. Throws on any shape it cannot read. */
export function parseWorkflow(text) {
  const lines = text.split("\n");
  const env = {};
  const matrix = [];
  const steps = [];
  let timeout = null;
  let i = 0;
  const indentOf = (l) => l.length - l.trimStart().length;
  const skippable = (l) => l.trim() === "" || l.trim().startsWith("#");

  // Job-level scalars and blocks sit at indent 4 under the one job.
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^    timeout-minutes:/.test(l)) timeout = unquote(l.split(":").slice(1).join(":"));
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
  if (!matrix.length) throw new Error("held-out-steps: the workflow names no matrix drivers");

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
    } else {
      step[key] = unquote(raw);
    }
  }
  for (const s of steps) {
    if (!!s.run === !!s.uses) throw new Error(`held-out-steps: step "${s.name ?? s.uses}" must carry exactly one of run/uses`);
  }
  return { env, matrix, steps, timeout };
}

/** Expand `${{ … }}` against the job context. An expression this reader cannot resolve throws. */
export function expand(text, ctx) {
  return text.replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const m = /^(matrix|env|github)\.([A-Za-z0-9_]+)$/.exec(expr);
    if (!m || ctx[m[1]]?.[m[2]] === undefined) throw new Error(`held-out-steps: expression "${expr}" has no local value`);
    return String(ctx[m[1]][m[2]]);
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

/** The job context for one driver. */
export function jobContext(wf, driver, base = {}) {
  const row = wf.matrix.find((m) => m.driver === driver);
  if (!row) throw new Error(`held-out-steps: no matrix driver "${driver}" (${wf.matrix.map((m) => m.driver).join(", ")})`);
  const ctx = { matrix: row, github: { run_id: base.runId ?? "local", run_attempt: base.runAttempt ?? "1" }, env: {} };
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

/** The local fact each action guarantees on a hosted runner. */
function runAction(step, ctx, { cwd, env, evidence }) {
  const [action] = step.uses.split("@");
  const w = Object.fromEntries(Object.entries(step.with ?? {}).map(([k, v]) => [k, expand(v, { ...ctx, env: { ...ctx.env, ...env } })]));
  const major = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
    return r.status === 0 ? String(r.stdout).trim().replace(/^v/, "").split(".")[0] : null;
  };
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
    case "pnpm/action-setup":
      return major("pnpm", ["--version"]) === String(w.version) ? null : `pnpm ${w.version} does not stand (found ${major("pnpm", ["--version"])})`;
    case "actions/setup-node":
      return major("node", ["--version"]) === String(w["node-version"]) ? null : `node ${w["node-version"]} does not stand (found ${major("node", ["--version"])})`;
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

/** Run one driver's job. Resolves to { verdict, failed } — verdict GREEN | RED | CANCELLED. */
export async function runJob(wf, driver, { cwd = ROOT, env = process.env, log = console.log } = {}) {
  const runnerTemp = env.RUNNER_TEMP;
  if (!runnerTemp) throw new Error("held-out-steps: RUNNER_TEMP must name a scratch directory");
  const ctx = jobContext(wf, driver);
  const minutes = Number(expand(wf.timeout ?? "360", ctx));
  const deadline = Date.now() + minutes * 60_000;
  const evidence = env.HELD_OUT_EVIDENCE ?? join(runnerTemp, "uploaded");
  const stepDir = mkdtempSync(join(runnerTemp, "steps-"));
  let jobEnv = { ...env, ...ctx.env, RUNNER_TEMP: runnerTemp, GITHUB_ACTIONS: "true", CI: "true" };
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
      writeFileSync(file, expand(step.run, { ...ctx, env: { ...ctx.env, ...jobEnv } }));
      writeFileSync(envFile, "");
      // After a cancel, an always() step runs on its own bounded clock, as the runner grants it.
      const stepDeadline = state === "cancelled" ? Date.now() + 10 * 60_000 : deadline;
      const r = await runShell(step.shell, file, { cwd, env: { ...jobEnv, GITHUB_ENV: envFile }, deadline: stepDeadline });
      jobEnv = { ...jobEnv, ...readEnvFile(readFileSync(envFile, "utf8")) };
      if (r.timedOut && state === "success") { state = "cancelled"; failed ??= label; log(`[held-out] ✗ ${label} — the job timeout (${minutes}m) cancelled it`); continue; }
      if (r.code !== 0) fault = `exit ${r.code}`;
    }
    if (fault) {
      log(`[held-out] ✗ ${label} — ${fault}`);
      if (state === "success") state = "failure";
      failed ??= label;
    } else log(`[held-out] ✓ ${label}`);
  }
  const verdict = state === "success" ? "GREEN" : state === "failure" ? "RED" : "CANCELLED";
  log(`[held-out] ${driver}: ${verdict}${failed ? ` (first failure: ${failed})` : ""}`);
  return { verdict, failed };
}

/** The step labels a GREEN job runs for one driver, in order — the plan, with nothing run. */
export function planFor(wf, driver) {
  const ctx = jobContext(wf, driver, {});
  ctx.env = { ...ctx.env, ARTIFACT_DIR: "$ARTIFACT_DIR" };
  return wf.steps
    .filter((s) => shouldRun(s.if, ctx, "success"))
    .map((s) => ({ name: expand(s.name ?? s.uses, ctx), uses: s.uses, run: s.run && expand(s.run, ctx) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wf = parseWorkflow(readFileSync(process.env.HELD_OUT_WORKFLOW ?? join(ROOT, ".github/workflows/held-out.yml"), "utf8"));
  const [driver, flag] = process.argv.slice(2);
  if (driver === "--drivers") {
    console.log(wf.matrix.map((m) => m.driver).join("\n"));
  } else if (!driver) {
    console.error("usage: held-out-steps.mjs <driver> [--plan] | --drivers");
    process.exit(2);
  } else if (flag === "--plan") {
    for (const s of planFor(wf, driver)) console.log(`── ${s.name}\n${s.run ?? `(uses ${s.uses})`}`);
  } else {
    const { verdict } = await runJob(wf, driver, { env: { ...process.env, RUNNER_TEMP: process.env.RUNNER_TEMP ?? mkdtempSync(join(tmpdir(), "held-out-")) } });
    process.exit(verdict === "GREEN" ? 0 : 1);
  }
}
