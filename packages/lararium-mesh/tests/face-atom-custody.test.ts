import { describe, expect, test } from "vitest";
import {
  FaceAtomConflict, FaceAtomMissing, faceAtomKeyFromSeed, keepFaceAtomSeed, mintFaceAtomSeed,
  readFaceAtom, requireFaceAtomSeed, standFaceAtomSeed, type FaceAtomRows,
} from "../src/index.js";

const A = "group-a";
const B = "group-b";

function memoryRows() {
  const held = new Map<string, Uint8Array>();
  const rows: FaceAtomRows = {
    async read(group) { return held.get(group); },
    async withRow(group, step) {
      return step(held.get(group), async (seed) => { held.set(group, Uint8Array.from(seed)); });
    },
  };
  return { rows, held };
}

describe("face atom custody", () => {
  test("an absent row reads as no atom and require refuses by name", async () => {
    const { rows } = memoryRows();
    expect(await readFaceAtom(rows, A)).toBeUndefined();
    await expect(requireFaceAtomSeed(rows, A)).rejects.toMatchObject({
      name: "FaceAtomMissing", personaGroup: A,
      message: `this face holds no atom; re-found or re-admit it (${A})`,
    } satisfies Partial<FaceAtomMissing>);
  });

  test("stand mints once and returns copies of the seed at rest", async () => {
    const { rows, held } = memoryRows();
    const first = await standFaceAtomSeed(rows, A);
    const second = await standFaceAtomSeed(rows, A);
    expect(second).toEqual(first);
    expect(first).not.toBe(held.get(A));
    expect(second).not.toBe(held.get(A));
    expect((await readFaceAtom(rows, A))?.key).toBe(faceAtomKeyFromSeed(first, A).key);
    expect(await requireFaceAtomSeed(rows, A)).toEqual(first);
    first.fill(0);
    second.fill(0);
  });

  test("keep writes once, accepts the same bytes and refuses another seed without changing the row", async () => {
    const { rows, held } = memoryRows();
    const first = mintFaceAtomSeed();
    const other = mintFaceAtomSeed();
    expect(await keepFaceAtomSeed(rows, A, first)).toBe("minted");
    const row = held.get(A);
    expect(await keepFaceAtomSeed(rows, A, Uint8Array.from(first))).toBe("kept");
    expect(held.get(A)).toBe(row);
    await expect(keepFaceAtomSeed(rows, A, other)).rejects.toMatchObject({
      name: "FaceAtomConflict", personaGroup: A, message: expect.stringMatching(/another seed/),
    } satisfies Partial<FaceAtomConflict>);
    expect(held.get(A)).toEqual(first);
    first.fill(0);
    other.fill(0);
  });

  test("two groups keep different atoms", async () => {
    const { rows, held } = memoryRows();
    const a = await standFaceAtomSeed(rows, A);
    const b = await standFaceAtomSeed(rows, B);
    expect(a).not.toEqual(b);
    expect(held.get(A)).toEqual(a);
    expect(held.get(B)).toEqual(b);
    a.fill(0);
    b.fill(0);
  });
});
