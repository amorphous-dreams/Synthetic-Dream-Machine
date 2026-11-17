#!/usr/bin/env node
/*
 * PreCompact hands the compaction the rows in play and the memory index, by `lar:` address (road `L35`, `L43`).
 * Claude Code appends a PreCompact hook's stdout to the compaction's own instructions, so this prints plain text and
 * no JSON envelope. The read rides the checkout's shim, as the wake's does; a fault names its cause and exits 0, so a
 * compaction never waits on the house and never stops for it.
 */
import { readFileSync } from "node:fs";
import { compactCarry, shimRunner } from "./lares-wake-core.mjs";

try { readFileSync(0, "utf8"); } catch { /* An empty input changes nothing here. */ }

process.stdout.write(`${await compactCarry({ run: shimRunner(import.meta.url) })}\n`);
process.exit(0);
