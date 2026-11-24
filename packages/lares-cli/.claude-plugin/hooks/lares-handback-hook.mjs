#!/usr/bin/env node
/*
 * PostToolUse on SubagentHandback: a tasked spirit's report arrives as the tool's `message`, and the hook lands it as residue
 * under the spirit's pet name (`lares spirit residue <pet> --text …`, after the keep's secret-shape guard), the pet read off the
 * report's mask tag (`Name: Lares (Tasked Spirit)`), else the agent's id. `lares spirit otakiage <pet>` burns it later, by hand.
 * Any fault exits 0 (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { shimRunner } from "./lares-wake-core.mjs";
import { RESIDUE_BUDGET_MS, RESIDUE_CHARS, handbackPetOf, hookInput, settle, spiritArgv } from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input lands nothing. */ }
  const input = hookInput(raw);
  const message = typeof input.tool_input?.message === "string" ? input.tool_input.message.slice(0, RESIDUE_CHARS) : "";
  if (input.tool_name === "SubagentHandback" && message.trim() !== "") {
    const pet = handbackPetOf(message, input.agent_id ?? input.agent_type ?? "spirit");
    await settle(shimRunner(import.meta.url)("spirit", spiritArgv("residue", pet, "--text", message)), RESIDUE_BUDGET_MS);
  }
} catch { /* A handback that cannot land stays in the transcript. */ }
process.exit(0);
