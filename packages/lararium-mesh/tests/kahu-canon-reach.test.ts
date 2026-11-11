/**
 * kahu-canon-reach.test.ts — the one predicate every write door calls before it lands a byte in system canon.
 *
 * Pinned:
 *   · a Kahu hand (a counted 1-of-1 admission AND a sentinel membership) reaches `lares` and `lararium`,
 *   · each stranger refuses by the reason `kahuCabalCanonAccess` names: a sentinel member nobody admitted, an
 *     admitted group outside the sentinel, a removed group, a vessel that stands in no cabal,
 *   · FAIL CLOSED: a door handed no source refuses a system bag,
 *   · CONTROL: a bag outside system canon never asks the source (a user bag passes with no source at all),
 *   · the group accessor reads `0x` + 64 hex and the bare 64 hex alike, and refuses anything else.
 */
import { describe, test, expect } from "vitest";
import { BAG_IDS, bagUri } from "../src/lar-uris.js";
import { isVerbRefusal } from "../src/verb-refusal.js";
import { houseCanonBags, houseCanonSlugs, isHouseCanonBag, kahuReachAccess, kahuRealmGroup, requireKahuReach, seatHouseCanon } from "../src/kahu-canon-reach.js";
import { kahuHand, strangerHand, REACH_GROUP } from "./kahu-reach-fixture.js";

const refusalOf = async (run: () => Promise<void>) => { try { await run(); return null; } catch (e) { return e; } };

describe("the Kahu predicate at a write door", () => {
  test("a Kahu hand reaches both system bags", async () => {
    const hand = await kahuHand();
    for (const bag of [BAG_IDS.lares, BAG_IDS.lararium]) await expect(requireKahuReach(bag, hand, "MOVE")).resolves.toBeUndefined();
    expect(await kahuReachAccess(hand)).toMatchObject({ held: true, reason: "admitted-and-joined" });
  });

  test.each([
    ["joined-without-admission"], ["admitted-not-joined"], ["removed"], ["no-cabal"],
  ] as const)("a stranger (%s) refuses with the reason kahu-reach", async (kind) => {
    const hand = await strangerHand(kind);
    const err = await refusalOf(() => requireKahuReach(BAG_IDS.lares, hand, "COPY"));
    expect(isVerbRefusal(err) && err.reason).toBe("kahu-reach");
  });

  test("FAIL CLOSED: no source at all refuses a system bag", async () => {
    const err = await refusalOf(() => requireKahuReach(BAG_IDS.lararium, undefined, "ADD"));
    expect(isVerbRefusal(err) && err.reason).toBe("kahu-reach");
    expect(String((err as Error).message)).toContain("copy OUT of canon stays open");
  });

  test("CONTROL: a bag outside system canon asks no source", async () => {
    await expect(requireKahuReach(bagUri("garden"), undefined, "ADD")).resolves.toBeUndefined();
    expect(isHouseCanonBag(bagUri("lararium-notes"))).toBe(false);
    expect(isHouseCanonBag("lares")).toBe(true);
  });
});

describe("the house canon: ONE set, derived off the disk-sourced holdings", () => {
  test("HC1 — the derivation: system canon always, every sourced slug but the public board", () => {
    expect(houseCanonSlugs()).toEqual(["lararium", "lares"]);
    expect(houseCanonSlugs(["crossroads", "elyncia", "elyncia-referee", "lararium", "lares", "sdm"])).toEqual(["elyncia", "elyncia-referee", "lararium", "lares", "sdm"]);
    expect(houseCanonBags(["sdm", "crossroads"])).toEqual([bagUri("lararium"), bagUri("lares"), bagUri("sdm")]);
  });

  test("HC2 — a non-steward write to sdm refuses kahu-reach once the checkout seats it; CONTROL: unseated, sdm stands outside canon", async () => {
    expect(isHouseCanonBag(bagUri("sdm"))).toBe(false);
    await expect(requireKahuReach(bagUri("sdm"), undefined, "INGEST")).resolves.toBeUndefined();
    seatHouseCanon(["crossroads", "elyncia", "sdm"]);
    try {
      for (const kind of ["joined-without-admission", "admitted-not-joined", "removed", "no-cabal"] as const) {
        const hand = await strangerHand(kind);
        const err = await refusalOf(() => requireKahuReach(bagUri("sdm"), hand, "INGEST"));
        expect(isVerbRefusal(err) && err.reason).toBe("kahu-reach");
      }
      expect(isHouseCanonBag(bagUri("crossroads"))).toBe(false);
      await expect(requireKahuReach(bagUri("crossroads"), undefined, "INGEST")).resolves.toBeUndefined();
    } finally { seatHouseCanon([]); }
    expect(isHouseCanonBag(bagUri("sdm"))).toBe(false);
  });
});

describe("the group accessor", () => {
  test("reads the 0x form and the bare form alike, refuses a non-group", () => {
    expect(kahuRealmGroup(`0x${REACH_GROUP}`)).toBe(REACH_GROUP);
    expect(kahuRealmGroup(REACH_GROUP.toUpperCase())).toBe(REACH_GROUP);
    expect(() => kahuRealmGroup("0xabc")).toThrow(/reads as no PersonaGroup id/);
  });
});
