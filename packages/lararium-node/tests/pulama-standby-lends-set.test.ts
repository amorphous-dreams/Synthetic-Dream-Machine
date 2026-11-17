/**
 * pulama-standby-lends-set — a vessel standing by a pūlama that lends it several faces: the stand-by sets no vessel-wide face,
 * the composition names its own daemon mount (the steward's face 0 where it serves, else the lowest face it serves), several
 * served faces never trap the vessel at the floor, and every face-scoped reader the composition runs asks no row of a face
 * outside the lend.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { seatCustody, servesFaceOfGroup, unseatCustody, unlockedFaceOrdinals } from "../src/custody-seat.js";
import { faceAtomGroupFile, sweepFoundingSeeds } from "../src/face-atom-store.js";
import { listAnchoredPersonas } from "../src/identity-anchors.js";
import { daemonMountOrdinal, mountedFaceOrdinal, setMountedFace, sovereignStands } from "../src/node-vessel-identity.js";
import { listWalkRecords } from "../src/node-walk-store.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { pulamaStandBy } from "../src/pulama-seat.js";
import { fixtureSlots, lend, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUPS = ["group-mount-steward", "group-mount-engineer", "group-mount-referee"] as const;

let fx: PulamaFixture | null = null;
let seated: PulamaHolder | null = null;
afterEach(async () => {
  setMountedFace(undefined);
  if (seated) { unseatCustody(seated); await seated.lock(); seated = null; }
  if (fx) seatCustody(fx.local);
  await fx?.drop(); fx = null;
});

/** Three faces lit at the pūlama, each with its atom row; a vessel seated over a session that lends `lent`. */
async function standThree(lent: number[], dark: number[] = []) {
  fx = await standPulama("pulama-standby-lends", () => ({ admit: async () => ({ ok: true, scope: { faces: lend(...lent), coldReads: [] } }) }));
  const faces = [];
  for (const [i, group] of GROUPS.entries()) faces.push(await fx.kept.foundFace({ group: personaGroupDigest(group), ordinal: i, slots: fixtureSlots }));
  for (const group of GROUPS) await fx.kept.writeRecord("identity", faceAtomGroupFile(group), randomBytes(32));
  for (const o of dark) await fx.kept.lockFace(faces[o]!.fcid);
  const vessel = fx.vessel();
  seatCustody(vessel);
  seated = vessel;
  return { faces, vessel };
}

/** Every refusal the pūlama sent back for a row outside the lend. */
const outsideTheLend = (): string[] => fx!.lines.fromPulama.filter((l) => l.includes("outside-the-lei"));

describe("RED the stand-by sets no vessel-wide face; the composition names its daemon mount", () => {
  test("a session lending {h0, h2} leaves the mounted face unset, composes sovereign, and logs the lend; the daemon mount reads the steward", async () => {
    const { vessel } = await standThree([0, 2]);
    const composed: boolean[] = [], lines: string[] = [];
    const by = pulamaStandBy({ holder: vessel, onLog: (l) => lines.push(l), recompose: async (sovereign) => { composed.push(sovereign); return { standing: "hearth" }; } });
    expect(await by.dial()).toEqual({ session: true, waits: null });
    expect(composed).toEqual([true]);
    expect(mountedFaceOrdinal()).toBeUndefined();
    expect(lines.join("\n")).toMatch(/lends h0, h2/);
    expect(await unlockedFaceOrdinals()).toEqual([0, 2]);
    // THE FLOOR TRAP: two served faces and none named still stand the sovereign composition, mounted on the steward's face.
    expect(sovereignStands()).toBe(true);
    expect(await daemonMountOrdinal()).toBe(0);
  });

  test("with the steward's face lent but dark, the daemon mount reads the lowest face served; a mount the unlock named that stands unserved keeps the floor", async () => {
    await standThree([0, 2], [0]);
    await seated!.unlock([]);
    expect(await unlockedFaceOrdinals()).toEqual([2]);
    expect(seated!.waiting()).toEqual([0]);
    expect(await daemonMountOrdinal()).toBe(2);
    expect(sovereignStands()).toBe(true);
    setMountedFace(1);
    expect(sovereignStands()).toBe(false);
    expect(await daemonMountOrdinal()).toBeUndefined();
  });
});

describe("RED composition-readers-ask-only-the-lend: every face-scoped reader the composition runs stays inside a partial lend", () => {
  test("under a lend of {h0, h2}, the walkers and the other-face proof's gate ask no row of h1, and the pūlama refuses nothing", async () => {
    await standThree([0, 2]);
    await seated!.unlock([]);
    await sweepFoundingSeeds();
    expect(await listAnchoredPersonas()).toEqual([]);
    expect(await listWalkRecords()).toEqual([]);
    expect(await servesFaceOfGroup(GROUPS[0])).toBe(true);
    expect(await servesFaceOfGroup(GROUPS[2])).toBe(true);
    expect(await servesFaceOfGroup(GROUPS[1])).toBe(false);
    expect(outsideTheLend()).toEqual([]);
  });

  test("WELD: the composition proves another face, and lists the faces it walks, only inside what the vessel serves", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    const proof = source.slice(source.indexOf("async function proofOfOtherFace"));
    expect(proof.indexOf("servesFaceOfGroup(")).toBeGreaterThan(-1);
    expect(proof.indexOf("servesFaceOfGroup(")).toBeLessThan(proof.indexOf("loadFaceAnchorOfGroup("));
  });
});
