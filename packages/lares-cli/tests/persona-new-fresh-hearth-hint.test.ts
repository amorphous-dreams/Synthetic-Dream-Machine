/**
 * A FRESH HEARTH NAMES ITS FIRST FACE'S ACT. `persona new N` on a place where no face stands refuses, and its hint sends the
 * operator to the Stable founding act (`lares found --hearth --name '<label>'`), which founds persona zero with the hearth;
 * it never names `persona new 0` there.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";

describe("persona new on a place with no face", () => {
  let root = "";
  const saved = process.env["LAR_ROOT"];
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-fresh-hint-"));
    writeFileSync(join(root, ".lar-test-scratch"), "");
    process.env["LAR_ROOT"] = root;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (saved === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = saved;
    rmSync(root, { recursive: true, force: true });
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
    expect(said).toMatch(/lares found --hearth --name/);
    expect(said).not.toMatch(/persona new 0/);
  });
});
