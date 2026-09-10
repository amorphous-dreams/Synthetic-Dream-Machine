/**
 * ahi-ka — a realm's KEPT FIRE, read observer-locally with no wall-clock and no global now.
 *
 * A SEPARATE reading from `realm-standing` (which stays verdict-free — who feeds, how deep). This one renders
 * a VERDICT that erodes with causal silence and renews with presence: ahi kā (kept) · ahi tere (guttering) ·
 * ahi mātaotao (cold) · abstain. Standing is never stored; each observer computes it on demand (inversion of
 * control) as a pure function of the realm's verified progress against an INDEPENDENT ambient yardstick.
 *
 * Silence measured against the observer's OWN advancement is co-driven with the signal and false-colds a
 * partition; silence measured against an ambient the realm cannot drive (our `carry⊥read` carriage-liveness,
 * or cross-realm rolls on a board the observer is current on) reads a partition as ABSTAIN — "I've been blind"
 * — not "the realm died". So the middle state is a RATIO — the realm still while the independent ambient moved
 * by K — never a duration on a clock; that escapes the lamplighters ban ("a logical epoch cannot accrue
 * silence"), which holds only when a realm's silence is read on its own max-register or on a wall-clock.
 *
 * THIS FORM IS MINIMAL — a ratio + an abstain floor — for the discrimination probe. The Negative-Binomial fit
 * over over-dispersed causal-step counts and the conformal reject-region (a principled abstain boundary) ride
 * a later pass; the yardstick is an INPUT here, so what "ambient" resolves to stays the caller's to supply
 * (and the watcher/sensorium work to widen from local to mesh-wide).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/field-collision
 */

/** The kept fire, the guttering fire, the cold fire — plus the honest fourth: I cannot judge. */
export type AhiKaState = "ahi-ka" | "ahi-tere" | "ahi-mataotao" | "abstain";

export interface AhiKaParams {
  /** Below this much INDEPENDENT yardstick motion, the reader cannot judge — abstain (blind / partitioned / a
   *  global lull where the reader itself is quiet). The partition guard, intrinsic to the yardstick's thinness. */
  readonly ambientFloor: number;
  /** At or above this fraction of the realm's expected pace → the fire is kept. */
  readonly warmRatio: number;
  /** Below this fraction → the fire is cold; between warm and cold → guttering (ahi tere). */
  readonly coldRatio: number;
}

/**
 * Read a realm's ahi kā for THIS observer, as-of its last sync. `realmRolls` is the realm's verified progress
 * in the window (seal-proven rolls — a forged roll cannot count); `yardstickAdvance` is the INDEPENDENT
 * reference's advance over the same window (the caller supplies the ambient — carriage-liveness or cross-realm
 * motion — NOT the observer's own churn, which co-drives the signal); `baselineRate` is the realm's own
 * historical rolls per unit of that yardstick. A thin yardstick abstains before any verdict.
 */
export function readAhiKa(opts: {
  realmRolls:       number;
  yardstickAdvance: number;
  baselineRate:     number;
  params:           AhiKaParams;
}): AhiKaState {
  const { realmRolls, yardstickAdvance, baselineRate, params } = opts;
  // Not enough independent motion to judge — the reader is blind (partition) or the world itself is quiet
  // (a lull the reader shares). Fail-closed toward alive: abstain, never cold.
  if (yardstickAdvance < params.ambientFloor) return "abstain";
  const expected = baselineRate * yardstickAdvance;
  if (expected <= 0) return "abstain";                 // no basis to expect any roll → cannot judge
  // The fraction of its expected pace the realm kept while the independent ambient moved. A RATIO, not a span.
  const paceFraction = realmRolls / expected;
  if (paceFraction >= params.warmRatio) return "ahi-ka";
  if (paceFraction >= params.coldRatio) return "ahi-tere";
  return "ahi-mataotao";
}
