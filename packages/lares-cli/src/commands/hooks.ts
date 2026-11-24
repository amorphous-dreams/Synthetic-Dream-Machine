/**
 * `lares hooks <pause|resume|status>` — the hook-lever on its own.
 *
 * Pauses / resumes capture hooks (whatever runs the `lares sense capture` and `lares sense telemetry`
 * legs on a session event) by writing / removing a marker file a capture hook checks
 * and steps aside on when present. This lets a migration or a
 * `lares sense teardown` run WITHOUT spawn-contention — the discipline made a
 * switch, so the daemon-minting stops at the source instead of playing whack-a-mole
 * with the spawned children.
 *
 * `lares mempalace quiesce` pauses AND drains in one gesture; this verb is the lever
 * alone, for when the operator wants to suppress minting without touching live daemons.
 */

import { hookPauseState, pauseHooks, resumeHooks, hookPauseMarkerPath } from "../hook-pause.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { tableCovers } from "../verb-table.js";

function cmdPause(args: ParsedArgs): number {
  const reason = args.options["reason"] ?? "manual";
  const before = hookPauseState();
  const st = pauseHooks(reason);
  emit(args, {
    ok: true,
    data: { wasPaused: before.paused, hooksPaused: true, marker: st.marker, since: st.since, reason: st.reason },
    human: () => {
      console.log("lares hooks pause\n");
      console.log(before.paused ? "  hooks already paused — reason refreshed." : "  hooks PAUSED — a capture hook steps aside until resumed.");
      console.log(`  marker: ${st.marker}`);
      console.log("  run `lares mempalace quiesce` to drain the warm daemons, `lares hooks resume` to un-pause.");
    },
  });
  return 0;
}

function cmdResume(args: ParsedArgs): number {
  const before = hookPauseState();
  const st = resumeHooks();
  emit(args, {
    ok: true,
    data: { wasPaused: before.paused, hooksPaused: false, marker: st.marker },
    human: () => {
      console.log("lares hooks resume\n");
      console.log(before.paused
        ? "  hooks UN-PAUSED — capture mints the warm daemon lazily again."
        : "  hooks were already live — nothing to do (idempotent no-op).");
    },
  });
  return 0;
}

function cmdStatus(args: ParsedArgs): number {
  const st = hookPauseState();
  emit(args, {
    ok: true,
    data: { hooksPaused: st.paused, marker: st.marker, ...(st.since ? { since: st.since } : {}), ...(st.reason ? { reason: st.reason } : {}) },
    human: () => {
      console.log("lares hooks status\n");
      console.log(`  hooks: ${st.paused ? `PAUSED (${st.reason ?? "manual"}${st.since ? ` since ${st.since}` : ""})` : "LIVE (minting on dispatch)"}`);
      console.log(`  marker: ${st.marker}`);
    },
  });
  return 0;
}

function printHelp(): void {
  console.log("lares hooks <verb>\n");
  console.log("Verbs:");
  console.log("  pause [--reason <t>]  suppress capture minting (write the marker)");
  console.log("  resume                un-pause the hooks (remove the marker)");
  console.log("  status                report the pause state");
  console.log(`\nMarker file: ${hookPauseMarkerPath()}`);
}

/** Every verb the hooks door answers. */
export const HOOKS_VERBS = ["help", "pause", "resume", "status"] as const;

export async function cmdHooks(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help") { printHelp(); return verb ? 0 : 2; }
  const inner: ParsedArgs = {
    command: "hooks", positional: args.positional.slice(1), options: args.options, flags: args.flags,
  };
  const v = verb as (typeof HOOKS_VERBS)[number];
  switch (v) {
    case "help":   printHelp(); return 0;
    case "pause":  return cmdPause(inner);
    case "resume": return cmdResume(inner);
    case "status": return cmdStatus(inner);
    default:
      return refuseUsage(args, "hooks", helpLines("hooks"), `unknown verb "${tableCovers(v)}"`);
  }
}
