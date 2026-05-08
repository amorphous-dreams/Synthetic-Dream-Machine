/**
 * `lares status` — quick health snapshot for the lararium node.
 *
 * Probes:
 *   - genesis/social-bootstrap.json presence (init has run)
 *   - .lararium/ storage directory presence + size hint
 *   - whether the LAR_PORT (default 8080) is in use (a node process likely runs)
 *
 * No vm boot — pure local inspection. This command stays cheap so operators
 * can run it freely during a session.
 */

import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createConnection } from "node:net";
import { REPO_ROOT } from "../spawn.js";
import type { ParsedArgs } from "../parse-args.js";

function dirSizeHint(dir: string): string {
  if (!existsSync(dir)) return "(absent)";
  let bytes = 0;
  let count = 0;
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else { try { bytes += statSync(full).size; count++; } catch { /* race; skip */ } }
    }
  };
  try { walk(dir); } catch { return "(unreadable)"; }
  return `${count} files, ${(bytes / 1024).toFixed(1)} KiB`;
}

function probePort(port: number, host = "127.0.0.1", timeoutMs = 200): Promise<boolean> {
  return new Promise((resolveP) => {
    const sock = createConnection({ port, host });
    const done = (open: boolean): void => {
      sock.removeAllListeners();
      sock.destroy();
      resolveP(open);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("error",   () => done(false));
    sock.once("timeout", () => done(false));
  });
}

export async function cmdStatus(_args: ParsedArgs): Promise<number> {
  const nodePkg   = join(REPO_ROOT, "packages", "lararium-node");
  const storage   = join(nodePkg, ".lararium");
  const bootstrap = join(nodePkg, "genesis", "social-bootstrap.json");
  const portRaw   = process.env["LAR_PORT"] ?? "8080";
  const port      = Number(portRaw);

  console.log("lares status");
  console.log(`  bootstrap:   ${existsSync(bootstrap) ? "present" : "absent (run `lares init`)"}`);
  console.log(`  storage:     ${dirSizeHint(storage)}`);
  console.log(`  port ${port}:  ${(await probePort(port)) ? "in use (node likely running)" : "free"}`);
  return 0;
}
