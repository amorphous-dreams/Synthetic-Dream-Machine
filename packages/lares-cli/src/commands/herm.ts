/**
 * `lares herm` — stand a HERM (Lares Viales), the wiki-less wayfarer that STANDS the carriage crossroads
 * (Socket B) a family's hearths dial to carry sealed cad bodies between each other.
 *
 * This is a stand-up verb, NOT a fork of the boot: it spawns the SAME `main.js` the `lares vessel stand` path runs,
 * routed to `openNodeHerm` via `--recipe herm`, with the carriage relay standing when a relay port rides the
 * config (`--relay-port` / `LAR_HERM_RELAY_PORT`). Pi-deployable: a gate seed + a relay port + the http
 * FLOW-map read-face port. The relay gate rests in its own random, durable identity-home row.
 * `lares herm relay-rotate` replaces it and prints the pin hearths must adopt after restart.
 *
 * On a live stand it prints the crossroads' dial URL(s) + gate pubkey (echoed from the node's own attestation,
 * the single source of truth for the durable relay row) so the operator can hand a hearth what to dial.
 */

import { engineHeldByHost } from "../port-control.js";
import { existsSync, mkdirSync, openSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { repoRoot } from "@lararium/mesh/node";
import { rotateRelayGateSeed, fatalLine } from "@lararium/node";
import { larRoot, larBootstrapPath, larDataDir, larCasDir } from "../env.js";
import { emit } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function cmdHerm(args: ParsedArgs): Promise<number> {
  const port      = Number(args.options["port"]       ?? process.env["LAR_PORT"] ?? "8080");     // http FLOW-map read-face
  const relayPort = Number(args.options["relay-port"] ?? process.env["LAR_HERM_RELAY_PORT"] ?? "8090"); // Socket B crossroads
  if (args.positional[0] === "relay-rotate") {
    const gateKey = rotateRelayGateSeed();
    emit(args, { ok: true, data: { gateKey }, human: () => console.log(`relay gate rotated — hand hearths the new pin ${gateKey}; restart the herm to stand it`) });
    return 0;
  }
  const root      = larRoot();
  const bootstrap = larBootstrapPath();
  const dataDir   = larDataDir();

  const distMain = join(repoRoot, "packages", "lararium-node", "dist", "src", "main.js");
  const preflight: string | null =
    // Where the host holds the engine this door spawns nothing: a herm stands as the container's own service.
    engineHeldByHost()      ? "the host holds the engine — stand a herm from the host: docker compose -f docker-compose.surface.yml --profile herm up -d herm" :
    !existsSync(distMain)   ? "node dist not built — run `pnpm -r build`, then `lares herm`" :
    !existsSync(bootstrap)  ? "no bootstrap — run `lares vessel found` (or point LAR_ROOT at an initialized instance)" :
    null;

  const dialHint: string[] = [];
  let live = false;
  let note = "";

  if (preflight) {
    note = preflight;
  } else {
    mkdirSync(dataDir, { recursive: true });
    const log = join(dataDir, "herm-serve.log");
    const startOffset = existsSync(log) ? statSync(log).size : 0;
    const logFd = openSync(log, "a");
    const child = spawn("node", [distMain, "--recipe", "herm", "--port", String(port), "--root", root], {
      cwd: join(repoRoot, "packages", "lararium-node"),
      detached: true,
      windowsHide: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        LAR_CAS: larCasDir(),
        LAR_HERM_RELAY_PORT: String(relayPort),
      },
    });
    child.unref();

    const readAttestation = (): string => {
      try { return readFileSync(log, "utf8").slice(startOffset); } catch { return ""; }
    };
    // Self-attested readiness (no web2 /health probe): the node writes `vessel-ready` on a live stand, `fatal:` on a
    // boot fault. Adaptive window — extend while the log grows, fail only on a genuine stall or the ceiling.
    // This door's own liveness patience (adaptive idle window + outer ceiling) — never a
    // safety verdict — reads a monotonic clock, so an adversarial or operator wall-clock
    // set-back/set-forward changes neither how long this wait actually ran nor when it gives up.
    const IDLE_MS = 30_000;
    const hardCap = performance.now() + 180_000;
    let idleDeadline = performance.now() + IDLE_MS;
    let seenLen = 0;
    let phase: "starting" | "ready" | "fault" = "starting";
    while (performance.now() < idleDeadline && performance.now() < hardCap) {
      const tail = readAttestation();
      if (/fatal:/.test(tail)) { phase = "fault"; break; }
      if (tail.includes("vessel-ready")) { phase = "ready"; break; }
      if (tail.length > seenLen) { seenLen = tail.length; idleDeadline = performance.now() + IDLE_MS; }
      await sleep(200);
    }
    live = phase === "ready";
    note = phase === "ready"
      ? `started detached (pid ${child.pid ?? "?"}); attested vessel-ready`
      : phase === "fault"
        // A boot fault keeps its own voice: the node's `fatal:` line names the fault and any cure.
        ? `started then attested a boot fault: ${fatalLine(readAttestation()) ?? "see " + log}`
        : `starting detached (pid ${child.pid ?? "?"}); boot stalled before vessel-ready — see ${log}`;

    // Echo the node's OWN carriage crossroads lines (dial URLs + gate key) — the node computes the gate key from the
    // durable row (single source of truth), so the printed pin matches the relay without a
    // second derivation here. A short settle lets the carriage line land after vessel-ready.
    if (live) {
      await sleep(400);
      for (const line of readAttestation().split("\n")) {
        const m = /\[herm]\s+(dial → .*|gate key: .*)/.exec(line);
        if (m) dialHint.push(m[1]!.trim());
      }
    }
  }

  const ok = live;
  emit(args, {
    ok,
    data: {
      herm: { live, port, relayPort, note },
      relay: { port: relayPort, gateKey: dialHint.find((d) => d.startsWith("gate key:"))?.slice(9).trim() ?? null, dial: dialHint },
      root,
      bootstrap: existsSync(bootstrap) ? "present" : "absent",
      timestamp: new Date().toISOString(),
    },
    human: () => {
      console.log("lares herm — the carriage crossroads (Lares Viales)");
      console.log(`  herm:        ${live ? "live" : "down"} on read-face :${port}${note ? ` — ${note}` : ""}`);
      console.log(`  relay port:  ${relayPort}  (Socket B — hearths dial this to carry sealed cad bodies)`);
      if (dialHint.length > 0) {
        console.log("  hand a hearth one of these to dial:");
        for (const d of dialHint) console.log(`    ${d}`);
      }
      console.log(`  root:        ${root}`);
      console.log(`  bootstrap:   ${existsSync(bootstrap) ? "present" : "absent"}`);
    },
  });

  return 0; // the stand-up never hard-fails the session; `ok` carries the verdict.
}
