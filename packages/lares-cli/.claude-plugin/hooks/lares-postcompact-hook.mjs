#!/usr/bin/env node
/*
 * PostCompact lands the summary: the harness hands this hook `compact_summary`, and, only where the vessel answers up, the hook
 * pipes it whole on stdin to `lares spirit <word> <pet> --file -` (the word: `COMPACTION_WORD`), where the door's strict
 * secret-shape guard reads it uncut, puts it at `<word>/<pet>-<hash12>` and files one #/bodies line. A landing the door leaves
 * unfiled, or one that never ran, marks this session's counter, so a later stop names the fold. Any fault exits 0: a
 * compaction never waits on the house (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import {
  COMPACTION_WORD, LANDING_BUDGET_MS, hookInput, parseAnswer, petOf, readState, settle, shimRun, spiritArgv, stateDirOf, statePathOf,
  surfaceText, vesselUp, writeState,
} from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input lands nothing. */ }
  const input = hookInput(raw);
  const pet = petOf(process.argv);
  const summary = typeof input.compact_summary === "string" ? input.compact_summary : "";
  if (pet !== null && summary.trim() !== "") {
    const run = shimRun(import.meta.url);
    const byHand = `land it by hand: lares spirit ${COMPACTION_WORD} ${pet} --file <summary path>`;
    let unfiled;
    if (!(await vesselUp(run))) unfiled = `the vessel answered no up, so nothing landed; ${byHand}`;
    else {
      const answer = parseAnswer((await settle(run(spiritArgv(COMPACTION_WORD, pet, "--file", "-"), summary), LANDING_BUDGET_MS))?.stdout);
      unfiled = answer?.ok !== true ? String(answer?.error?.message ?? `the door answered nothing; ${byHand}`)
        : answer.data?.filed === false ? String(answer.data?.unfiled ?? "the #/bodies line stayed unfiled") : null;
    }
    const path = statePathOf(stateDirOf(process.env, surfaceText(process.env)), input.session_id);
    if (unfiled !== null && path !== null) writeState(path, { ...readState(path), unfiled });
  }
} catch { /* A landing that cannot run leaves the summary in the transcript; the true-up names the fold. */ }
process.exit(0);
