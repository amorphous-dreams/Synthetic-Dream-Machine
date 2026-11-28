/**
 * THE VESSEL'S CANON ACT SPEAKS ITS OWN VERB: `lares vessel lay` lays every disk mirror back into the layer it mirrors
 * (the verb `liveLay` already speaks), and "seed" names the genesis offer alone (`genesis/seed.json`), so the vessel
 * door holds no sub-door by that name and refuses it through its own unknown-sub-door path.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/vessel-door
 */
import { describe, test, expect, vi, afterEach } from "vitest";

afterEach(() => vi.restoreAllMocks());

function capture(): { out: string[]; err: string[] } {
  const out: string[] = [], err: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.map(String).join(" ")); });
  return { out, err };
}

describe("the vessel door's canon act answers as `lay`", () => {
  test("`lares help vessel lay` renders the lay sub-door's own entry", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const { out } = capture();
    expect(await dispatch(["help", "vessel", "lay"])).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/^usage: lares vessel lay/m);
    expect(text).toContain("lift-kahua=");
  });

  test("the vessel door lists `lay` among its sub-doors, and the founding rite composes found · stand · lay", async () => {
    const { VESSEL_SUBS } = await import("../src/commands/vessel.js");
    expect(VESSEL_SUBS).toContain("lay");
    expect(VESSEL_SUBS).not.toContain("seed");
    const { dispatch } = await import("../src/bin/lares.js");
    const { err } = capture();
    expect(await dispatch(["vessel", "rite"])).toBe(0);
    expect(err.join("\n")).toMatch(/founding\s+found · stand · lay/);
  });

  test("`lares vessel seed` refuses as an unknown sub-door and runs nothing", async () => {
    const { dispatch } = await import("../src/bin/lares.js");
    const { err } = capture();
    expect(await dispatch(["vessel", "seed"])).toBe(2);
    expect(err.join("\n")).toContain('lares vessel: unknown sub-door "seed"');
  });
});
