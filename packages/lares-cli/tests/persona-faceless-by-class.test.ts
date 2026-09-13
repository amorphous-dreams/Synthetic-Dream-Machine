/**
 * A HERM MINTS NO FACE AT THE CLI DOOR. `personaSlotCeiling("herm") === 0` stood in mesh while the CLI's
 * `vesselCeiling` hard-coded `"hearth"`, so nothing at the one door that mints a persona root ever asked the
 * class (measured 2026-09-12 while a harness tried to seat a charter on a Herm). The class now reads off the
 * dial the daemon boots by.
 */
import { describe, expect, test } from "vitest";
import { parseIndex, vesselCeiling } from "../src/commands/persona.js";

describe("persona new on a Herm", () => {
  test("LAR_RECIPE=herm refuses index 0 as faceless-by-class", () => {
    expect(vesselCeiling({ LAR_RECIPE: "herm" }).cls).toBe("herm");
    expect(() => parseIndex("0", { LAR_RECIPE: "herm" })).toThrow(/no human face by class/);
  });
  /** CONTROL: a hearth (no recipe, or any other) mints index 0 as before. */
  test("a hearth still mints", () => {
    expect(vesselCeiling({}).cls).toBe("hearth");
    expect(parseIndex("0", {})).toBe(0);
    expect(parseIndex("0", { LAR_RECIPE: "lararium" })).toBe(0);
  });
});
