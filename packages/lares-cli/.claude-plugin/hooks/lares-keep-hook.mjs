#!/usr/bin/env node
/*
 * SessionEnd keeps the house: each Claude Code session's end runs `lares rite keep --if-due`, the keep that carries the house
 * and this device's sessions into the operator's repo under a keep lei (lar:///ha.ka.ba/kahua/memory/project/cross-and-keep).
 *
 * A SessionEnd hook holds a short budget and a keep cuts, commits and pushes, so the hook STARTS the keep and leaves: the
 * keep runs on in its own session, and its lines land in the state home's log (`$XDG_STATE_HOME/lares/keep-hook.log`, the
 * last run alone). A keep that refuses (no return left on the lei, the vessel down, a secret-shaped string) writes its reading
 * there, and the next wake names the lei's count. `--if-due` keeps nothing where neither the house nor the sessions moved,
 * and where the house config names no keep workspace. A fault names its cause and exits 0: a session's end never stops for
 * the house.
 */
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let reason = "";
try { reason = String(JSON.parse(readFileSync(0, "utf8")).reason ?? ""); } catch { /* An empty input changes nothing here. */ }

const laresBin = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "lares.mjs");
const stateHome = process.env.XDG_STATE_HOME?.trim() || join(process.env.HOME?.trim() || homedir(), ".local", "state");
const logPath = join(stateHome, "lares", "keep-hook.log");

try {
  mkdirSync(dirname(logPath), { recursive: true });
  const log = openSync(logPath, "w");
  try {
    if (!existsSync(laresBin)) writeSync(log, `keep hook: ${laresBin} stands absent; nothing kept\n`);
    else {
      writeSync(log, `keep hook: session end${reason ? ` (${reason})` : ""}; lares rite keep --if-due\n`);
      // Its own session, its output on the log: the keep outlives this hook and the terminal that closes behind it.
      spawn(process.execPath, [laresBin, "rite", "keep", "--if-due", "--no-json"], { detached: true, stdio: ["ignore", log, log] }).unref();
    }
  } finally { closeSync(log); }
} catch { /* No log, no keep: `lares rite keep` keeps by hand, and the wake names what the lei holds. */ }
process.exit(0);
