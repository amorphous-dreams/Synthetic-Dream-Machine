/**
 * vessel-kel.test — the vessel's inception commits its next floor key's digest, signed under `vessel-kel`, and holds
 * no clock and no version: the same seeds mint the same bytes.
 */
import { describe, test, expect } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  inceptVesselKel, mintVesselKelInception, verifyVesselKelInception, nextKeyCommitted, decodeVesselKelInception,
} from "../src/vessel-kel.js";

const seed = (b: number): Uint8Array => new Uint8Array(32).fill(b);

describe("the inception", () => {
  test("RED: two foundings from one fixed seed pair mint byte-identical inceptions (no clock enters)", () => {
    const a = inceptVesselKel(seed(1), seed(2));
    const b = inceptVesselKel(seed(1), seed(2));
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });

  test("RED: the inception holds no ISO date, no version field and no `/v` tail — only t, k, nt, n and sig", () => {
    const { bytes, inception } = inceptVesselKel(seed(1), seed(2));
    const text = new TextDecoder().decode(bytes);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(text).not.toMatch(/\/v\d/);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["k", "n", "nt", "sig", "t"]);
    expect(inception.t).toBe("icp");
    expect(inception.k).toEqual([Buffer.from(ed25519.getPublicKey(seed(1))).toString("hex")]);
  });

  test("CONTROL: the next-digest commitment verifies against the next key, and no other key", () => {
    const { inception } = inceptVesselKel(seed(1), seed(2));
    expect(nextKeyCommitted(inception, ed25519.getPublicKey(seed(2)))).toBe(true);
    expect(nextKeyCommitted(inception, ed25519.getPublicKey(seed(3)))).toBe(false);
    expect(nextKeyCommitted(inception, ed25519.getPublicKey(seed(1)))).toBe(false);
  });

  test("the current key's signature verifies; a moved commitment or a re-signed foreign key does not", () => {
    const { inception } = inceptVesselKel(seed(1), seed(2));
    expect(verifyVesselKelInception(inception)).toBe(true);
    const other = inceptVesselKel(seed(1), seed(3)).inception;
    expect(verifyVesselKelInception({ ...inception, n: other.n })).toBe(false);
    const foreign = inceptVesselKel(seed(4), seed(2)).inception;
    expect(verifyVesselKelInception({ ...inception, k: foreign.k })).toBe(false);
  });

  test("decode reads what incept wrote, and a torn or reshaped record reads null", () => {
    const { bytes, inception } = inceptVesselKel(seed(1), seed(2));
    expect(decodeVesselKelInception(bytes)).toEqual(inception);
    expect(decodeVesselKelInception(bytes.subarray(0, bytes.length - 3))).toBeNull();
    const extra = new TextEncoder().encode(JSON.stringify({ ...inception, createdAt: "2026-01-01T00:00:00Z" }));
    expect(decodeVesselKelInception(extra)).toBeNull();
  });

  test("the minting path draws a fresh next seed whose key the inception commits", () => {
    const { inception, nextSeed } = mintVesselKelInception(seed(1));
    expect(nextSeed.length).toBe(32);
    expect(nextKeyCommitted(inception, ed25519.getPublicKey(nextSeed))).toBe(true);
    expect(verifyVesselKelInception(inception)).toBe(true);
  });

  test("the seeds must ride 32 bytes, and the next seed must differ from the current", () => {
    expect(() => inceptVesselKel(new Uint8Array(31), seed(2))).toThrow(/32 bytes/);
    expect(() => inceptVesselKel(seed(1), seed(1))).toThrow(/differ/);
  });
});
