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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readAhiKa, AHI_KA_500YR, type AhiKaState } from "../src/ahi-ka.js";

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

describe("the 500-year test-run defaults (AHI_KA_500YR — Elyncia as the first QA world)", () => {
  const baselineRate = 1; // the realm's own history: ~one roll per ambient step
  const read500 = (realmRolls: number, yardstickAdvance: number): AhiKaState =>
    readAhiKa({ realmRolls, yardstickAdvance, baselineRate, params: AHI_KA_500YR });

  test("★ the bands are ordered and tolerant of long ebbs ★", () => {
    // A realm keeping even a THIRD of its own cadence stays kept — a dormant shrine woken for a rite is alive.
    expect(read500(40, 100), "a third of pace still reads KEPT (tolerant of ebbs)").toBe("ahi-ka");
    expect(read500(25, 100), "below a third but present → guttering").toBe("ahi-tere");
    expect(read500(10, 100), "well below → still guttering, not yet cold").toBe("ahi-tere");
    expect(read500(4, 100),  "under a twentieth of expected → cold (near-abandonment)").toBe("ahi-mataotao");
  });

  test("★ the partition floor abstains a thinly-synced observer ★", () => {
    // Below the ambient floor, the reader has seen too little independent motion to judge — patience, not cold.
    expect(read500(0, 4), "the world I saw barely moved → abstain, never cold").toBe("abstain");
    expect(read500(0, 100), "the world clearly moved while the realm stood still → cold").toBe("ahi-mataotao");
  });
});

// ── THE REALM'S OWN PACE — `realmPace(reading)` over what `realm-clock` answers ─────────────────────────────
// The sweep's grace reads in the realm's OWN unit: one roll of its feed (the max-register epoch the clock
// folds). An OBSERVED rate (elapsed wall-ms over rolls seen) is co-driven by the observer's sync — a healed
// partition delivers a season of rolls in one second and the "pace" reads a thousandfold faster, collapsing
// every grace — so the realm's clock outranks it. Abstains under two rolls (one offering is a visit, no beat);
// a torn reading answers ONE unit, never zero (a zero grace sweeps a staged body before its verb lands).
import { realmPace } from "../src/ahi-ka.js";
import { cabalRealmMaintenanceProvenance, realmFeedSlotValue } from "../src/cabal-realm-clock.js";
import { realmFeedSlotUri } from "../src/cabal-realm.js";

describe("realmPace — the realm's own clock, in rolls", () => {
  const REALM = "ab".repeat(32);
  const fed = (epochs: Record<string, number>) =>
    cabalRealmMaintenanceProvenance(REALM, new Map(Object.entries(epochs).map(([w, e]) => [realmFeedSlotUri(REALM, w), realmFeedSlotValue({ epoch: e })])));

  test("★ a fed realm's pace reads its effective epoch — the rolls its own feed stands at, never a wall-clock ★", () => {
    expect(realmPace(fed({ alpha: 7, beta: 4 }))).toBe(7);
    // The same reading whether the rolls arrived over a season or in one burst after a partition healed.
    expect(realmPace(fed({ alpha: 7, beta: 4 }))).toBe(realmPace(fed({ alpha: 7 })));
  });

  test("CONTROL: abstains under two rolls — one offering is a visit, no beat yet", () => {
    expect(realmPace(fed({}))).toBeNull();
    expect(realmPace(fed({ alpha: 1 }))).toBeNull();
    expect(realmPace(null)).toBeNull();
  });

  test("CONTROL: a torn clock answers ONE unit, never zero", () => {
    expect(realmPace({ effectiveEpoch: Number.NaN })).toBe(1);
    expect(realmPace({ effectiveEpoch: -3 })).toBe(1);
    expect(realmPace({ effectiveEpoch: Number.POSITIVE_INFINITY })).toBe(1);
  });
});

/**
 * THE CANON QUOTES THESE THREE NUMBERS, SO THE TWO MUST NOT DRIFT.
 *
 * `scale-stories-basket-one.mem` reads the fire the way this module does and quotes the parameters
 * literally — `AHI_KA_500YR = { ambientFloor: 8, warmRatio: 0.30, coldRatio: 0.05 }` — under a quote
 * licence, beside a line-cited passage from this file. A carrier that quotes a constant takes on that
 * constant's drift: tune the ratio here and the canon keeps teaching the old one, confidently, to every
 * reader who arrives through the story rather than the code.
 *
 * Verified by hand once (2026-09-13, closing a φ owed since before a context compaction) — and a hand
 * verification only holds until the next tuning pass. The module's own note says these stand as "a
 * STARTING POINT for fiction-QA, not a proven law", so a tuning WILL come; this makes it re-stamp the
 * carrier rather than orphan it.
 */
describe("the ahi kā parameters the canon quotes", () => {
  test("★ the carrier's quoted ratios match the constant it cites ★", () => {
    const carrier = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "bags", "lares", "ha.ka.ba", "lares", "docs", "pono",
           "scale-stories-basket-one.mem"), "utf8");
    // Read the numbers the carrier TEACHES, then hold them against the ones the code RUNS.
    const quoted = /AHI_KA_500YR = \{ ambientFloor: (\d+), warmRatio: ([\d.]+), coldRatio: ([\d.]+) \}/.exec(carrier);
    expect(quoted, "the carrier no longer quotes the parameters — re-aim this weld or drop it").not.toBeNull();
    if (!quoted) return;
    expect(
      { ambientFloor: Number(quoted[1]), warmRatio: Number(quoted[2]), coldRatio: Number(quoted[3]) },
      "the canon teaches ratios the code no longer runs — re-stamp scale-stories-basket-one.mem",
    ).toEqual({ ambientFloor: AHI_KA_500YR.ambientFloor, warmRatio: AHI_KA_500YR.warmRatio, coldRatio: AHI_KA_500YR.coldRatio });
  });

  test("CONTROL — the constant carries all three fields, so the comparison above is not vacuous", () => {
    expect(Object.keys(AHI_KA_500YR).sort()).toEqual(["ambientFloor", "coldRatio", "warmRatio"]);
  });
});
