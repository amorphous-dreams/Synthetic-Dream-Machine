/**
 * hook-pause — the hook-lever: a marker file a capture hook checks and steps aside on, so a
 * migration / teardown runs WITHOUT spawn-contention.
 *
 * The daemon-spawn whack-a-mole roots at the SPAWNER, never the children: whatever runs the
 * `lares capture/subagents/telemetry` legs on a session event mints a warm write-daemon each
 * time. Killing daemons never stops the minting. This lever pauses the minting itself:
 * `lares hooks pause` writes the marker, a capture hook's guard exits early, and
 * `lares mempalace quiesce` then drains to zero.
 *
 * The marker lives at `<root>/run/hooks.paused` (the house root's transient levers). The tree
 * carries no capture hook; a hook that runs those legs reads this marker first, and the rites
 * that write and clear it (`quiesce`, `resume`, the re-pave) hold that contract for it.
 *
 * Meme: lar:///ha.ka.ba/lararium/mempalace/palace-path
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { larRuntimeHome } from "@lararium/node";

/** The absolute path of the hook-pause marker — one spelling, which a capture hook reads as `$LAR_ROOT/run/hooks.paused`. */
export function hookPauseMarkerPath(): string {
  return join(larRuntimeHome(), "hooks.paused");
}

export interface HookPauseState {
  readonly paused: boolean;
  readonly marker: string;
  /** When paused: the reason + ISO timestamp recorded in the marker (best-effort). */
  readonly since?:   string;
  readonly reason?:  string;
}

/** Read the current pause state, parsing the marker's recorded reason/timestamp. */
export function hookPauseState(): HookPauseState {
  const marker = hookPauseMarkerPath();
  if (!existsSync(marker)) return { paused: false, marker };
  let since: string | undefined;
  let reason: string | undefined;
  try {
    const body = JSON.parse(readFileSync(marker, "utf8")) as { since?: string; reason?: string };
    since  = body.since;
    reason = body.reason;
  } catch { /* a hand-touched / empty marker still means paused */ }
  return { paused: true, marker, ...(since ? { since } : {}), ...(reason ? { reason } : {}) };
}

/** Write the pause marker (idempotent — re-pausing refreshes the reason/timestamp). */
export function pauseHooks(reason = "manual"): HookPauseState {
  const marker = hookPauseMarkerPath();
  mkdirSync(dirname(marker), { recursive: true });
  const since = new Date().toISOString();
  writeFileSync(marker, JSON.stringify({ since, reason }) + "\n", "utf8");
  return { paused: true, marker, since, reason };
}

/** Remove the pause marker (idempotent — a clean no-op when already resumed). */
export function resumeHooks(): HookPauseState {
  const marker = hookPauseMarkerPath();
  rmSync(marker, { force: true });
  return { paused: false, marker };
}
