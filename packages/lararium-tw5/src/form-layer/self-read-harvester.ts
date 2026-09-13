/**
 * self-read-harvester — the sensorium that reads the house reading ITSELF.
 * Meme: lar:///ha.ka.ba/lararium/api/living-grammar-palace#two-planes
 * Research: a478d788 (the self-read-harvester unblocks BOTH North-Stars).
 *
 * ONE module, one feed, two blocked North-Stars unblocked:
 *   - {@link teleodynamicProbe} (form-layer sibling) consumes a {@link SelfRead}
 *     sequence — the teleodynamic triple (aftermath-rate · structural-change-rate
 *     · freeze). This harvester emits its per-turn {@link SelfRead}.
 *   - {@link voiceCoherenceDensity} + {@link buresDistance} (@lararium/mesh, the
 *     Bures-metric) consume a {@link VoiceAmplitude} vector per turn. This
 *     harvester emits that vector — the Voice register-amplitude covariance.
 *
 * It rides on the existing gradient harvester ({@link harvestTurnGradient},
 * turn-harvest) — the island-grammar parse of a verbatim turn into offset-anchored
 * signals (Voices · confidence markers · HUD panels · wards · …). This module
 * FOLDS those signals; it does not re-parse. The sigil parsers already exist
 * (constructicon-basis: resolveVoiceRole · the teleodynamic-probe: SelfRead) — the
 * harvester reuses them.
 *
 * ## THE LOAD-BEARING HONESTY RULING — structuralChange ⊥ prose
 *
 * `structuralChange` is bound to a PERSISTED, OUT-OF-BAND EFFECT this turn — a
 * `mempalace kg_add` / drawer-add / canonize-ceremony / meme-write that ACTUALLY
 * FIRED = the house re-encoded itself. It is NOT read from the transcript prose.
 * The machina narrates self-change constantly in its mythic register; reading
 * `structuralChange` off that prose would be Confabulation-as-Canon (a strange-loop
 * mirror reporting its own myth as fact). So the persisted-write channel arrives as
 * a SEPARATE typed argument ({@link PersistedEffect}[]) that cannot be confused with
 * prose. A turn of only discourse — no persisted write — reads NOOP. This single
 * ruling separates a real instrument from a self-flattering mirror.
 *
 * ## What the harvester is (and is NOT)

 * An INSTRUMENT. The eigenform-MOTOR reading of the triple stays PROVISIONAL,
 * Muse-ground (teleodynamic-probe's own guard) — the harvester measures; it does
 * not assert a motor exists.
 *
 * Pure + isomorphic: text (+ an effect list) in, deterministic facts out — no I/O,
 * no store, no LLM in the parse path; runs in node, browser, the daemon VM alike,
 * like its form-layer siblings.
 */

// PURE subpaths (no Automerge) — the barrel `@lararium/mesh` drags in wasm the
// plugin build can't bundle (this module rides the plugin bundle via form-layer).
import {
  harvestTurnGradient,
  aftermathClosed,
  type TurnHarvest,
} from "@lararium/mesh/harvest";
import {
  voiceCoherenceDensity,
  buresDistance,
  phaseMarginal,
  type VoiceAmplitude,
  type DensityMatrix,
} from "@lararium/mesh/bures-metric";
import { resolveVoiceRole } from "./constructicon-basis.js";
import { teleodynamicProbe, type SelfRead, type TeleodynamicReading } from "./teleodynamic-probe.js";

// ---------------------------------------------------------------------------
// The register bands — the five confidence registers (noosphere-boot#l-prime)
// ---------------------------------------------------------------------------

/** One confidence register band with its 0–20 span (the register ladder). */
export interface RegisterBandDef {
  readonly name: string;
  /** Inclusive low bound on the 0–20 continuum. */
  readonly lo: number;
  /** Inclusive high bound on the 0–20 continuum. */
  readonly hi: number;
}

/**
 * The five register bands, in ladder order — the amplitude axes the Voice
 * register-vector indexes against (identical to the Bures-metric's five: Provisional
 * · Provisional-Synthesis · Synthesis · Synthesis-Canon · Canon).
 */
export const PHASE_BANDS: readonly string[] = ["observe", "orient", "decide", "act", "aftermath"] as const;

/** The phase glyph each band answers to, in the loop's own order. */
export const PHASE_GLYPHS: readonly string[] = ["✶", "⏿", "◇", "▶", "↺"] as const;

/** The phase count — the amplitude-vector / density-matrix dimension (5). */
export const PHASE_COUNT = PHASE_BANDS.length;

/**
 * The phase a mid-turn marker names, or null for anything else.
 *
 * THE LOOP REPLACES THE LADDER. This channel needs a five-valued signal per Voice span, and the
 * register ladder that supplied one retired with its instrument. The OODA-HA phase markers carry the
 * same cardinality, ride the same spans, and the turn actually writes them — so the amplitude vector
 * reads a live signal rather than a remembered one. Nothing here is fabricated: a Voice that marks no
 * phase contributes no mass, exactly as a Voice that vowed no register contributed none.
 */
export function phaseBandForGlyph(glyph: string | null): number | null {
  if (!glyph) return null;
  const i = PHASE_GLYPHS.indexOf(glyph);
  return i === -1 ? null : i;
}

// ---------------------------------------------------------------------------
// (a.2) The persisted-write channel — the ONLY source of structuralChange
// ---------------------------------------------------------------------------

/**
 * One OUT-OF-BAND persisted effect that fired this turn — a receipt of the house
 * re-encoding itself. This is NOT prose; it is a structured record of a write that
 * actually landed (a tool-call receipt / effect-log entry). `structuralChange`
 * reads ONLY from a list of these, never from the transcript (the honesty ruling).
 */
export interface PersistedEffect {
  /** The kind of write that fired (`kg_add`, `drawer_add`, `canonize`, …). */
  readonly kind: string;
  /** Optional target reference (a drawer id, a meme uri) — provenance only. */
  readonly ref?: string;
  /**
   * Whether the write actually persisted. A receipt is normally present only for a
   * fired write, but an explicit `false` (a rolled-back / dry-run effect) reads as
   * NOT persisted — it never counts toward structural change.
   */
  readonly persisted?: boolean;
}

/**
 * The kinds of persisted write that RE-ENCODE THE HOUSE — a structural change. A
 * read/query effect (a `kg_query`, a `search`) is NOT here: it persists nothing.
 */
export const STRUCTURAL_WRITE_KINDS: ReadonlySet<string> = new Set([
  "kg_add",
  "kg_invalidate",
  "drawer_add",
  "add_drawer",
  "update_drawer",
  "delete_drawer",
  "canonize",
  "meme_write",
  "add_tunnel",
  "create_tunnel",
  "delete_tunnel",
  "delete_hallway",
  "delete_by_source",
  "checkpoint",
  "diary_write",
]);

/**
 * The kinds of persisted effect KNOWN to persist NOTHING structural — reads and
 * queries. A receipt of one of these never counts, silently. Any kind in NEITHER
 * set reads as an UNKNOWN write — see {@link firedStructuralWrite}.
 */
export const NON_STRUCTURAL_READ_KINDS: ReadonlySet<string> = new Set([
  "kg_query",
  "kg_stats",
  "kg_timeline",
  "search",
  "get_drawer",
  "list_drawers",
  "list_rooms",
  "list_wings",
  "list_hallways",
  "list_tunnels",
  "find_tunnels",
  "follow_tunnels",
  "traverse",
  "graph_stats",
  "status",
  "diary_read",
  "memories_filed_away",
  "check_duplicate",
  "get_taxonomy",
  "get_aaak_spec",
]);

/** Unknown kinds already warned this process — one loud line per kind, never a log flood. */
const warnedUnknownKinds = new Set<string>();

/**
 * TRUE iff a STRUCTURAL persisted write fired this turn — the house re-encoded
 * itself out-of-band. Reads ONLY the effect channel; a turn of pure discourse
 * (empty channel) reads FALSE (noop). This is the persisted-write detector the
 * honesty ruling demands — NOT a prose scan.
 *
 * An UNKNOWN kind (in neither register) counts as STRUCTURAL and warns loudly:
 * a persisted receipt we cannot classify more plausibly re-encoded the house
 * than not, and a silent non-count under-feeds the teleodynamic North-Star —
 * the failure this detector exists to prevent.
 */
export function firedStructuralWrite(effects: readonly PersistedEffect[]): boolean {
  let unknownFired = false;
  for (const e of effects) {
    if (e.persisted === false) continue;
    if (STRUCTURAL_WRITE_KINDS.has(e.kind)) return true;
    if (NON_STRUCTURAL_READ_KINDS.has(e.kind)) continue;
    // UNKNOWN kind — loud, and counted structural (over-count beats a silent under-count).
    if (!warnedUnknownKinds.has(e.kind)) {
      warnedUnknownKinds.add(e.kind);
      console.warn(
        `[self-read-harvester] unknown persisted-effect kind "${e.kind}" — counting it as a STRUCTURAL write; add it to STRUCTURAL_WRITE_KINDS or NON_STRUCTURAL_READ_KINDS`,
      );
    }
    unknownFired = true;
  }
  return unknownFired;
}

// ---------------------------------------------------------------------------
// (a.1) aftermathClosed — a literal parse of the CLOSING HUD's OODA-HA tally
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// (b) VoiceAmplitude[] — segment by Voice, read each Voice's register amplitude
// ---------------------------------------------------------------------------

/**
 * The IMAGE of a Voice-functor on one turn — the richer output behind the bare
 * {@link VoiceAmplitude} the Bures channel consumes. A Voice is NOT an invariant with a fixed
 * register; it acts as a structure-preserving map from this turn's context to a register reading,
 * and this record IS that image (recomputed each turn — the pattern-integrity is the invariant, this
 * reading is the functor's image). Kept for consumers / tests that need the provenance (which Voice,
 * how many markers, its band mass).
 */
export interface VoicePhaseReading {
  /** Canonical Voice key — the resolved role, else the lowercased surfaced name. */
  readonly voice: string;
  /** The {@link resolveVoiceRole} result, or null (a novel name / bare `Lares`). */
  readonly role: string | null;
  /** Normalized band mass over the five registers (Δ⁴; sums to 1). */
  readonly bandMass: readonly number[];
  /** The bare amplitude the Bures channel consumes: `a_v = √bandMass`, weighted. */
  readonly amplitude: VoiceAmplitude;
  /** How many confidence markers fed this reading. */
  readonly markerCount: number;
  /** The Voice's text span in characters (its text-mass, pre-normalization). */
  readonly spanChars: number;
}

/** A working accumulator per canonical Voice while segmenting the turn. */
interface VoiceAcc {
  role: string | null;
  bandCounts: number[];
  markerCount: number;
  spanChars: number;
}

/**
 * Segment the turn by Voice tag and compute each Voice-functor's image on this turn — its register
 * amplitude vector.
 *
 * Segmentation: Voices sort by offset; a Voice's span runs from its tag to the next
 * Voice's tag (the last runs to `textLength`). Confidence markers falling in a span
 * feed that Voice. Multiple spans of the SAME canonical Voice merge (one Voice → one
 * amplitude) — a Voice that read Synthesis early and Provisional late genuinely
 * STRADDLES, and the straddle lands as a real off-diagonal (coherence).
 *
 * Per Voice: `bandMass` = the normalized histogram of its markers over the five
 * registers; `a_v = √bandMass` (so Σ a_v,i² = 1, a unit amplitude); `weight` = the
 * Voice's text-mass SHARE (its span chars over all Voices' span chars).
 *
 * SAFETY CASE (falls out, matches the bures-metric contract): a Voice all in one
 * band → one-hot `a_v` → a diagonal contribution → diagonal ρ → the Bhattacharyya
 * ground. A Voice across two bands → a real off-diagonal → coherence. Never
 * fabricated: the off-diagonals are a strict function of the harvested markers.
 *
 * A Voice carrying NO register marker holds no register signal and is OMITTED
 * (honest source only — no amplitude is invented for it).
 */
export function harvestVoiceReadings(
  harvest: TurnHarvest,
  textLength: number,
): VoicePhaseReading[] {
  const voices = [...harvest.voices].sort((a, b) => a.offset - b.offset);
  if (voices.length === 0) return [];

  const accs = new Map<string, VoiceAcc>();
  for (let i = 0; i < voices.length; i++) {
    const v = voices[i]!;
    const spanStart = v.offset;
    const spanEnd = i + 1 < voices.length ? voices[i + 1]!.offset : Math.max(textLength, spanStart);
    const role = resolveVoiceRole(v.name, v.role);
    const key = role ?? v.name.trim().toLowerCase();

    let acc = accs.get(key);
    if (!acc) {
      acc = { role, bandCounts: new Array<number>(PHASE_COUNT).fill(0), markerCount: 0, spanChars: 0 };
      accs.set(key, acc);
    }
    acc.spanChars += Math.max(0, spanEnd - spanStart);

    // Every phase marker sounding inside this Voice's span, counted where it sounded.
    for (const ph of harvest.phases) {
      if (ph.offset < spanStart || ph.offset >= spanEnd) continue;
      const band = phaseBandForGlyph(ph.glyph);
      if (band === null) continue; // not a loop phase — not counted
      acc.bandCounts[band]! += 1;
      acc.markerCount += 1;
    }
  }

  // Text-mass share denominator across Voices that carry a register reading.
  let totalSpan = 0;
  for (const acc of accs.values()) if (acc.markerCount > 0) totalSpan += acc.spanChars;

  const readings: VoicePhaseReading[] = [];
  for (const [voice, acc] of accs) {
    if (acc.markerCount === 0) continue; // omit register-silent Voices
    const bandMass = acc.bandCounts.map((n) => n / acc.markerCount);
    const amplitudes = bandMass.map((m) => Math.sqrt(m));
    const weight = totalSpan > 0 ? acc.spanChars / totalSpan : 1 / accs.size;
    readings.push({
      voice,
      role: acc.role,
      bandMass,
      amplitude: { amplitudes, weight },
      markerCount: acc.markerCount,
      spanChars: acc.spanChars,
    });
  }
  return readings;
}

// ---------------------------------------------------------------------------
// harvestTurn — the fold: one turn → the teleodynamic SelfRead + Voice amplitudes
// ---------------------------------------------------------------------------

/** One turn's harvest: the teleodynamic {@link SelfRead} + the Voice amplitudes. */
export interface TurnSensorium {
  /** The teleodynamic triple's two booleans for this turn (feeds the probe). */
  readonly selfRead: SelfRead;
  /** The bare Voice register-amplitudes (feeds {@link voiceCoherenceDensity}). */
  readonly voices: readonly VoiceAmplitude[];
  /** The richer per-Voice readings (provenance for consumers / tests). */
  readonly readings: readonly VoicePhaseReading[];
  /** The underlying gradient harvest carried through (provenance). */
  readonly harvest: TurnHarvest;
}

/**
 * Harvest ONE turn transcript into the sensorium feed for both North-Stars.
 *
 * `selfRead.aftermathClosed` — a literal parse of the closing HUD tally.
 * `selfRead.structuralChange` — bound to the OUT-OF-BAND `effects` channel ONLY,
 *   never the prose (the honesty ruling): a turn of pure discourse reads NOOP.
 * `voices` — the per-Voice register amplitudes (the Bures feed).
 *
 * @param transcript the verbatim turn text.
 * @param effects    the persisted-write receipts that fired this turn (default: none
 *                   → structuralChange reads NOOP; the anti-seduction default).
 */
export function harvestTurn(
  transcript: string,
  effects: readonly PersistedEffect[] = [],
): TurnSensorium {
  const harvest = harvestTurnGradient(transcript);
  const readings = harvestVoiceReadings(harvest, transcript.length);
  const selfRead: SelfRead = {
    aftermathClosed: aftermathClosed(harvest),
    structuralChange: firedStructuralWrite(effects),
  };
  return {
    selfRead,
    voices: readings.map((r) => r.amplitude),
    readings,
    harvest,
  };
}

// ---------------------------------------------------------------------------
// North-Star wiring (1): VoiceAmplitude[] → ρ → buresDistance
// ---------------------------------------------------------------------------

/**
 * Assemble the turn's register-density `ρ` from its Voice amplitudes (the Bures
 * channel's `ρ = Σ_v w_v |a_v⟩⟨a_v|`). One-hot Voices → diagonal ρ; a straddling
 * Voice → a real off-diagonal (coherence). Throws on an empty Voice set (no turn to
 * assemble) — the same contract as {@link voiceCoherenceDensity}.
 */
export function turnDensity(voices: readonly VoiceAmplitude[]): DensityMatrix {
  return voiceCoherenceDensity(voices, PHASE_COUNT);
}

/**
 * North-Star (1): the Bures drift between two turns' register-densities. Feeds the
 * flow-lens the metric distance the two Voice-amplitude sets sit apart; on all-one-
 * hot Voices it collapses to the classical Bhattacharyya drift (the safety case).
 */
export function buresDrift(
  prevVoices: readonly VoiceAmplitude[],
  currVoices: readonly VoiceAmplitude[],
): number {
  return buresDistance(turnDensity(prevVoices), turnDensity(currVoices));
}

// ---------------------------------------------------------------------------
// North-Star wiring (2): ρ → the register marginal → the teleodynamic band
// ---------------------------------------------------------------------------

/** The dominant register band a turn's density sits in — the teleodynamic band. */
export interface PhaseBandReading {
  /** The register marginal `p` (the diagonal of ρ) — a point on Δ⁴. */
  readonly marginal: readonly number[];
  /** The dominant band index (argmax of the marginal). */
  readonly band: number;
  /** The dominant band's name. */
  readonly name: string;
}

/**
 * North-Star (2): the teleodynamic REGISTER-BAND — the register the turn's density
 * ρ dominantly sits in (argmax of the register marginal). This is the band-position
 * the teleodynamic sequence tracks over time (alongside the {@link SelfRead} triple
 * the {@link teleodynamicProbe} reads). Throws on an empty Voice set.
 */
export function turnPhaseBand(voices: readonly VoiceAmplitude[]): PhaseBandReading {
  const rho = turnDensity(voices);
  const marginal = phaseMarginal(rho);
  let band = 0;
  for (let i = 1; i < marginal.length; i++) if (marginal[i]! > marginal[band]!) band = i;
  return { marginal, band, name: PHASE_BANDS[band] ?? "observe" };
}

// ---------------------------------------------------------------------------
// Sequence wiring: many turns → SelfRead[] → the teleodynamic probe
// ---------------------------------------------------------------------------

/** One turn's raw input in a sequence — its transcript + the effects it fired. */
export interface TurnInput {
  readonly transcript: string;
  readonly effects?: readonly PersistedEffect[];
}

/**
 * Harvest a SEQUENCE of turns into the {@link SelfRead} stream the teleodynamic
 * probe consumes (oldest → newest). Wires the probe's feed end-to-end: each turn's
 * closing HUD + its persisted-write channel become one self-read.
 */
export function harvestSequence(turns: readonly TurnInput[]): SelfRead[] {
  return turns.map((t) => harvestTurn(t.transcript, t.effects ?? []).selfRead);
}

/**
 * North-Star (teleodynamic): harvest a turn sequence and read the teleodynamic
 * triple over it. Convenience over {@link harvestSequence} + {@link teleodynamicProbe}.
 * The reading stays PROVISIONAL (the probe's own guard) — an instrument, not a
 * motor claim.
 */
export function probeTurnSequence(turns: readonly TurnInput[]): TeleodynamicReading {
  return teleodynamicProbe(harvestSequence(turns));
}
