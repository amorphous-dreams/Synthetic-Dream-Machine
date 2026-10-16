/**
 * crossing-daemon — the NODE half of the containerized browser↔node crossing (the civic-protocol transport+auth+sync
 * gate, across a real container boundary). It stands a sovereign SEALED GATE (`crossing-roles.standCrossingDaemon`): a
 * Noise IK flight, a sealed presentation, a signed verdict. A face the Nexus admitted is seated onto an Automerge Repo
 * that shares a seeded doc only through a seated session; every other dial draws silence.
 *
 * Handshake (shared volume): the daemon publishes `<shared>/crossing.json` = {pin, docUrl, port}. The client reads it,
 * crosses and syncs. Both halves derive the Nexus, its quorum and the face from one label, so no key crosses the volume.
 *
 * Env:
 *   LAR_CROSSING_PORT    ws listen port         (default 8080)
 *   LAR_CROSSING_SHARED  shared dir/volume      (required — the file handshake)
 *   LAR_CROSSING_GREET   the doc's seeded text   (default "the DreamNet breathes")
 *   LAR_CROSSING_ADMIT   who the gate admits     (default from-file):
 *                          from-file → admit the crossing face (X1 happy path)
 *                          none      → hold no Nexus root: admit NOBODY (X2 anon-denial)
 *
 * Meme: lar:///ha.ka.ba/lararium/node/browser-crossing
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { standCrossingDaemon } from "./crossing-roles.js";

const envOf = (k: string, d = ""): string => process.env[k] ?? d;

async function main(): Promise<void> {
  const shared = envOf("LAR_CROSSING_SHARED");
  if (!shared) throw new Error("LAR_CROSSING_SHARED required");
  mkdirSync(shared, { recursive: true });
  const admit = envOf("LAR_CROSSING_ADMIT", "from-file") === "none" ? "none" : "from-file";
  const daemon = await standCrossingDaemon({
    port: Number.parseInt(envOf("LAR_CROSSING_PORT", "8080"), 10), greet: envOf("LAR_CROSSING_GREET", "the DreamNet breathes"), admit,
    log: (line) => console.log(line),
  });
  writeFileSync(join(shared, "crossing.json"), JSON.stringify(daemon.coordinates));
  console.log(`[crossing-daemon] armed ws://0.0.0.0:${String(daemon.coordinates.port)}${daemon.coordinates.pin.route}  doc=${daemon.coordinates.docUrl.slice(0, 24)}…`);
  console.log("[crossing-daemon] serving — awaiting the admitted face's crossing");
  void daemon.sawReply.then(() => writeFileSync(join(shared, "daemon-saw-reply"), "ok"));
  await new Promise<void>(() => { /* serve until the container stops */ });
}

main().catch((e) => { console.error("[crossing-daemon] FATAL:", e); process.exit(1); });
