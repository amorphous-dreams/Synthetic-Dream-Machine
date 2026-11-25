/**
 * Ids draw from the platform's `crypto.getRandomValues` and nothing else. Where it stands absent, the mint
 * refuses by name (`entropy-absent`); it never falls back to `Math.random`, and no id reads the clock
 * (an attacker holding a machine sets its clock at will, so a clock never decides anything).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { newChangeId } from "../src/residency-actions.js";
import { newEventId } from "../src/effect-record.js";
import { newRequestId } from "../src/verb-tiddler.js";
import { mintRandomId } from "../src/entropy-door.js";
import { isVerbRefusal } from "../src/verb-refusal.js";

const MINTS: Array<[string, () => string]> = [
  ["newRequestId", newRequestId],
  ["newEventId", newEventId],
  ["newChangeId", newChangeId],
  ["mintRandomId", mintRandomId],
];

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.each(MINTS)("%s", (_name, mint) => {
  it("refuses by name where crypto stands absent, never reaching Math.random", () => {
    vi.stubGlobal("crypto", undefined);
    const rnd = vi.spyOn(Math, "random");
    let caught: unknown;
    try { mint(); } catch (e) { caught = e; }
    expect(isVerbRefusal(caught)).toBe(true);
    expect((caught as { reason: string }).reason).toBe("entropy-absent");
    expect((caught as Error).message).toMatch(/cure/i);
    expect(rnd).not.toHaveBeenCalled();
  });

  it("refuses where crypto carries no getRandomValues", () => {
    vi.stubGlobal("crypto", {});
    expect(() => mint()).toThrow(/entropy-absent|getRandomValues/);
  });

  it("still varies and reads neither Date.now nor Math.random", () => {
    const rnd = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Math.random read"); });
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Date.now read"); });
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(mint());
    expect(ids.size).toBe(50);
    expect(rnd).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });
});
