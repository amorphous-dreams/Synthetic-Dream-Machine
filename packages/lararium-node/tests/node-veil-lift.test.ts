/**
 * THE NODE'S VEIL-LIFT LINK, twin of the browser's (`browser-veil-lift`): each face a node's veil lands under keeps one private record the
 * vessel's own key signs ({veil, face, atom}, `@lararium/mesh` veil-lift), resting as a face row under that face's custody alone.
 *
 *   NV1  the keep signs with the vessel's key and names the face's atom; the record verifies and reads back.
 *   NV2  a replayed keep for the same veil and atom writes nothing new: the standing record answers.
 *   NV3  each face holds its own record: two faces' records share the veil's key and nothing else.
 *   NV4  the record rests as a face row the carrier table names (`veil-lift`), never a place row.
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
seatSuiteWard();
import { beforeEach, describe, expect } from "vitest";
import { faceAtomKeyFromSeed, verifyVeilLift } from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { keepNodeVeilLift, readNodeVeilLift, veilLiftGroupFile } from "../src/node-veil-lift.js";
import { carrierTable } from "../src/vault-carriers.js";
import { seedFaceAtom, atomSeedOf } from "./atom-fixture.js";
import { it } from "./support/scratch-fixture.js";

beforeEach(async () => {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await generateOrLoadPersonaGroupRoot();
});

describe("the node's veil-lift link", () => {
  it("NV1-NV2: the vessel's key signs the face's atom, the record reads back, and a replay keeps the standing record", async () => {
    const atom = await seedFaceAtom(0, "group-veil-a");
    const kept = await keepNodeVeilLift("group-veil-a", atom.key);
    expect(kept).toMatchObject({ kind: "veil-lift", veil: await loadVesselVerifyingKey(), face: "group-veil-a", atom: atom.key });
    expect(await verifyVeilLift(kept)).toEqual(kept);
    expect(await readNodeVeilLift("group-veil-a")).toEqual(kept);
    expect(await keepNodeVeilLift("group-veil-a", atom.key), "a replay answers the standing record").toEqual(kept);
  });

  it("NV3: two faces hold two records that share the veil's key and nothing else", async () => {
    await seedFaceAtom(0, "group-veil-a");
    await seedFaceAtom(1, "group-veil-b");
    const keyOf = async (index: number, group: string) => faceAtomKeyFromSeed(await atomSeedOf(index), group).key;
    const a = await keepNodeVeilLift("group-veil-a", await keyOf(0, "group-veil-a"));
    const b = await keepNodeVeilLift("group-veil-b", await keyOf(1, "group-veil-b"));
    expect(a.veil).toBe(b.veil);
    expect(a.atom).not.toBe(b.atom);
    expect(JSON.stringify(a)).not.toContain("group-veil-b");
    expect(JSON.stringify(b)).not.toContain("group-veil-a");
  });

  it("NV4: the record rests as a face row the carrier table names", () => {
    const row = carrierTable().find((r) => r.row === "veil-lift");
    expect(row, "the carrier table names the veil-lift row").toBeDefined();
    expect(row!.custody).toBe("face-hot");
    expect(row!.faceRow?.inner.test(veilLiftGroupFile("group-veil-a"))).toBe(true);
  });
});
