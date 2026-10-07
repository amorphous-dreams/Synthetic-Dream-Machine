/**
 * wax-stamp.test — the provenance trichotomy: a seal traces to the CURRENT charter, a PAST-authentic
 * one, or a SPOOF; the charter chain verifies content-addresses, hash-links, pre-rotation AND the signed
 * roll at every step; duplicity is detectable while fork-legitimacy is deliberately NOT decided.
 */
import { describe, test, expect } from "vitest";
import * as ed25519 from "@noble/ed25519";
import {
  verifySealLineage, verifySealRoll, classifySeal, detectDuplicity,
  mintWaxStamp, verifyWaxStampSig, singleKeySetHash,
  sealKeySetHash, sealEpochCidOf, mintCharterEpoch, sealRollBytes,
  genesisCharterEpoch, rotateSealEpoch,
  type SealEpoch, type SealRollSigner, type WaxStamp,
} from "../src/wax-stamp.js";
import { ed25519SignerFromSeed } from "../src/auth-wire.js";
import { SEAL_ROLL_DOMAIN } from "../src/domains.js";

const hexOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");

interface Hand { readonly seed: Uint8Array; readonly pub: string; readonly signer: SealRollSigner }
async function hand(): Promise<Hand> {
  const seed = ed25519.utils.randomSecretKey();
  const pub = hexOf(await ed25519.getPublicKeyAsync(seed));
  return { seed, pub, signer: { signer: pub, sign: ed25519SignerFromSeed(seed) } };
}
async function hands(n: number): Promise<Hand[]> { return Promise.all(Array.from({ length: n }, () => hand())); }
const pubs = (hs: readonly Hand[]): string[] => hs.map((h) => h.pub);
const signersOf = (hs: readonly Hand[]): SealRollSigner[] => hs.map((h) => h.signer);

/** A lawful three-epoch chain: GEN seats, E1 rolls in signed, E2 rolls in signed. */
async function lawfulChain(): Promise<{ chain: SealEpoch[]; GEN: Hand[]; E1: Hand[]; E2: Hand[]; E3: Hand[] }> {
  const [GEN, E1, E2, E3] = await Promise.all([hands(2), hands(2), hands(2), hands(2)]);
  const g = genesisCharterEpoch(pubs(GEN), 2, sealKeySetHash(pubs(E1), 2));
  const r1 = await rotateSealEpoch(g, { keys: pubs(E1), threshold: 2 }, sealKeySetHash(pubs(E2), 2), signersOf(E1));
  if (!r1.ok) throw new Error(`fixture: ${r1.reason}`);
  const r2 = await rotateSealEpoch(r1.epoch, { keys: pubs(E2), threshold: 2 }, sealKeySetHash(pubs(E3), 2), signersOf(E2));
  if (!r2.ok) throw new Error(`fixture: ${r2.reason}`);
  return { chain: [g, r1.epoch, r2.epoch], GEN, E1, E2, E3 };
}

const stampUnder = (epochCid: string, sig = `sig-${epochCid}`): WaxStamp =>
  ({ artifactHash: "art-1", epochCid, sealedAt: "itc:[0,4]", signature: sig });
// A faithful sig-verify stub: the signature is "sig-<epochCid>" iff genuinely sealed under that epoch.
const verifySig = (s: WaxStamp, e: SealEpoch): boolean => s.signature === `sig-${e.epochCid}`;

describe("wax-stamp — charter-epoch provenance", () => {
  test("verifySealLineage accepts a pre-rotated, hash-linked, signed lineage", async () => {
    const { chain } = await lawfulChain();
    expect(verifySealLineage(chain)).toBe(true);
  });

  test("verifySealLineage rejects a broken hash-link, a moved cid, a genesis with a prev or a roll, and an empty chain", async () => {
    const { chain } = await lawfulChain();
    expect(verifySealLineage([{ ...chain[0]!, prevEpochCid: "x" }])).toBe(false);                 // genesis has a prev
    expect(verifySealLineage([{ ...chain[0]!, roll: chain[1]!.roll! }])).toBe(false);             // genesis carries a roll
    expect(verifySealLineage([chain[0]!, { ...chain[1]!, prevEpochCid: "wrong" }, chain[2]!])).toBe(false);   // hash-link
    expect(verifySealLineage([chain[0]!, chain[1]!, { ...chain[2]!, epochCid: "epoch-forged" }])).toBe(false); // cid moved
    expect(verifySealLineage([])).toBe(false);
  });

  test("a seal under the HEAD epoch reads CURRENT; under an ANCESTOR, PAST_AUTHENTIC", async () => {
    const { chain } = await lawfulChain();
    expect(classifySeal(stampUnder(chain[2]!.epochCid), chain, verifySig)).toBe("CURRENT");
    expect(classifySeal(stampUnder(chain[1]!.epochCid), chain, verifySig)).toBe("PAST_AUTHENTIC");
    expect(classifySeal(stampUnder(chain[0]!.epochCid), chain, verifySig)).toBe("PAST_AUTHENTIC");
  });

  test("SPOOF: an unknown epoch, a failed signature, or a broken chain", async () => {
    const { chain } = await lawfulChain();
    const head = chain[2]!.epochCid;
    expect(classifySeal(stampUnder("epoch-unknown"), chain, verifySig)).toBe("SPOOF");            // no such epoch
    expect(classifySeal(stampUnder(head, "forged"), chain, verifySig)).toBe("SPOOF");             // sig fails
    const unsigned = [chain[0]!, chain[1]!, { ...chain[2]!, roll: { ...chain[2]!.roll!, signatures: [] } }];
    expect(classifySeal(stampUnder(head), unsigned, verifySig)).toBe("SPOOF");                    // lineage broken
  });

  test("duplicity: two SIGNED successors of one predecessor name that predecessor; a consistent pair is clean", async () => {
    const { chain, E1, E3 } = await lawfulChain();
    // The epoch-1 hands sign a SECOND successor — a different next commitment — from the same genesis.
    const fork = await rotateSealEpoch(chain[0]!, { keys: pubs(E1), threshold: 2 }, sealKeySetHash(pubs(E3), 2), signersOf(E1));
    if (!fork.ok) throw new Error(fork.reason);
    const forked = [chain[0]!, fork.epoch];
    expect(verifySealLineage(forked)).toBe(true);                       // both forks verify on their own…
    expect(detectDuplicity(chain, forked)).toBe(chain[0]!.epochCid);    // …and together prove misbehavior at genesis
    expect(detectDuplicity(chain, chain)).toBeNull();                   // the same lineage duplicates nothing
    // Two distinct geneses share no predecessor: two lineages, never one controller's duplicity.
    const other = genesisCharterEpoch(pubs(E3), 2, "");
    expect(detectDuplicity(chain, [other])).toBeNull();
    // NOTE: which fork is "legitimate" is NOT decided here — higher-order social acceptance, never a signature.
  });
});

describe("wax-stamp R1 — a no-membership reader verifies provenance from the PUBLIC charter, no roster", () => {
  test("the reader classifies CURRENT / PAST-AUTHENTIC / SPOOF from the public charter alone", async () => {
    // Single-signer epochs: each epoch's key-set is one key at threshold 1.
    const [k0, k1, k2, k3] = await hands(4);
    const g = genesisCharterEpoch([k0!.pub], 1, sealKeySetHash([k1!.pub], 1));
    const r1 = await rotateSealEpoch(g, { keys: [k1!.pub], threshold: 1 }, sealKeySetHash([k2!.pub], 1), [k1!.signer]);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = await rotateSealEpoch(r1.epoch, { keys: [k2!.pub], threshold: 1 }, sealKeySetHash([k3!.pub], 1), [k2!.signer]);
    if (!r2.ok) throw new Error(r2.reason);
    const CHARTER = [g, r1.epoch, r2.epoch];
    expect(verifySealLineage(CHARTER)).toBe(true);

    const inSet = (k: string, h: string): boolean => sealKeySetHash([k], 1) === h;
    const sign = (h: Hand) => ed25519SignerFromSeed(h.seed);
    const current = await mintWaxStamp({ artifactHash: "art-current", epoch: CHARTER[2]!, sealedAt: "itc:[8,12]", sign: sign(k2!) });
    const currentOk = await verifyWaxStampSig(current, CHARTER[2]!, k2!.pub, inSet);
    expect(classifySeal(current, CHARTER, () => currentOk)).toBe("CURRENT");

    const past = await mintWaxStamp({ artifactHash: "art-past", epoch: CHARTER[1]!, sealedAt: "itc:[4,8]", sign: sign(k1!) });
    const pastOk = await verifyWaxStampSig(past, CHARTER[1]!, k1!.pub, inSet);
    expect(classifySeal(past, CHARTER, () => pastOk)).toBe("PAST_AUTHENTIC");

    // A SPOOF: signed by a key the cited epoch does NOT authorize (k0 signing under the head epoch).
    const spoof = await mintWaxStamp({ artifactHash: "art-spoof", epoch: CHARTER[2]!, sealedAt: "itc:[8,12]", sign: sign(k0!) });
    const spoofOk = await verifyWaxStampSig(spoof, CHARTER[2]!, k0!.pub, inSet);
    expect(spoofOk).toBe(false);
    expect(classifySeal(spoof, CHARTER, () => spoofOk)).toBe("SPOOF");
    void singleKeySetHash;
  });

  test("the public charter exposes KEYS/THRESHOLDS, never a roster or a sequence", async () => {
    const { chain, E2 } = await lawfulChain();
    expect(Object.keys(chain[0]!).sort()).toEqual(["epochCid", "keySetHash", "nextKeyCommit", "prevEpochCid"]);
    for (const e of chain.slice(1)) {
      expect(Object.keys(e).sort()).toEqual(["epochCid", "keySetHash", "nextKeyCommit", "prevEpochCid", "roll"]);
      expect(Object.keys(e.roll!).sort()).toEqual(["keys", "signatures", "threshold"]);
    }
    // The roll carries the epoch's PUBLIC keys (charter material); the digest itself reveals nothing.
    expect(chain[2]!.keySetHash).not.toContain(E2[0]!.pub);
  });
});

describe("charter-epoch CHAIN minter — pre-rotation seat + SIGNED rotate ceremony", () => {
  test("sealKeySetHash is order-blind + threshold-bound; sealEpochCidOf is tamper-evident; genesis reads epoch0-", () => {
    const K = ["a".repeat(64), "b".repeat(64)];
    expect(sealKeySetHash(K, 2)).toBe(sealKeySetHash([...K].reverse(), 2));
    expect(sealKeySetHash(K, 2)).not.toBe(sealKeySetHash(K, 1));
    const f = { keySetHash: "k0", nextKeyCommit: "k1", prevEpochCid: null };
    expect(sealEpochCidOf(f)).toBe(mintCharterEpoch(f).epochCid);
    expect(sealEpochCidOf(f)).toMatch(/^epoch0-[0-9a-f]{64}$/);
    expect(sealEpochCidOf({ ...f, prevEpochCid: "p" })).toMatch(/^epoch-[0-9a-f]{64}$/);
    expect(sealEpochCidOf({ ...f, nextKeyCommit: "TAMPERED" })).not.toBe(sealEpochCidOf(f));
  });

  test("the roll signs under its own domain, binding the predecessor, the seated set, the threshold and the next commitment", () => {
    const parts = { prevEpochCid: "epoch0-x", keys: ["b".repeat(64), "a".repeat(64)], threshold: 2, nextKeyCommit: "n" };
    const text = new TextDecoder().decode(sealRollBytes(parts));
    expect(text).toContain(SEAL_ROLL_DOMAIN);
    expect(sealRollBytes(parts)).toEqual(sealRollBytes({ ...parts, keys: [...parts.keys].reverse() }));   // order-blind
    for (const moved of [{ prevEpochCid: "epoch0-y" }, { threshold: 1 }, { nextKeyCommit: "m" }, { keys: ["c".repeat(64)] }]) {
      expect(sealRollBytes({ ...parts, ...moved })).not.toEqual(sealRollBytes(parts));
    }
  });

  test("CONTROL — a lawful roll holds: genesis has no prev and no roll, the signed successor verifies", async () => {
    const [GEN, E1, E2] = await Promise.all([hands(2), hands(2), hands(2)]);
    const g = genesisCharterEpoch(pubs(GEN), 2, sealKeySetHash(pubs(E1), 2));
    expect(g.prevEpochCid).toBeNull();
    expect(g.roll).toBeUndefined();
    expect(verifySealLineage([g])).toBe(true);

    const r = await rotateSealEpoch(g, { keys: pubs(E1), threshold: 2 }, sealKeySetHash(pubs(E2), 2), signersOf(E1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.epoch.prevEpochCid).toBe(g.epochCid);
    expect(r.epoch.keySetHash).toBe(sealKeySetHash(pubs(E1), 2));
    expect(verifySealRoll(g, r.epoch)).toBeNull();
    expect(verifySealLineage([g, r.epoch])).toBe(true);
  });

  test("★ a forged N+1′ built from the revealed PUBLIC keys and no private key REFUSES ★", async () => {
    const { chain, E1, E3 } = await lawfulChain();
    const [g, e1] = [chain[0]!, chain[1]!];
    // The attacker knows E1's public keys (epoch 1 revealed them) and holds no E1 seed. It mints a
    // competing epoch 1′ with its own next commitment, carrying a roll that names E1's keys.
    const attacker = await hands(2);
    const forgedFields = { keySetHash: sealKeySetHash(pubs(E1), 2), nextKeyCommit: sealKeySetHash(pubs(attacker), 2), prevEpochCid: g.epochCid };
    const bytes = sealRollBytes({ prevEpochCid: g.epochCid, keys: pubs(E1), threshold: 2, nextKeyCommit: forgedFields.nextKeyCommit });
    // Its best signatures: attacker keys claiming E1 signers, and E1's real signatures lifted off epoch 1.
    const lifted = e1.roll!.signatures;
    const claimed = await Promise.all(attacker.map(async (a, i) => ({ signer: E1[i]!.pub, sig: await a.signer.sign(bytes) })));
    for (const signatures of [[], lifted, claimed]) {
      const forged = mintCharterEpoch(forgedFields, { keys: pubs(E1), threshold: 2, signatures });
      expect(verifySealRoll(g, forged)).toBe("roll-short-of-revealed-quorum");
      expect(verifySealLineage([g, forged])).toBe(false);
    }
    // Nor can it forge N+2 on the lawful chain: epoch 2's keys need E2's seeds, which it lacks.
    const forgedNext = await rotateSealEpoch(chain[2]!, { keys: pubs(E3), threshold: 2 }, "", signersOf(attacker));
    expect(forgedNext.ok).toBe(false);
  });

  test("★ a roll short of threshold REFUSES — one of a 2-of-2 reveal signs ★", async () => {
    const [GEN, E1] = await Promise.all([hands(2), hands(2)]);
    const g = genesisCharterEpoch(pubs(GEN), 2, sealKeySetHash(pubs(E1), 2));
    const r = await rotateSealEpoch(g, { keys: pubs(E1), threshold: 2 }, "", [E1[0]!.signer]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/roll-short-of-revealed-quorum/);
    // The same signer twice counts once.
    const twice = await rotateSealEpoch(g, { keys: pubs(E1), threshold: 2 }, "", [E1[0]!.signer, E1[0]!.signer]);
    expect(twice.ok).toBe(false);
  });

  test("★ a seat-change key without proof of possession REFUSES; with it, the roll holds ★", async () => {
    const [GEN, E1, [added]] = await Promise.all([hands(2), hands(3), hands(1)]);
    const g = genesisCharterEpoch(pubs(GEN), 2, sealKeySetHash(pubs(E1), 2));   // committed: E1, 2-of-3
    const revealed = { keys: pubs(E1), threshold: 2 };
    const seat = { keys: [...pubs(E1), added!.pub], threshold: 2, revealed };   // a fourth seat the commitment never named

    const without = await rotateSealEpoch(g, seat, "", signersOf(E1));
    expect(without.ok).toBe(false);
    if (without.ok) return;
    expect(without.reason).toMatch(/seat-change-without-proof-of-possession/);

    // A signature by some OTHER key under the added key's name proves nothing.
    const bytes = sealRollBytes({ prevEpochCid: g.epochCid, keys: seat.keys, threshold: 2, nextKeyCommit: "" });
    const impostor = { signer: added!.pub, sign: async () => E1[0]!.signer.sign(bytes) };
    expect((await rotateSealEpoch(g, seat, "", [...signersOf(E1), impostor])).ok).toBe(false);

    // CONTROL: the added key signs the same bytes — the seat change holds.
    const withPop = await rotateSealEpoch(g, seat, "", [...signersOf(E1.slice(0, 2)), added!.signer]);
    expect(withPop.ok).toBe(true);
    if (!withPop.ok) return;
    expect(verifySealLineage([g, withPop.epoch])).toBe(true);
    // The added key alone carries no prior authority: the revealed quorum still has to sign.
    const popOnly = await rotateSealEpoch(g, seat, "", [E1[0]!.signer, added!.signer]);
    expect(popOnly.ok).toBe(false);
  });

  test("a mismatched reveal REFUSES (fail-closed): the revealed key-set is not the pre-committed one", async () => {
    const [GEN, E1, E2] = await Promise.all([hands(2), hands(2), hands(2)]);
    const g = genesisCharterEpoch(pubs(GEN), 2, sealKeySetHash(pubs(E1), 2));
    const r = await rotateSealEpoch(g, { keys: pubs(E2), threshold: 2 }, "", signersOf(E2));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/reveal mismatch/);
  });

  test("an UNARMED head (no pre-commitment) REFUSES rotation — nothing was committed to verify", async () => {
    const [GEN, E1] = await Promise.all([hands(2), hands(2)]);
    const g = genesisCharterEpoch(pubs(GEN), 2, "");
    const r = await rotateSealEpoch(g, { keys: pubs(E1), threshold: 2 }, "", signersOf(E1));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/unarmed/);
  });

  test("a signed roll does not travel: re-pointing it at another predecessor or commitment breaks it", async () => {
    const { chain } = await lawfulChain();
    const [g, e1] = [chain[0]!, chain[1]!];
    const repointed = mintCharterEpoch({ ...e1, nextKeyCommit: "moved" }, e1.roll);
    expect(verifySealRoll(g, repointed)).toBe("roll-short-of-revealed-quorum");
    const otherPrev = genesisCharterEpoch(["c".repeat(64)], 1, g.nextKeyCommit);
    const spliced = mintCharterEpoch({ ...e1, prevEpochCid: otherPrev.epochCid }, e1.roll);
    expect(verifySealLineage([otherPrev, spliced])).toBe(false);
  });
});
