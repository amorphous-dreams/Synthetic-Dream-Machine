#!/usr/bin/env node
/*
 * PostToolUse on SubagentHandback (async: it bounds itself): a tasked spirit's report arrives as the tool's `message`, and the
 * hook lands it as residue (`lares spirit residue <pet> --file -`, the report whole on stdin, the strict guard over it), the pet
 * read off the report's first non-blank line (`<pet> (Lares Spirit)`, `<pet>#<n>:` for an instance), else the agent's id, keyed idempotently by
 * session and agent so a repeated fire lands once. It lands only inside the house, where a familiar wears the session (or one
 * stands seated), and where the vessel answers up. `lares spirit otakiage <pet>` burns it later, by hand. Any fault exits 0
 * (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import {
  RESIDUE_BUDGET_MS, handbackPetOf, hookInput, houseSession, petOf, readState, sessionCounter, sessionPet, settle, shimRun, spiritArgv, vesselUp,
} from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input lands nothing. */ }
  const input = hookInput(raw);
  const message = typeof input.tool_input?.message === "string" ? input.tool_input.message : "";
  const worn = sessionPet(readState(sessionCounter(input)), petOf(process.argv));
  if (worn !== null && input.tool_name === "SubagentHandback" && message.trim() !== "" && houseSession(input, import.meta.url)) {
    const run = shimRun(import.meta.url);
    if (await vesselUp(run)) {
      const agent = String(input.agent_id ?? input.agent_type ?? "spirit");
      const pet = handbackPetOf(message, agent);
      const key = `${String(input.session_id ?? "")}:${agent}`.replace(/[^A-Za-z0-9:_-]/g, "-");
      await settle(run(spiritArgv("residue", pet, "--file", "-", "--key", key), message, RESIDUE_BUDGET_MS), RESIDUE_BUDGET_MS);
    }
  }
} catch { /* A handback that cannot land stays in the transcript. */ }
process.exit(0);
