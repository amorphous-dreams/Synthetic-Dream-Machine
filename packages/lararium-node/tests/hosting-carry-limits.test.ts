/**
 * hosting-carry-limits.test.ts — how much a hearth carries for walkers is the OPERATOR's to name, in config.
 *
 * `hosting.carry` in `~/.lares/config.json` sites the per-guest and total carry limits over the house defaults; a
 * city hearth carries more than a household's. The hosting CAP stays a hearth constant with `host roll --cap`.
 *
 * Proven:
 *   · RED: a configured `hosting.carry` sets both limits, and one field alone moves only itself;
 *   · CONTROL: no `hosting` block reads the house defaults exactly;
 *   · a value that is not a whole number of bytes, at least one, throws — a typo surfaces.
 */
import { describe, test, expect } from "vitest";
import { hostingCarryLimits, type LaresConfig } from "../src/lares-config.js";
import { DEFAULT_CARRY_LIMITS } from "../src/hosting-carry.js";

describe("the hearth's carry limits read from config", () => {
  test("RED: hosting.carry sets the limits; one field moves only itself", () => {
    expect(hostingCarryLimits({ hosting: { carry: { perGuestBytes: 1024, totalBytes: 4096 } } }, DEFAULT_CARRY_LIMITS))
      .toEqual({ perGuestBytes: 1024, totalBytes: 4096 });
    expect(hostingCarryLimits({ hosting: { carry: { totalBytes: 1 << 30 } } }, DEFAULT_CARRY_LIMITS))
      .toEqual({ perGuestBytes: DEFAULT_CARRY_LIMITS.perGuestBytes, totalBytes: 1 << 30 });
  });

  test("CONTROL: no hosting block reads the house defaults", () => {
    expect(hostingCarryLimits({}, DEFAULT_CARRY_LIMITS)).toEqual(DEFAULT_CARRY_LIMITS);
    expect(hostingCarryLimits({ hosting: {} }, DEFAULT_CARRY_LIMITS)).toEqual(DEFAULT_CARRY_LIMITS);
  });

  test("a value that is not a whole number of bytes throws", () => {
    for (const bad of [0, -1, 1.5, "8MiB", null]) {
      expect(() => hostingCarryLimits({ hosting: { carry: { totalBytes: bad } } } as unknown as LaresConfig, DEFAULT_CARRY_LIMITS)).toThrow(/hosting\.carry\.totalBytes/);
    }
    expect(() => hostingCarryLimits({ hosting: [] } as unknown as LaresConfig, DEFAULT_CARRY_LIMITS)).toThrow(/hosting must be an object/);
  });
});
