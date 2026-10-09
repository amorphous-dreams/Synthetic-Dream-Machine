/**
 * open-node-vessel-composes-persona-ring.test — a SOURCE WELD: the boot composes THE PERSONAGROUP ring onto
 * its self-slot fed gate, so the ONE assembly every vessel calls (`assemblePersonaGroupRing`, `@lararium/keyhive`,
 * unit-proven) actually reaches production.
 *
 * A source weld reads text, never behaviour, so it obeys the source-weld discipline the tree paid for:
 *   · it STRIPS comments first (a docblock naming the old shape must not satisfy the sweep), and pins the
 *     strip against vacuity (the base arm must survive the strip, or every assertion below passes over ash);
 *   · it takes a CENSUS (`assemblePersonaGroupRing(` appears as a CALL exactly once), which a rename drops;
 *   · it reads the COMPOSE reassignment (`selfSlotFedGate = ring.compose(`), the one wire that widens the gate,
 *     and the sibling gate the same ring stands by its sibling path (`siblingGate = ring.composeSiblings(`).
 * A full boot exercises the runtime path; this weld guards the wire from silently vanishing under a refactor.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8");
// Strip block and line comments FIRST — a comment that names the wire is not the wire.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the boot composes the PersonaGroup identity-slot ring", () => {
  test("the strip left the file — the base arm survives (anti-vacuity)", () => {
    expect(CODE, "the comment strip ate the file — every assertion below would pass over ash")
      .toMatch(/selfSlotFedGate\s*=\s*new DeterministicFederationGate/);
  });

  test("it imports the ONE ring assembly from the shared package both shores compose from", () => {
    expect(CODE).toMatch(/import\s*\{[^}]*assemblePersonaGroupRing[^}]*\}\s*from\s*["']@lararium\/keyhive["']/);
  });

  test("it CALLS the factory exactly once (a census a rename drops)", () => {
    const calls = CODE.match(/assemblePersonaGroupRing\s*\(/g) ?? [];
    expect(calls.length).toBe(1);
  });

  test("it reassigns selfSlotFedGate from a .compose( of the ring — the one widening wire", () => {
    // The ring stands once (`const ring = await assemblePersonaGroupRing({…})`) and widens the gate by compose.
    expect(CODE).toMatch(/const\s+ring\s*=\s*await\s+assemblePersonaGroupRing\(/);
    expect(CODE).toMatch(/selfSlotFedGate\s*=\s*ring\.compose\(selfSlotFedGate\)/);
  });

  test("the SAME ring stands the sibling gate by its sibling path, over the public boards and nothing wider", () => {
    expect(CODE).toMatch(/siblingGate\s*=\s*ring\.composeSiblings\(new DeterministicFederationGate\(nexusPubkey\)\)/);
    // The grant path reads only what this vessel's own gate proved — a sibling's key never stands in for it.
    expect(CODE).toMatch(/provenKeyOf:\s*\(peerId\)\s*=>\s*peerIdentifierMap\.get\(peerId\)\s*\?\?\s*null,/);
    expect(CODE).toMatch(/siblingKeyOf:\s*\(peerId\)\s*=>\s*siblings\?\.provenKeyOf\(peerId\)/);
  });

  test("the ring wires behind an injected witness — the boot names no Date.now", () => {
    // The clockless law: the boot holds no wall clock; the witness rides in on opts (`now`).
    expect(CODE).not.toMatch(/Date\.now/);
  });
});
