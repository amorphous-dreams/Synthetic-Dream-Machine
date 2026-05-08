/**
 * Scripted commands — thin shells over existing tsx scripts and pnpm composers.
 *
 * These commands do not refactor the underlying scripts; they invoke them via
 * child_process. The script files remain the source of truth for their logic.
 */

import { join } from "node:path";
import { runTsxScript, runCommand, REPO_ROOT } from "../spawn.js";
import type { ParsedArgs } from "../parse-args.js";

const NODE_PKG = join(REPO_ROOT, "packages", "lararium-node");
const TSX_BIN  = join(REPO_ROOT, "node_modules", ".bin", "tsx");

export async function cmdBuildGenesis(_args: ParsedArgs): Promise<number> {
  return runTsxScript(join(NODE_PKG, "scripts", "build-genesis-island.ts"));
}

export async function cmdTestQuine(_args: ParsedArgs): Promise<number> {
  return runTsxScript(join(NODE_PKG, "scripts", "test-quine.ts"));
}

export async function cmdHeleuma(args: ParsedArgs): Promise<number> {
  const scriptArgs: string[] = [];
  if (args.flags["write"]) scriptArgs.push("--write");
  return runTsxScript(join(REPO_ROOT, "scripts", "heleuma.ts"), scriptArgs);
}

/** `lares serve` — boot the lararium node only (no Vite).
 *  Runs from the lararium-node package directory because main.ts resolves
 *  .lararium / genesis paths relative to cwd. */
export async function cmdServe(_args: ParsedArgs): Promise<number> {
  return runCommand(TSX_BIN, [join(NODE_PKG, "src", "main.ts")], NODE_PKG);
}

/** `lares dev` — boot node + Vite app concurrently (full dev experience). */
export async function cmdDev(_args: ParsedArgs): Promise<number> {
  // Defer to the workspace-root `pnpm dev` script which already wires
  // `concurrently -n node,vite`. Touching that orchestration here would
  // duplicate config that's better kept at one site.
  return runCommand("pnpm", ["dev"]);
}

/**
 * `lares reset` — wipe `.lararium/` storage + bootstrap artifact, then re-init.
 *
 * Operator-confirmation gate: until S7 lands proper auth, we still want a
 * second-thought guard. Honors --force to skip the prompt.
 */
export async function cmdReset(args: ParsedArgs): Promise<number> {
  const { rmSync, existsSync } = await import("node:fs");
  const storage   = join(NODE_PKG, ".lararium");
  const bootstrap = join(NODE_PKG, "genesis", "social-bootstrap.json");

  console.log("[lares reset] will delete:");
  if (existsSync(storage))   console.log(`  ${storage}`);
  if (existsSync(bootstrap)) console.log(`  ${bootstrap}`);
  if (!args.flags["force"]) {
    console.log("Pass --force to proceed.");
    return 1;
  }
  rmSync(storage,   { recursive: true, force: true });
  rmSync(bootstrap, { force: true });
  console.log("[lares reset] cleared. Running lares init…");
  const { cmdInit } = await import("./init.js");
  return cmdInit(args);
}

/** `lares fresh` — reset (--force implied) then serve. */
export async function cmdFresh(args: ParsedArgs): Promise<number> {
  const resetCode = await cmdReset({ ...args, flags: { ...args.flags, force: true } });
  if (resetCode !== 0) return resetCode;
  return cmdServe(args);
}
