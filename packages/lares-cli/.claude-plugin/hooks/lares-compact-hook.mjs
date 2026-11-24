#!/usr/bin/env node
/*
 * PreCompact hands the compaction the rows in play and the memory index, by `lar:` address (road `L35`, `L43`), and where a
 * familiar rides as this hook's argument, asks the summary to end with that familiar's closing section (`compactionAsk`), which the PostCompact hook lands
 * (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum). Claude Code appends a PreCompact hook's stdout to the compaction's own
 * instructions, so this prints plain text and no JSON envelope. The read rides the checkout's shim, as the wake's does; a fault
 * names its cause and exits 0, so a compaction never waits on the house and never stops for it.
 */
import { readFileSync } from "node:fs";
import { compactCarry, shimRunner } from "./lares-wake-core.mjs";
import { petOf, compactionAsk } from "./lares-spirit-core.mjs";

try { readFileSync(0, "utf8"); } catch { /* An empty input changes nothing here. */ }

const pet = petOf(process.argv);
let carry = "";
try { carry = await compactCarry({ run: shimRunner(import.meta.url) }); } catch (err) { carry = `Lares compaction carry faulted (${err?.message ?? err}).`; }
process.stdout.write(`${carry}${pet === null ? "" : `\n${compactionAsk(pet)}`}\n`);
process.exit(0);
