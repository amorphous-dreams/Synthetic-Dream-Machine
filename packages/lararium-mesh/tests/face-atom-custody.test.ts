import { describe, expect, test } from "vitest";
import {
  FaceAtomConflict, FaceAtomMissing, faceAtomKeyFromSeed, keepFaceAtomSeed, mintFaceAtomSeed,
  readFaceAtom, requireFaceAtomSeed, standFaceAtomSeed, type FaceAtomRecords,
} from "../src/index.js";

const A = "group-a";
const B = "group-b";

function memoryRecords() {
  const held = new Map<string, Uint8Array>();
  const records: FaceAtomRecords = {
    async read(group) { return held.get(group); },
    async withRecord(group, step) {
      return step(held.get(group), async (seed) => { held.set(group, Uint8Array.from(seed)); });
    },
  };
  return { records, held };
}

describe("face atom custody", () => {
  test("an absent row reads as no atom and require refuses by name", async () => {
    const { records } = memoryRecords();
    expect(await readFaceAtom(records, A)).toBeUndefined();
    await expect(requireFaceAtomSeed(records, A)).rejects.toMatchObject({
      name: "FaceAtomMissing", personaGroup: A,
      message: `this face holds no atom; re-found or re-admit it (${A})`,
    } satisfies Partial<FaceAtomMissing>);
  });

  test("stand mints once and returns copies of the seed at rest", async () => {
    const { records, held } = memoryRecords();
    const first = await standFaceAtomSeed(records, A);
    const second = await standFaceAtomSeed(records, A);
    expect(second).toEqual(first);
    expect(first).not.toBe(held.get(A));
    expect(second).not.toBe(held.get(A));
    expect((await readFaceAtom(records, A))?.key).toBe(faceAtomKeyFromSeed(first, A).key);
    expect(await requireFaceAtomSeed(records, A)).toEqual(first);
    first.fill(0);
    second.fill(0);
  });

  test("keep writes once, accepts the same bytes and refuses another seed without changing the row", async () => {
    const { records, held } = memoryRecords();
    const first = mintFaceAtomSeed();
    const other = mintFaceAtomSeed();
    expect(await keepFaceAtomSeed(records, A, first)).toBe("minted");
    const row = held.get(A);
    expect(await keepFaceAtomSeed(records, A, Uint8Array.from(first))).toBe("kept");
    expect(held.get(A)).toBe(row);
    await expect(keepFaceAtomSeed(records, A, other)).rejects.toMatchObject({
      name: "FaceAtomConflict", personaGroup: A, message: expect.stringMatching(/another seed/),
    } satisfies Partial<FaceAtomConflict>);
    expect(held.get(A)).toEqual(first);
    first.fill(0);
    other.fill(0);
  });

  test("two groups keep different atoms", async () => {
    const { records, held } = memoryRecords();
    const a = await standFaceAtomSeed(records, A);
    const b = await standFaceAtomSeed(records, B);
    expect(a).not.toEqual(b);
    expect(held.get(A)).toEqual(a);
    expect(held.get(B)).toEqual(b);
    a.fill(0);
    b.fill(0);
  });
});
