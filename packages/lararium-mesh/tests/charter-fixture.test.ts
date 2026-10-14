/** The fixture funnels all test charters through positional seat commitments. */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { genesisCharterEpoch, sealKeySetHash, verifySealLineage } from "../src/wax-stamp.js";
import { seatNextDigest } from "../src/cold-key-card.js";
import { NEXUS_DOC_DOMAIN } from "../src/domains.js";
import { nexusAidOf } from "../src/nexus-seal-seed.js";
import { charterSeatSeeds, heldCharter, namedCharter, seatedCharter } from "./charter-fixture.js";

const seeds = (ns: number[]) => ns.map(n => new Uint8Array(32).fill(n));
const keys = (ns: number[]) => Promise.all(seeds(ns).map(s => ed.getPublicKeyAsync(s).then(hex)));
const hands = (ns: number[]) => Promise.all(ns.map(async n => { const seed = seeds([n])[0]!; const signer = await ed.getPublicKeyAsync(seed).then(hex); return { signer, sign: (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex) }; }));

describe("a seated fixture charter stands under the roll law", () => {
  test.each([[1, 1], [2, 2], [3, 2]] as const)("%i seats at threshold %i verify through fresh rolls", async (seats, threshold) => {
    const c = await seatedCharter({ seats, threshold }); expect(verifySealLineage(c.chain)).toBe(true);
    expect(c.head.nextKeyDigests).toHaveLength(seats);
    const first = await c.roll(); const second = await first.roll();
    expect(verifySealLineage(second.chain)).toBe(true); expect(second.aid).toBe(c.aid);
    expect(new Set([...c.keys, ...first.keys, ...second.keys]).size).toBe(seats * 3);
  });
  test("seeds, hands and generation keys agree", async () => {
    const c = await seatedCharter({ seats: 2, threshold: 2, seed: 9 });
    expect(c.seeds).toEqual(charterSeatSeeds(9, 0, 2)); expect(c.keys).toEqual(await Promise.all(c.seeds.map(s => ed.getPublicKeyAsync(s).then(hex))));
    expect((await c.signers()).map(s => s.signer)).toEqual(c.keys);
  });
  test("a caller held charter commits per seat and rejects a mismatched successor shape", async () => {
    const current = await keys([1, 2]), successor = await keys([3, 4]);
    const c = heldCharter({ keys: current, threshold: 2, successors: { keys: successor, threshold: 2 } });
    const expected = [...current].sort().map(k => seatNextDigest(successor[current.indexOf(k)]!));
    expect(c.head.nextKeyDigests).toEqual(expected); expect(c.head.nextThreshold).toBe(2);
    const rolled = await c.roll(await hands([3, 4])); expect(verifySealLineage(rolled.chain)).toBe(true);
    expect(() => heldCharter({ keys: current, threshold: 2, successors: { keys: successor.slice(0, 1), threshold: 2 } })).toThrow(/roll-malformed/);
    expect(() => heldCharter({ keys: current, threshold: 2, successors: { keys: successor, threshold: 1 } })).toThrow(/roll-malformed/);
  });
  test("named charter carries no forward commitment", () => {
    const doc = namedCharter("test-aid"); expect(doc.kind).toBe(NEXUS_DOC_DOMAIN); expect(doc.sealLineage![0]).toMatchObject({ nextKeyDigests: [], nextThreshold: 0 });
    expect(nexusAidOf(doc)).toBe("test-aid");
  });
});
