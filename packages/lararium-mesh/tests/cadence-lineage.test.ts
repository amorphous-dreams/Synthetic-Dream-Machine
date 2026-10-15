/**
 * cadence-lineage — the engine cadence's own inception: one image of hearth keys, rule and next-key commitments,
 * signed by every holder and nothing else. The image's shape stands as the subject, field by field, so this file
 * sits outside the charter funnel by name.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { seatNextDigest } from "../src/cold-key-card.js";
import {
  cadenceInceptionBytes, cadenceInceptionDigest, cadenceInceptionImage, cadenceNextDigest, readCadenceHolder,
  readCadenceInceptionImage, verifyCadenceInception,
} from "../src/cadence-lineage.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(n)));
const holder = async (n: number) => ({ key: await keyOf(n), next: cadenceNextDigest(await keyOf(n + 1)) });
const signOf = async (n: number, bytes: Uint8Array) => ({ signer: await keyOf(n), sig: hex(await ed.signAsync(bytes, seedOf(n))) });

describe("the cadence inception", () => {
  test("one image, holders sorted, positional commitments, the holders' own rule; it reads back whole", async () => {
    const [a, b] = [await holder(101), await holder(111)];
    const image = cadenceInceptionImage([b, a], 2);
    expect(image.keys).toEqual([a.key, b.key].sort());
    expect(image.nextKeyDigests[image.keys.indexOf(a.key)]).toBe(a.next);
    expect(image.threshold).toBe(2);
    expect(image.nextThreshold).toBe(2);
    expect(readCadenceInceptionImage(JSON.parse(JSON.stringify(image)))).toEqual(image);
    expect(cadenceInceptionDigest(image)).toMatch(/^[0-9a-f]{64}$/);
    // CONTROL: another rule moves the digest.
    expect(cadenceInceptionDigest(cadenceInceptionImage([a, b], 1))).not.toBe(cadenceInceptionDigest(image));
  });

  test("a cadence commitment never reads as a seat's: the same key digests apart under its own domain", async () => {
    const k = await keyOf(121);
    expect(cadenceNextDigest(k)).not.toBe(seatNextDigest(k));
  });

  test("the reader refuses every other shape: a repeated key or digest, a holder committing a holder's key, a rule outside them", async () => {
    const [a, b] = [await holder(101), await holder(111)];
    const image = cadenceInceptionImage([a, b], 2);
    const bad: unknown[] = [
      { ...image, extra: 1 }, { ...image, kind: "charter-inception" }, { ...image, keys: [...image.keys].reverse() },
      { ...image, keys: [image.keys[0], image.keys[0]] }, { ...image, nextKeyDigests: [image.nextKeyDigests[0], image.nextKeyDigests[0]] },
      { ...image, threshold: 3, nextThreshold: 3 }, { ...image, nextThreshold: 1 }, { ...image, nextKeyDigests: [image.nextKeyDigests[0]] },
      { ...image, keys: image.keys.map((k) => k.toUpperCase()) }, null, [],
    ];
    for (const v of bad) expect(readCadenceInceptionImage(v), JSON.stringify(v)).toBeNull();
    // A holder whose key another holder committed as a next key: its reveal would re-seat a seated key.
    const crafted = { ...image, nextKeyDigests: [cadenceNextDigest(image.keys[1]!), image.nextKeyDigests[1]] };
    expect(readCadenceInceptionImage(crafted)).toBeNull();
    expect(() => cadenceInceptionImage([a, a], 2)).toThrow(/cadence-malformed/);
    expect(() => cadenceInceptionImage([a, { key: b.key, next: a.next }], 2)).toThrow(/cadence-malformed/);
    expect(readCadenceHolder({ key: a.key })).toBeNull();
    expect(readCadenceHolder({ ...a, extra: 1 })).toBeNull();
  });

  test("every holder signs, and nothing else: zero, one, doubled, foreign or split signatures refuse", async () => {
    const [a, b] = [await holder(101), await holder(111)];
    const image = cadenceInceptionImage([a, b], 2);
    const bytes = cadenceInceptionBytes(image);
    const [sa, sb] = [await signOf(101, bytes), await signOf(111, bytes)];
    expect(verifyCadenceInception({ image, signatures: [sa, sb] })).toBeNull();
    expect(verifyCadenceInception({ image, signatures: [] })).toBe("cadence-unsigned");
    expect(verifyCadenceInception({ image, signatures: [sa] })).toBe("cadence-short-of-holders");
    expect(verifyCadenceInception({ image, signatures: [sa, sa] })).toBe("cadence-foreign-signer");
    expect(verifyCadenceInception({ image, signatures: [sa, sb, await signOf(131, bytes)] })).toBe("cadence-foreign-signer");
    const other = cadenceInceptionImage([a, b], 1);
    expect(verifyCadenceInception({ image, signatures: [sa, await signOf(111, cadenceInceptionBytes(other))] })).toBe("cadence-signature-invalid");
    expect(verifyCadenceInception({ image, signatures: [sa, sb], extra: 1 })).toBe("cadence-malformed");
  });
});
