/**
 * realm-standing — THE AHI KĀ DISCRIMINATION PROBE (the fourth option, red-first).
 *
 * A realm's standing erodes with causal silence, measured with NO wall-clock and NO global now. The research
 * gate: measuring silence against the observer's OWN advancement (co-driven with the signal) false-colds a
 * partition; measuring against an INDEPENDENT ambient yardstick abstains instead. This probe pins that
 * discrimination on a minimal estimator — the SAME function fed two yardsticks — and ships the naive yardstick
 * as the CONTROL THAT MUST LIE (it reads cold under partition, which is wrong). Until the ambient yardstick
 * abstains where the naive one colds, the fourth option is unproven and wires to nothing.
 *
 * The estimator is deliberately minimal (a ratio + an abstain floor); the Negative-Binomial fit and the
 * conformal reject-region are deferred — this probe tests the YARDSTICK CHOICE, not the distribution. The
 * yardstick is an injected input, so the collision spirit's refinement of what "ambient" is slots in here
 * without reworking the property under test.
 *
 * Regimes (all with the realm STILL — realmRolls 0 — so only the yardstick differs):
 *   · realm-death  : the mesh moved (ambient high), the realm alone stopped        → COLD (both yardsticks agree)
 *   · partition    : I churned locally (own-steps high), the world froze (ambient 0) → naive COLD (the LIE) · ambient ABSTAIN
 *   · global-lull  : everything quiet (both low)                                     → neither colds (both abstain)
 * Plus a kept-fire and a wandering-fire control — the latter shows ahi tere as a RATIO, not a duration
 * (the move that escapes the lamplighters "a logical epoch cannot accrue silence" ban).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/field-collision · lar:///ha.ka.ba/lararium/mesh/identity-classes
 */
import { describe, test, expect } from "vitest";
import { readAhiKa, type AhiKaState } from "../src/ahi-ka.js";

const PARAMS = { ambientFloor: 5, warmRatio: 0.5, coldRatio: 0.1 };
const BASELINE = 1; // the realm historically rolls ~once per yardstick step

const read = (realmRolls: number, yardstickAdvance: number): AhiKaState =>
  readAhiKa({ realmRolls, yardstickAdvance, baselineRate: BASELINE, params: PARAMS });

describe("ahi kā discrimination probe — the yardstick is the whole ballgame", () => {
  test("★ PARTITION — the naive own-steps yardstick LIES (cold); the ambient yardstick ABSTAINS ★", () => {
    // Realm still from my view; I am churning my own worldline (own-steps high); the world I can reach froze.
    const naive   = read(0, 100); // yardstick = MY OWN advance (100) — I moved a lot, the realm didn't
    const ambient = read(0, 0);   // yardstick = THIRD-PARTY ambient (0) — the mesh I can see did not move
    expect(naive, "the naive yardstick false-colds a partition — the control that must lie").toBe("ahi-mataotao");
    expect(ambient, "the ambient yardstick reads 'I've been blind', not 'the realm died'").toBe("abstain");
  });

  test("★ REALM-DEATH — both yardsticks agree COLD (the mesh moved, the realm alone stopped) ★", () => {
    expect(read(0, 100)).toBe("ahi-mataotao"); // own-steps high AND ambient high both read the realm still while the world moved
    // (in death the two yardsticks coincide — the mesh is alive, so my steps and the ambient both advanced)
  });

  test("★ GLOBAL-LULL — neither yardstick colds (everything quiet, not dead) ★", () => {
    expect(read(0, 2), "own-steps low in a lull → abstain, never cold").toBe("abstain");
    expect(read(0, 3), "ambient low in a lull → abstain, never cold").toBe("abstain");
  });

  test("★ AHI TERE is a RATIO, not a duration — a realm at 30% of its pace while the world moved 100 ★", () => {
    expect(read(80, 100), "keeping pace → kept fire").toBe("ahi-ka");
    expect(read(30, 100), "guttering — a ratio of stillness to independent motion, no clock").toBe("ahi-tere");
    expect(read(0, 100),  "fully still while the world moved → cold").toBe("ahi-mataotao");
  });
});
