/** A kept atom seed restores one face identity across a fresh store. */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { foundThePlace, foundTheFace } from "@lararium/keyhive";
import * as ed25519 from "@noble/ed25519";
import { faceAtomKeyFromSeed, hex, mintFaceAtomSeed } from "@lararium/mesh";

const SEED = new Uint8Array(32).fill(9);
const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));

async function lightAFace(repo: Repo, verifyingKey: string, atomSeed: Uint8Array) {
  const place = await foundThePlace({ repo, vesselSeed: SEED, hearthTrueName: "" });
  const face = await foundTheFace({ repo, daemonHandle: place.daemonHandle,
    atomSeed, placeVerifyingKey: verifyingKey, vesselDisplayName: "Repave Shrine",
    binding: { mode: "self-stood", signerSeed: SEED }, hearthTrueName: "", nexusPubkey: verifyingKey,
  });
  return faceAtomKeyFromSeed(atomSeed, face.personaGroupId).key;
}

describe("the face identity follows its kept atom", () => {
  test("a re-light handed the kept atom stands the same Individual", async () => {
    const verifyingKey = await pubOf(SEED);
    const atomSeed = mintFaceAtomSeed();
    const repo1 = new Repo({ sharePolicy: async () => true });
    const first = await lightAFace(repo1, verifyingKey, atomSeed);
    await repo1.shutdown();
    const repo2 = new Repo({ sharePolicy: async () => true });
    const second = await lightAFace(repo2, verifyingKey, atomSeed);
    await repo2.shutdown();
    expect(second).toBe(first);
  });

  test("a fresh atom stands a different Individual", async () => {
    const verifyingKey = await pubOf(SEED);
    const repoA = new Repo({ sharePolicy: async () => true });
    const a = await lightAFace(repoA, verifyingKey, mintFaceAtomSeed());
    await repoA.shutdown();
    const repoB = new Repo({ sharePolicy: async () => true });
    const b = await lightAFace(repoB, verifyingKey, mintFaceAtomSeed());
    await repoB.shutdown();
    expect(b).not.toBe(a);
  });
});
