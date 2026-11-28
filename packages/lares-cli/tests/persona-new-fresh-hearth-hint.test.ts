/**
 * A FRESH HEARTH NAMES ITS FIRST FACE'S ACT. `persona new N` on a place where no face stands refuses, and its hint sends the
 * operator to the Stable founding act (`lares found --hearth --name '<label>'`), which founds persona zero with the hearth;
 * it never names `persona new 0` there.
 */
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";

describe("persona new on a place with no face", () => {
  let house: Scratch;
  beforeEach(() => {
    house = openScratch();
    writeFileSync(join(house.root, ".lar-test-scratch"), "");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    closeScratch(house);
  });

  test("the refusal names `lares found --hearth --name`, never `persona new 0`", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(" ")); });
    vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { lines.push(String(c)); return true; });
    vi.spyOn(process.stderr, "write").mockImplementation((c: unknown) => { lines.push(String(c)); return true; });
    let thrown = "";
    let code: number | undefined;
    try { code = await cmdPersona({ command: "persona", positional: ["new", "1"], options: { name: "veil-two" }, flags: { json: true } }); }
    catch (e) { thrown = e instanceof Error ? e.message : String(e); }
    const said = [thrown, ...lines].join("\n");
    expect(code === undefined || code !== 0).toBe(true);
    expect(said).toMatch(/lares found hearth=true name=/);
    expect(said).not.toMatch(/persona new 0/);
  });
});
