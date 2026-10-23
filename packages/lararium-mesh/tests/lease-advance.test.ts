/**
 * lease-advance — signed per-writer lease slots. Reds: an unsigned slot, a stranger's signature, another resource's
 * slot, a tampered epoch and a deleted slot each raise nothing. Controls: authorized writers' advances take the max,
 * and two concurrent writers both land.
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { readLeaseAdvance, signedLeaseEpoch, signLeaseAdvance } from "../src/lease-advance.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const R = "group-1";

describe("lease-advance", () => {
  test("CONTROL: authorized advances take the max, and two concurrent writers both land", async () => {
    const a = await who(1), b = await who(2);
    const ok = (k: string) => k === a.key || k === b.key;
    const sa = await signLeaseAdvance({ resource: R, epoch: 3 }, a), sb = await signLeaseAdvance({ resource: R, epoch: 5 }, b);
    expect(signedLeaseEpoch(R, [sa, sb], ok)).toBe(5);
    expect(signedLeaseEpoch(R, [sa], ok)).toBe(3);
  });
  test("RED: an unsigned slot, a stranger, another resource and a tampered epoch raise nothing", async () => {
    const a = await who(1), m = await who(9);
    const ok = (k: string) => k === a.key;
    const good = await signLeaseAdvance({ resource: R, epoch: 2 }, a);
    const forged = JSON.parse(good) as { body: { epoch: number } }; forged.body.epoch = 99;
    const slots = ["99", await signLeaseAdvance({ resource: R, epoch: 50 }, m), await signLeaseAdvance({ resource: "other", epoch: 60 }, a), JSON.stringify(forged), null, undefined];
    expect(signedLeaseEpoch(R, slots, ok)).toBe(0);
    expect(signedLeaseEpoch(R, [...slots, good], ok)).toBe(2);
  });
  test("RED: a deleted high slot lowers nothing the reader holds (the slot set alone decides; the anchor keeps the frontier)", async () => {
    const a = await who(1);
    const hi = await signLeaseAdvance({ resource: R, epoch: 7 }, a), lo = await signLeaseAdvance({ resource: R, epoch: 1 }, a);
    expect(signedLeaseEpoch(R, [lo], () => true)).toBe(1);   // the stale replica reads low; the sealed frontier (face-anchor) holds 7
    expect(readLeaseAdvance(R, hi, () => true)).toBe(7);
  });
});
