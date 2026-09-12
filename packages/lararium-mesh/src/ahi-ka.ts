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
 * THE 500-YEAR TEST RUN — the initial params, calibrated against Elyncia's DreamNet as the first QA world
 * (Telarus the wild-mage lit it ~500 years before modern day, and realms have risen · slept a century ·
 * revived · lapsed across that span). Because the reading measures a realm's pace against its OWN baseline,
 * these tolerate a realm being SLOW without punishing it, and only judge silence RELATIVE to itself:
 *   · warmRatio 0.30 — a realm keeping even a third of its own cadence stays KEPT (a dormant shrine woken for
 *     a centennial rite is not a dying one; long ebbs are the fiction's normal, not a fault);
 *   · coldRatio 0.05 — a realm reads COLD only when NEARLY silent against what its own history expects, so a
 *     centuries-old realm goes cold by true abandonment, never by a quiet generation;
 *   · ambientFloor 8 — the reader needs a meaningful stretch of INDEPENDENT motion before it dares a verdict,
 *     so a freshly-synced or thinly-connected observer abstains rather than mis-cold a realm it barely saw.
 * These are a STARTING POINT for fiction-QA, not a proven law — run Elyncia's 500-year events through the
 * estimator and tune. The hysteresis gap (revival cost scaling with cold-depth) and the commons-vs-hearth
 * exemption (a private single-steward hearth never colds) join these when the full estimator lands; recorded
 * for that pass in `[[field-collision]]` #the-mesh-field.
 */
export const AHI_KA_500YR: AhiKaParams = { ambientFloor: 8, warmRatio: 0.30, coldRatio: 0.05 };

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

// ── THE REALM'S OWN PACE — the unit every grace reads in ───────────────────────────────────────────────────

/**
 * The realm's own NOW, in ROLLS of its maintenance feed — `realmPace(reading)` over the SAME reading the
 * `realm-clock` verb answers (`cabalRealmMaintenanceProvenance`: the max-register epoch this replica folds).
 *
 * WHY THE REALM'S CLOCK OUTRANKS AN OBSERVED ROLL RATE. A reader that samples the epoch twice on its own
 * wall-clock and answers `elapsed / rolls` measures the realm against ITS OWN advancement — the co-driven
 * yardstick the module header refuses. Under a partition the rolls stop arriving and the "pace" stretches
 * (harmless: a longer grace); when the partition HEALS a season of rolls lands in one second and the pace
 * reads a thousandfold faster — every grace collapses toward zero and the sweep eats bodies that stood
 * unreferenced for one honest roll. The realm's clock cannot be driven that way: its epoch advances only by
 * an offering, one per roll, however the rolls reach this replica. So the grace counts ROLLS, and the sweep's
 * cadence counts rolls, and "a day of silence" ages nothing — exactly the lamplighters ban ("a logical epoch
 * cannot accrue silence") read from the sweep's side.
 *
 * The reading: null while the realm has not said two rolls (one offering constitutes a VISIT — no beat stands
 * yet — and a hearth outside every realm passes null); a torn reading (non-finite / negative) answers ONE
 * unit, never zero, so a grace derived from it never reads zero (a zero grace sweeps a staged body before its
 * verb lands). Pure: no clock, no sample, no state — a reboot re-reads the same value off the same board.
 */
export function realmPace(reading: { readonly effectiveEpoch: number } | null | undefined): number | null {
  if (!reading) return null;
  const epoch = reading.effectiveEpoch;
  if (!Number.isFinite(epoch) || epoch < 0) return 1;
  if (epoch < 2) return null;
  return epoch;
}
