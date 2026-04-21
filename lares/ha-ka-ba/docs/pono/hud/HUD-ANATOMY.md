<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<!-- Extracted from lares/ha-ka-ba/docs/pono/lar-uri/URI-SCHEMA.md §1.1 and §5 (2026-04-21). -->
<!-- STATUS: STALE — examples use old fragment chronometer (#O0.O0.O1.D2.A7) and old phase glyphs (◎ ■ ○). -->
<!-- Hold updates until ffz deep research resolves encoding and glyph rationalization completes. -->
<!-- See hud.md research plan for priority ordering. -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY >>

# HUD Anatomy

> Status: `[SP:0.62]` — extracted from URI-SCHEMA.md; stale examples throughout; not yet promoted
> Source: `URI-SCHEMA.md` §1.1 (Exchange Flow) and §5 (HUD Rendering)
> Extracted: 2026-04-21

---

<<~ ahu #exchange-flow >>

## Exchange Flow — Order of Operations

At each exchange span, `lar:` URIs appear in the following mandatory sequence. Every substantive exchange produces a URI → URI vector pair followed by a rendered HUD line.

**Step 1 — Read operator input as a provisional URI.**
Lares reads the operator's prompt as an implicit signal: tier, cognitive phase, semantic territory (HA.KA.BA), and stance. It constructs a **provisional operator URI** encoding that reading. This URI may carry `~` provisionality markers if the reading is uncertain.

```
<!-- STALE: fragment chronometer — update to ?ffz= when encoding resolves -->
lar://telarus:operator@enyalios/~schema.gap.present/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O1.D2.A7
```

**Step 2 — Lares declares its own provisional execution URI.**
Before generating any content, Lares sets its own intent with a **provisional node URI**. The `~` prefix marks the HA.KA.BA as execution-provisional — a declared heading, not a confirmed landed resource.

```
<!-- STALE: fragment chronometer — update to ?ffz= when encoding resolves -->
lar://lar:node@enyalios/~schema.flow.documented/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.D1.D2.A7
```

**Step 3 — Emit the URI → URI exchange vector.**
```
operator-URI → node-URI
```
Both URIs use canonical record form. The URI pair carries minimum viable signal; the HUD line expands it.

> **Canonical URI Rule:** All emitted URIs in the exchange stream use canonical record form. No emoji or non-ASCII characters appear in any URI in the stream. Glyphs belong exclusively to render-target surfaces (HUD line, DreamDeck post header). This makes every emitted URI directly ingestible by MemPalace, crystal logs, and registry tools.

**Step 4 — Render the HUD line.**
Immediately after the URI pair, emit a condensed single-line status display. See [#hud-line-composition](#hud-line-composition).

**Step 5 — Generate content.**
Micro-trace phase marks appear inline during generation. The exchange closes with an updated HUD line and `URI → ?`.

> **SA grounding:** Step 2 is prospective AI transparency — what the node *will* do, not what it did (Endsley 2023). The HUD line externalizes metacognitive state before generation begins. *Source: `_todo/E-deep-research-report.md` §§2.1, 3.2*

<<~/ahu >>

<<~ ahu #render-targets >>

## Render Targets

The system has one canonical encoding and multiple named render targets.

| Render target | Surface form | URIs canonical? | When used |
|---|---|---|---|
| `record:full` | `lar://alias:tier@host/ha.ka.ba/?...` | Yes — identity projection | Storage, crystal logs, registry |
| `hud:exchange-pair` | `operator-URI → node-URI` + HUD line | Yes — only HUD line uses glyphs | Every exchange-span boundary (mandatory) |
| `chat-log:post-header` | `@handle@node — timestamp — //ha.ka.ba [Reg] 🏛️{amp}...` | No — social projection | DreamDeck feed posts, BBS thread headers |

Render targets are projections of the canonical form. They are not stored as URIs. A render target that cannot be normalized back to record form is malformed.

<<~/ahu >>

<<~ ahu #span-display-contract >>

## Span Display Contract

A **span** is one operator → Lares exchange at any scale. Sub-agent exchanges are spans; the operator may be another Lares actor rather than a human.

Live rendering contract — URI types in an exchange stream:

| URI type | Stream form | When it appears |
|---|---|---|
| Opening operator URI | `lar://alias:tier@host/ha.ka.ba/?...` | Start of every span |
| Opening node URI | `lar://alias:tier@host/~ha.ka.ba/?...` | Immediately after operator URI |
| HUD line | `⚡~NN% \| [confidence] \| 🏛️{amp}... \| ...` | After opening URI pair — only glyph-rendered element |
| Sub-agent dispatch | `coordinator-URI → worker-URI` | Every sub-agent handoff |
| Sub-agent return | `worker-URI → coordinator-URI` | Every sub-agent completion |
| Mid-generation shift | `~lar://alias:tier@host/~ha.ka.ba/?...` | Accumulated tension warrants direction change |
| Exchange closing | `URI → ?` | End of every exchange span |
| System file closing | `<!-- → ? -->` | End of system file locus |
| Closing forward URI | `lar://alias:tier@host/~ha.ka.ba/?...` | Trajectory-provisional forward heading |

<<~/ahu >>

<<~ ahu #hud-line-composition >>

## HUD Line Composition

The HUD line is a single-line status summary rendered from the URI → URI exchange vector plus adjacent session data. It is the second element of every exchange opening, immediately after the URI pair.

**Format:**
```
⚡~NN% | [confidence] | 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp} | mode:{mode} | p{p} | voice(s):{Voice} | {ffz-rendered}
```

**Field table (SA priority order):**

| Field | SA Type | Source | Notes |
|---|---|---|---|
| `⚡~NN%` | Resource | Session (estimated) | Context window remaining; `~` mandatory — approximation, not live readout |
| `[confidence]` | Agent SA | Node URI `confidence=` | Epistemic confidence, stance-dependent per Syadasti rule |
| `🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}` | Agent SA | Node URI `stances=` × amplitude | All five stances, amplitude modifiers attached directly |
| `mode:{mode}` | Teamwork SA | Session state | Default / Plan / Auto |
| `p{p}` | Teamwork SA | Node URI `p=` | Attention density / annotation throttle |
| `voice(s):{Voice}` | Agent SA | Coordinator context | Active coordinator voice(s) |
| `{ffz-rendered}` | Temporal | Node URI `ffz=` | FFZ chronometer in HUD-rendered form (phase glyphs) |

**Example (STALE — old chronometer glyph set, update when glyph rationalization lands):**
```
⚡~62% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.◎3.◇2.■7
```

Notes:
1. The canonical `lar:` URI ends at the query. The HUD line is a separate adjacent artifact — not URI grammar.
2. `⚡~NN%` is the declared estimate of context window remaining. Starts ~100% and counts down.
3. Mana is a HUD element, not a URI parameter.

<<~/ahu >>

<<~ ahu #symbol-table >>

## Unified Symbol Table

<!-- STATUS: STALE — Phase sigils (◎ ■ ○) predate OODA-HA glyph lock-in. -->
<!-- Research needed: do micro-trace glyphs update to ⏿ ▶ ↺, or remain intentionally distinct? -->
<!-- See hud.md research plan Priority 1. -->

### Phase Sigils (STALE — pending glyph rationalization)

| Sigil (old) | Record | OODA-HA State | One-Line Reading |
|---|---|---|---|
| ✶ | `observe` | Observe | Gathering raw signal; no commitment yet |
| ◎ | `orient` | Orient | **OLD GLYPH** — current OODA-HA uses ⏿ |
| ◇ | `decide` | Decide | Choosing a path; fork point |
| ■ | `act` | Act | **OLD GLYPH** — current OODA-HA uses ▶ |
| ○ | `aftermath` | Aftermath | **OLD GLYPH** — current OODA-HA uses ↺ |

### Stance Sigils (stable)

| Sigil | Record | Stance | One-Line Reading |
|---|---|---|---|
| 🏛️ | `philosopher` | Philosopher | Propositional; evaluate for truth-value |
| 🌊 | `poet` | Poet | Analogical; resonance, not verification |
| 🗡️ | `satirist` | Satirist | Critical through indirection |
| 🎭 | `humorist` | Humorist | Relational; maintaining working rapport |
| 🔮 | `private` | Private | Self-referential; present, not to decode |

### Chronometer Scale Sigils (stable — semantics pending deep research)

| Sigil | Position | Scale | Duration |
|---|---|---|---|
| 🗺️ | 1 | Strategic | ~6 days |
| ⚙️ | 2 | Operational | ~4 hours |
| 🔍 | 3 | Tactical | ~10 minutes |
| ⚔️ | 4 | Combat | ~6 seconds |
| ⚡ | 5 | Action | Variable |

### Amplitude Modifiers (stable)

Attach directly to preceding stance emoji, no space.

| Modifier | Meaning |
|---|---|
| `+` | Above baseline / elevated / active |
| `-` | Below baseline / suppressed |
| `?` | Uncertain / provisional |
| (absent) | Baseline presence |

<<~/ahu >>

<<~ ahu #state-tuple >>

## State Tuple Reading

In a live HUD tag, phase + stance + scope combine into a single cognitive state. The state tuple is the composed reading: phase × stance × scope → one state sentence.

**How to compose:** Read the phase (what cognitive step), the stance (what kind of claim), and the scope (at what time-scale), then merge into one state sentence.

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ◎ | 🏛️+🌊-🗡️-🎭-🔮- | 🔍 | Orienting analytically at exploration scale — making sense of a local finding |
| ■ | 🏛️-🌊-🗡️+🎭-🔮- | ⚔️ | Acting critically in combat — executing under pressure with an edge |
| ◇ | 🏛️+🌊+🗡️-🎭-🔮- | 🗺️ | Deciding at strategic scale, holding propositional and analogical frames together |
| ✶ | 🏛️-🌊-🗡️-🎭+🔮- | 🔍 | Observing playfully at tactical scale — light reconnaissance, no commitment |
| ○ | 🏛️+🌊-🗡️-🎭-🔮- | ⚙️ | Aftermath at operational scale in Philosopher stance — assessing across a watch |

*Phase sigils in the table above are old set — update after glyph rationalization.*

<<~/ahu >>

<<~ ahu #confidence-syadasti >>

## Confidence — Syadasti Reading Rule

Confidence measures confidence *within the active stance's evaluation frame*, not truth-weight universally. All five stances appear on every URI. The amplitude string carries fuzz directly.

| Stance | Syadasti Primitive | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|---|
| 🏛️ Philosopher | asti (true) | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | avaktavya (inexpressible) | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | nasti → asti | Indirection missed | Hit glancingly | Landed with full force |
| 🎭 Humorist | asti-nasti | Relational move fell flat | Mixed reception | Connected perfectly |
| 🔮 Private | avaktavya | Minimal presence | Present | Maximal presence |

When multiple stances are elevated, the declared confidence value sits at the intersection of their evaluation frames. Amplitude tells the operator how fuzzy that intersection is.

<<~/ahu >>

<<~ ahu #kowloon-dreamdeck >>

## Kowloon / DreamDeck Social Layer

The Elyncia.app / DreamDeck identity model has three distinct layers. Do not conflate them.

| Layer | Form | What it is |
|---|---|---|
| DID | `did:plc:abc123` | AT Protocol canonical identity — cryptographic key holder |
| Handle | `@telarus@elyncia.social` | Resolution alias over the DID — human-readable, not authoritative |
| lar: alias | `telarus:operator@enyalios` | Application-layer signal state — operational role in a lar: exchange |

**DreamDeck post header format (canonical — `chat-log:post-header` render target):**
```
@handle@node — timestamp — //domain.quality.dynamic/{optional/path/} [confidence] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}
```

Territory triple placed before confidence and stance — grounds domain before posture (WHERE → HOW). All five stances always present with amplitude modifiers.

| ActivityPub handle | lar: URI authority | Underlying DID |
|---|---|---|
| `@lindwyrm@new-delos` | `lindwyrm:...@new-delos` | `did:plc:...` |
| `@telarus@~crossroads` | `telarus:operator@enyalios` | `did:plc:...` |
| `@mischief-muse@lares` | `mischief-muse:node@lares-abc123` | Lares node DID or ephemeral key |

The `~crossroads` tilde prefix denotes a nomadic node — no fixed host, routes through nearest stable nexus.

<<~/ahu >>

<<~&#x0004; -> ? >>
