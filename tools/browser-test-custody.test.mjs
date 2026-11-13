// browser-test-custody — the browser harness door types the SAME published test route the node doors use, and
// answers only on a harness's loopback origin. The probe module ships in the harness image (`tools/` does not),
// so it holds its own copy of the route; this test welds the two copies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";

const probe = readFileSync(new URL("../packages/lararium-node/probes/browser-test-custody.ts", import.meta.url), "utf8");

test("the probe's test route equals the published one", () => {
  const held = probe.match(/export const TEST_PASSPHRASE = "([^"]+)";/);
  assert.ok(held, "the probe names its test route");
  assert.equal(held[1], TEST_PASSPHRASE);
});

test("the door refuses any origin but the harness's loopback, by name", () => {
  assert.match(probe, /new Set\(\["localhost", "127\.0\.0\.1", "\[::1\]", "::1"\]\)/);
  assert.match(probe, /TestDoorRefusal/);
});
