/**
 * face-selector — a command acts as a face it names, wears or solely holds; never a silent h0. Reds: two faces held and
 * none named or worn refuse by name and list them; no face refuses. Controls: a named face wins, a worn face stands, a
 * vessel's one face resolves even when it is not h0.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, wearPersona } from "../src/node-vessel-identity.js";
import { FaceNotNamed, resolveFace } from "../src/face-selector.js";
import { seedFaceAtom } from "./atom-fixture.js";

let root: string; let prior: string | undefined;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-face-sel-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
});
afterEach(() => { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; rmSync(root, { recursive: true, force: true }); });

describe("resolveFace", () => {
  it("RED: a vessel with no face refuses by name", async () => {
    await expect(resolveFace()).rejects.toBeInstanceOf(FaceNotNamed);
  });
  it("CONTROL: the one face resolves even when it is not h0", async () => {
    await generateOrLoadPersonaGroupRoot(3); await seedFaceAtom(3);
    expect(await resolveFace()).toBe(3);
  });
  it("RED: two faces, none named or worn, refuse and list both; CONTROL: a named face wins and a worn face stands", async () => {
    for (const i of [0, 1]) { await generateOrLoadPersonaGroupRoot(i); await seedFaceAtom(i); }
    await expect(resolveFace()).rejects.toThrow(/h0, h1.*name one/);
    expect(await resolveFace(1)).toBe(1);
    await wearPersona(1);
    expect(await resolveFace()).toBe(1);
    expect(await resolveFace(0)).toBe(0);
  });
});
