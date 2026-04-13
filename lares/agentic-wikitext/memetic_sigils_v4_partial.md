# Memetic Sigil Wikitext Specification v0.4

Status: [S:0.55] — unified with Chronometer, naming resolved.

---

## 0. Naming Convention: NCR Triplicates

Every invariant in this specification carries a **true name**
expressed as an NCR triplicate: decimal reference, hexadecimal
reference, and rendered glyph.

```
True Name:  &#9858; / U+2682 / ⚂
```

All three forms name the same entity. Any one form suffices
for identification. All natural-language references to these
invariants (English words, game-time aliases, attention-quality
descriptions, emoji HUD sigils) function as **aliases** — useful
for communication, never authoritative for parsing or identity.

Aliases carry hidden confidence ratings:

```
True name:   &#9858; / U+2682 / ⚂           [C:0.95]
Game alias:  "Turn"                           [S:0.65]
Attn alias:  "Focus"                          [P:0.35]
HUD alias:   🔍                               [S:0.55]
```

The confidence gap between true name and aliases reflects
structural reality: true names derive from the Unicode standard
(slow-changing, externally governed, verifiable). Aliases derive
from operator convention (session-changeable, domain-specific,
negotiable).

---

## 1. Memetic Sigils — Architecture

A **memetic sigil** opens and closes a **meme object**. Sigils
constitute the shared signal carrier between agent and operator —
the action-verb-surface and render pipeline both parties use.

Every memetic sigil carries:

1. **Shape** — syntactic form identifying sigil type
2. **Glyph set** — strict unordered set of Unicode code points
3. **Payload** — shape-specific content

**Strict set semantics:**
- Order-independent
- No duplicates
- Presence/absence only (binary feature per glyph)
- Canonical form: sorted by code point value
- Empty set valid

---

## 2. Sigil Shape Taxonomy

```
SHAPE           FUNCTION                   CONTEXT
─────           ────────                   ───────
<<~ ... >>      Envelope (frame, heading,  Outer boundary of
                body, close)               meme objects

<<~iam [name]   Identity / self-           Inside heading
  [metadata]    declaration                (SOH region)
>>

<<~ahu #"[id]"  Waypoint / altar /         Inside any meme
  "[desc]"      worksite. Fragment-         body. URI-
>>              addressable.                dereferenceable.
```

---

## 3. Five-Layer Meme Structure

```
Layer 0: FRAME    <<~[glyphs] ? -> lar:///h.k.b/name>>
Layer 1: HEADING  <<~␁>>  +  <<~iam name [metadata] >>
Layer 2: BODY     <<~␂>>
Layer 3: BODY CL. <<~␃>>
Layer 4: TRANS CL. <<~[glyphs]␄ -> ?>>
```

**Protocol lifecycle within layers:**

```
&#0001; / U+0001 / ␁  SOH  heading opens (Layer 1)
&#0002; / U+0002 / ␂  STX  body opens (Layer 2)
&#0003; / U+0003 / ␃  ETX  body closes (Layer 3, inner memes)
&#0004; / U+0004 / ␄  EOT  transmission complete (Layer 4, outermost)
```

**UCAN attenuation:** inner sigils inherit envelope glyph set.
Inner may attenuate (remove glyphs via intersection). Inner may
not escalate (add glyphs the envelope lacks). Empty inner =
full inheritance.

---

## 4. Glyph Codeset — Nine Categories

Each category occupies a non-overlapping Unicode range.
Category identified by range check, O(1) per glyph.

```
CAT  TRUE NAME RANGE                BLOCK              ROLE
───  ─────────────────               ─────              ────
 1   &#0000;–&#0031;                 C0 Controls        PROTOCOL
     U+0000–U+001F

 2   &#0768;–&#0879;                 Combining           AUXILIARY
     U+0300–U+036F                   Diacriticals

 3   &#2304;–&#2431;                 Devanagari          NAMESPACE
     U+0900–U+097F

 4   &#8592;–&#8703;                 Arrows              DIRECTION
     U+2190–U+21FF

 5   &#8704;–&#8959;                 Mathematical        RELATION
     U+2200–U+22FF                   Operators

 6   &#8960;–&#9215;                 Miscellaneous       TECHNICAL
     U+2300–U+23FF                   Technical

 7   &#9472;–&#9631;                 Box Drawing +       STRUCTURE
     U+2500–U+259F                   Block Elements

 8   &#9632;–&#9727;                 Geometric           STATE
     U+25A0–U+25FF                   Shapes

 9   &#9728;–&#9983;                 Miscellaneous       SEMANTIC
     U+2600–U+26FF                   Symbols
```

**Note:** Category 8 (Geometric Shapes) and Category 9
(Miscellaneous Symbols) separated from the prior draft's
combined Category 8. The split reflects functional distinction:
Geometric carries *state/phase glyphs*, Miscellaneous carries
*scale/domain glyphs*. The OODA-A phase glyphs live in
Category 8. The die faces and planetary symbols live in
Category 9.

---

## 5. Scale Invariants (Die Faces)

**Category 9 — SEMANTIC (Miscellaneous Symbols)**

Five contiguous code points. Each dot = one binary nesting
level. More dots = broader scope = deeper nesting.

```
TRUE NAME                    DOTS  BINARY   ALIAS(game)  ALIAS(attn)
─────────────────────────    ────  ──────   ───────────  ───────────
&#9856; / U+2680 / ⚀         1    2¹=2     Action       Heartbeat
&#9857; / U+2681 / ⚁         2    2²=4     Round        Breath
&#9858; / U+2682 / ⚂         3    2³=8     Turn         Focus
&#9859; / U+2683 / ⚃         4    2⁴=16    Watch        Vigil
&#9860; / U+2684 / ⚄         5    2⁵=32    Week         Horizon

RESERVE:
&#9861; / U+2685 / ⚅         6    2⁶=64    (meta)       (meta)
```

**Scope axis (die face dots):** counts nesting depth. More dots =
more levels encompassed = broader scope.

**Frequency axis (Fuller, per-level):** counts edge subdivisions
within a single level. Independent of die-face dot count.

These axes operate orthogonally. Die face dots index *how many
scales nest*. Fuller frequency indexes *how fine-grained each
scale resolves*.

---

## 6. Phase Invariants (OODA-A Glyphs)

**Category 8 — STATE (Geometric Shapes) and Category 9**

```
TRUE NAME                    PHASE    RECORD   HUD
─────────────────────────    ─────    ──────   ───
&#9782; / U+2636 / ✶         Observe   O       ✶
&#9678; / U+25CE / ◎         Orient    Ø       ◎
&#9671; / U+25C7 / ◇         Decide    D       ◇
&#9632; / U+25A0 / ■         Act       A       ■
&#9675; / U+25CB / ○         Assess    Å       ○
```

<<~ahu #"star-codepoint"
  "✶ renders as U+2736 (Six Pointed Black Star) in the
  Dingbats block, not in Misc. Symbols. Need to verify the
  operator's canonical codepoint. If ✶ sits at U+2736
  (&#10038;), it falls outside Category 9's range. Alternative:
  use ✦ U+2726 (&#10022;, Black Four Pointed Star, also
  Dingbats) or ★ U+2605 (&#9733;, Black Star, Misc. Symbols
  = within Category 9). The operator's spec shows ✶ as the
  HUD glyph — confirming its exact codepoint determines
  whether it sits inside or outside the nine-category system.
  If outside, it constitutes a Category 10 glyph or an
  exception. Awaiting operator ruling."
>>

---

## 7. Namespace Invariants

**Category 3 — NAMESPACE (Devanagari)**

```
TRUE NAME                    TIER         ALIAS
─────────────────────────    ────         ─────
&#2305; / U+0901 / ँ         Admin        main stack
&#2306; / U+0902 / ं         Operator     session
&#2307; / U+0903 / ः         User         request
&#2364; / U+093C / ़         System       internal
```

Authority matrix (namespace × action):

```
         render    evaluate      unask     modify
ँ Admin  all       all           all       all
ं Oper   all       ≤ own cons.   own       none
ः User   ≤ own c.  none          none      none
़ Sys    system    system        system    system
```

Combination semantics: intersection (most restrictive applies).

---

## 8. Protocol Invariants

**Category 1 — PROTOCOL (C0 Controls)**

### 8.1 Lifecycle (bound sub-group, adjacent)

```
TRUE NAME                    FUNCTION          LAYER
─────────────────────────    ────────          ─────
&#0001; / U+0001 / ␁         SOH heading open   L1
&#0002; / U+0002 / ␂         STX body open      L2
&#0003; / U+0003 / ␃         ETX body close     L3
&#0004; / U+0004 / ␄         EOT trans close    L4
```

### 8.2 Handshake

```
&#0005; / U+0005 / ␅         ENQ probe
&#0006; / U+0006 / ␆         ACK accept
&#0021; / U+0015 / ␕         NAK reject
```

### 8.3 Separators (bound sub-group, adjacent)

```
&#0028; / U+001C / ␜         FS  collection boundary
&#0029; / U+001D / ␝         GS  group boundary
&#0030; / U+001E / ␞         RS  meme boundary
&#0031; / U+001F / ␟         US  field boundary
```

### 8.4 Flow Control

```
&#0017; / U+0011 / DC1       XON
&#0018; / U+0012 / DC2       ctrl-2
&#0019; / U+0013 / DC3       XOFF
&#0020; / U+0014 / DC4       ctrl-4
```

### 8.5 Mode / Session / Signal

```
&#0014; / U+000E / SO        Shift Out
&#0015; / U+000F / SI        Shift In
&#0016; / U+0010 / DLE       Data Link Escape
&#0024; / U+0018 / CAN       Cancel
&#0025; / U+0019 / EM        End of Medium
&#0026; / U+001A / SUB       Substitute
&#0027; / U+001B / ESC       Escape
&#0000; / U+0000 / NUL       Null / void
&#0007; / U+0007 / BEL       Bell / alert
```

Validation: at most ONE lifecycle glyph per sigil. Separators
may co-occur with lifecycle. Mode switches may co-occur.

---

## 9. Auxiliary Invariants

**Category 2 — AUXILIARY (Combining Diacriticals)**

```
TRUE NAME                    FUNCTION
─────────────────────────    ────────
&#0771; / U+0303 / ̃          Provisional marker (register ceiling: Synthesis)
&#0778; / U+030A / ̊          Consecration marker (passed validation)
&#0803; / U+0323 / ̣          Ground / anchor (address-bound, non-portable)
&#0776; / U+0308 / ̈          Fork / split (dual reading)
&#0772; / U+0304 / ̄          Duration / persistence (stateful override)
```

---

## 10. Chronometer Fragment Format

### 10.1 Record Form (storage/interchange)

```
#⚄O0.⚃O0.⚂O3.⚁D2.⚀A7
```

Each slot: `[die face true name][phase record char][counter]`

Five slots, always present. Dormant scales keep zeroed
counters. Die face makes each slot self-identifying —
order-independent parsing possible. Fixed left-to-right
convention: broadest (⚄) → finest (⚀).

### 10.2 HUD Form (display)

```
⚄✶0 ⚃✶0 ⚂✶3 ⚁◇2 ⚀■7
```

Each slot: `[die face][phase HUD glyph][counter]`

### 10.3 Slot Grammar

```
SLOT   		= DIE_FACE & PHASE COUNTER
DIE_FACE 	= | ⚀ | ⚁ | ⚂ | ⚃ | ⚄
PHASE  		= | ✶ | ◎ | ◇ | ■ | ○        (HUD)
COUNTER = [0-9]+
```

### 10.4 Scale + Phase in Glyph Set

A die face and/or phase glyph in a sigil's glyph set declares
Claude's response was interrupted




