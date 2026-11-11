/**
 * cas-caps.test — GRACE per tier against the realm's own baseline, PIN at cid grain (basket-one #/grace-and-pin).
 *   · graceForTier reads RATIOS over the realm's baseline unit, never a constant; VEIL/PERSONAGROUP hold
 *     longer than CONTRACT/PUBLIC (the private tiers have one holder-set and no re-fetch road);
 *   · a torn baseline (0 / NaN / negative) reads as ONE unit, never a zero grace;
 *   · pinHolds / pinnedCids / prefetchAllows read a pin against its holder's own FENCE (M7, never a wall
 *     clock): no fence recorded → presence alone holds, forever; a recorded fence the holder's CURRENT
 *     fence has since passed → no longer holds. `PinCap`/`PrefetchCap` carry no `expiry` field at all.
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

describe("PIN at cid grain — M7: no `expiry`, an OPTIONAL causal `fence` instead", () => {
  test("no `fence` recorded: presence alone holds, under ANY reading (even one that looks like a far-future or a zero clock)", () => {
    const pin: PinCap = { cid: "a".repeat(64), tier: "veil", holder: "vessel-1" };
    expect(pinHolds(pin, pin.cid, 0)).toBe(true);
    expect(pinHolds(pin, pin.cid, Number.MAX_SAFE_INTEGER)).toBe(true);   // CONTROL: no clock-shaped reading ever ends it
    expect(pinHolds(pin, "b".repeat(64), 0)).toBe(false);                  // the wrong cid never holds
    expect(pinHolds(undefined, pin.cid, 0)).toBe(false);
  });

  test("a recorded fence holds while the holder's CURRENT fence has not yet passed it, never past", () => {
    const pin: PinCap = { cid: "a".repeat(64), tier: "veil", holder: "vessel-1", fence: 5 };
    expect(pinHolds(pin, pin.cid, 5)).toBe(true);    // at the fence — inclusive
    expect(pinHolds(pin, pin.cid, 4)).toBe(true);    // before it — holds
    expect(pinHolds(pin, pin.cid, 6)).toBe(false);   // MUTATION: the holder's own next epoch supersedes it
  });

  test("pinnedCids folds the standing set: a fenced pin past its fence drops, a presence-only one never does", () => {
    const fenced   = { cid: "a".repeat(64), tier: "veil" as const, holder: "vessel-1", fence: 1 };
    const presence = { cid: "c".repeat(64), tier: "veil" as const, holder: "vessel-1" };
    expect([...pinnedCids([fenced, presence], 4)].sort()).toEqual([presence.cid]);   // fenced (fence=1) superseded at reading 4
    expect([...pinnedCids([fenced, presence], 0)].sort()).toEqual([fenced.cid, presence.cid].sort());
  });
});

describe("PREFETCH per peer — the same fence law, never a wall clock", () => {
  test("absent cap, or another holder, never opens", () => {
    const cap: PrefetchCap = { tier: "contract", holder: "peer-a", fence: 5 };
    expect(prefetchAllows(undefined, "peer-a", 0)).toBe(false);
    expect(prefetchAllows(cap, "peer-b", 0)).toBe(false);
  });
  test("no fence recorded opens for every reading; a recorded fence closes once superseded", () => {
    const openForever: PrefetchCap = { tier: "contract", holder: "peer-a" };
    expect(prefetchAllows(openForever, "peer-a", Number.MAX_SAFE_INTEGER)).toBe(true);
    const fenced: PrefetchCap = { tier: "contract", holder: "peer-a", fence: 5 };
    expect(prefetchAllows(fenced, "peer-a", 5)).toBe(true);
    expect(prefetchAllows(fenced, "peer-a", 6)).toBe(false);
  });
});
