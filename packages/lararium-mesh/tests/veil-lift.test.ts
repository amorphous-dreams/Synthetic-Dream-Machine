/**
 * veil-lift — the private link a veil signs to a face it joined (the-veil-ladder#/the-base-model, in-house ruling 1).
 *   L1  the vessel's key signs {veil, face, atom}; the record verifies and names the veil's own key
 *   L2  a moved face, a moved atom, a moved veil, a foreign signature, an extra field and a missing one each read null
 *   L3  two faces of one veil hold two records that share the veil's key and nothing else: neither names the other
 */
import { describe, expect, test } from "vitest";
import { ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { signVeilLift, verifyVeilLift } from "../src/veil-lift.js";

const seed = (fill: number) => new Uint8Array(32).fill(fill);
/** The vessel's PUBLIC key, as the record names it: no seed of it enters a veil-lift signature. */
const VEIL = "c3".repeat(32);

describe("the veil-lift record", () => {
  test("L1 RED: the face's ATOM signs the link, it verifies under the atom, and the veil's key signed nothing", async () => {
    const record = await signVeilLift({ atomSeed: seed(3), veil: VEIL, face: "group-a" });
    expect(record.atom).toBe(await ed25519VerifyingKeyFromSeed(seed(3)));
    expect(record.veil).toBe(VEIL);
    expect(await verifyVeilLift(record)).toEqual(record);
    expect(await verifyVeilLift(JSON.parse(JSON.stringify(record)))).toEqual(record);
    // RED: a record the VEIL's own key signed (the retired shape) reads as no link at all.
    const veilSeed = seed(9), veilKey = await ed25519VerifyingKeyFromSeed(veilSeed);
    const forged = await signVeilLift({ atomSeed: veilSeed, veil: veilKey, face: "group-a" });
    expect(await verifyVeilLift({ ...forged, atom: record.atom }), "a signature under the place key verifies for no atom").toBeNull();
  });

  test("L2 any moved field, a foreign signer, an extra field or a missing one reads null", async () => {
    const record = await signVeilLift({ atomSeed: seed(3), veil: VEIL, face: "group-a" });
    const other = await signVeilLift({ atomSeed: seed(4), veil: VEIL, face: "group-a" });
    expect(await verifyVeilLift({ ...record, face: "group-b" })).toBeNull();
    expect(await verifyVeilLift({ ...record, atom: other.atom })).toBeNull();
    expect(await verifyVeilLift({ ...record, veil: "d4".repeat(32) })).toBeNull();
    expect(await verifyVeilLift({ ...record, signature: other.signature })).toBeNull();
    expect(await verifyVeilLift({ ...record, sibling: "group-b" })).toBeNull();
    const { atom: _atom, ...short } = record;
    expect(await verifyVeilLift(short)).toBeNull();
    expect(await verifyVeilLift(null)).toBeNull();
    await expect(signVeilLift({ atomSeed: seed(3), veil: VEIL, face: "" })).rejects.toThrow(/names a face/);
    await expect(signVeilLift({ atomSeed: seed(3), veil: "short", face: "group-a" })).rejects.toThrow(/verifying key/);
  });

  test("L3 two faces of one veil: two records, one shared veil key, two atoms, no record naming the other face", async () => {
    const a = await signVeilLift({ atomSeed: seed(3), veil: VEIL, face: "group-a" });
    const b = await signVeilLift({ atomSeed: seed(5), veil: VEIL, face: "group-b" });
    expect(a.veil).toBe(b.veil);
    expect(a.atom).not.toBe(b.atom);
    expect(a.signature).not.toBe(b.signature);
    expect(JSON.stringify(a)).not.toContain("group-b");
    expect(JSON.stringify(a)).not.toContain(b.atom);
    expect(JSON.stringify(b)).not.toContain("group-a");
    expect(JSON.stringify(b)).not.toContain(a.atom);
  });
});
