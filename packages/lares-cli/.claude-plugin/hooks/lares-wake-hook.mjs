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
const cure = "stand it with tools/lares-container.sh up";
// Each cause reads by its own name: only the vessel's own answer says "down".
const unobserved = (why) => `vessel unobserved: ${why}; read it with tools/lares-container.sh vessel stand --observe --json, or ${cure}`;

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
      finish(`vessel observation timed out; ${cure}`);
    }, 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.on("error", (err) => finish(unobserved(`the shim did not start (${err?.code ?? err?.message ?? "spawn error"})`)));
    child.on("close", (code, signal) => {
      if (!output.trim()) { finish(unobserved(`the shim exited ${code ?? signal} with no answer`)); return; }
      let frame;
      try { frame = JSON.parse(output); }
      catch { finish(unobserved(`the shim's answer did not parse (exit ${code ?? signal})`)); return; }
      finish(frame?.data?.node?.up === true ? JSON.stringify(frame) : `vessel down (the observation answered node.up ${JSON.stringify(frame?.data?.node?.up ?? null)}); ${cure}`);
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
