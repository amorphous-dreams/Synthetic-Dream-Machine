/**
 * K15 step 2c, the mesh half — the face atom, and the isolation red's place-seed row: a thief holding the place
 * seed derives no atom and opens no group secret sealed to one.
 */
import * as ed25519 from "@noble/ed25519";
import { describe, expect, it } from "vitest";
import {
  deriveDyadVeil, faceAtomKeyFromSeed, groupSecretOpenerFromSeed, hexToBytes, mintFaceAtomSeed, mintVeilTag, sealGroupSecret,
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
    // and every key it can derive from the seed, the old veil road included, differs from the atom's.
    const veil = await deriveDyadVeil(placeSeed, mintVeilTag());
    expect(veil.verifyingKey).not.toBe(atom.key);
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
