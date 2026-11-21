#!/usr/bin/env node
/*
 * SessionStart observes the container through the checkout's shim, reads the worn face's rows in play and memory index
 * through the same shim, and carries them into the wake beside the homes line (road `L43`). The home reading retains its own CLI
 * route. No read acts to stand a vessel. What the wake says lives in `lares-wake-core.mjs`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { keepWorkspaceOf, shimRunner, wake, workspaceBindsOf } from "./lares-wake-core.mjs";

// The harness names why the session starts (`startup`, `resume`, `clear`, `compact`, `fork`); every wake leads with the
// rows in play, whatever the source.
let source = "";
try { source = String(JSON.parse(readFileSync(0, "utf8"))?.source ?? ""); } catch { /* An empty input carries no source. */ }

// The keep workspace the house config names: the environment, else the operator's surface env file (as the shim reads both).
let surface = null;
try { surface = readFileSync(join(process.env.HOME || homedir(), ".lares", "lares-surface.env"), "utf8"); } catch { /* no surface file */ }
const keepWorkspace = keepWorkspaceOf(process.env, surface);

// The bound workspaces, and whether each stands in a work tree (its own `.git`, or an enclosing repo): the VCS answers it.
const workspaces = workspaceBindsOf(process.env, surface);
const treeStands = (dir) => spawnSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], { stdio: "ignore", timeout: 2000 }).status === 0;

const additionalContext = await wake({ run: shimRunner(import.meta.url), source, keepWorkspace, workspaces, treeStands });

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }) + "\n",
);
process.exit(0);
