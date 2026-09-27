import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  buildDeviceDelegation,
  buildContractRelationWitness,
  deviceDelegationRecordDigest,
  verifyContractRelationWitness,
  verifyContractRelationFrontier,
} from "../src/index.js";
import type { CarriageFoldEntryDetail } from "../src/carriage-registry.js";

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
    memberEvidenceCid: "aa".repeat(32),
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
    await expect(verifyContractRelationWitness({ ...witness, memberEvidenceCid: "bb".repeat(32) }, {
      edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS,
    })).resolves.toMatchObject({ ok: false, reason: "signature mismatch" });
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

  test("composes a local accepted frontier without granting through the transport witness", async () => {
    const { edge, witness } = await fixture();
    const base = { nym: witness.personaRootDid.slice(2), action: "admit" as const, parents: [] as string[],
      evidenceCid: "aa".repeat(32), sealEpochCid: witness.sealEpochCid, counted: true, state: "accepted" as const, reason: "causal-head-accepted" };
    await expect(verifyContractRelationFrontier({ witness, edge, relationResource: RESOURCE,
      targetNexusPubkey: NEXUS, frontier: { charterEpochCid: witness.sealEpochCid, members: new Set([base.nym]), entries: [base] } }))
      .resolves.toMatchObject({ state: "held" });
  });

  test("names absent, stale, revoked, and equivocal frontiers instead of lifting authority", async () => {
    const { edge, witness } = await fixture();
    const base = { nym: witness.personaRootDid.slice(2), action: "admit" as const, parents: [] as string[],
      evidenceCid: "aa".repeat(32), sealEpochCid: witness.sealEpochCid, counted: true, state: "accepted" as const, reason: "causal-head-accepted" };
    const args = { witness, edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS };
    await expect(verifyContractRelationFrontier({ ...args, frontier: undefined })).resolves.toMatchObject({ state: "unavailable" });
    await expect(verifyContractRelationFrontier({ ...args, frontier: { charterEpochCid: "old", members: new Set(), entries: [base] } })).resolves.toMatchObject({ state: "superseded" });
    await expect(verifyContractRelationFrontier({ ...args, frontier: { charterEpochCid: witness.sealEpochCid, members: new Set(), entries: [{ ...base, state: "revoked", reason: "causal-head-revoked" }] } })).resolves.toMatchObject({ state: "withdrawn" });
    await expect(verifyContractRelationFrontier({ ...args, frontier: { charterEpochCid: witness.sealEpochCid, members: new Set(), entries: [{ ...base, state: "unsettled", reason: "concurrent-contradictory-heads" }] } })).resolves.toMatchObject({ state: "unsettled" });
  });

  test("interprets the highest local winner before reading an older witness version", async () => {
    const { edge, witness } = await fixture();
    const v3: CarriageFoldEntryDetail = { nym: witness.personaRootDid.slice(2), action: "admit", parents: [], evidenceCid: "aa".repeat(32),
      sealEpochCid: witness.sealEpochCid, counted: true, state: "ignored", reason: "superseded" };
    const args = { witness, edge, relationResource: RESOURCE, targetNexusPubkey: NEXUS };
    const frontier = (latest: CarriageFoldEntryDetail) => ({ charterEpochCid: witness.sealEpochCid, members: new Set<string>(), entries: [v3, latest] });
    await expect(verifyContractRelationFrontier({ ...args, frontier: frontier({ ...v3, parents: [v3.evidenceCid], evidenceCid: "bb".repeat(32), action: "revoke", state: "revoked", reason: "causal-head-revoked" }) })).resolves.toMatchObject({ state: "withdrawn" });
    await expect(verifyContractRelationFrontier({ ...args, frontier: frontier({ ...v3, parents: [v3.evidenceCid], evidenceCid: "bb".repeat(32), state: "unsettled", reason: "concurrent-contradictory-heads" }) })).resolves.toMatchObject({ state: "unsettled" });
    await expect(verifyContractRelationFrontier({ ...args, frontier: frontier({ ...v3, parents: [v3.evidenceCid], evidenceCid: "bb".repeat(32), state: "accepted", reason: "causal-head-accepted" }) })).resolves.toMatchObject({ state: "superseded" });
    await expect(verifyContractRelationFrontier({ ...args, frontier: { charterEpochCid: witness.sealEpochCid, members: new Set([v3.nym]), entries: [{ ...v3, state: "accepted", reason: "causal-head-accepted" }] } })).resolves.toMatchObject({ state: "held" });
  });

  test("ignores uncounted or carrier evidence when deriving the member winner", async () => {
    const { edge, witness } = await fixture();
    const nym = witness.personaRootDid.slice(2);
    const accepted = { nym, action: "admit" as const, parents: [] as string[], evidenceCid: "aa".repeat(32), sealEpochCid: witness.sealEpochCid,
      counted: true, state: "accepted" as const, reason: "causal-head-accepted" };
    const frontier = {
      charterEpochCid: witness.sealEpochCid,
      members: new Set([nym]),
      entries: [accepted,
        { ...accepted, evidenceCid: "bb".repeat(32), counted: false, state: "ignored" as const, reason: "malformed-entry" },
        { ...accepted, evidenceCid: "cc".repeat(32), action: "carry" as const, state: "ignored" as const, reason: "non-member-action" },
      ],
    };
    await expect(verifyContractRelationFrontier({ witness, edge, relationResource: RESOURCE,
      targetNexusPubkey: NEXUS, frontier })).resolves.toMatchObject({ state: "held" });
  });
});
