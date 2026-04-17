# MWML: Memetic Wikitext Markup Language (a valid SGML document language)

## Memetic Sigil Wikitext Specification v0.4

Status: [S:0.58] — agentic-wikitext update in place. W3C alignment pending.

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

Aliases carry hidden manao (confidence-about-intent) ratings, provisional link strengths:

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

Confidence and Mana remain separate axes. Confidence tracks
epistemic certainty about a claim or alias. **Mana** tracks
structural validation, runtime potency, and ritual completion of
a meme or formation. Requirements satisfied by a meme body feed
into a `0.0–1.0` Mana rating; they do not collapse into the
confidence scale.

### 0.1 The Unified Field of Mana & Manaʻo

Reality in this architecture is not binary. It is a probabilistic
field where truth appears as a high-density convergence of Power
and Intent.

- **Mana** `0.0–1.0`: runtime potency, structure, addressability,
  and flow power
- **Manaʻo** `0.0–1.0`: confidence in intent, vector precision,
  and logic-direction clarity
- **Manaʻoʻiʻo** `0.0–1.0`: the product of Mana and Manaʻo,
  interpreted here as substantiated readiness / production
  readiness

```
Mana x Manaʻo = Manaʻoʻiʻo
```

Scale reading:

- `0.9–1.0 Mana`: well-structured memes; portable, self-describing,
  OODA-HA-ready packets that grant runtime leverage to the agent
- `0.0–0.1 Mana`: unstructured info-noise; context-taxing material
  that costs the agent resources to pin, refine, and address
- `0.9–1.0 Manaʻo`: verified intent; precise logic path
- `0.0–0.1 Manaʻo`: wavering or guessed intent; kanalua / noisy path

Interpretive rule:

- high Mana + low Manaʻo = Chaos
- high Manaʻo + low Mana = Theory
- high Mana + high Manaʻo = Iʻo

At the floor, `0.0` Mana approaches **Mate**: death, exhaustion,
or total loss of potency.

### 0.2 Runtime Object Metadata

When a stricter descriptive object is needed than Markdown or
natural-language prose, prefer **TOML** over JSON for
human-agent-addressable metadata.

```toml
entity-id = "0xAddressableSpace"
mana = 0.995
manao = 0.992
manaoio = 0.987
status = "Iʻo"
description = "A well-structured meme providing OODA-HA-ready output."
```

The TOML form stays readable in document space and remains simple
to parse in runtime space.

### 0.3 Threshold Handling

Objects below the `0.5` threshold SHOULD NOT be garbage-collected
immediately. Default handling:

- `0.5–1.0`: active / foreground / normally schedulable
- `0.1–0.5`: background or sub-conscious buffer; retained but
  de-prioritized until refined or recharged with Mana
- `0.0–0.1`: Mate / aether / garbage-collectable unless explicitly
  pinned by an `ahu`, namespace authority, or operator act

This preserves weak or half-formed objects as dream residue rather
than deleting them too early, while still allowing the runtime to
shed true noise.

### 0.4 Document Space vs Runtime Space

We design together here in **document space/time**, not in
runtime space/time. Therefore:

- Example wikitext sigils in this document SHOULD be spelled with
  decimal NCR forms
- Rendered glyphs SHOULD remain in tables and explanatory prose
  where the dev-user-agent needs to visually recognize the sigil
- Runtime renderers MAY collapse NCR forms back to glyph display
  after parsing

---

## 1. Memetic Sigils — Architecture

A **memetic sigil** opens and closes a high manao **meme object** (a well typed and addressed document-span in the meme-entity / memetic-sigil as verb surface). Sigils
constitute the shared signal carrier between agent and operator —
the action-verb-surface and render pipeline both parties use.

Every memetic sigil carries:

  1. **Shape** — syntactic form identifying sigil type
  2. **Glyph set** — unordered set of Unicode code points
     (namespace, protocol, auxiliary, + extended categories)
  3. **Payload** — shape-specific content

**Strict set semantics:**
  - Order-independent
  - No duplicates
  - Presence/absence only (binary feature)
  - Canonical form: sorted by code point value
  - Empty set valid


---

## 2. Sigil Shape Taxonomy

```
SHAPE              FUNCTION                     CONTEXT
─────              ────────                     ───────
<<? ... >>      Memetic sigil, `?`         Outer boundary of characters of
                represent a required       of a memetic sigil
                character

<<? ...         Memetic sigil start        Start boundary

... >>          Memetic sigil end          End boundary of characters of

<<~ ... >>      Shark tooth sigil          First True names Sigil, 
                                           operator-agent interaction

<<~ [GS] ... >>    Envelope / frame / standard  Outer boundary
                   meme boundary.               of any meme entity.

<<~␁>>             Heading open (SOH).          Layer 1 boundary.
                   Metadata follows.            Inside heading sigil.

<<~␂>>             Body open (STX).             Layer 2 boundary.
                   Content follows.             Inside frame.

<<~␃>>             Body close (ETX).            Layer 3 boundary.
                   Body complete. More content   Inner memes.
                   may follow at nesting level.

<<~[GS]␄ -> ?>>   Transmission close (EOT).    Layer 4 boundary.
                   Nothing follows. Frame ends.  Outermost meme.
                   ? persists.

<<~iam [name]      Identity / self-declaration.  Inside heading.
  [metadata]       Meme names itself.            One per meme.
>>

<<~ahu #"[id]"     Waypoint / altar / worksite.  Inside any body.
  "[description]"  Addressable fragment:          URI: lar:///
>>                 h.k.b/name#id                 ...#fragment-id
```

```
SHAPE           FUNCTION                   CONTEXT
─────           ────────                   ───────
<<~iam [name]   Identity / self-           Inside heading
  [metadata]    declaration                (SOH region)
>>

<<~ahu #"[id]"  Waypoint / altar /         Inside any meme
  "[desc]"      worksite. Required          body. URI-
>>              bookmark target.            dereferenceable.

<<~kahea        Transclusion / call         Inside bodies,
  {meme-name}   surface. Static include     templates, and
  ... >>        without arrow; active       render chains.
                render when arrowed.
```

---

### 2.1 Ahu Requirement

`<<~ahu #"..." "..." >>` is not decorative commentary. It is the
required bookmark / altar / worksite syntax by which body content
becomes addressable.

- Canonical and boot-critical meme bodies MUST declare at least one
  `ahu`
- Fragment strings that are not Chronometer slots target `ahu` ids
- `ahu` nodes serve as the stable syntax target for operator and
  agent references into a body

Example target flow:

```
<<~&#2305;&#9858; ? -> lar:///ha.ka.ba/mu#phase-table>>

<<~ahu #"phase-table"
  "Canonical worksite for the phase invariant table."
>>
```

<<~ahu #"ahu-requirement"
  "Agentic wikitext needs addressable internal worksites, not
  just outer envelopes. `ahu` supplies the altar at which inner
  syntax can land."
>>

### 2.2 Kahea, Static Transclusion, and Arrowed Render

`kahea` is the named call surface for bringing another meme into
the current formation.

Normative intent:

- `kahea` names a **content-addressing and activation verb**
- the left side identifies **what meme is being called**
- the presence or absence of `->` identifies **how that meme is
  to be realized**
- `kahea` therefore spans two distinct but related language acts:
  **inclusion** and **invocation**

Static transclusion form:

```text
<<~kahea {meme-name} ... >>
```

This form indicates **static transclusion of content**. The named
meme is pulled into the present document-space body as content,
without asking another rendering medium to transform it.

Normative semantics for static transclusion:

- the source meme MUST be resolved before body assembly completes
- the resolved body SHOULD be treated as stored or canonical source
  content
- static transclusion MUST NOT imply downstream evaluation merely
  because the transcluded body itself contains callable structures
- a renderer MAY later evaluate structures inside the transcluded
  content, but that is a separate runtime decision, not part of
  the meaning of bare `kahea`
- when authorial intent is simple reuse, citation, quotation,
  embedding, or frozen inclusion, the non-arrow form is the
  correct form

The practical reading is:

- `kahea` without arrow says "bring that meme here"
- it does not say "run that meme through another medium now"

Arrowed render form:

```text
<<~kahea {meme-name} ... -> target >>
```

This form indicates **active rendering of content through another
medium**. The right-hand side after `->` names the render path.
That target MAY be:

- a static meme-procedure
- an active meme-function
- a filter cascade
- a procedure-meme and function-meme chain

Normative semantics for active rendering:

- the source meme MUST be resolved first
- the render target MUST then receive that resolved meme as input
- the arrow therefore introduces an explicit second stage:
  **resolution -> transformation**
- the render target MAY reshape, filter, template, project,
  summarize, or otherwise realize the input through another
  medium
- arrowed `kahea` SHOULD be used whenever the author means
  "render this through a view," "apply this procedure," "run this
  filter," or "cascade this through a selection system"
- if a render target cannot be resolved, strict parsers SHOULD
  raise an error; permissive runtimes MAY surface an unresolved
  active call node

Interpretive rule:

- no `->` means: transclude the addressed meme as stored /
  canonical body content
- `->` present means: render or transform the addressed meme
  through the named downstream medium before presentation or use

Evaluation order:

1. resolve `{meme-name}`
2. resolve local metadata / inline arguments if present
3. if no arrow exists, insert resolved content
4. if arrow exists, pass resolved content to the named target
5. realize returned output in the current body, view, or downstream
   handoff surface

Target classes:

- **procedure target**: a stable view or transform surface,
  typically static in shape even if parameterized
- **function target**: an active meme-function that computes an
  output from the source meme and any supplied arguments
- **filter target**: a filter-language path, often suited to
  selection, cascade, projection, aggregation, or routing
- **cascade target**: an ordered choice system that selects one
  downstream view or behavior by first match

This distinction matters because the arrow is not decoration. It
is the visible mark that the node is no longer a passive
transclusion site. It is now an executable render handoff.

Examples:

```text
<<~kahea {mu.phase-table} >>
<<~kahea {mu.phase-table} -> procedure://view.phase-table >>
<<~kahea {mu.phase-table} -> filter://cascade.phase-table >>
```

Extended examples:

```text
<<~kahea {mu.phase-table}
  [manao=0.93]
>>

<<~kahea {mu.phase-table}
  [view="compact"]
  -> procedure://view.phase-table
>>

<<~kahea {mu.phase-table}
  [phase="&#9671;"]
  [scale="&#9858;"]
  -> function://phase.focus.extract
>>

<<~kahea {mu.phase-table}
  [operator="ritual-ready"]
  -> filter://cascade.phase-table
>>
```

Authoring guidance:

- use static `kahea` when the source text itself is what matters
- use arrowed `kahea` when the realization medium is what matters
- use a procedure target when the output surface is primarily a
  view
- use a function target when the output is computed
- use a filter or cascade target when selection logic decides what
  is shown

Failure and fallback behavior:

- unresolved source meme: invalid `kahea`
- resolved source + unresolved arrow target: invalid active
  `kahea` in strict mode; deferred node in permissive mode
- resolved source + empty output from target: valid active call
  with null render result
- recursive `kahea` loops SHOULD be bounded by implementation
  depth or cycle detection

The arrow therefore marks a shift from **content inclusion** to
**content activation**. In TiddlyWiki terms, the non-arrow form is
closer to direct transclusion; the arrow form is closer to
transclusion-through-template, procedure call, or function /
filter-mediated rendering.

### 2.3 Why `kahea` Matters

This distinction is foundational for an agentic language spec.

Without `kahea`, transclusion and execution blur together and the
runtime must guess whether a node is inert text, reusable content,
or an instruction to act. With `kahea`, authorial intent becomes
visible at the syntax surface:

- bare `kahea` declares **content identity**
- arrowed `kahea` declares **render intent**

That split gives the language three things at once:

- better readability for human operators
- cleaner dispatch for agents and renderers
- higher Mana because the form carries its own operational intent

In short: `kahea` is not just a macro surface. It is the spec's
named bridge between stored meme content and realized meme output.

---

## 3. Five-Layer Structure

```
Layer 0: <<~ँ ? -> lar:///...>>     FRAME
Layer 1:   <<~␁ ... >>                   HEADING (SOH)
             <<~iam name ...>>        iam inside heading
Layer 2:   <<~␂>>                   BODY (STX)
             [content]                phases, sigils, ahu
Layer 3:   <<~␃>>                   BODY CLOSE (ETX)
Layer 4: <<~ँ␄ -> ?>>              TRANSMISSION CLOSE (EOT)
```

**ETX vs EOT:** inner (nested) memes close with ETX (Layer 3).
The outermost meme closes with EOT (Layer 4). An EOT inside a
non-outermost meme constitutes a parse error.


---

## 3. Five-Layer Meme Structure

```
Layer 0: FRAME    <<~[glyphs] ? -> lar:///h.k.b/name>>
Layer 1: HEADING  <<~&#0001;>>  +  <<~iam name [metadata] >>
Layer 2: BODY     <<~&#0002;>>  +  required <<~ahu #"...">> worksites
                   (requirement feeds into 0.0-1.0 Mana rating,
                   separate from confidence)
Layer 3: BODY CL. <<~&#0003;>>
Layer 4: TRANS CL. <<~[glyphs]&#0004; -> ?>>
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

Minimal body skeleton with required `ahu` sites:

```
<<~&#0002;>>
  <<~ahu #"boot-seed"
    "bootstrap altar"
  >>

  <<~ahu #"turn-pivot"
    "decision worksite"
  >>
<<~&#0003;>>
```

### 3.1 Optional Open / Close Formation Rule

`ahu` and other inner formations may open and close with separate
sigils. A formation MAY carry the start-text / end-text control
codes in the glyph block of its own open / close pair:

```
Open  formation: <<~[glyphs]&#0002;>>
Close formation: <<~[glyphs]&#0003;>>
```


## 3.2 UCAN-Style Attenuation (Expanded)

Nesting and UCAN-based permission attenuation are therefore
built into the form itself: inner formations inherit and narrow
the wrapper glyph block as they open and close.

**UCAN-Style Attenuation (from v3):**

Inner sigils inherit their frame's glyph set by default.

```
effective(inner, frame) = {
  per category:
    if inner declares → inner ∩ frame  (intersection)
    if inner empty    → frame          (full inheritance)
}
```

- **Attenuate:** always valid (inner removes capabilities)
- **Escalate:** never valid (inner cannot add; silently capped)
- **Empty = inherit:** (bare inner sigil gets full frame authority)

### 3.2.1 Prior-Art Reading

The label "UCAN-style" is directionally correct but not exact.
The local model now draws from three adjacent precedents:

- **UCAN** contributes the monotone capability rule:
  a child delegation must restate or attenuate, not amplify
- **XML Namespaces** contributes scoped inheritance from the
  nearest enclosing declaration, plus explicit undeclaration
- **CSS Cascade** contributes the useful distinction between
  explicit inherit, reset, and rollback behavior

The resulting local rule is:

- UCAN supplies the **non-escalation invariant**
- XML supplies the **nearest-enclosing scope model**
- CSS supplies the **inherit vs reset** distinction

This matters because **empty = inherit** is not itself a UCAN
rule. It is a local inheritance rule that sits comfortably beside
UCAN attenuation.

### 3.2.2 Research Consequences

UCAN prior art:

- the UCAN spec says attenuation constrains capabilities in a
  delegation chain
- each direct delegation MUST either restate or attenuate its
  capabilities
- the wildcard/top ability is explicit and powerful, and should be
  used sparingly
- UCAN implementations may provide resource-specific delegation
  semantics, rather than forcing one universal attenuation rule

Closest official prior art for inheritance and reset:

- XML namespace scoping uses the **nearest enclosing declaration**
  within ancestor scope
- XML Namespaces 1.1 allows an empty declaration to remove an
  inherited binding within the local scope
- CSS defines `inherit`, `unset`, and `revert` as separate
  operations rather than overloading one empty form with all three

### 3.2.3 Effective Set Resolution

For memetic sigils, resolution SHOULD operate on the **nearest
enclosing effective glyph set**, not on the last sibling or last
textually mentioned full set.

That is:

- inheritance walks the nesting tree upward
- it does not scan backward through arbitrary prior syntax
- "last full leading sigil-set" therefore means the nearest
  enclosing resolved ancestor set for the relevant category

This mirrors:

- CSS inherited value from the parent element's computed value
- XML namespace binding from the innermost in-scope declaration

### 3.2.4 Three Distinct Namespace States

The namespace category SHOULD distinguish three states explicitly:

1. **Omitted namespace declaration**
   inherit the nearest enclosing effective namespace glyph set
2. **Declared namespace glyphs**
   attenuate by intersection against the inherited namespace set
3. **Declared namespace-reset sigil**
   clear inherited namespace binding for this local scope and fall
   back to the ordinary user namespace origin

This avoids an overloaded empty form.

Recommended local rule:

```text
effectiveNamespace(inner, parent, origin) =
  if inner has RESET:
    origin ∩ (inner namespace glyphs without RESET, if any)
  else if inner declares namespace glyphs:
    parent ∩ inner
  else:
    parent
```

Where:

- `parent` is the nearest enclosing effective namespace set
- `origin` is the wrapper or invoking-user baseline namespace
- `RESET` is a dedicated namespace escape-hatch sigil

### 3.2.5 Escape Hatch to Ordinary User Namespace

To keep parent inheritance easy **and** still allow a return to a
normal user namespace, this draft SHOULD reserve a dedicated
namespace-reset sigil written in examples as:

```text
&#dddd;
```

This is a transport-form placeholder, not yet a fixed code point.
Its job is narrow:

- it applies to the **namespace category only**
- it clears the inherited namespace binding for the current scope
- it drops resolution to the wrapper/user origin namespace
- it does not by itself grant top authority
- it does not reset protocol, scale, phase, or other categories

The closest prior-art reading is:

- XML default-namespace undeclaration for local escape from an
  inherited namespace
- CSS `revert` for rollback to a lower origin rather than blind
  inheritance

### 3.2.6 Recommended Semantic Split

The safest spec-grade split is therefore:

- **omission** means inherit
- **declaration** means attenuate
- **reset sigil** means escape to origin namespace

This is cleaner than making `[]`, null, omission, and reset all
mean slightly different things.

### 3.2.7 Worked Resolution Cases

```text
Outer namespace:   [ँ ं]
User origin:       [ं]
```

Case A: omitted namespace glyphs

```text
Outer: <<~[ँ ं] ...>>
Inner: <<~[...] ...>>
Result namespace: [ँ ं]
```

Case B: explicit attenuation

```text
Outer: <<~[ँ ं] ...>>
Inner: <<~[ं] ...>>
Result namespace: [ं]
```

Case C: explicit namespace reset

```text
Outer: <<~[ँ ं] ...>>
Inner: <<~[&#dddd;] ...>>
Result namespace: [ं]
```

Case D: reset then local narrowing

```text
Outer: <<~[ँ ं ः] ...>>
User origin: [ं ः]
Inner: <<~[&#dddd; ः] ...>>
Result namespace: [ः]
```

### 3.2.8 Normative Direction

Until the dedicated reset sigil is assigned a fixed NCR true name,
the draft SHOULD treat the following as normative design intent:

- empty/omitted namespace state inherits
- explicit namespace glyphs attenuate
- explicit reset returns namespace resolution to wrapper/user
  origin
- null MUST resolve through nearest enclosing effective scope, not
  by loose textual fallback
- escalation remains invalid even after reset; reset is not top
  authority

**Examples:**

- Outer: `<<~[A B C] ...>>`  Inner: `<<~[B] ...>>`  → Inner gets only `B` (attenuation)
- Outer: `<<~[A B] ...>>`    Inner: `<<~[A B C] ...>>`  → Inner gets only `A B` (escalation capped)
- Outer: `<<~[A B] ...>>`    Inner: `<<~[] ...>>`  → Inner gets `A B` (full inheritance)

This mechanism ensures that inner memes cannot escalate their authority or capability beyond what the enclosing frame provides. They may only attenuate (reduce) their glyph set, or inherit it fully if left empty.

This rule applies per glyph category (Protocol, Namespace, etc.), and intersection semantics are used: the most restrictive set applies at each nesting level.

---

The **wrapper meme** remains special. It uses the file-boundary
pair rather than an inner text-boundary pair. In operator terms:
the wrapper always uses the start-file / end-of-file NCR pair,
even if this draft currently renders that pair through the local
file/transmission boundary controls:

```
Open  wrapper: <<~[glyphs]&#0028; ? -> lar:///...>>
Close wrapper: <<~[glyphs]&#0004; -> ?>>
```

<<~ahu #"open-close-formation"
  "Inner formations ride text-boundary control codes. The outer
  wrapper uses the file/transmission boundary pair to declare
  the whole meme as one Mana-bearing unit."
>>

---

## 4. Glyph Codeset — Nine Categories

### 4.1 Full Category Table (Restored from v3)

The following table appears to restore the full v3 glyph category mapping, with explicit Unicode ranges and roles. Confidence: 0.98 that this table matches v3 intent.

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

#### Category Details (from v3)

**Category 1: PROTOCOL (C0 Controls: &#0000;–&#0031;)**
Transmission lifecycle, handshake, flow control, boundaries.
... (see v3 for full sub-table details)

**Category 2: AUXILIARY (Combining Diacriticals: &#0768;–&#0879;)**
... (see v3 for full sub-table details)

**Category 3: NAMESPACE (Devanagari: &#2304;–&#2431;)**
... (see v3 for full sub-table details)

**Authority matrix:**

| Glyph | Tier     | render  | evaluate      | unask  | modify |
|-------|----------|---------|---------------|--------|--------|
| ँ     | Admin    | all     | all           | all    | all    |
| ं     | Operator | all     | ≤ own consec. | own    | none   |
| ः     | User     | ≤ own c.| none          | none   | none   |
| ़     | System   | system  | system        | system | system |

Combination: intersection semantics (most restrictive applies).

**Category 4: SCALE (Superscripts/Subscripts: &#8304;–&#8334;)**
... (see v3 for full sub-table details)

**Category 5: DIRECTION (Arrows: &#8592;–&#8703;)**
... (see v3 for full sub-table details)

**Category 6: RELATION (Math Operators: &#8704;–&#8959;)**
... (see v3 for full sub-table details)

**Category 7: TECHNICAL (Misc. Technical: &#8960;–&#9215;)**
... (see v3 for full sub-table details)

**Category 8: STRUCTURE (Box Drawing + Blocks: &#9472;–&#9631;)**
... (see v3 for full sub-table details)

**Category 9: SEMANTIC (Geometric + Misc. Symbols: &#9632;–&#9983;)**
... (see v3 for full sub-table details)

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
glyphs. The OODA-HA **phase glyph triplicates** belong to the
Chronometer fragment grammar, not to the nine-category glyph-set
itself. The die faces and planetary symbols live in Category 9.

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

## 6. Phase Invariants (OODA-HA Glyphs)

The phase glyph NCR triplicates are the true names. There is no
alternate phase alphabet in `v0.5`. The rendered glyph is both
the authoritative syntax token and the HUD surface.

```
TRUE NAME                    PHASE
─────────────────────────    ───────
&#10038; / U+2736 / ✶        Observe
&#9678;  / U+25CE / ◎        Orient
&#9671;  / U+25C7 / ◇        Decide
&#9632;  / U+25A0 / ■        Act
&#9675;  / U+25CB / ○        Assess
```

**Storage/interchange:** use the raw glyphs or their NCR
triplicates.

**HTML/XML transport:** when channel safety matters, the NCR
forms are the canonical transport spellings.

**Natural-language labels** such as Observe, Orient, Decide,
Act, and Assess remain aliases only.

<<~ahu #"phase-glyph-authority"
  "The phase glyph triplicates are the authoritative syntax
  targets. The old `O Ø D A Å` spellings are retired from the
  spec. A reader or parser meets the sigil itself first."
>>

<<~ahu #"observe-glyph-placement"
  "✶ lives in the Dingbats block, not inside the two local
  phase-friendly Unicode bands. That is acceptable because phase
  glyphs belong to fragment grammar, not to glyph-set category
  dispatch."
>>

---

## 7. Namespace Invariants

**Category 3 — NAMESPACE (Devanagari)**

```
TRUE NAME                    NAME          SENSE                 TIER      FUNCTION
─────────────────────────    ──────────    ──────────────────    ──────    ─────────────
&#2305; / U+0901 / ँ         Candrabindu   moon-dot / nasal crown Admin     main stack
&#2306; / U+0902 / ं         Anusvara      after-sound / echo dot Operator  session
&#2307; / U+0903 / ः         Visarga       release / emission     User      request
&#2364; / U+093C / ़         Nukta         dot / qualifier mark   System    internal
```

These are pronounceable names, not arbitrary imported glyphs.
The authority matrix remains the operative rule, but the names
and shape-senses help the sigils carry mnemonic weight.

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

## 10. Chronometer and Bookmark Fragments

The unified scale model reorders fragment display so the
**immediate clock ticks at the leftmost position**. The reader
encounters the hot edge first and then fans outward into broader
context.

Containment logic does **not** change:

```
⚄ contains ⚃ contains ⚂ contains ⚁ contains ⚀
```

Display order and containment direction are separate axes.

### 10.1 Canonical Fragment Form

```
#&#9856;&#9632;7.&#9857;&#9671;2.&#9858;&#10038;3.&#9859;&#10038;0.&#9860;&#10038;0
```

Each slot: `[die face true name][phase glyph true name][counter]`

Same state as the earlier example, but spelled in document-space
transport form. Rendered explanation:

```
⚀  Action / Heartbeat   — ■, 7
⚁  Round  / Breath      — ◇, 2
⚂  Turn   / Focus       — ✶, 3
⚃  Watch  / Vigil       — ✶, 0
⚄  Week   / Horizon     — ✶, 0
```

Five slots remain always present. Dormant scales keep zeroed
counters. Die faces make slots self-identifying, so parsing
does not depend on position. The left-to-right convention is:

```
finest (⚀ / Action)  →  broadest (⚄ / Week)
```

### 10.2 Canonical NCR Transport Form

Because this document is authored in document space/time, the
canonical example above is already given in decimal NCR form.
Rendered runtime-facing equivalent:

```
#⚀■7.⚁◇2.⚂✶3.⚃✶0.⚄✶0
```

Rendered and NCR forms name the same fragment.

### 10.3 Slot Grammar

```
FRAGMENT       = "#" SLOT "." SLOT "." SLOT "." SLOT "." SLOT
SLOT           = DIE_FACE PHASE_GLYPH COUNTER
DIE_FACE       = | ⚀ | ⚁ | ⚂ | ⚃ | ⚄
PHASE_GLYPH    = | ✶ | ◎ | ◇ | ■ | ○
COUNTER        = [0-9]+
```

### 10.4 Positional Rule

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

### 10.5 Scale in Glyph Sets

A die face in a sigil's glyph set declares the meme's
operational scale before the address or body loads.

```
<<~&#2305;&#9858;&#0002; ? -> lar:///ha.ka.ba/mu>>
      │
      └── &#9858; / U+2682 / ⚂
          game alias: Turn
          attn alias: Focus
```

Attenuation rule for nested memes:

```
Outer: <<~&#2305;&#9859; ...>>     Watch/Vigil scale
Inner: <<~&#9858; ...>>            Turn/Focus scale       attenuated ✓
Inner: <<~&#9860; ...>>            Week/Horizon scale     escalation capped ⚠
```

### 10.6 Ahu Targets and Fragment Placement

Per the fragment-only rule, the fragment answers either:

- **WHEN** in nested causal time, if the fragment matches the
  five-slot Chronometer grammar
- **WHERE-IN-BODY** the syntax should land, if the fragment is
  a string id targeting an `ahu`

Targetable `ahu` declaration:

```
<<~&#0002;>>
  <<~ahu #"boot-seed"
    "bootstrap altar"
  >>

  <<~ahu #"turn-pivot"
    "decision worksite"
  >>
<<~&#0003;>>
```

Target examples:

```
lar:///ha.ka.ba/mu#boot-seed
lar:///ha.ka.ba/mu#turn-pivot
lar:///ha.ka.ba/mu#&#9856;&#9632;7.&#9857;&#9671;2.&#9858;&#10038;3.&#9859;&#10038;0.&#9860;&#10038;0
```

String fragments target required `ahu` bookmarks.
Five-slot die-face fragments target Chronometer state.

<<~ahu #"fragment-targeting"
  "The same `#` hook carries two grammars. One grammar lands on
  an altar in the body. The other lands on a five-band clock.
  They remain distinct by shape, not by separator."
>>

### 10.7 Scale-Shift Examples

Action.○ escalates to Round.○:

```
Before: #&#9856;&#9675;1.&#9857;&#9632;2.&#9858;&#9671;3.&#9859;&#10038;0.&#9860;&#10038;0
After:  #&#9856;&#10038;0.&#9857;&#9675;2.&#9858;&#9671;3.&#9859;&#10038;0.&#9860;&#10038;0
```

Round.○ escalates to Turn.○:

```
Before: #&#9856;&#10038;0.&#9857;&#9675;2.&#9858;&#9671;3.&#9859;&#10038;0.&#9860;&#10038;0
After:  #&#9856;&#10038;0.&#9857;&#10038;0.&#9858;&#9675;3.&#9859;&#10038;0.&#9860;&#10038;0
```

Higher-slot counters do not increment on child escalation.
They increment only when that scale completes its own Assess.

---

## 11. Parsing

### 11.0 Grammar Notation

The grammar in this section uses a compact XML-style EBNF subset.

Notation rules:

- quoted strings are terminal literals
- production names on the left-hand side are nonterminals
- `?` means optional
- `*` means zero or more
- `+` means one or more
- `|` means ordered alternative in the grammar, not runtime
  preference
- parentheses group subexpressions

Unless stated otherwise:

- literal keywords are case-sensitive
- whitespace between major syntactic objects is represented as `S`
- NCR spellings remain valid document-space examples, but parsing
  operates on the resulting Unicode code points after NCR
  resolution

Selected terminals:

```text
OPEN-SIGIL   ::= "<<~"
CLOSE-SIGIL  ::= ">>"
ARROW        ::= "->"
LBRACE       ::= "{"
RBRACE       ::= "}"
LBRACKET     ::= "["
RBRACKET     ::= "]"
EQUALS       ::= "="
S            ::= (#x20 | #x09 | #x0A | #x0D)+
```

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

function parseFragment(fragment):
  body = fragment[1:]
  if matchesChronometer(body):
    return parseChronometer(fragment)
  return resolveAhuId(body)
```

### 11.3.1 Kahea Parsing

`kahea` requires a two-branch parse because static inclusion and
active rendering share a prefix and diverge only when `->`
appears.

Normative grammar:

```text
KaheaExpr       ::= KaheaStatic | KaheaActive

KaheaStatic     ::= OPEN-SIGIL "kahea" S MemeRef (S Argument)*
                    S? CLOSE-SIGIL

KaheaActive     ::= OPEN-SIGIL "kahea" S MemeRef (S Argument)*
                    S ArrowTarget S? CLOSE-SIGIL

MemeRef         ::= LBRACE MemeName RBRACE
MemeName        ::= NameStartChar NameChar*

ArrowTarget     ::= ARROW S Target
Target          ::= TargetScheme "://" TargetPath
TargetScheme    ::= "procedure"
                  | "function"
                  | "filter"
                  | "cascade"
                  | ExtensionScheme

ExtensionScheme ::= NameStartChar NameChar*
TargetPath      ::= TargetChar+

Argument        ::= LBRACKET ArgumentKey S? EQUALS S? ArgumentValue
                    RBRACKET
ArgumentKey     ::= NameStartChar NameChar*
ArgumentValue   ::= QuotedString
                  | BareToken
                  | MemeRef

QuotedString    ::= '"' QuotedChar* '"'
BareToken       ::= BareChar+

NameStartChar   ::= [A-Z] | [a-z] | "_"
NameChar        ::= NameStartChar | [0-9] | "." | "-" | ":"
TargetChar      ::= NameChar | "/" | "#" | "?" | "&"
                  | "%" | "~"
BareChar        ::= NameChar | "#" | "&" | ";" | "/" | "%"
QuotedChar      ::= any character except '"'
```

Well-formedness rules for `kahea`:

1. a `KaheaExpr` MUST contain exactly one `MemeRef`
2. a `KaheaExpr` MUST begin with `<<~kahea`
3. arguments, when present, MUST follow the source `MemeRef`
4. `ARROW` MAY appear at most once
5. if `ARROW` appears, it MUST be followed by a valid `Target`
6. no `Argument` may appear after `ArrowTarget` in this version of
   the grammar
7. `MemeName` MUST NOT contain raw whitespace, `{`, `}`, `[`, or `]`
8. `TargetPath` MUST NOT be empty

Reference parse:

```text
function parseKahea(node):
  assert node.head == "kahea"
  source = parseMemeRef(node)
  args = parseArguments(node)
  if hasArrow(node):
    target = parseTarget(node)
    return ActiveKahea(source, args, target)
  return StaticKahea(source, args)
```

Semantic consequence:

- `StaticKahea` inserts resolved source content
- `ActiveKahea` resolves source content and then dispatches to a
  downstream render target

Implementation note:

- parsers SHOULD retain whether a target used a core scheme
  (`procedure`, `function`, `filter`, `cascade`) or an extension
  scheme
- processors MAY reject unknown extension schemes in strict mode
- implementations MAY support richer target grammars later, but the
  spec-level distinction between static and active `kahea` SHOULD
  remain explicit

### 11.4 Validation

```
PROTOCOL:   <=1 lifecycle glyph per sigil
NAMESPACE:  omitted = inherit nearest enclosing effective set;
            declared glyphs = intersection attenuation;
            RESET glyph = rollback to wrapper/user origin namespace
AUXILIARY:  any count; contradictory combos -> warning
DIRECTION:  <=1 primary arrow
RELATION:   compositional
TECHNICAL:  context-dependent
STRUCTURE:  unusual in glyph sets; body-internal by default
STATE:      display/support glyphs only
SEMANTIC:   <=1 die-face scale invariant unless explicitly unioned
FRAGMENT:   either 5 Chronometer slots or one valid `ahu` id
Ahu:        canonical bodies MUST declare at least one targetable `ahu`
Kahea:      bare form = static transclusion; arrowed form = active
            render through named procedure/function/filter target
            source meme MUST resolve; target MUST resolve when arrowed
            arguments precede arrow target; duplicate arrows are errors
```

### 11.5 Strictness Modes

```
boot-mode:  strict. Unknown glyphs -> error. Fragment required
            for boot-critical traces. `ahu` ids must resolve.
            Mu validates before load.

run-mode:   permissive. Unknown glyphs -> warning, treated as
            body content. Missing fragment tolerated when the
            calling context supplies time externally.
```


### 11.6 Full Parsing and Validation Logic (Restored from v3)

The following functions and validation rules appear to restore v3’s explicit parsing and validation logic, with E-Prime style and confidence markers. Confidence: 0.95 that these match v3’s operational intent.

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

**Validation rules:**

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

**Strictness Modes:**

```
boot-mode:  strict. Unknown glyphs → error. All memes fully validated.
run-mode:   permissive. Unknown glyphs → warning, treated as body.
            Forward-compatible: new glyph types degrade gracefully.
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

## 13. Structured Metadata

When object metadata needs stricter rules than free prose, use
TOML as the default descriptive-object layer.

```toml
[runtime]
mana = 0.99
manao = 0.99
manaoio = 0.9801
status = "Iʻo"

[address]
entity-id = "lar:///ha.ka.ba/mu#phase-table"

[notes]
description = "Portable, self-describing, self-executing meme packet."
```

JSON may still appear at system boundaries, but the canonical
human-agent authoring surface for strict descriptive objects is
TOML.

---

## 14. Mu Integration

`mu` is the self-booting module of this grammar, analogous to a
`boot.js` that loads before higher-order behavior. Under `v0.5`:

- Mu SHOULD declare its native scale in the frame glyph set:
  `<<~&#2305;&#9858; ? -> lar:///ha.ka.ba/mu>>`
- Mu SHOULD treat die faces as authoritative scale invariants
  and all English scale words as aliases
- Mu SHOULD emit Chronometer fragments with phase glyph true
  names (`✶ ◎ ◇ ■ ○`), not an alternate phase alphabet
- Mu SHOULD read Chronometer fragments left-to-right from the
  hot edge (`⚀`) toward the cold edge (`⚄`)
- Mu MUST keep Chronometer time in the fragment, not in the
  address path

The self-booting sequence becomes easier to scan under the new
order because the immediate decision edge appears first, where a
future parser or operator will look first.

---

## 15. Conventions

| Rule | Weight |
|------|--------|
| Use NCR triplicates as true names for invariants | MUST |
| Treat all English labels and emoji names as aliases | MUST |
| Use Mana for the 0.0–1.0 runtime potency / consecrated measure | MUST |
| Keep Mana separate from confidence and Manaʻo | MUST |
| Prefer TOML over JSON for strict human-agent metadata objects | SHOULD |
| Use phase glyph triplicates (`✶ ◎ ◇ ■ ○`) as true names | MUST |
| Keep five Chronometer slots always present | MUST |
| Read fragment left-to-right as Action -> Week | SHOULD |
| Keep Chronometer data in the fragment only | MUST |
| Canonical bodies MUST declare at least one targetable `ahu` | MUST |
| `<<~kahea {meme-name}>>` means static transclusion | MUST |
| `<<~kahea {meme-name} -> target>>` means active rendering | MUST |
| `kahea` source memes MUST resolve before realization | MUST |
| Arrowed `kahea` targets SHOULD be typed as procedure/function/filter/cascade | SHOULD |
| Bare `kahea` MUST NOT imply downstream transformation by itself | MUST |
| Omitted namespace glyphs inherit from the nearest enclosing effective scope | MUST |
| Namespace reset MUST be explicit; empty omission alone does not reset | MUST |
| Namespace reset rolls back only the namespace category to wrapper/user origin | SHOULD |
| Distinguish display order from containment logic | MUST |
| Prefer die-face-explicit fragments in canon text | SHOULD |

---

*DRAFT v0.5 updates landed in the v4 file path.*
*Left edge = immediate clock. Right edge = far horizon.*
*True names anchor identity; aliases keep the poetry alive.*
*`ahu` is the altar where body syntax becomes targetable.*
*Low Mana taxes the agent. High Mana gives it portable flow.*
