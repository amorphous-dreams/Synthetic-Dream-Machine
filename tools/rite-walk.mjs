#!/usr/bin/env node
// rite-walk — one script walks the founding runbook's three-face rite on a scratch hearth and writes a receipt.
//
// It stands the hearth through the e2e harness (`tests/harness/instance.ts`: the staged daemon from the checkout's
// built dist) and answers every passphrase ward through the staged test custody (`tools/unlock-test-custody.mjs`,
// `tools/test-ward-route.mjs`), which act only on a root carrying `.lar-test-scratch`. Each step binds to its runbook
// line (`tools/rite-walk/steps.mjs`) and reads pass, fail or unreached with the quoted answer.
//
// WHAT IT NEVER TOUCHES: a root outside a scratch prefix, the checkout's tracked tree, a real home, the host shim,
// Docker (the image leg alone reaches the shim and Docker, inside the scope its own line names). It drops LAR_BAGS and LAR_GENESIS from its own environment, mints its root under the stage dir, copies the
// checkout's `bags/` into the root's own canon source (so the steward's lay lays house canon) and runs under a scratch HOME.
//
// THE RECEIPT (`<out>/rite-report.json`, human lines beside it in `rite-report.txt`): the git head, the runbook
// carrier's hash and seal, the walker's own hash, a row per step, and a digest over the outcomes a replay compares.
//
// Usage: node tools/rite-walk.mjs --out <dir> [--root <scratch root>] [--to <step>] [--from <step>] [--keep] [--bind]
//   --bind   read the join alone (each step and its runbook line); no root, no act
//   --to     stop after the named step; --keep leaves the root standing for the next leg
//   --from   start at the named step, on the root a kept leg left (`--root`); the receipt carries both legs' rows
//   --runbook <file>   read the rite from another carrier (a fixture)
//   --image-leg        walk the image leg instead (the built image, the pūlama, the aho, the kūkulu, on a real container
//                      under a named Docker scope); its own flags and law rest in `tools/rite-walk/image-leg.mjs`
//   rc 0  no step failed · rc 1  a step failed · rc 2  the walk refused before any act
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RUNBOOK, RiteWalkRefusal, STEPS, assertBound, assertScratchRoot, bindSteps, receipt, receiptFaults, sha256, verdict, walk } from "./rite-walk/steps.mjs";

const CHECKOUT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const STATE = "walk-state.json";

export function parseArgs(argv) {
  const opts = { keep: false, bind: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep" || a === "--bind") opts[a.slice(2)] = true;
    else if (["--out", "--root", "--from", "--to", "--runbook"].includes(a)) {
      if (argv[i + 1] === undefined) throw new RiteWalkRefusal(`${a} names nothing`);
      opts[a.slice(2)] = argv[++i];
    } else throw new RiteWalkRefusal(`unknown argument ${a}`);
  }
  return opts;
}

/** The carrier's identity: its path, the hash of its bytes, and the seal its own tail carries. */
export function carrierIdentity(path, text) {
  return { path, sha256: sha256(text), bcc: /bcc=`(ni:\/\/\/[^`]+)`/.exec(text)?.[1] ?? null };
}

const git = (...args) => execFileSync("git", ["-C", CHECKOUT, ...args], { encoding: "utf8" }).trim();

/** Speak MCP over one spawned seat's stdio: initialize, then each call in turn. */
async function speak(entry, env, calls) {
  const child = spawn(entry.command, entry.args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (b) => { stderr += String(b); });
  const pending = new Map();
  createInterface({ input: child.stdout }).on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (typeof msg.id === "number" && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const exited = new Promise((settle) => child.on("exit", (code) => settle(code)));
  let next = 1;
  const request = (method, params) => {
    const id = next++;
    const answer = new Promise((settle) => pending.set(id, settle));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return Promise.race([answer, exited.then(() => null)]);
  };
  const results = [];
  const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "rite-walk", version: "0" } });
  if (init !== null) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    for (const c of calls) {
      const r = await request("tools/call", c);
      if (r === null) break;
      const result = r.error ?? r.result ?? null;
      results.push(result?.structuredContent?.result ?? result?.structuredContent ?? result);
    }
  }
  child.stdin.end();
  // LIVENESS: the seat's exit ends the exchange; the bound only kills a seat that never exits.
  await Promise.race([exited, new Promise((settle) => setTimeout(() => { child.kill("SIGKILL"); settle(null); }, 15_000))]);
  return { results, stderr };
}

/** The hands a step runs with, over one scratch root. */
async function hands(root, state, boxHome) {
  const { register } = await import("tsx/esm/api");
  register();
  const harness = await import(pathToFileURL(join(CHECKOUT, "tests/harness/instance.ts")).href);
  const { unlockTestCustody } = await import("./unlock-test-custody.mjs");
  const work = join(root, "rite-work");
  mkdirSync(work, { recursive: true });
  let vessel = null;
  const env = () => ({ LAR_ROOT: root, LAR_PORT: String(state.port ?? 0) });
  const ctx = {
    root,
    vars: state.vars,
    cli: (args) => (vessel ? vessel.cli(args) : harness.cliFor(env())(args)),
    path: (name) => join(work, name),
    file: (name, text) => { writeFileSync(join(work, name), text); return join(work, name); },
    carry: () => join(root, "config", "carry-2"),
    wear: (face) => unlockTestCustody(root, "unlock", face),
    async up() {
      vessel = await harness.openStaged({ root, tag: "rite-walk", found: async () => {} });
      state.port = vessel.port; state.up = true;
      const custody = await unlockTestCustody(root, "status");
      return `phase → live on port ${vessel.port}; the staged custody unlocked: ${JSON.stringify(custody)}`;
    },
    async down() {
      if (!vessel) return "no vessel stood";
      const census = await vessel.cli(["vessel", "census", "--no-json"]);
      await vessel.stopDaemonOnly();
      vessel = null; state.up = false;
      return `census exit ${census.code}: ${`${census.stdout}\n${census.stderr}`.trim().split("\n").at(-1) ?? ""}; the daemon exited`;
    },
    async seat(calls) {
      const python = process.env.LARES_PYTHON ?? join(boxHome, ".venv", "bin", "python3");
      const prior = { root: process.env.LAR_ROOT, python: process.env.LARES_PYTHON };
      process.env.LAR_ROOT = root; process.env.LARES_PYTHON = python;
      let entry;
      try {
        const node = await import(pathToFileURL(join(CHECKOUT, "packages/lararium-node/dist/src/index.js")).href);
        mkdirSync(node.memorySensoriumDir(), { recursive: true });
        const { resolveLaresSurface } = await import(pathToFileURL(join(CHECKOUT, "packages/lares-cli/dist/src/mcp-resolve.js")).href);
        entry = resolveLaresSurface(CHECKOUT);
      } finally {
        if (prior.root === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior.root;
        if (prior.python === undefined) delete process.env.LARES_PYTHON; else process.env.LARES_PYTHON = prior.python;
      }
      if (!entry) return { unreached: "seat-interpreter" };
      const seatEnv = { ...process.env, ...entry.env };
      const said = await speak(entry, seatEnv, calls);
      if (said.results.length < calls.length) throw new Error(`the seat answered ${said.results.length} of ${calls.length} calls: ${said.stderr.trim().split("\n").at(-1) ?? ""}`);
      return said;
    },
    /** The host shim's reset clears the hearth alone; on a scratch root the walk does the same by hand. */
    async reset() {
      const hearth = join(root, "hearth");
      for (const entry of existsSync(hearth) ? readdirSync(hearth) : []) rmSync(join(hearth, entry), { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      return `the walk cleared ${hearth} alone on the scratch root, as the shim's reset does`;
    },
    async close() { if (vessel) { await vessel.stopDaemonOnly(); vessel = null; } },
  };
  return ctx;
}

/** Walk the rite. Answers `{ code, report }`; throws RiteWalkRefusal before any act where the walk may not run. */
export async function riteWalk(opts, say = console.log) {
  const runbookPath = opts.runbook ? resolve(opts.runbook) : join(CHECKOUT, RUNBOOK);
  const text = readFileSync(runbookPath, "utf8");
  const bound = assertBound(bindSteps(text));
  if (opts.bind) { for (const s of bound) say(`${String(s.line).padStart(4)}  ${s.id.padEnd(24)} ${s.fence ?? s.prose}`); return { code: 0, report: null }; }
  if (!opts.out) throw new RiteWalkRefusal("--out names the directory the receipt lands in");
  for (const name of ["from", "to"]) if (opts[name] && !bound.some((s) => s.id === opts[name])) throw new RiteWalkRefusal(`--${name} names no step: ${opts[name]}`);

  // THE GUARD, before any act: the environment first, then the root.
  delete process.env.LAR_BAGS; delete process.env.LAR_GENESIS; delete process.env.LAR_ROOT;
  const boxHome = homedir();
  const stage = process.env.LAR_STAGE_DIR ?? tmpdir();
  const guard = { checkout: CHECKOUT, home: boxHome, prefixes: [tmpdir(), process.env.LAR_STAGE_DIR] };
  if (opts.from && !opts.root) throw new RiteWalkRefusal("--from continues a kept leg; name its root with --root");
  const root = assertScratchRoot(opts.root ?? join(stage, "lares-rite-walk-unminted"), guard);
  const minted = opts.root ? root : (mkdirSync(stage, { recursive: true }), mkdtempSync(join(stage, "lares-rite-walk-")));
  const statePath = join(minted, "rite-work", STATE);
  const state = opts.from
    ? (existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : (() => { throw new RiteWalkRefusal(`${minted} carries no kept leg (${STATE})`); })())
    : { vars: {}, rows: [], passed: [], up: false, port: null, legs: [] };

  const home = join(minted, "home");
  mkdirSync(home, { recursive: true });
  process.env.HOME = home;
  process.env.LAR_SAME_ORIGIN = "true";
  if (!opts.from) cpSync(join(CHECKOUT, "bags"), join(minted, "bags"), { recursive: true });

  const ctx = await hands(minted, state, boxHome);
  const first = opts.from ? bound.findIndex((s) => s.id === opts.from) : 0;
  const last = opts.to ? bound.findIndex((s) => s.id === opts.to) : bound.length - 1;
  let rows;
  try {
    if (opts.from && state.up) await ctx.up();
    rows = await walk(bound.slice(first, last + 1), {
      run: (step) => step.run(ctx),
      standIn: () => ctx.reset(),
      passed: state.passed,
      say: (row) => say(`${verdict(row).padEnd(28)} ${row.step.padEnd(24)} ${row.runbook}  ${row.answer ? `→ ${row.answer.slice(0, 160)}` : ""}${row.refusal ? `\n${" ".repeat(29)}✗ ${row.refusal}` : ""}`),
    });
  } catch (e) {
    await ctx.close();
    if (!opts.keep) rmSync(minted, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    throw e;
  }
  await ctx.close();
  state.rows = [...state.rows.filter((r) => !rows.some((n) => n.step === r.step)), ...rows];
  state.legs.push({ from: bound[first].id, to: bound[last].id });
  state.passed = state.rows.filter((r) => r.outcome === "pass" || (r.outcome === "unreached" && STEPS.find((s) => s.id === r.step)?.standIn)).map((r) => r.step);
  if (opts.keep) writeFileSync(statePath, JSON.stringify(state));
  else rmSync(minted, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });

  // Steps outside every leg walked so far read unreached by name, so the receipt carries a row per step.
  const order = new Map(bound.map((s, i) => [s.id, i]));
  const all = bound.map((s) => state.rows.find((r) => r.step === s.id)
    ?? { step: s.id, runbook: `founding-runbook.mem:${s.line}`, command: s.fence ?? s.prose, expect: s.expect ?? null, outcome: "unreached", cause: s.unreached ?? "outside-this-leg", answer: "", ms: 0 });
  all.sort((a, b) => order.get(a.step) - order.get(b.step));
  const walker = sha256(readFileSync(join(CHECKOUT, "tools/rite-walk.mjs")) + "\n" + readFileSync(join(CHECKOUT, "tools/rite-walk/steps.mjs")));
  const report = receipt({
    head: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain") !== "",
    runbook: carrierIdentity(opts.runbook ? runbookPath : RUNBOOK, text), walker: `sha256:${walker}`,
    rows: all, legs: state.legs,
  });
  const faults = receiptFaults(report.steps);
  if (faults.length > 0) throw new Error(`the receipt breaks the outcome law:\n  ${faults.join("\n  ")}`);
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, "rite-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    `rite-walk · ${report.rite}`,
    `head ${report.inputs.head}${report.inputs.dirty ? " (dirty)" : ""} · runbook sha256:${report.inputs.runbook.sha256} · walker ${report.inputs.walker}`,
    ...report.steps.map((r) => `${verdict(r).padEnd(28)} ${r.step.padEnd(24)} ${r.runbook}  ${r.command}${r.answer ? `\n${" ".repeat(29)}→ ${r.answer}` : ""}${r.refusal ? `\n${" ".repeat(29)}✗ ${r.refusal}` : ""}`),
    `pass ${report.tally.pass} · fail ${report.tally.fail} · unreached ${report.tally.unreached}${report.tally.firstFail ? ` · first fail ${report.tally.firstFail}` : ""} · outcomes ${report.outcomes}`,
  ];
  writeFileSync(join(opts.out, "rite-report.txt"), `${lines.join("\n")}\n`);
  say(lines.at(-1));
  say(`receipt: ${join(opts.out, "rite-report.json")}${opts.keep ? ` · root kept: ${minted}` : ""}`);
  return { code: report.tally.fail > 0 ? 1 : 0, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const argv = process.argv.slice(2);
    // THE IMAGE LEG walks its own table on a real container, inside the scope its line names (`rite-walk/image-leg.mjs`).
    const image = argv.includes("--image-leg") ? await import("./rite-walk/image-leg.mjs") : null;
    const { code } = image ? await image.imageWalk(image.parseImageArgs(argv)) : await riteWalk(parseArgs(argv));
    process.exit(code);
  } catch (e) {
    console.error(e?.name === "RiteWalkRefusal" ? e.message : e);
    process.exit(e?.name === "RiteWalkRefusal" ? 2 : 1);
  }
}
