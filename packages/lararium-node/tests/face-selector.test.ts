/**
 * face-selector — a command acts as the face it names, else the one face standing open; never a silent h0, and never the
 * face the composition mounts. Reds: two faces open and none named refuse by name and list them, the mounted face with them;
 * no face refuses. Controls: a named face wins, one face open resolves it, a vessel's one face resolves even when it is not h0.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, setMountedFace } from "../src/node-vessel-identity.js";
import { seatedCustody } from "../src/custody-seat.js";
import { readFaceIndexSync } from "../src/face-index.js";
import { larIdentityDir } from "../src/vessel-paths.js";
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
  it("RED: two faces open, a command naming none refuses and lists both, whatever face the composition mounts", async () => {
    for (const i of [0, 1]) { await generateOrLoadPersonaGroupRoot(i); await seedFaceAtom(i); }
    await expect(resolveFace()).rejects.toThrow(/faces h0, h1.* open: name the face .*--face N/);
    setMountedFace(1);                                   // the unlock's mount choice is the composition's, never a default face
    try { await expect(resolveFace()).rejects.toBeInstanceOf(FaceNotNamed); } finally { setMountedFace(undefined); }
    expect(await resolveFace(1)).toBe(1);                // CONTROL: a named face wins
    expect(await resolveFace(0)).toBe(0);
  });
  it("CONTROL: with one of two faces left open, that face resolves", async () => {
    for (const i of [0, 1]) { await generateOrLoadPersonaGroupRoot(i); await seedFaceAtom(i); }
    const fcid = (readFaceIndexSync(larIdentityDir()).faces[0] as { fcid: string }).fcid;
    await seatedCustody()!.lockFace(fcid);
    expect(await resolveFace()).toBe(1);
  });
});
