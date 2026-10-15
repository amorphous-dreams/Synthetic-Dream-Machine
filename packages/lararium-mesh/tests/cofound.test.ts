/**
 * cofound — the two-founder act's pure images: offer, join, inception, read-back and cold card.
 * Every file crosses as JSON text, the only courier the act allows. The epoch shape stands among the subjects
 * (an inception binds its genesis field by field), so this file sits outside the charter funnel by name.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { cidV1Sha256, hex } from "../src/crypto.js";
import { coldKeyCardLines, coldKeyCode, coldKeyFromSeed } from "../src/cold-key-card.js";
import { seatFingerprint } from "../src/nexus-seal-seed.js";
import { charterInceptionImage, genesisCharterEpoch, verifyInception, verifySealLineage, type SealRollSigner } from "../src/wax-stamp.js";
import {
  CofoundRefusal, cofoundJoin, cofoundOffer, cofoundReadBack, coldCardOpens, composeCharterInception, finalCharterFingerprint,
  cofoundGenesis, inceptionAid, judgeCharterInception, judgeCofoundJoin, offerFingerprint, readCofoundInception, readCharterInceptionImage,
  readCofoundJoin, readCofoundOffer, sealCofound, seatCommitment, verifyCharterInception, charterInceptionBytes,
  type CofoundOffer, type CharterInceptionImage,
} from "../src/cofound.js";

const courier = <T>(v: T): unknown => JSON.parse(JSON.stringify(v));
const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(n)));
const handOf = async (n: number, calls?: { n: number }): Promise<SealRollSigner> => ({
  signer: await keyOf(n), sign: async (bytes) => { if (calls) calls.n++; return hex(await ed.signAsync(bytes, seedOf(n))); },
});
const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";

/** Founder A: seat 11, cold 12. Founder B: seat 21, cold 22. */
async function founders() {
  const [aCold, bCold] = await Promise.all([coldKeyFromSeed(seedOf(12)), coldKeyFromSeed(seedOf(22))]);
  const a = { seat: await keyOf(11), next: aCold.digest };
  const b = { seat: await keyOf(21), next: bCold.digest };
  const offer = cofoundOffer({ ...a, charterLaw: LAW, manifest: MANIFEST });
  return { a, b, offer, aCold, bCold, aHand: await handOf(11), bHand: await handOf(21) };
}

async function sealed() {
  const f = await founders();
  const join = courier(await cofoundJoin(courier(f.offer) as CofoundOffer, f.b, seatFingerprint(f.offer.seat), f.bHand));
  const inception = courier(await sealCofound(join, { offer: f.offer, heardJoinSeat: seatFingerprint(f.b.seat) }, f.aHand));
  return { ...f, join, inception, image: composeCharterInception(f.offer, f.b) };
}

describe("the offer", () => {
  test("crosses as a file and reads back whole; its fingerprint holds 64 lower hex", async () => {
    const { offer } = await founders();
    expect(readCofoundOffer(courier(offer))).toEqual(offer);
    expect(offerFingerprint(offer)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the strict reader refuses every other shape", async () => {
    const { offer } = await founders();
    const bad: unknown[] = [
      { ...offer, extra: 1 }, { ...offer, kind: "cofound-join" }, { ...offer, seat: offer.seat.toUpperCase() },
      { ...offer, seat: "00".repeat(32) }, { ...offer, next: "zz".repeat(32) }, { ...offer, charterLaw: "https://example.test/law" },
      { ...offer, manifest: { ...MANIFEST, grammar: "b" } }, { ...offer, manifest: { ...MANIFEST, grammar: `b${"a".repeat(58)}` } },
      { ...offer, manifest: { ...MANIFEST, engine: MANIFEST.engine.toUpperCase() } }, { ...offer, manifest: { ...MANIFEST, image: "ab".repeat(32) } },
      { ...offer, manifest: { ...MANIFEST, extra: MANIFEST.genesis } }, null, [], "offer",
    ];
    // One spelling: a CID whose padding bits differ, or whose header names another codec, refuses.
    const B32 = "abcdefghijklmnopqrstuvwxyz234567";
    const last = MANIFEST.genesis.at(-1)!;
    bad.push({ ...offer, manifest: { ...MANIFEST, genesis: MANIFEST.genesis.slice(0, -1) + B32[B32.indexOf(last) ^ 1] } });
    const b32 = (bytes: number[]): string => { let bits = 0, acc = 0, out = ""; for (const x of bytes) { acc = (acc << 8) | x; bits += 8;
      while (bits >= 5) { bits -= 5; out += B32[(acc >> bits) & 31]; } } return bits ? out + B32[(acc << (5 - bits)) & 31] : out; };
    bad.push({ ...offer, manifest: { ...MANIFEST, genesis: `b${b32([0x00, 0x55, 0x12, 0x20, ...new Array(32).fill(7)])}` } });
    expect(readCofoundOffer({ ...offer, manifest: { ...MANIFEST, genesis: `b${b32([0x01, 0x55, 0x12, 0x20, ...new Array(32).fill(7)])}` } })).not.toBeNull();
    for (const b of bad) expect(readCofoundOffer(b), JSON.stringify(b)).toBeNull();
    expect(() => cofoundOffer({ seat: "00".repeat(32), next: offer.next, charterLaw: LAW, manifest: MANIFEST })).toThrow(CofoundRefusal);
  });
});

describe("the join", () => {
  test("each side composes one image and one AID; the AID names neither seed, and the two fingerprints differ", async () => {
    const { a, b, offer, image } = await sealed();
    const fromB = readCofoundJoin(courier(await cofoundJoin(offer, b, seatFingerprint(a.seat), await handOf(21))))!;
    expect(fromB.image).toEqual(image);
    expect(inceptionAid(image)).toMatch(/^nexus-[0-9a-f]{64}$/);
    expect(image.founding).toEqual({ offer: offerFingerprint(offer) });
    for (const seedSeat of [a.seat, b.seat]) expect(genesisCharterEpoch([seedSeat], 1).epochCid).not.toBe(inceptionAid(image));
    expect(finalCharterFingerprint(image)).toMatch(/^[0-9a-f]{64}$/);
    expect(finalCharterFingerprint(image)).not.toBe(offerFingerprint(offer));
    expect(image.keys).toEqual([a.seat, b.seat].sort());
    expect(seatCommitment(image, a.seat)).toBe(a.next);
    expect(seatCommitment(image, b.seat)).toBe(b.next);
  });

  test("one roster founding twice mints two AIDs: each founding commits fresh successors and its own offer", async () => {
    const { a, b, image } = await sealed();
    const [aCold2, bCold2] = await Promise.all([coldKeyFromSeed(seedOf(15)), coldKeyFromSeed(seedOf(25))]);
    const again = composeCharterInception(cofoundOffer({ seat: a.seat, next: aCold2.digest, charterLaw: LAW, manifest: MANIFEST }),
      { seat: b.seat, next: bCold2.digest });
    expect(again.keys).toEqual(image.keys);
    expect(again.threshold).toBe(image.threshold);
    expect(inceptionAid(again)).not.toBe(inceptionAid(image));
    // The same offer under another law alone moves the AID too: the offer fingerprint rides the image.
    const lawOnly = composeCharterInception(cofoundOffer({ ...a, charterLaw: `${LAW}-other`, manifest: MANIFEST }), b);
    expect(lawOnly.nextKeyDigests).toEqual(image.nextKeyDigests);
    expect(inceptionAid(lawOnly)).not.toBe(inceptionAid(image));
    // CONTROL: the same founding material composes the same AID on either side.
    expect(inceptionAid(composeCharterInception(cofoundOffer({ ...a, charterLaw: LAW, manifest: MANIFEST }), b))).toBe(inceptionAid(image));
  });

  test("B's signer never runs on a misheard fingerprint or a foreign hand", async () => {
    const { a, b, offer } = await founders();
    const calls = { n: 0 };
    const hand = await handOf(21, calls);
    await expect(cofoundJoin(offer, b, seatFingerprint(b.seat), hand)).rejects.toMatchObject({ code: "cofound-fingerprint-unheard" });
    await expect(cofoundJoin(offer, b, seatFingerprint(a.seat), await handOf(31, calls))).rejects.toMatchObject({ code: "cofound-hand-mismatch" });
    expect(calls.n).toBe(0);
    // CONTROL: the same hand signs once the fingerprint reads as heard, in any spacing and case.
    await cofoundJoin(offer, b, ` ${seatFingerprint(a.seat).toUpperCase().replace(/-/g, " ")} `, hand);
    expect(calls.n).toBe(1);
  });

  test("a seat both share, a successor both commit, or a seat that equals a committed successor refuses", async () => {
    const { a, offer, aCold } = await founders();
    expect(() => composeCharterInception(offer, { seat: a.seat, next: "cd".repeat(32) })).toThrow(/cofound-same-seat/);
    expect(() => composeCharterInception(offer, { seat: aCold.verifyingKey, next: "cd".repeat(32) })).toThrow(/cofound-seat-is-committed/);
    const other = await keyOf(41);
    expect(() => composeCharterInception(offer, { seat: other, next: a.next })).toThrow(/cofound-same-commitment/);
  });

  test("the join reader refuses a half signature over any other image", async () => {
    const { join } = await sealed();
    const j = join as Record<string, any>;
    expect(readCofoundJoin(join)).not.toBeNull();
    const flipped = j.signature.sig.replace(/^./, (c: string) => (c === "0" ? "1" : "0"));
    expect(flipped).not.toBe(j.signature.sig);
    expect(readCofoundJoin({ ...j, signature: { ...j.signature, sig: flipped } })).toBeNull();
    expect(readCofoundJoin({ ...j, offer: { ...j.offer, charterLaw: `${LAW}-other` } })).toBeNull();
    expect(readCofoundJoin({ ...j, signature: { ...j.signature, signer: j.offer.seat } })).toBeNull();
    expect(readCofoundJoin({ ...j, extra: true })).toBeNull();
  });

  test("A's judge refuses a join over another offer, or a seat A did not hear, before A's signer runs", async () => {
    const { a, b, offer, join } = await sealed();
    const calls = { n: 0 };
    const hand = await handOf(11, calls);
    const otherOffer = cofoundOffer({ ...a, charterLaw: `${LAW}-other`, manifest: MANIFEST });
    expect(judgeCofoundJoin(join, { offer: otherOffer, heardJoinSeat: seatFingerprint(b.seat) })).toMatchObject({ ok: false, code: "cofound-offer-mismatch" });
    expect(judgeCofoundJoin(join, { offer, heardJoinSeat: seatFingerprint(a.seat) })).toMatchObject({ ok: false, code: "cofound-fingerprint-unheard" });
    expect(judgeCofoundJoin(courier(offer), { offer, heardJoinSeat: seatFingerprint(b.seat) })).toMatchObject({ ok: false, code: "cofound-join-malformed" });
    await expect(sealCofound(join, { offer: otherOffer, heardJoinSeat: seatFingerprint(b.seat) }, hand)).rejects.toMatchObject({ code: "cofound-offer-mismatch" });
    await expect(sealCofound(join, { offer, heardJoinSeat: seatFingerprint(b.seat) }, await handOf(21, calls))).rejects.toMatchObject({ code: "cofound-hand-mismatch" });
    expect(calls.n).toBe(0);
    expect(judgeCofoundJoin(join, { offer, heardJoinSeat: seatFingerprint(b.seat) }).ok).toBe(true);
  });
});

describe("the inception", () => {
  test("both seats sign one image, it binds its genesis, and B accepts exactly the image B composed", async () => {
    const { inception, image } = await sealed();
    expect(verifyCharterInception(inception)).toBeNull();
    expect(verifyInception(cofoundGenesis(readCofoundInception(inception)!))).toBeNull();
    expect(verifySealLineage([cofoundGenesis(readCofoundInception(inception)!)])).toBe(true);
    expect(judgeCharterInception(inception, image).ok).toBe(true);
    const other = { ...image, founding: { offer: "ab".repeat(32) } } as CharterInceptionImage;
    expect(judgeCharterInception(inception, other)).toMatchObject({ ok: false, code: "cofound-image-mismatch" });
  });

  test("zero signatures, one, a seat counted twice, or two over different images refuse", async () => {
    const { inception, image, aHand } = await sealed();
    const i = inception as Record<string, any>;
    const [s0, s1] = i.signatures;
    expect(verifyCharterInception({ ...i, signatures: [] })).toBe("inception-unsigned");
    expect(verifyCharterInception({ ...i, signatures: [s0] })).toBe("inception-short-of-seats");
    expect(verifyCharterInception({ ...i, signatures: [s0, s0] })).toBe("inception-foreign-signer");
    expect(verifyCharterInception({ ...i, signatures: [s0, s1, s0] })).toBe("inception-foreign-signer");
    const split = { ...image, founding: { offer: "ab".repeat(32) } };
    const aOnSplit = { signer: aHand.signer, sig: await aHand.sign(charterInceptionBytes(split)) };
    const bSig = [s0, s1].find((s) => s.signer !== aHand.signer);
    expect(verifyCharterInception({ ...i, signatures: [bSig, aOnSplit] })).toBe("inception-signature-invalid");
    const foreign = await handOf(51);
    const foreignSig = { signer: foreign.signer, sig: await foreign.sign(charterInceptionBytes(image)) };
    expect(verifyCharterInception({ ...i, signatures: [bSig, foreignSig] })).toBe("inception-foreign-signer");
    expect(verifyCharterInception({ ...i, signatures: [s0, s1, foreignSig] })).toBe("inception-foreign-signer");
    // A seed's one seat signs its own inception under the same law; only the founder's judge holds the two-of-two shape.
    const lone = await handOf(61);
    const loneImage = charterInceptionImage([lone.signer], 1, { digests: [image.nextKeyDigests[0]!], threshold: 1 }, image.founding);
    const loneInception = { kind: i.kind, offer: i.offer, image: loneImage, signatures: [{ signer: lone.signer, sig: await lone.sign(charterInceptionBytes(loneImage)) }] };
    expect(verifyCharterInception(loneInception)).toBeNull();
    expect(judgeCharterInception(loneInception, image)).toMatchObject({ ok: false, code: "cofound-image-mismatch" });
  });

  test("an inception binds its own genesis and no other", async () => {
    const { inception, a } = await sealed();
    const genesis = cofoundGenesis(readCofoundInception(inception)!);
    expect(verifyInception({ ...genesis, epochCid: genesisCharterEpoch([a.seat], 1).epochCid })).toBe("inception-unbound");
    expect(verifyInception({ ...genesis, nextThreshold: 1 })).toBe("inception-unbound");
  });

  test("the inception reader takes no other file, and no file reads as another", async () => {
    const { offer, join, inception, image } = await sealed();
    expect(readCofoundInception(inception)).not.toBeNull();
    expect(readCharterInceptionImage(courier(image))).toEqual(image);
    for (const wrong of [offer, join, image]) expect(readCofoundInception(courier(wrong))).toBeNull();
    for (const wrong of [join, inception, image]) expect(readCofoundOffer(courier(wrong))).toBeNull();
    for (const wrong of [offer, inception, image]) expect(readCofoundJoin(courier(wrong))).toBeNull();
    const i = inception as Record<string, any>;
    expect(readCofoundInception({ ...i, image: { ...i.image, founding: { offer: "00".repeat(32) } } })).toBeNull();
    expect(readCofoundInception({ ...i, image: { ...i.image, founding: null } })).toBeNull();
    expect(readCofoundInception({ ...i, image: { ...i.image, keys: [...i.image.keys].reverse() } })).toBeNull();
    expect(readCofoundInception({ ...i, extra: 1 })).toBeNull();
    // An image assembled by hand whose successor resolves to a seated key reads nowhere, signed or not.
    const { a, b } = await founders();
    const bCold = await coldKeyFromSeed(seedOf(22));
    const pairs = [{ seat: a.seat, next: a.next }, { seat: bCold.verifyingKey, next: b.next }].sort((x, y) => (x.seat < y.seat ? -1 : 1));
    const keys = pairs.map((p) => p.seat), nextKeyDigests = pairs.map((p) => p.next);
    const crafted = { ...i.image, keys, nextKeyDigests };
    expect(readCharterInceptionImage(crafted)).toBeNull();
    expect(readCharterInceptionImage({ ...crafted, keys: [...keys] })).toBeNull();
  });
});

describe("the read-back", () => {
  test("a terminal shows both fingerprints, the AID and both seat keys with the fingerprint each founder reads aloud", async () => {
    const { offer, image, a, b } = await sealed();
    const lines = cofoundReadBack(courier(offer) as CofoundOffer, courier(image) as CharterInceptionImage);
    const text = lines.join("\n");
    expect(text).toContain(offerFingerprint(offer).slice(0, 4));
    expect(lines[0]).toMatch(/^offer fingerprint: [0-9a-f]{4}(-[0-9a-f]{4}){15}$/);
    expect(lines[1]).toMatch(/^final charter fingerprint: [0-9a-f]{4}(-[0-9a-f]{4}){15}$/);
    expect(text).toContain(inceptionAid(image));
    expect(text).toContain(`offer seat: ${seatFingerprint(a.seat)} key ${a.seat}`);
    expect(text).toContain(`joining seat: ${seatFingerprint(b.seat)} key ${b.seat}`);
    expect(() => cofoundReadBack(cofoundOffer({ ...a, charterLaw: `${LAW}-other`, manifest: MANIFEST }), image)).toThrow(/cofound-image-mismatch/);
    // An image that keeps A's seat and swaps A's successor never reads back under A's offer.
    const swapped = composeCharterInception(cofoundOffer({ seat: a.seat, next: (await coldKeyFromSeed(seedOf(14))).digest, charterLaw: LAW, manifest: MANIFEST }), b);
    expect(swapped.keys).toContain(a.seat);
    expect(() => cofoundReadBack(offer, swapped)).toThrow(/cofound-image-mismatch/);
    // A three-seat image around A's seat and successor never reads back as the two-founder act.
    const c = { seat: await keyOf(31), next: (await coldKeyFromSeed(seedOf(32))).digest };
    const pairs = [a, b, c].sort((x, y) => (x.seat < y.seat ? -1 : 1));
    const keys = pairs.map((p) => p.seat), nextKeyDigests = pairs.map((p) => p.next);
    const three = readCharterInceptionImage({ ...image, keys, nextKeyDigests })!;
    expect(three).not.toBeNull();
    expect(() => cofoundReadBack(offer, three)).toThrow(/cofound-image-mismatch/);
  });

  test("a cold card opens its seat by its code alone: a card from another charter or generation reads another key, whatever its labels say", async () => {
    const { image, a, aCold } = await sealed();
    const digest = seatCommitment(image, a.seat)!;
    expect(await coldCardOpens(digest, coldKeyCode(aCold.seed))).toBe("opens");
    const forged = seedOf(13);
    const labelled = coldKeyCardLines(forged, { purpose: "roll", chairLabel: "A", generation: 1, charterFingerprint: finalCharterFingerprint(image).slice(0, 8) });
    expect(labelled.join("\n")).toContain(finalCharterFingerprint(image).slice(0, 8));
    expect(await coldCardOpens(digest, coldKeyCode(forged))).toBe("another-key");
    expect(await coldCardOpens(digest, "0000-1111")).toBe("unreadable");
  });
});

describe("the lineage reader", () => {
  test("reads the genesis a sealed inception seats, and never the bare image's unsigned genesis", async () => {
    const { image, inception } = await sealed();
    expect(verifySealLineage([cofoundGenesis(readCofoundInception(inception)!)])).toBe(true);
    expect(verifySealLineage([genesisCharterEpoch(image.keys, 2, { digests: image.nextKeyDigests, threshold: 2 }, image.founding)])).toBe(false);
  });
});
