/**
 * gate-dial-fixture — the node package's door to THE ONE HELPER a test dials a sealed gate through.
 *
 * The platform-blind half lives in mesh (`packages/lararium-mesh/tests/gate-dial-fixture.ts`): the real dialer, a real
 * gate over a world, and the rig that seats channels for the adapter. A node suite that stands a live gate over a
 * socket uses `gated-node-rig.ts` (a node's sync route) or `oracle-floor-rig.ts` (the oracle's floor gates).
 *
 * The old-wire doubles this file once stood (a `DaemonAuthGate` over a WebSocket server, a proving shore, a dialer and
 * a gate played by hand over the challenge/auth frames) retired with that wire.
 *
 * Test support. No source file imports it.
 */
export * from "../../lararium-mesh/tests/gate-dial-fixture.js";
