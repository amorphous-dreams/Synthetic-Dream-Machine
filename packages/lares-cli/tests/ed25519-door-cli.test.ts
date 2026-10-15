/**
 * ed25519-door-cli.test — the promotion receipt and the reserve handoff verify through the one strict door.
 *
 * Each verifier stands beside an honest CONTROL built the same way. The torsion hand
 * (`lararium-mesh/tests/ed25519-torsion.ts`) holds a key that seats lawfully and signs what both curve
 * libraries read true and the door refuses; the identity key holds no secret, and a key-set that names it
 * refuses by name.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, sealKeySetHash } from "@lararium/mesh";
import { mintPromotionReceipt, promotionAssertionBytes, verifyPromotionReceipt } from "../src/promotion-receipt.js";
import { mintReserveTransition, verifyReserveTransition } from "@lararium/node";
import { IDENTITY_KEY, NOBODYS_SIGNATURE, torsionHand } from "../../lararium-mesh/tests/ed25519-torsion.js";

interface Hand { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }
const honestHand = async (n: number): Promise<Hand> => {
  const seed = new Uint8Array(32).fill(n);
  return { key: hex(await ed.getPublicKeyAsync(seed)), sign: async (b) => hex(await ed.signAsync(b, seed)) };
};
const seat = (h: Hand) => ({ signer: h.key, sign: h.sign });

describe("promotion receipt (verifyPromotionReceipt)", () => {
  const DEST = "lar:///ha.ka.ba/bags/lares";
  const receiptBy = async (approver: Hand) => {
    const minted = await mintPromotionReceipt({
      subjectUri: "lar:///ha.ka.ba/lares/docs/pono/t-witness-promote", carrierHash: "ni:///sha-256;s9wMX2yprC8TPIZRdXj0IdPXjLCmt9WM-qYIq-7UQSo",
      fromBag: "lar:///ha.ka.ba/bags/working", toBag: DEST, proposerNym: "proposer-nym", approverNym: approver.key, approverKeyDid: approver.key,
      subject: { tags: ["docs/pono/design", "lifecycle/standing"] },
      holdsAdmin: (nym: string, bag: string) => nym === approver.key && bag === DEST,
      sign: approver.sign,
    } as Parameters<typeof mintPromotionReceipt>[0]);
    if (!minted.ok) throw new Error(minted.reason);
    return minted.receipt;
  };
  test("CONTROL: the approver's receipt verifies", async () => {
    expect(await verifyPromotionReceipt(await receiptBy(await honestHand(1)))).toBe(true);
  });
  test("a receipt only a lenient verifier reads verifies as nothing", async () => {
    expect(await verifyPromotionReceipt(await receiptBy(torsionHand(1)))).toBe(false);
  });
  test("nobody approves as a small-order key", async () => {
    const lawful = await receiptBy(await honestHand(1));
    const assertion = { ...lawful.assertion, approverNym: IDENTITY_KEY, approverKeyDid: IDENTITY_KEY };
    expect(promotionAssertionBytes(assertion).length).toBeGreaterThan(0);
    expect(await verifyPromotionReceipt({ ...lawful, assertion, sig: NOBODYS_SIGNATURE })).toBe(false);
  });
});

describe("reserve handoff (verifyReserveTransition)", () => {
  const handoff = async (oldHand: Hand, newHand: Hand, witness: Hand) => {
    const core = {
      fromEpochCid: "epoch1-aaaa", toEpochCid: "epoch2-bbbb",
      oldKeySetHash: sealKeySetHash([oldHand.key], 1), newKeySetHash: sealKeySetHash([newHand.key], 1),
      rite: "lar:///ha.ka.ba/lararium/mesh/founding-runbook#the-growth-rite",
    };
    const rec = await mintReserveTransition({ core, oldSigners: [seat(oldHand)], newSigners: [seat(newHand)], witnesses: [{ ...seat(witness), note: "watched" }] });
    return verifyReserveTransition(rec, { oldKeys: [oldHand.key], oldThreshold: 1, newKeys: [newHand.key], newThreshold: 1 });
  };
  test("CONTROL: both quorums and an independent witness stand", async () => {
    expect(await handoff(await honestHand(1), await honestHand(2), await honestHand(3))).toEqual({ ok: true, independentWitnesses: 1 });
  });
  test("an outgoing signature only a lenient verifier reads hands nothing off", async () => {
    const v = await handoff(torsionHand(1), await honestHand(2), await honestHand(3));
    expect(v).toMatchObject({ ok: false });
    expect(v.ok ? "" : v.reason).toMatch(/outgoing quorum does not hold/);
  });
  test("an incoming signature only a lenient verifier reads receives nothing", async () => {
    const v = await handoff(await honestHand(1), torsionHand(2), await honestHand(3));
    expect(v.ok ? "" : v.reason).toMatch(/incoming quorum does not hold/);
  });
  test("a witness signature only a lenient verifier reads counts for nothing", async () => {
    expect(await handoff(await honestHand(1), await honestHand(2), torsionHand(3))).toEqual({ ok: true, independentWitnesses: 0 });
  });
  test("a key-set that names a small-order key refuses by name", async () => {
    const oldHand = await honestHand(1);
    const v = await handoff(oldHand, { key: IDENTITY_KEY, sign: async () => NOBODYS_SIGNATURE }, await honestHand(3));
    expect(v).toEqual({ ok: false, reason: "a key-set holds a key the Ed25519 door refuses (key-small-order)" });
  });
});
