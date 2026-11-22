#!/usr/bin/env node
/**
 * wing-of — resolve the per-project WING a transcript belongs to, through the ONE TS wing law
 * (packages/lares-cli/src/wing-law.ts: recorded cwd -> wingFromDir). A script that files a session calls
 * this, so no second derivation forks one session's drawers across two wings. It rides tools/ rather than
 * the operator's `lares` front door: a helper for scripts, never a verb a person types.
 *
 *   node tools/wing-of.mjs <transcript.jsonl>
 *
 * Prints the bare wing slug on stdout (exit 0). A transcript that is no file exits 3 (`not-found`), and one
 * that records no cwd (nor its first sibling) exits 3 too, FAIL LOUD so the caller's own fallback ladder
 * (payload cwd -> PWD) takes over: never a guessed wing. No transcript named exits 2 (usage).
 *
 * Reads the built `packages/lares-cli/dist`; build first (`pnpm --filter @lares/cli build`).
 */
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const transcript = process.argv[2] ?? "";
if (!transcript) {
  console.error("usage: node tools/wing-of.mjs <transcript.jsonl>");
  process.exit(2);
}
try {
  if (!statSync(transcript).isFile()) throw new Error("not a file");
} catch {
  console.error(`wing-of: no transcript at ${transcript}`);
  process.exit(3);
}
const { resolveTranscriptWing } = await import(pathToFileURL(join(root, "packages", "lares-cli", "dist", "src", "wing-law.js")).href);
const wing = resolveTranscriptWing(transcript);
if (!wing) {
  console.error(`wing-of: no recorded cwd in ${transcript} (or its first sibling), cannot derive a wing`);
  process.exit(3);
}
console.log(wing);
