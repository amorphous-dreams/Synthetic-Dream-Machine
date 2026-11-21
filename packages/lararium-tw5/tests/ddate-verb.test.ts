/**
 * ddate-verb — every vessel answers `ddate`: the Discordian date through the house's own calendar core, the caller
 * naming today's day (the verb reads no clock), a refusal by name for a date out of range or a partial date.
 */
import { describe, test, expect } from "vitest";
import { VerbTable, VERB_SURFACE } from "../src/verb-dispatcher.js";
import { seedVesselDefaults } from "../src/vessel-steps.js";
import { ddateVerb } from "../src/ddate-verb.js";

const TODAY = { year: 2026, month: 11, day: 20 };

describe("the ddate verb", () => {
  test("every vessel's base verbs carry it, projected on the cli and agent surfaces", () => {
    const table = new VerbTable();
    seedVesselDefaults(table);
    expect(table.has("ddate")).toBe(true);
    expect(table.project(VERB_SURFACE.agent).map((e) => e.verb)).toContain("ddate");
    expect(table.project(VERB_SURFACE.cli).map((e) => e.verb)).toContain("ddate");
  });

  test("a call naming today reads that day through the default format", async () => {
    const out = await ddateVerb({ today: TODAY });
    expect(out["text"]).toBe("Today is Prickle-Prickle, the 32nd day of The Aftermath in the YOLD 3192");
    expect(out).toMatchObject({ yold: 3192, season: "The Aftermath", dayOfSeason: 32, weekday: "Prickle-Prickle", holyday: null, tibs: false, entropy: null });
  });

  test("a named date and a format ride the call; today stays unread", async () => {
    const out = await ddateVerb({ format: "%{%A, the %e of %B%}, %Y. %N%nCelebrate %H", day: 19, month: 2, year: 2025, today: TODAY });
    expect(out["text"]).toBe("Setting Orange, the 50th of Chaos, 3191. \nCelebrate Chaoflux");
    expect(out["holyday"]).toBe("Chaoflux");
  });

  test("St. Tib's Day and the easter egg answer", async () => {
    expect((await ddateVerb({ format: "%{%A%}, %Y YOLD", day: 29, month: 2, year: 2024 }))["text"]).toBe("St. Tib's Day, 3190 YOLD");
    expect((await ddateVerb({ format: "%e|%E", day: 11, month: 1, year: 2025 }))["text"]).toBe("11th|11st");
  });

  test("%. names the platform's entropy door in the answer", async () => {
    const out = await ddateVerb({ format: "%.", day: 1, month: 1, year: 2025 });
    expect(out["entropy"]).toBe("platform:crypto.getRandomValues");
  });

  test("a date out of range, a partial date, and a call with neither a date nor today refuse by name", async () => {
    await expect(ddateVerb({ day: 32, month: 1, year: 2024 })).rejects.toThrow("Invalid date -- out of range");
    await expect(ddateVerb({ day: 5, month: 1 })).rejects.toThrow("day, month and year together");
    await expect(ddateVerb({})).rejects.toThrow("reads no clock");
  });
});
