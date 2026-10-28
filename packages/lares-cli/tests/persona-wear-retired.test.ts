/**
 * `lares persona wear` retired: a vessel wears no face between commands, so the verb refuses by name and points at
 * `--face N` on the command itself. It writes nothing, so it needs no vessel standing.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { cmdPersona } from "../src/commands/persona.js";

describe("persona wear retired", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  test("RED: `persona wear N` refuses persona-wear-retired, naming --face N", async () => {
    const wire: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { wire.push(String(chunk)); return true; });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdPersona({ command: "persona", positional: ["wear", "0"], options: {}, flags: { json: true } })).not.toBe(0);
    const out = wire.join("");
    expect(out).toContain('"code":"persona-wear-retired"');
    expect(out).toContain("--face N");
  });
});
