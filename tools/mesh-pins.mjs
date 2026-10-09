#!/usr/bin/env node
// mesh-pins — the docker mesh's peer pins, read off each vessel's own founded store, never copied by hand.
//
// Every bootstrap peer in docker-compose.mesh.yml names the gate key it knocks with (`<url>#<gate key hex>`), and
// an entry with no key is refused aloud. Each container founds its OWN vessel key at first boot, so the key a peer
// must pin exists only once that peer has founded. This tool reads it there — the vessel's own verifying key, the
// key its gates arm with — and writes `.mesh-pins.env`, which the compose file's pinned entries read.
//
//   node tools/mesh-pins.mjs           read the pins of every pinned service that stands; write .mesh-pins.env
//   node tools/mesh-pins.mjs --up      stand the mesh in PIN ORDER: each wave boots against the pins every earlier
//                                      wave founded (the order derives from the compose file's LAR_PEERS), then the
//                                      browser vessels stand against the full set
//   node tools/mesh-pins.mjs --up <service…>
//                                      stand only the named services and the peers they pin, in the same order
//   node tools/mesh-pins.mjs --print   print the pins as `NAME=<hex>` lines and write nothing
//
// The witnesses read the same file: `tools/herm-mesh-witness.mjs` pins each hop it pulls from it.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE = ["compose", "-f", join(ROOT, "docker-compose.mesh.yml")];
export const PINS_FILE = join(ROOT, ".mesh-pins.env");

/** The services a peer pins, and the variable each one's gate key rides in. */
export const PINNED = [
  { service: "herm-source",  name: "HERM_SOURCE_GATE" },
  { service: "herm-relay",   name: "HERM_RELAY_GATE" },
  { service: "herm-relay-2", name: "HERM_RELAY_2_GATE" },
  { service: "lararium-a",   name: "LARARIUM_A_GATE" },
  { service: "lararium-b",   name: "LARARIUM_B_GATE" },
];

const KEY_RE = /^[0-9a-f]{64}$/;
const READ_KEY = `import("/app/packages/lararium-node/dist/src/node-vessel-identity.js").then(async (m) => { process.stdout.write(await m.loadVesselVerifyingKey()); }).catch(() => process.exit(3));`;

/** One service's gate key off its own founded store, or null while it has not founded (or does not stand). */
export function gateKeyOf(service) {
  const r = spawnSync("docker", [...COMPOSE, "exec", "-T", service, "node", "-e", READ_KEY], { encoding: "utf8" });
  const key = (r.stdout ?? "").trim().toLowerCase();
  return r.status === 0 && KEY_RE.test(key) ? key : null;
}

/** Parse a pins file into `{ NAME: hex }`. An absent file reads empty. */
export function readPins(path = PINS_FILE) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=([0-9a-f]{64})$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** The pins file's text — one `NAME=<hex>` line per pin, in the services' order. */
export function pinsText(pins) {
  return PINNED.filter((p) => pins[p.name]).map((p) => `${p.name}=${pins[p.name]}`).join("\n") + "\n";
}

function readAll(prior) {
  const pins = { ...prior };
  for (const { service, name } of PINNED) {
    const key = gateKeyOf(service);
    if (key) pins[name] = key;
  }
  return pins;
}

async function waitForKey(service, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    const key = gateKeyOf(service);
    if (key) return key;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${service} never founded a vessel key — read its logs: docker compose -f docker-compose.mesh.yml logs ${service}`);
}

function up(services) {
  const args = [...COMPOSE, "--env-file", PINS_FILE, "up", "-d", ...services];
  execFileSync("docker", args, { stdio: "inherit" });
}

/**
 * The gate pins each compose service knocks with, read off its `LAR_PEERS` default and never listed by hand:
 * `{ service: [pin name…] }` for every service under `services:`. A service that pins nobody maps to `[]`.
 */
export function pinsNeeded(composeText) {
  const out = {};
  let inServices = false;
  let current = null;
  for (const line of composeText.split("\n")) {
    if (/^\S/.test(line)) { inServices = /^services:\s*$/.test(line); current = null; continue; }
    if (!inServices) continue;
    const head = /^  ([a-z0-9-]+):\s*$/.exec(line);
    if (head) { current = head[1]; out[current] = []; continue; }
    const peers = /^\s+LAR_PEERS:\s*"(.*)"\s*$/.exec(line);
    if (current && peers) for (const m of peers[1].matchAll(/#\$\{([A-Z0-9_]+)-?\}/g)) out[current].push(m[1]);
  }
  return out;
}

/**
 * The waves a pinned stand walks. Each wave holds the pinned services whose every pin an earlier wave read.
 * An empty `wanted` names every pinned service; a named service drags in the peers it pins. A name the compose
 * file lacks, a service that founds no pinned key, or a pin no service writes refuses the plan aloud.
 */
export function standPlan(needs, wanted = []) {
  const serviceOf = Object.fromEntries(PINNED.map((p) => [p.name, p.service]));
  for (const s of wanted) {
    if (!(s in needs)) throw new Error(`no compose service named "${s}"`);
    if (!PINNED.some((p) => p.service === s)) throw new Error(`"${s}" founds no gate key a peer pins`);
  }
  const want = new Set(wanted.length ? wanted : PINNED.map((p) => p.service));
  const queue = [...want];
  while (queue.length) {
    const s = queue.shift();
    for (const pin of needs[s] ?? []) {
      const peer = serviceOf[pin];
      if (!peer) throw new Error(`${s} pins ${pin}, which no pinned service writes`);
      if (!want.has(peer)) { want.add(peer); queue.push(peer); }
    }
  }
  const waves = [];
  const read = new Set();
  let left = PINNED.filter((p) => want.has(p.service));
  while (left.length) {
    const wave = left.filter((p) => (needs[p.service] ?? []).every((pin) => read.has(pin)));
    if (wave.length === 0) throw new Error(`the pins form a cycle: ${left.map((p) => p.service).join(", ")}`);
    waves.push(wave.map((p) => p.service));
    for (const p of wave) read.add(p.name);
    left = left.filter((p) => !wave.includes(p));
  }
  return waves;
}

/**
 * Stand the plan's waves, reading every key of a wave before the next one boots against it. `whole` then
 * stands every remaining service (the browser vessels) against the full pin set.
 */
export async function standInPinOrder(waves, { whole = false, stand = up, keyOf = waitForKey, write = (t) => writeFileSync(PINS_FILE, t) } = {}) {
  write("");
  const pins = {};
  for (const wave of waves) {
    stand(wave);
    for (const s of wave) pins[PINNED.find((p) => p.service === s).name] = await keyOf(s);
    write(pinsText(pins));
  }
  if (whole) stand([]);
  return pins;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === "--up") {
    const wanted = process.argv.slice(3);
    const waves = standPlan(pinsNeeded(readFileSync(join(ROOT, "docker-compose.mesh.yml"), "utf8")), wanted);
    const pins = await standInPinOrder(waves, { whole: wanted.length === 0 });
    process.stdout.write(`[mesh-pins] the mesh stands, pinned — ${PINS_FILE}\n${pinsText(pins)}`);
  } else {
    const pins = readAll(arg === "--print" ? {} : readPins());
    if (arg !== "--print") writeFileSync(PINS_FILE, pinsText(pins));
    process.stdout.write(pinsText(pins));
    if (Object.keys(pins).length === 0) { process.stderr.write("[mesh-pins] no pinned service stands founded\n"); process.exit(1); }
  }
}
