#!/usr/bin/env node
/*
 * PostToolUse on SubagentHandback: a tasked spirit's report arrives as the tool's `message`, and the hook lands it as residue
 * under the spirit's pet name (`lares spirit residue <pet> --file -`, the report whole on stdin, the door's strict secret-shape
 * guard over it), the pet read off the report's first non-blank line (`Name: Lares (Tasked Spirit)`), else the agent's id.
 * It lands only where a familiar stands seated (its argument), the session works inside the checkout or a bound workspace,
 * and the vessel answers up. `lares spirit otakiage <pet>` burns it later, by hand. Any fault exits 0
 * (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import {
  RESIDUE_BUDGET_MS, checkoutOf, handbackPetOf, hookInput, inHouse, petOf, settle, shimRun, spiritArgv, surfaceText, vesselUp, workspaceDirsOf,
} from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input lands nothing. */ }
  const input = hookInput(raw);
  const message = typeof input.tool_input?.message === "string" ? input.tool_input.message : "";
  const seated = petOf(process.argv) !== null;
  const house = inHouse(input.cwd, checkoutOf(import.meta.url), workspaceDirsOf(process.env, surfaceText(process.env)));
  if (seated && house && input.tool_name === "SubagentHandback" && message.trim() !== "") {
    const run = shimRun(import.meta.url);
    if (await vesselUp(run)) {
      const pet = handbackPetOf(message, input.agent_id ?? input.agent_type ?? "spirit");
      await settle(run(spiritArgv("residue", pet, "--file", "-"), message), RESIDUE_BUDGET_MS);
    }
  }
} catch { /* A handback that cannot land stays in the transcript. */ }
process.exit(0);
