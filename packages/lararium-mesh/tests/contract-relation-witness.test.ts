import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  buildDeviceDelegation,
  buildContractRelationWitness,
  deviceDelegationRecordDigest,
  verifyContractRelationWitness,
} from "../src/index.js";

const ROOT_SEED = new Uint8Array(32).fill(7);
const DEVICE_SEED = new Uint8Array(32).fill(8);
const NEXUS = "ab".repeat(32);
const RESOURCE = "lar:///ha.ka.ba/nexus/carriage/ab";

async function fixture() {
  const deviceVerifyingKey = Buffer.from(await ed25519.getPublicKeyAsync(DEVICE_SEED)).toString("hex");
  const edge = await buildDeviceDelegation({
    personaRootSeed: ROOT_SEED,
    deviceVerifyingKey,
    hearthTrueName: "sha256-hearth",
    issuedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2027-01-01T00:00:00Z",
    boundEpoch: 4,
  });
  const witness = await buildContractRelationWitness({
    personaRootSeed: ROOT_SEED,
    edge,
    relationResource: RESOURCE,
    targetNexusPubkey: NEXUS,
    sealEpochCid: "sha256-charter",
    memberVersion: 3,
  });
  return { edge, witness };
}

describe("contract relation witness canonical seam", () => {
  test("binds the complete canonical device-delegation record", async () => {
    const { edge, witness } = await fixture();
    expect(witness.deviceEdgeDigest).toBe(deviceDelegationRecordDigest(edge));
    expect(witness.deviceEdgeDigest).not.toBe(deviceDelegationRecordDigest({ ...edge, hearthTrueName: "other" }));
  });

  test("verifies persona-root signature and exact target/resource/edge bindings", async () => {
    const { edge, witness } = await fixture();
    await expect(verifyContractRelationWitness(witness, {
      edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
    })).resolves.toEqual({ ok: true });
    await expect(verifyContractRelationWitness({ ...witness, relationResource: RESOURCE + "/other" }, {
      edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
    })).resolves.toMatchObject({ ok: false, reason: "relation resource mismatch" });
    await expect(verifyContractRelationWitness({ ...witness, targetNexusPubkey: "cd".repeat(32) }, {
      edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
    })).resolves.toMatchObject({ ok: false, reason: "target Nexus mismatch" });
    await expect(verifyContractRelationWitness({ ...witness, deviceEdgeDigest: "00".repeat(32) }, {
      edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
    })).resolves.toMatchObject({ ok: false, reason: "device edge digest mismatch" });
  });

  test("rejects a signature made for a different relation", async () => {
    const { edge, witness } = await fixture();
    await expect(verifyContractRelationWitness({ ...witness, signature: "00".repeat(64) }, {
      edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
    })).resolves.toMatchObject({ ok: false, reason: "signature mismatch" });
  });

  test("refuses malformed identity, key, digest, and signature spellings", async () => {
    const { edge, witness } = await fixture();
    for (const bad of [
      { personaRootDid: witness.personaRootDid.toUpperCase() },
      { vesselVerifyingKey: "AA".repeat(32) },
      { deviceEdgeDigest: "not-a-digest" },
      { signature: "00" },
    ]) {
      await expect(verifyContractRelationWitness({ ...witness, ...bad }, {
        edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
      })).resolves.toMatchObject({ ok: false, reason: "malformed witness" });
    }
  });

  test("does not let an unmodeled edge field fork its canonical digest", async () => {
    const { edge } = await fixture();
    expect(deviceDelegationRecordDigest({ ...edge, unmodeled: "ignored" } as typeof edge & { unmodeled: string }))
      .toBe(deviceDelegationRecordDigest(edge));
  });
});
