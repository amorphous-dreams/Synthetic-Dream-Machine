/**
 * door-band — the five bands a door answers on, each announced: answered, admitted, owed, asks, void. A caller reads
 * the band and never guesses from a slow answer or a missing one.
 */
import { describe, test, expect } from "vitest";
import { DOOR_BANDS, isDoorBand } from "../src/door-band.js";

describe("door-band — five bands, each announced", () => {
  test("the bands run answered, admitted, owed, asks, void, in that order", () => {
    expect([...DOOR_BANDS]).toEqual(["answered", "admitted", "owed", "asks", "void"]);
  });

  test("a band reads by its name alone", () => {
    for (const band of DOOR_BANDS) expect(isDoorBand(band)).toBe(true);
    expect(isDoorBand("timeout")).toBe(false);
    expect(isDoorBand(undefined)).toBe(false);
  });
});
