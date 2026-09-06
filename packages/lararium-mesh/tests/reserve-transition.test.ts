/**
 * reserve-transition — THE MULTITUDE-OF-ONE BECOMES REAL HANDS, cross-signed and witnessed.
 *
 * The growth rite's record (TUF cross-sign + the ceremony witness-report shape, house-style): the OLD
 * seated set signs the handoff, the NEW set countersigns the receipt, and independent witnesses — keys
 * belonging to NEITHER set — attest the rite was walked. Independence is what no quorum arithmetic can
 * prove about itself; here it becomes checkable at the key level.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  reserveTransitionBytes, mintReserveTransition, verifyReserveTransition,
} from "../src/reserve-transition.js";

const S = {
  old1: new Uint8Array(32).fill(1), old2: new Uint8Array(32).fill(2), old3: new Uint8Array(32).fill(3),
  new1: new Uint8Array(32).fill(4), new2: new Uint8Array(32).fill(5), new3: new Uint8Array(32).fill(6),
  wit:  new Uint8Array(32).fill(7),
};
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => async (b: Uint8Array) => hex(await ed.signAsync(b, s));
const qs = async (s: Uint8Array) => ({ signer: await pubOf(s), sign: signerOf(s) });

async function ground() {
  const oldKeys = await Promise.all([pubOf(S.old1), pubOf(S.old2), pubOf(S.old3)]);
  const newKeys = await Promise.all([pubOf(S.new1), pubOf(S.new2), pubOf(S.new3)]);
  return {
    oldKeys, newKeys,
    core: {
      fromEpochCid:  "epoch1-aaaa",
      toEpochCid:    "epoch2-bbbb",
      oldKeySetHash: sealKeySetHash(oldKeys, 2),
      newKeySetHash: sealKeySetHash(newKeys, 2),
      rite:          "lar:///ha.ka.ba/lararium/mesh/founding-runbook#the-growth-rite",
    },
  };
}

describe("the growth rite's record", () => {
  test("★ THE MULTITUDE-OF-ONE BECOMES REAL HANDS — cross-signed both ways, independently witnessed ★", async () => {
    const { oldKeys, newKeys, core } = await ground();
    const rec = await mintReserveTransition({
      core,
      oldSigners: [await qs(S.old1), await qs(S.old2)],
      newSigners: [await qs(S.new1), await qs(S.new2)],
      witnesses:  [{ ...(await qs(S.wit)), note: "watched the rite at the hearth, script in hand" }],
    });
    const v = await verifyReserveTransition(rec, { oldKeys, oldThreshold: 2, newKeys, newThreshold: 2 });
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
    expect(v.ok && v.independentWitnesses).toBe(1);
  });

  test("★ ONE HAND CANNOT CROSS ALONE — the old quorum without the new one refuses ★", async () => {
    const { oldKeys, newKeys, core } = await ground();
    const rec = await mintReserveTransition({
      core,
      oldSigners: [await qs(S.old1), await qs(S.old2)],
      newSigners: [await qs(S.new1)],                       // below the new threshold
      witnesses:  [],
    });
    const v = await verifyReserveTransition(rec, { oldKeys, oldThreshold: 2, newKeys, newThreshold: 2 });
    expect(v.ok).toBe(false);
  });

  test("★ A KEYHOLDER NEVER COUNTS AS AN INDEPENDENT WITNESS ★", async () => {
    const { oldKeys, newKeys, core } = await ground();
    const rec = await mintReserveTransition({
      core,
      oldSigners: [await qs(S.old1), await qs(S.old2)],
      newSigners: [await qs(S.new1), await qs(S.new2)],
      witnesses:  [{ ...(await qs(S.old3)), note: "I watched myself" }],   // a hand of the old set
    });
    const v = await verifyReserveTransition(rec, { oldKeys, oldThreshold: 2, newKeys, newThreshold: 2 });
    expect(v.ok).toBe(true);
    expect(v.ok && v.independentWitnesses).toBe(0);
  });

  test("a tampered transition breaks — the bytes bind both epochs, both sets, and the rite", async () => {
    const { oldKeys, newKeys, core } = await ground();
    const rec = await mintReserveTransition({
      core,
      oldSigners: [await qs(S.old1), await qs(S.old2)],
      newSigners: [await qs(S.new1), await qs(S.new2)],
      witnesses:  [],
    });
    const forged = { ...rec, toEpochCid: "epoch2-EVIL" };
    const v = await verifyReserveTransition(forged, { oldKeys, oldThreshold: 2, newKeys, newThreshold: 2 });
    expect(v.ok).toBe(false);
    // and the bytes differ whenever any bound field moves
    expect(hex(reserveTransitionBytes(core))).not.toBe(hex(reserveTransitionBytes({ ...core, rite: "lar:///other" })));
  });
});
