/**
 * roster-standing — what a seated quorum SURVIVES, said before it has to.
 *
 * ── A VALID QUORUM CAN STILL BE A TRAP ──────────────────────────────────────────────────────────
 * The threshold derives majority over what stood, so two chairs derive a threshold of two — every
 * kahu must sign, every time. That roster is perfectly valid and passes every gate, and the day one
 * seat is lost the Nexus can never reach quorum again. Nothing can be signed, including the rotation
 * that would repair it.
 *
 * The number that matters is not the threshold but what remains beneath it: `seated - threshold` is
 * how many chairs may go dark before the quorum locks. Three chairs over a threshold of two survive
 * one loss; two chairs over two survive none.
 *
 * ── WHY IT SPEAKS AT SEATING RATHER THAN AT FAILURE ─────────────────────────────────────────────
 * A locked roster announces itself when an operator needs to sign something and cannot, which is the
 * worst moment to learn it and the one moment nothing can be done. The reading costs nothing and the
 * cure — one more seat — is only available beforehand.
 *
 * It NAMES rather than refuses: a two-chair civic nexus may be exactly what an operator intends for a
 * house of two, and a reading that blocked it would be wrong about somebody's life.
 */
import { describe, it, expect } from "vitest";
import { rosterStanding } from "../src/roster-standing.js";

describe("roster-standing — what the quorum survives", () => {





  it("★ every reading says what it costs, never only what it is ★", () => {
    for (const args of [{ seated: 2, threshold: 2 }, { seated: 3, threshold: 2 }, { seated: 1, threshold: 1 }]) {
      expect(rosterStanding(args).reading.length).toBeGreaterThan(30);
    }
  });
});

