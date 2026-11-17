/**
 * pulama-boot-readers — a vessel standing by a pūlama that lends it some faces of several composes over the lent faces alone:
 * every reader the sovereign composition runs that walks the faces (the open set, or the face files on disk) asks only rows
 * the session serves, while the pūlama holds the other faces open beside it.
 */
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { seatCustody, unseatCustody, unlockedFaceOrdinals } from "../src/custody-seat.js";
import { faceAtomGroupFile, sweepFoundingSeeds } from "../src/face-atom-store.js";
import { listAnchoredPersonas } from "../src/identity-anchors.js";
import { listWalkRecords } from "../src/node-walk-store.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { fixtureSlots, lend, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUPS = ["group-boot-steward", "group-boot-engineer", "group-boot-referee"] as const;

let fx: PulamaFixture | null = null;
let seated: PulamaHolder | null = null;
afterEach(async () => {
  if (seated) { unseatCustody(seated); await seated.lock(); seated = null; }
  if (fx) seatCustody(fx.local);
  await fx?.drop(); fx = null;
});

/** Three faces open at the pūlama, each holding its atom row; a vessel seated over a session that lends `lent`. */
async function standThree(...lent: number[]) {
  fx = await standPulama("pulama-boot-readers", () => ({ admit: async () => ({ ok: true, scope: { faces: lend(...lent), coldReads: [] } }) }));
  const faces = [];
  for (const [i, group] of GROUPS.entries()) faces.push(await fx.kept.foundFace({ group: personaGroupDigest(group), ordinal: i, slots: fixtureSlots }));
  for (const group of GROUPS) await fx.kept.writeRecord("identity", faceAtomGroupFile(group), randomBytes(32));
  const vessel = fx.vessel();
  await vessel.unlock([]);
  seatCustody(vessel);
  seated = vessel;
  return { faces, vessel };
}

describe("RED composition-reads-the-lent-faces-alone: the boot's face walkers under a partial lend", () => {
  test("the founding-seed sweep and every open-face walker ask no row outside a one-face lend, while the pūlama holds three faces open", async () => {
    await standThree(0);
    expect(fx!.kept.unlockedFaces()).toHaveLength(3);
    expect(await unlockedFaceOrdinals()).toEqual([0]);
    await expect(sweepFoundingSeeds()).resolves.toBeUndefined();
    await expect(listAnchoredPersonas()).resolves.toEqual([]);
    await expect(listWalkRecords()).resolves.toEqual([]);
  });

  test("a lend of {h0, h2} walks those two faces and asks no row of h1", async () => {
    await standThree(0, 2);
    expect(await unlockedFaceOrdinals()).toEqual([0, 2]);
    await expect(sweepFoundingSeeds()).resolves.toBeUndefined();
    await expect(listAnchoredPersonas()).resolves.toEqual([]);
    await expect(listWalkRecords()).resolves.toEqual([]);
  });

  test("CONTROL: a lend of all three faces walks all three, and the sweep reads each", async () => {
    await standThree(0, 1, 2);
    expect(await unlockedFaceOrdinals()).toEqual([0, 1, 2]);
    await expect(sweepFoundingSeeds()).resolves.toBeUndefined();
  });
});
