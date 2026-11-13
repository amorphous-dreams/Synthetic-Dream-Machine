import { describe, expect, test } from "vitest";
import { faceAtomKeyFromSeed, mintFaceAtomSeed } from "../src/face-atom.js";
import * as dyad from "../src/dyad.js";

describe("the face atom takes the dyad's device end", () => {
  test("one seed keeps one key under either PersonaGroup label", () => {
    const seed = mintFaceAtomSeed();
    expect(faceAtomKeyFromSeed(seed, "group-a").key).toBe(faceAtomKeyFromSeed(seed, "group-b").key);
  });

  test("two random atoms name different device ends", () => {
    expect(faceAtomKeyFromSeed(mintFaceAtomSeed(), "group-a").key)
      .not.toBe(faceAtomKeyFromSeed(mintFaceAtomSeed(), "group-b").key);
  });

  test("the dyad module exports no place-seed veil derivation", () => {
    expect("deriveDyadVeil" in dyad).toBe(false);
    expect("dyadVeilIndex" in dyad).toBe(false);
    expect("mintVeilTag" in dyad).toBe(false);
  });
});
