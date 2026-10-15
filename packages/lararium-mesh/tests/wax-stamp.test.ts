/** The charter roll law binds positional cold successors and verifies every signed transition. */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { ed25519SignerFromSeed } from "../src/auth-wire.js";
import { seatNextDigest } from "../src/cold-key-card.js";
import { CHARTER_SEAT_ROLL_DOMAIN } from "../src/domains.js";
import { charterInceptionImage, genesisCharterEpoch, inceptCharterEpoch, rotateSealEpoch, sealKeySetHash, sealRollBytes, mintCharterEpoch,
  verifySealRoll, verifySealLineage, classifySeal, detectDuplicity, weakSeatOf, type SealEpoch, type SealKeySet, type SealNext,
  type SealRollSigner } from "../src/wax-stamp.js";

interface Hand { seed: Uint8Array; pub: string; signer: SealRollSigner }
const hand = async (n: number): Promise<Hand> => { const seed = new Uint8Array(32).fill(n); const pub = await ed.getPublicKeyAsync(seed).then(hex); return { seed, pub, signer: { signer: pub, sign: b => ed25519SignerFromSeed(seed)(b) } }; };
const nextFor = async (hands: readonly Hand[]): Promise<SealNext> => ({ digests: await Promise.all(hands.map(h => seatNextDigest(h.pub))).then(a => a.sort()), threshold: hands.length });
/** Each genesis the helper seats, by its CID: the seats a first roll off it reveals. */
const genesisSeats = new Map<string, SealKeySet>();
const seatsOf = (hands: readonly Hand[], threshold = hands.length): SealKeySet => ({ keys: hands.map(h => h.pub.toLowerCase()).sort(), threshold });
/** A genesis every seat of `old` incepts, at `threshold`, committing `next`. */
const incept = (old: readonly Hand[], threshold: number, next: SealNext) =>
  inceptCharterEpoch(charterInceptionImage(old.map(h => h.pub), threshold, next), old.map(h => h.signer));
const genesis = async (old: readonly Hand[], next: readonly Hand[]) => {
  const g = await incept(old, old.length, await nextFor(next));
  genesisSeats.set(g.epochCid, seatsOf(old));
  return g;
};
const roll = async (prev: SealEpoch, seats: readonly Hand[], then: readonly Hand[], history: readonly SealEpoch[] = []) => rotateSealEpoch(prev,
  { keys: seats.map(h => h.pub), threshold: seats.length }, await nextFor(then), seats.map(h => h.signer), history, genesisSeats.get(prev.epochCid));

// Fixed seeds keep vectors repeatable and each generation disjoint.
const batch = async (start: number, count: number) => Promise.all(Array.from({ length: count }, (_, i) => hand(start + i)));

describe("charter seat roll", () => {
  test("one-seat and two-seat controls verify complete lineages", async () => {
    for (const n of [1, 2]) { const [g, e1, e2] = await Promise.all([batch(1, n), batch(10, n), batch(20, n)]); const a = await genesis(g!, e1!); const b = await roll(a, e1!, e2!); expect(b.ok).toBe(true); if (b.ok) expect(verifySealLineage([a, b.epoch])).toBe(true); }
  });
  test("a seat added by possession succeeds; a seat may drop while the revealed quorum signs", async () => {
    const [g0, old, add, then3, then1] = await Promise.all([batch(1, 2), batch(10, 2), batch(12, 1), batch(20, 3), batch(30, 1)]);
    const g = await incept(g0!, 1, { digests: [...old!.map(h => seatNextDigest(h.pub))].sort(), threshold: 1 });
    const added = await rotateSealEpoch(g, { keys: [...old!, ...add!].map(h => h.pub), threshold: 1 }, { ...(await nextFor(then3!)), threshold: 1 }, [...old!.map(h => h.signer), ...add!.map(h => h.signer)], [], seatsOf(g0!, 1));
    expect(added.ok).toBe(true);
    const dropped = await rotateSealEpoch(g, { keys: [old![0]!.pub], threshold: 1 }, await nextFor(then1!), [old![0]!.signer], [], seatsOf(g0!, 1));
    expect(dropped.ok).toBe(true);
  });
  test("an armed genesis rejects a successor rule with the wrong count, duplicate, digest or threshold", async () => {
    const [a, b] = await Promise.all([batch(1, 2), batch(10, 2)]); const next = await nextFor(b!);
    for (const bad of [{ digests: next.digests.slice(1), threshold: 2 }, { digests: [next.digests[0]!, next.digests[0]!], threshold: 2 }, { digests: ["A".repeat(64), next.digests[1]!], threshold: 2 }, { digests: next.digests, threshold: 1 }])
      expect(() => genesisCharterEpoch(a!.map(h => h.pub), 2, bad)).toThrow(/roll-malformed/);
  });
  test("refusal vectors name each first broken clause", async () => {
    const [g0, a, b, c] = await Promise.all([batch(1, 2), batch(10, 2), batch(20, 2), batch(30, 2)]);
    const g = await genesis(g0!, a!), valid = await roll(g, a!, b!); if (!valid.ok) throw Error(valid.reason);
    const good = valid.epoch;
    expect(verifySealRoll(g, { ...good, roll: undefined })).toBe("roll-unsigned");
    expect(verifySealRoll(g, { ...good, roll: { ...good.roll!, threshold: 3 } })).toBe("roll-malformed");
    const weak = mintCharterEpoch({ ...good, keySetHash: sealKeySetHash(["00".repeat(32)], 1) }, { keys: ["00".repeat(32)], threshold: 1, signatures: [] });
    expect(verifySealRoll(g, weak)).toBe("roll-holds-a-weak-key");
    expect(verifySealRoll(g, mintCharterEpoch({ ...good, keySetHash: "bad" }, good.roll))).toBe("roll-key-set-unbound");
    expect(verifySealRoll({ ...g, nextKeyDigests: [], nextThreshold: 0 }, good)).toBe("rotation-unarmed");
    expect(verifySealRoll(g, mintCharterEpoch({ ...good, nextKeyDigests: [], nextThreshold: 0 }, good.roll))).toBe("roll-unarmed-successor");
    const replay = mintCharterEpoch({ ...good, nextKeyDigests: g.nextKeyDigests }, good.roll);
    expect(verifySealRoll(g, replay)).toBe("roll-respends-a-digest");
    // An earlier epoch whose roll seated these very keys, under digests this roll does not re-spend.
    expect(verifySealRoll(g, good, [{ ...good, nextKeyDigests: [], nextThreshold: 0 }])).toBe("roll-reuses-a-seated-key");
    expect(verifySealRoll(g, { ...good, roll: { ...good.roll!, signatures: [] } })).toBe("roll-short-of-revealed-quorum");
    const half = await roll(g, a!, c!); if (!half.ok) throw Error(half.reason);
    expect(verifySealRoll(g, { ...half.epoch, roll: { ...half.epoch.roll!, signatures: half.epoch.roll!.signatures.slice(0, 1) } })).toBe("roll-short-of-revealed-quorum");
    const addedForQuorum = await batch(41, 1), then3 = await batch(43, 3), all3 = [...a!, ...addedForQuorum!];
    const bytes3 = sealRollBytes({ predecessor: g.epochCid, keys: all3.map(h => h.pub), threshold: 3,
      nextKeyDigests: (await nextFor(then3!)).digests, nextThreshold: 3 });
    const sigs3 = await Promise.all(a!.map(async h => ({ signer: h.pub, sig: await h.signer.sign(bytes3) })));
    const shortSeated = mintCharterEpoch({ keySetHash: sealKeySetHash(all3.map(h => h.pub), 3), nextKeyDigests: (await nextFor(then3!)).digests,
      nextThreshold: 3, predecessors: [g.epochCid] }, { keys: all3.map(h => h.pub), threshold: 3, signatures: sigs3, genesis: seatsOf(g0!) });
    expect(verifySealRoll(g, shortSeated)).toBe("roll-short-of-seated-quorum");
    const added = await batch(40, 1); const seated3 = [...a!, ...added!];   // three seats at two-of-three, re-armed three ways
    const withAdded = await rotateSealEpoch(g, { keys: seated3.map(h => h.pub), threshold: 2 }, { ...(await nextFor(await batch(50, 3))), threshold: 2 }, seated3.map(h => h.signer), [], seatsOf(g0!)); if (!withAdded.ok) throw Error(withAdded.reason);
    const noPop = { ...withAdded.epoch, roll: { ...withAdded.epoch.roll!, signatures: withAdded.epoch.roll!.signatures.filter(s => s.signer !== added![0]!.pub) } };
    expect(verifySealRoll(g, noPop)).toBe("seat-change-without-proof-of-possession");
  });
  test("a lineage walks every earlier roll: a key a roll added by possession never seats again two rolls on", async () => {
    const [g0, b, x, c, d] = await Promise.all([batch(1, 2), batch(10, 2), batch(15, 1), batch(20, 3), batch(30, 2)]);
    const g = await genesis(g0!, b!);                                                  // commits B
    const e1 = await rotateSealEpoch(g, { keys: [...b!, ...x!].map(h => h.pub), threshold: 2 }, { ...(await nextFor(c!)), threshold: 2 },
      [...b!, ...x!].map(h => h.signer), [], seatsOf(g0!));                           // seats B and X (by possession), commits C
    if (!e1.ok) throw Error(e1.reason);
    const e2 = await rotateSealEpoch(e1.epoch, { keys: c!.map(h => h.pub), threshold: 2 }, { ...(await nextFor([...d!, ...x!])), threshold: 2 },
      c!.map(h => h.signer), [g]);                                                     // seats C, commits D and X again
    if (!e2.ok) throw Error(e2.reason);
    const e3 = await rotateSealEpoch(e2.epoch, { keys: [...d!, ...x!].map(h => h.pub), threshold: 2 }, { ...(await nextFor(await batch(40, 3))), threshold: 2 },
      [...d!, ...x!].map(h => h.signer), [g, e1.epoch]);
    expect(e3.ok ? null : e3.code).toBe("roll-reuses-a-seated-key");                   // X sat in e1's roll
    // The same step, signed whole by every seated hand: only the earlier rolls tell it apart from a lawful one.
    const seated = [...d!, ...x!], following = (await nextFor(await batch(50, 3))).digests;
    const bytes = sealRollBytes({ predecessor: e2.epoch.epochCid, keys: seated.map(h => h.pub), threshold: 2, nextKeyDigests: following, nextThreshold: 2 });
    const signatures = await Promise.all(seated.map(async h => ({ signer: h.pub, sig: await h.signer.sign(bytes) })));
    const stitched = mintCharterEpoch({ keySetHash: sealKeySetHash(seated.map(h => h.pub), 2), nextKeyDigests: following,
      nextThreshold: 2, predecessors: [e2.epoch.epochCid] }, { keys: seated.map(h => h.pub), threshold: 2, signatures });
    expect(verifySealRoll(e2.epoch, stitched)).toBeNull();                              // CONTROL: against its predecessor alone it reads lawful
    expect(verifySealLineage([g, e1.epoch, e2.epoch, stitched])).toBe(false);
    expect(verifySealRoll(e2.epoch, stitched, [g, e1.epoch])).toBe("roll-reuses-a-seated-key");   // the lineage reads it so
  });
  test("roll bytes carry the six-field seat-roll domain and lineage classification keeps its trichotomy", async () => {
    const [g0, a, b] = await Promise.all([batch(1, 1), batch(10, 1), batch(20, 1)]); const g = await genesis(g0!, a!); const r = await roll(g, a!, b!); if (!r.ok) throw Error(r.reason);
    const bytes = sealRollBytes({ predecessor: g.epochCid, keys: [a![0]!.pub], threshold: 1, nextKeyDigests: (await nextFor(b!)).digests, nextThreshold: 1 });
    expect(new TextDecoder().decode(bytes)).toContain(CHARTER_SEAT_ROLL_DOMAIN);
    expect(classifySeal({ artifactHash: "a", epochCid: r.epoch.epochCid, sealedAt: "t", signature: "ok" }, [g, r.epoch], () => true)).toBe("CURRENT");
    expect(detectDuplicity([g, r.epoch], [g, r.epoch])).toBeNull();
    expect(weakSeatOf(["00".repeat(32)])).not.toBeNull();
  });
});
