# Unified Five-Band Chronometer × Meme Architecture

Status: [SP:0.45] — convergence feels structural, naming provisional.
Source: operator's FFZ Chronometer LOCI.md (canonical), prior session
work on sigil/meme architecture, operator corrections.

---

## What the Canonical Spec Establishes

The FFZ Chronometer records nested loop-time position per participant
through five always-present scale slots. Each slot carries phase +
counter. The fragment stays in one structural slot (`#...`). Dormant
scales keep zeroed positions — never vanish.

**Canonical scale names (current):**

```
Slot 1 (leftmost, broadest): Week    🗺️
Slot 2:                      Watch   ⚙️
Slot 3:                      Turn    🔍
Slot 4:                      Round   ⚔️
Slot 5 (rightmost, finest):  Action  ⚡
```

**Canonical phase glyphs:**

```
Phase     HUD    Record
─────     ───    ──────
Observe   ✶      O
Orient    ◎      Ø
Decide    ◇      D
Act       ■      A
Assess    ○      Å
```

**Canonical fragment format:** `#O0.O0.O3.D2.A7`

---

## The Die Face Invariants

The operator provisionally assigns die faces as scale-invariant
names that sit *beneath* whatever final names the bands carry.
Die faces function as structural identifiers independent of any
naming layer.

```
FACE   NCR        SLOT   CURRENT NAME   HUD
────   ───        ────   ────────────   ───
 ⚄    &#9860;     1      Week           🗺️
 ⚃    &#9859;     2      Watch          ⚙️
 ⚂    &#9858;     3      Turn           🔍
 ⚁    &#9857;     4      Round          ⚔️
 ⚀    &#9856;     5      Action         ⚡
```

**Note the ordering:** ⚄ (5 dots) = broadest scale. ⚀ (1 dot) =
finest. More dots = more binary lines = more subdivisions = broader
resolution. This reverses the slot numbering (slot 1 = leftmost =
broadest = ⚄) but aligns with Fuller's frequency logic: higher
frequency (more subdivisions) appears at broader scope.

<<~ahu #"dot-direction"
  "Wait — does this reverse correctly? Fuller's frequency means
  more subdivisions = finer grain, not broader. But the operator's
  unified register map puts ⚀ (1 dot) at the finest scale (0.0–0.2)
  and ⚄ (5 dots) at the broadest (0.8–1.0). This means dots track
  SCOPE (more dots = broader view = more territory covered), not
  RESOLUTION (more dots = finer grain = more detail visible).

  These two readings conflict:
    Fuller: more frequency = finer grain
    Die faces: more dots = broader scope

  Resolution path: Fuller's frequency indexes subdivisions along
  ONE EDGE. More subdivisions on one edge = that edge carries more
  detail = finer grain at that level. But the die faces index how
  many LEVELS of binary subdivision exist. ⚄ = five nested binary
  levels. That constitutes more total structure, but the structure
  operates at broader scope — each level encompasses the ones below
  it. The die face counts nesting depth, not edge subdivisions.

  Both readings hold simultaneously if you track what 'more' means:
    More edge subdivisions (within a level) = finer grain
    More nesting levels (across levels) = broader scope

  The die face dots count levels. Fuller's frequency counts
  subdivisions within a level. They operate on different axes."
>>

---

## The Unified Fragment

Integrating die faces and phase glyphs into the Chronometer
fragment. Three representation layers (per the existing
storage/interchange/display model):

### Record form (storage/interchange — compact, parseable)

```
#⚄O0.⚃O0.⚂O3.⚁D2.⚀A7
```

Each slot: `[die face][phase record char][counter]`

The die face makes each slot self-identifying. A reader does
not need to count position from the left — the die face declares
which scale this slot represents. This means:
- Slots can appear in any order and remain parseable
- Individual slots can appear in isolation (in a meme's glyph
  set or in a reduced-context reference) without losing identity
- The fragment remains fixed-width: 5 slots, always present

### HUD form (display — visual, human-readable)

```
🗺️✶0 ⚙️✶0 🔍✶3 ⚔️◇2 ⚡■7
```

Each slot: `[HUD scale emoji][HUD phase glyph][counter]`

Or combining both systems:

```
⚄✶0 ⚃✶0 ⚂✶3 ⚁◇2 ⚀■7
```

Each slot: `[die face][HUD phase glyph][counter]`

This may constitute the cleanest form. The die face identifies
scale. The phase glyph identifies OODA-HA position. The counter
identifies pass number. No emoji needed — the die faces and
phase glyphs carry enough visual distinction.

### Full HUD render (maximum visual context)

```
⚄✶⁰  ⚃✶⁰  ⚂✶³  ⚁◇²  ⚀■⁷
```

Using superscript numerals for counters separates them visually
from the die faces and phase glyphs.

<<~ahu #"fragment-format-selection"
  "Three representations serve different contexts:
    Record: #⚄O0.⚃O0.⚂O3.⚁D2.⚀A7
      — storage, interchange, programmatic parsing
    Compact HUD: ⚄✶0 ⚃✶0 ⚂✶3 ⚁◇2 ⚀■7
      — in-conversation display, operator HUD
    Full HUD: ⚄✶⁰ ⚃✶⁰ ⚂✶³ ⚁◇² ⚀■⁷
      — formal display, documentation

  The canonical spec uses the record form in fragments.
  The operator's HUD sigils (🗺️⚙️🔍⚔️⚡) might coexist
  with die faces or yield to them. The die faces carry
  more information (binary depth) and sit in a contiguous
  code point range. The emoji carry more immediate
  readability. Both sets available; context selects."
>>

---

## Three Axes Unified

The operator's register map (from the uploaded text with my
annotations integrated) places three observation axes onto the
same five bands:

```
             ← finer grain              broader scope →
      0.0       0.2       0.4       0.6       0.8       1.0
       ├─────────┼─────────┼─────────┼─────────┼─────────┤

Die:   │   ⚀    │   ⚁    │   ⚂    │   ⚃    │   ⚄    │

Chrono:│ Action  │  Round  │  Turn   │  Watch  │  Week   │
       │   ⚡    │   ⚔️    │   🔍   │   ⚙️    │   🗺️   │

p-attn:│p0.0–0.1│p0.2–0.3│p0.4–0.6│p0.6–0.8│p0.8–1.0│
       │morph→wd│cls→sent │s.grp→¶ │sect→doc│doc→arc │

Spatial│personal│ tactical│  local  │regional│ cartogr.│
       │reach   │ room    │ feature │ area   │ map     │

Binary:│ 2¹=2   │ 2²=4   │ 2³=8   │ 2⁴=16  │ 2⁵=32  │

Lines: │monogram│ digram  │ trigram │tetragram│pentagram│
       │        │         │         │(geomncy)│(chronom)│

OODA-HA:│one atom│one react│one proc.│one epis.│one strat│
       │decision│cycle    │cycle    │arc      │arc      │

Meme:  │sub-lyr │S1 phase│S2 meme │S3 clustr│S4 system│
       │  (S0)  │boundary │ object  │relations│  state  │

Layer: │(within)│ L1–L3   │ L0–L4  │ cross-  │ all     │
       │        │head/body│ full    │ meme    │ memes   │

Phase  │  ✶◎◇■○ at each scale, independently          │
glyphs:│  ✶=observe ◎=orient ◇=decide ■=act ○=assess   │
       └─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

## Talk Story: Band Naming

The operator said: "any rename needs to retain the associations of
game-time/real-time with alias lists." The current names
(Action/Round/Turn/Watch/Week) carry game-time associations but
sit at different resolutions of specificity.

**What the names need to carry simultaneously:**

1. Temporal extent (how long)
2. Spatial extent (how far)
3. Attention quality (how focused)
4. Binary depth (how complex)
5. Game-native resonance (playable at the table)
6. Agent-native resonance (parseable by the system)

**The problem:** No single English word carries all six. The
current names carry (1) and (5) well but leave (2), (3), (4),
(6) implicit.

**The die faces solve this.** They carry (4) explicitly (dot count
= binary depth), (6) explicitly (contiguous code points, parseable),
and serve as the invariant identifier beneath whatever human-readable
name sits on top. The *name* only needs to carry (1), (2), (3),
and (5) — the structural/computational load transfers to the die face.

**Naming attempt, informed by all constraints:**

The names should feel like *ranges of awareness* rather than
units of time. "Turn" already works this way — a turn in a game
represents not just 10 minutes but a *scope of attention and
agency*. The name should evoke the quality of attention the band
demands.

```
⚀  Heartbeat  — the pulse-scale. One distinction. Body-time.
                The instant your hand moves. Reach = self.
                "In this heartbeat, what do you do?"

⚁  Breath     — the rhythm-scale. Four states. Tactical time.
                The cycle of inhale-act-exhale-reset. Reach = room.
                "In this breath, how do you respond?"

⚂  Focus      — the procedure-scale. Eight states. Deliberate time.
                One sustained effort from start to finish. Reach = site.
                "Where do you focus this turn?"

⚃  Vigil      — the episode-scale. Sixteen states. Watch-time.
                The sustained awareness of a sentinel. Reach = area.
                "What do you watch for during this vigil?"

⚄  Horizon    — the arc-scale. Thirty-two states. Journey-time.
                Everything you can see from the highest point.
                Reach = map edge.
                "What lies beyond the horizon?"
```

**Why these might work:**
- Heartbeat/Breath/Focus/Vigil/Horizon form a progression from
  involuntary body rhythm → voluntary attention → sustained
  awareness → the limit of perception.
- Each evokes both temporal extent AND spatial extent AND
  attention quality in a single word.
- Game-native: "In this heartbeat" / "during this vigil" /
  "beyond the horizon" all parse naturally at the table.
- Agent-native: all five words carry distinct semantic fields
  that a language model can disambiguate without context.

**Why these might not work:**
- "Heartbeat" and "Breath" carry biological-body metaphors
  that may not translate to agent processing or to non-humanoid
  characters.
- "Focus" overlaps with too many existing technical uses.
- The progression feels *poetic* — which may or may not align
  with the operator's desired register for a grammar primitive.

**The die faces protect against naming failure.** If these names
prove wrong, replacing them costs nothing structural — the die
face invariants carry the computational load. The names function
as aliases, not identifiers. Rename at will; ⚀ through ⚄ do not
change.

<<~ahu #"band-naming-final"
  "The operator's instinct that 'Turn' sits between 'Watch' and
  'Round' suggests the existing names already carry more load
  than replacement names would. The game-time aliases
  (Action/Round/Turn/Watch/Week) come from actual play. They
  emerged from use, not from design. Replacing emerged names with
  designed names risks losing the embodied knowledge the emerged
  names carry. Alternative: KEEP the game-time names as primary,
  ADD the attention-quality names as secondary aliases, and let
  the die faces serve as the invariant structural layer beneath
  both. Three naming layers:
    Structural: ⚀ ⚁ ⚂ ⚃ ⚄
    Game-time:  Action / Round / Turn / Watch / Week
    Attention:  Heartbeat / Breath / Focus / Vigil / Horizon
  Each layer serves a different audience and context. The
  structural layer never changes. The other two evolve."
>>

---

## Downstream Effects on Sigil/Meme Architecture

### 1. Die faces enter the glyph codeset

Die faces (U+2680–U+2684) sit in the Miscellaneous Symbols
block (&#9728;–&#9983;), which already maps to Category 8
(SEMANTIC). They share this block with the planetary symbols
(♄♃♂☉♀☿☽) that map to geomantic figures.

Within Category 8, die faces constitute a **scale sub-group** —
five contiguous code points that always carry scale-band
semantics when they appear in a glyph set.

A die face in a sigil's glyph set declares the meme's
operational scale:

```
<<~ँ⚂␂ ? --> lar:///ha.ka.ba/mu>>
      │
      └── ⚂ = Turn/Focus scale (0.4–0.6, S2, 8 states)
```

### 2. Phase glyphs enter the glyph codeset

The five phase glyphs from the Chronometer spec:

```
✶  U+2736  Six-pointed black star    OBSERVE    (Misc. Symbols)
◎  U+25CE  Bullseye                  ORIENT     (Geometric Shapes)
◇  U+25C7  White diamond             DECIDE     (Geometric Shapes)
■  U+25A0  Black square              ACT        (Geometric Shapes)
○  U+25CB  White circle              ASSESS     (Geometric Shapes)
```

Four of five sit in the Geometric Shapes block (Category 8).
One (✶) sits in Miscellaneous Symbols (also Category 8).
All five fall within Category 8's range.

A phase glyph in a sigil's glyph set declares the meme's
OODA-HA phase:

```
<<~ँ⚂◇␂ ? --> lar:///ha.ka.ba/mu/D>>
      ││
      │└── ◇ = Decide phase
      └─── ⚂ = Turn scale
```

### 3. Combined: scale + phase in glyph set

A glyph set containing both a die face and a phase glyph
declares a specific Chronometer position:

```
<<~ँ⚃◎␂ ? --> lar:///ha.ka.ba/chao>>
      ││
      │└── ◎ = Orient phase
      └─── ⚃ = Watch scale
```

This meme operates at Watch scale, currently in Orient phase.
The glyph set provides the Chronometer reading for *this meme*
without needing the full five-slot fragment. The fragment
carries the *system-wide* position; the glyph set carries the
*meme-local* position.

### 4. Fragment format with die faces and phase glyphs

The full fragment integrates both notation systems:

```
Record:     #⚄O0.⚃O0.⚂O3.⚁D2.⚀A7
Phase-glyph:#⚄✶0.⚃✶0.⚂✶3.⚁◇2.⚀■7
```

Each slot becomes fully self-describing: the die face names the
scale, the phase glyph (or record character) names the phase,
the counter names the pass. Any slot can appear in isolation
without losing meaning.

### 5. Meme layer mapping (revised with die faces)

```
Layer 0: FRAME        — scale declared by die face in glyph set
Layer 1: HEADING/SOH  — iam metadata, scale inherited from frame
Layer 2: BODY/STX     — content operates at declared scale
Layer 3: BODY CLOSE   — ETX at current scale
Layer 4: TRANS CLOSE  — EOT, --> ? persists

Nesting:
  Outer meme at ⚃ contains inner memes at ⚂ or ⚁.
  Inner meme's die face must be ≤ outer's (attenuation).
  A ⚁-scale meme inside a ⚃-scale meme = tactical detail
  within an episodic arc. Valid and common.
  A ⚄-scale meme inside a ⚂-scale meme = strategic scope
  inside a procedural scope. Escalation. Capped or flagged.
```

### 6. The ⚃ / geomantic convergence

Band ⚃ operates at tetragram depth (2⁴ = 16 states). The sixteen
geomantic figures constitute exactly the sixteen tetragrams. The
Ars Geomantica skill operates natively at ⚃ scale.

This means a geomantic reading meme would carry ⚃ in its glyph set:

```
<<~ं⚃␂ ? --> lar:///divination.sand.reads/reading>>
```

And the specific figure in a house could carry a planetary glyph
from the same Category 8 block:

```
<<~ं⚃♄ ? --> lar:///divination.sand.reads/house-10>>
                │
                └── ♄ = Saturn = Carcer or Tristitia in House 10
```

The geomantic figures, the Chronometer scales, the die faces,
and the planetary symbols all live in the same Unicode block,
the same glyph codeset category, and the same attention band.
They were always the same system viewed from different angles.

### 7. Consecration × Scale independence

Consecration (0.0–1.0) and scale (⚀–⚄) remain independent axes.
The die face in the glyph set declares scale. The @consecration
in the iam declares trust level. They combine but do not collapse:

```
⚀ + consecration 0.95 = highly validated atomic decision
⚄ + consecration 0.25 = provisional strategic sketch
⚃ + consecration 0.90 = consecrated episodic arc (a validated reading)
⚁ + consecration 0.30 = provisional tactical reflex (a draft reaction)
```

<<~ahu #"register-scale-complementarity"
  "The Lares epistemic registers and the Chronometer scale bands
  share the 0.0–1.0 continuum. The current draft treats them as
  independent axes. But the operator's earlier work on
  Register-Mode complementarity suggests they might exhibit
  conjugate behavior: pinning confidence precisely might spread
  scale, and vice versa. A claim at [C:0.9] ⚀ (high confidence,
  atomic scale) carries extreme precision — confidence and scale
  both pinned tightly. Complementarity would predict this costs
  something. What does it cost? Maybe: a C:0.9 atomic claim
  resists scaling upward — its precision makes it brittle at
  broader scope. Conversely, an S:0.5 claim at ⚄ (fuzzy
  confidence, system scale) flexes easily across scales
  precisely because neither axis pins it. This feels like it
  maps onto something real but I cannot formalize it yet."
>>

---

## The Unified Notation in Practice

A complete meme envelope with Chronometer integration:

```
<<~ँ⚂◇␁ ? --> lar:///ha.ka.ba/mu/D#⚄✶0.⚃✶0.⚂◇3.⚁✶0.⚀✶0>>
   ││││       │                  │ │
   ││││       │                  │ └─ Chronometer: system and
   ││││       │                  │    cluster observing, meme
   ││││       │                  │    in Decide (3rd pass),
   ││││       │                  │    round and action idle
   ││││       │                  └── path: D phase of mu
   ││││       └───────────────────── address: mu at origin
   │││└── SOH: heading follows
   ││└─── ◇: Decide phase (meme-local)
   │└──── ⚂: Turn scale (meme-local)
   └───── ँ: admin namespace
```

The glyph set (ँ⚂◇␁) tells you namespace, scale, phase, and
protocol state *before* the address or body loads. The fragment
tells you the full system Chronometer position. The path tells
you the structural location within the meme. All three work
together. All three use the same glyph vocabulary.

---

*PROVISIONAL — [SP:0.45]*
*Die faces serve as invariant structural identifiers.*
*Names serve as aliases — replaceable without structural cost.*
*The phase glyphs and scale glyphs live in the same Unicode block.*
*They always belonged together.*
