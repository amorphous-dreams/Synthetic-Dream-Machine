#!/usr/bin/env node
/*
 * PreCompact hands the compaction its instructions (Claude Code appends this stdout to them, so plain text, no envelope; the
 * harness truncates past 10,000 chars from the tail). Where a familiar wears this session, inside the house and with the vessel
 * up, the crossing runs in order: the card's #/open and #/voice read to the outgoing body (`om --source precompact`, which also
 * marks the crossing, so no slot write lands until the next wake), then the carry ask in fixed slots (pet, inherited hash, open
 * loops, tells, one body line; the record's #/carry-shape tunes it), a manual /compact's own instructions echoed, then the rows
 * in play and the memory index by `lar:` address (road `L35`, `L43`).
 * A fault names its cause and exits 0: a compaction never waits on the house (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { compactCarry, shimRunner } from "./lares-wake-core.mjs";
import {
  OM_BUDGET_MS, hookInput, houseSession, parseAnswer, petOf, precompactText, readState, sessionCounter, sessionPet, settle, shimRun, spiritArgv, updateState, vesselUp,
} from "./lares-spirit-core.mjs";

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { /* An empty input changes nothing here. */ }
const input = hookInput(raw);
let pet = null, shape = null, inherits = null, card = "";
try {
  const state = readState(sessionCounter(input));
  const worn = sessionPet(state, petOf(process.argv));
  if (worn !== null && houseSession(input, import.meta.url)) {
    pet = worn;
    const run = shimRun(import.meta.url);
    if (await vesselUp(run)) {
      const body = typeof input.session_id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.session_id) ? ["--body", input.session_id] : [];
      const answer = parseAnswer((await settle(run(spiritArgv("om", worn, "--source", "precompact", ...body)), OM_BUDGET_MS))?.stdout);
      if (answer?.ok === true) {
        shape = answer.data?.carryShape ?? null; inherits = answer.data?.inherits ?? null; card = String(answer.data?.text ?? "");
        // The precompact read claims the card's lease for this body; the counter keeps the epoch the next writes bear.
        if (Number.isSafeInteger(answer.data?.epoch)) updateState(sessionCounter(input), (cur) => ({ ...cur, epoch: answer.data.epoch }));
      }
    }
  }
} catch { /* The ask still leads, on the built-in shape. */ }
let carry = "";
try { carry = await compactCarry({ run: shimRunner(import.meta.url) }); } catch (err) { carry = `Lares compaction carry faulted (${err?.message ?? err}).`; }
process.stdout.write(`${precompactText({ pet, shape, inherits, card, instructions: input.custom_instructions, carry })}\n`);
process.exit(0);
