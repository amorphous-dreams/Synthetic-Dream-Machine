/**
 * rolling-recovery — A GUARDIAN CAN ROTATE (the Genesis-Walker's KERI cure, approved 2026-09-06).
 *
 * The prefix keeps binding the GENESIS recovery set (anti-swap survives: no attacker incepts a
 * different set under the same name), while the CURRENT recovery authority becomes the head event's
 * ROLLING commitment: each rotation reveals against its predecessor's `nextRecoverySetHash` and
 * commits the next. Wren's guardians graft log-wise — 1-of-1-self → 2-of-3-friends → a fresh set
 * when a friend churns phones — each transition a signed, public, board-walkable event.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, hexToBytes } from "../src/crypto.js";
import {
  mintPersonaRotation, personaRotationSigningBytes, personaPrefixOf,
  verifyPersonaKel, verifyPersonaKelFull,
} from "../src/persona-kel.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";

const SEEDS = {
  op:    new Uint8Array(32).fill(11),
  fresh: new Uint8Array(32).fill(22),
  self:  new Uint8Array(32).fill(5),
  g1:    new Uint8Array(32).fill(1),
  g2:    new Uint8Array(32).fill(2),
  g3:    new Uint8Array(32).fill(3),
};
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, s));
const gsigner  = async (s: Uint8Array) => ({ signer: await pubOf(s), sign: signerOf(s) });

async function selfArmedInception() {
  const foundingOpKeyDid = await didOf(SEEDS.op);
  const selfPub = await pubOf(SEEDS.self);
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid,
    guardians: [guardianRecoveryRegistrationCard("mine", selfPub, null)],
    recoveryThreshold: 1,
  });
  return { foundingOpKeyDid, selfPub, prov };
}

async function friendSet() {
  const keys = await Promise.all([pubOf(SEEDS.g1), pubOf(SEEDS.g2), pubOf(SEEDS.g3)]);
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  const guardians = keys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null));
  return { keys, guardians, hash: sealKeySetHash(keys, 2) };
}

describe("the rolling recovery commitment", () => {
  test("★ A ROTATION GRAFTS THE NEXT GUARDIAN SET — 1-of-1-self commits 2-of-3-friends ★", async () => {
    const { selfPub, prov } = await selfArmedInception();
    const friends = await friendSet();

    const rot = await attestAndRotate({
      head:                 prov.inception,
      freshOpKeyDid:        await didOf(SEEDS.fresh),
      guardianRecoveryKeys: [selfPub],
      recoveryThreshold:    1,
      guardianSigners:      [await gsigner(SEEDS.self)],
      next:                 { guardians: friends.guardians, threshold: 2 },
    });
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    // the GENESIS commit stays fixed (the prefix's anti-swap wall) …
    expect(rot.event.recoverySetHash).toBe(prov.recoverySetHash);
    expect(rot.event.prefix).toBe(personaPrefixOf((await didOf(SEEDS.op)), prov.recoverySetHash));
    // … while the ROLLING commitment grafts the friends
    expect(rot.event.nextRecoverySetHash).toBe(friends.hash);
  });

  test("★ THE GRAFTED SET AUTHORIZES THE NEXT ROTATION — and the OLD set cannot ★", async () => {
    const { selfPub, prov } = await selfArmedInception();
    const friends = await friendSet();
    const mid = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: await didOf(SEEDS.fresh),
      guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
      guardianSigners: [await gsigner(SEEDS.self)],
      next: { guardians: friends.guardians, threshold: 2 },
    });
    expect(mid.ok).toBe(true);
    if (!mid.ok) return;

    // two friends rotate — the graft holds authority now
    const onward = await attestAndRotate({
      head: mid.event, freshOpKeyDid: await didOf(SEEDS.op),
      guardianRecoveryKeys: friends.keys, recoveryThreshold: 2,
      guardianSigners: [await gsigner(SEEDS.g1), await gsigner(SEEDS.g2)],
      next: { guardians: friends.guardians, threshold: 2 },
    });
    expect(onward.ok, onward.ok ? "" : onward.reason).toBe(true);

    // the retired self-set refuses past its graft
    const stale = await attestAndRotate({
      head: mid.event, freshOpKeyDid: await didOf(SEEDS.op),
      guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
      guardianSigners: [await gsigner(SEEDS.self)],
      next: { guardians: friends.guardians, threshold: 2 },
    });
    expect(stale.ok).toBe(false);
  });

  test("the grafted chain verifies whole, and a tampered graft breaks the cid", async () => {
    const { selfPub, prov } = await selfArmedInception();
    const friends = await friendSet();
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: await didOf(SEEDS.fresh),
      guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
      guardianSigners: [await gsigner(SEEDS.self)],
      next: { guardians: friends.guardians, threshold: 2 },
    });
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    const chain = [prov.inception, rot.event];
    expect(verifyPersonaKel(chain)).toBe(true);
    expect((await verifyPersonaKelFull(chain)).ok).toBe(true);

    const tampered = [prov.inception, { ...rot.event, nextRecoverySetHash: sealKeySetHash(["ff".repeat(32)], 1) }];
    expect(verifyPersonaKel(tampered)).toBe(false);
  });

  test("a rotation with NO next named carries the standing commitment forward — never a silent drop", async () => {
    const { selfPub, prov } = await selfArmedInception();
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: await didOf(SEEDS.fresh),
      guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
      guardianSigners: [await gsigner(SEEDS.self)],
    });
    expect(rot.ok).toBe(true);
    if (rot.ok) expect(rot.event.nextRecoverySetHash).toBe(prov.recoverySetHash);
  });
});
