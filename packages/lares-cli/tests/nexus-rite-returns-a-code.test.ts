/**
 * A DOOR RETURNS A CODE. IT DOES NOT THROW PAST ITS OWN DISPATCHER.
 *
 * `cmdSeal` catches `UsageError` and renders it as a refusal; `runCabalRite` calls the same seal steps
 * directly and had no catch of its own, so a rite reaching an unseatable charter threw straight out of
 * `cmdNexus` to the caller. The exit-code vocabulary exists precisely so a caller never has to catch.
 *
 * ISOLATION IS LOAD-BEARING HERE: this rite PROVISIONS RESERVE STATE before the step that throws, so a
 * test that ran it against the operator's own home would write real founding material. Every case stands
 * in a temp seal home.
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
};
const args = (positional: string[]): ParsedArgs =>
  ({ command: "nexus", positional, options: {}, flags: { json: true } } as unknown as ParsedArgs);

describe("a nexus rite answers with a code", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-rite-code-"));
    setEnv("LAR_ROOT", root);            // nothing this rite writes may leave the temp tree
    setEnv("LARES_ARCHIVE_PASSPHRASE", undefined);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  test("★ `nexus rite cabal` on a vessel with no chairs REFUSES with a code, never a thrown error ★", async () => {
    // No persona ever stood for a chair here, so the seat step refuses — the question is HOW it refuses.
    const code = await cmdNexus(args(["rite", "cabal"]));
    expect(typeof code, "a door hands back a code").toBe("number");
    expect(code, "and a refusal is non-zero").not.toBe(0);
  });

  test("CONTROL — an unknown rite still refuses by code, so the assertion above is not trivially true", async () => {
    expect(await cmdNexus(args(["rite", "not-a-rite"]))).toBe(2);
  });
});
