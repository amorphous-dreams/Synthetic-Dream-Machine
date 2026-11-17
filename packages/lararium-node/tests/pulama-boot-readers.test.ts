/**
 * pulama-boot-readers — a vessel standing by a pūlama whose lei names one face of several composes over that face alone: every
 * reader the sovereign composition runs that walks the faces (the open set, or the face files on disk) asks only rows the
 * session serves, while the pūlama holds the other faces open beside it.
 */
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { seatCustody, unseatCustody, unlockedFaceOrdinals } from "../src/custody-seat.js";
import { faceAtomGroupFile, sweepFoundingSeeds } from "../src/face-atom-store.js";
import { listAnchoredPersonas } from "../src/identity-anchors.js";
import { listWalkRecords } from "../src/node-walk-store.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { fixtureSlots, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUPS = ["group-boot-steward", "group-boot-engineer", "group-boot-referee"] as const;

let fx: PulamaFixture | null = null;
let seated: PulamaHolder | null = null;
afterEach(async () => {
  if (seated) { unseatCustody(seated); await seated.lock(); seated = null; }
  if (fx) seatCustody(fx.local);
  await fx?.drop(); fx = null;
});

/** Three faces open at the pūlama, each holding its atom row; a vessel seated over a session whose lei names `ordinal`. */
async function standThree(ordinal: number | null) {
  let scoped: { fcid: string; ordinal: number } | null = null;
  fx = await standPulama("pulama-boot-readers", () => ({ admit: async () => ({ ok: true, scope: { face: scoped, coldReads: [] } }) }));
  const faces = [];
  for (const [i, group] of GROUPS.entries()) faces.push(await fx.kept.foundFace({ group: personaGroupDigest(group), ordinal: i, slots: fixtureSlots }));
  for (const group of GROUPS) await fx.kept.writeRecord("identity", faceAtomGroupFile(group), randomBytes(32));
  if (ordinal !== null) scoped = { fcid: faces[ordinal]!.fcid, ordinal };
  const vessel = fx.vessel();
  await vessel.unlock([]);
  seatCustody(vessel);
  seated = vessel;
  return { faces, vessel };
}

describe("RED composition-reads-the-lei-face-alone: the boot's face walkers under a one-face pūlama session", () => {
  test("the founding-seed sweep and every open-face walker ask no row outside the lei, while the pūlama holds three faces open", async () => {
    await standThree(0);
    expect(fx!.kept.unlockedFaces()).toHaveLength(3);
    expect(await unlockedFaceOrdinals()).toEqual([0]);
    await expect(sweepFoundingSeeds()).resolves.toBeUndefined();
    await expect(listAnchoredPersonas()).resolves.toEqual([]);
    await expect(listWalkRecords()).resolves.toEqual([]);
  });

  test("CONTROL: a session scoped to no face apart walks all three faces, and the sweep reads each", async () => {
    await standThree(null);
    expect(await unlockedFaceOrdinals()).toEqual([0, 1, 2]);
    await expect(sweepFoundingSeeds()).resolves.toBeUndefined();
  });
});
