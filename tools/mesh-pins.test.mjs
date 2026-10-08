// mesh-pins.test.mjs — every bootstrap peer in the docker mesh is pinned to a gate key the pin tool writes, and the
// pins file round-trips. A bare `LAR_PEERS` entry is refused aloud at boot and never dialed, so a compose file
// carrying one stands a mesh that cannot peer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PINNED, readPins, pinsText } from "./mesh-pins.mjs";

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
