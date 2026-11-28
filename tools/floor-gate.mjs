#!/usr/bin/env node
/**
 * floor-gate — THE LANDING DOOR: one ref proved on the floor over develop, its verdict written where the rite reads it, and
 * develop moved to it only when every step reads clean. It replaces the hand-rebuilt landing script (the night one printed
 * LANDED over a failed push, its pipe hiding the exit): every exit here reads as a spawn status, in code, never shell plumbing.
 *
 *   node tools/floor-gate.mjs <ref> [tier=small|whole] [whole=<pkg,...>] [land=true] [ticket=<id>]
 *
 *   <ref>     the branch or commit to prove (resolved in the floor's checkout: `spirit/x`, `origin/spirit/x`, a sha)
 *   tier      small (the default): the lane's touched test files per package, the door tool suites, the holder's pytest pair;
 *             whole: the bench gate's full floor plus what the ticket rule owes. Both share ONE plan (tools/bench-gate.mjs `plan`)
 *   whole     packages run whole beside the tier (a slug, `lares-cli`, or its dir, `packages/lares-cli`), comma-joined
 *   land      true pushes HEAD:develop once every step reads clean and develop still stands where the bench merged it
 *   ticket    the floor ticket the run receipts under (floor-run's `--ticket`: its sha dedupe and ledger lines)
 *
 * HOW IT RUNS: the door never re-implements the floor. It hands itself to `tools/floor-run.mjs --ref <ref>`, which admits the run
 * by measured headroom, adds an ephemeral worktree at the ref, provisions it, and runs THIS file (the floor's own copy, never the
 * lane's) inside it with `--inside`; the bench goes away after, green, red or stopped. Inside, in order:
 *   fetch       `git fetch origin develop`; develop's sha now names the base every later read compares against
 *   the plan    tools/bench-gate.mjs `plan({ door: true, tier, changed, whole })`: merge-develop, build, cli-verbs, heleuma,
 *               affordance-pack, redeclare-unbaked, commit-build (each stops the gate when red), witnesses-fast (it carries the
 *               typecheck and the tests ratchet), then the tier's tests
 *   the verdict ONE document, the keeper's shape (`verdictOf`), at `$LARES_HOUSE/cache/bench/<rev>.json` over the committed HEAD;
 *               a step that moved the tracked tree voids it (red). LARES_HOUSE comes from the environment, else
 *               ~/.lares/lares-surface.env; none named leaves the verdict unwritten, said aloud (the rite annotates, never gates)
 *   the land    with land=true and a green verdict: fetch develop again; a develop that moved off the base REFUSES (cure: rerun
 *               the door, which merges the new develop); else `git push origin HEAD:develop`, then `git ls-remote` must read
 *               HEAD on develop, or the door says NOT LANDED and exits 1
 *
 * Last lines: `BENCH GATE GREEN …` / `BENCH GATE REFUSES: …` (the shared gate line), then one of
 *   FLOOR GATE LANDED <sha> on develop (was <sha>)  ·  FLOOR GATE HOLDS: … (no land asked, or the gate refused)  ·  FLOOR GATE NOT LANDED: …
 * Exit: 0 green (and landed, where asked) · 1 a red step, a moved develop, a failed push · 2 usage · 64/65 the floor's own.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGES, TIERS, checkOwes, plan, runGate, scratchEnv, touchedPackages, verdictOf } from "./bench-gate.mjs";
import { requireFloor } from "./floor-lock.mjs";
import { owes as floorOwes } from "./floor-owes.mjs";
import { surfaceValue } from "./house-canon.mjs";
import { readWeights } from "./unit-weights.mjs";

const SELF = fileURLToPath(import.meta.url);
const FLOOR_RUN = fileURLToPath(new URL("./floor-run.mjs", import.meta.url));
export const USAGE = "usage: node tools/floor-gate.mjs <ref> [tier=small|whole] [whole=<pkg,...>] [land=true] [ticket=<id>]";
const KEYS = new Set(["tier", "whole", "land", "ticket"]);

/** Reads the door's words: `{ ref, tier, whole: [pkg dirs], land, ticket, inside }`. Throws a usage fault by name. */
export function parseArgs(argv, packages = PACKAGES) {
  const out = { ref: "", tier: "small", whole: [], land: false, ticket: "", inside: false };
  for (const a of argv) {
    if (a === "--inside") { out.inside = true; continue; }
    const m = /^([a-z]+)=(.*)$/.exec(a);
    if (!m) { if (out.ref || a.startsWith("-")) throw new Error(`unknown argument ${a}`); out.ref = a; continue; }
    const [, k, v] = m;
    if (!KEYS.has(k)) throw new Error(`unknown key ${k}= (the door takes ${[...KEYS].join("=, ")}=)`);
    if (k === "tier") { if (!TIERS.includes(v)) throw new Error(`tier=${v}: name one of ${TIERS.join(", ")}`); out.tier = v; }
    if (k === "land") { if (v !== "true" && v !== "false") throw new Error(`land=${v}: name true or false`); out.land = v === "true"; }
    if (k === "ticket") out.ticket = v;
    if (k === "whole") {
      for (const w of v.split(",").map((x) => x.trim()).filter(Boolean)) {
        const dir = packages.find((d) => d === w || d.split("/").pop() === w);
        if (!dir) throw new Error(`whole=${w}: no vitest package by that name (the roster: ${packages.map((d) => d.split("/").pop()).join(", ")})`);
        if (!out.whole.includes(dir)) out.whole.push(dir);
      }
    }
  }
  if (!out.inside && !out.ref) throw new Error("name the ref to prove");
  return out;
}

/** The words the floor runs: floor-run's `--ref` bench around this file's own `--inside` run. */
export function floorCommand(opts, { node = process.execPath, self = SELF, floorRun = FLOOR_RUN } = {}) {
  const inner = [`tier=${opts.tier}`, ...(opts.whole.length ? [`whole=${opts.whole.join(",")}`] : []), ...(opts.land ? ["land=true"] : [])];
  return [floorRun, ...(opts.ticket ? ["--ticket", opts.ticket] : []), "--ref", opts.ref, "--", node, self, "--inside", ...inner];
}

/** The one spawn every step and every git read rides: `{ status, stdout, stderr }`, a signal or a spawn fault reading status 1. */
export function realSh(cmd, args, { cwd, env, capture = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, env: env ?? process.env, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error.message) : "") };
}

/** The house root the rite reads verdicts under: LARES_HOUSE, the environment first, else the surface env file; "" where none. */
export function houseRoot(env = process.env) {
  const h = surfaceValue("LARES_HOUSE", env);
  return h && isAbsolute(h) ? h : "";
}
export const verdictPath = (house, rev) => join(house, "cache", "bench", `${rev}.json`);

/**
 * Re-declares every genesis/unbaked.json row whose source bytes moved: the row's sha256 takes the tree's, byte-for-byte in place
 * (the file's own layout stands). A row naming a source the tree no longer holds reads red (the parity witness owns that cure).
 */
export function redeclareUnbaked(root, say = console.log, fs = { existsSync, readFileSync, writeFileSync }) {
  const file = join(root, "genesis", "unbaked.json");
  if (!fs.existsSync(file)) { say("redeclare-unbaked: no genesis/unbaked.json stands; nothing to re-declare"); return 0; }
  let text = fs.readFileSync(file, "utf8");
  let rows;
  try { rows = JSON.parse(text).unbaked; } catch (e) { say(`redeclare-unbaked: genesis/unbaked.json reads as no JSON (${e.message})`); return 1; }
  let moved = 0, red = 0;
  for (const r of rows ?? []) {
    const src = join(root, r.source);
    if (!fs.existsSync(src)) { say(`redeclare-unbaked: ${r.source} stands no longer; drop its row (tools/genesis-parity-witness.sh names the cure)`); red++; continue; }
    const now = createHash("sha256").update(fs.readFileSync(src)).digest("hex");
    if (now === r.sha256) continue;
    text = text.replace(`"sha256": "${r.sha256}"`, `"sha256": "${now}"`);
    say(`redeclare-unbaked: ${r.source} ${r.sha256.slice(0, 12)} -> ${now.slice(0, 12)}`);
    moved++;
  }
  if (moved) fs.writeFileSync(file, text);
  else if (!red) say("redeclare-unbaked: every row names its source's bytes");
  return red ? 1 : 0;
}

/**
 * THE GATE, inside the bench: every git read and every step through `sh`, so a test hands it a fake. Answers
 * `{ code, line, landed, verdict, file }`; `code` reads 0 only where the gate read green and (where asked) develop took HEAD.
 */
export function gate({ root, tier = "small", whole = [], land = false, sh = realSh, say = console.log, env = process.env, house = houseRoot(env), planFn = plan, owesFn = floorOwes, weights, write = (file, text) => { mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, text); }, redeclare = (r) => redeclareUnbaked(r, say), clock } = {}) {
  const git = (args, extra = {}) => sh("git", args, { cwd: root, capture: true, ...extra });
  const out1 = (args) => git(args).stdout.trim();
  const fetched = git(["fetch", "-q", "origin", "develop"]);
  if (fetched.status !== 0) {
    const line = `FLOOR GATE REFUSES: git fetch origin develop (exit ${fetched.status}) ${fetched.stderr.trim()}`.trim();
    say(line);
    return { code: 1, line, landed: false, verdict: null, file: "" };
  }
  const base = out1(["rev-parse", "origin/develop"]);
  const diff = git(["diff", "--name-only", `${base}...HEAD`]);
  if (diff.status !== 0) {
    const line = `FLOOR GATE REFUSES: git diff ${base.slice(0, 9)}...HEAD (exit ${diff.status}); the bench shares no history with develop`;
    say(line);
    return { code: 1, line, landed: false, verdict: null, file: "" };
  }
  const changed = diff.stdout.split("\n").filter(Boolean);
  // WHAT THE BUILD WROTE: the untracked paths standing before any step, so commit-build adds only what the gate's own steps made.
  const before = new Set(out1(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean));
  const owed = tier === "whole" ? owesFn({ root, base, head: "HEAD" }) : undefined;
  const steps = planFn({ tier, door: true, changed, whole, root, touched: touchedPackages(changed), ...(owed ? { owed } : {}), ...(weights ? { weights } : {}) });
  const larBin = join(root, "packages/lares-cli/bin/lares.mjs");
  const run = (s) => {
    if (s.check === "merge") return git(["merge", "--no-edit", base], { capture: false }).status;
    if (s.check === "owes") return checkOwes(owed, say);
    if (s.check === "unbaked") return redeclare(root);
    if (s.check === "commit") {
      const modified = out1(["diff", "--name-only", "HEAD"]).split("\n").filter(Boolean);
      const fresh = out1(["ls-files", "--others", "--exclude-standard"]).split("\n").filter((p) => p && !before.has(p));
      if (modified.length === 0 && fresh.length === 0) { say("commit-build: the build wrote nothing tracked"); return 0; }
      const added = git(["add", "-u"]);
      if (added.status !== 0) return added.status;
      if (fresh.length) { const a = git(["add", "--", ...fresh]); if (a.status !== 0) return a.status; }
      const paths = [...modified, ...fresh];
      say(`commit-build: ${paths.length} path(s) the build wrote: ${paths.join(", ")}`);
      const msg = `lar:///floor.gate.commits/build-writes — the floor gate commits what the build wrote over develop ${base.slice(0, 9)}: ${paths.join(", ")}`;
      return git(["commit", "-q", "-m", msg], { capture: false, env: { ...env, ...(existsSync(larBin) ? { LARES_BIN: larBin } : {}) } }).status;
    }
    return sh(s.cmd, s.args, { cwd: join(root, s.cwd), env: s.scratch ? scratchEnv(s.name) : env }).status;
  };
  const r = runGate(steps, run, say, { head: out1(["rev-parse", "--short", "HEAD"]), base: base.slice(0, 9), ...(owed?.digest ? { owes: owed.digest.slice(0, 16) } : {}), ...(clock ? { clock } : {}) });
  // THE VERDICT names the committed HEAD; a step that moved the tracked tree after the commit voids it.
  const rev = out1(["rev-parse", "HEAD"]), tree = out1(["rev-parse", "HEAD^{tree}"]);
  const moved = out1(["status", "--porcelain", "--untracked-files=no"]) !== "";
  const read = moved ? { ...r, code: 1, line: `BENCH GATE REFUSES: the tracked tree moved under the gate · ${r.secs} s` } : r;
  if (moved) say(read.line);
  let verdict = null, file = "";
  try { verdict = verdictOf(read, { rev, tree }); } catch (e) { say(`floor-gate: no verdict: ${e.message}`); }
  if (verdict && house) { file = verdictPath(house, rev); write(file, JSON.stringify(verdict)); say(`floor-gate: verdict over ${rev.slice(0, 12)} written to ${file}`); }
  else if (verdict) say("floor-gate: no LARES_HOUSE named (the environment or ~/.lares/lares-surface.env), so the verdict stays unwritten and the rite reads none");
  const done = (code, line, landed = false) => { say(line); return { code, line, landed, verdict, file }; };
  if (read.code !== 0) return done(1, `FLOOR GATE HOLDS: not landed, the gate refused (${read.red?.join(", ") || read.line})`);
  if (!land) return done(0, `FLOOR GATE HOLDS: green at ${rev.slice(0, 9)}, not landed (land=true lands)`);
  // THE LAND: develop re-read right before the push; a develop that moved refuses, and the push and the remote's read decide.
  const again = git(["fetch", "-q", "origin", "develop"]);
  if (again.status !== 0) return done(1, `FLOOR GATE NOT LANDED: the re-read of develop refused (git fetch exit ${again.status}); rerun the door`);
  const now = out1(["rev-parse", "origin/develop"]);
  if (now !== base) return done(1, `FLOOR GATE NOT LANDED: develop moved from ${base.slice(0, 9)} to ${now.slice(0, 9)} under the gate; pono: rerun the door (node tools/floor-gate.mjs <ref> ... land=true), which merges the new develop`);
  const pushed = git(["push", "origin", "HEAD:develop"], { capture: false });
  if (pushed.status !== 0) return done(1, `FLOOR GATE NOT LANDED: git push origin HEAD:develop exited ${pushed.status}`);
  const remote = out1(["ls-remote", "origin", "refs/heads/develop"]).split(/\s+/)[0] ?? "";
  if (remote !== rev) return done(1, `FLOOR GATE NOT LANDED: the push read 0, yet origin's develop reads ${remote.slice(0, 9) || "nothing"}, not ${rev.slice(0, 9)}`);
  return done(0, `FLOOR GATE LANDED ${rev.slice(0, 9)} on develop (was ${base.slice(0, 9)})`, true);
}

if (process.argv[1] === SELF) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`floor-gate: ${e.message}\n${USAGE}`); process.exit(2); }
  if (!opts.inside) {
    // THE FLOOR runs it: floor-run admits by headroom, stands the --ref bench, runs this file inside it and passes the exit through.
    const r = spawnSync(process.execPath, floorCommand(opts), { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }
  requireFloor("floor-gate.mjs", process.argv.slice(2));
  const top = realSh("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd(), capture: true });
  if (top.status !== 0) { console.error("floor-gate: --inside runs in the bench worktree floor-run stands; this directory stands in no checkout"); process.exit(2); }
  const root = top.stdout.trim();
  const weightsFile = join(root, "tools/unit-weights.json");
  const r = gate({ root, tier: opts.tier, whole: opts.whole, land: opts.land, ...(existsSync(weightsFile) ? { weights: readWeights(weightsFile) } : {}) });
  process.exit(r.code);
}
