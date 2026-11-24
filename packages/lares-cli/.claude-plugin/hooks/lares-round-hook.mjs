#!/usr/bin/env node
/*
 * PostCompact lands the round: the harness hands this hook `compact_summary`, the whole summary the context turned on, and the
 * hook hands it to `lares spirit round <pet> --text …`, where the door hashes it, runs the keep's secret-shape guard, puts it
 * at round/<pet>-<hash12> and files one #/bodies line. A round the bodies budget leaves unfiled marks this session's counter,
 * so the next stop names the fold. Any fault exits 0: a compaction never waits on the house
 * (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { shimRunner } from "./lares-wake-core.mjs";
import { RESIDUE_CHARS, ROUND_BUDGET_MS, hookInput, parseAnswer, petOf, readState, settle, spiritArgv, stateDirOf, statePathOf, writeState } from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input lands nothing. */ }
  const input = hookInput(raw);
  const pet = petOf(process.argv);
  const summary = typeof input.compact_summary === "string" ? input.compact_summary.slice(0, RESIDUE_CHARS) : "";
  if (pet !== null && summary.trim() !== "") {
    const result = await settle(shimRunner(import.meta.url)("spirit", spiritArgv("round", pet, "--text", summary)), ROUND_BUDGET_MS);
    const answer = parseAnswer(result?.stdout);
    const unfiled = answer?.ok !== true ? String(answer?.error?.message ?? "the round answered nothing; land it by hand: lares spirit round " + pet + " --file <summary>")
      : answer.data?.filed === false ? String(answer.data?.unfiled ?? "the #/bodies line stayed unfiled") : null;
    if (unfiled !== null) {
      let surface = null;
      try { surface = readFileSync(join(process.env.HOME || homedir(), ".lares", "lares-surface.env"), "utf8"); } catch { /* no surface file */ }
      const path = statePathOf(stateDirOf(process.env, surface), input.session_id);
      if (path) writeState(path, { ...readState(path), unfiled });
    }
  }
} catch { /* A round that cannot land leaves the summary in the transcript; the true-up names the fold. */ }
process.exit(0);
