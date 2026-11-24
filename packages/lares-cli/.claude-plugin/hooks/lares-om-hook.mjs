#!/usr/bin/env node
/*
 * SessionStart: the familiar wakes from its record. Its group stands first in the event's list, so its context leads (Claude
 * Code runs an event's matching hooks in parallel; the order names the context's order). One gate, then one read: the
 * observation, and only where the vessel answers up, `lares spirit om <pet>` through the checkout's shim (a shim verb with no
 * vessel would run offline over the store). A resume keeps its own context and wakes nothing. The session's title rides into
 * the session's counter, and a title naming another spirit than the seated familiar leads the context with that mismatch;
 * the seated familiar still answers (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum). Any fault exits 0.
 */
import { readFileSync } from "node:fs";
import {
  OM_BUDGET_MS, hookInput, omContext, omDownLine, omRunsOn, petOf, readState, settle, shimRun, spiritArgv, stateDirOf, statePathOf,
  surfaceText, titleMismatch, vesselUp, writeState,
} from "./lares-spirit-core.mjs";

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { /* An empty input reads as a startup. */ }
const input = hookInput(raw);
const pet = petOf(process.argv);
try {
  if (pet !== null && omRunsOn(input.source)) {
    const title = typeof input.session_title === "string" ? input.session_title : null;
    const path = statePathOf(stateDirOf(process.env, surfaceText(process.env)), input.session_id);
    if (path !== null && title !== null) writeState(path, { ...readState(path), title });
    const run = shimRun(import.meta.url);
    const context = (await vesselUp(run))
      ? omContext(pet, await settle(run(spiritArgv("om", pet)), OM_BUDGET_MS), titleMismatch(pet, title))
      : omDownLine(pet);
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}\n`);
  }
} catch (err) {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `Lares spirit om · ${pet}: the wake faulted (${err?.message ?? err}); read it by hand: lares spirit om ${pet}` } })}\n`);
}
process.exit(0);
