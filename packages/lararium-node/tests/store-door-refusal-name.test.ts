/**
 * A store-door row that refuses answers the name it refuses under, beside the door's words.
 */
import { describe, expect, test } from "vitest";
import { storeDoorReactors, storeRefusalName } from "../src/store-door-verbs.js";

const rows = storeDoorReactors({ storageDir: "/nonexistent", sealHome: "/nonexistent", repo: {} as never });
const run = (verb: keyof typeof rows, args: Record<string, unknown>) => (rows[verb] as (a: Record<string, unknown>) => Promise<Record<string, unknown>>)(args);

describe("a row's refusal names itself", () => {
  test("★ a refused row answers `refusal`: its own verb's name, never one word shared by every door ★", async () => {
    const out = await run("edge-seat-duties", { fleetRoot: "f", stray: 1 });
    expect(typeof out["refused"]).toBe("string");
    expect(out["refusal"]).toBe("edge-seat-duties-refused");
    expect(storeRefusalName("nexus-kapae")).toBe("nexus-kapae-refused");
  });

  test("CONTROL: a fault that belongs to no refusal class throws through the row, unnamed", async () => {
    await expect(run("persona-kel-head", {})).rejects.toThrow(/needs "prefix"/);
  });
});
