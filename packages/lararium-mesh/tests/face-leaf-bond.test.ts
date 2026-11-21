/**
 * The face→leaf bond: a face's leaf key at one realm's Nexus, signed by BOTH ends. The face's atom signs that this leaf
 * stands for it there, and the leaf signs that it answers to this atom, over one image naming the atom, the leaf, the
 * Nexus and the realm. A reader binds a writer to a presenter only through a bond that verifies whole.
 */
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { faceLeafBondImage, readFaceLeafBond, signFaceLeafBond } from "../src/face-leaf-bond.js";

const seedOf = (n: number) => Uint8Array.from({ length: 32 }, (_, i) => (n * 31 + i) & 0xff);
const keyOf = async (seed: Uint8Array) => hex(await ed25519.getPublicKeyAsync(seed));
const signer = (seed: Uint8Array) => async (bytes: Uint8Array) => hex(await ed25519.signAsync(bytes, seed));
const REALM = "ab".repeat(32);
const NEXUS = "bafy-nexus-aid";

async function bonded(atomSeed = seedOf(1), leafSeed = seedOf(2)) {
  const atom = await keyOf(atomSeed);
  const leaf = await keyOf(leafSeed);
  const bond = await signFaceLeafBond({ atom, leaf, nexusAid: NEXUS, realm: REALM }, { atom: signer(atomSeed), leaf: signer(leafSeed) });
  return { atom, leaf, bond };
}

describe("the face→leaf bond", () => {
  test("RED: a bond both ends signed binds the leaf to the presenting atom; CONTROL: the presenter's 0x DID reads as its atom", async () => {
    const { atom, leaf, bond } = await bonded();
    expect(readFaceLeafBond(bond, { presenter: atom, writer: leaf, realm: REALM })).toMatchObject({ ok: true });
    expect(readFaceLeafBond(bond, { presenter: `0x${atom.toUpperCase()}`, writer: leaf.toUpperCase(), realm: REALM })).toMatchObject({ ok: true });
  });

  test("RED: the bond refuses another presenter, another writer, another realm, by name", async () => {
    const { atom, leaf, bond } = await bonded();
    const other = await keyOf(seedOf(9));
    expect(readFaceLeafBond(bond, { presenter: other, writer: leaf, realm: REALM })).toEqual({ ok: false, reason: "bond-not-presenter" });
    expect(readFaceLeafBond(bond, { presenter: atom, writer: other, realm: REALM })).toEqual({ ok: false, reason: "bond-not-writer" });
    expect(readFaceLeafBond(bond, { presenter: atom, writer: leaf, realm: "cd".repeat(32) })).toEqual({ ok: false, reason: "bond-other-realm" });
  });

  test("RED: each end's signature must verify over the image; a lifted half or a moved Nexus refuses", async () => {
    const { atom, leaf, bond } = await bonded();
    const expectFor = { presenter: atom, writer: leaf, realm: REALM };
    // The other face's bond over the same leaf: its atom half verifies for its own atom alone.
    const stranger = await bonded(seedOf(5), seedOf(2));
    expect(readFaceLeafBond({ ...bond, atomSig: stranger.bond.atomSig }, expectFor)).toEqual({ ok: false, reason: "bond-atom-unsigned" });
    // A leaf that never signed: its half from another leaf.
    const otherLeaf = await bonded(seedOf(1), seedOf(6));
    expect(readFaceLeafBond({ ...bond, leafSig: otherLeaf.bond.leafSig }, expectFor)).toEqual({ ok: false, reason: "bond-leaf-unsigned" });
    // A bond whose Nexus moved verifies under neither half.
    expect(readFaceLeafBond({ ...bond, nexusAid: "bafy-elsewhere" }, expectFor)).toMatchObject({ ok: false });
    // Both halves sign one image; the image names its own domain, so no other signed shape verifies as a bond.
    const image = faceLeafBondImage({ atom, leaf, nexusAid: NEXUS, realm: REALM });
    expect(new TextDecoder().decode(image)).toMatch(/face-leaf-bond/);
  });

  test("RED: a malformed bond refuses bond-malformed; CONTROL: absent reads bond-absent", async () => {
    const { atom, leaf, bond } = await bonded();
    const expectFor = { presenter: atom, writer: leaf, realm: REALM };
    expect(readFaceLeafBond(undefined, expectFor)).toEqual({ ok: false, reason: "bond-absent" });
    for (const bad of [null, "bond", [], { ...bond, atomSig: 7 }, { ...bond, extra: true }, { ...bond, leaf: "zz" }]) {
      expect(readFaceLeafBond(bad, expectFor), JSON.stringify(bad)).toEqual({ ok: false, reason: "bond-malformed" });
    }
  });
});
