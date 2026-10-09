// mesh-pins.test.mjs — every bootstrap peer in the docker mesh is pinned to a gate key the pin tool writes, and the
// pins file round-trips. A bare `LAR_PEERS` entry is refused aloud at boot and never dialed, so a compose file
// carrying one stands a mesh that cannot peer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PINNED, readPins, pinsText, pinsNeeded, pinsOfPeers, standPlan, standInPinOrder } from "./mesh-pins.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every `LAR_PEERS` value in a compose text, and the entries in it that name no pin the tool writes. */
export function unpinnedPeers(composeText) {
  const names = new Set(PINNED.map((p) => p.name));
  const bad = [];
  for (const m of composeText.matchAll(/LAR_PEERS:\s*"([^"]*)"/g)) {
    // Strip an outer `${VAR-default}` override so the default the mesh stands with is what is read.
    const value = m[1].replace(/^\$\{[A-Z_]+-(.*)\}$/, "$1");
    for (const entry of value.split(",").map((e) => e.trim()).filter(Boolean)) {
      const pin = /#\$\{([A-Z0-9_]+)-?\}$/.exec(entry);
      if (!pin || !names.has(pin[1])) bad.push(entry);
    }
  }
  return bad;
}

test("CONTROL: the scanner flags a bare entry and one pinned to a name the tool never writes", () => {
  assert.deepEqual(unpinnedPeers('LAR_PEERS: "http://herm-source:8080"'), ["http://herm-source:8080"]);
  assert.deepEqual(unpinnedPeers('LAR_PEERS: "http://x:8080#${NOBODY_WRITES_THIS-}"'), ["http://x:8080#${NOBODY_WRITES_THIS-}"]);
  assert.deepEqual(unpinnedPeers('LAR_PEERS: "${LAR_A_PEERS-http://herm-source:8080#${HERM_SOURCE_GATE-}}"'), []);
});

test("RED: every bootstrap peer in docker-compose.mesh.yml is pinned to a gate key the pin tool writes", () => {
  const compose = readFileSync(join(ROOT, "docker-compose.mesh.yml"), "utf8");
  assert.ok((compose.match(/LAR_PEERS:/g) ?? []).length >= 4, "the scan reads the compose file's peers");
  assert.deepEqual(unpinnedPeers(compose), []);
});

test("the pins file round-trips, and a torn line names no pin", () => {
  const dir = mkdtempSync(join(tmpdir(), "mesh-pins-"));
  try {
    const pins = { HERM_SOURCE_GATE: "ab".repeat(32), HERM_RELAY_GATE: "cd".repeat(32) };
    const path = join(dir, "pins.env");
    writeFileSync(path, pinsText(pins) + "HERM_RELAY_2_GATE=not-a-key\n");
    assert.deepEqual(readPins(path), pins);
    assert.deepEqual(readPins(join(dir, "absent.env")), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the stand order derives from the compose file: a herm boots only after the herm it pins has founded", () => {
  const needs = pinsNeeded(readFileSync(join(ROOT, "docker-compose.mesh.yml"), "utf8"));
  assert.deepEqual(needs["herm-relay"], ["HERM_SOURCE_GATE"]);
  assert.deepEqual(needs["herm-relay-2"], ["HERM_RELAY_GATE"]);
  assert.deepEqual(standPlan(needs), [["herm-source"], ["herm-relay", "lararium-a", "lararium-b"], ["herm-relay-2"]]);
  // A scoped stand drags in exactly the peers it pins, and nothing a herm witness never reads.
  assert.deepEqual(standPlan(needs, ["herm-relay-2"]), [["herm-source"], ["herm-relay"], ["herm-relay-2"]]);
  assert.deepEqual(standPlan(needs, ["herm-source", "herm-relay", "herm-relay-2"]), [["herm-source"], ["herm-relay"], ["herm-relay-2"]]);
});

test("CONTROL: a plan over an unknown service, an unpinned service, a pin nobody writes, or a cycle refuses aloud", () => {
  const needs = { "herm-source": [], "herm-relay": ["HERM_SOURCE_GATE"], "browser-a": [] };
  assert.throws(() => standPlan(needs, ["herm-ghost"]), /no compose service named "herm-ghost"/);
  assert.throws(() => standPlan(needs, ["browser-a"]), /founds no gate key/);
  assert.throws(() => standPlan({ "herm-source": ["NOBODY_GATE"] }, ["herm-source"]), /which no pinned service writes/);
  assert.throws(() => standPlan({ "herm-source": ["HERM_RELAY_GATE"], "herm-relay": ["HERM_SOURCE_GATE"] }, ["herm-relay"]), /cycle/);
});

test("a stand reads every key of a wave before the next wave boots, and only a whole stand raises the rest", async () => {
  const acts = [];
  const writes = [];
  const pins = await standInPinOrder([["herm-source"], ["herm-relay"]], {
    stand: (svcs) => acts.push(`up ${svcs.join(" ") || "*"}`),
    keyOf: async (s) => { acts.push(`key ${s}`); return s === "herm-source" ? "ab".repeat(32) : "cd".repeat(32); },
    write: (t) => writes.push(t),
  });
  assert.deepEqual(acts, ["up herm-source", "key herm-source", "up herm-relay", "key herm-relay"]);
  assert.deepEqual(pins, { HERM_SOURCE_GATE: "ab".repeat(32), HERM_RELAY_GATE: "cd".repeat(32) });
  assert.equal(writes[0], "", "a stand clears the prior pins before the first wave");
  assert.equal(writes[1], `HERM_SOURCE_GATE=${"ab".repeat(32)}\n`, "the relay boots against the source's written pin");
  const whole = [];
  await standInPinOrder([["herm-source"]], { whole: true, stand: (s) => whole.push(s.length ? s.join(" ") : "*"), keyOf: async () => "ef".repeat(32), write: () => {} });
  assert.deepEqual(whole, ["herm-source", "*"]);
});

/** A compose text with one service whose LAR_PEERS line reads as given. */
const oneService = (peersLine) => `services:\n  herm-relay:\n    image: node:24-slim\n    environment:\n${peersLine}\n  herm-source:\n    image: node:24-slim\n`;

test("CONTROL: the one spelling the reader reads plans its pins, an override reads as its default, and a service with no LAR_PEERS pins nobody", () => {
  assert.deepEqual(pinsNeeded(oneService('      LAR_PEERS: "http://herm-source:8080#${HERM_SOURCE_GATE-}"')), { "herm-relay": ["HERM_SOURCE_GATE"], "herm-source": [] });
  assert.deepEqual(pinsOfPeers("${LAR_A_PEERS-http://herm-source:8080#${HERM_SOURCE_GATE-},http://herm-relay:8080#${HERM_RELAY_GATE}}"), ["HERM_SOURCE_GATE", "HERM_RELAY_GATE"]);
  assert.deepEqual(pinsOfPeers("${LAR_A_PEERS-}"), [], "an override whose default stands empty is a lone vessel, pinning nobody");
  assert.deepEqual(pinsNeeded(`# LAR_PEERS: 'a column-0 comment never reads as a spelling'\n${oneService('      # LAR_PEERS: bare, inside a comment\n      LAR_PEERS: "http://herm-source:8080#${HERM_SOURCE_GATE-}"')}`)["herm-relay"], ["HERM_SOURCE_GATE"]);
});

test("RED: a LAR_PEERS spelling the reader cannot read throws, and never plans the service as pinning nobody", () => {
  for (const line of [
    "      LAR_PEERS: 'http://herm-source:8080#${HERM_SOURCE_GATE-}'",
    "      LAR_PEERS: http://herm-source:8080#${HERM_SOURCE_GATE-}",
    "      LAR_PEERS: >-\n        http://herm-source:8080#${HERM_SOURCE_GATE-}",
    "      - LAR_PEERS=http://herm-source:8080#${HERM_SOURCE_GATE-}",
    '      LAR_PEERS: "http://herm-source:8080#${HERM_SOURCE_GATE-}" # trailing note',
  ]) assert.throws(() => pinsNeeded(oneService(line)), /spelling this reader cannot read/, line);
  assert.throws(() => pinsNeeded(oneService('      LAR_PEERS: "http://herm-source:8080"')), /carries no pin/);
  assert.throws(() => pinsNeeded(oneService('      LAR_PEERS: "${LAR_A_PEERS-http://herm-source:8080}"')), /carries no pin/);
});

/** The lines in a text that stand the docker mesh with a bare `compose … up`, outside the pin order. */
export function bareMeshStands(text) {
  return text.split("\n").filter((l) => /docker compose -f docker-compose\.mesh\.yml\b[^\n]*\bup\b/.test(l));
}

test("no tool documents a bare compose stand of the mesh: every documented stand walks the pin order", () => {
  assert.deepEqual(bareMeshStands("# Usage: docker compose -f docker-compose.mesh.yml up -d && ./x.sh"), ["# Usage: docker compose -f docker-compose.mesh.yml up -d && ./x.sh"], "CONTROL: the scan reads a bare stand");
  assert.deepEqual(bareMeshStands("# Run: node tools/mesh-pins.mjs --up herm-source"), [], "CONTROL: a pinned stand reads clean");
  const tools = join(ROOT, "tools");
  const files = readdirSync(tools).filter((f) => /\.(sh|mjs)$/.test(f) && !/\.test\.mjs$/.test(f));
  assert.ok(files.includes("herm-mesh-witness.sh") && files.includes("herm-mesh-partition.mjs"), "the scan reads the witness drivers");
  const found = files.flatMap((f) => bareMeshStands(readFileSync(join(tools, f), "utf8")).map((l) => `${f}: ${l.trim()}`));
  assert.deepEqual(found, []);
});
