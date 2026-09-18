/**
 * open-node-vessel-composes-persona-ring.test — a SOURCE WELD: the boot composes THE PERSONAGROUP ring onto
 * its self-slot fed gate, so the factory (`self-slot-persona-ring`, unit-proven) actually reaches production.
 *
 * A source weld reads text, never behaviour, so it obeys the source-weld discipline the tree paid for:
 *   · it STRIPS comments first (a docblock naming the old shape must not satisfy the sweep), and pins the
 *     strip against vacuity (the base arm must survive the strip, or every assertion below passes over ash);
 *   · it takes a CENSUS (`makeSelfSlotPersonaGroupRing(` appears as a CALL exactly once), which a rename drops;
 *   · it reads the COMPOSE reassignment (`selfSlotFedGate = … .compose(`), the one wire that widens the gate.
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

  test("it imports the ring factory from the node module that owns it", () => {
    expect(CODE).toMatch(/import\s*\{[^}]*makeSelfSlotPersonaGroupRing[^}]*\}\s*from\s*["']\.\/self-slot-persona-ring\.js["']/);
  });

  test("it CALLS the factory exactly once (a census a rename drops)", () => {
    const calls = CODE.match(/makeSelfSlotPersonaGroupRing\s*\(/g) ?? [];
    expect(calls.length).toBe(1);
  });

  test("it reassigns selfSlotFedGate from a .compose( of the ring — the one widening wire", () => {
    // The compose reassignment: selfSlotFedGate = (await makeSelfSlotPersonaGroupRing({…})).compose(base)
    expect(CODE).toMatch(/selfSlotFedGate\s*=\s*\(await\s+makeSelfSlotPersonaGroupRing\([\s\S]*?\)\)\.compose\(/);
  });

  test("the ring wires behind an injected witness — the boot names no Date.now", () => {
    // The clockless law: the boot holds no wall clock; the witness rides in on opts (`now`).
    expect(CODE).not.toMatch(/Date\.now/);
  });
});
