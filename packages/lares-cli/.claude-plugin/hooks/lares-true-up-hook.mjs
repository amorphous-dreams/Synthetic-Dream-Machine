#!/usr/bin/env node
/*
 * Stop, counter-gated: every N stops of a session (the record's `true-up-every`, carried in the counter, 25 by default), or
 * while a carry stands unfiled, the hook returns `additionalContext` naming `lares spirit ah` and `hum`, so the instance trues its
 * card and chooses what folds. It steps aside silently while the harness already continues a stop (`stop_hook_active`), while
 * background tasks or crons still run, outside the house, on a session id it cannot key a counter by, where no familiar wears
 * the session, and where the vessel answers no up; an unfiled mark clears only once its nudge prints. Any fault exits 0
 * (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { busy, hookInput, houseSession, petOf, readState, sessionCounter, sessionPet, shimRun, stopStep, trueUpText, updateState, vesselUp } from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input nudges nothing. */ }
  const input = hookInput(raw);
  const path = sessionCounter(input);
  const held = readState(path);
  const pet = sessionPet(held, petOf(process.argv));
  if (pet !== null && path !== null && input.stop_hook_active !== true && !busy(input) && houseSession(input, import.meta.url)) {
    let step = null;
    updateState(path, (cur) => { step = stopStep(typeof input.session_title === "string" ? { ...cur, title: input.session_title } : cur); return step.state; });
    if (step !== null && step.fire !== null && (await vesselUp(shimRun(import.meta.url)))) {
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: trueUpText(pet, step, input.session_id) } })}\n`);
      // Only the mark this nudge named clears: a landing that marked the counter meanwhile stands for the next stop.
      if (step.fire === "unfiled") updateState(path, (cur) => ({ ...cur, unfiled: cur.unfiled === step.unfiled ? null : cur.unfiled }));
    }
  }
} catch { /* A nudge that faults lets the stop through. */ }
process.exit(0);
