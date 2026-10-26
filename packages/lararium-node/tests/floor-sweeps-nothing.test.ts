/**
 * A composition at the floor sweeps nothing. The founding-seed sweep reads and moves private rows, so it runs under the sovereign
 * gate only (`sovereignStands`): the boot calls it through `sweepUnderTheGate`, and this file drives that door.
 *
 *   RED:     at the floor (the gate shut) the sweep is never called.
 *   CONTROL: under the gate (open) the sweep runs once.
 *   WELD:    the boot reads the gate and calls the sweep through that one door and no other.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { sweepUnderTheGate } from "../src/open-node-vessel.js";

describe("the founding-seed sweep runs under the sovereign gate only", () => {
  test("RED — at the floor the sweep is never called", async () => {
    let swept = 0;
    await sweepUnderTheGate(false, async () => { swept++; });
    expect(swept).toBe(0);
  });

  test("CONTROL — under the gate the sweep runs once", async () => {
    let swept = 0;
    await sweepUnderTheGate(true, async () => { swept++; });
    expect(swept).toBe(1);
  });

  test("WELD — the boot calls the sweep through that door, gated by the same read the composition uses", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    expect(source).toContain("const sovereignOpen = sovereignStands();");
    expect(source).toContain("await sweepUnderTheGate(sovereignOpen, sweepFoundingSeeds);");
    expect(source.match(/sweepFoundingSeeds\(\)/g) ?? []).toHaveLength(0);       // no other call stands
  });
});
