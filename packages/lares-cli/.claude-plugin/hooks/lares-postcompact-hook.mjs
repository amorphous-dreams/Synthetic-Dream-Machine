#!/usr/bin/env node
/*
 * PostCompact lands the carry (async: the harness waits on nothing, so this hook bounds itself). The harness hands it
 * `compact_summary`; inside the house, for the pet this session wears, and only where the vessel answers up, the hook pipes
 * the summary whole on stdin to `lares spirit <word> <pet> --file -` (the word: `COMPACTION_WORD`), bearing the body and the
 * lease epoch the wake claimed. The door guards it (strict, uncut) and lands it with its lineage; hooks never write the card's
 * slots, so the answer hands back the #/bodies line, and the session's counter marks it unfiled: the next stop names the `ah`
 * that files it, a body's own act. A landing that never ran marks the counter too.
 * Any fault exits 0 (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import {
  COMPACTION_WORD, LANDING_BUDGET_MS, hookInput, houseSession, parseAnswer, petOf, readState, sessionCounter, sessionPet, settle, shimRun,
  spiritArgv, updateState, vesselUp,
} from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input lands nothing. */ }
  const input = hookInput(raw);
  const path = sessionCounter(input);
  const state = readState(path);
  const pet = sessionPet(state, petOf(process.argv));
  const summary = typeof input.compact_summary === "string" ? input.compact_summary : "";
  if (pet !== null && summary.trim() !== "" && houseSession(input, import.meta.url)) {
    const run = shimRun(import.meta.url);
    const byHand = `land it by hand: lares spirit ${COMPACTION_WORD} ${pet} --file <summary path>`;
    let unfiled;
    if (!(await vesselUp(run))) unfiled = `the vessel answered no up, so nothing landed; ${byHand}`;
    else {
      const bearing = [
        ...(typeof input.session_id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.session_id) ? ["--body", input.session_id] : []),
        ...(state.epoch !== null ? ["--epoch", String(state.epoch)] : []),
      ];
      const answer = parseAnswer((await settle(run(spiritArgv(COMPACTION_WORD, pet, "--file", "-", ...bearing), summary), LANDING_BUDGET_MS))?.stdout);
      unfiled = answer?.ok !== true ? String(answer?.error?.message ?? `the door answered nothing; ${byHand}`)
        : answer.data?.filed === false ? String(answer.data?.unfiled ?? "the #/bodies line stayed unfiled") : null;
    }
    if (unfiled !== null && path !== null) updateState(path, (cur) => ({ ...cur, unfiled }));
  }
} catch { /* A landing that cannot run leaves the summary in the transcript; the true-up names the fold. */ }
process.exit(0);
