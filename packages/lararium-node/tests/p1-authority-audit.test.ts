/**
 * P1 authority audit witness.
 *
 * This is deliberately a characterization test, not a policy implementation.  Each row records the
 * inputs handed to one existing relation gate and the observable result.  The two `missing` rows are
 * red-first evidence for the open D-AE seam: an epoch or verifier clock is optional at today's API.
 * No relation is silently promoted to a universal epoch by this witness.
 */
import { describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  buildDeviceDelegation,
  buildAuthResponse,
  DEFAULT_JOIN_POLICY,
  signCabalInvite,
  signHandleCard,
  verifyAuthProof,
  verifyDeviceDelegation,
  verifyHandleCard,
  mintHandleInception,
  type AdmissionDials,
  type DeviceDelegationTiddler,
} from "@lararium/mesh";
import { hex, hexToBytes } from "@lararium/mesh/crypto";
import { admitToRealm } from "../src/realm-admission.js";

type AuditRow = {
  relation: string;
  inputs: Record<string, unknown>;
  outcome: Record<string, unknown>;
};

const auditRows: AuditRow[] = [];
const opSeed = new Uint8Array(32).fill(31);
const deviceSeed = new Uint8Array(32).fill(32);
const peerSeed = new Uint8Array(32).fill(33);
const realm = "a".repeat(64);
const joiner = "b".repeat(64);
const dials: AdmissionDials = { epsilon: 0.15, beta: 0.9, rho: 1, supply: 1, alpha: 0.5 };

const pubOf = (seed: Uint8Array): Promise<string> => ed25519.getPublicKeyAsync(seed).then(hex);
const signWith = (seed: Uint8Array) => (bytes: Uint8Array): Promise<string> => ed25519.signAsync(bytes, seed).then(hex);

async function delegation(boundEpoch = 5): Promise<DeviceDelegationTiddler> {
  return buildDeviceDelegation({
    personaRootSeed: opSeed,
    deviceVerifyingKey: await pubOf(deviceSeed),
    hearthTrueName: "",
    boundEpoch,
  });
}

describe("P1 authority relations — characterization witness", () => {
  test("records device/face delegation and exposes the missing expectedEpoch fallback", async () => {
    const edge = await delegation();
    const root = `0x${await pubOf(opSeed)}`;
    const withEpoch = await verifyDeviceDelegation(edge, root, { expectedEpoch: 5 });
    const staleWithEpoch = await verifyDeviceDelegation(edge, root, { expectedEpoch: 6 });
    // This is the open seam, recorded without selecting a policy: the same signed edge passes when
    // the caller omits the current resource frontier. A future D-AE choice may alter this contract.
    const omittedEpoch = await verifyDeviceDelegation(edge, root);
    auditRows.push({
      relation: "device-face-delegation",
      inputs: { boundEpoch: edge.boundEpoch, expectedEpoch: 5, staleExpectedEpoch: 6, omittedExpectedEpoch: true },
      outcome: {
        withEpoch: withEpoch.ok,
        staleWithEpoch: staleWithEpoch.reason,
        omittedEpoch: omittedEpoch.ok,
        seam: "expectedEpoch optional; omission checks signature+pin+clock only",
      },
    });
    expect(withEpoch.ok).toBe(true);
    expect(staleWithEpoch).toMatchObject({ ok: false });
    expect(omittedEpoch).toMatchObject({ ok: true });
  });

  test("records daemon PoP: the gate's single-use nonce is its only freshness", async () => {
    const peerPubKey = await pubOf(peerSeed);
    const challenge = {
      nonce: "ab12cd",
      gatePubKey: "00".repeat(32),
      peerPubKey,
      aud: "lar:///ha.ka.ba/bags/daemon",
    };
    const proof = await buildAuthResponse({
      ...challenge,
      contactCard: "audit-card",
      leafNonce: "ef".repeat(32),
      sign: signWith(peerSeed),
    });
    const fresh  = await verifyAuthProof({ ...challenge, sig: proof.sig });
    const replay = await verifyAuthProof({ ...challenge, nonce: "cd34ef", sig: proof.sig });
    auditRows.push({
      relation: "daemon-proof-of-possession",
      inputs: { nonce: challenge.nonce, audience: challenge.aud },
      outcome: {
        fresh:  fresh.ok,
        replay: replay.ok,
        seam: "no clock on the wire; a proof binds the gate's nonce alone",
      },
    });
    expect(fresh).toMatchObject({ ok: true });
    expect(replay).toMatchObject({ ok: false });
  });

  test("records handle recognition from a self-certifying causal act", async () => {
    const handleSeed = new Uint8Array(32).fill(35);
    const handleKey = `0x${await pubOf(handleSeed)}`;
    const chain = [mintHandleInception(handleKey, handleKey, "ab".repeat(32), `hkeynext-${"cd".repeat(32)}`)];
    const card = await signHandleCard({
      nym: chain[0]!.prefix,
      chain,
      glamour: "audit-face",
      parents: [],
      standing: null,
      fleetProof: null,
    }, signWith(handleSeed));
    const verified = await verifyHandleCard(card);
    auditRows.push({
      relation: "handle-recognition",
      inputs: { nym: card.nym, actCid: card.actCid, parents: card.parents, ownerHeadResolver: false },
      outcome: { verified: verified.ok, tier: verified.tier, seam: "causal identity is separate from future freshness observation" },
    });
    expect(verified).toMatchObject({ ok: true, tier: 1, nym: card.nym });
    expect(card.parents).toEqual([]);
    expect(card.actCid).toMatch(/^[0-9a-f]{64}$/);
  });

  test("records Cabal admission's epoch fence — the invite carries no expiry text to be separate from", async () => {
    const voucherSeed = new Uint8Array(32).fill(36);
    const voucherDid = await pubOf(voucherSeed);
    const verify = (bytes: Uint8Array, sig: string, did: string): Promise<boolean> =>
      ed25519.verifyAsync(hexToBytes(sig), bytes, hexToBytes(did)).catch(() => false);
    const invite = await signCabalInvite({
      realmDocIdHex: realm,
      joinerIdentityHex: joiner,
      voucherDid,
      boundEpoch: "4",
    }, signWith(voucherSeed));
    expect(invite).not.toHaveProperty("expiresAt");   // the field is GONE, not merely unread
    const atBound = await admitToRealm({
      policy: DEFAULT_JOIN_POLICY, realmDocIdHex: realm, joinerIdentityHex: joiner, invite,
      effectiveEpoch: 4, verify, edges: [], seed: "seed", applicant: joiner, dials,
    });
    const rolled = await admitToRealm({
      policy: DEFAULT_JOIN_POLICY, realmDocIdHex: realm, joinerIdentityHex: joiner, invite,
      effectiveEpoch: 5, verify, edges: [], seed: "seed", applicant: joiner, dials,
    });
    auditRows.push({
      relation: "cabal-vouch-admission",
      inputs: { boundEpoch: invite.boundEpoch, effectiveEpochAtBound: 4, effectiveEpochRolled: 5 },
      outcome: { atBound: atBound.admitted, rolled: rolled.refusal, authority: "effectiveEpoch max-register; no expiresAt field exists to consult" },
    });
    expect(atBound.admitted).toBe(true);
    expect(rolled).toMatchObject({ admitted: false, refusal: "expired" });
  });

  test("keeps the audit rows machine-readable and relation-scoped", () => {
    expect(auditRows).toHaveLength(4);
    expect(auditRows.map((row) => row.relation)).toEqual([
      "device-face-delegation",
      "daemon-proof-of-possession",
      "handle-recognition",
      "cabal-vouch-admission",
    ]);
    expect(auditRows.every((row) => row.inputs && row.outcome)).toBe(true);
  });
});
