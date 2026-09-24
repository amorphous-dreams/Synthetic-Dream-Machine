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
  admitToRealm,
  buildDeviceDelegation,
  buildAuthResponse,
  DEFAULT_JOIN_POLICY,
  mintEnrollmentOffer,
  sealPersonaGrant,
  openPersonaGrant,
  signCabalInvite,
  signHandleCard,
  verifyAuthProof,
  verifyDeviceDelegation,
  verifyHandleCard,
  mintHandleInception,
  ed25519SignerFromSeed,
  type AdmissionDials,
  type DeviceDelegationTiddler,
} from "@lararium/mesh";
import { hex, hexToBytes } from "@lararium/mesh/crypto";
import { contractNymOf } from "../src/nexus-carriage.js";

type AuditRow = {
  relation: string;
  inputs: Record<string, unknown>;
  outcome: Record<string, unknown>;
};

const auditRows: AuditRow[] = [];
const opSeed = new Uint8Array(32).fill(31);
const deviceSeed = new Uint8Array(32).fill(32);
const peerSeed = new Uint8Array(32).fill(33);
const issuedAt = "2026-09-01T00:00:00.000Z";
const expiresAt = "2026-12-31T00:00:00.000Z";
const now = Date.parse("2026-09-23T00:00:00.000Z");
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
    issuedAt,
    expiresAt,
    boundEpoch,
  });
}

describe("P1 authority relations — characterization witness", () => {
  test("records device/face delegation and exposes the missing expectedEpoch fallback", async () => {
    const edge = await delegation();
    const root = `0x${await pubOf(opSeed)}`;
    const withEpoch = await verifyDeviceDelegation(edge, root, { now, expectedEpoch: 5 });
    const staleWithEpoch = await verifyDeviceDelegation(edge, root, { now, expectedEpoch: 6 });
    // This is the open seam, recorded without selecting a policy: the same signed edge passes when
    // the caller omits the current resource frontier. A future D-AE choice may alter this contract.
    const omittedEpoch = await verifyDeviceDelegation(edge, root, { now });
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

  test("records daemon PoP and exposes its opt-in local-clock freshness path", async () => {
    const peerPubKey = await pubOf(peerSeed);
    const challenge = {
      nonce: "ab12cd",
      gatePubKey: "00".repeat(32),
      peerPubKey,
      aud: "lar:///ha.ka.ba/bags/daemon",
      // PoP's timestamp is a replay window witness, kept separate from the delegation's long lease.
      ts: new Date(now).toISOString(),
    };
    const proof = await buildAuthResponse({
      ...challenge,
      contactCard: "audit-card",
      sign: signWith(peerSeed),
    });
    const signatureOnly = await verifyAuthProof({ ...challenge, sig: proof.sig, ts: proof.ts! });
    const clockBound = await verifyAuthProof({ ...challenge, sig: proof.sig, ts: proof.ts!, now });
    const staleClock = await verifyAuthProof({
      ...challenge,
      sig: proof.sig,
      ts: proof.ts!,
      now: now + 10 * 60_000,
    });
    auditRows.push({
      relation: "daemon-proof-of-possession",
      inputs: { nonce: challenge.nonce, audience: challenge.aud, suppliedNow: true, omittedNow: true },
      outcome: {
        signatureOnly: signatureOnly.ok,
        clockBound: clockBound.ok,
        staleClock: staleClock.reason,
        seam: "now optional; omitted verifier skips freshness window",
      },
    });
    expect(signatureOnly).toMatchObject({ ok: true });
    expect(clockBound).toMatchObject({ ok: true });
    expect(staleClock).toMatchObject({ ok: false, reason: "proof outside freshness window" });
  });

  test("records the contract edge relation at the node gate", async () => {
    const edge = await delegation();
    const deviceKey = await pubOf(deviceSeed);
    const presentedIdentifier = `identifier:${deviceKey}`;
    const nym = await contractNymOf(edge, presentedIdentifier, { expectedEpoch: 0 });
    const wrongVessel = await contractNymOf(edge, `identifier:${await pubOf(peerSeed)}`, { expectedEpoch: 0 });
    auditRows.push({
      relation: "contract-edge",
      inputs: { presentedVesselKey: deviceKey, boundEpoch: edge.boundEpoch, gateNow: now },
      outcome: { matchingVessel: nym, wrongVessel, authority: "offline signature + local freshness; membership pin remains downstream" },
    });
    expect(nym).toBe(await pubOf(opSeed));
    expect(wrongVessel).toBeNull();
  });

  test("records persona admission as a local KEL-head relation with carried expiry", async () => {
    const persona = new Uint8Array(32).fill(34);
    const device = await pubOf(deviceSeed);
    const personaKey = await pubOf(persona);
    const prefix = "persona-audit-prefix";
    const fixedNow = 1_000_000;
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: device, now: fixedNow, expiryMs: 60_000 });
    const { sealed } = await sealPersonaGrant({
      offer,
      personaRef: { prefix, verifyingKey: personaKey },
      personaSigner: ed25519SignerFromSeed(persona),
      now: fixedNow,
    });
    const admitted = await openPersonaGrant({
      sealed,
      secret,
      resolveHeadOpKey: (candidate) => candidate === prefix ? personaKey : null,
      now: fixedNow + 1,
    });
    const unknownHead = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: () => null, now: fixedNow + 1 });
    auditRows.push({
      relation: "persona-admission",
      inputs: { prefix, targetVessel: device, headResolver: "local KEL", now: fixedNow + 1 },
      outcome: { admitted: admitted.ok, unknownHead: unknownHead.reason, authority: "prefix head + nonce + carried expiry" },
    });
    expect(admitted.ok).toBe(true);
    expect(unknownHead).toMatchObject({ ok: false });
  });

  test("records handle recognition and its optional wall-clock lease", async () => {
    const handleSeed = new Uint8Array(32).fill(35);
    const handleKey = `0x${await pubOf(handleSeed)}`;
    const chain = [mintHandleInception(handleKey, handleKey, "ab".repeat(32))];
    const card = await signHandleCard({
      nym: chain[0]!.prefix,
      chain,
      glamour: "audit-face",
      version: 1,
      prev: null,
      expiry: now + 60_000,
      standing: null,
      fleetProof: null,
    }, signWith(handleSeed));
    const noClock = await verifyHandleCard(card);
    const clockBound = await verifyHandleCard(card, now);
    const staleClock = await verifyHandleCard(card, now + 120_000);
    auditRows.push({
      relation: "handle-recognition",
      inputs: { nym: card.nym, version: card.version, expiry: card.expiry, suppliedNow: true, omittedNow: true },
      outcome: { noClock: noClock.ok, clockBound: clockBound.ok, staleClock: staleClock.reject, seam: "now optional; no-clock pass is last-known face" },
    });
    expect(noClock).toMatchObject({ ok: true, tier: 1 });
    expect(clockBound).toMatchObject({ ok: true, tier: 1 });
    expect(staleClock).toMatchObject({ ok: false, reject: "expired" });
  });

  test("records Cabal admission's epoch fence separately from invite expiry text", async () => {
    const voucherSeed = new Uint8Array(32).fill(36);
    const voucherDid = await pubOf(voucherSeed);
    const verify = (bytes: Uint8Array, sig: string, did: string): Promise<boolean> =>
      ed25519.verifyAsync(hexToBytes(sig), bytes, hexToBytes(did)).catch(() => false);
    const invite = await signCabalInvite({
      realmDocIdHex: realm,
      joinerIdentityHex: joiner,
      voucherDid,
      expiresAt: "wall-clock-text-kept-out-of-gate",
      boundEpoch: "4",
    }, signWith(voucherSeed));
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
      inputs: { boundEpoch: invite.boundEpoch, effectiveEpochAtBound: 4, effectiveEpochRolled: 5, expiresAt: invite.expiresAt },
      outcome: { atBound: atBound.admitted, rolled: rolled.refusal, authority: "effectiveEpoch max-register; expiresAt is not consulted" },
    });
    expect(atBound.admitted).toBe(true);
    expect(rolled).toMatchObject({ admitted: false, refusal: "expired" });
  });

  test("keeps the audit rows machine-readable and relation-scoped", () => {
    expect(auditRows).toHaveLength(6);
    expect(auditRows.map((row) => row.relation)).toEqual([
      "device-face-delegation",
      "daemon-proof-of-possession",
      "contract-edge",
      "persona-admission",
      "handle-recognition",
      "cabal-vouch-admission",
    ]);
    expect(auditRows.every((row) => row.inputs && row.outcome)).toBe(true);
  });
});
