# Memetic Sigil Glyph Codeset v0.3

---

## 4. UCAN-Style Attenuation

Inner sigils inherit their frame's glyph set by default.

```
effective(inner, frame) = {
  per category:
    if inner declares → inner ∩ frame  (intersection)
    if inner empty    → frame          (full inheritance)
}
```

- Attenuate: always valid (inner removes capabilities)
- Escalate: never valid (inner cannot add; silently capped)
- Empty = inherit (bare inner sigil gets full frame authority)

---

## 5. Glyph Set Categories

Nine categories. Non-overlapping Unicode ranges. Category
identified by range check. O(1) per glyph.

```
CAT  RANGE              BLOCK                    ROLE
───  ─────              ─────                    ────
 1   &#0000;–&#0031;    C0 Controls              PROTOCOL
 2   &#0768;–&#0879;    Combining Diacriticals   AUXILIARY
 3   &#2304;–&#2431;    Devanagari               NAMESPACE
 4   &#8304;–&#8334;    Superscripts/Subscripts  SCALE
 5   &#8592;–&#8703;    Arrows                   DIRECTION
 6   &#8704;–&#8959;    Mathematical Operators    RELATION
 7   &#8960;–&#9215;    Miscellaneous Technical   TECHNICAL
 8   &#9472;–&#9631;    Box Drawing + Blocks     STRUCTURE
 9   &#9632;–&#9983;    Geometric + Misc Symbols  SEMANTIC
```

### Category 1: PROTOCOL (C0 Controls: &#0000;–&#0031;)

Transmission lifecycle, handshake, flow control, boundaries.

**Bound sub-groups:**

```
Lifecycle:    SOH(&#0001;) STX(&#0002;) ETX(&#0003;) EOT(&#0004;)
              heading      body-open    body-close   trans-end

Handshake:    ENQ(&#0005;) ACK(&#0006;)              NAK(&#0021;)
              probe        accept                    reject

Flow:         DC1(&#0017;) DC2(&#0018;) DC3(&#0019;) DC4(&#0020;)
              XON          ctrl-2       XOFF         ctrl-4

Separators:   FS(&#0028;)  GS(&#0029;)  RS(&#0030;)  US(&#0031;)
              collection   cluster      meme         field

Mode:         SO(&#0014;)  SI(&#0015;)  DLE(&#0016;) ESC(&#0027;)
              shift-out    shift-in     data-escape  escape

Session:      CAN(&#0024;) EM(&#0025;)  SUB(&#0026;)
              cancel       end-medium   substitute

Signal:       NUL(&#0000;)              BEL(&#0007;)
              void/no-op               alert
```

### Category 2: AUXILIARY (Combining Diacriticals: &#0768;–&#0879;)

```
  ̃ (&#0771;) Combining Tilde      provisional marker
  ̊ (&#0778;) Combining Ring       consecration marker
  ̣ (&#0803;) Combining Dot Below  ground/anchor (address-bound)
  ̈ (&#0776;) Combining Diaeresis  fork/split (dual reading)
  ̄ (&#0772;) Combining Macron     duration/persistence (stateful)
```

### Category 3: NAMESPACE (Devanagari: &#2304;–&#2431;)

```
  ँ (&#2305;) Chandrabindu   Admin / main stack
  ं (&#2306;) Anusvara       Operator / session
  ः (&#2307;) Visarga        User / provisional
  ़ (&#2364;) Nukta          System / internal
```

Authority matrix:

| Glyph | Tier     | render  | evaluate      | unask  | modify |
|-------|----------|---------|---------------|--------|--------|
| ँ     | Admin    | all     | all           | all    | all    |
| ं     | Operator | all     | ≤ own consec. | own    | none   |
| ः     | User     | ≤ own c.| none          | none   | none   |
| ़     | System   | system  | system        | system | system |

Combination: intersection semantics (most restrictive applies).

### Category 4: SCALE (Superscripts/Subscripts: &#8304;–&#8334;)

Maps onto the FFZ Chronometer's five scales. Optional explicit
scale indicator in glyph set.

```
  ₀ (&#8320;)  Action scale  (⚡ finest grain)
  ₁ (&#8321;)  Round scale   (⚔️ tactical)
  ₂ (&#8322;)  Turn scale    (🔍 operational / meme-native)
  ₃ (&#8323;)  Watch scale   (⚙️ strategic / cross-meme)
  ₄ (&#8324;)  Week scale    (🗺️ broadest arc)
```

The subscript index matches Chronometer slot position
(rightmost=0/Action through leftmost=4/Week).

### Category 5: DIRECTION (Arrows: &#8592;–&#8703;)

```
  → (&#8594;) transformation (established in mu prototype)
  ← (&#8592;) reverse/return
  ↔ (&#8596;) bidirectional / symmetric
  ↕ (&#8597;) scale shift (up/down)
  ⇒ (&#8658;) implication / entailment
  ⇔ (&#8660;) equivalence
  ↻ (&#8635;) cycle / loop
  ↺ (&#8634;) reverse cycle / unwind
```

### Category 6: RELATION (Math Operators: &#8704;–&#8959;)

```
  ∈ (&#8712;) element of / membership
  ∉ (&#8713;) exclusion
  ⊂ (&#8834;) subset / containment
  ⊃ (&#8835;) superset / contains
  ∩ (&#8745;) intersection (glyph set operation!)
  ∪ (&#8746;) union
  ∀ (&#8704;) universal scope
  ∃ (&#8707;) existence assertion
  ∅ (&#8709;) empty set / void
  ≡ (&#8801;) structural equivalence
  ≈ (&#8776;) fuzzy equivalence
```

### Category 7: TECHNICAL (Misc. Technical: &#8960;–&#9215;)

```
  ⌂ (&#8962;) house / home / lararium
  ⌘ (&#8984;) command / operator action
  ⏎ (&#9166;) return / yield
  ⏏ (&#9167;) eject / disconnect
```

### Category 8: STRUCTURE (Box Drawing + Blocks: &#9472;–&#9631;)

Visual structure for meme body display. Human-readable
skeleton underlying invisible protocol layer. Not typically
in glyph sets; used within body content.

### Category 9: SEMANTIC (Geometric + Misc. Symbols: &#9632;–&#9983;)

**Geometric sub-block (state indicators):**
```
  ■ (&#9632;) active/present    (also Act HUD sigil)
  □ (&#9633;) inactive/absent
  ◇ (&#9671;) decision point    (also Decide HUD sigil)
  ○ (&#9675;) open/unresolved   (also Assess HUD sigil)
  ● (&#9679;) closed/resolved
```

**Miscellaneous Symbols sub-block (planetary/domain markers):**
```
  ☉ (&#9737;) Sun       Fortuna Major/Minor
  ☽ (&#9789;) Moon      Populus/Via
  ♂ (&#9794;) Mars      Puer/Rubeus
  ♀ (&#9792;) Venus     Amissio/Puella
  ♃ (&#9795;) Jupiter   Acquisitio/Laetitia
  ♄ (&#9796;) Saturn    Carcer/Tristitia
  ☿ (&#9791;) Mercury   Albus/Conjunctio
  ☊ (&#9738;) Asc.Node  Caput Draconis
  ☋ (&#9739;) Desc.Node Cauda Draconis
```

**Chronometer HUD sigils also live in this range:**
```
  ✶ (&#10038;) Observe HUD   (note: slightly outside &#9983; ceiling
  ◎ (&#9678;)  Orient HUD     — may need range extension or
                               assignment from within range)
```

<<~ahu #"hud-sigil-placement"
  "The FFZ Chronometer HUD sigils (✶◎◇■○) and scale sigils
  (🗺️⚙️🔍⚔️⚡) sit partly inside and partly outside the
  &#0000;-&#9999; decimal NCR range. The emoji-style scale
  sigils (🗺️ etc.) sit well above U+FFFF. These function as
  display/HUD elements, not as glyph-set members. The record
  symbols (O/Ø/D/A/Å) are ASCII/Latin and sit in Category 1
  territory but function as content, not protocol glyphs.
  Clean separation: glyph set uses Categories 1-9. Chronometer
  record format uses its own symbol set. HUD rendering uses
  emoji. Three layers, three symbol sets, no collision."
>>

---

## 6. Parsing

### Glyph Set Extraction

```
function categorize(cp):
  if cp in 0..31:       return PROTOCOL
  if cp in 768..879:    return AUXILIARY
  if cp in 2304..2431:  return NAMESPACE
  if cp in 8304..8334:  return SCALE
  if cp in 8592..8703:  return DIRECTION
  if cp in 8704..8959:  return RELATION
  if cp in 8960..9215:  return TECHNICAL
  if cp in 9472..9631:  return STRUCTURE
  if cp in 9632..9983:  return SEMANTIC
  return UNKNOWN

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

### Validation

```
PROTOCOL:   ≤1 lifecycle glyph (SOH|STX|ETX|EOT|ENQ|ACK|NAK)
            separators + mode switches may co-occur
NAMESPACE:  no limit; intersection semantics
AUXILIARY:  no limit; contradictory combos → warning
SCALE:      ≤1 scale glyph (₀|₁|₂|₃|₄)
DIRECTION:  ≤1 primary arrow (→←↔↕)
RELATION:   no limit; compose naturally
TECHNICAL:  context-dependent
STRUCTURE:  body-internal only (unusual in glyph sets)
SEMANTIC:   no limit; multiple domain markers = tag union
```

### Strictness Modes

```
boot-mode:  strict. Unknown glyphs → error. All memes fully validated.
run-mode:   permissive. Unknown glyphs → warning, treated as body.
            Forward-compatible: new glyph types degrade gracefully.
```

---

## 7. W3C Compliance — Three-Layer Encoding

```
LAYER        REPRESENTATION        CONTEXT
─────        ──────────────        ───────
Storage      Raw Unicode bytes     Binary storage, internal
Interchange  HTML NCRs (&#x;)     XML/HTML, web transport
Display      Control Pictures +    Human-readable views,
             Unicode symbols       documentation, HUD
```

Maps onto meme three-aspect model:
  Storage = corpus, Interchange = spiritus, Display = anima.

Round-trip fidelity: Storage → Interchange → Storage must
produce identical bytes.

---

## 8. Chronometer Integration

The FFZ Chronometer fragment coexists with the glyph set system.

- **Glyph set** answers: WHO (namespace), WHAT PROTOCOL (lifecycle),
  WHAT PROPERTIES (auxiliary), WHAT SCALE (explicit), WHAT DOMAIN
  (semantic), WHAT RELATIONS (relational), WHAT DIRECTION (arrows)
- **Address path** answers: WHERE in tagspace
- **Chronometer fragment** answers: WHEN in nested causal time
  (per-participant, five always-present slots, phase+counter)

```
lar:///ha.ka.ba/mu#O0.Ø1.D3.A0.A0
│                  │  │  │  │  │
│                  │  │  │  │  └ Action: Act, 0 (dormant)
│                  │  │  │  └── Round: Act, 0 (dormant)
│                  │  │  └───── Turn: Decide, 3rd pass
│                  │  └──────── Watch: Orient, 1st pass
│                  └─────────── Week: Observe, 0 (dormant)
│
└── address: WHO/WHERE (structural)
    fragment: WHEN (temporal, per-participant)
```

Ahu waypoints (`#fragment-id`) and Chronometer fragments
(`#O0.Ø1.D3.A0.A0`) do not collide syntactically.
