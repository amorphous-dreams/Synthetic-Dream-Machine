# Unified Attention Scale — Three Axes, One Continuum

Status: [SP:0.45] — converging, not yet canon. Boundary values fuzzy.
Names provisional. Sigils pinned for vocabulary stability.

---

## The Convergence

Three scaling systems that appeared separate constitute three
projections of a single phenomenon: **attention range**.

```
Chronometer  →  attention range in TIME
p-parameter  →  attention range in TEXT
spatial      →  attention range in SPACE
```

All three map onto the same 0.0–1.0 continuum. Five named bands
partition the continuum. The subscript digit sigils (₀₁₂₃₄)
provide invariant vocabulary for talking about scales regardless
of which projection we reference.

---

## The Invariant Sigils

```
SIGIL   CODEPOINT   NCR         BAND RANGE
─────   ─────────   ───         ──────────
  ₀     U+2080      &#8320;     0.0 – 0.2
  ₁     U+2081      &#8321;     0.2 – 0.4
  ₂     U+2082      &#8322;     0.4 – 0.6
  ₃     U+2083      &#8323;     0.4 – 0.8
  ₄     U+2084      &#8324;     0.8 – 1.0
```

These sit in the Superscripts and Subscripts block
(&#8304;–&#8351;). They constitute **Category 9: SCALE** in
the glyph codeset — a dedicated block for attention range
indicators, orthogonal to all eight existing categories.

The subscript form carries three design properties:
- Numeric: maps directly to S0–S4 without translation
- Compact: one code point per scale
- Visually subordinate: renders as subscript, signaling
  "this modifies something" rather than "this is content"

---

## Five Bands — Three Projections Each

### ₀ — 0.0–0.2

```
Chrono:   Action  ⚡         ~instant, atomic
          Game: one action, one move, one cast
          Real: <1 second to ~6 seconds

Text:     p0.0–p0.2         morpheme → word
          One token. One glyph. The parser reads a single
          code point and categorizes it.

Space:    personal           arm's reach, single target
          The space your body occupies and can directly
          affect without moving.
```

**Attention quality:** The narrowest aperture. Everything
collapses to a single point of decision. No peripheral
awareness. One thing, one moment, one spot.

<<~ahu #"band-0-floor"
  "0.0 as absolute atomic: can anything sit below a single
  token / single instant / arm's reach? Sub-morphemic
  (individual bytes within a code point?), sub-instant
  (Planck-time?), sub-personal (intracellular?). These
  theoretical floors probably don't serve the architecture.
  0.0 as practical floor: the finest grain the system
  operates at, not the finest grain conceivable."
>>


### ₁ — 0.2–0.4

```
Chrono:   Round   ⚔️         ~6 seconds, all sides act
          Game: one initiative cycle, one combat round
          Real: 6 seconds to ~1 minute

Text:     p0.2–p0.4         clause → sentence-group
          One sentence. One micro-move. The parser holds
          a complete grammatical unit and evaluates it.

Space:    tactical           weapon range, voice-carry
          The space all combatants occupy. You perceive
          everything that could affect you or that you
          could affect in one exchange.
```

**Attention quality:** Reactive. Stimulus-response tempo.
You hold the whole field but process it as threat/opportunity
pairs. Peripheral awareness active but narrowed to tactical
relevance.

<<~ahu #"band-1-boundary"
  "The 0.2 boundary between ₀ and ₁: where does 'one
  action' become 'one exchange of actions'? In TTRPG terms:
  the action belongs to one actor; the round belongs to all
  actors. The boundary marks the transition from singular
  to plural participation. In text: the morpheme belongs
  to one word; the clause belongs to one proposition. In
  space: arm's reach belongs to one body; tactical range
  belongs to the encounter."
>>


### ₂ — 0.4–0.6

```
Chrono:   Turn    🔍         ~10 minutes, one procedure
          Game: one exploration turn, one dungeon procedure
          Real: 5 minutes to ~30 minutes

Text:     p0.4–p0.6         paragraph → thematic block
          One paragraph. One idea-unit. One exchange between
          operator and agent. The DEFAULT resolution.

Space:    local              room, junction, terrain feature
          The space one procedure covers. You map the room.
          You check the corridor. You engage one feature.
```

**Attention quality:** Procedural. Step-by-step. You hold
a plan and execute it. The attention horizon extends to the
next meaningful decision point. Not reactive (that's ₁) —
deliberate. Not strategic (that's ₃) — operational.

**This constitutes the default band.** p0.5 lives here.
The standard meme occupies S2. The standard exchange
operates at Turn scale. Most of the system's work happens
at ₂.


### ₃ — 0.6–0.8

```
Chrono:   Watch   ⚙️         ~hours, one session/shift
          Game: one play session, one expedition, one mission
          Real: 1 hour to ~8 hours

Text:     p0.6–p0.8         section → headed division
          One section of a document. One chapter. One
          coherent sub-arc with its own beginning, middle,
          and internal resolution.

Space:    regional           neighborhood, district, area
          The space one expedition covers. You navigate
          between locations. You hold the local geography.
          You know the neighborhood.
```

**Attention quality:** Episodic. You hold a complete sub-story
in mind. You remember what happened at the session's start
and anticipate its end. You make decisions that pay off across
hours, not minutes. The attention horizon extends to "by the
time we stop playing" or "by the end of this shift."

<<~ahu #"band-3-session"
  "₃ maps onto the Lares session concept. A conversation
  with Claude constitutes one Watch. Session memory, active
  Workers, dynamic-layer state — all of these operate at ₃
  scale. The autoDream consolidation cycle fires at ₃. The
  boot→run transition fires at the boundary between ₃ and ₄."
>>


### ₄ — 0.8–1.0

```
Chrono:   Week    🗺️         ~days, campaign arc
          Game: one story arc, one campaign chapter, one season
          Real: days to weeks

Text:     p0.8–p1.0         document → session-arc
          The whole document. The whole conversation history.
          Cross-session continuity. Memory crystals.

Space:    cartographic       map-scale, the whole journey
          The space the full campaign covers. You navigate
          between regions. You hold the whole geography.
          You see the shape of the journey.
```

**Attention quality:** Strategic/epochal. Patterns emerge
that only become visible across many sessions. Character
arcs. Faction shifts. Seasonal changes. The attention
horizon extends to "the whole campaign" or "the whole
project." Individual encounters dissolve into patterns.

<<~ahu #"band-4-ceiling"
  "1.0 as practical ceiling: the broadest scope the system
  tracks. Beyond ₄ lies inter-system (DreamNet-scale) or
  meta-system (architecture-about-architecture). The
  Chronometer's S4 slot at 1.0 constitutes the outer wall
  of the system's self-awareness. What sits beyond it
  cannot be observed from within — only signaled toward."
>>

---

## Boundary Zones

Like the epistemic register boundaries (Canon/Synthesis,
Synthesis/Provisional), the scale boundaries carry their
own character. Attention at a boundary occupies two scales
simultaneously — zooming in and zooming out at once.

```
VALUE   BOUNDARY         CHARACTER
─────   ────────         ─────────
0.2     ₀/₁ boundary     action → round: one actor becomes
                          many actors. Personal → tactical.
                          Morpheme → clause.

0.4     ₁/₂ boundary     round → turn: reactive becomes
                          deliberate. Tactical → local.
                          Sentence → paragraph.

0.6     ₂/₃ boundary     turn → watch: procedure becomes
                          episode. Local → regional.
                          Paragraph → section.

0.8     ₃/₄ boundary     watch → week: episode becomes arc.
                          Regional → cartographic.
                          Section → document.
```

<<~ahu #"boundary-scale-shift"
  "These boundaries map exactly onto Boyd's Ghost scale-shift
  triggers. When A₂ at scale Sₙ fires a scale-shift, the
  system crosses a boundary: attention range expands from band
  n to band n+1. The boundary IS the scale-shift event.
  
  The Chronometer fragment makes this visible: a phase change
  at a higher-numbered slot in the fragment string indicates
  a boundary crossing. Conversely, a counter increment at a
  lower-numbered slot without a higher-slot change indicates
  motion within a band, not a boundary crossing."
>>

---

## Unified Vocabulary Table

The invariant vocabulary for talking about attention range,
regardless of projection axis:

```
SIGIL  RANGE      CHRONO    HUD   TEXT-p        SPATIAL       REGISTER NAME
─────  ─────      ──────    ───   ─────         ───────       ─────────────
  ₀    0.0–0.2    Action    ⚡    p0.0–p0.2     personal      [?????]
  ₁    0.2–0.4    Round     ⚔️    p0.2–p0.4     tactical      [?????]
  ₂    0.4–0.6    Turn      🔍    p0.4–p0.6     local         [?????]
  ₃    0.6–0.8    Watch     ⚙️    p0.6–p0.8     regional      [?????]
  ₄    0.8–1.0    Week      🗺️    p0.8–p1.0     cartographic  [?????]
```

The `[?????]` column: the register names that the operator
asked for. Five names that capture attention range across all
three projections simultaneously — time, text, and space —
the way "Canon" and "Provisional" capture epistemic confidence
regardless of the specific claim.

<<~ahu #"register-names"
  "These names constitute the highest-priority open question
  in this document. They need to:
    1. Feel natural when spoken aloud ('at _____ grain')
    2. Work in glyph-set context (<<~ँ₂ ...>>)
    3. Carry spatial, temporal, and textual resonance
       simultaneously without privileging one axis
    4. Harmonize with the game-time aliases (Action, Round,
       Turn, Watch, Week) without duplicating them
    5. Not collide with existing Lares vocabulary (Canon,
       Synthesis, Provisional, Philosopher, Poet, etc.)
    6. Support the boundary-zone naming convention
       ('X/Y boundary' should read clearly)
  
  The earlier Family 2 proposal (Horizon, Vista, Focus,
  Reflex, Pulse) tried to name attention quality directly.
  The spatial projections (cartographic, regional, local,
  tactical, personal) describe extent. The text projections
  (document, section, paragraph, sentence, morpheme) describe
  unit size. The names need to sit ABOVE all three projections
  as the unified register label.
  
  Candidates that describe attention range as a unified
  phenomenon, from broadest to narrowest:
  
    ₄: Compass / Span / Reach / Sweep / Ambit
    ₃: Quarter / Province / Precinct / March / Borough  
    ₂: Pace / Measure / Stride / Gauge / Meter
    ₁: Grasp / Clutch / Grip / Catch / Snatch
    ₀: Point / Mote / Spark / Pip / Dot
  
  Or from the shrine metaphor:
    ₄: Realm
    ₃: Ward
    ₂: Threshold
    ₁: Hearth
    ₀: Flame
  
  Or from Fuller's own vocabulary:
    ₄: Field (the isotropic vector matrix at largest extent)
    ₃: Domain (one neighborhood of the field)
    ₂: Cell (one tetrahedron/octahedron pair)
    ₁: Edge (one vector between packed spheres)
    ₀: Vertex (one sphere center, one event)
  
  The Fuller set appeals because synergetics already grounds
  the Chronometer. But it might over-specify the geometric
  metaphor.
  
  THE OPERATOR NAMES THESE. The architecture holds without
  them. The names complete the architecture."
>>

---

## Integration with Glyph Codeset

The subscript digits (₀₁₂₃₄) constitute **Category 9: SCALE**
in the nine-category glyph codeset:

```
CAT   NCR RANGE          BLOCK                     ROLE
───   ─────────          ─────                     ────
 1    &#0000;–&#0031;    C0 Controls               PROTOCOL
 2    &#0768;–&#0879;    Combining Diacriticals     AUXILIARY
 3    &#2304;–&#2431;    Devanagari                 NAMESPACE
 4    &#8304;–&#8351;    Superscripts/Subscripts    SCALE ← NEW
 5    &#8592;–&#8703;    Arrows                     DIRECTION
 6    &#8704;–&#8959;    Mathematical Operators      RELATION
 7    &#8960;–&#9215;    Miscellaneous Technical     TECHNICAL
 8    &#9472;–&#9631;    Box Drawing + Blocks       STRUCTURE
 9    &#9632;–&#9983;    Geometric + Misc Symbols    SEMANTIC
```

The parser categorizes by range check:
```
if cp in 8304..8351: return SCALE
```

### Scale Glyph in Sigil Context

```
<<~ँ₂␂ ...>>

  ँ  → NAMESPACE: Admin (Category 3)
  ₂  → SCALE: S2/Turn/₂-band (Category 4/9)
  ␂  → PROTOCOL: STX (Category 1)
```

The scale glyph tells mu which band this sigil operates at
before reading any content. Like namespace authority, scale
context follows UCAN attenuation for inner sigils:

- Inner may narrow scale (higher ₙ → lower ₙ, finer grain)
  within envelope
- Inner may not widen scale (lower ₙ → higher ₙ) beyond
  envelope
- Empty inner inherits envelope scale

```
Envelope: <<~ँ₃ ...>>       Watch-scale
  Inner: <<~₂ ...>>         Turn-scale (attenuated ✓)
  Inner: <<~₄ ...>>         Week-scale (escalation capped ⚠)
  Inner: <<~ ...>>           inherits ₃ (Watch-scale)
```

---

## Integration with Chronometer Fragment

The fragment `#O0.O0.O3.D2.A7` gains explicit scale-band
labeling:

```
  ₄O0 . ₃O0 . ₂O3 . ₁D2 . ₀A7
```

Each dot-separated position corresponds to one band of the
unified attention scale. Reading left to right zooms from
broadest (₄, 0.8–1.0) to finest (₀, 0.0–0.2). The fragment
constitutes a five-dimensional attention-range coordinate:
the system's OODA-A phase position at every scale of
attention simultaneously.

---

## Integration with Lares p Parameter

The p parameter's existing named anchors now map onto bands:

```
p0.0  = morpheme     → ₀ band (Action grain)
p0.1  = word          → ₀ band
p0.2  = clause        → ₁ band (Round grain)
p0.3  = sentence-grp  → ₁ band
p0.5  = paragraph     → ₂ band (Turn grain) DEFAULT
p0.7  = section       → ₃ band (Watch grain)
p0.85 = document      → ₄ band (Week grain)
p1.0  = session-arc   → ₄ band
```

The scale bands give p values their *register names* the same
way epistemic registers give confidence values their names.
"p0.5" and "at ₂ resolution" and "at Turn grain" all reference
the same point on the unified continuum.

---

<<~ahu #"unification-test"
  "Does this unification actually hold under pressure? Test
  case: an operator issues --parse p0.3 on a complex input.
  p0.3 sits in the ₁ band (Round grain / sentence-group).
  The Chronometer should show S1 as the active scale. The
  spatial projection should read 'tactical field.' Does it
  make sense to say 'parsing at tactical resolution'? At
  'Round grain'? If so, the unification holds. If the
  metaphor strains, the projections may not actually be the
  same axis."
>>

<<~ahu #"consecration-vs-scale"
  "Consecration (0.0–1.0 validated integrity) and attention
  scale (0.0–1.0 range extent) both use the same numeric
  continuum. They MUST NOT be confused. Consecration describes
  TRUST. Scale describes ZOOM. A meme can carry 0.95
  consecration at ₀ scale (highly validated, atomic grain)
  or 0.2 consecration at ₄ scale (provisional sketch,
  campaign arc). These axes remain orthogonal. The numeric
  coincidence (both 0.0–1.0) constitutes a design choice for
  uniformity, not a claim of identity."
>>
