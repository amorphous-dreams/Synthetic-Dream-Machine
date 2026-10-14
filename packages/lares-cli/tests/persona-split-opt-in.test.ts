import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdPersona } from "../src/commands/persona.js";
import { cmdVessel } from "../src/commands/vessel.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { makeNodePersonaDeclarationStore } from "@lararium/node";

// The room each test and hook takes, stated where the file loads: a founding derives a key and every seat seals a
// row, so a case here runs for seconds. A timeout stated inside a hook reaches no case the runner already collected.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const saved: Record<string, string | undefined> = {};
const env = (key: string, value: string | undefined): void => {
  saved[key] = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
};
const args = (index: string, name: string, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "persona", positional: ["new", index], options: { name }, flags: { json: true, ...flags } });

describe("persona root split opt-in", () => {
  let root: string;
  beforeEach(async () => {
    vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
    root = mkdtempSync(join(tmpdir(), "lares-split-opt-in-"));
    env("LAR_ROOT", root);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
    expect(await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } })).toBe(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(root, { recursive: true, force: true });
  });

  test("default founding arms no split; explicit split arms once", async () => {
    const outputs: string[] = [];
    const wire: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { wire.push(String(chunk)); return true; });
    vi.spyOn(console, "log").mockImplementation((line) => { outputs.push(String(line)); });
    expect(await cmdPersona(args("0", "veil-one"))).toBe(0);
    expect(wire.join("\n")).toContain('"rootSplit":"none"');
    expect(outputs.some((line) => line.includes("recorded-code") || line.includes("escrow-carrier"))).toBe(false);
    outputs.length = 0;
    expect(await cmdPersona(args("1", "veil-two", { "split-root": true }))).toBe(0);
    expect(wire.join("\n")).toContain('"rootSplit":"armed"');
    expect(outputs.join("\n")).toContain("SHARES ARE KEYS");
    expect(outputs.some((line) => line.includes("recorded-code"))).toBe(true);
    outputs.length = 0;
    expect(await cmdPersona(args("1", "veil-two", { "split-root": true }))).toBe(0);
    expect(wire.join("\n")).toContain('"rootSplit":"standing"');
    expect(outputs.some((line) => line.includes("recorded-code") || line.includes("escrow-carrier"))).toBe(false);
  });

  test("Handle and seat declarations land without the root split", async () => {
    expect(await cmdPersona({ command: "persona", positional: ["new", "0"], options: { name: "veil-one", handle: "outward", chair: "first-chair" }, flags: { json: true, seat: true } })).toBe(0);
    expect(await (await makeNodePersonaDeclarationStore()).get(0)).toMatchObject({ handle: "outward", seat: true, chair: "first-chair" });
  });
});
