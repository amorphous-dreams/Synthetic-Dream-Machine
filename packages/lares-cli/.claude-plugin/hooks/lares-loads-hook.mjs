#!/usr/bin/env node
/**
 * lares-loads-hook — Claude's `InstructionsLoaded` hook: each instruction file a session loads lands
 * as one line in the load log, which `lares repo verify` and `lares home verify` read.
 *
 * The hook observes and decides nothing: Claude discards its exit and its output, and any fault here
 * passes silently so a session never waits on the log. The log rests in the operator's own state
 * (`$XDG_STATE_HOME/lares/reality-tunnel/loads.jsonl`), never under a scratch `LAR_ROOT`.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { input += c; });
process.stdin.on("end", () => {
  try {
    const e = JSON.parse(input);
    const dir = join(process.env.XDG_STATE_HOME?.trim() || join(homedir(), ".local", "state"), "lares", "reality-tunnel");
    mkdirSync(dir, { recursive: true });
    const line = {
      session_id: e.session_id, file_path: e.file_path, load_reason: e.load_reason,
      memory_type: e.memory_type, parent_file_path: e.parent_file_path, cwd: e.cwd,
    };
    appendFileSync(join(dir, "loads.jsonl"), `${JSON.stringify(line)}\n`);
  } catch { /* the log observes; a fault passes */ }
  process.exit(0);
});
