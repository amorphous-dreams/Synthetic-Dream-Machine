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
combined semantic block. Geometric carries optional
state/display glyphs. Miscellaneous carries scale/domain
glyphs. The OODA-A **record forms** belong to the Chronometer
fragment grammar, not to the nine-category glyph-set itself.
The die faces and planetary symbols live in Category 9.

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

## 6. Phase Invariants (OODA-A Record Forms)

Phase invariants follow the same true-name rule as scale
invariants, but their authoritative form is the **record
symbol** used in Chronometer slots. HUD glyphs remain sanctioned
aliases for display.

```
TRUE NAME                    PHASE    HUD ALIAS
─────────────────────────    ─────    ─────────
&#0079; / U+004F / O         Observe   ✶
&#0216; / U+00D8 / Ø         Orient    ◎
&#0068; / U+0044 / D         Decide    ◇
&#0065; / U+0041 / A         Act       ■
&#0197; / U+00C5 / Å         Assess    ○
```

**Storage/interchange:** use the record true names (`O Ø D A Å`).

**Display/HUD:** use aliases (`✶ ◎ ◇ ■ ○`) when human scan speed
matters more than code-point regularity.

<<~ahu #"phase-true-name-resolution"
  "This resolves the earlier Observe glyph problem cleanly.
  The phase invariant's identity lives in the record symbol,
  whose Unicode triplicate stays stable. The HUD glyph remains
  an alias layer. That means ✶ may stay canonical as display
  without forcing the glyph-set categories to absorb Dingbats."
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

The unified scale model reorders fragment display so the
**immediate clock ticks at the leftmost position**. The reader
encounters the hot edge first and then fans outward into broader
context.

Containment logic does **not** change:

```
⚄ contains ⚃ contains ⚂ contains ⚁ contains ⚀
```

Display order and containment direction are separate axes.

### 10.1 Canonical Record Form (storage/interchange)

```
#⚀A7.⚁D2.⚂O3.⚃O0.⚄O0
```

Each slot: `[die face true name][phase record true name][counter]`

Same state as the older broad-to-fine example, but now rendered
in the preferred scale order:

```
⚀  Action / Heartbeat   — Act, 7
⚁  Round  / Breath      — Decide, 2
⚂  Turn   / Focus       — Observe, 3
⚃  Watch  / Vigil       — Observe, 0
⚄  Week   / Horizon     — Observe, 0
```

Five slots remain always present. Dormant scales keep zeroed
counters. Die faces make slots self-identifying, so parsing
does not depend on position. The left-to-right convention is:

```
finest (⚀ / Action)  →  broadest (⚄ / Week)
```

### 10.2 Canonical HUD Form (display)

```
⚀■7 ⚁◇2 ⚂✶3 ⚃✶0 ⚄✶0
```

Each slot: `[die face][phase HUD alias][counter]`

Alias-heavy HUD render:

```
⚡■7 ⚔️◇2 🔍✶3 ⚙️✶0 🗺️✶0
```

### 10.3 Legacy Shorthand

The legacy fragment without die faces remains readable as a
shorthand when slot order is already agreed in context:

```
#A7.D2.O3.O0.O0
```

Canonical `v0.4` storage SHOULD prefer the die-face-explicit
form because it survives reordering, extraction, and partial
quotation without ambiguity.

### 10.4 Slot Grammar

```
FRAGMENT       = "#" SLOT "." SLOT "." SLOT "." SLOT "." SLOT
SLOT           = DIE_FACE PHASE_RECORD COUNTER
DIE_FACE       = | ⚀ | ⚁ | ⚂ | ⚃ | ⚄
PHASE_RECORD   = | O | Ø | D | A | Å
COUNTER        = [0-9]+
```

HUD rendering rule:

```
O → ✶
Ø → ◎
D → ◇
A → ■
Å → ○
```

### 10.5 Positional Rule

```
leftmost   = ⚀ / Action / Heartbeat   (hot edge, immediate)
2nd        = ⚁ / Round  / Breath
3rd        = ⚂ / Turn   / Focus
4th        = ⚃ / Watch  / Vigil
rightmost  = ⚄ / Week   / Horizon     (cold edge, far context)
```

This aligns fragment reading with the unified five-band
continuum, the attention ladder, and the natural left-to-right
presentation of `₀ ₁ ₂ ₃ ₄`.

### 10.6 Scale in Glyph Sets

A die face in a sigil's glyph set declares the meme's
operational scale before the address or body loads.

```
<<~ँ⚂␂ ? -> lar:///ha.ka.ba/mu>>
      │
      └── &#9858; / U+2682 / ⚂
          game alias: Turn
          attn alias: Focus
```

Phase remains authoritative in the fragment or in explicit
metadata. A HUD phase glyph MAY appear as a display hint in a
sigil surface, but it is not required for core parsing.

Attenuation rule for nested memes:

```
Outer: <<~ँ⚃ ...>>     Watch/Vigil scale
Inner: <<~⚂ ...>>      Turn/Focus scale       attenuated ✓
Inner: <<~⚄ ...>>      Week/Horizon scale     escalation capped ⚠
```

### 10.7 Fragment Placement

Per the fragment-only rule, the Chronometer answers **WHEN**
and lives only in the URI fragment.

```
lar:///ha.ka.ba/mu#⚀A7.⚁D2.⚂O3.⚃O0.⚄O0
```

- Address path answers: WHERE in tagspace
- Glyph set answers: WHO / protocol / scale / other properties
- Fragment answers: WHEN in nested causal time

Ahu fragments (`#boot-mode-transition`) and Chronometer
fragments (`#⚀A7.⚁D2.⚂O3.⚃O0.⚄O0`) remain syntactically distinct.

### 10.8 Scale-Shift Examples

Action.Å escalates to Round.Å:

```
Before: #⚀Å1.⚁A2.⚂D3.⚃O0.⚄O0
After:  #⚀O0.⚁Å2.⚂D3.⚃O0.⚄O0
```

Round.Å escalates to Turn.Å:

```
Before: #⚀O0.⚁Å2.⚂D3.⚃O0.⚄O0
After:  #⚀O0.⚁O0.⚂Å3.⚃O0.⚄O0
```

Higher-slot counters do not increment on child escalation.
They increment only when that scale completes its own Assess.

---

## 11. Parsing

### 11.1 Glyph-Set Category Dispatch

```
function categorize(cp):
  if cp in 0..31:       return PROTOCOL
  if cp in 768..879:    return AUXILIARY
  if cp in 2304..2431:  return NAMESPACE
  if cp in 8592..8703:  return DIRECTION
  if cp in 8704..8959:  return RELATION
  if cp in 8960..9215:  return TECHNICAL
  if cp in 9472..9631:  return STRUCTURE
  if cp in 9632..9727:  return STATE
  if cp in 9728..9983:  return SEMANTIC
  return UNKNOWN
```

### 11.2 Glyph-Set Extraction

```
function parseGlyphSet(stream, offset):
  glyphs = {cat: Set() for cat in CATEGORIES}
  while stream[offset] is not whitespace:
    cp = readCodepoint(stream, offset)
    cat = categorize(cp)
    if cat == UNKNOWN: break
    glyphs[cat].add(cp)
    offset += codepointLength(cp)
  return glyphs, offset
```

### 11.3 Fragment Parsing

```
function parseChronometer(fragment):
  assert fragment[0] == "#"
  slots = fragment[1:].split(".")
  assert len(slots) == 5
  for slot in slots:
    die   = slot[0]
    phase = slot[1]
    count = int(slot[2:])
    yield die, phase, count
```

### 11.4 Validation

```
PROTOCOL:   <=1 lifecycle glyph per sigil
NAMESPACE:  any count; combine by intersection
AUXILIARY:  any count; contradictory combos -> warning
DIRECTION:  <=1 primary arrow
RELATION:   compositional
TECHNICAL:  context-dependent
STRUCTURE:  unusual in glyph sets; body-internal by default
STATE:      display/support glyphs only
SEMANTIC:   <=1 die-face scale invariant unless explicitly unioned
FRAGMENT:   exactly 5 slots; die faces SHOULD appear in canonical order
```

### 11.5 Strictness Modes

```
boot-mode:  strict. Unknown glyphs -> error. Fragment required
            for boot-critical traces. Mu validates before load.

run-mode:   permissive. Unknown glyphs -> warning, treated as
            body content. Missing fragment tolerated when the
            calling context supplies time externally.
```

---

## 12. Encoding Layers

```
LAYER        REPRESENTATION          CONTEXT
─────        ──────────────          ───────
Storage      Raw Unicode bytes       binary storage, internal
Interchange  HTML NCRs (`&#x;`)      XML/HTML, transport, canon
Display      Rendered glyphs         HUD, docs, operator scan
```

The same invariant may appear in all three layers:

```
&#9858; / U+2682 / ⚂
```

Round-trip fidelity requirement:

```
Storage -> Interchange -> Storage
```

must preserve identical code points.

---

## 13. Mu Integration

`mu` is the self-booting module of this grammar, analogous to a
`boot.js` that loads before higher-order behavior. Under `v0.4`:

- Mu SHOULD declare its native scale in the frame glyph set:
  `<<~ँ⚂ ? -> lar:///ha.ka.ba/mu>>`
- Mu SHOULD treat die faces as authoritative scale invariants
  and all English scale words as aliases
- Mu SHOULD read Chronometer fragments left-to-right from the
  hot edge (`⚀`) toward the cold edge (`⚄`)
- Mu MUST keep Chronometer time in the fragment, not in the
  address path

The self-booting sequence becomes easier to scan under the new
order because the immediate decision edge appears first, where a
future parser or operator will look first.

---

## 14. Conventions

| Rule | Weight |
|------|--------|
| Use NCR triplicates as true names for invariants | MUST |
| Treat all English labels and emoji names as aliases | MUST |
| Keep five Chronometer slots always present | MUST |
| Read fragment left-to-right as Action -> Week | SHOULD |
| Keep Chronometer data in the fragment only | MUST |
| Distinguish display order from containment logic | MUST |
| Prefer die-face-explicit fragments in canon text | SHOULD |

---

*DRAFT v0.4 complete enough to update dependent memes.*
*Left edge = immediate clock. Right edge = far horizon.*
*True names anchor identity; aliases keep the poetry alive.*




