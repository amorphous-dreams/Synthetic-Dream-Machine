#!/usr/bin/env node
/**
 * pre-push-gate — the one command a lane runs before every lane push (controller-handoff#/the-lane-law).
 *
 *   node tools/pre-push-gate.mjs [--list]
 *
 * It runs the static laws that need no docker, no browser and no CI: the fast tier of the witnesses (`witness-all.sh --fast`) and
 * the pure census and naming-law suites of lararium-mesh. Every step runs, none short-circuits, and the exit names each red step
 * (exit 1; a usage fault exits 2). A lane's own battery and the CI shards still run; this gate catches the cheap reds a push
 * would otherwise spend a CI run on. It stands as a lane's own step, never a git hook.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The census and naming-law suites: each reads the source tree and asserts a law, with no daemon, port or build output. */
export const CENSUS = [
  "face-reading-census", "o-takiage-names", "prototype-key-maps", "prototype-key-raw-ops", "stored-value-census",
  "stored-value-receive-ratio", "unbuilt-laws", "outcome-census", "lease-law-census", "ed25519-door-census",
];

export const STEPS = [
  { name: "witnesses-fast", cmd: "bash", args: ["tools/witness-all.sh", "--fast"], cwd: "." },
  { name: "census-laws", cmd: "npx", args: ["vitest", "run", ...CENSUS.map((c) => `tests/${c}.test.ts`)], cwd: "packages/lararium-mesh" },
];

/** Runs every step through `run(step) -> exit code`, then reports. Returns { code, red }. */
export function runGate(steps, run, say = console.log) {
  const red = [];
  for (const s of steps) {
    const t0 = performance.now();
    say(`── gate step ${s.name} ──`);
    const rc = run(s);
    say(`── ${s.name}: ${rc === 0 ? "ok" : `RED exit ${rc}`} (${((performance.now() - t0) / 1000).toFixed(1)} s) ──`);
    if (rc !== 0) red.push(`${s.name} (exit ${rc})`);
  }
  if (red.length) say(`PRE-PUSH GATE REFUSES: ${red.join(", ")}\npono: cure that witness's finding, then run the gate again`);
  else say("PRE-PUSH GATE GREEN");
  return { code: red.length ? 1 : 0, red };
}

const exec = (s) => spawnSync(s.cmd, s.args, { cwd: join(ROOT, s.cwd), stdio: "inherit", env: process.env }).status ?? 1;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== "--list")) { console.error("pre-push-gate: unknown argument"); process.exit(2); }
  if (args.includes("--list")) { for (const s of STEPS) console.log(`${s.name}: ${s.cmd} ${s.args.join(" ")} (in ${s.cwd})`); process.exit(0); }
  process.exit(runGate(STEPS, exec).code);
}
