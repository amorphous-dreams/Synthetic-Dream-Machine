/**
 * The charter lineage reader takes a genesis only with every seated key's inception signature over one image,
 * and a joint genesis only as both founders sealed it. No test here mints a charter in a vessel.
 *
 * The signed genesis carries its inception beside its fields (`inception`), and its AID commits the image.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { cidV1Sha256, hex } from "../src/crypto.js";
import { coldKeyFromSeed } from "../src/cold-key-card.js";
import { seatFingerprint } from "../src/nexus-seal-seed.js";
import {
  charterInceptionBytes, charterInceptionImage, genesisCharterEpoch, genesisOfInception, readSealLineage, verifyInception,
  verifySealLineage, type SealRollSigner,
} from "../src/wax-stamp.js";
import { cofoundGenesis, cofoundJoin, cofoundOffer, composeCharterInception, sealCofound } from "../src/cofound.js";
import { seatedCharter } from "./charter-fixture.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const key = async (n: number) => hex(await ed.getPublicKeyAsync(seedOf(n)));
const hand = async (n: number): Promise<SealRollSigner> => ({ signer: await key(n), sign: async (b) => hex(await ed.signAsync(b, seedOf(n))) });
const cidOf = (text: string): string => cidV1Sha256(new TextEncoder().encode(text));
const MANIFEST = { image: `sha256:${"ab".repeat(32)}`, genesis: cidOf("genesis"), engine: cidOf("engine"), grammar: cidOf("grammar") };
const LAW = "lar:///ha.ka.ba/lararium/mesh/kahu#/seed-and-nexus";

/** Two founders' joint inception, both signatures, as the pure act yields it. */
async function joint() {
  const a = { seat: await key(71), next: (await coldKeyFromSeed(seedOf(73))).digest };
  const b = { seat: await key(72), next: (await coldKeyFromSeed(seedOf(74))).digest };
  const offer = cofoundOffer({ ...a, charterLaw: LAW, manifest: MANIFEST });
  const join = await cofoundJoin(offer, b, seatFingerprint(a.seat), await hand(72));
  const inception = await sealCofound(join, { offer, heardJoinSeat: seatFingerprint(b.seat) }, await hand(71));
  return { a, b, offer, inception, genesis: cofoundGenesis(inception) };
}

describe("N's joint genesis", () => {
  test("CONTROL: the ordinary one-founder seed reads, as the fixture factory builds it, and names another AID", async () => {
    const { genesis } = await joint();
    const seed = await seatedCharter({ seats: 1, threshold: 1 });
    expect(seed.aid).not.toBe(genesis.epochCid);
    expect(verifySealLineage(seed.chain)).toBe(true);
  });

  test("a joint genesis carrying both seats' inception reads, and its inception binds it", async () => {
    const { genesis } = await joint();
    expect(verifyInception(genesis)).toBeNull();
    expect(verifySealLineage([genesis])).toBe(true);
  });

  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: an unsigned two-seat genesis fails the charter lineage reader", async () => {
    const { genesis } = await joint();
    expect(readSealLineage([{ ...genesis, inception: { ...genesis.inception!, signatures: [] } }])).toBe("inception-unsigned");
    const { inception: _i, ...bare } = genesis;
    expect(readSealLineage([bare])).toBe("inception-absent");
  });

  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: one signature of two fails the charter lineage reader", async () => {
    const { genesis } = await joint();
    for (const signatures of [genesis.inception!.signatures.slice(0, 1), genesis.inception!.signatures.slice(1)]) {
      expect(readSealLineage([{ ...genesis, inception: { ...genesis.inception!, signatures } }])).toBe("inception-short-of-seats");
    }
  });

  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: two signatures over different images fail the charter lineage reader", async () => {
    const { a, genesis } = await joint();
    const split = { ...genesis.inception!.image, founding: { offer: "ab".repeat(32) } };
    const aHand = await hand(71);
    const signatures = [...genesis.inception!.signatures.filter((s) => s.signer !== a.seat), { signer: a.seat, sig: await aHand.sign(charterInceptionBytes(split)) }];
    expect(readSealLineage([{ ...genesis, inception: { ...genesis.inception!, signatures } }])).toBe("inception-signature-invalid");
  });

  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: a signer named twice or a signer outside the seats fails, beside both seats' signatures", async () => {
    const { genesis } = await joint();
    const foreign = await hand(79);
    const foreignSig = { signer: foreign.signer, sig: await foreign.sign(charterInceptionBytes(genesis.inception!.image)) };
    const signed = genesis.inception!.signatures;
    for (const signatures of [[...signed, signed[0]!], [...signed, foreignSig]]) {
      expect(readSealLineage([{ ...genesis, inception: { ...genesis.inception!, signatures } }])).toBe("inception-foreign-signer");
    }
  });

  test("an inception moved onto another genesis reads unbound: the AID commits the image", async () => {
    const { genesis } = await joint();
    const other = genesisCharterEpoch([await key(77)], 1);
    expect(readSealLineage([{ ...other, inception: genesis.inception! }])).toBe("inception-unbound");
  });

  test("EVERY GENESIS CARRIES ITS SEATS' INCEPTION: an unsigned one-seat genesis fails; signed by its seat, it reads", async () => {
    const seat = await hand(75);
    const image = charterInceptionImage([seat.signer], 1, { digests: [(await coldKeyFromSeed(seedOf(76))).digest], threshold: 1 });
    expect(readSealLineage([genesisOfInception(image)])).toBe("inception-unsigned");
    const signed = genesisOfInception(image, [{ signer: seat.signer, sig: await seat.sign(charterInceptionBytes(image)) }]);
    expect(verifySealLineage([signed])).toBe(true);
  });

  test("COFOUND_OFFER_IS_NOT_A_CHARTER: a genesis composed from an offer's material alone fails the charter lineage reader", async () => {
    const { offer, genesis } = await joint();
    const fromOffer = genesisCharterEpoch([offer.seat], 1, { digests: [offer.next], threshold: 1 });
    expect(fromOffer.epochCid).not.toBe(genesis.epochCid);
    expect(verifySealLineage([fromOffer])).toBe(false);
  });

  test("SAME ROSTER, TWO FOUNDINGS: one roster and rule, founded twice with fresh successors, mints two AIDs", async () => {
    const { a, b, genesis } = await joint();
    const again = composeCharterInception(cofoundOffer({ seat: a.seat, next: (await coldKeyFromSeed(seedOf(83))).digest, charterLaw: LAW, manifest: MANIFEST }),
      { seat: b.seat, next: (await coldKeyFromSeed(seedOf(84))).digest });
    expect(again.keys).toEqual(genesis.inception!.image.keys);
    expect(again.threshold).toBe(genesis.inception!.image.threshold);
    expect(genesisOfInception(again).epochCid).not.toBe(genesis.epochCid);
  });
});
