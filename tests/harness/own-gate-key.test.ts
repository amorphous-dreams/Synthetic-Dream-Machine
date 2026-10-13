/**
 * harness/own-gate-key — a joiner dials the HEARTH's gate key, never the first key a boot log names.
 *
 * A vessel that stands a carriage crossroads prints two keys: the relay's under `[herm]   gate key:` while it rests
 * at the floor, and its own under `[lararium] gate key:` once the unlock composes the hearth. The log lines below
 * keep the order and the spelling a staged founder's log carries.
 */
import { describe, test, expect } from "vitest";
import { ownGateKey } from "./instance.js";

const RELAY_KEY  = "2868ea9823a13a3edbc4c3dbcb94fd4e0a2b1d1fe0e026d16139239dac4c3fe3";
const HEARTH_KEY = "57fef7a8190ed6f729755a6a7e74cc0173edc5cd0c881f552456294676500423";

const FLOOR_THEN_HEARTH = [
  "[herm] phase → live",
  "[herm] carriage crossroads (Socket B) — hearths dial this to carry sealed cad bodies:",
  `[herm]   gate key: ${RELAY_KEY}`,
  "[custody] unlocked: slot 03e2d54c919ae4f2ecbfadb17fcbd8dd opened the vessel key",
  "[lararium] phase → live",
  `[lararium] gate key: ${HEARTH_KEY}`,
  `[lararium]   http://localhost:46291/?relay=ws://localhost:46291/ws&gate=${HEARTH_KEY}   (loopback)`,
].join("\n");

describe("ownGateKey — the hearth's own line", () => {
  test("a founder that stands a relay: the reader names the hearth's key, past the relay's earlier line", () => {
    // CONTROL: the first `gate key:` in this log belongs to the relay.
    expect(/gate key: ([0-9a-f]{64})/.exec(FLOOR_THEN_HEARTH)?.[1]).toBe(RELAY_KEY);
    expect(ownGateKey(FLOOR_THEN_HEARTH)).toBe(HEARTH_KEY);
  });

  test("a founder with no relay: the one line it prints", () => {
    expect(ownGateKey(`[lararium] phase → live\n[lararium] gate key: ${HEARTH_KEY}\n`)).toBe(HEARTH_KEY);
  });

  test("a floor that never composed a hearth names no key of its own", () => {
    expect(ownGateKey(`[herm] phase → live\n[herm]   gate key: ${RELAY_KEY}\n`)).toBeNull();
  });
});
