/**
 * sensorium-hand-guard — each sense hand verb's store function guards itself, as `purgeSensorium` already did (hitl-reads-a-hand).
 * A caller that imports `promoteSensorium`, `retireSensorium` or `unRetireSensorium` directly and hands no door's reading moves
 * nothing and refuses `sense-needs-hand`; a truthy value a caller fills refuses the same. CONTROL: the hand a door read moves each.
 */
import { describe, expect, test } from "vitest";
import {
  buildEphemeralSensorium, inspectSensorium, promoteSensorium, retireSensorium, unRetireSensorium,
} from "../src/sensorium-lifecycle-verbs.js";

const lifecycle = (name: string): string | undefined => (inspectSensorium(name) as { lifecycle?: string } | null)?.lifecycle;

describe("a sense hand verb's store function reads the hand", () => {
  test("RED: promote, retire and un-retire refuse with no hand, or a filled value, and move nothing", () => {
    buildEphemeralSensorium("guarded");
    for (const forged of [undefined, true, "1"]) {
      expect(() => promoteSensorium("guarded", forged as never), `promote ${String(forged)}`).toThrow(/sense-needs-hand/);
      expect(() => retireSensorium("guarded", "superseded", forged as never), `retire ${String(forged)}`).toThrow(/sense-needs-hand/);
    }
    expect(lifecycle("guarded")).toBe("pioneer");
    retireSensorium("guarded", "superseded", "hand");
    expect(() => unRetireSensorium("guarded", true as never)).toThrow(/sense-needs-hand/);
    expect(lifecycle("guarded")).toBe("tombstone");
  });

  test("CONTROL: the hand a door read moves each", () => {
    buildEphemeralSensorium("handed");
    promoteSensorium("handed", "hand");
    expect(lifecycle("handed")).not.toBe("pioneer");
    retireSensorium("handed", "superseded", "hand");
    unRetireSensorium("handed", "hand");
    expect(lifecycle("handed")).not.toBe("tombstone");
  });
});
