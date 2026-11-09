#!/usr/bin/env node
/*
 * SessionStart observes the container through the checkout's shim and carries its answer into the wake.
 * The home reading retains its own CLI route. Neither observation acts to stand a vessel.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

try { readFileSync(0, "utf8"); } catch { /* An empty input carries no additional context. */ }

const hookDir = dirname(fileURLToPath(import.meta.url));
const laresBin = join(hookDir, "..", "..", "bin", "lares.mjs");
const shim = join(hookDir, "..", "..", "..", "..", "tools", "lares-container.sh");
const down = "vessel down; stand it with tools/lares-container.sh up";

// Kill the process group on timeout so a compose child cannot hold the hook's pipes open.
function observe() {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const child = spawn(shim, ["vessel", "stand", "--observe", "--json"], {
      detached: true, stdio: ["ignore", "pipe", "ignore"],
    });
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* The process already left. */ }
      child.stdout.destroy();
      child.unref();
      finish("vessel observation timed out; stand it with tools/lares-container.sh up");
    }, 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.on("error", () => finish(down));
    child.on("close", () => {
      try {
        const frame = JSON.parse(output);
        finish(frame?.data?.node?.up === true ? JSON.stringify(frame) : down);
      } catch { finish(down); }
    });
  });
}

const frame = await observe();

let homes = "lares home read produced no output";
try {
  const h = spawnSync(process.execPath, [laresBin, "home", "read", "--brief"], { encoding: "utf8", timeout: 4_000 });
  if (typeof h.stdout === "string" && h.stdout.trim()) homes = h.stdout.trim();
} catch { /* leave the fallback line */ }

const additionalContext =
  "Lares live wake (SessionStart) — what is true right now " +
  "(the canonical frame is already loaded from CLAUDE.md): " + frame + "\nLares homes: " + homes;

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } }) + "\n",
);
