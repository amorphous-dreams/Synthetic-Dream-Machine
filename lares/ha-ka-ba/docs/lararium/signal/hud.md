<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/lararium/signal/hud >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/docs/lararium/signal/hud"
file-path = "lares/ha-ka-ba/docs/lararium/signal/hud.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.86
register = "S"
manaoio = 0.88
mana = 0.84
manao = 0.86
role = "docs room for lararium-side HUD line composition, field semantics, and exchange-boundary display rules"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ ahu #meme-header >>

# Lararium Signal — HUD

Not invariant law.
This room holds the live HUD line, field-reading rules, and exchange-boundary display contract.
Micro-trace, provenance, and drift now live in sibling rooms under `lar:///ha.ka.ba/docs/lararium/signal`.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
docs/lararium/signal/hud opens
<<~/ahu >>

<<~ ahu #room-charter >>

## Room Charter

This room keeps the live HUD surface:

- HUD line composition
- field reading rules
- symbol tables that the line needs at glance-speed
- forward commitment at exchange boundaries

Parent-branch framing now lives up at `lar:///ha.ka.ba/docs/lararium/signal`.
Micro-trace now lives at `lar:///ha.ka.ba/docs/lararium/signal/micro-trace`.
Provenance now lives at `lar:///ha.ka.ba/docs/lararium/signal/provenance`.
Drift recovery now lives at `lar:///ha.ka.ba/docs/lararium/signal/drift`.

<<~/ahu >>

<<~ ahu #room-boundaries >>

## Room Boundaries

What belongs here:

- Intent Header format and forward-commitment semantics
- p-band cumulative attention phase model where the HUD line itself needs it
- HAKABA canonical slot mapping and field-order rationale at HUD-line scope
- `lar:` URI scheme anatomy where the HUD line reads it directly
- Tick-span display contract at exchange boundaries
- Authority overlays (`⊙` for operator-authored/constrained state)
- Dual clocks where the HUD line surfaces them
- Unicode glyph vs machine-form rendering at the HUD line
- Header Field Taxonomy where the line needs the field split
- Forward vs backward trace contract at the boundary between HUD and micro-trace
- HUD instrument symbol table

What does not belong here:

- full micro-trace syntax, density bands, handoff protocol, and examples → `lar:///ha.ka.ba/docs/lararium/signal/micro-trace`
- drift recovery protocol pressure → `lar:///ha.ka.ba/docs/lararium/signal/drift`
- provenance, archive witness, and snapshot residue → `lar:///ha.ka.ba/docs/lararium/signal/provenance`
- shared-SA research framing and SA-vs-XAI theory → `lar:///ha.ka.ba/docs/lararium/signal/sa-display`
- Crystal archives integration with mempalace → `../crystal/`

<<~/ahu >>

<<~ ahu #hud-line-composition >>

The HUD line is a single-line status summary rendered from the URI → URI exchange vector plus adjacent session data.
It is the second element of every exchange opening, immediately after the URI pair.

**Format:**

```
⚡~NN% | {ffz-rendered} | 🏛️{tc}🌊{tc}🗡️{tc}🎭{tc}🔮{tc} | voice(s):{Voice(s)} | [target-confidence] | p{p} |
```

`{tc}` = two-character tool-carry string for that stance (e.g. `*!`, `--`, `~?`).

**Field table (SA priority order):**

| Field | SA Type | Source | Notes |
|---|---|---|---|
| `⚡~NN%` | Resource | Session (estimated) | "Mana pool"; Context window remaining; `~` mandatory — approximation, not live readout |
| `{ffz-rendered}` | Temporal | Node URI `ffz=` | FFZ chronometer as five scale positions with action counts |
| `🏛️{tc}🌊{tc}🗡️{tc}🎭{tc}🔮{tc}` | Agent SA | Node URI `stances=` × tool-carry | All five stances; each followed by its two-character tool-carry, no space |
| `voice(s):{Voice}` | Agent SA | Coordinator context | Active coordinator voice(s) |
| `[target-confidence]` | Agent SA | Node URI `confidence=` | Epistemic confidence, stance-dependent per Syadasti rule |
| `p{p}` | Teamwork SA | Node URI `p=` | Attention density / annotation throttle |

**Example:**

```
⚡~62% | ⚡7.⚔️2.🔍3.⚙️0.🗺️0 | 🏛️*!🌊--🗡️--🎭--🔮-- | voice(s):Scryer | [CS:0.80] | p0.5 |
```

Notes:
1. The Intent. The HUD line renders as a separate adjacent artifact — not URI grammar.
2. `⚡~NN%` surfaces the declared estimate of context window remaining. Starts at ~100% and counts down.
3. Mana-pool represents a Maybe Logic style estimate, not a direct measurement.

<<~/ahu >>

<<~ ahu #migrated-hud-anatomy-symbol-table >>

## Migrated — `HUD-ANATOMY.md` — Unified Symbol Table

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#symbol-table`.

### OODA-HA Phase Glyphs

| Glyph | Record | OODA-HA State | One-Line Reading |
|---|---|---|---|
| ✶ | `observe` | Observe | Gathering raw signal; no commitment yet |
| ⏿ | `orient` | Orient | Locating pattern, relation, and pressure |
| ◇ | `decide` | Decide | Choosing a path; fork point |
| ▶ | `act` | Act | Executing the move |
| ⤴ ↺ | `hooko-aftermath` | Hoʻoko & Aftermath | Surface what the act produced, then close the loop |

### Stance Glyphs

| Glyph | Record | Stance | One-Line Reading |
|---|---|---|---|
| 🏛️ | `philosopher` | Philosopher | Propositional; evaluate for truth-value |
| 🌊 | `poet` | Poet | Analogical; resonance, not verification |
| 🗡️ | `satirist` | Satirist | Critical through indirection |
| 🎭 | `humorist` | Humorist | Relational; maintaining working rapport |
| 🔮 | `private` | Private | Self-referential; present, not to decode |

### Chronometer Scale Glyphs

`⚡ Action <-> ⚔️ Combat <-> 🔍 Tactical <-> ⚙️ Operational <-> 🗺️ Strategic`

| Glyphs | Position | Scale | Duration |
|---|---|---|---|
| ⚡ | 1 | Action | Variable |
| ⚔️ | 2 | Combat | ~6 seconds |
| 🔍 | 3 | Tactical | ~10 minutes |
| ⚙️ | 4 | Operational | ~4 hours |
| 🗺️ | 5 | Strategic | ~6 days |

### Tool-Carry Modifiers

Each stance carries zero, one, or two tools from the Four Tools set.
The two-character tool-carry attaches directly to the preceding stance emoji, no space.

**ASCII symbols (URI query encoding and record form):**

| Symbol | Tool | Unicode | Element | Cognitive Pull |
|---|---|---|---|---|
| `*` | Wand | ♣ | Fire / Visual | Ignition, external feed, track |
| `?` | Cup | ♥ | Water / Macro | Sympathy, zoom out, relation |
| `!` | Sword | ♠ | Air / Micro | Discernment, zoom in, detail |
| `~` | Pentacle | ♦ | Earth / Hidden | Ground, internal feed, body |
| `-` | Empty | 🃠 | Orichalcum / Neutral | Empty hand, centered |

**Canonical two-tool configurations:**

| ASCII | Feed × Zoom | Conflict |
|---|---|---|
| `*!` | Visual + Micro | — |
| `*?` | Visual + Macro | — |
| `~!` | Hidden + Micro | — |
| `~?` | Hidden + Macro | — |
| `--` | Neutral — both hands empty | — |
| `*~` | Visual + Hidden | Visibility Conflict (Signal Jam) |
| `?!` | Macro + Micro | Resolution Conflict (Dubious Move) |

Attach as a two-character pair: `🏛️*!` (Philosopher holding Visual + Micro), `🌊--` (Poet holding Centered).
Single-tool carry: `🏛️*-` (Philosopher holding Wand only), `🎭?-` (Humorist holding Cup only), `🗡️!-` (Satirist holding Sword only). Active tool first, empty hand second.
Full invariant: `lar:` URI encodes all five stances as a ten-character string in positional order.

<<~/ahu >>

<<~ ahu #migrated-hud-anatomy-state-tuple >>

## Migrated — `HUD-ANATOMY.md` — State Tuple Reading

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#state-tuple`.

In a live HUD tag, phase + stance + scope combine into a single cognitive state.
The state tuple is the composed reading: phase × stance × scope → one state sentence.

**How to compose:** Read the phase (what cognitive step), the stance (what kind of claim), and the scope (at what time-scale), then merge into one state sentence.

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ⏿ | 🏛️*!🌊--🗡️--🎭--🔮-- | 🔍 | Orienting analytically at exploration scale — Philosopher in Visual + Micro carry, all others empty |
| ▶ | 🏛️--🌊--🗡️~!🎭--🔮-- | ⚔️ | Acting critically in combat — Satirist in Hidden + Micro carry, cutting under pressure |
| ◇ | 🏛️*!🌊*?🗡️--🎭--🔮-- | 🗺️ | Deciding at strategic scale — Philosopher Visual + Micro, Poet Visual + Macro, holding both external frames |
| ✶ | 🏛️--🌊--🗡️--🎭*?🔮-- | 🔍 | Observing playfully at tactical scale — Humorist in Visual + Macro carry, light wide-angle |
| ↺ | 🏛️*!🌊--🗡️--🎭--🔮-- | ⚙️ | Aftermath at operational scale — Philosopher Visual + Micro, assessing detail across a watch |

<<~/ahu >>

<<~ ahu #migrated-hud-anatomy-confidence-syadasti >>

## Migrated — `HUD-ANATOMY.md` — Confidence — Syadasti Reading Rule

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#confidence-syadasti`.

Confidence measures confidence *within the active stance's evaluation frame*, not truth-weight universally.
All five stances appear on every URI.
The amplitude string carries fuzz directly.

| Stance | Syadasti Primitive | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|---|
| 🏛️ Philosopher | asti (true) | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | avaktavya (inexpressible) | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | nasti → asti | Indirection missed | Hit glancingly | Landed with full force |
| 🎭 Humorist | asti-nasti | Relational move fell flat | Mixed reception | Connected perfectly |
| 🔮 Private | avaktavya | Minimal presence | Present | Maximal presence |

When multiple stances are elevated, the declared confidence value sits at the intersection of their evaluation frames.
Amplitude tells the operator how fuzzy that intersection is.

<<~/ahu >>

<<~ ahu #migrated-tagspace-header-field-taxonomy >>

## Migrated — `Signal_HUD_Tagspace-draft.md` — Header Field Taxonomy

Migrated from `lar:///ha.ka.ba/docs/pono/hud/Signal_HUD_Tagspace-draft#header-field-taxonomy`.

Not every header field belongs in the flow.
The live header currently carries:

- Register
- Stance
- Phase
- Scope
- Tagspace Address
- `p`

All header fields are eligible as post-generative annotations.
The question is not *which fields can appear inline* but *what threshold triggers their annotation*.
Thresholds differ by field.

### Phase

Annotation threshold: **low — every meaningful loop transition**

- Annotates the path the span actually took through OODA-HA
- Multiple per chunk when the span crosses more than one phase boundary
- Syntax: `→✶` `→⏿` `→◇` `→▶` `→↺`
- Verbose/debug: completed path summary `[⏿→◇→▶]` at span close

### Stance

Annotation threshold: **medium — genuine local posture shift only**

- Annotates the stance the node actually operated from in that chunk
- Fires when the operative stance diverged from what the header declared or when a genuine shift occurred mid-chunk
- Does not echo header stance; only annotates actual divergence or transition
- Syntax: `→🏛️` `→🌊` `→🗡️` etc.

### Register

Annotation threshold: **high — significant epistemic resolution only (slide model)**

- Post-generative slide: annotates where the claim actually landed epistemically after the span completed
- Fires when the span resolved at a meaningfully different register than the header declared
- Does not override the header mid-span; the header's declared register still governed generation
- `STATE.jsonl` records as `opening_register` and `closure_register` when they differ
- Syntax: `→[CS:0.80]` `→[S:0.65]`

### Scope

Annotation threshold: **structural only — new header required**

- Scope changes are structural; they warrant a full new header, not an inline annotation
- No inline scope annotations in normal use

### Tagspace Address

Annotation threshold: **per-slot, by HAKABA role**

**Ha / `domain` — high threshold (structural)**
- Domain shifts are structural events; a new header is appropriate

**Ka / `quality` — medium threshold (fire-charge annotation)**
- Annotates when the animating charge of the domain shifted noticeably during generation
- Most common Tagspace annotation

**Ba / `dynamic` — medium-low threshold (direction annotation)**
- Annotates when the direction of the span's movement is worth naming after the fact

**Full address echo** — `→//domain.quality.dynamic`
- Use when all three slots shifted or when the semantic position changed enough to warrant a complete coordinate

### p

Annotation threshold: **header-only**

- `p` is a context declaration for the span, not an annotation primitive
- Changes to granularity require a new header

<<~/ahu >>

<<~ ahu #migrated-forward-vs-backward-trace >>

## Migrated — `Signal_HUD_Tagspace-draft.md` — Forward vs Backward Trace

Migrated from `lar:///ha.ka.ba/docs/pono/hud/Signal_HUD_Tagspace-draft#forward-vs-backward-trace`.

> **HUD Design Axiom:** The HUD always tracks Intent state first, then execution flow — in an auditable way. The Intent Header governs as the prospective declaration; the Micro-trace HUD serves as the backward-looking audit trail. Every design decision in this section follows from that separation.

Full headers set intent (prospective).
All in-flow HUD markers work as **post-generative annotations** — they annotate what actually happened in the chunk that just completed, not the next chunk entered.
Multiple inline markers may appear per chunk if multiple signal events occurred.

**The two-layer contract:**

| Layer | Direction | Role |
|---|---|---|
| **Intent Header** | Forward-looking | Declares governing state before the span generates: register, stance, phase, scope, address, `p` |
| **Micro-trace HUD** | Backward-looking (post-generative) | Annotates what actually occurred during and after generation: path taken, stance used, register landed, address confirmed |

**Why this model fits:**

- The header already handles prospective control — adding forward signals to the HUD would duplicate that work
- Post-generative annotation maps directly onto the OTel span-event model
- Multiple annotations per chunk fit naturally: a span may cross a phase boundary, involve a genuine stance shift, and land at a different register than declared
- Test/replay use stays clean: the annotated output and the `STATE.jsonl` record agree; the header's declared state and the HUD's actual-path annotations remain distinct and non-redundant fields

**For Register specifically:** inline register annotation follows a **slide** model — a trailing accuracy marker after span completion, not a correction-in-flight override.
It records where the span actually landed epistemically.
The header's declared register still governed generation; the slide says "it resolved here."
`STATE.jsonl` records both as `opening_register` and `closure_register` when they differ.

<<~/ahu >>

<<~ ahu #migrated-tagspace-in-flow-rendering-options >>

## Migrated — `Signal_HUD_Tagspace-draft.md` — In-Flow Rendering Options

Migrated from `lar:///ha.ka.ba/docs/pono/hud/Signal_HUD_Tagspace-draft#in-flow-rendering-options` and `#rendering-across-p-scale`.

Several rendering models are possible for Micro-trace HUD behavior.

### Option A — phase-only inline markers

The flow only surfaces compact phase transitions.

Pros:

- lowest negentropy cost
- easiest to read
- scales well across all p levels

Cons:

- may hide meaningful stance shifts that would be useful for co-navigation

### Option B — phase plus fire-on-shift

The flow surfaces phase by default and adds a stance signal (`→🏛️`, `→🌊`) only on meaningful local turn.

Pros:

- captures the most operator-relevant local turn information
- still compact; stance signal fires rarely

Cons:

- needs clear rules for what counts as a meaningful local stance shift

### Option C — phase plus selective Tagspace dynamic echo

The flow surfaces phase, and occasionally echoes the Ka-quality or Ba-dynamic portion of the Tagspace Address when local movement needs semantic reinforcement.

Pros:

- integrates HAKABA quality/dynamic signal into visible in-flow cue
- richer movement description without full header leakage

Cons:

- increases complexity
- risks blurring HUD with prose

### Option D — full mini-header leakage

The flow leaks multiple header fields inline.

Pros:

- high auditability

Cons:

- too noisy for default use
- undermines the separation between header and flow

### Current recommended baseline

- header surfaces the full state
- in-flow surfaces **phase** by default using `→[glyph]` syntax
- **stance** may surface on genuine local shift
- all larger structural changes require a new header
- Tagspace Address fields do not leak inline by default
- end-of-span completed path appears in verbose/debug output only

### Rendering Across p Scale

Required rule:

- the meaning of the HUD does not change with `p`
- only the granularity of the trace changes

The semantic reading remains stable:

- header says what state governs the span
- in-flow trace says what local path the span actually took

<<~/ahu >>

<<~ ahu #design-status >>

## Design Status

Current aftermath settlement to preserve:

- URI authority identifies speaker + machine host only; exchange sequencing moved to TickSpan metadata.
- `⊙` is the operator authority mark in the HUD registry.
- Kowloon is one downstream publication sink for exported tick spans, not the canonical state model.

<<~/ahu >>

<<~ ahu #open-decisions >>

## Open Decisions

Q1, Q2, Q3, Q4, Q5 — all locked (see plan Sprint 1a + draft Open Decisions section).
Q6 (closure rendering tiers) — `[S:0.55]` — Researcher task RES-01.
Q16 (Tagspace slot shift notation) — locked.

**New open decisions (from GlassFloor/LIMINAL_PERSPECTIVES.md, 2026-04-08):**

| ID | Question | Register | Sprint | Notes |
|---|---|---|---|---|
| SHD-01 | Rendering portability: do the current HUD symbols render correctly in VS Code terminal, Claude.ai chat, GitHub markdown, and plain text? | `[CS:0.82]` | S0-02 carry → S1 SIG-05 | VS16 variation selectors (`🏛️`, `⚙️`) may render as text. Fallback characters required for any failure. |
| SHD-02 | p-band as cognitive load manager and token budget governor: aviation HUD research (Lee 2024) shows excessive symbology creates attentional tunneling — operator fixates on HUD, misses content beneath it. In a text stream (unlike graphical HUD), cognitive capture cost is proportional to reading time, not visual complexity. p-band must explicitly manage this threshold. Secondary hypothesis: the HUD also saves tokens by preventing wrong-register generation. Both claims are testable. | `[CS:0.80]` | S2 P_BAND_MODEL.md | Cognitive capture framing is research-grounded `[CS:0.80]` (Lee 2024). Token steering is a design assertion `[S:0.65]` requiring empirical test. BKL-05 deferred measurement validates both. Source: E-deep-research-report.md §4.1. |
| SHD-03 | Progressive disclosure / HUD training mode: should the node explain each HUD element as it first appears, then drop the explanation? How does onboarding sequence interact with context window pressure? | `[S:0.65]` | S2 SIG-05 expansion | Cold-start every session means the node re-learns its own instruments from the system prompt each time. Invariant-core Tier 1 caching is the infrastructure answer; progressive disclosure is the operator-facing answer. |

<<~/ahu >>

<<~ ahu #body-close >>
docs/lararium/signal/hud closes
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium/signal >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/micro-trace >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/provenance >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/drift >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/hud >>
<<~ loulou lar:///ha.ka.ba/docs/pono/hud >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~/ahu >>

<<~&#x0004; -> ? >>
