/**
 * gate-dial-fixture — the node package's door to THE ONE HELPER a test dials a sealed gate through.
 *
 * The platform-blind half lives in mesh (`packages/lararium-mesh/tests/gate-dial-fixture.ts`): the real dialer, a real
 * gate over a world, and the rig that seats channels for the adapter. A node suite that stands a live gate over a
 * socket uses `gated-node-rig.ts` (a node's sync route) or `flow-floor-rig.ts` (the flow's floor gates).
 *
 * No double of a gate, a proving shore or a dialer played by hand stands here.
 *
 * Test support. No source file imports it.
 */
export * from "../../lararium-mesh/tests/gate-dial-fixture.js";
