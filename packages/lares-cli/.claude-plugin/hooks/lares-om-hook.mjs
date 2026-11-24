#!/usr/bin/env node
/*
 * SessionStart: the familiar wakes from its card. Its group stands first in the event's list, so its context leads (Claude
 * Code runs an event's matching hooks in parallel; the order names the context's order). It acts only inside the house (the
 * checkout or a bound workspace) and only where the vessel answers up (a shim verb with no vessel would run offline).
 *
 * A TITLE ONLY PROPOSES. The wake asks once for the pet this session already wears (any source but a startup keeps it), else
 * the seated familiar (this hook's argument, a default), else the title's slug where neither stands; the door reads the title
 * beside it (`om --title`) and turns only where the title's record names it as its own, else offers it. `om` reads by source
 * and claims the card's lease for this session's body; the counter keeps the pet, the epoch, the cadence and the title, merged
 * under its lock (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum). Any fault exits 0.
 */
import { readFileSync } from "node:fs";
import {
  OM_BUDGET_MS, hookInput, houseSession, omContext, omDownLine, omSourceOf, parseAnswer, petOf, readState, sessionCounter,
  settle, shimRun, spiritArgv, updateState, vesselUp, wakePet,
} from "./lares-spirit-core.mjs";

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { /* An empty input reads as a startup. */ }
const input = hookInput(raw);
const say = (context) => process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}\n`);
try {
  const title = typeof input.session_title === "string" && input.session_title.trim() !== "" ? input.session_title : null;
  const path = sessionCounter(input);
  const source = omSourceOf(input.source);
  const pet = wakePet({ source, held: readState(path).pet, seated: petOf(process.argv), title });
  if (pet !== null && houseSession(input, import.meta.url)) {
    const run = shimRun(import.meta.url);
    if (!(await vesselUp(run))) say(omDownLine(pet));
    else {
      const body = typeof input.session_id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.session_id) ? ["--body", input.session_id] : [];
      const result = await settle(run(spiritArgv("om", pet, "--source", source, ...body, ...(title !== null ? ["--title", title] : []))), OM_BUDGET_MS);
      const answer = parseAnswer(result?.stdout);
      // Only an answer the door gave whole names the pet this session wears; a timeout or a refusal records nothing.
      if (answer?.ok === true) {
        const worn = typeof answer.data?.pet === "string" ? answer.data.pet : pet;
        updateState(path, (cur) => ({
          ...cur, pet: worn, ...(title !== null ? { title } : {}),
          ...(Number.isSafeInteger(answer.data?.epoch) ? { epoch: answer.data.epoch } : {}),
          ...(Number.isSafeInteger(answer.data?.every) ? { every: answer.data.every } : {}),
        }));
      }
      say(omContext(pet, result));
    }
  }
} catch (err) {
  say(`Lares spirit om: the wake faulted (${err?.message ?? err}); read it by hand: lares spirit om <pet>`);
}
process.exit(0);
