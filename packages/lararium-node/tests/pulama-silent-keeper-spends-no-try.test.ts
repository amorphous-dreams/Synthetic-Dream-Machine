/**
 * pulama-silent-keeper-spends-no-try — a vessel whose keeper answers nothing, or answers dark, read no spent try.
 *
 * The vessel-side holder presents no route (the route belongs at the keeper's hand door), so a dial that finds no keeper, or a
 * keeper that refuses the hello, spends nothing of any budget. With no session standing, the holder answers the whole budget:
 * `0` there would name five spends that never ran, and `lares vault status` would print them.
 */
import { describe, expect, test } from "vitest";
import { UNLOCK_ATTEMPTS_PER_BOOT } from "../src/custody-holder.js";
import { makePulamaHolder } from "../src/pulama-holder.js";
import { PulamaRefused } from "../src/pulama-wire.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";

describe("RED a silent or dark keeper spends no try", () => {
  test("five dials at a keeper that answers no socket leave the whole budget, and the waits reading names the silence", async () => {
    const seat = await seatScratchCustody("silent-keeper");
    try {
      let dials = 0;
      const holder = makePulamaHolder({ homes: seat.homes, offer: () => ({}), dial: async () => { dials++; throw new PulamaRefused("pulama-unreachable", "no pūlama answers"); } });
      expect(holder.attemptsLeft()).toBe(UNLOCK_ATTEMPTS_PER_BOOT);
      for (let i = 0; i < UNLOCK_ATTEMPTS_PER_BOOT; i++) await expect(holder.unlock([{ kind: "passphrase", passphrase: "a route this side never sends" }])).rejects.toMatchObject({ reading: "pulama-unreachable" });
      expect(dials).toBe(UNLOCK_ATTEMPTS_PER_BOOT);
      expect(holder.isUnlocked()).toBe(false);
      expect(holder.waits()).toBe("pulama-unreachable");
      expect(holder.attemptsLeft()).toBe(UNLOCK_ATTEMPTS_PER_BOOT);
    } finally { await seat.drop(); }
  });
});
