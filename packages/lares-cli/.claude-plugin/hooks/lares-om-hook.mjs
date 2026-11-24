#!/usr/bin/env node
/*
 * SessionStart: the familiar wakes from its card. Its group stands first in the event's list, so its context leads (Claude
 * Code runs an event's matching hooks in parallel; the order names the context's order). It acts only inside the house (the
 * checkout or a bound workspace) and only where the vessel answers up (a shim verb with no vessel would run offline).
 *
 * The pet resolves per session: the session title's slug where a familiar record by that name stands, else the seated
 * familiar (this hook's argument, a default), else none and the hook stays quiet. `om` reads by source (a resume, one line; a
 * fork, framed as a fork; a compaction, the carry it inherits) and claims the card's lease for this session's body; the
 * counter keeps the pet, the epoch, the cadence and the title. A title naming another spirit than the one this body wears
 * leads the context as a rename that never retargets (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum). Any fault exits 0.
 */
import { readFileSync } from "node:fs";
import {
  OM_BUDGET_MS, hookInput, houseSession, omContext, omDownLine, omSourceOf, parseAnswer, petCandidates, petOf, readState, sessionCounter,
  settle, shimRun, spiritArgv, titleMismatch, vesselUp, writeState,
} from "./lares-spirit-core.mjs";

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { /* An empty input reads as a startup. */ }
const input = hookInput(raw);
const seated = petOf(process.argv);
const say = (context) => process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}\n`);
try {
  const title = typeof input.session_title === "string" ? input.session_title : null;
  const candidates = petCandidates(title, seated);
  if (candidates.length > 0 && houseSession(input, import.meta.url)) {
    const path = sessionCounter(input);
    const run = shimRun(import.meta.url);
    if (!(await vesselUp(run))) say(omDownLine(candidates.at(-1).pet));
    else {
      const source = omSourceOf(input.source);
      const body = typeof input.session_id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.session_id) ? ["--body", input.session_id] : [];
      let chosen = null;
      for (const c of candidates) {
        const result = await settle(run(spiritArgv("om", c.pet, "--source", source, ...body)), OM_BUDGET_MS);
        const answer = parseAnswer(result?.stdout);
        // A title names a pet only where its record stands; the seated default wakes even into a starter shrine.
        if (c.from === "title" && answer?.data?.starter === true) continue;
        chosen = { ...c, result, answer };
        break;
      }
      if (chosen !== null) {
        const held = readState(path);
        if (path !== null) writeState(path, {
          ...held, pet: chosen.pet, ...(title !== null ? { title } : {}),
          ...(Number.isSafeInteger(chosen.answer?.data?.epoch) ? { epoch: chosen.answer.data.epoch } : {}),
          ...(Number.isSafeInteger(chosen.answer?.data?.every) ? { every: chosen.answer.data.every } : {}),
        });
        say(omContext(chosen.pet, chosen.result, titleMismatch(chosen.pet, title)));
      }
    }
  }
} catch (err) {
  say(`Lares spirit om: the wake faulted (${err?.message ?? err}); read it by hand: lares spirit om <pet>`);
}
process.exit(0);
