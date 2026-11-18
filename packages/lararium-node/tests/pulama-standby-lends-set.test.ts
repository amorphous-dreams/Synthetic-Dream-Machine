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
import { faceAtomGroupFile, recoverFoundingSeedFromGroup, sweepFoundingSeeds } from "../src/face-atom-store.js";
import { cadenceKeyFile, heldCadenceKey, retireCadenceKey, signAsCadence } from "../src/cadence-key-store.js";
import { cofoundRecordFile, cofoundRecordFingerprints, dropCofoundRecord, readCofoundRecord } from "../src/cofound-record.js";
import { faceProofKeyFile, listFaceProofKeys, nodeFaceKeyCustody, nodeVesselFaceKeyCustody, readVesselFaceKeyPublic, vesselFaceKeyFile } from "../src/face-key-custody.js";
import { fleetJoinPendingFile, listPendingFleetJoinGroups } from "../src/fleet-join-custody.js";
import { heldSeatKey, retireSeatKey, seatKeyFile, seatKeysOfFace, signAsSeat } from "../src/seat-key-store.js";
import { listAnchoredPersonas } from "../src/identity-anchors.js";
import { daemonMountOrdinal, mountedFaceOrdinal, orphanPersonaRoots, setMountedFace, sovereignStands } from "../src/node-vessel-identity.js";
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

  test("RED the face-file walkers outside the composition read rows of served faces alone: under {h0, h2}, h1's seat, cadence, cofound, face-key, pending-join and founding-seed rows read as none, and the pūlama refuses nothing; CONTROL: the names-only listers still name h1's rows", async () => {
    await standThree([0, 2]);
    await seated!.unlock([]);
    const SEAT = "5".repeat(64), CADENCE = "6".repeat(64), OFFER = "7".repeat(64), NEXUS = "nexus-aid-one", FACE_KEY = "8".repeat(64);
    const scope = { faceKey: FACE_KEY, nexus: NEXUS };
    for (const file of [seatKeyFile(SEAT, 1), cadenceKeyFile(1, CADENCE), cofoundRecordFile(1, OFFER), faceProofKeyFile(1, NEXUS), vesselFaceKeyFile(1, scope), fleetJoinPendingFile(personaGroupDigest(GROUPS[1]))]) {
      await fx!.kept.writeRecord("identity", file, randomBytes(32));
    }
    const image = new Uint8Array([1]);
    await expect(signAsSeat(SEAT, image)).rejects.toMatchObject({ name: "CustodyRecordUnavailable" });
    expect(await retireSeatKey(SEAT)).toBe(false);
    expect(await seatKeysOfFace(1)).toEqual([]);
    await expect(signAsCadence(CADENCE, image)).rejects.toMatchObject({ name: "CustodyRecordUnavailable" });
    expect(await retireCadenceKey(CADENCE)).toBe(false);
    expect(await readCofoundRecord(OFFER)).toBeNull();
    expect(await dropCofoundRecord(OFFER, "9".repeat(64))).toBe(false);
    expect(await readVesselFaceKeyPublic(scope)).toBeNull();
    await expect(nodeVesselFaceKeyCustody.signAsVesselFace(scope, FACE_KEY, image)).rejects.toMatchObject({ name: "CustodyRecordUnavailable" });
    await expect(nodeFaceKeyCustody.signAsFace(scope, image)).rejects.toMatchObject({ name: "CustodyRecordUnavailable" });
    expect(await listFaceProofKeys(1)).toEqual([]);
    expect(await listPendingFleetJoinGroups()).toEqual([]);
    const ask = { hearthTrueName: "hearth", bindingMode: "self-stood" as const, personaKelPrefix: null, mount: false, handleIndex: 1 };
    expect(await recoverFoundingSeedFromGroup(ask, { "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/one": { fields: { text: "sealed" } } })).toBeNull();
    expect(outsideTheLend()).toEqual([]);
    // CONTROL: the names-only listers name every face's row and open none.
    expect(heldSeatKey(SEAT)?.handleIndex).toBe(1);
    expect(heldCadenceKey(CADENCE)).toBe(true);
    expect(cofoundRecordFingerprints()).toEqual([OFFER]);
    expect(await orphanPersonaRoots()).toEqual([]);
    expect(outsideTheLend()).toEqual([]);
  });

  test("RED WELD: a face the pūlama lights after the composition stood (its lend widened by the pūlama's standing event) lights in the daemon island on the custody's open, so a session on it reads its own documents and never meets `no provider for face`", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    const watch = source.indexOf("onOpened?.(() => void lightServedFaces(");
    expect(watch).toBeGreaterThan(-1);
    const light = source.slice(source.indexOf("const lightServedFaces"));
    expect(light.indexOf("unlitServedFaces(")).toBeGreaterThan(-1);
    expect(light.indexOf("unlitServedFaces(")).toBeLessThan(light.indexOf("lightFace("));
  });

  test("WELD: the composition proves another face, and lists the faces it walks, only inside what the vessel serves", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    const proof = source.slice(source.indexOf("async function proofOfOtherFace"));
    expect(proof.indexOf("servesFaceOfGroup(")).toBeGreaterThan(-1);
    expect(proof.indexOf("servesFaceOfGroup(")).toBeLessThan(proof.indexOf("loadFaceAnchorOfGroup("));
  });
});
