/**
 * The cryptographic seam for a carriage relation presentation.
 *
 * This module proves only that a persona root signed a presentation binding one
 * exact vessel edge to one exact Nexus/resource.  It does not inspect the local
 * carriage board and therefore does not grant membership or mutate gate policy.
 * Current authority remains a receiver-local frontier question.
 */
import * as ed25519 from "@noble/ed25519";
import { CARRIAGE_RELATION_WITNESS_DOMAIN } from "./domains.js";
import { canonicalJsonBytes, hex, hexToBytes, sha256HexBytesSync } from "./crypto.js";
import { didFromVerifyingKey, isLarDid, verifyingKeyFromDid } from "./lar-did.js";
import type { DeviceDelegationTiddler } from "./device-delegation.js";
import { verifyDeviceDelegation } from "./device-delegation.js";
import type { ContractRelationWitness } from "./auth-wire.js";
import type { CarriageFoldDetails } from "./carriage-registry.js";

type WitnessPayload = Omit<ContractRelationWitness, "signature">;

/** Canonical bytes for the complete edge record (signature included). */
export function deviceDelegationRecordBytes(edge: DeviceDelegationTiddler): Uint8Array {
  // Project the complete known record deliberately: untrusted object extensions must
  // not create a second digest format, while every load-bearing edge field is included.
  return canonicalJsonBytes({
    kind: edge.kind,
    personaRootDid: edge.personaRootDid,
    deviceDid: edge.deviceDid,
    deviceVerifyingKey: edge.deviceVerifyingKey,
    hearthTrueName: edge.hearthTrueName,
    issuedAt: edge.issuedAt,
    expiresAt: edge.expiresAt,
    boundEpoch: edge.boundEpoch,
    signature: edge.signature,
  });
}

/** Digest of the complete canonical edge, including its operator signature. */
export function deviceDelegationRecordDigest(edge: DeviceDelegationTiddler): string {
  return sha256HexBytesSync(deviceDelegationRecordBytes(edge));
}

/** Canonical witness bytes; the signature is deliberately excluded from the preimage. */
export function contractRelationWitnessBytes(payload: WitnessPayload): Uint8Array {
  return canonicalJsonBytes({ domain: CARRIAGE_RELATION_WITNESS_DOMAIN, ...payload });
}

/** Mint a transient witness. The persona root signs; the vessel key never signs this relation. */
export async function buildContractRelationWitness(args: {
  personaRootSeed: Uint8Array;
  edge: DeviceDelegationTiddler;
  relationResource: string;
  targetNexusPubkey: string;
  sealEpochCid: string;
  memberVersion: number;
}): Promise<ContractRelationWitness> {
  const personaRootDid = didFromVerifyingKey(hex(await ed25519.getPublicKeyAsync(args.personaRootSeed)));
  if (personaRootDid !== args.edge.personaRootDid) throw new Error("persona root does not match device edge");
  const payload: WitnessPayload = {
    kind: "contract-relation-witness/v1",
    relation: "carriage",
    relationResource: args.relationResource,
    targetNexusPubkey: args.targetNexusPubkey,
    sealEpochCid: args.sealEpochCid,
    memberVersion: args.memberVersion,
    personaRootDid,
    vesselVerifyingKey: args.edge.deviceVerifyingKey,
    deviceEdgeDigest: deviceDelegationRecordDigest(args.edge),
  };
  const signature = hex(await ed25519.signAsync(contractRelationWitnessBytes(payload), args.personaRootSeed));
  return { ...payload, signature };
}

/** Verify relation bindings and the persona-root signature; no board/authority interpretation. */
export async function verifyContractRelationWitness(
  witness: ContractRelationWitness,
  expected: { edge: DeviceDelegationTiddler; relationResource: string; targetNexusPubkey: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (witness.kind !== "contract-relation-witness/v1" || witness.relation !== "carriage") return { ok: false, reason: "malformed witness" };
    if (!isLarDid(witness.personaRootDid) || !/^[0-9a-f]{64}$/.test(witness.vesselVerifyingKey) ||
        !/^[0-9a-f]{128}$/.test(witness.signature) || !/^[0-9a-f]{64}$/.test(witness.deviceEdgeDigest) ||
        !Number.isSafeInteger(witness.memberVersion) || witness.memberVersion < 0 ||
        witness.relationResource.length === 0 || witness.targetNexusPubkey.length === 0 || witness.sealEpochCid.length === 0) {
      return { ok: false, reason: "malformed witness" };
    }
    if (witness.relationResource !== expected.relationResource) return { ok: false, reason: "relation resource mismatch" };
    if (witness.targetNexusPubkey !== expected.targetNexusPubkey) return { ok: false, reason: "target Nexus mismatch" };
    if (witness.personaRootDid !== expected.edge.personaRootDid) return { ok: false, reason: "persona root mismatch" };
    if (witness.vesselVerifyingKey !== expected.edge.deviceVerifyingKey) return { ok: false, reason: "vessel key mismatch" };
    if (witness.deviceEdgeDigest !== deviceDelegationRecordDigest(expected.edge)) return { ok: false, reason: "device edge digest mismatch" };
    const payload: WitnessPayload = {
      kind: witness.kind,
      relation: witness.relation,
      relationResource: witness.relationResource,
      targetNexusPubkey: witness.targetNexusPubkey,
      sealEpochCid: witness.sealEpochCid,
      memberVersion: witness.memberVersion,
      personaRootDid: witness.personaRootDid,
      vesselVerifyingKey: witness.vesselVerifyingKey,
      deviceEdgeDigest: witness.deviceEdgeDigest,
    };
    const ok = await ed25519.verifyAsync(
      hexToBytes(witness.signature),
      contractRelationWitnessBytes(payload),
      hexToBytes(verifyingKeyFromDid(witness.personaRootDid)),
      { zip215: false },
    );
    return ok ? { ok: true } : { ok: false, reason: "signature mismatch" };
  } catch {
    return { ok: false, reason: "malformed witness" };
  }
}

export type ContractRelationFrontierState = "valid" | "pending" | "stale" | "revoked" | "equivocal" | "rejected";

export interface ContractRelationFrontierVerdict {
  readonly state: ContractRelationFrontierState;
  readonly reason: string;
  readonly charterEpochCid: string | null;
}

/**
 * Pure receiver-local composition of cryptographic evidence and an already-folded
 * carriage frontier. This is deliberately not a gate hook: callers must provide
 * the local fold, and every absent/ambiguous frontier remains non-valid.
 */
export async function verifyContractRelationFrontier(args: {
  witness: ContractRelationWitness;
  edge: DeviceDelegationTiddler;
  frontier: CarriageFoldDetails | undefined;
  relationResource: string;
  targetNexusPubkey: string;
}): Promise<ContractRelationFrontierVerdict> {
  const charterEpochCid = args.frontier?.charterEpochCid ?? null;
  const refused = (state: ContractRelationFrontierState, reason: string): ContractRelationFrontierVerdict => ({ state, reason, charterEpochCid });
  if (!args.frontier) return refused("pending", "carriage frontier unavailable");
  const edgeEvidence = await verifyDeviceDelegation(args.edge, args.edge.personaRootDid);
  if (!edgeEvidence.ok) return refused("rejected", `device edge ${edgeEvidence.reason ?? "invalid"}`);
  const witnessEvidence = await verifyContractRelationWitness(args.witness, {
    edge: args.edge, relationResource: args.relationResource, targetNexusPubkey: args.targetNexusPubkey,
  });
  if (!witnessEvidence.ok) return refused("rejected", `relation witness ${witnessEvidence.reason ?? "invalid"}`);
  if (args.frontier.charterEpochCid !== args.witness.sealEpochCid) return refused("stale", "charter frontier mismatch");
  const nym = verifyingKeyFromDid(args.witness.personaRootDid).toLowerCase();
  const localEntries = args.frontier.entries.filter((entry) =>
    entry.nym === nym && entry.version >= 0 && entry.counted &&
    (entry.action === "admit" || entry.action === "revoke"));
  const highestVersion = localEntries.reduce((max, entry) => Math.max(max, entry.version), -1);
  if (highestVersion < 0) return refused("pending", "accepted carriage member version unavailable");
  const current = localEntries.filter((entry) => entry.version === highestVersion);
  // foldCarriageDetails marks every same-version admit/revoke detail equivocal. Keep
  // that refusal visible even if an older accepted entry is also present.
  const currentEquivocal = current.find((entry) => entry.state === "equivocal");
  if (currentEquivocal) return refused("equivocal", currentEquivocal.reason);
  const winner = current.find((entry) => entry.state === "accepted" || entry.state === "revoked") ?? current[0];
  if (!winner) return refused("pending", "accepted carriage member version unavailable");
  if (winner.state === "revoked") return refused("revoked", winner.reason);
  if (winner.state === "accepted" && args.witness.memberVersion < highestVersion) return refused("stale", "carriage member version superseded");
  if (winner.state !== "accepted" || args.witness.memberVersion !== highestVersion) return refused("pending", "accepted carriage member version unavailable");
  if (!args.frontier.members.has(nym)) return refused("rejected", "frontier member set contradicts accepted detail");
  return { state: "valid", reason: "accepted carriage frontier", charterEpochCid };
}
