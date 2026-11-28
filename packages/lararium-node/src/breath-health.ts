/**
 * breath-health — the vessel's healthcheck reads its own readiness, then its own breath, never a fixed clock alone.
 *
 * Compose's `up --wait` reads Docker's health, and Docker's health once read `/api/health` alone: a boot still loading after the
 * healthcheck's start period and retries (about 195 s) read `unhealthy`, and compose's wait refused a vessel that only worked
 * (measured 2026-11-27). The check now asks, in order:
 *
 *   `/api/health` answers 200                         → healthy (the vessel stands ready)
 *   any island's breath names a fault                 → unhealthy, the fault's words on stderr
 *   the breath moved since this check's last read     → healthy: the vessel still works (`island-breath` `breathMoved`)
 *   the breath stood still, or no island breathed     → unhealthy
 *
 * Each check keeps its read beside the records (`<breath dir>/.health-last.json`), so the next check judges movement against
 * it. Docker's interval paces the checks and judges nothing; the islands' state, phase, progress and the process's CPU work
 * decide. "healthy" now reads: the vessel answers, or it still works.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { breathDirFromEnv, breathMoved, readIslandBreath, type IslandBreathRecord } from "./island-breath.js";

/** The file the check keeps its last read in, beside the records (no `.json` ending, so no reader takes it for a record). */
export const HEALTH_LAST = ".health-last";

export interface BreathHealthPorts {
  /** Whether `/api/health` answers 200. */
  readonly ready: () => Promise<boolean>;
  readonly dir: string | null;
  readonly say: (line: string) => void;
}

/** One check: 0 healthy, 1 unhealthy. */
export async function breathHealth(p: BreathHealthPorts): Promise<number> {
  if (await p.ready().catch(() => false)) return 0;
  const now = readIslandBreath(p.dir);
  if (now === null || now.length === 0 || p.dir === null) { p.say("breath-health: /api/health answers not ready and no island breathed"); return 1; }
  let before: IslandBreathRecord[] | null = null;
  try { before = JSON.parse(readFileSync(join(p.dir, HEALTH_LAST), "utf8")) as IslandBreathRecord[]; } catch { before = null; }
  try { writeFileSync(join(p.dir, HEALTH_LAST), JSON.stringify(now)); } catch { /* the next check judges against the read before */ }
  const v = breathMoved(before, now);
  if (v.verdict === "fault") { p.say(`breath-health: the island ${v.wikiUri} faulted: ${v.fault}`); return 1; }
  if (v.verdict === "still") { p.say("breath-health: /api/health answers not ready, and no island's breath moved since the last check"); return 1; }
  return 0;
}

/** The check as the image runs it: `/api/health` on the vessel's own port, the breath dir under LAR_ROOT. */
export function breathHealthHere(env: Readonly<Record<string, string | undefined>> = process.env): Promise<number> {
  const port = env["LARES_HEALTH_PORT"] ?? "4321";
  return breathHealth({
    ready: async () => (await fetch(`http://127.0.0.1:${port}/api/health`)).ok,
    dir: breathDirFromEnv(env),
    say: (line) => process.stderr.write(`${line}\n`),
  });
}
