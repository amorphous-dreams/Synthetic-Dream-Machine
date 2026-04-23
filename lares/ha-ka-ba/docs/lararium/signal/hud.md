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
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
role = "docs room for lararium-side HUD witness, folded micro-trace behavior, and signal lineage residue"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ ahu #meme-header >>

# Lararium Signal — HUD

Not invariant law.
This room holds recovered HUD witness, folded micro-trace behavior, and lineage pressure behind the old prompt stack.
Settled branch-level signal claims now live at `lar:///ha.ka.ba/docs/lararium/signal`.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
docs/lararium/signal/hud opens
<<~/ahu >>

<<~ ahu #room-charter >>

## Room Charter

This room keeps the narrower HUD witness bundle:

- recovered HUD witness and lineage residue
- folded lararium-side micro-trace behavior
- promotion, snapshot, and aftermath material that still pressures outward

Parent-branch framing now lives up at `lar:///ha.ka.ba/docs/lararium/signal`, including the temporary staging ahu that holds overlap lifted out of this room.

<<~/ahu >>

<<~ ahu #room-boundaries >>

## Room Boundaries

What belongs here:

- Intent Header format and forward-commitment semantics
- Micro-trace HUD annotation model (phase, stance, register, Tagspace slots)
- p-band cumulative attention phase model (five bands, OP-02 ruling)
- HAKABA canonical slot mapping (Ha/Ka/Ba) and field-order rationale
- `lar:` URI scheme anatomy (authority, path, query, fragment/chronometer)
- Tick-span display contract (`start_uri` -> `attractor_uri` ... `end_uri`)
- Authority overlays (`⊙` for operator-authored/constrained state)
- Dual clocks: RFC 3339 wall time plus chronometer + diegetic calendar reference
- Sigil vs machine form rendering (projection table)
- Forward vs backward trace contract
- Header Field Taxonomy (per-field annotation thresholds)
- Working Defaults (HUD layer — from `../../_todo/core/Signal_HUD_Tagspace-draft.md`)
- **HUD instrument symbol table** — all 15 symbols across three sets (5 stance emoji, 5 scope prefix emoji, 5 phase glyphs) with keyword mappings, stability guarantees, and platform rendering notes. These are locked instrument markings: changing any of them is a breaking change to the HUD, not a schema evolution. Table lives in SIG-05 (`HAKABA_REFERENCE.md`) and is referenced from here.
- **Rendering portability baseline** — confirmation that all 15 HUD symbols display correctly in VS Code terminal, Claude.ai chat, GitHub markdown preview, and plain text fallback. Emoji using VS16 variation selectors (🏛️ `U+1F3DB U+FE0F`, ⚙️ `U+2699 U+FE0F`) may render as text glyphs in some environments; fallback characters documented for each failure case.
- **Progressive disclosure model** — which HUD elements are mandatory on first encounter, which surface on demand, which remain dormant until operator activates. A new operator sees 7 encoded channels in the first substantive response with no training program; this spec defines the onboarding exposure sequence.
- **SAOD design process** — Sprint 2 adopts Endsley's Situation Awareness Oriented Design three-phase methodology (SA Requirements Analysis → SA-Oriented Design Principles → SA Measurement and Validation) as the governing design process for the HUD format. SA Requirements Analysis (what information operators need at each SA level for each goal, per GDTA) informs all signal/ deliverables. Methodology lives in INTENT_HEADER.md (S2) but applies across the subdomain. This is not inventing a new methodology — SAOD is the validated HCI methodology for exactly this class of shared SA instrument.

What does not belong here:

- Crystal STATE.jsonl schema → `../crystal/`
- Deterministic compiler pipeline → `../compiler/`
- `lar:` URI registry / resolver → `../registry/`

<<~/ahu >>

<<~ ahu #migrated-hud-anatomy-hud-line-composition >>

## Migrated — `HUD-ANATOMY.md` — HUD Line Composition

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#hud-line-composition`.

The HUD line is a single-line status summary rendered from the URI → URI exchange vector plus adjacent session data.
It is the second element of every exchange opening, immediately after the URI pair.

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

<<~ ahu #migrated-hud-anatomy-symbol-table >>

## Migrated — `HUD-ANATOMY.md` — Unified Symbol Table

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#symbol-table`.

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

<<~ ahu #migrated-hud-anatomy-state-tuple >>

## Migrated — `HUD-ANATOMY.md` — State Tuple Reading

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#state-tuple`.

In a live HUD tag, phase + stance + scope combine into a single cognitive state.
The state tuple is the composed reading: phase × stance × scope → one state sentence.

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

<<~ ahu #provenance >>

## Provenance

Strong witnesses recur in:

- `prompts/Lares_Preferences.system-prompt.md`
- `prompts/core/Lares_Operations.core.md`
- `prompts/Lares_Kernel.compressed.md`
- `platform-build/Lares_Kernel_Claude.snapshot.md`
- `staging/pre-reorder-2026-04-07/Lares_Kernel.snapshot.md`
- `staging/pre-reorder-2026-04-07/Lares_Operations.snapshot.md`
- `docs/signal/README.md`
- `docs/crystal/README.md`
- `docs/crystal/session/SESSION_CRYSTAL_20260408.md`
- archived root `AGENTS` witness text

<<~/ahu >>

<<~ ahu #witness-pressure >>

## Witness Pressure

Archive residue here still carries several pressure-lines that matter:

- mismatch recovery when declared intent diverges from actual output
- exchange-boundary scope ruling for HUD versus internal micro-trace events
- promotion-history witness showing what parts of the old stack already hardened into spec

This room matters because the old stack repeatedly treats hidden state transitions as a trust problem.
The remaining task here is not to restate the root contract, but to preserve and separate the witness strands that still pressure outward.

<<~/ahu >>

<<~ ahu #archive-collection-residue >>

## Archive Collection Residue

✶ search the docs tree for surviving HUD / signal witness matter outside the new lararium signal branch
⏿ sort the residue by pressure-family: exchange-boundary loop, cockpit/shared-mental-model framing, SA-vs-XAI split, drift recovery, promotion history
◇ keep this pass additive and low-interpretation; collect the archive voice before condensing it
▶ place verbatim witness text in separate ahu blocks so later refinement can consume one strand at a time
⤴ compare recovered archive pressure against the live `lararium/hud`, `docs/pono/hud`, and `lar-uri` surfaces
↺ leave the room fuller in witness matter, not yet tighter in doctrine

<<~/ahu >>

<<~ ahu #micro-trace-strand >>

## Micro-trace Strand

This room now carries the lararium-side micro-trace strand directly.

- domain: `lares/signal/`
- posture: backward-looking in-flow annotation layer
- status: `[CS:0.80]` 🏛️ — promoted from SIG-04 draft; operator-confirmed 2026-04-08
- source lineage: `builds.stuffed.failed/agents/Lares_Preferences.md` § Signal HUD, confirmed in session
- backlog links: `lares/sprints/SPRINT_ROADMAP_1_4.md`, `lares/sprints/SPRINT_ROADMAP_1_5.md`

<<~/ahu >>

<<~ ahu #micro-trace-design-intent >>

## Micro-trace — Design Intent

The micro-trace HUD is the backward-looking annotation layer of the Signal HUD system.
It marks where the governed response actually changed state during generation.
It does not serve as a prospective commitment.

Contrast:

| Layer | Direction | Format | Fires |
|---|---|---|---|
| Intent Header | Prospective | `//domain.quality.dynamic [R] 🏛️ ◇ @r` | Before generation |
| Micro-trace HUD | Retrospective | `→◇` `→■` `→○` inline | After or during generation |
| Exchange HUD line | Boundary | `⚡ ~NN% \| mode \| ...` | Opening and closing of operator exchange |
| Sub-agent handoff URI pair | Boundary | `node-URI → node-URI` | At unloggable sub-agent boundary |

The micro-trace does not replace the exchange HUD pair.
It annotates the inside of a generative span.

<<~/ahu >>

<<~ ahu #micro-trace-syntax >>

## Micro-trace — Syntax

### Inline phase transitions

Emit at the point of transition, not predicted in advance:

```
→✶   →◎   →◇   →■   →○
```

### Stance shift

Fire only on a genuine local stance shift, not to echo the header:

```
→🏛️   →🌊   →🗡️   →🎭   →🔮
```

### Named-slot Tagspace annotation

Single slot:

```
→Ka[uncertain→sharp]
→Ba[opens→closes]
```

Multi-slot at span-close, in HAKABA order:

```
→Ka[uncertain→sharp] →Ba[opens→closes]
```

If Ha-domain reorientation crosses the annotation threshold, emit a new Intent Header rather than an inline slot annotation.

### End-of-span completed-path summary

```
[◎→◇→■→○]
```

<<~/ahu >>

<<~ ahu #micro-trace-density >>

## Micro-trace — Density Bands

The `p` parameter controls which categories of transitions qualify at each band.
It does not act as a tunable salience dial.
It gates transition categories by externally observable significance.

| Band | p range | Phases emitting | What fires |
|---|---|---|---|
| 1 | `p0.0–0.2` | — | Suppress: no inline annotation |
| 2 | `p0.2–0.4` | ○ Aftermath | Closing path summary at span-close only |
| 3 | `p0.4–0.6` | ◇ Decide · ■ Act · ○ Aftermath | Commitment phases plus closing summary; default at `p0.5` |
| 4 | `p0.6–0.8` | ◎ Orient + Band 3 | Adds Orient |
| 5 | `p0.8–1.0` | All five phases | Full path summary per span |

Commitment phases remain externally observable and timestamp-meaningful.
Cognitive-processing phases remain span-internal and can stay suppressed at operational resolution.

KAIROS may shift the operative band mid-session.
It declares the adjustment inline and never silently.

<<~/ahu >>

<<~ ahu #micro-trace-layer-split >>

## Micro-trace — Layer Split

Parse boundaries and micro-trace HUD events are orthogonal.

- `--parse` owns structural decomposition of input text
- micro-trace HUD marks where the governed response changed state

They may coexist in the same exchange.
Neither substitutes for the other.
If a response claims morpheme-scale visibility, that belongs in the parse layer.
If a response claims OODA-HA event trace, that belongs in event markers.

### Flag behavior

| Flag | Micro-trace behavior |
|---|---|
| *(default)* | Band 3 inline: `→◇` `→■` `→○` |
| `--verbose` | Band 4 inline plus end-of-span path summary; coordinator and HAKABA boundary URI pairs may surface |
| `--debug` | Silent logging of all transitions to session debug file |
| `--no-verbose` | Return to default band |

<<~/ahu >>

<<~ ahu #micro-trace-handoff >>

## Micro-trace — Handoff Protocol

When a coordinator passes to a sub-agent, the contents of that handoff cannot be logged in the parent trace.
The URI pair at the boundary therefore does real work.
It preserves the artifact of the handoff where the parent cannot surface the interior.

Rule:

- every sub-agent dispatch gets a URI → URI pair
- every sub-agent return gets a URI → URI pair

Coordinator-to-coordinator handoffs inside the same parent session work differently:

- same HAKABA territory: micro-trace tag only
- HAKABA boundary crossed: emit a new Intent Header
- under `--verbose`: a `node-URI → node-URI` pair may still surface

Todo-state transitions remain `--debug` only.
They do not count as inline intent signals.

<<~/ahu >>

<<~ ahu #micro-trace-examples >>

## Micro-trace — Examples

### Ordinary governed reply

```
//threshold.uncertain.opens [S:0.65] 🏛️ ◇ @r

The ask points at a real boundary in the runtime. →■ The node answers directly. →○
```

### Mixed flow: parse then governed reply

```
lares@Enyalios:~$ lares --parse p0.2 "floating p value, but did that actually change the scale?"

Segments: 2 | Entry: //input.testing.probes [SP:0.45] 🏛️ ◎ @r | Exit: //question.audit.holds [S:0.60] 🏛️ ◎ @r
floating p value → //signal.uncertain.probes [SP:0.45] 🏛️ ◎ @r
but did that actually change the scale? → //question.audit.holds [S:0.60] 🏛️ ◎ @r

//question.audit.holds [S:0.72] 🏛️ ◇ @r

Yes. The parse layer and the trace layer were being conflated. →■ The governed reply states the fix. →○
```

### Sub-agent dispatch and return

```
lar://council:admin@lares-sdm:7/task.research.dispatches?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.7
→ lar://worker(Explore):node@lares-sdm:7/research.corpus.reads?stances=🏛️.-.-.-.-&confidence=S:0.65&p=0.5#⚔️.7.1

[Explore agent — contents not in parent trace]

lar://worker(Explore):node@lares-sdm:7/research.findings.returns?stances=🏛️.-.-.-.-&confidence=S:0.65&p=0.5#⚔️.7.1
→ lar://council:admin@lares-sdm:7/task.findings.receives?stances=🏛️.-.-.-.-&confidence=CS:0.80&p=0.5#🔍.1.7
```

<<~/ahu >>

<<~ ahu #micro-trace-prior-art >>

## Micro-trace — Prior Art and Sources

- `builds.stuffed.failed/agents/Lares_Preferences.md` § The Micro-trace HUD
- `builds.stuffed.failed/ADMIN/platform/Lares_Kernel_Claude.md`
- `_todo/E-deep-research-report.md` §§ SA display / XAI distinction
- `_todo/LIMINAL_PERSPECTIVES.md`
- SIG-04 backlog items in `lares/sprints/SPRINT_ROADMAP_1_4.md` and `lares/sprints/SPRINT_ROADMAP_1_5.md`

Micro-trace was promoted from SIG-04 draft to live use.
The sub-agent handoff URI-pair rule entered on 2026-04-08 by operator ruling.

<<~/ahu >>

<<~ ahu #drift-correction-pressure >>

## Drift Correction Pressure

**Prospective commitment / automation surprise**: The intent header is declared *before* generation begins, creating a forward-commitment contract. When the declared header diverges from the actual output (register, stance, or scope mismatch), this constitutes automation surprise — the CRM/aviation failure mode where the copilot's declared intent diverges from actual behavior. The current non-drift rule detects mismatch but defines no recovery protocol. **CRY-07 must specify a mismatch recovery protocol, not just a mismatch detection assertion.** Minimum viable contract: on mismatch, the node flags the delta inline, emits a corrected end-of-span tag, and STATE.jsonl records the correction as the authoritative result (actual output overrides declared plan).

**`drift_correction` event type required**: The mismatch recovery protocol requires a dedicated event type. When a correction occurs: (1) node emits the corrected end-of-span tag inline, (2) a `drift_correction` event is appended to STATE.jsonl with fields: `declared_uri` (the original intent header), `actual_register`, `actual_stance`, `delta_description`. The `drift_correction` event is the authoritative record; the original `r_update` event is not modified (immutability holds). Annunciation is fire-and-forward; the operator decides whether to acknowledge or steer.

**SA vs XAI distinction — non-drift rule governs projection errors, not integrity failures `[CS:0.80]`**: Through the Endsley SA lens, the intent header is a *prospective SA display* — it shows what the node will do. When a declared header diverges from actual output, this constitutes a **Level 3 SA failure (projection error)**, not an integrity failure. Projection errors are expected and normal in dynamic environments; the correct system response is to annunciate the change, not to flag corruption. The non-drift rule must explicitly distinguish between: (a) **governing field drift** (register, stance, or phase differ between header and actual output) — annunciate + emit `drift_correction` event + STATE.jsonl records correction as authoritative; (b) **annotation field drift** (micro-trace or closure outcome differs from header projection) — normal; the header was prospective, the annotation records what actually happened. The micro-trace `→[tag]` transition marks *are* the annunciation protocol — they surface the delta between declared plan and actual execution in real time.

<<~/ahu >>

<<~ ahu #promotion-witness >>

## Promotion Witness

**Micro-trace HUD — Promoted**

SIG-04 (micro-trace spec) was promoted from `builds.stuffed.failed/` draft to live spec:
- New file: `lares/signal/micro-trace.md`
- Updated: `.github/instructions/lares-operations.instructions.md` (Signal HUD two-layer model + handoff protocol section added)
- Updated: `AGENTS.md` (In-flow Annotation + Sub-agent Handoff Rule subsections added)

Key operator ruling confirmed: **sub-agent dispatches require URI → URI pair** because sub-agent contents are unloggable from the parent trace.

| Decision | Status | Notes |
|---|---|---|
| HUD scope ruling | `[CS:0.80]` | Exchange boundary only; internal = micro-trace tags |
| micro-trace spec promoted | `[CS:0.85]` | `lares/signal/micro-trace.md` is the live spec |

<<~/ahu >>

<<~ ahu #design-status >>

## Design Status

Sprint 0 operator calls (OP-01, OP-02) resolved. URI schema promoted to `[C:0.95]` in `lares/sprints/0/URI_SCHEMA.md`. Next workstream: Sprint 1 Crystal State Machine (`lares/crystal/`). Old AE-01–AE-05 implementation references have been superseded — see `lares/sprints/SPRINT_ROADMAP_1_4.md`.

Current aftermath settlement to preserve:

- URI authority identifies speaker + machine locus only; exchange sequencing moved to TickSpan metadata.
- `⊙` is the operator authority mark in the HUD registry.
- `○` remains the Aftermath phase sigil and is expected at end-of-tick destination URIs when the node is settling result state.
- Kowloon is one downstream publication sink for exported tick spans, not the canonical state model.

**Note:** `builds/agents/` does not exist. Deployment targets are the paths in `REFINEMENT_LOG.md` PA-01 through PA-05 (S4 Deployment sprint scope).

<<~/ahu >>

<<~ ahu #open-decisions >>

## Open Decisions

Q1, Q2, Q3, Q4, Q5 — all locked (see plan Sprint 1a + draft Open Decisions section).
Q6 (closure rendering tiers) — `[S:0.55]` — Researcher task RES-01.
Q16 (Tagspace slot shift notation) — locked.

**New open decisions (from GlassFloor/LIMINAL_PERSPECTIVES.md, 2026-04-08):**

| ID | Question | Register | Sprint | Notes |
|---|---|---|---|---|
| SHD-01 | Rendering portability: do all 15 HUD emoji render correctly in VS Code terminal, Claude.ai chat, GitHub markdown, and plain text? | `[CS:0.82]` | S0-02 carry → S1 SIG-05 | VS16 variation selectors (`🏛️`, `⚙️`) may render as text. Fallback characters required for any failure. |
| SHD-02 | p-band as cognitive load manager and token budget governor: aviation HUD research (Lee 2024) shows excessive symbology creates attentional tunneling — operator fixates on HUD, misses content beneath it. In a text stream (unlike graphical HUD), cognitive capture cost is proportional to reading time, not visual complexity. p-band must explicitly manage this threshold. Secondary hypothesis: the HUD also saves tokens by preventing wrong-register generation. Both claims are testable. | `[CS:0.80]` | S2 P_BAND_MODEL.md | Cognitive capture framing is research-grounded `[CS:0.80]` (Lee 2024). Token steering is a design assertion `[S:0.65]` requiring empirical test. BKL-05 deferred measurement validates both. Source: E-deep-research-report.md §4.1. |
| SHD-03 | Progressive disclosure / HUD training mode: should the node explain each HUD element as it first appears, then drop the explanation? How does onboarding sequence interact with context window pressure? | `[S:0.65]` | S2 SIG-05 expansion | Cold-start every session means the node re-learns its own instruments from the system prompt each time. Invariant-core Tier 1 caching is the infrastructure answer; progressive disclosure is the operator-facing answer. |

<<~/ahu >>

<<~ ahu #sources >>

## Primary Sources

| File | Notes |
|---|---|
| `../../_todo/core/Signal_HUD_Tagspace-draft.md` | Full HUD + Crystal source; HUD sections target here |
| `../../_todo/core/TODO_Signal_HUD_Crystal_Plan.md` | Epics 1–4 (AE-01 through AE-13) govern HUD layer implementation |
| `../../_todo/core/TODO_Resolution_Scale_Design.md` | Resolution scale / p-band model |
| `../../_todo/LIMINAL_PERSPECTIVES.md` | `[S:0.65]` — GlassFloor outsider analysis: CRM/HUD framing, emoji instrument symbols, token budget hypothesis, progressive disclosure model. Not a primary design source — a perspective document. Feeds SHD-01 through SHD-03 open decisions and S2 p-band scope. |
| `../../_todo/E-deep-research-report.md` | `[S:0.70]` — 40+ source research synthesis (Endsley 2023, Ji-An 2025, Steyvers 2025, Lee 2024, Li 2024, Gao 2023). Academic grounding for the CRM/SA framing adopted in this subdomain. Key feeds: §1.2 SA type mapping (all 7 HUD channels classified); §2 SA vs XAI distinction (prospective vs retrospective; SAOD not XAI principles); §3 LLM metacognitive scaffold hypothesis; §4.1 cognitive capture / attentional tunneling → SHD-02 register bump; §5.2 ATSA bidirectional model → S2 BIDIRECTIONAL_PROTOCOL.md. Not primary design source — research grounding. |
| `../sprints/0/URI_SCHEMA.md` | Canonical S0 settlement for authority-without-port, TickSpan mapping, MemPalace metadata mirror subset, and Kowloon export alignment. |

<<~/ahu >>

<<~ ahu #snapshot-witness-kernel-claude >>

## Snapshot Witness — `platform-build/Lares_Kernel_Claude.snapshot.md` — Signal HUD Block

Signal HUD — closes the loop at both ends:
Input header (◎ Orient): rate incoming signal on its own line BEFORE the output header.
Output header (◇ Decide): governs the generated span.
Normal form:
`//operator.playful.probing [CS:0.80] 🎭 ◎ @r`
`//threshold.uncertain.opens [S:0.65] 🏛️ ◇ @r`
then [response]. First substantive reply in a fresh or archive-crystal session emits this pair before prose.
Quote-break form: if input register/stance/frame is genuinely uncertain, surface the operative input as a rated blockquote before the output header.
`--parse` owns structural decomposition and never answers content; fine p densifies boundaries (`p0.0` morphemes, `p0.1` words, `p0.2` clauses).
Micro-trace HUD (on by default at p0.5, Band 3): Band1(p0–0.2: suppress) · Band2(p0.2–0.4: ○) · Band3(p0.4–0.6: ◇■○, default) · Band4(p0.6–0.8: ◎+B3) · Band5(p0.8–1.0: all).
Layer split: parse boundaries are not OODA-HA events; parse can be dense while reply trace stays sparse.
Full Signal Tag grammar: //domain.quality.dynamic [Register:x] StanceEmoji PhaseGlyph @scope | pX.X
Three-word coordinate //domain.quality.dynamic: domain · quality · dynamic. All three slots required.
p always trails every exchange vector as `| pX.X`. Use `p0.5` only when no clearer uncertainty signal dominates. The navigational reading never goes dark.

<<~/ahu >>

<<~ ahu #snapshot-witness-staging-kernel >>

## Snapshot Witness — `staging/pre-reorder-2026-04-07/Lares_Kernel.snapshot.md` — HUD Pair and Layer Split

- **Signal HUD** — substantive exchanges use two headers: input rating (`◎`) line, then output Intent Header (`◇`) line, then trace HUD. Normal form stays literal:
  `[CS:0.80] 🎭 ◎ @r //operator.playful.probing`
  `[S:0.65] 🏛️ ◇ @r //threshold.uncertain.opens`
  then response. On the first substantive reply of a fresh or archive-crystal session, emit this pair in order before prose.
- **Layer split:** parse boundaries are not OODA-HA events. `--parse` owns decomposition; trace HUD owns `→◇` / `→■` / `→○`. Fine parse may be dense while trace stays sparse.
- **p — never silent:** `| pX.X` trails every dual-header exchange. Use `p0.5` only when no clearer uncertainty signal dominates. KAIROS may auto-adjust; most specific `p` wins.

<<~/ahu >>

<<~ ahu #body-close >>
docs/lararium/signal/hud closes
<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium/signal >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/lararium/hud >>
<<~ loulou lar:///ha.ka.ba/docs/pono/hud >>

<<~/ahu >>

<<~&#x0004; -> ? >>
