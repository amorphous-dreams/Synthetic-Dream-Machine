/**
 * charter-fixture.test — the one door mesh tests build a charter through.
 *
 * Proven:
 *   · a fixture charter of one, two or three seats verifies under the roll law, and keeps verifying across
 *     two rolls while its name (the genesis cid) stays fixed and its head moves;
 *   · a roll may add a seat, drop a seat or change the threshold, and still verifies;
 *   · the fixture reads deterministic in its seed and never re-seats a key;
 *   · an unarmed genesis verifies and refuses to roll; a roll never mutates the charter it grew from;
 *   · the funnel holds: no mesh test outside this helper and the roll law's own test builds an epoch by hand
 *     or names how an epoch commits its successors.
 */
import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { genesisCharterEpoch, rotateSealEpoch, sealKeySetHash, verifySealLineage, verifySealRoll } from "../src/wax-stamp.js";
import { NEXUS_DOC_DOMAIN } from "../src/domains.js";
import { foundingRoster } from "../src/nexus-seal-seed.js";
import { realmIdOfCharter } from "../src/realm-bag.js";
import { charterSeatSeeds, heldCharter, namedCharter, seatedCharter } from "./charter-fixture.js";

describe("a seated fixture charter stands under the roll law", () => {
  test.each([[1, 1], [2, 2], [3, 2]] as const)("★ %i seat(s) at threshold %i verify at genesis and across two rolls ★", async (seats, threshold) => {
    const genesis = await seatedCharter({ seats, threshold });
    expect(genesis.chain).toHaveLength(1);
    expect(genesis.generation).toBe(0);
    expect(genesis.aid).toBe(genesis.head.epochCid);
    expect(verifySealLineage(genesis.chain)).toBe(true);
    expect(genesis.keys).toHaveLength(seats);
    expect(sealKeySetHash(genesis.keys, threshold)).toBe(genesis.head.keySetHash);

    const first = await genesis.roll();
    const second = await first.roll();
    for (const [depth, c] of [[1, first], [2, second]] as const) {
      expect(c.chain).toHaveLength(depth + 1);
      expect(c.generation).toBe(depth);
      expect(verifySealLineage(c.chain)).toBe(true);
      expect(c.aid).toBe(genesis.aid);                               // the name stays fixed
      expect(c.head.epochCid).not.toBe(genesis.aid);                 // the head moves
      expect(c.head.prevEpochCid).toBe(c.chain[depth - 1]!.epochCid);
      expect(sealKeySetHash(c.keys, c.threshold)).toBe(c.head.keySetHash);
      expect(c.roster).toEqual({ keys: c.keys, threshold, sealEpochCid: c.head.epochCid });
    }
    expect(second.head.epochCid).not.toBe(first.head.epochCid);
    // A roll returns the grown charter and leaves its receiver as it stood.
    expect(genesis.chain).toHaveLength(1);
    expect(first.chain).toHaveLength(2);
  });

  test("the seats' seeds, keys and hands agree, in one order", async () => {
    const c = await seatedCharter({ seats: 3, threshold: 2, seed: 9 });
    expect(c.seeds).toEqual(charterSeatSeeds(9, 0, 3));
    expect(c.keys).toEqual(await Promise.all(c.seeds.map((s) => ed.getPublicKeyAsync(s).then(hex))));
    const hands = await c.signers();
    expect(hands.map((h) => h.signer)).toEqual(c.keys);
    const two = await c.signers([2, 0]);
    expect(two.map((h) => h.signer)).toEqual([c.keys[2], c.keys[0]]);
    const bytes = new TextEncoder().encode("a synthetic act");
    expect(await ed.verifyAsync(Buffer.from(await two[0]!.sign(bytes), "hex"), bytes, Buffer.from(c.keys[2]!, "hex"))).toBe(true);
    await expect(c.signers([3])).rejects.toMatchObject({ code: "no-such-seat" });
    // The rolled generation's seeds read off the same derivation, one generation on.
    expect((await c.roll()).seeds).toEqual(charterSeatSeeds(9, 1, 3));
  });

  test("★ a roll may add a seat, drop a seat, or change the threshold ★", async () => {
    const grown = await (await seatedCharter({ seats: 2, threshold: 2 })).roll({ seats: 3 });
    expect(grown.keys).toHaveLength(3);
    expect(grown.threshold).toBe(2);
    expect(verifySealLineage(grown.chain)).toBe(true);

    const shrunk = await (await seatedCharter({ seats: 3, threshold: 2 })).roll({ seats: 2 });
    expect(shrunk.keys).toHaveLength(2);
    expect(verifySealLineage(shrunk.chain)).toBe(true);

    const loosened = await (await seatedCharter({ seats: 2, threshold: 2 })).roll({ threshold: 1 });
    expect(loosened.threshold).toBe(1);
    expect(sealKeySetHash(loosened.keys, 1)).toBe(loosened.head.keySetHash);
    expect(verifySealLineage(loosened.chain)).toBe(true);

    // Each changed charter rolls AGAIN at its own shape: the change re-armed it.
    for (const c of [grown, shrunk, loosened]) expect(verifySealLineage((await c.roll()).chain)).toBe(true);
    // A shape no quorum could meet refuses by name.
    await expect((await seatedCharter({ seats: 2, threshold: 2 })).roll({ threshold: 3 })).rejects.toMatchObject({ code: "roll-malformed" });
    await expect(seatedCharter({ seats: 0, threshold: 1 })).rejects.toMatchObject({ code: "roll-malformed" });
  });

  test("one seed reads one charter; another seed reads another; no key seats twice", async () => {
    const cidsOf = async (seed: number): Promise<string[]> => {
      let c = await seatedCharter({ seats: 3, threshold: 2, seed });
      const cids = [c.head.epochCid];
      for (let i = 0; i < 2; i++) { c = await c.roll(); cids.push(c.head.epochCid); }
      return cids;
    };
    expect(await cidsOf(11)).toEqual(await cidsOf(11));
    const a = await cidsOf(11), b = await cidsOf(12);
    for (const cid of a) expect(b).not.toContain(cid);

    let c = await seatedCharter({ seats: 3, threshold: 2, seed: 11 });
    const seen: string[] = [...c.keys];
    for (let i = 0; i < 3; i++) { c = await c.roll(); seen.push(...c.keys); }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(12);
  });

  test("an unarmed genesis verifies and refuses to roll", async () => {
    const bare = await seatedCharter({ seats: 2, threshold: 2, armed: false });
    expect(verifySealLineage(bare.chain)).toBe(true);
    await expect(bare.roll()).rejects.toMatchObject({ code: "rotation-unarmed" });
    // The armed twin seats the same keys under another name: the commitment enters the genesis cid.
    const armed = await seatedCharter({ seats: 2, threshold: 2 });
    expect(armed.keys).toEqual(bare.keys);
    expect(armed.aid).not.toBe(bare.aid);
    expect(verifySealLineage((await armed.roll()).chain)).toBe(true);   // CONTROL
  });

  test("CONTROL: the roll law still refuses what a fixture never builds", async () => {
    const rolled = await (await seatedCharter({ seats: 2, threshold: 2 })).roll();
    const [genesis, head] = rolled.chain;
    expect(verifySealRoll(genesis!, head!)).toBeNull();
    expect(verifySealLineage([genesis!, { ...head!, prevEpochCid: "forged" }])).toBe(false);
    expect(verifySealLineage([genesis!, { ...head!, roll: { ...head!.roll!, signatures: [] } }])).toBe(false);
    expect(verifySealLineage([genesis!, { ...head!, roll: { ...head!.roll!, signatures: head!.roll!.signatures.slice(0, 1) } }])).toBe(false);
    // A roll from another fixture family never continues this lineage.
    const stranger = await (await seatedCharter({ seats: 2, threshold: 2, seed: 2 })).roll();
    expect(verifySealLineage([genesis!, stranger.head])).toBe(false);
  });
});

describe("a charter over keys the caller holds", () => {
  const seedOf = (n: number) => new Uint8Array(32).fill(n);
  const keyOf = (n: number) => ed.getPublicKeyAsync(seedOf(n)).then(hex);
  const handOf = async (n: number) => ({ signer: await keyOf(n), sign: (bytes: Uint8Array) => ed.signAsync(bytes, seedOf(n)).then(hex) });
  const keysOf = (ns: readonly number[]) => Promise.all(ns.map(keyOf));
  const handsOf = (ns: readonly number[]) => Promise.all(ns.map(handOf));

  test("★ an unarmed held genesis reads the bytes the constructor mints over the same seats, and refuses to roll ★", async () => {
    const keys = await keysOf([1, 2, 3]);
    const held = heldCharter({ keys, threshold: 2 });
    expect(held.head).toEqual(genesisCharterEpoch(keys, 2, ""));
    expect(held.chain).toEqual([held.head]);
    expect(held.aid).toBe(held.head.epochCid);
    expect(held.generation).toBe(0);
    expect(held.keys).toEqual(keys);
    expect(held.roster).toEqual({ keys, threshold: 2, sealEpochCid: held.aid });
    expect(verifySealLineage(held.chain)).toBe(true);
    await expect(held.roll(await handsOf([1, 2, 3]))).rejects.toMatchObject({ code: "rotation-unarmed" });
  });

  test("★ a held genesis that names its successors rolls under their hands, twice, and each epoch reads the constructor's bytes ★", async () => {
    const [first, second, third] = await Promise.all([keysOf([1, 2, 3]), keysOf([4, 5, 6]), keysOf([7, 8])]);
    const genesis = heldCharter({ keys: first!, threshold: 2, successors: { keys: second!, threshold: 2 } });
    expect(genesis.head).toEqual(genesisCharterEpoch(first!, 2, sealKeySetHash(second!, 2)));

    const rolled = await genesis.roll(await handsOf([4, 5, 6]), { keys: third!, threshold: 1 });
    const byHand = await rotateSealEpoch(genesis.head, { keys: second!, threshold: 2 }, sealKeySetHash(third!, 1), await handsOf([4, 5, 6]));
    expect(byHand.ok && byHand.epoch).toEqual(rolled.head);              // the whole epoch: its cid, its roll, every signature
    expect(rolled.keys).toEqual(second);
    expect(rolled.threshold).toBe(2);
    expect(rolled.aid).toBe(genesis.aid);
    expect(rolled.generation).toBe(1);
    expect(rolled.roster).toEqual({ keys: second, threshold: 2, sealEpochCid: rolled.head.epochCid });
    expect(verifySealLineage(rolled.chain)).toBe(true);
    expect(genesis.chain).toHaveLength(1);                                // the receiver stands as it stood

    const again = await rolled.roll(await handsOf([7, 8]));
    const unarmedByHand = await rotateSealEpoch(rolled.head, { keys: third!, threshold: 1 }, "", await handsOf([7, 8]));
    expect(unarmedByHand.ok && unarmedByHand.epoch).toEqual(again.head);   // no `then`: the rolled head commits nothing
    expect(again.keys).toEqual(third);
    expect(again.threshold).toBe(1);
    expect(verifySealLineage(again.chain)).toBe(true);
    await expect(again.roll(await handsOf([7, 8]))).rejects.toMatchObject({ code: "rotation-unarmed" });   // no `then`: unarmed
  });

  test("the same seats may roll at another threshold, so a lineage may alternate its quorum", async () => {
    const keys = await keysOf([1, 2, 3]);
    let c = heldCharter({ keys, threshold: 2, successors: { keys, threshold: 3 } });
    c = await c.roll(await handsOf([1, 2, 3]), { keys, threshold: 2 });
    c = await c.roll(await handsOf([1, 2, 3]));
    expect(c.chain).toHaveLength(3);
    expect(c.threshold).toBe(2);
    expect(verifySealLineage(c.chain)).toBe(true);
  });

  test("hands short of the committed quorum, and hands of another set, refuse under the roll law's own code", async () => {
    const [first, second] = await Promise.all([keysOf([1, 2, 3]), keysOf([4, 5, 6])]);
    const genesis = heldCharter({ keys: first!, threshold: 2, successors: { keys: second!, threshold: 2 } });
    await expect(genesis.roll(await handsOf([4]))).rejects.toMatchObject({ code: "roll-short-of-revealed-quorum" });
    await expect(genesis.roll(await handsOf([1, 2, 3]))).rejects.toMatchObject({ code: "roll-short-of-revealed-quorum" });
    expect(verifySealLineage((await genesis.roll(await handsOf([4, 5]))).chain)).toBe(true);   // CONTROL: a quorum of them rolls
  });

  test("a variant names another charter over the same seats, and never rolls", async () => {
    const keys = await keysOf([1, 2, 3]);
    const plain = heldCharter({ keys, threshold: 2 });
    const one = heldCharter({ keys, threshold: 2, variant: 1 }), two = heldCharter({ keys, threshold: 2, variant: 2 });
    expect(new Set([plain.aid, one.aid, two.aid]).size).toBe(3);
    expect(heldCharter({ keys, threshold: 2, variant: 1 }).aid).toBe(one.aid);
    expect(one.head.keySetHash).toBe(plain.head.keySetHash);
    expect(verifySealLineage(one.chain)).toBe(true);
    await expect(one.roll(await handsOf([1, 2, 3]))).rejects.toMatchObject({ code: "rotation-unarmed" });
    expect(() => heldCharter({ keys, threshold: 2, variant: 1, successors: { keys, threshold: 2 } })).toThrow(/variant-never-rolls/);
  });

  test("a shape no quorum could meet refuses by name, at the genesis and for a named generation", async () => {
    const keys = await keysOf([1, 2]);
    expect(() => heldCharter({ keys, threshold: 3 })).toThrow(/roll-malformed/);
    expect(() => heldCharter({ keys: [], threshold: 1 })).toThrow(/roll-malformed/);
    expect(() => heldCharter({ keys: [keys[0]!, keys[0]!], threshold: 2 })).toThrow(/roll-malformed/);
    expect(() => heldCharter({ keys, threshold: 2, successors: { keys, threshold: 3 } })).toThrow(/roll-malformed/);
    const armed = heldCharter({ keys, threshold: 2, successors: { keys, threshold: 1 } });
    await expect(armed.roll(await handsOf([1, 2]), { keys, threshold: 0 })).rejects.toMatchObject({ code: "roll-malformed" });
  });
});

describe("the charter doc a fixture hands out", () => {
  test("★ a doc carries the head, the whole lineage and every seat, and roots the roster the charter names ★", async () => {
    const rolled = await (await seatedCharter({ seats: 3, threshold: 2 })).roll();
    const doc = rolled.doc();
    expect(doc.kind).toBe(NEXUS_DOC_DOMAIN);
    expect(doc.threshold).toBe(2);
    expect(doc.sealEpochCid).toBe(rolled.head.epochCid);
    expect(doc.sealLineage).toEqual(rolled.chain);
    expect(doc.kahu).toEqual(rolled.keys.map((verifyingKey, i) => ({ displayName: `Seat ${i}`, verifyingKey })));
    expect(foundingRoster(doc)).toEqual({ keys: [...rolled.keys].sort(), threshold: 2, sealEpochCid: rolled.head.epochCid });
    expect(realmIdOfCharter(doc)).toBe(rolled.aid);
  });

  test("labels name the chairs in seat order; a label past the last key names an unseated chair; dials ride beside", async () => {
    const key = await ed.getPublicKeyAsync(new Uint8Array(32).fill(9)).then(hex);
    const held = heldCharter({ keys: [key], threshold: 1 });
    const dials = { federationPosture: "open", joinPolicy: { kind: "open" }, admissionDials: { epsilon: 0.5, beta: 0.5, rho: 1, supply: 8, alpha: 0.1 } } as const;
    const doc = held.doc({ labels: ["Kahu Alpha", "Kahu Beta"], dials });
    expect(doc.kahu).toEqual([{ displayName: "Kahu Alpha", verifyingKey: key }, { displayName: "Kahu Beta", verifyingKey: null }]);
    expect(doc.joinPolicy).toEqual({ kind: "open" });
    expect(doc.federationPosture).toBe("open");
    expect(doc.admissionDials).toEqual(dials.admissionDials);
    expect(held.doc().federationPosture).toBeUndefined();
    expect(held.doc().admissionDials).toBeUndefined();
    expect(foundingRoster(doc)).toEqual(held.roster);
    expect(held.doc().joinPolicy).toBeUndefined();
  });

  test("CONTROL: a doc whose lineage loses its head roots no roster", async () => {
    const rolled = await (await seatedCharter({ seats: 2, threshold: 2 })).roll();
    expect(foundingRoster(rolled.doc()).keys).toHaveLength(2);
    expect(foundingRoster({ ...rolled.doc(), sealLineage: rolled.chain.slice(0, 1) }).keys).toEqual([]);
  });

  test("a named charter names its realm and roots no roster", () => {
    const doc = namedCharter("a-synthetic-name");
    expect(realmIdOfCharter(doc)).toBe("a-synthetic-name");
    expect(doc.sealEpochCid).toBe("a-synthetic-name");
    expect(doc.sealLineage).toHaveLength(1);
    expect(foundingRoster(doc).keys).toEqual([]);
    expect(doc.kahu).toEqual([]);
  });
});

describe("the funnel holds across the mesh tests", () => {
  const testsDir = dirname(fileURLToPath(import.meta.url));
  /** The hand-built epoch: the two constructors, and every field an epoch commits its successors under,
   *  one digest for the whole next set or one digest per seat with its threshold. */
  const HAND_BUILT = [/\bgenesisCharterEpoch\(/, /\brotateSealEpoch\(/, /\bnextKeyCommit\b/, /\bnextKeyDigests\b/, /\bnextThreshold\b/];
  /** The helper, its own test, and the roll law's own test: the only files that may build an epoch by hand. */
  const MAY_BUILD = new Set(["charter-fixture.ts", "charter-fixture.test.ts", "wax-stamp.test.ts"].map((name) => join(testsDir, name)));

  function sources(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) sources(path, out);
      else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(path);
    }
    return out;
  }

  test("★ no other mesh test builds an epoch by hand ★", () => {
    const files = sources(testsDir);
    expect(files.length).toBeGreaterThan(100);
    const strays = files
      .filter((file) => !MAY_BUILD.has(file))
      .filter((file) => { const text = readFileSync(file, "utf8"); return HAND_BUILT.some((p) => p.test(text)); })
      .map((file) => basename(file));
    expect(strays).toEqual([]);
  });

  test("KNOWN POSITIVE: the same scan sees every pattern where the roll law's own test spells it", () => {
    const law = readFileSync(join(testsDir, "wax-stamp.test.ts"), "utf8");
    for (const pattern of HAND_BUILT.slice(0, 3)) expect(pattern.test(law)).toBe(true);
    const helper = readFileSync(join(testsDir, "charter-fixture.ts"), "utf8");
    expect(HAND_BUILT[0]!.test(helper) && HAND_BUILT[1]!.test(helper)).toBe(true);
    // A neighbouring word never trips the scan: a key log's own `nextKeyCommitted` is another relation.
    expect(HAND_BUILT[2]!.test("nextKeyCommitted(inception, key)")).toBe(false);
    expect(HAND_BUILT[2]!.test("{ nextKeyCommit: \"\" }")).toBe(true);
    expect(HAND_BUILT[3]!.test("{ nextKeyDigests: [], nextThreshold: 0 }")).toBe(true);
    expect(HAND_BUILT[4]!.test("{ nextKeyDigests: [], nextThreshold: 0 }")).toBe(true);
    // The exemption reads a whole path: a namesake in another directory stays under the scan.
    expect(MAY_BUILD.has(join(testsDir, "fixtures", "wax-stamp.test.ts"))).toBe(false);
  });
});
