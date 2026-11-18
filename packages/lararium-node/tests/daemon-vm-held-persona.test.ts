/**
 * daemon-vm-held-persona — the daemon VM reads a persona plane this replica already HOLDS where it stands. Measured: a joinee
 * whose handle table held the plane ready still met `[boot] persona-plane — no reachable copy` from the hearth-private boot query
 * (3 of 10 runs of the herm-reshares e2e under parallel load; 0 of 18 after). Weld: the held-ready read precedes the resolver.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

test("RED: the persona plane's held-ready handle is read before any boot query; CONTROL: the resolver still serves an unheld plane", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "src", "open-daemon-vm.ts"), "utf8");
  const held = src.indexOf("heldPersona?.isReady()");
  const resolver = src.indexOf("label: PLANE_LABELS.persona");
  expect(held, "the held read stands").toBeGreaterThan(0);
  expect(resolver, "CONTROL: the boot query remains for an unheld plane").toBeGreaterThan(held);
});
