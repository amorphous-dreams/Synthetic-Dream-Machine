import { describe, expect, it, vi } from "vitest";
import { makeIslandRepo } from "@lararium/mesh";
import { foundThePlace, foundTheFace, retireFaceCheckpoint, KeyhiveProvider } from "../src/index.js";
import { faceAtomKeyFromSeed, groupSecretOpenerFromSeed, mintFaceAtomSeed, sealGroupSecret, verifyDeviceDelegation, personaGroupSecret } from "@lararium/mesh";

const vesselSeed = new Uint8Array(32).fill(41);
const rootSeed = new Uint8Array(32).fill(42);
const key = async (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;

describe("one random atom founds the face", () => {
  it("delegates, seals, and seats the atom; the place seed cannot reproduce its relation", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const atomSeed = mintFaceAtomSeed();
    const placeKey = await key(vesselSeed);
    const place = await foundThePlace({ repo, vesselSeed, hearthTrueName: "hearth" });
    const face = await foundTheFace({ repo, daemonHandle: place.daemonHandle, vesselSeed, placeVerifyingKey: placeKey,
      vesselDisplayName: "place", binding: { mode: "self-stood", signerSeed: rootSeed }, hearthTrueName: "hearth",
      nexusPubkey: placeKey, atomSeed });
    const atom = faceAtomKeyFromSeed(atomSeed, face.personaGroupId);
    expect(face.founderEdge.deviceVerifyingKey).toBe(atom.key);
    expect(atom.key).not.toBe(placeKey);
    expect(await verifyDeviceDelegation(face.founderEdge, face.signerDid)).toMatchObject({ ok: true });
    expect(face.groupSecretSeal.deviceKey).toBe(atom.key);
    expect(atom.opener.seal(face.groupSecretSeal)).not.toBeNull();
    expect(groupSecretOpenerFromSeed(vesselSeed).seal(face.groupSecretSeal)).toBeNull();
    const veil = new KeyhiveProvider();
    await veil.init({ seed: atomSeed, eventStore: { put: async () => {}, list: async () => [] }, archiveBytes: face.veilArchive });
    expect(await veil.whoami()).toBe(atom.did);
    await veil.dispose();
    expect(JSON.stringify(place.daemonHandle.doc())).not.toContain(placeKey);
    expect(JSON.stringify(place.daemonHandle.doc())).not.toContain(Buffer.from(atomSeed).toString("base64"));
    expect(JSON.stringify(place.daemonHandle.doc())).not.toContain(Buffer.from(face.veilArchive).toString("base64"));
    expect(groupSecretOpenerFromSeed(vesselSeed).deviceKey).not.toBe(atom.key);
    expect(Buffer.from(personaGroupSecret(vesselSeed, face.personaKelPrefix)).equals(Buffer.from(atom.opener.seal(face.groupSecretSeal)!))).toBe(false);
    const control = await sealGroupSecret({ opSeed: rootSeed, prefix: face.personaKelPrefix, deviceVerifyingKey: placeKey });
    expect(groupSecretOpenerFromSeed(vesselSeed).seal(control)).not.toBeNull();
  });

  it("re-enters the same planes after a cut between daemon writes", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const atomSeed = mintFaceAtomSeed();
    const placeKey = await key(vesselSeed);
    const place = await foundThePlace({ repo, vesselSeed, hearthTrueName: "hearth" });
    const input = { repo, daemonHandle: place.daemonHandle, vesselSeed, placeVerifyingKey: placeKey,
      vesselDisplayName: "place", binding: { mode: "self-stood" as const, signerSeed: rootSeed }, hearthTrueName: "hearth",
      nexusPubkey: placeKey, atomSeed };
    const original = place.daemonHandle.change.bind(place.daemonHandle);
    let writes = 0;
    const cut = vi.spyOn(place.daemonHandle, "change").mockImplementation(((fn: never) => {
      writes += 1;
      if (writes === 2) throw new Error("cut between face writes");
      return original(fn);
    }) as never);
    await expect(foundTheFace(input)).rejects.toThrow("cut between face writes");
    cut.mockRestore();
    expect(writes).toBe(2);
    const landed = await foundTheFace(input);
    const bytes = JSON.stringify(place.daemonHandle.doc());
    expect(await foundTheFace(input)).toEqual(landed);
    expect(JSON.stringify(place.daemonHandle.doc())).toBe(bytes);
  });

  it("names its write-ahead checkpoint opaquely and retires it at commit", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const atomSeed = mintFaceAtomSeed();
    const placeKey = await key(vesselSeed);
    const place = await foundThePlace({ repo, vesselSeed, hearthTrueName: "hearth" });
    await foundTheFace({ repo, daemonHandle: place.daemonHandle, placeVerifyingKey: placeKey,
      vesselDisplayName: "place", binding: { mode: "self-stood", signerSeed: rootSeed }, hearthTrueName: "hearth",
      nexusPubkey: placeKey, atomSeed });
    const atomKey = faceAtomKeyFromSeed(atomSeed, "founding").key;
    const titles = Object.keys(place.daemonHandle.doc()!.tiddlers).filter((title) => title.includes("face-founding-checkpoint/"));
    expect(titles).toHaveLength(1);
    expect(titles[0]).not.toContain(atomKey);
    await retireFaceCheckpoint(place.daemonHandle, atomSeed);
    expect(Object.keys(place.daemonHandle.doc()!.tiddlers).filter((title) => title.includes("face-founding-checkpoint/"))).toEqual([]);
  });
});
