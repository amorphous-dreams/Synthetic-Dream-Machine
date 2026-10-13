import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { generateOrLoadPersonaGroupRoot, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore, nexusCharterDocPath } from "@lararium/node";
import { renameOwnPersona, sealKeySetHash, standForKahuSeat } from "@lararium/mesh";
import { seatScratchCustody, type ScratchCustody } from "./support/scratch-custody.js";

const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs => ({ command: "nexus", positional, options, flags: { json: true } });
async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, any> }> {
  const lines: string[] = [];
  const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try { const code = await cmdNexus(a); const json = lines.find((line) => line.trim().startsWith("{")); return { code, out: json ? JSON.parse(json) : {} }; }
  finally { write.mockRestore(); }
}

describe("seal rotate refusal codes", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-rotate-codes-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root;
    vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });
  // The seat mints its epoch's keyring secret under the vessel key, so each test stands on a founded custody.
  let custody: ScratchCustody;
  beforeEach(async () => { custody = await seatScratchCustody(); });
  afterEach(async () => { await custody.drop(); });
  async function roster(): Promise<string[]> {
    const petnames = await makeNodePersonaPetnameStore(); const declarations = await makeNodePersonaDeclarationStore(); const keys: string[] = [];
    for (let i = 0; i < 3; i++) { const face = await generateOrLoadPersonaGroupRoot(i); await renameOwnPersona(petnames, i, `veil-${i}`); await standForKahuSeat(declarations, i, true); keys.push(face.verifyingKey); }
    return keys;
  }
  test("unarmed and mismatched reveals carry their refusal codes and preserve bytes", async () => {
    const keys = await roster();
    expect((await run(args(["seal", "seat"]))).code).toBe(0);
    const path = nexusCharterDocPath(larSealHome()); const unarmedBefore = readFileSync(path);
    const unarmed = await run(args(["seal", "rotate"], { "next-key-commit": "f".repeat(64) }));
    expect(unarmed.code).not.toBe(0); expect(unarmed.out.error.code).toBe("rotation-unarmed"); expect(readFileSync(path).equals(unarmedBefore)).toBe(true);

    const wrong = sealKeySetHash(["a1".repeat(32), "b2".repeat(32), "c3".repeat(32)], 2);
    expect((await run(args(["seal", "seat"], { "next-key-commit": wrong }))).code).toBe(0);
    const mismatchBefore = readFileSync(path);
    const mismatch = await run(args(["seal", "rotate"], { "next-key-commit": "e".repeat(64) }));
    expect(mismatch.code).not.toBe(0); expect(mismatch.out.error.code).toBe("reveal-mismatch"); expect(readFileSync(path).equals(mismatchBefore)).toBe(true);

    const commit = sealKeySetHash(keys, 2);
    expect((await run(args(["seal", "seat"], { "next-key-commit": commit }))).code).toBe(0);
    expect((await run(args(["seal", "rotate"], { "next-key-commit": commit }))).code).toBe(0);
  });
});
