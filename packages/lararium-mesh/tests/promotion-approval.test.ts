/**
 * promotion-approval.test.ts — the seats approve the EXACT BYTES (hash, purpose, surface) under the class
 * the surface needs.
 *
 * Pinned, each reason a vector:
 *   · a quorum over the exact bytes verifies, and a partial reads its progress (`below-class-threshold`
 *     carrying counted/threshold),
 *   · ONE changed byte refuses `bytes-differ` (a clerk's edit after approval),
 *   · a CID in the hash slot refuses `a-cid-is-no-approval` (bare hex, `bafy…`, an automerge url),
 *   · a high-impact surface refuses an ordinary approval, at open and at verify (`class-below-surface`),
 *   · a roster from another epoch refuses `wrong-charter-epoch` (the nonsense control on the roster),
 *   · a roster that seats nobody refuses `no-class-table`; a torn approval refuses `malformed-approval`,
 *   · an active persona's key never signs (`signer-not-seated`), and its signature, smuggled in, counts zero,
 *   · emergency verifies with a review owed.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, utf8Bytes, sha256HexBytesSync } from "../src/crypto.js";
import { PROMOTION_APPROVAL_DOMAIN } from "../src/domains.js";
import type { KahuQuorumSeats } from "../src/kapae-antigen.js";
import {
  openPromotionApproval, signPromotionApproval, verifyPromotionApproval, readPromotionApproval,
  promotionApprovalBytes, exactBytesHash, type PromotionApproval,
} from "../src/promotion-approval.js";

const EPOCH = "epoch-cid-charter-1";
const seed  = (n: number) => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signerOf = async (s: Uint8Array) => ({ signer: await pubOf(s), sign: (b: Uint8Array) => ed.signAsync(b, s).then(hex) });

async function rosterOf(n: number, threshold: number, epoch = EPOCH): Promise<KahuQuorumSeats> {
  const keys = await Promise.all(Array.from({ length: n }, (_, i) => pubOf(seed(i + 1))));
  return { keys, threshold, sealEpochCid: epoch };
}

const BYTES = utf8Bytes("<<~ ahu #/doc>> the public-infrastructure doc, as drafted in the realm <<~/ahu>>");

async function approved(signerSeeds: number[], actClass: "ordinary" | "high-impact" | "emergency" = "high-impact", surface = "charter") {
  const roster   = await rosterOf(5, 3);
  const unsigned = openPromotionApproval({ bytes: BYTES, purpose: "publish the charter to @crossroads", surface, actClass, roster });
  const signers  = await Promise.all(signerSeeds.map((n) => signerOf(seed(n))));
  return { roster, approval: await signPromotionApproval(unsigned, signers, roster) };
}

describe("open and sign", () => {
  test("open pins the ni:/// hash of the exact bytes and the charter epoch, unsigned", async () => {
    const roster = await rosterOf(5, 3);
    const a = openPromotionApproval({ bytes: BYTES, purpose: "p", surface: "crossroads", actClass: "ordinary", roster });
    expect(a.kind).toBe(PROMOTION_APPROVAL_DOMAIN);
    expect(a.bytesHash).toBe(exactBytesHash(BYTES));
    expect(a.bytesHash.startsWith("ni:///sha-256;")).toBe(true);
    expect(a.sealEpochCid).toBe(EPOCH);
    expect(a.signatures).toEqual([]);
  });

  test("open throws class-below-surface when an ordinary act names a high-impact surface", async () => {
    const roster = await rosterOf(5, 3);
    for (const surface of ["charter", "admission", "trust-root"]) {
      expect(() => openPromotionApproval({ bytes: BYTES, purpose: "p", surface, actClass: "ordinary", roster })).toThrow(/class-below-surface/);
      expect(() => openPromotionApproval({ bytes: BYTES, purpose: "p", surface, actClass: "emergency", roster })).toThrow(/class-below-surface/);
    }
  });

  test("open throws on a blank or over-long purpose or surface", async () => {
    const roster = await rosterOf(5, 3);
    const base = { bytes: BYTES, purpose: "p", surface: "crossroads", actClass: "ordinary" as const, roster };
    expect(() => openPromotionApproval({ ...base, purpose: "  " })).toThrow();
    expect(() => openPromotionApproval({ ...base, surface: "" })).toThrow();
    expect(() => openPromotionApproval({ ...base, purpose: "x".repeat(513) })).toThrow();
    expect(() => openPromotionApproval({ ...base, surface: "x".repeat(513) })).toThrow();
    expect(() => openPromotionApproval({ ...base, purpose: "x".repeat(512) })).not.toThrow();
  });

  test("an active persona never signs: signer-not-seated", async () => {
    const roster = await rosterOf(5, 3);
    const a = openPromotionApproval({ bytes: BYTES, purpose: "p", surface: "crossroads", actClass: "ordinary", roster });
    await expect(signPromotionApproval(a, [await signerOf(seed(9))], roster)).rejects.toThrow(/signer-not-seated/);
  });

  test("signing de-duplicates a repeated seat, across calls and within one", async () => {
    const { roster, approval } = await approved([1, 1, 2]);
    expect(approval.signatures.length).toBe(2);
    const again = await signPromotionApproval(approval, [await signerOf(seed(2)), await signerOf(seed(3))], roster);
    expect(again.signatures.map((s) => s.signer)).toEqual(roster.keys.slice(0, 3));
  });
});

describe("verifyPromotionApproval", () => {
  test("a 3-of-5 quorum over the exact bytes verifies a charter promotion", async () => {
    const { roster, approval } = await approved([1, 2, 3]);
    expect(verifyPromotionApproval({ approval, bytes: BYTES, roster })).toEqual({ ok: true, counted: 3, threshold: 3, reviewOwed: false });
  });

  test("a partial reads its progress", async () => {
    const { roster, approval } = await approved([1, 2]);
    expect(verifyPromotionApproval({ approval, bytes: BYTES, roster })).toEqual({ ok: false, reason: "below-class-threshold", counted: 2, threshold: 3 });
  });

  test("one changed byte refuses: bytes-differ", async () => {
    const { roster, approval } = await approved([1, 2, 3]);
    const edited = BYTES.slice();
    edited[7] = edited[7]! ^ 1;
    expect(edited).not.toEqual(BYTES);
    expect(verifyPromotionApproval({ approval, bytes: edited, roster })).toMatchObject({ ok: false, reason: "bytes-differ" });
  });

  test("a CID never stands in for the exact bytes' hash: a-cid-is-no-approval", async () => {
    const { roster, approval } = await approved([1, 2, 3]);
    for (const cid of [
      sha256HexBytesSync(BYTES),
      "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy",
      "automerge:2j9knpCseyhnK8izDmLpGP5WMdZQ",
    ]) {
      expect(verifyPromotionApproval({ approval: { ...approval, bytesHash: cid }, bytes: BYTES, roster })).toMatchObject({ ok: false, reason: "a-cid-is-no-approval" });
    }
  });

  test("a high-impact surface refuses an ordinary approval: class-below-surface", async () => {
    const { roster, approval } = await approved([1, 2, 3]);
    const downgraded: PromotionApproval = { ...approval, actClass: "ordinary" };
    expect(verifyPromotionApproval({ approval: downgraded, bytes: BYTES, roster })).toMatchObject({ ok: false, reason: "class-below-surface" });
    const emergency: PromotionApproval = { ...approval, actClass: "emergency" };
    expect(verifyPromotionApproval({ approval: emergency, bytes: BYTES, roster })).toMatchObject({ ok: false, reason: "class-below-surface" });
  });

  test("nonsense control: a roster from another epoch refuses wrong-charter-epoch", async () => {
    const { approval } = await approved([1, 2, 3]);
    const foreign = await rosterOf(5, 3, "epoch-cid-charter-2");
    expect(verifyPromotionApproval({ approval, bytes: BYTES, roster: foreign })).toMatchObject({ ok: false, reason: "wrong-charter-epoch" });
  });

  test("a roster that seats nobody refuses no-class-table", async () => {
    const { approval } = await approved([1, 2, 3]);
    expect(verifyPromotionApproval({ approval, bytes: BYTES, roster: { keys: [], threshold: 1, sealEpochCid: EPOCH } })).toMatchObject({ ok: false, reason: "no-class-table" });
  });

  test("an active persona's signature, smuggled in, counts zero", async () => {
    const roster = await rosterOf(5, 3);
    const a = openPromotionApproval({ bytes: BYTES, purpose: "p", surface: "crossroads", actClass: "ordinary", roster });
    const persona = await signerOf(seed(9));
    const smuggled = { ...a, signatures: [{ signer: persona.signer, sig: await persona.sign(promotionApprovalBytes(a)) }] };
    expect(verifyPromotionApproval({ approval: smuggled, bytes: BYTES, roster })).toEqual({ ok: false, reason: "below-class-threshold", counted: 0, threshold: 1 });
  });

  test("signatures over another approval's bytes count nothing (purpose moved after signing)", async () => {
    const { roster, approval } = await approved([1, 2, 3]);
    const moved = { ...approval, purpose: "publish something else" };
    expect(verifyPromotionApproval({ approval: moved, bytes: BYTES, roster })).toEqual({ ok: false, reason: "below-class-threshold", counted: 0, threshold: 3 });
  });

  test("an ordinary promotion takes one seat; a high-impact approval covers an ordinary surface", async () => {
    const ord = await approved([4], "ordinary", "crossroads");
    expect(verifyPromotionApproval({ approval: ord.approval, bytes: BYTES, roster: ord.roster })).toEqual({ ok: true, counted: 1, threshold: 1, reviewOwed: false });
    const hi = await approved([1, 2, 5], "high-impact", "crossroads");
    expect(verifyPromotionApproval({ approval: hi.approval, bytes: BYTES, roster: hi.roster })).toEqual({ ok: true, counted: 3, threshold: 3, reviewOwed: false });
  });

  test("emergency covers its narrow power alone: no promotion surface takes it, at open or at verify", async () => {
    const roster = await rosterOf(5, 3);
    expect(() => openPromotionApproval({ bytes: BYTES, purpose: "p", surface: "crossroads", actClass: "emergency", roster })).toThrow(/class-below-surface/);
    const { approval } = await approved([1, 2], "ordinary", "crossroads");
    const em: PromotionApproval = { ...approval, actClass: "emergency" };
    expect(verifyPromotionApproval({ approval: em, bytes: BYTES, roster })).toMatchObject({ ok: false, reason: "class-below-surface" });
  });

  test("a torn approval refuses malformed-approval and never throws", async () => {
    const { roster, approval } = await approved([1, 2, 3]);
    for (const torn of [null, 42, "x", {}, { ...approval, kind: "promotion-receipt" }, { ...approval, signatures: "no" },
      { ...approval, actClass: "revocation" }, { ...approval, purpose: "" }, { ...approval, signatures: [{ signer: 1 }] }]) {
      expect(verifyPromotionApproval({ approval: torn as never, bytes: BYTES, roster })).toMatchObject({ ok: false, reason: "malformed-approval" });
    }
  });
});

describe("readPromotionApproval", () => {
  test("round-trips through JSON and drops stray fields; torn reads null", async () => {
    const { approval } = await approved([1, 2, 3]);
    const read = readPromotionApproval(JSON.parse(JSON.stringify({ ...approval, stray: 1 })));
    expect(read).toEqual(approval);
    expect(readPromotionApproval({ ...approval, sealEpochCid: 7 })).toBeNull();
    expect(readPromotionApproval(undefined)).toBeNull();
  });

  test("the signed bytes exclude the signatures", async () => {
    const { approval } = await approved([1, 2, 3]);
    expect(promotionApprovalBytes({ ...approval, signatures: [] })).toEqual(promotionApprovalBytes(approval));
  });
});

describe("review findings", () => {
  test("D1: an ordinary approval over a charter surface spelled another way refuses at open", async () => {
    const roster = await rosterOf(5, 3);
    for (const surface of ["Charter", " charter ", "TRUST_ROOT"]) {
      expect(() => openPromotionApproval({ bytes: BYTES, purpose: "p", surface, actClass: "ordinary", roster })).toThrow(/class-below-surface/);
    }
  });

  test("D3: a forged signature under a seat never wedges that seat's real signature out", async () => {
    const roster   = await rosterOf(5, 3);
    const unsigned = openPromotionApproval({ bytes: BYTES, purpose: "p", surface: "charter", actClass: "high-impact", roster });
    const seat1    = await signerOf(seed(1));
    const wedged   = { ...unsigned, signatures: [{ signer: seat1.signer, sig: "00".repeat(64) }] };
    const signed   = await signPromotionApproval(wedged, [seat1, await signerOf(seed(2)), await signerOf(seed(3))], roster);
    expect(verifyPromotionApproval({ approval: signed, bytes: BYTES, roster })).toMatchObject({ ok: true, counted: 3 });
  });
});
