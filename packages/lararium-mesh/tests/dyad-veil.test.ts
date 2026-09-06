/**
 * dyad-veil — the per-handle veil derives off the DEVICE tree (Stage 0 ruling, 2026-09-05).
 *
 * The properties the ruling rests on, each pinned: stable per (seed, group) · a different face per
 * group · case-folded over hex material · sharing nothing readable with the seed's master leaf.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/persona-circle (#the-vault)
 */

import { describe, test, expect } from "vitest";
import { dyadVeilIndex, deriveDyadVeil } from "../src/dyad.js";
import { derivePersonaKeypair } from "../src/persona-hd.js";

const SEED = new Uint8Array(32).fill(7);
const GROUP_A = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const GROUP_B = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";

describe("dyadVeilIndex", () => {
  test("stable, 31-bit, case-folded over hex material", () => {
    const i = dyadVeilIndex(GROUP_A);
    expect(i).toBe(dyadVeilIndex(GROUP_A));
    expect(i).toBeLessThan(0x80000000);
    expect(dyadVeilIndex(GROUP_A.toUpperCase())).toBe(i);
  });

  test("a different group names a different leaf", () => {
    expect(dyadVeilIndex(GROUP_A)).not.toBe(dyadVeilIndex(GROUP_B));
  });
});

describe("deriveDyadVeil", () => {
  test("rejoin-stable: same (seed, group) derives the same face", async () => {
    const one = await deriveDyadVeil(SEED, GROUP_A);
    const two = await deriveDyadVeil(SEED, GROUP_A);
    expect(one.verifyingKey).toBe(two.verifyingKey);
    expect(one.verifyingKey).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a different group wears a different face — no roster carries a key that appears on another", async () => {
    const a = await deriveDyadVeil(SEED, GROUP_A);
    const b = await deriveDyadVeil(SEED, GROUP_B);
    expect(a.verifyingKey).not.toBe(b.verifyingKey);
    expect(a.signingKey).not.toBe(b.signingKey);
  });

  test("the veil shares nothing readable with the seed's own master leaf", async () => {
    const veil   = await deriveDyadVeil(SEED, GROUP_A);
    const master = await derivePersonaKeypair(SEED, []);
    expect(veil.verifyingKey).not.toBe(master.verifyingKey);
    expect(veil.signingKey).not.toBe(master.signingKey);
  });

  test("a different seed derives a different face for the same group — the veil never spans devices", async () => {
    const otherSeed = new Uint8Array(32).fill(9);
    const a = await deriveDyadVeil(SEED, GROUP_A);
    const b = await deriveDyadVeil(otherSeed, GROUP_A);
    expect(a.verifyingKey).not.toBe(b.verifyingKey);
  });
});
