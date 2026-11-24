#!/usr/bin/env node
/*
 * Stop, counter-gated: every 25 stops of a session, or once a round landed unfiled, the hook returns `additionalContext`
 * naming `lares spirit ah` and `hum`, so the body trues its record and chooses what folds. It steps aside silently while the
 * harness already continues a stop (`stop_hook_active`), on a session id it cannot key a counter by, and where the vessel
 * answers no "up". The counter rests in the house's run dir, one file per session. Any fault exits 0
 * (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { observation, observeArgv, shimRunner } from "./lares-wake-core.mjs";
import { TRUE_UP_BUDGET_MS, hookInput, petOf, readState, settle, stateDirOf, statePathOf, stopStep, trueUpText, writeState } from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input nudges nothing. */ }
  const input = hookInput(raw);
  const pet = petOf(process.argv);
  let surface = null;
  try { surface = readFileSync(join(process.env.HOME || homedir(), ".lares", "lares-surface.env"), "utf8"); } catch { /* no surface file */ }
  const path = statePathOf(stateDirOf(process.env, surface), input.session_id);
  if (pet !== null && input.stop_hook_active !== true && path !== null) {
    const step = stopStep(readState(path));
    writeState(path, step.state);
    if (step.fire !== null) {
      const seen = await settle(shimRunner(import.meta.url)("observe", observeArgv()), TRUE_UP_BUDGET_MS);
      if (seen !== null && observation(seen).up) {
        process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: trueUpText(pet, step) } })}\n`);
      }
    }
  }
} catch { /* A nudge that faults lets the stop through. */ }
process.exit(0);
