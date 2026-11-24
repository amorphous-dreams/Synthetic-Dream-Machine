#!/usr/bin/env node
/*
 * SessionStart, first and alone: the familiar wakes from its record before any heavier read. One read, `lares spirit om <pet>`
 * through the checkout's shim, printed as `additionalContext` under the 9,000-char wake cap; the wake hook's reads run beside it
 * as their own entry. The pet name rides as this hook's argument (`lares home tend --familiar <pet>` seats it). A fault names
 * its cause and the read that cures it, and the hook exits 0 (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { shimRunner } from "./lares-wake-core.mjs";
import { OM_BUDGET_MS, omContext, petOf, settle, spiritArgv } from "./lares-spirit-core.mjs";

try { readFileSync(0, "utf8"); } catch { /* An empty input changes nothing here. */ }
const pet = petOf(process.argv);
if (pet !== null) {
  let context;
  try { context = omContext(pet, await settle(shimRunner(import.meta.url)("spirit", spiritArgv("om", pet)), OM_BUDGET_MS)); }
  catch (err) { context = `Lares spirit om · ${pet}: the wake faulted (${err?.message ?? err}); read it by hand: lares spirit om ${pet}`; }
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}\n`);
}
process.exit(0);
