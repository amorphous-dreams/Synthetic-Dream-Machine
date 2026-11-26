#!/usr/bin/env node
/*
 * SessionStart: the familiar wakes from its card. Its group stands first in the event's list, so its context leads (Claude
 * Code runs an event's matching hooks in parallel; the order names the context's order). It acts only inside the house (the
 * checkout or a bound workspace) and only where the vessel answers up (a shim verb with no vessel would run offline).
 *
 * EACH FAMILIAR ITS OWN. The wake asks once for the pet this session already holds (any source but a startup keeps it, and the
 * door hears `--held`, so a retitle reads as its rename), else the seated familiar (a default), else the title's slug. The door
 * reads the title beside it (`om --title`): a fresh session's title wakes its own familiar where a record stands, or offers its
 * starter (recording no pet here until a record stands). Many instances may wear one pet. `om` reads by source
 * and joins this instance to the card's presence; the counter keeps the pet, the epoch, the cadence and the title, merged
 * under its lock (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum). Any fault exits 0.
 */
import { readFileSync } from "node:fs";
import {
  OM_BUDGET_MS, digestsOf, holdsPet, hookInput, houseSession, omContext, omDownLine, omOwedLine, omSourceOf, parseAnswer, petOf, readState, sessionCounter,
  settle, shimRun, spiritArgv, updateState, vesselReading, titleParts, wakePet,
} from "./lares-spirit-core.mjs";

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { /* An empty input reads as a startup. */ }
const input = hookInput(raw);
const say = (context) => process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}\n`);
try {
  const title = typeof input.session_title === "string" && input.session_title.trim() !== "" ? input.session_title : null;
  const path = sessionCounter(input);
  const source = omSourceOf(input.source);
  const state = readState(path);
  const held = state.pet;
  const pet = wakePet({ source, held, seated: petOf(process.argv), title, offer: state.offer });
  if (pet !== null && houseSession(input, import.meta.url)) {
    const run = shimRun(import.meta.url);
    const reading = await vesselReading(run);
    if (reading === "down") say(omDownLine(pet));
    else if (reading === "owed") say(omOwedLine(pet));
    else {
      const instance = typeof input.session_id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.session_id) ? ["--instance", input.session_id] : [];
      const result = await settle(run(spiritArgv("om", pet, "--source", source, ...instance, ...(holdsPet({ source, held }, pet) ? ["--held"] : []), ...(title !== null ? ["--title", titleParts(title).title] : []))), OM_BUDGET_MS);
      const answer = parseAnswer(result?.stdout);
      // Only an answer the door gave whole names the pet this session wears; a timeout or a refusal records nothing, and a
      // starter (an offer, no record yet) records no pet until a record stands.
      if (answer?.ok === true) {
        const worn = answer.data?.starter === true ? null : typeof answer.data?.pet === "string" ? answer.data.pet : pet;
        updateState(path, (cur) => ({
          ...cur, ...(worn !== null ? { pet: worn, offer: null } : { offer: typeof answer.data?.pet === "string" ? answer.data.pet : pet }), ...(title !== null ? { title } : {}),
          ...(Number.isSafeInteger(answer.data?.epoch) ? { epoch: answer.data.epoch } : {}),
          ...(Number.isSafeInteger(answer.data?.every) ? { every: answer.data.every } : {}),
          ...(answer.data?.digests && typeof answer.data.digests === "object" ? { digests: digestsOf(answer.data.digests) } : {}),
        }));
      }
      const { instance: nth } = titleParts(title);
      say(omContext(pet, result, null, nth === null ? null : `${pet}#${nth}`));
    }
  }
} catch (err) {
  say(`Lares spirit om: the wake faulted (${err?.message ?? err}); read it by hand: lares spirit om <pet>`);
}
process.exit(0);
