/**
 * Red-first N contract: the charter lineage reader takes a joint genesis only with every seated key's inception
 * signature over one image. No test here mints a charter in a vessel. The reds run under LAR_UNBUILT_REDS=1 and
 * turn green in the signed-inception commit, which also moves the seed fixtures and every charter reader.
 *
 * The signed genesis carries its inception beside its fields (`inception`); the PIN below holds that shape, so a
 * signed-inception commit that carries the signatures elsewhere moves the pin and the reds together.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { cidV1Sha256, hex } from "../src/crypto.js";
import { coldKeyFromSeed } from "../src/cold-key-card.js";
import { seatFingerprint } from "../src/nexus-seal-seed.js";
import { genesisCharterEpoch, verifySealLineage, type SealEpoch, type SealRollSigner } from "../src/wax-stamp.js";
import {
  charterInceptionBytes, cofoundJoin, cofoundOffer, composeCharterInception, inceptionGenesis, sealCofound,
  verifyCharterInception, type CharterInception,
} from "../src/cofound.js";
import { seatedCharter } from "./charter-fixture.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;
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
  return { a, b, offer, inception, genesis: inceptionGenesis(inception.image) };
}
/** The genesis carrying its inception: the shape the signed-inception commit reads. */
const incepted = (genesis: SealEpoch, inception: CharterInception): SealEpoch => ({ ...genesis, inception } as SealEpoch);

describe("N's joint genesis", () => {
  test("CONTROL: the ordinary one-founder seed reads, as the fixture factory builds it, and names another AID", async () => {
    const { genesis } = await joint();
    const seed = await seatedCharter({ seats: 1, threshold: 1 });
    expect(seed.aid).not.toBe(genesis.epochCid);
    expect(verifySealLineage(seed.chain)).toBe(true);
  });

  test("PIN: a joint genesis carrying both seats' inception reads, and its inception binds it", async () => {
    const { genesis, inception } = await joint();
    expect(verifyCharterInception(inception, genesis)).toBeNull();
    expect(verifySealLineage([incepted(genesis, inception)])).toBe(true);
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: an unsigned two-seat genesis fails the charter lineage reader", async () => {
    const { genesis } = await joint();
    expect(verifySealLineage([genesis])).toBe(false);
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: zero signatures or one fail the charter lineage reader", async () => {
    const { genesis, inception } = await joint();
    for (const signatures of [[], inception.signatures.slice(0, 1), inception.signatures.slice(1)]) {
      const partial = { ...inception, signatures };
      expect(verifyCharterInception(partial, genesis)).not.toBeNull();
      expect(verifySealLineage([incepted(genesis, partial)])).toBe(false);
    }
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: two signatures over different images fail the charter lineage reader", async () => {
    const { a, genesis, inception } = await joint();
    const split = { ...inception.image, charterLaw: `${LAW}-other` };
    const aHand = await hand(71);
    const signatures = [...inception.signatures.filter((s) => s.signer !== a.seat), { signer: a.seat, sig: await aHand.sign(charterInceptionBytes(split)) }];
    expect(verifyCharterInception({ ...inception, signatures }, genesis)).toBe("inception-signature-invalid");
    expect(verifySealLineage([incepted(genesis, { ...inception, signatures })])).toBe(false);
  });

  red("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: a signer named twice or a signer outside the seats fails the charter lineage reader, beside both seats' signatures", async () => {
    const { genesis, inception } = await joint();
    const foreign = await hand(79);
    const foreignSig = { signer: foreign.signer, sig: await foreign.sign(charterInceptionBytes(inception.image)) };
    for (const signatures of [[...inception.signatures, inception.signatures[0]!], [...inception.signatures, foreignSig]]) {
      expect(verifyCharterInception({ ...inception, signatures }, genesis)).toBe("inception-foreign-signer");
      expect(verifySealLineage([incepted(genesis, { ...inception, signatures })])).toBe(false);
    }
  });

  red("EVERY GENESIS CARRIES ITS SEATS' INCEPTION: an unsigned one-seat genesis fails the charter lineage reader, so the seed fixture moves with the seal", async () => {
    const { a } = await joint();
    expect(verifySealLineage([genesisCharterEpoch([a.seat], 1, { digests: [(await coldKeyFromSeed(seedOf(75))).digest], threshold: 1 })])).toBe(false);
  });

  red("COFOUND_OFFER_IS_NOT_A_CHARTER: a genesis composed from an offer's material alone fails the charter lineage reader", async () => {
    const { offer, genesis } = await joint();
    const fromOffer = genesisCharterEpoch([offer.seat], 1, { digests: [offer.next], threshold: 1 });
    expect(fromOffer.epochCid).not.toBe(genesis.epochCid);
    expect(verifySealLineage([fromOffer])).toBe(false);
  });

  test("CONTROL: the pure inception judge already refuses what the reds name", async () => {
    const { genesis, inception, offer, b } = await joint();
    expect(verifyCharterInception({ ...inception, signatures: [] }, genesis)).toBe("inception-unsigned");
    expect(verifyCharterInception({ ...inception, signatures: inception.signatures.slice(0, 1) }, genesis)).toBe("inception-short-of-seats");
    expect(composeCharterInception(offer, b)).toEqual(inception.image);
  });
});
