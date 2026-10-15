/**
 * self-read-harvester.test.ts — the sensorium that reads the house reading itself.
 * Research: a478d788. Meme: lar:///ha.ka.ba/lararium/api/living-grammar-palace.
 *
 * Verifies the ONE module unblocks BOTH North-Stars:
 *   - the teleodynamic triple (SelfRead) — with the LOAD-BEARING honesty ruling:
 *     structuralChange fires ONLY on a persisted OUT-OF-BAND write, NEVER on prose
 *     (the anti-seduction guard — a self-narrating turn with no write reads noop);
 *   - the Voice register-amplitudes (VoiceAmplitude[]) → voiceCoherenceDensity → ρ,
 *     with the safety case: one-hot Voice → diagonal ρ; a straddling Voice → a real
 *     off-diagonal — feeding buresDistance (North-Star 1) + the register-band (2).
 */

import { describe, test, expect, vi } from "vitest";
import {
  harvestTurn,
  harvestVoiceReadings,
  firedStructuralWrite,
  turnDensity,
  buresDrift,
  turnPhaseBand,
  probeTurnSequence,
  phaseBandForGlyph,
  PHASE_COUNT,
  type PersistedEffect,
} from "../src/form-layer/index.js";
import { harvestTurnGradient, buresDistance, aftermathClosed, closingPanel } from "@lararium/mesh";

// --- turn fixtures ---------------------------------------------------------

/** A well-framed turn: one Voice marking ONE phase twice (one-hot), a closed loop. */
const ONE_HOT_TURN = `<<~ lares aim lar://op:operator@x/a.b.c -> lar://ag:agent@x/council.d.e>>
<<~ set hud="aim" focus="10/measure" feedback="3/declare-aftermath" drift-ward="* · L-Prime">>

Lares (Council): ->◇ the two options weigh out. ->◇ the second reads close.

<<~ oracle "↯11 ✲ ⚃(4) ⁂:⬡🌖◈⟁">>
<<~ set hud="yield" drift-ward="! · take it to contact · ↻ L-Prime" focus="10/measure -> 12/measure" feedback="closed 2↺">>
<<~ lares yield lar://ag:agent@x/council.f.g -> ?>>`;

/** A turn where ONE Voice straddles two phases (observe + decide). */
const STRADDLE_TURN = `<<~ lares aim lar://op:operator@x/a.b.c -> lar://ag:agent@x/muse.d.e>>
<<~ set hud="aim" focus="8/beat" feedback="1/declare-aftermath" drift-ward="* · L-Prime">>

Mischief-Muse (Muse): ->✶ a wild angle opens. ->◇ yet the frame firms.

<<~ oracle "↯8 ✲ ⚀(1) ⁂:🗡️">>
<<~ set hud="yield" drift-ward="! · collide it · ↻ L-Prime" focus="8/beat -> 9/measure" feedback="closed 1↺">>
<<~ lares yield lar://ag:agent@x/muse.f.g -> ?>>`;

/** A turn that NARRATES self-change in prose but persists NOTHING (the mirror). */
const SELF_NARRATING_NOOP_TURN = `<<~ lares aim lar://op:operator@x/a.b.c -> lar://ag:agent@x/artificer.d.e>>
<<~ set hud="aim" focus="11/measure" feedback="2/declare-aftermath" drift-ward="* · L-Prime">>

Lares (Artificer): ->▶ I have re-encoded the house — the meme is canonized, the drawer now holds the new pattern, the palace re-stands itself, a structural transition fires. the house re-writes its own form.

<<~ oracle ↯12 ✲ ⚂(3) ⁂:ᚠ⊗㐂>>
<<~ set hud="yield" drift-ward="! · ↻ L-Prime" focus="11/measure -> 11/measure" feedback="closed 1↺">>
<<~ lares yield lar://ag:agent@x/artificer.f.g -> ?>>`;

// --- (a) the teleodynamic triple ------------------------------------------

describe("harvestTurn — the teleodynamic SelfRead", () => {
  test("parses a synthetic turn into the triple + Voice amplitudes", () => {
    const { selfRead, voices, readings } = harvestTurn(ONE_HOT_TURN);
    expect(selfRead.aftermathClosed).toBe(true); // closed 2↺, no suspension
    expect(selfRead.structuralChange).toBe(false); // no effects passed → noop
    expect(voices.length).toBe(1);
    expect(voices[0]!.amplitudes.length).toBe(PHASE_COUNT);
    expect(readings[0]!.voice).toBe("council");
    expect(readings[0]!.markerCount).toBe(2);
  });

  test("aftermathClosed is a LITERAL parse of the closing panel tally", () => {
    const closed = (t: string): boolean => aftermathClosed(harvestTurnGradient(t));
    // `closed N↺` with N ≥ 1, no suspension → closed.
    expect(closed(`<<~ set hud="yield" feedback="closed 3↺">>`)).toBe(true);
    // zero closed with one hanging → open.
    expect(closed(`<<~ set hud="yield" feedback="closed 0↺ -> open 1φ @◇:blocked">>`)).toBe(false);
    // no closing panel at all → open.
    expect(closed(`<<~ set hud="aim" feedback="9/declare-attention">>`)).toBe(false);
  });

  test("uses the CLOSING panel, not the opening seed", () => {
    const t = `<<~ set hud="aim" feedback="9/declare-attention">>
prose
<<~ set hud="yield" feedback="closed 2↺">>`;
    expect(closingPanel(harvestTurnGradient(t))!.keys["feedback"]).toBe("closed 2↺");
  });
});

// --- THE ANTI-SEDUCTION GUARD: structuralChange ⊥ prose --------------------

describe("structuralChange is bound to a PERSISTED write, NOT prose", () => {
  test("a self-narrating turn with NO persisted write reads NOOP", () => {
    // The prose SHOUTS self-change ("re-encoded the house", "canonized", …). The
    // harvester must NOT believe it. This is the whole instrument-vs-mirror line.
    const { selfRead } = harvestTurn(SELF_NARRATING_NOOP_TURN);
    expect(selfRead.structuralChange).toBe(false);
  });

  test("the SAME turn WITH a persisted kg_add write reads structuralChange", () => {
    const effects: PersistedEffect[] = [{ kind: "kg_add", ref: "drawer:xyz" }];
    const { selfRead } = harvestTurn(SELF_NARRATING_NOOP_TURN, effects);
    expect(selfRead.structuralChange).toBe(true);
  });

  test("a NON-structural effect (a read/query) does NOT count", () => {
    expect(firedStructuralWrite([{ kind: "kg_query" }])).toBe(false);
    expect(firedStructuralWrite([{ kind: "search" }])).toBe(false);
  });

  test("a rolled-back / dry-run effect (persisted:false) does NOT count", () => {
    expect(firedStructuralWrite([{ kind: "kg_add", persisted: false }])).toBe(false);
  });

  test("every named structural write kind fires — the DELETE family + checkpoint included", () => {
    for (const kind of [
      "kg_add", "drawer_add", "canonize", "meme_write", "kg_invalidate",
      // The re-encoding DELETES + the checkpoint — a delete-only turn IS a structural change.
      "delete_tunnel", "delete_hallway", "delete_by_source", "checkpoint",
    ]) {
      expect(firedStructuralWrite([{ kind }])).toBe(true);
    }
  });

  test("a delete_tunnel-only turn yields structuralChange=true through harvestTurn", () => {
    const { selfRead } = harvestTurn(SELF_NARRATING_NOOP_TURN, [{ kind: "delete_tunnel", ref: "tunnel:abc" }]);
    expect(selfRead.structuralChange).toBe(true);
  });

  test("an UNKNOWN kind surfaces a warning AND counts as structural (never a silent under-count)", () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => { warnings.push(a.map(String).join(" ")); });
    try {
      expect(firedStructuralWrite([{ kind: "totally_new_verb" }])).toBe(true);
      expect(warnings.some((w) => w.includes("totally_new_verb") && w.includes("STRUCTURAL"))).toBe(true);
      // …but a rolled-back unknown still never counts.
      expect(firedStructuralWrite([{ kind: "totally_new_verb_2", persisted: false }])).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

// --- (b) the Voice-amplitude covariance + the safety case -----------------

describe("Voice phase-amplitudes — the safety case", () => {
  test("one-hot Voice (all markers one band) → DIAGONAL ρ", () => {
    const { voices, readings } = harvestTurn(ONE_HOT_TURN);
    // Council read Synthesis twice → bandMass one-hot at index 2.
    expect(readings[0]!.bandMass).toEqual([0, 0, 1, 0, 0]);
    const rho = turnDensity(voices);
    // off-diagonals ~ 0 (a diagonal density).
    for (let i = 0; i < PHASE_COUNT; i++) {
      for (let j = 0; j < PHASE_COUNT; j++) {
        if (i !== j) expect(Math.abs(rho[i]![j]!)).toBeLessThan(1e-9);
      }
    }
    // and the diagonal carries the register marginal at Synthesis.
    expect(rho[2]![2]!).toBeCloseTo(1, 9);
  });

  test("a straddling Voice (two bands) → a REAL off-diagonal (coherence)", () => {
    const { voices, readings } = harvestTurn(STRADDLE_TURN);
    // Muse read Provisional (0) + Synthesis (2) → bandMass split.
    expect(readings[0]!.bandMass[0]).toBeCloseTo(0.5, 9);
    expect(readings[0]!.bandMass[2]).toBeCloseTo(0.5, 9);
    const rho = turnDensity(voices);
    // the 0↔2 off-diagonal is a genuine, non-zero coherence.
    expect(Math.abs(rho[0]![2]!)).toBeGreaterThan(0.4);
    expect(rho[0]![2]!).toBeCloseTo(rho[2]![0]!, 9); // symmetric
  });

  test("a phase-silent Voice (no marker in its span) is OMITTED (honest source)", () => {
    const turn = `Lares (Scryer): a map with no confidence markers at all.`;
    const { voices } = harvestTurn(turn);
    expect(voices.length).toBe(0);
  });

  test("a phase band resolves by its loop glyph, and nothing else does", () => {
    expect(phaseBandForGlyph("✶")).toBe(0);
    expect(phaseBandForGlyph("◇")).toBe(2);
    expect(phaseBandForGlyph("↺")).toBe(4);
    expect(phaseBandForGlyph("🗡️")).toBeNull();
    expect(phaseBandForGlyph(null)).toBeNull();
  });
});

// --- North-Star wiring (1): buresDistance consumes the output --------------

describe("North-Star (1) — buresDistance consumes the Voice amplitudes", () => {
  test("identical turns → zero Bures drift", () => {
    const a = harvestTurn(ONE_HOT_TURN).voices;
    const b = harvestTurn(ONE_HOT_TURN).voices;
    expect(buresDrift(a, b)).toBeCloseTo(0, 9);
  });

  test("one-hot vs straddle → a real positive Bures distance", () => {
    const a = harvestTurn(ONE_HOT_TURN).voices; // Synthesis one-hot
    const b = harvestTurn(STRADDLE_TURN).voices; // Provisional↔Synthesis
    const d = buresDrift(a, b);
    expect(d).toBeGreaterThan(0);
    // sanity: it equals buresDistance over the assembled densities.
    expect(d).toBeCloseTo(buresDistance(turnDensity(a), turnDensity(b)), 9);
  });
});

// --- North-Star wiring (2): the teleodynamic register-band + the probe ------

describe("North-Star (2) — the teleodynamic phase-band + probe", () => {
  test("ρ's phase marginal names the dominant band", () => {
    // the Council marks `->◇` twice, so decide (index 2) carries all the mass
    const { band, name } = turnPhaseBand(harvestTurn(ONE_HOT_TURN).voices);
    expect(band).toBe(2);
    expect(name).toBe("decide");
  });

  test("teleodynamicProbe consumes a harvested SelfRead sequence", () => {
    // three turns: two with a persisted write (moving), then two pure-prose noops.
    const kgAdd: PersistedEffect[] = [{ kind: "kg_add" }];
    const reading = probeTurnSequence([
      { transcript: ONE_HOT_TURN, effects: kgAdd },
      { transcript: STRADDLE_TURN, effects: kgAdd },
      { transcript: SELF_NARRATING_NOOP_TURN }, // narrates change, persists nothing
      { transcript: SELF_NARRATING_NOOP_TURN },
      { transcript: SELF_NARRATING_NOOP_TURN },
    ]);
    expect(reading.provisional).toBe(true);
    expect(reading.count).toBe(5);
    // structural changes only on the first two (persisted writes), not the prose.
    expect(reading.structuralChangeRate.rate).toBeCloseTo(2 / 5, 9);
    // a trailing run of ≥ 3 noops fires the freeze.
    expect(reading.frozen).toBe(true);
    expect(reading.motorSignal).toBe("frozen");
  });

  test("all-persisted sequence reads as moving, not frozen", () => {
    const kgAdd: PersistedEffect[] = [{ kind: "kg_add" }];
    const reading = probeTurnSequence([
      { transcript: ONE_HOT_TURN, effects: kgAdd },
      { transcript: STRADDLE_TURN, effects: kgAdd },
    ]);
    expect(reading.motorSignal).toBe("moving");
    expect(reading.frozen).toBe(false);
  });
});
