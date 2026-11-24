#!/usr/bin/env node
/*
 * Stop, counter-gated: every 25 stops of a session, or while a landing stands unfiled, the hook returns `additionalContext`
 * naming `lares spirit ah` and `hum`, so the body trues its record and chooses what folds. It steps aside silently while the
 * harness already continues a stop (`stop_hook_active`), on a session id it cannot key a counter by, and where the vessel
 * answers no up; an unfiled mark clears only once its nudge prints. The counter rests in the house's run dir, one file per
 * session, written whole. Any fault exits 0 (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { hookInput, petOf, readState, shimRun, stateDirOf, statePathOf, stopStep, surfaceText, trueUpText, vesselUp, writeState } from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input nudges nothing. */ }
  const input = hookInput(raw);
  const pet = petOf(process.argv);
  const path = statePathOf(stateDirOf(process.env, surfaceText(process.env)), input.session_id);
  if (pet !== null && input.stop_hook_active !== true && path !== null) {
    const held = readState(path);
    const step = stopStep(typeof input.session_title === "string" ? { ...held, title: input.session_title } : held);
    writeState(path, step.state);
    if (step.fire !== null && (await vesselUp(shimRun(import.meta.url)))) {
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: trueUpText(pet, step) } })}\n`);
      if (step.fire === "unfiled") writeState(path, { ...step.state, unfiled: null });
    }
  }
} catch { /* A nudge that faults lets the stop through. */ }
process.exit(0);
