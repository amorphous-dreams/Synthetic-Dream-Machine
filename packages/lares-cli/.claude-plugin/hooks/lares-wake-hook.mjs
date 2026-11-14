#!/usr/bin/env node
/*
 * SessionStart observes the container through the checkout's shim, reads the worn face's memory index through the
 * same shim, and carries both into the wake beside the homes line (road `L43`). The home reading retains its own CLI
 * route. No read acts to stand a vessel. What the wake says lives in `lares-wake-core.mjs`.
 */
import { readFileSync } from "node:fs";
import { shimRunner, wake } from "./lares-wake-core.mjs";

// The harness names why the session starts (`startup`, `resume`, `clear`, `compact`, `fork`); after a compaction the
// wake also carries the rows in play.
let source = "";
try { source = String(JSON.parse(readFileSync(0, "utf8"))?.source ?? ""); } catch { /* An empty input carries no source. */ }

const additionalContext = await wake({ run: shimRunner(import.meta.url), source });

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }) + "\n",
);
process.exit(0);
