/**
 * steward-seal vectors: S1 name classes / malformed names; S2 face / wrong bytes, name, key and chain;
 * S3 inception Handle / bytes, key, missing chain, other name and raw-signature domain control;
 * S4 rotated Handle / no resolver, confirming resolver and refusing resolver; S5 burn / mint and verify;
 * S6 tampered event key / invalid chain; S7 mint refusals / one valid face and Handle; S8 coercion / malformed
 * shapes and dropped extras; S9 raw Handle-key face / Handle-prefix refusal. The record names its steward,
 * and the fold verifies each seal under that carried name, so the two valid arms cannot borrow authority.
 * S10 (inside S4) the reader's own chain: a seal under a head the reader's chain moved past reads stale, a
 * forked chain reads forked / a reader that holds nothing, the same chain, or an older chain reads it by the
 * usual trust. S5 also replays a seal set before a burn / with no held chain it still reads.
 * S11 an over-long chain reads as no seal / a chain at the bound keeps its shape.
 * S12 the Handle image binds its domain, prefix, chain state and record / the same parts give the same image.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  handleKeyDigestOf, mintHandleBurn, mintHandleInception, mintHandleRotation,
  type HandleKelEvent, type OwnerHeadResolver,
} from "../src/handle-kel.js";
import {
  coerceStewardSeal, handleStewardSealBytes, sealAsSteward, stewardClassOf, verifyStewardSeal, STEWARD_CHAIN_MAX,
  type StewardSeal,
} from "../src/steward-seal.js";

const SEEDS = {
  handleA: new Uint8Array(32).fill(51), handleB: new Uint8Array(32).fill(52),
  member: new Uint8Array(32).fill(61), recovery: new Uint8Array(32).fill(81),
  other: new Uint8Array(32).fill(82),
};
const pub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const did = async (seed: Uint8Array) => `0x${await pub(seed)}`;
const signer = (seed: Uint8Array) => async (bytes: Uint8Array) => hex(await ed.signAsync(bytes, seed));
const record = new TextEncoder().encode("realm record bytes");
const otherRecord = new TextEncoder().encode("other record bytes");
const NEXT = `hkeynext-${"ef".repeat(32)}`;

async function founded() {
  const key = await did(SEEDS.handleA);
  const owner = await did(SEEDS.member);
  const prefix = `persona-${"ab".repeat(32)}`;
  const recovery = `recovery-${await pub(SEEDS.recovery)}`;
  const inception = mintHandleInception(key, prefix, recovery, handleKeyDigestOf(await did(SEEDS.handleB)));
  return { key, prefix: inception.prefix, inception, owner, ownerPrefix: prefix, recovery };
}
const headsAre = (prefix: string, key: string): OwnerHeadResolver => async (p, k) => p === prefix && k === key;

describe("steward-seal", () => {
  test("S1 names read exactly as face or Handle; malformed spellings refuse", async () => {
    expect(stewardClassOf("ab".repeat(32))).toBe("face");
    expect(stewardClassOf(`handle-${"ab".repeat(32)}`)).toBe("handle");
    for (const bad of [`0x${"ab".repeat(32)}`, "AB".repeat(32), "a".repeat(63), `handle-${"ab".repeat(31)}a`, "", 4]) {
      expect(stewardClassOf(bad)).toBeNull();
    }
  });

  test("S2 face seals bind raw bytes, exact name and chain absence", async () => {
    const face = await pub(SEEDS.member);
    const otherFace = await pub(SEEDS.other);
    const seal = await sealAsSteward({ signer: face, sign: signer(SEEDS.member) }, record);
    expect((await verifyStewardSeal(seal, face, record)).ok).toBe(true);
    expect((await verifyStewardSeal(seal, face, otherRecord)).reason).toBe("signature-mismatch");
    expect((await verifyStewardSeal(seal, otherFace, record)).reason).toBe("seal-names-another-steward");
    const wrongKey = await sealAsSteward({ signer: face, sign: signer(SEEDS.other) }, record);
    expect((await verifyStewardSeal(wrongKey, face, record)).reason).toBe("signature-mismatch");
    expect((await verifyStewardSeal({ ...seal, chain: [] }, face, record)).reason).toBe("face-seal-carries-a-chain");
  });

  test("S3 inception Handle seals carry and verify their chain; the domain separates raw signing", async () => {
    const f = await founded();
    const seal = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain: [f.inception] }, record);
    expect((await verifyStewardSeal(seal, f.prefix, record)).ok).toBe(true);
    expect((await verifyStewardSeal(seal, f.prefix, otherRecord)).reason).toBe("signature-mismatch");
    const wrong = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.other), chain: [f.inception] }, record);
    expect((await verifyStewardSeal(wrong, f.prefix, record)).reason).toBe("signature-mismatch");
    expect((await verifyStewardSeal({ signer: seal.signer, sig: seal.sig }, f.prefix, record)).reason).toBe("handle-seal-carries-no-chain");
    const otherPrefix = `handle-${"cd".repeat(32)}`;
    expect((await verifyStewardSeal({ ...seal, signer: otherPrefix }, otherPrefix, record)).reason).toBe("chain-names-another-handle");
    const rawSig = await signer(SEEDS.handleA)(record);
    expect((await verifyStewardSeal({ signer: f.prefix, sig: rawSig, chain: [f.inception] }, f.prefix, record)).reason).toBe("signature-mismatch");
  });

  test("S4 a rotated head needs its owner's resolver", async () => {
    const f = await founded();
    const freshKey = await did(SEEDS.handleB);
    const rotation = await mintHandleRotation({
      head: f.inception, freshHandleKeyDid: freshKey, nextHandleKeyDigest: NEXT,
      ownerAuthMemberPrefix: f.ownerPrefix, ownerHeadOpKeyDid: f.owner, sign: signer(SEEDS.member),
    });
    expect(rotation.ok).toBe(true);
    if (!rotation.ok) return;
    const chain: HandleKelEvent[] = [f.inception, rotation.event];
    const seal = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleB), chain }, record);
    expect((await verifyStewardSeal(seal, f.prefix, record)).reason).toBe("handle-rotation-unverified");
    expect((await verifyStewardSeal(seal, f.prefix, record, { ownerHeads: headsAre(f.ownerPrefix, f.owner) })).ok).toBe(true);
    expect((await verifyStewardSeal(seal, f.prefix, record, { ownerHeads: async () => false })).reason).toBe("owner-head-refused");

    // S10 THE READER'S OWN CHAIN. A seal under the inception replays after the Handle rotated: a reader that
    // holds the rotated chain reads it stale; a reader that holds nothing, or the inception alone, still reads it.
    const early = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain: [f.inception] }, record);
    expect((await verifyStewardSeal(early, f.prefix, record)).ok).toBe(true);
    expect((await verifyStewardSeal(early, f.prefix, record, { heldChain: () => chain })).reason).toBe("stale-seal");
    expect((await verifyStewardSeal(early, f.prefix, record, { heldChain: () => [f.inception] })).ok).toBe(true);
    expect((await verifyStewardSeal(early, f.prefix, record, { heldChain: () => null })).ok).toBe(true);
    // An EMPTY answer reads as a broken lookup, never as "holds none".
    expect((await verifyStewardSeal(early, f.prefix, record, { heldChain: () => [] })).reason).toBe("chain-invalid");
    // A reader BEHIND the seal (it holds the inception, the seal carries the rotation) reads the carried chain
    // by its usual trust: refused with no owner heads, held with them.
    expect((await verifyStewardSeal(seal, f.prefix, record, { heldChain: () => [f.inception] })).reason).toBe("handle-rotation-unverified");
    expect((await verifyStewardSeal(seal, f.prefix, record, { heldChain: () => [f.inception], ownerHeads: headsAre(f.ownerPrefix, f.owner) })).ok).toBe(true);
    // A reader whose chain parts ways with the carried one reads a fork, and a held chain for another Handle reads invalid.
    const elsewhere = mintHandleInception(await did(SEEDS.other), f.ownerPrefix, f.recovery, handleKeyDigestOf(await did(SEEDS.handleB)));
    expect((await verifyStewardSeal(early, f.prefix, record, { heldChain: () => [elsewhere] })).reason).toBe("chain-invalid");
    const forkedHeld: HandleKelEvent[] = [f.inception, { ...rotation.event }];
    const otherRotation = await mintHandleRotation({
      head: f.inception, freshHandleKeyDid: freshKey, nextHandleKeyDigest: `hkeynext-${"cd".repeat(32)}`,
      ownerAuthMemberPrefix: f.ownerPrefix, ownerHeadOpKeyDid: f.owner, sign: signer(SEEDS.member),
    });
    expect(otherRotation.ok).toBe(true);
    if (!otherRotation.ok) return;
    const otherSeal = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleB), chain: [f.inception, otherRotation.event] }, record);
    expect((await verifyStewardSeal(otherSeal, f.prefix, record, { heldChain: () => forkedHeld, ownerHeads: headsAre(f.ownerPrefix, f.owner) })).reason).toBe("chain-forked");
  });

  test("S5 a burned chain refuses minting and verification", async () => {
    const f = await founded();
    const burn = await mintHandleBurn({ head: f.inception, sign: signer(SEEDS.handleA) });
    expect(burn.ok).toBe(true);
    if (!burn.ok) return;
    const chain = [f.inception, burn.event];
    await expect(sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain }, record)).rejects.toThrow(/^steward seal refused: burned/);
    const forged = await signer(SEEDS.handleA)(handleStewardSealBytes(f.prefix, burn.event.eventCid, record));
    expect((await verifyStewardSeal({ signer: f.prefix, sig: forged, chain }, f.prefix, record)).reason).toBe("burned");
    // A seal set BEFORE the burn replays with its inception-only chain: a reader that holds the burned chain reads it burned.
    const early = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain: [f.inception] }, record);
    expect((await verifyStewardSeal(early, f.prefix, record)).ok).toBe(true);
    expect((await verifyStewardSeal(early, f.prefix, record, { heldChain: () => chain })).reason).toBe("burned");
  });

  test("S12 the Handle image binds each of its parts", () => {
    const p = `handle-${"ab".repeat(32)}`, q = `handle-${"cd".repeat(32)}`;
    const image = (prefix: string, head: string, bytes: Uint8Array) => hex(handleStewardSealBytes(prefix, head, bytes));
    const base = image(p, "event-a", record);
    expect(image(p, "event-a", record)).toBe(base);                       // CONTROL: the same parts, the same image
    expect(image(q, "event-a", record)).not.toBe(base);                   // the prefix
    expect(image(p, "event-b", record)).not.toBe(base);                   // the chain state
    expect(image(p, "event-a", otherRecord)).not.toBe(base);              // the record
    expect(new TextDecoder().decode(handleStewardSealBytes(p, "event-a", record))).toContain("/domain/steward-seal");
  });

  test("S11 an over-long chain reads as no seal, at the mint, the verifier and the stored shape", async () => {
    const f = await founded();
    const long = Array.from({ length: STEWARD_CHAIN_MAX + 1 }, () => f.inception);
    await expect(sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain: long }, record)).rejects.toThrow(/^steward seal refused: chain-too-long/);
    expect((await verifyStewardSeal({ signer: f.prefix, sig: "00", chain: long }, f.prefix, record)).reason).toBe("chain-too-long");
    expect(coerceStewardSeal({ signer: f.prefix, sig: "00", chain: long })).toBeNull();
    // CONTROL: a chain at the bound keeps its shape through the stored reading.
    expect(coerceStewardSeal({ signer: f.prefix, sig: "00", chain: long.slice(0, STEWARD_CHAIN_MAX) })?.chain).toHaveLength(STEWARD_CHAIN_MAX);
  });

  test("S6 a changed event key breaks structural integrity", async () => {
    const f = await founded();
    const damaged = { ...f.inception, handleKeyDid: await did(SEEDS.other) };
    const sig = await signer(SEEDS.handleA)(handleStewardSealBytes(f.prefix, damaged.eventCid, record));
    expect((await verifyStewardSeal({ signer: f.prefix, sig, chain: [damaged] }, f.prefix, record)).reason).toBe("chain-invalid");
  });

  test("S7 mint rejects unreadable names and shape mismatches; valid signers seal", async () => {
    const f = await founded();
    const face = await pub(SEEDS.member);
    await expect(sealAsSteward({ signer: "bad", sign: signer(SEEDS.member) }, record)).rejects.toThrow(/^steward seal refused: steward-name-unreadable/);
    await expect(sealAsSteward({ signer: face, sign: signer(SEEDS.member), chain: [] }, record)).rejects.toThrow(/^steward seal refused: face-seal-carries-a-chain/);
    await expect(sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA) }, record)).rejects.toThrow(/^steward seal refused: handle-seal-carries-no-chain/);
    const otherPrefix = `handle-${"cd".repeat(32)}`;
    await expect(sealAsSteward({ signer: otherPrefix, sign: signer(SEEDS.handleA), chain: [f.inception] }, record)).rejects.toThrow(/^steward seal refused: chain-names-another-handle/);
    expect(await sealAsSteward({ signer: face, sign: signer(SEEDS.member) }, record)).toMatchObject({ signer: face });
    expect(await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain: [f.inception] }, record)).toMatchObject({ signer: f.prefix });
  });

  test("S8 seals round-trip at floor shape; malformed forms refuse and extras drop", async () => {
    const f = await founded();
    const face = await pub(SEEDS.member);
    const faceSeal = await sealAsSteward({ signer: face, sign: signer(SEEDS.member) }, record);
    const handleSeal = await sealAsSteward({ signer: f.prefix, sign: signer(SEEDS.handleA), chain: [f.inception] }, record);
    expect(coerceStewardSeal(JSON.parse(JSON.stringify(faceSeal)))).toEqual(faceSeal);
    expect(coerceStewardSeal(JSON.parse(JSON.stringify(handleSeal)))).toEqual(handleSeal);
    for (const bad of [{ signer: face }, { signer: 2, sig: "x" }, { signer: face, sig: "x", chain: ["x"] }, null, 4]) {
      expect(coerceStewardSeal(bad)).toBeNull();
    }
    expect(coerceStewardSeal({ ...faceSeal, extra: true })).toEqual(faceSeal);
  });

  test("S9 a raw Handle-key signature can act as that face, never as the Handle prefix", async () => {
    const f = await founded();
    const faceName = f.key.slice(2);
    const rawSig = await signer(SEEDS.handleA)(record);
    const faceSeal: StewardSeal = { signer: faceName, sig: rawSig };
    expect((await verifyStewardSeal(faceSeal, faceName, record)).ok).toBe(true);
    // Under the Handle's prefix the same signature claims nothing: bare it carries no chain, and with the chain
    // beside it the raw-bytes signature fails the domain-tagged image.
    expect((await verifyStewardSeal({ ...faceSeal, signer: f.prefix }, f.prefix, record)).reason).toBe("handle-seal-carries-no-chain");
    expect((await verifyStewardSeal({ ...faceSeal, signer: f.prefix, chain: [f.inception] }, f.prefix, record)).reason).toBe("signature-mismatch");
  });
});
