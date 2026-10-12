import { describe, test, expect } from "vitest";
import { nexusPhase } from "../src/nexus-phase.js";

describe("nexusPhase — a second seat turns a seed to a Nexus", () => {
  test.each([0, 1, 3])("%i own seats and no foreign seats read seed", (ownSeats) => {
    const phase = nexusPhase({ ownSeats, foreignSeats: 0 });
    expect(phase.phase).toBe("seed");
    expect(phase.isNexus).toBe(false);
    expect(phase.reading).toContain("a carriage contract moves no phase");
    expect(phase.reading.length).toBeGreaterThan(30);
  });
  test("one own and one foreign seat read Nexus", () => {
    const phase = nexusPhase({ ownSeats: 1, foreignSeats: 1 });
    expect(phase.phase).toBe("nexus");
    expect(phase.isNexus).toBe(true);
    expect(phase.reading.length).toBeGreaterThan(30);
  });
  test("foreign charter reads Nexus while this vessel holds no seat", () => {
    const phase = nexusPhase({ ownSeats: 0, foreignSeats: 2 });
    expect(phase.phase).toBe("nexus");
    expect(phase.isNexus).toBe(true);
    expect(phase.reading).toContain("holds NO seat");
    expect(phase.reading.length).toBeGreaterThan(30);
  });
});
