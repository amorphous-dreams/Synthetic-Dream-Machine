/**
 * cas-caps.test — GRACE per tier against the realm's own baseline, PIN at cid grain (basket-one #/grace-and-pin).
 *   · graceForTier reads RATIOS over the realm's baseline unit, never a constant; VEIL/PERSONAGROUP hold
 *     longer than CONTRACT/PUBLIC (the private tiers have one holder-set and no re-fetch road);
 *   · a torn baseline (0 / NaN / negative) reads as ONE unit, never a zero grace;
 *   · pinHolds / pinnedCids / prefetchAllows read a pin against its holder's own LIFE (M7, never a wall
 *     clock and never an order): no life recorded → presence alone holds, forever; a recorded life holds while
 *     it IS the holder's current life and nothing once another stands. `PinCap`/`PrefetchCap` carry no `expiry`.
 */
import { describe, test, expect } from "vitest";
import { graceForTier, GRACE_RATIO_BY_TIER, tiersByGraceDescending, pinHolds, pinnedCids, prefetchAllows, type PinCap, type PrefetchCap } from "../src/cas-caps.js";

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

describe("PIN at cid grain — M7: no `expiry`, an OPTIONAL causal `life` instead", () => {
  test("no `life` recorded: presence alone holds, under ANY current life", () => {
    const pin: PinCap = { cid: "a".repeat(64), tier: "veil", holder: "vessel-1" };
    expect(pinHolds(pin, pin.cid, "life-a")).toBe(true);
    expect(pinHolds(pin, pin.cid, "life-z")).toBe(true);
    expect(pinHolds(pin, "b".repeat(64), "life-a")).toBe(false);           // the wrong cid never holds
    expect(pinHolds(undefined, pin.cid, "life-a")).toBe(false);
  });

  test("a recorded life holds while it IS the holder's current life, and nothing once another stands — whatever the spelling would sort as", () => {
    const pin: PinCap = { cid: "a".repeat(64), tier: "veil", holder: "vessel-1", life: "life-m" };
    expect(pinHolds(pin, pin.cid, "life-m")).toBe(true);
    expect(pinHolds(pin, pin.cid, "life-a")).toBe(false);   // MUTATION: another life (sorting before) ends it
    expect(pinHolds(pin, pin.cid, "life-z")).toBe(false);   // and another sorting after ends it alike
  });

  test("pinnedCids folds the standing set: a pin of another life drops, a presence-only one never does", () => {
    const lived    = { cid: "a".repeat(64), tier: "veil" as const, holder: "vessel-1", life: "life-1" };
    const presence = { cid: "c".repeat(64), tier: "veil" as const, holder: "vessel-1" };
    expect([...pinnedCids([lived, presence], "life-2")].sort()).toEqual([presence.cid]);
    expect([...pinnedCids([lived, presence], "life-1")].sort()).toEqual([lived.cid, presence.cid].sort());
  });
});

describe("PREFETCH per peer — the same life law, never a wall clock", () => {
  test("absent cap, or another holder, never opens", () => {
    const cap: PrefetchCap = { tier: "contract", holder: "peer-a", life: "life-5" };
    expect(prefetchAllows(undefined, "peer-a", "life-5")).toBe(false);
    expect(prefetchAllows(cap, "peer-b", "life-5")).toBe(false);
  });
  test("no life recorded opens under every life; a recorded life closes once another stands", () => {
    const openForever: PrefetchCap = { tier: "contract", holder: "peer-a" };
    expect(prefetchAllows(openForever, "peer-a", "life-any")).toBe(true);
    const lived: PrefetchCap = { tier: "contract", holder: "peer-a", life: "life-5" };
    expect(prefetchAllows(lived, "peer-a", "life-5")).toBe(true);
    expect(prefetchAllows(lived, "peer-a", "life-6")).toBe(false);
  });
});
