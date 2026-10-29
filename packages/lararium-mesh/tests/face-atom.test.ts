/**
 * K15 step 2c, the mesh half — the face atom, and the isolation red's place-seed row: a thief holding the place
 * seed derives no atom and opens no group secret sealed to one.
 */
import * as ed25519 from "@noble/ed25519";
import { describe, expect, it, vi } from "vitest";
import { faceAtomPublicKey, signAsFaceAtom } from "../src/face-atom.js";
import {
  faceAtomKeyFromSeed, groupSecretOpenerFromSeed, hexToBytes, mintFaceAtomSeed, sealGroupSecret,
  utf8Bytes,
} from "../src/index.js";

const placeSeed = new Uint8Array(32).fill(0x11);
const opSeed = new Uint8Array(32).fill(0x22);
const GROUP_A = "group-a";
const GROUP_B = "group-b";

describe("the face atom", () => {
  it("is a random seed no other seed derives", () => {
    const a = mintFaceAtomSeed();
    const b = mintFaceAtomSeed();
    expect(a).toHaveLength(32);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(faceAtomKeyFromSeed(a, GROUP_A).key).not.toBe(faceAtomKeyFromSeed(b, GROUP_A).key);
  });

  it("takes its key from the seed alone: the PersonaGroup labels it and feeds no derivation", () => {
    const seed = mintFaceAtomSeed();
    const underA = faceAtomKeyFromSeed(seed, GROUP_A);
    const underB = faceAtomKeyFromSeed(seed, GROUP_B);
    expect(underA.key).toBe(underB.key);
    expect(underA.personaGroup).toBe(GROUP_A);
    expect(underB.personaGroup).toBe(GROUP_B);
  });

  it("signs as the face: the signature verifies under the atom key and under no other", async () => {
    const atom = faceAtomKeyFromSeed(mintFaceAtomSeed(), GROUP_A);
    const other = faceAtomKeyFromSeed(mintFaceAtomSeed(), GROUP_B);
    const msg = utf8Bytes("a dial made on this face's behalf");
    const sig = hexToBytes(await atom.sign(msg));
    expect(await ed25519.verifyAsync(sig, msg, hexToBytes(atom.key))).toBe(true);
    expect(await ed25519.verifyAsync(sig, msg, hexToBytes(other.key))).toBe(false);
  });

  it("refuses a seed of the wrong length and a nameless PersonaGroup", () => {
    expect(() => faceAtomKeyFromSeed(new Uint8Array(31), GROUP_A)).toThrow(/32 bytes/);
    expect(() => faceAtomKeyFromSeed(mintFaceAtomSeed(), "")).toThrow(/names its PersonaGroup/);
  });

  it("isolation red, place-seed row: the place seed derives no atom and opens no group secret sealed to one", async () => {
    const atom = faceAtomKeyFromSeed(mintFaceAtomSeed(), GROUP_A);
    const seal = await sealGroupSecret({ opSeed, prefix: "prefix-a", deviceVerifyingKey: atom.key });

    // The atom opens it.
    expect(atom.opener.seal(seal)).not.toBeNull();

    // A thief holding the place seed: its own opener opens nothing addressed to the atom,
    const thief = groupSecretOpenerFromSeed(placeSeed);
    expect(thief.seal(seal)).toBeNull();
    // The place seed's own key differs from the random atom's.
    expect(thief.deviceKey).not.toBe(atom.key);
    // Forging the addressee does not help: the box opens for the atom's secret key alone.
    expect(thief.seal({ ...seal, deviceKey: thief.deviceKey })).toBeNull();
  });

  it("control: a secret sealed to the place key opens for the place seed, so the red above bites", async () => {
    const thief = groupSecretOpenerFromSeed(placeSeed);
    const seal = await sealGroupSecret({ opSeed, prefix: "prefix-a", deviceVerifyingKey: thief.deviceKey });
    expect(thief.seal(seal)).not.toBeNull();
  });
});

describe("the atom's seed leaves no copy behind a key read or a signature", () => {
  it("faceAtomPublicKey and signAsFaceAtom each zero the copy they took; the caller's seed stands as given", async () => {
    const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
    const copies: Uint8Array[] = [];
    const from = Uint8Array.from.bind(Uint8Array);
    const spy = vi.spyOn(Uint8Array, "from").mockImplementation(((src: ArrayLike<number>) => { const c = from(src); if (src === seed) copies.push(c); return c; }) as typeof Uint8Array.from);
    try {
      const key = faceAtomPublicKey(seed);
      const sig = await signAsFaceAtom(seed, new Uint8Array([1, 2, 3]));
      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(sig).toMatch(/^[0-9a-f]{128}$/);
    } finally { spy.mockRestore(); }
    expect(copies).toHaveLength(2);                                          // CONTROL: the instrument saw each copy taken
    for (const copy of copies) expect(copy.every((b) => b === 0)).toBe(true); // and each reads zero once the call returns
    expect(seed.every((b, i) => b === i + 1)).toBe(true);                    // the caller's seed is the caller's to zero
  });
});
