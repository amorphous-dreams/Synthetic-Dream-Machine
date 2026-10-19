import { describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import { ed25519 as edCurve } from "@noble/curves/ed25519.js";
import { buildDeviceDelegation, buildDeviceDelegationRootHalf, countersignDeviceDelegation, deviceAtomProofBytes, verifyDeviceDelegation, type DeviceDelegationTiddler } from "../src/device-delegation.js";
import { didFromVerifyingKey } from "../src/lar-did.js";
import { hex } from "../src/crypto.js";

const rootSeed = new Uint8Array(32).fill(31);
const atomSeed = new Uint8Array(32).fill(32);
const otherSeed = new Uint8Array(32).fill(33);
const key = (seed: Uint8Array) => hex(edCurve.getPublicKey(seed));
const rootDid = didFromVerifyingKey(key(rootSeed));
const sign = (seed: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, seed));

describe("an atom countersigns its own delegation", () => {
  it("refuses a missing countersignature by name; a root half cannot stand as an edge", async () => {
    const half = await buildDeviceDelegationRootHalf({ personaRootSeed: rootSeed, deviceVerifyingKey: key(atomSeed), hearthTrueName: "hearth", boundEpoch: 0 });
    // @ts-expect-error the root's half is not a complete device edge
    const impossible: DeviceDelegationTiddler = half;
    expect(impossible).toBeDefined();
    expect(await verifyDeviceDelegation(half as DeviceDelegationTiddler, rootDid)).toMatchObject({ ok: false, reason: "atom countersignature missing" });
    const full = await countersignDeviceDelegation(half, sign(atomSeed));
    const { atomSignature: _removed, ...stripped } = full;
    expect(await verifyDeviceDelegation(stripped as DeviceDelegationTiddler, rootDid)).toMatchObject({ ok: false, reason: "atom countersignature missing" });
  });

  it("refuses another key, a swapped root signature, and a tampered hearth", async () => {
    const half = await buildDeviceDelegationRootHalf({ personaRootSeed: rootSeed, deviceVerifyingKey: key(atomSeed), hearthTrueName: "hearth", boundEpoch: 0 });
    const wrong = await countersignDeviceDelegation(half, sign(otherSeed));
    expect(await verifyDeviceDelegation(wrong, rootDid)).toMatchObject({ ok: false, reason: "atom countersignature mismatch" });
    const full = await countersignDeviceDelegation(half, sign(atomSeed));
    expect(await verifyDeviceDelegation({ ...full, signature: "0".repeat(128) }, rootDid)).toMatchObject({ ok: false, reason: "atom countersignature mismatch" });
    expect(await verifyDeviceDelegation({ ...full, hearthTrueName: "elsewhere" }, rootDid)).toMatchObject({ ok: false });
  });

  it("verifies the two signatures and binds the root signature into the atom proof", async () => {
    const full = await buildDeviceDelegation({ personaRootSeed: rootSeed, atomSeed, hearthTrueName: "hearth", boundEpoch: 0 });
    expect(full.deviceVerifyingKey).toBe(key(atomSeed));
    expect(await verifyDeviceDelegation(full, rootDid)).toMatchObject({ ok: true });
    expect(Buffer.from(deviceAtomProofBytes(full)).toString()).toContain(full.signature);
  });
});
