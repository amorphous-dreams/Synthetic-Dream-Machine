#!/usr/bin/env node
/*
 * UserPromptSubmit: the session's title, read each prompt and compared with the one the counter last saw, a local file read
 * and no vessel. /rename fires no event of its own, so this hook notices it. Where the session holds a pet, a changed title
 * naming another spirit surfaces once as that familiar's rename, never a retarget, with the alias act; where it holds none (a
 * fresh session), the title names its own familiar and the read that wakes it, never the seated default's rename. The counter
 * keeps the new title. The
 * automatic rename (move the record, relink, leave the old title as a forwarder) waits on a rename door the house holds none of
 * yet. Any fault exits 0 (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum).
 */
import { readFileSync } from "node:fs";
import { hookInput, houseSession, readState, sessionCounter, titleLine, updateState } from "./lares-spirit-core.mjs";

try {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { /* An empty input notices nothing. */ }
  const input = hookInput(raw);
  const title = typeof input.session_title === "string" && input.session_title.trim() !== "" ? input.session_title : null;
  const path = sessionCounter(input);
  if (title !== null && path !== null && houseSession(input, import.meta.url)) {
    const held = readState(path);
    if (held.title !== title) {
      updateState(path, (cur) => ({ ...cur, title }));
      const line = titleLine(held, title);
      if (line !== null) process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: line } })}\n`);
    }
  }
} catch { /* A rename read that faults changes nothing. */ }
process.exit(0);
