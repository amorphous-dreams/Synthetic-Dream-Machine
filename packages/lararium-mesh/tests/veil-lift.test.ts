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
const atomA = "a1".repeat(32), atomB = "b2".repeat(32);

describe("the veil-lift record", () => {
  test("L1 the veil's key signs the link, and it verifies", async () => {
    const record = await signVeilLift({ veilSeed: seed(3), face: "group-a", atom: atomA });
    expect(record.veil).toBe(await ed25519VerifyingKeyFromSeed(seed(3)));
    expect(await verifyVeilLift(record)).toEqual(record);
    expect(await verifyVeilLift(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  test("L2 any moved field, a foreign signer, an extra field or a missing one reads null", async () => {
    const record = await signVeilLift({ veilSeed: seed(3), face: "group-a", atom: atomA });
    const other = await signVeilLift({ veilSeed: seed(4), face: "group-a", atom: atomA });
    expect(await verifyVeilLift({ ...record, face: "group-b" })).toBeNull();
    expect(await verifyVeilLift({ ...record, atom: atomB })).toBeNull();
    expect(await verifyVeilLift({ ...record, veil: other.veil })).toBeNull();
    expect(await verifyVeilLift({ ...record, signature: other.signature })).toBeNull();
    expect(await verifyVeilLift({ ...record, sibling: "group-b" })).toBeNull();
    const { atom: _atom, ...short } = record;
    expect(await verifyVeilLift(short)).toBeNull();
    expect(await verifyVeilLift(null)).toBeNull();
    await expect(signVeilLift({ veilSeed: seed(3), face: "", atom: atomA })).rejects.toThrow(/names a face/);
    await expect(signVeilLift({ veilSeed: seed(3), face: "group-a", atom: "short" })).rejects.toThrow(/verifying key/);
  });

  test("L3 two faces of one veil: two records, one shared key, no record naming the other face", async () => {
    const a = await signVeilLift({ veilSeed: seed(3), face: "group-a", atom: atomA });
    const b = await signVeilLift({ veilSeed: seed(3), face: "group-b", atom: atomB });
    expect(a.veil).toBe(b.veil);
    expect(a.signature).not.toBe(b.signature);
    expect(JSON.stringify(a)).not.toContain("group-b");
    expect(JSON.stringify(a)).not.toContain(atomB);
    expect(JSON.stringify(b)).not.toContain("group-a");
    expect(JSON.stringify(b)).not.toContain(atomA);
  });
});
