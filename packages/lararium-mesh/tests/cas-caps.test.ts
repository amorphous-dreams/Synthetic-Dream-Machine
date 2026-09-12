/**
 * cas-caps.test — GRACE per tier against the realm's own baseline, PIN at cid grain (basket-one #/grace-and-pin).
 *   · graceForTier reads RATIOS over the realm's baseline unit, never a constant; VEIL/PERSONAGROUP hold
 *     longer than CONTRACT/PUBLIC (the private tiers have one holder-set and no re-fetch road);
 *   · a torn baseline (0 / NaN / negative) reads as ONE unit, never a zero grace;
 *   · pinHolds / pinnedCids read a pin against `now`, expiry inclusive.
 */
import { describe, test, expect } from "vitest";
import { graceForTier, GRACE_RATIO_BY_TIER, tiersByGraceDescending, pinHolds, pinnedCids, type PinCap } from "../src/cas-caps.js";

describe("graceForTier — per tier, over the realm's baseline", () => {
  test("the four tiers differ, and the private tiers hold longest", () => {
    const base = 1_000;
    const g = { veil: graceForTier("veil", base), personagroup: graceForTier("personagroup", base), contract: graceForTier("contract", base), public: graceForTier("public", base) };
    expect(g.veil).toBeGreaterThan(g.personagroup);
    expect(g.personagroup).toBeGreaterThan(g.contract);
    expect(g.contract).toBeGreaterThan(g.public);
    expect(tiersByGraceDescending()).toEqual(["veil", "personagroup", "contract", "public"]);
  });
  test("the grace SCALES with the baseline — a slow realm sweeps slower (ratios, never a constant)", () => {
    expect(graceForTier("contract", 2_000)).toBe(2 * graceForTier("contract", 1_000));
    expect(graceForTier("public", 500)).toBe(GRACE_RATIO_BY_TIER.public * 500);
  });
  test("CONTROL: a torn baseline reads as one unit, never a zero grace", () => {
    expect(graceForTier("veil", 0)).toBe(GRACE_RATIO_BY_TIER.veil);
    expect(graceForTier("veil", Number.NaN)).toBe(GRACE_RATIO_BY_TIER.veil);
    expect(graceForTier("veil", -5)).toBe(GRACE_RATIO_BY_TIER.veil);
  });
});

describe("PIN at cid grain", () => {
  const pin: PinCap = { cid: "a".repeat(64), tier: "veil", holder: "vessel-1", expiry: 5_000 };
  test("a pin holds its cid before expiry, and no other cid", () => {
    expect(pinHolds(pin, pin.cid, 4_999)).toBe(true);
    expect(pinHolds(pin, "b".repeat(64), 4_999)).toBe(false);
    expect(pinHolds(undefined, pin.cid, 0)).toBe(false);
  });
  test("an expired pin holds nothing (expiry inclusive); pinnedCids folds the standing set", () => {
    expect(pinHolds(pin, pin.cid, 5_000)).toBe(false);
    expect([...pinnedCids([pin, { ...pin, cid: "c".repeat(64), expiry: 1 }], 4_000)]).toEqual([pin.cid]);
  });
});
