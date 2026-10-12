/**
 * Scripted commands — thin shells over existing tsx scripts and pnpm composers.
 *
 * These commands do not refactor the underlying scripts; they invoke them via
 * child_process. The script files remain the source of truth for their logic.
 */

import { join } from "node:path";
import { runTsxScript, runCommand } from "../spawn.js";
import { engineHeldByHost, EngineHeldByHost } from "../port-control.js";

/** Refuse, by name, an act on the daemon where the host holds the engine. */
function refuseEngineAct(act: string): number {
  console.error(`${new EngineHeldByHost(act).name}: ${new EngineHeldByHost(act).message}`);
  return 3;
}
import { repoRoot as REPO_ROOT } from "@lararium/mesh/node";
import { larRoot } from "../env.js";
import type { ParsedArgs } from "../parse-args.js";

const NODE_PKG = join(REPO_ROOT, "packages", "lararium-node");

/** What a bake runs: the genesis script, and the dir it writes into. */
export interface BakePlan {
  readonly script: string;
  readonly env: Readonly<Record<string, string>>;
}

/**
 * The bake reads the PLUGIN THAT STANDS. `build-genesis-island.ts` packs the engine and the packed
 * plugin in `packages/lararium-tw5/plugins/` into the genesis island and fails loud when the blob is
 * absent; building that blob belongs to the build (`pnpm build`, `vessel rite refresh`), never to a
 * founding. A bake that rebuilt the plugin would write into the shared tree on every staged boot,
 * beside whoever else is building there.
 */
export function bakePlan(args: ParsedArgs): BakePlan {
  // Genesis is corpus-relative — larRoot() (LAR_ROOT ?? repoRoot), NOT the vessel home.
  const genesisDir = args.options["genesis"] ?? join(larRoot(), "genesis");
  return { script: join(NODE_PKG, "scripts", "build-genesis-island.ts"), env: { LAR_GENESIS: genesisDir } };
}

export async function cmdBake(args: ParsedArgs): Promise<number> {
  const plan = bakePlan(args);
  return runTsxScript(plan.script, [], { ...process.env, ...plan.env });
}

export async function cmdTestQuine(_args: ParsedArgs): Promise<number> {
  return runTsxScript(join(NODE_PKG, "scripts", "test-quine.ts"));
}

/** `lares vessel stand --foreground` — boot the lararium node only (no Vite).
 *
 *  Runs the BUILT dist, never tsx-source: the sovereign island workers spawn from
 *  compiled `.js` siblings (`node-daemon-island.js` / `node-wiki-island.js`, no
 *  `execArgv`), so a tsx-source run produces a half-dead vessel (port bound, daemon
 *  worker ERR_MODULE_NOT_FOUND). `node dist/src/main.js` names the only sound boot
 *  (= the package `start` script, the e2e harness). */
export async function cmdStandForeground(args: ParsedArgs): Promise<number> {
  if (engineHeldByHost()) return refuseEngineAct("vessel stand --foreground would boot a second daemon");
  const { existsSync } = await import("node:fs");
  const distMain = join(NODE_PKG, "dist", "src", "main.js");
  if (!existsSync(distMain)) {
    console.error(`[lares vessel stand --foreground] ${distMain} not found — run \`pnpm build\` first (the island workers are compiled; tsx-source cannot spawn them).`);
    return 1;
  }
  const extraArgs: string[] = [];
  if (args.options["wiki"])    extraArgs.push("--wiki",    args.options["wiki"]);
  if (args.options["port"])    extraArgs.push("--port",    args.options["port"]);
  if (args.options["root"])    extraArgs.push("--root",    args.options["root"]);
  return runCommand("node", [distMain, ...extraArgs], NODE_PKG);
}

/** `lares vessel stand --with-web` — boot node + Vite web surface concurrently (full dev experience). */
export async function cmdStandWithWeb(_args: ParsedArgs): Promise<number> {
  if (engineHeldByHost()) return refuseEngineAct("vessel stand --with-web would boot a second daemon and a dev server");
  // Defer to the workspace-root `pnpm dev` script which already wires
  // `concurrently -n node,vite`. Touching that orchestration here would
  // duplicate config that's better kept at one site.
  return runCommand("pnpm", ["dev"]);
}

/**
 * `lares vessel rite refresh` — THE idempotent post-dev-change cure. After ANY code edit, run this:
 *   1. `pnpm build`       — recompile every package's dist AND stamp the source digest. The island
 *                            workers spawn from dist, so a stale dist half-kills a vessel; and the
 *                            STAMP is what the fresh-build gate reads, so a build that skips it leaves
 *                            the tree reading stale and the next lifecycle verb rebuilds mid-command.
 *                            Idempotent.
 *   2. stop + stand       — stop the incumbent on the port, then serve the current vessel.
 *
 * Idempotent from a running, stale, or absent vessel. The dev-loop siblings, by reach:
 *   - `vessel rite refresh`            : code changed → REBUILD + stop + serve  (this — the full cure)
 *   - `vessel stand --restart`         : converge a running vessel (no rebuild, no wipe)
 *   - `vessel rite rebuild`            : dep-bump serde skew → re-bake genesis only (NO wipe, identity-safe)
 *   - `vessel stand --foreground`      : boot the dist, fail-fast (no convergence, no rebuild)
 */
export async function cmdRiteRefresh(args: ParsedArgs, seams: RiteRefreshSeams = {
    build: () => runCommand("pnpm", ["build"], REPO_ROOT),
    stop: () => stopIncumbentFor(args, "[lares vessel rite refresh]"),
    stand: () => cmdStandForeground(args),
  }): Promise<number> {
  return cmdRiteRefreshSequence(seams);
}

export interface RiteRefreshSeams {
  readonly build: () => Promise<number>;
  readonly stop: () => Promise<number>;
  readonly stand: () => Promise<number>;
}

/** The ordered refresh stages are explicit seams so their order is directly observable. */
async function cmdRiteRefreshSequence(seams: RiteRefreshSeams): Promise<number> {
  console.log("[lares vessel rite refresh] (1/2) pnpm build — recompiling all dist and stamping…");
  const buildCode = await seams.build();
  if (buildCode !== 0) {
    console.error("[lares vessel rite refresh] build failed — fix the compile, then re-run `lares vessel rite refresh`.");
    return buildCode;
  }
  console.log("[lares vessel rite refresh] (2/2) stop + stand…");
  const stopCode = await seams.stop();
  if (stopCode !== 0) return stopCode;
  return seams.stand();
}

async function stopIncumbentFor(args: ParsedArgs, label: string): Promise<number> {
  const port = Number(args.options["port"] ?? process.env["LAR_PORT"] ?? "8080");
  const { stopIncumbent } = await import("../port-control.js");
  try {
    const r = await stopIncumbent(port, {
      onPastGrace: (pids) => console.log(
        pids.length > 0
          ? `${label} :${port} is past its grace, still held by pid(s) ${pids.join(", ")} — waiting on its own exit`
          : `${label} :${port} is past its grace, held by no discoverable pid — waiting on its own exit`,
      ),
    });
    if (r.stopped) console.log(`${label} stopped incumbent on :${port} (graceful)`);
    else           console.log(`${label} :${port} already free`);
    return 0;
  } catch (e) {
    console.error(`${label} ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

/**
 * `lares vessel stand --restart` — converge to ONE live vessel for the dev/test loop. Idempotent
 * with a running, stale, or absent vessel: stop the incumbent by ACCESS to the
 * OS port-table (graceful SIGTERM, waited out to its own real exit — never a forced SIGKILL,
 * no PID file, no supervisor), then serve. The port is the single-
 * instance capability, so EADDRINUSE never bites. A daemon past its grace is NAMED, not left
 * to hang silently; `serve` stays fail-fast.
 */
export async function cmdRestart(args: ParsedArgs): Promise<number> {
  const stopCode = await stopIncumbentFor(args, "[lares vessel stand --restart]");
  if (stopCode !== 0) return stopCode;
  return cmdStandForeground(args);
}

/**
 * `lares vessel rite rebuild` — the identity-safe dep-bump cure (Tier 0).
 *
 * When a dependency bump (keyhive / automerge / beelay / TW5) skews the on-disk
 * serde format, the vessel-host can't deserialize the stored genesis engine and
 * faults (`tag for enum is not valid`). The cure is to REBUILD the genesis engine
 * under the current deps while the vessel store and identity remain intact.
 *
 * Idempotent: stop the incumbent on the port (graceful SIGTERM, waited out to its own real
 * exit — never a forced SIGKILL, as a restart does), rebuild genesis under the explicitly-resolved
 * root, then serve. The vessel store and identity remain intact.
 */
export async function cmdRiteRebuild(args: ParsedArgs): Promise<number> {
  const root       = args.options["root"] ?? process.env["LAR_ROOT"] ?? REPO_ROOT;
  const rootedArgs: ParsedArgs = { ...args, options: { ...args.options, root } };
  const port = Number(args.options["port"] ?? process.env["LAR_PORT"] ?? "8080");
  const { stopIncumbent } = await import("../port-control.js");
  try {
    const r = await stopIncumbent(port, {
      onPastGrace: (pids) => console.log(
        pids.length > 0
          ? `[lares vessel rite rebuild] :${port} is past its grace, still held by pid(s) ${pids.join(", ")} — waiting on its own exit`
          : `[lares vessel rite rebuild] :${port} is past its grace, held by no discoverable pid — waiting on its own exit`,
      ),
    });
    if (r.stopped) console.log(`[lares vessel rite rebuild] stopped incumbent on :${port} (graceful)`);
    else           console.log(`[lares vessel rite rebuild] :${port} already free`);
  } catch (e) {
    console.error(`[lares vessel rite rebuild] ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  console.log("[lares vessel rite rebuild] rebuilding genesis engine under current deps (storage + identity untouched)…");
  const genesisCode = await cmdBake(rootedArgs);
  if (genesisCode !== 0) return genesisCode;
  return cmdStandForeground(rootedArgs);
}
