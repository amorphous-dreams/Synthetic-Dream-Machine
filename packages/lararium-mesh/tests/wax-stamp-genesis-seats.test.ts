/**
 * wax-stamp-genesis-seats — A KEY A CHARTER SEATED NEVER RETURNS, the genesis's seats included.
 *
 * The genesis names its seats by a hash alone, so a roll verifier that reads only rolled key sets never sees
 * them: a genesis seat could return later as an "added" seat. The first roll reveals the genesis seats, bound by
 * the genesis's own key-set hash, and every later roll reads them among the keys the lineage seated.
 *
 * G1 RED: a genesis key returning as an added seat at the SECOND roll refuses / CONTROL: an honest second roll verifies.
 * G2 RED: a genesis key returning at the FIRST roll refuses.
 * G3 RED: a first roll that reveals no genesis seats, or seats that miss the genesis hash, refuses by name.
 * G4 a later roll that carries genesis seats reads malformed; the honest three-epoch lineage verifies whole.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { ed25519SignerFromSeed } from "../src/ed25519-door.js";
import { seatNextDigest } from "../src/cold-key-card.js";
import {
  charterInceptionImage, inceptCharterEpoch, mintCharterEpoch, rotateSealEpoch, sealKeySetHash, sealRollBytes, verifySealLineage, verifySealRoll,
  type SealEpoch, type SealKeySet, type SealNext, type SealRollSigner,
} from "../src/wax-stamp.js";

interface Hand { pub: string; signer: SealRollSigner }
const hand = async (n: number): Promise<Hand> => {
  const seed = new Uint8Array(32).fill(n);
  const pub = await ed.getPublicKeyAsync(seed).then(hex);
  return { pub, signer: { signer: pub, sign: (b) => ed25519SignerFromSeed(seed)(b) } };
};
const nextFor = (hands: readonly Hand[], threshold = hands.length): SealNext => ({ digests: hands.map((h) => seatNextDigest(h.pub)).sort(), threshold });
const seatsOf = (hands: readonly Hand[], threshold = hands.length): SealKeySet => ({ keys: hands.map((h) => h.pub.toLowerCase()).sort(), threshold });

/** A genesis every seat in `seats` incepts. */
const incept = (seats: readonly Hand[], threshold: number, next: SealNext) =>
  inceptCharterEpoch(charterInceptionImage(seats.map((h) => h.pub), threshold, next), seats.map((h) => h.signer));

/** Sign a roll by hand, so a vector can carry exactly the genesis reveal it names. */
async function handRoll(prev: SealEpoch, seats: readonly Hand[], then: readonly Hand[], genesis?: SealKeySet): Promise<SealEpoch> {
  const keys = seats.map((h) => h.pub.toLowerCase()).sort();
  const next = nextFor(then, 1);
  const bytes = sealRollBytes({ predecessor: prev.epochCid, keys, threshold: 1, nextKeyDigests: next.digests, nextThreshold: next.threshold });
  const signatures = await Promise.all(seats.map(async (h) => ({ signer: h.pub, sig: await h.signer.sign(bytes) })));
  return mintCharterEpoch({ keySetHash: sealKeySetHash(keys, 1), nextKeyDigests: next.digests, nextThreshold: next.threshold, predecessors: [prev.epochCid] },
    { keys, threshold: 1, signatures, ...(genesis ? { genesis } : {}) });
}

describe("a key the genesis seated never returns", () => {
  test("G1 RED: a genesis key returning at the second roll refuses / CONTROL: an honest second roll verifies", async () => {
    const [g0, e1, e2, e3] = await Promise.all([hand(1), hand(10), hand(20), hand(30)]);
    const genesis = await incept([g0], 1, nextFor([e1]));
    const first = await rotateSealEpoch(genesis, seatsOf([e1]), nextFor([e2]), [e1.signer], [], seatsOf([g0]));
    if (!first.ok) throw new Error(first.reason);
    // The second roll reveals e2 and ADDS the genesis seat g0, which signs as an added seat would.
    const back = await rotateSealEpoch(first.epoch, { keys: [e2.pub, g0.pub], threshold: 1 }, nextFor([e3, await hand(31)], 1), [e2.signer, g0.signer], [genesis]);
    expect(back.ok ? null : back.code).toBe("roll-reuses-a-seated-key");
    const honest = await rotateSealEpoch(first.epoch, seatsOf([e2]), nextFor([e3]), [e2.signer], [genesis]);
    expect(honest.ok).toBe(true);
    if (honest.ok) expect(verifySealLineage([genesis, first.epoch, honest.epoch])).toBe(true);
  });

  test("G2 RED: a genesis key returning at the first roll refuses", async () => {
    const [g0, e1, e2, e3] = await Promise.all([hand(2), hand(11), hand(21), hand(22)]);
    const genesis = await incept([g0], 1, nextFor([e1]));
    const kept = await rotateSealEpoch(genesis, { keys: [e1.pub, g0.pub], threshold: 1 }, nextFor([e2, e3], 1), [e1.signer, g0.signer], [], seatsOf([g0]));
    expect(kept.ok ? null : kept.code).toBe("roll-reuses-a-seated-key");
  });

  test("G3 RED: a first roll that reveals no genesis seats, or seats off the genesis hash, refuses by name", async () => {
    const [g0, x, e1, e2] = await Promise.all([hand(3), hand(4), hand(12), hand(23)]);
    const genesis = await incept([g0], 1, nextFor([e1]));
    expect(verifySealRoll(genesis, await handRoll(genesis, [e1], [e2]))).toBe("roll-genesis-unrevealed");
    expect(verifySealRoll(genesis, await handRoll(genesis, [e1], [e2], seatsOf([x])))).toBe("roll-genesis-unbound");
    // One encoding alone: a reveal in another case or order, or with a key twice, reads malformed though it hashes alike.
    expect(verifySealRoll(genesis, await handRoll(genesis, [e1], [e2], { keys: [g0.pub.toUpperCase()], threshold: 1 }))).toBe("roll-malformed");
    expect(verifySealRoll(genesis, await handRoll(genesis, [e1], [e2], { keys: [g0.pub, g0.pub], threshold: 1 }))).toBe("roll-malformed");
    expect(verifySealRoll(genesis, await handRoll(genesis, [e1], [e2], seatsOf([g0])))).toBeNull();
  });

  test("G4 a later roll that carries genesis seats reads malformed", async () => {
    const [g0, e1, e2, e3] = await Promise.all([hand(5), hand(13), hand(24), hand(33)]);
    const genesis = await incept([g0], 1, nextFor([e1]));
    const first = await handRoll(genesis, [e1], [e2], seatsOf([g0]));
    expect(verifySealRoll(first, await handRoll(first, [e2], [e3], seatsOf([g0])), [genesis])).toBe("roll-malformed");
    expect(verifySealRoll(first, await handRoll(first, [e2], [e3]), [genesis])).toBeNull();
  });

  test("G5 CONTROL: both joint-genesis seats are revealed at its first roll and remain spent", async () => {
    const [a, b, firstA, firstB, secondA, secondB, nextA, nextB] = await Promise.all(
      [hand(41), hand(42), hand(43), hand(44), hand(45), hand(46), hand(47), hand(48)]);
    const genesis = await incept([a, b], 2, nextFor([firstA, firstB], 2));
    const first = await rotateSealEpoch(genesis, seatsOf([firstA, firstB], 2), nextFor([secondA, secondB], 2),
      [firstA.signer, firstB.signer], [], seatsOf([a, b], 2));
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.reason);
    const honest = await rotateSealEpoch(first.epoch, seatsOf([secondA, secondB], 2), nextFor([nextA, nextB], 2),
      [secondA.signer, secondB.signer], [genesis]);
    expect(honest.ok).toBe(true);
    const returned = await rotateSealEpoch(first.epoch, { keys: [secondA.pub, secondB.pub, a.pub], threshold: 2 },
      nextFor([nextA, nextB, await hand(49)], 2), [secondA.signer, secondB.signer, a.signer], [genesis]);
    expect(returned.ok ? null : returned.code).toBe("roll-reuses-a-seated-key");
  });
});
