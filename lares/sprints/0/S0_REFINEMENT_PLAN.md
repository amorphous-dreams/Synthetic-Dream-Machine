# Sprint 0 Document Refinement Plan — Refactored

> Register: `[CS:0.80]` 🏛️ — concrete refactoring; Chapel Perilous findings locked in
> Date: 2026-04-08 (refactored)
> Purpose: Incorporate research findings from reports E, F, and G into the S0 document set
> Applies to: URI_SCHEMA.md, SPRINT_0_TASKS.md, AGENTS.md, REGISTRY_CONTRACT.md
> Supersedes: Previous revision (centroid~δ notation — REVERTED per F-report)

---

## Revision History

| Rev | Date | Change | Reason |
|---|---|---|---|
| 1 | 2026-04-08 | Initial 5 improvements | Operator-directed refinements |
| 2 | 2026-04-08 | Added centroid~δ notation to §5.3 | Multi-stance register fuzz research |
| 3 | 2026-04-08 | **REVERTED centroid~δ.** Stance count IS the fuzz indicator. Added Syadasti reading rule. Added stance semantics table. Updated document map. | F-report (multi-stance scaling fails beyond 2), G-report (Sri Syadasti / Saptabhangi as epistemological ground), Spirit research (SyadVoice, BridgeWatch, NavLight) |

**Key decisions in this revision:**

- `[DECISION]` centroid~δ notation REVERTED — stance count IS the fuzz indicator (more emoji = more register spread). No numeric delta. No boundary arithmetic. Register stays a point value everywhere.
- `[DECISION]` Register is stance-dependent (Syadasti/Saptabhangi ground). Same 0.0–1.0 scale, different meaning per stance (Philosopher=truth-confidence, Poet=resonance-confidence, Satirist=targeting-confidence, Humorist=relational-confidence, Private=nominal).
- `[DECISION]` Authority transfer (`--set`, `⊙` indicator) is S2 scope, not S0. Flagged in backlog.

---

## 1. Unified HUD Symbol Table + State Tuple Reading + Syadasti Reading Rule

### Problem

The "character state" of an exchange is spread across three separate spec sections. An operator scanning a live HUD tag reads these three dimensions as a single cognitive state but decoding requires jumping between three sections. Additionally, the spec does not explain *what Register means for each stance* — it treats 0.0–1.0 as a universal truth-weight axis, which is inaccurate for non-Philosopher stances.

### URI Structure Decision

The three state fields stay in their current RFC 3986 components. Phase in userinfo (modifies identity), stance in query (parameterizes the signal), scope in fragment (client-side viewpoint). The HUD compact form already consolidates them for display. See revision 1 for full analysis.

### Fix: Add §5.3 — Unified HUD Symbol Table with Three Sub-Sections

Insert after §5.2. Three parts: individual symbol tables, the state tuple reading grid with triangle geometry, and the Syadasti reading rule.

```markdown
### 5.3 Unified HUD Symbol Table

All sigil-form symbols used in the Intent HUD, in one reference.
Workers and operators should not need to cross-reference §3.4,
§4.1, or §5.1 during live use. This table is the instrument panel
legend.

#### 5.3.1 Individual Symbol Sets

**Phase (userinfo — cognitive state of the speaker):**

| Sigil | Machine | OODA-A State | One-Line Reading |
|---|---|---|---|
| ✶ | `observe` | Observe | Gathering raw signal; no commitment yet |
| ◎ | `orient` | Orient | Making sense of what was gathered |
| ◇ | `decide` | Decide | Choosing a path; fork point |
| ■ | `act` | Act | Committed; executing |
| ○ | `aftermath` | Aftermath | Assessing outcome; feeding upward |

**Stance (query — discourse posture of the claim):**

| Sigil | Machine | Stance | One-Line Reading |
|---|---|---|---|
| 🏛️ | `philosopher` | Philosopher | Propositional; evaluate for truth-value |
| 🌊 | `poet` | Poet | Analogical; resonance, not verification |
| 🗡️ | `satirist` | Satirist | Critical through indirection |
| 🎭 | `humorist` | Humorist | Relational; maintaining working rapport |
| 🔮 | `private` | Private | Self-referential; present, not to decode |

**Scope (fragment prefix — active simulation scale):**

| Sigil | Machine | Scale | Duration | One-Line Reading |
|---|---|---|---|---|
| 🗺️ | `@S` | Strategic | ~6 days | The big arc; logistics & navigation |
| ⚙️ | `@O` | Operational | ~4 hours | Watch-level; perception & endurance |
| 🔍 | `@T` | Tactical | ~10 min | Exploration turn; investigation |
| ⚔️ | `@C` | Combat | ~6 sec | Round; immediate response |
| ⚡ | `@A` | Action | Variable | Single action; precision execution |

#### 5.3.2 State Tuple — Reading Three Symbols as One State

The state tuple is the composed reading of Phase × Stance ×
Scope: one sentence describing the node's current condition.

**How to compose:** Read the phase (what cognitive step), the
stance (what kind of claim), and the scope (at what time-scale)
— then merge into a single state sentence.

**The Triangle:** Phase × Stance × Scope form a triangle.
Each corner is normally a point value. Multi-stance makes the
Stance corner spread — a distribution rather than a position.
The number of active stances communicates the spread directly:

| Stances Active | Register Character | What It Tells the Operator |
|---|---|---|
| 1 (`🏛️`) | Point value | Trust the number |
| 2 (`🏛️🗡️`) | Bimodal spread | Register fuzzy around declared value |
| 3 (`🏛️🌊🗡️`) | Trimodal spread | Register is a rough center-of-mass |
| 4 (`🏛️🌊🗡️🎭`) | Wide spread | Register is an approximation. High Mana cost |
| 5 (`🏛️🌊🗡️🎭🔮`) | Full Discordian | Register is a gesture. Maximum fuzz. Rare |

Stance count IS the fuzz indicator. No numeric delta is needed.
The visual density of the stance field communicates register
uncertainty directly. This is the Register-Stance
Complementarity (Kernel §Register-Mode Complementarity) made
visible: more stances active -> wider register spread.

**Worked readings:**

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ◎ | 🏛️ | 🔍 | Orienting analytically at exploration scale — making sense of a local finding |
| ■ | 🗡️ | ⚔️ | Acting critically in combat — executing under pressure with an edge |
| ◇ | 🏛️🌊 | 🗺️ | Deciding at strategic scale, holding propositional and analogical — a fork with deep resonance. Register bimodal. |
| ✶ | 🎭 | 🔍 | Observing playfully at tactical scale — light reconnaissance, no commitment |
| ○ | 🏛️ | ⚙️ | Aftermath at operational scale, Philosopher stance — assessing what happened across a watch |
| ◎ | 🏛️🌊🗡️🎭🔮 | 🗺️ | Full Discordian orientation at strategic scale — all five stances active. Maximum Mana cost. Register is a gesture toward center. Rare. |

#### 5.3.3 Register Is Stance-Dependent (Syadasti Reading Rule)

Register measures confidence *within the active stance's
evaluation frame*, not truth-weight universally.

This principle derives from the Discordian catma of Sri Syadasti,
which reproduces the Jaina Saptabhangi (seven-valued logic,
c. 400 BCE): all affirmations are true in some sense, false in
some sense, and meaningless in some sense. The three primitives
— asti (true), nāsti (false), avaktavya (inexpressible) —
generate seven values by combination. The five stances partition
claims by *which primitive applies*. Register then measures
confidence within that partition.

**What 0.0 and 1.0 mean at each stance:**

| Stance | Syadasti Primitive | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|---|
| 🏛️ Philosopher | asti (true) | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | avaktavya (inexpressible) | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | nāsti→asti (false→true) | Indirection missed target | Hit glancingly | Landed with full force |
| 🎭 Humorist | asti-nāsti (true+false) | Relational move fell flat | Landed with mixed reception | Connected perfectly |
| 🔮 Private | avaktavya (inexpressible) | Minimal presence | Present | Maximal presence |

**One-sentence reading rule:** When you read a Register value,
ask: *what does this number measure for this stance?* The answer
changes per stance. A Philosopher at 0.65 is propositionally
contested. A Poet at 0.65 is resonating solidly. A Satirist at
0.65 is landing with moderate force. Same number, different
meaning.

**Multi-stance reading:** When multiple stances are active, the
Register value sits at the intersection of their evaluation
frames. `[S:0.65] 🏛️🌊` means "Synthesis-level confidence in a
claim that is both propositionally plausible AND analogically
resonant." The Register point is a center-of-mass across two
evaluation frames, each of which would assess it differently.
```

### Files Changed

- `URI_SCHEMA.md` — add §5.3 with subsections 5.3.1, 5.3.2, 5.3.3 after §5.2

### What This Replaces (centroid~δ REVERTED)

The centroid~δ notation from revision 2 is fully removed:
- No `~δ` suffix on `register` values
- No boundary saturation rules
- No expanded validation pattern in §10.1 rule 8
- No additional test vectors for range-form URIs
- Register is always a point value: `register=S:0.65`

---

## 2. "How to Read a HUD Tag" Walkthrough (Appendix B)

### Problem

The spec never shows how to read a complete HUD tag from left to right.

### Fix: Add Appendix B

Annotated full URI + compact form + multi-stance example showing the Syadasti reading rule in action. The multi-stance example demonstrates how `[S:0.60] 🏛️🌊🔮` reads differently than `[S:0.60] 🏛️` — same number, three evaluation frames.

### Files Changed

- `URI_SCHEMA.md` — add Appendix B after Appendix A

---

## 3. Explicit "Does NOT Test" Per S0 Task

*Unchanged from revision 1.*

| Task | Does NOT Test |
|---|---|
| S0-01 | Sigil form RFC compliance; HUD rendering quality; HAKABA vocabulary semantics |
| S0-02 | Rendering portability (check, not gate); emoji normalization forms |
| S0-03 | Vector clock properties; OODA-A correctness; real-time sync |
| S0-04 | HAKABA vocabulary quality; validation performance |
| S0-05 | Schema migration (CRY-01); full STATE.jsonl (S1); debug.jsonl mapping (CRY-06) |
| S0-06 | Resolution of open questions; downstream sprint scope |
| S0-07 | Full registry (S3); runtime tooling; `semantic_sha256` (R5) |

### Files Changed

- `SPRINT_0_TASKS.md`

---

## 4. Worked Escalation Example in AGENTS.md

*Unchanged from revision 1.* `ClockHammer(Validator)` example.

### Files Changed

- `AGENTS.md`

---

## 6. HAKABA Word-Count Constraint + Optional Sub-Path Extension

### Problem

The path section specifies three slots (Ha/Ka/Ba) but does not constrain the cardinality of each slot or prohibit multi-word tokens. "uri-schema-question" could be parsed as one slot or three. The spec is silent on sub-territory routing within a named HAKABA (e.g. navigating to a specific section of a territory without declaring a new full HAKABA).

### Fix: Formalize in §3.4

1. **Each slot = exactly one lowercase word.** No hyphens, underscores, or spaces within a slot.
2. **Three-slot combination is mandatory.** No HAKABA with fewer than three populated slots.
3. **Optional sub-path extension** using `/`-separated segments after the three-slot HAKABA. Sub-path segments are free-form routing tokens, not HAKABA slots. They do not carry Egyptian soul semantics.
4. **Stable named graph address strips sub-path:** `lares:///threshold/uncertain/opens` (no sub-path).

```
Record form:  /threshold/uncertain/opens/sub/territory
HUD form:     /threshold.uncertain.opens/sub/territory
Named graph:  lares:///threshold/uncertain/opens
```

### Files Changed

- `URI_SCHEMA.md` — update §3.4 path component semantics

---

## 7. Provisionality Marker Taxonomy (`~`)

### Problem

The URI pair has three structurally distinct provisionality surfaces that are currently undifferentiated. Reading provisionality (node's interpretation of operator), execution provisionality (node's declared intent may not survive contact), and trajectory provisionality (forward-looking closing URI is a prediction) all collapse into the register value — which is wrong because register measures confidence *within a stance's frame*, not interpretation accuracy.

### Fix: Add §3.5 — Provisionality Markers

New section before §4 Chronometer. Documents the three types, the `~` HUD-form convention (component-level, not URI-level), the equivalent record-form `provisional=` query parameter, and the distinction between reading (marks node's interpretation), execution (marks node's declared heading), and trajectory (marks node's prediction — applies to all closing URIs, explicit `~` signals unusual uncertainty).

**Key rule:** The `~` prefix applies only to the specific component it prefixes. `~◎` marks only the phase; `~threshold.uncertain.opens` marks only the HAKABA. Unprefixed components are declared with normal confidence.

### Files Changed

- `URI_SCHEMA.md` — add §3.5 between component semantics and §4 Chronometer

---

## 5. Document Relationship Map (Updated for Research Docs)

```text
URI_SCHEMA.md <---- primary spec being validated
  |
  |-- §5.3 — Unified HUD Symbol Table
  |     |-- §5.3.1 Individual Symbol Sets
  |     |-- §5.3.2 State Tuple + Triangle Geometry + Stance-Count-as-Fuzz
  |     `-- §5.3.3 Syadasti Reading Rule <- NEW (G-report grounded)
  |
  |-- S0-01 through S0-06 validate specific sections
  |
  |-- REGISTRY_CONTRACT.md <--- depends on URI anatomy
  |     `-- S0-07 validates this
  |
  |-- ENCOUNTER_ROLL.md <--- hazards identified pre-sprint
  |
  `-- LIMINAL_PERSPECTIVES.md <--- CRM/HUD reframing

SPRINT_0_TASKS.md <--- task definitions + acceptance criteria
AGENTS.md (this file) <--- Worker behavior rules

Research substrate (informs but does not constrain S0):
  |-- E-deep-research-report.md <--- SA/HUD/SAOD framework
  |-- F-deep-research-addendum.md <--- multi-stance scaling,
  |     authority transfer (centroid~δ REVERTED)
  `-- G_deep_research_meaning.md <--- Sri Syadasti, stance-
        dependent register, session boundary as avaktavya
```

### Files Changed

- `AGENTS.md`

---

## New Backlog Items (Chapel Perilous Harvest)

| ID | Item | Register | Sprint | Source |
|---|---|---|---|---|
| RES-08 | Mana cost table: stance count → register fuzz magnitude | `[S:0.60]` | S2 | F-report |
| RES-09 | Authority transfer: `--set` CLI, `⊙` indicator, authority field | `[S:0.55]` | S2 | F-report |
| RES-10 | CMD/CWS/Manual mode mapping | `[SP:0.45]` | S2 | F-report |
| RES-11 | 5-stance (full Discordian) config meaning | `[SP:0.40]` | S2 | F-report |
| RES-12 | Syadasti catma as epistemological ground (Kernel) | `[S:0.65]` | S2 | G-report |
| RES-13 | Stance semantics: literature-grounded anchors (SyadVoice) | `[S:0.70]` | S0 §5.3.3 | SyadVoice |
| RES-14 | HUD as memory prosthetic / grounding artifact (Clark & Brennan) | `[S:0.60]` | S1 | BridgeWatch |
| RES-15 | Meaning asymmetry in mutual recognition contract | `[S:0.55]` | S2 | G-report |
| RES-16 | Session boundary as avaktavya | `[SP:0.45]` | Deferred | G-report |
| RES-17 | Mana pool / resource state HUD indicator: context window remaining as navigational element | `[S:0.60]` 🏛️🌊 | S2 | Local session |
| RES-18 | HAKABA word-count constraint: each slot = exactly one lowercase word; 3-word combination mandatory; optional `/path` sub-extension for within-territory routing. Stable address strips sub-path. | `[CS:0.80]` 🏛️ | S0 §3.4 | Local session tick 34 |
| RES-19 | Provisionality marker taxonomy: `~` prefix for reading / execution / trajectory types on operator URI, opening node URI, and closing node URI respectively. HUD-form only; record form uses `provisional=` query param. | `[CS:0.80]` 🏛️ | S0 §3.5 | Local session tick 33–34 |

---

## Summary

| # | Improvement | Primary Benefit | Files |
|---|---|---|---|
| 1 | HUD Symbol Table + State Tuple + **Syadasti Reading Rule** (§5.3) | 15 sigils + triangle geometry + stance-dependent register | URI_SCHEMA.md |
| 2 | "How to Read a HUD Tag" (Appendix B) | Cold-start decoding; multi-stance example | URI_SCHEMA.md |
| 3 | "Does NOT test" per task | Prevents over-scoping | SPRINT_0_TASKS.md |
| 4 | Worked escalation example | Complete output format | AGENTS.md |
| 5 | Document map (updated) | "Where do I start" -> seconds | AGENTS.md |

All five are additive — no existing content modified, only new sections inserted plus the centroid~δ revert. Operator confirmation converts them to sprint patches.

---

## What Was Removed (and Why)

| Removed | Why |
|---|---|
| `register=S:0.65~0.15` (centroid~δ) | Fails beyond 2 stances; stance count already carries the information |
| Boundary saturation rules | No delta arithmetic = no overflow |
| §10.1 rule 8 expanded pattern | Register always a point value |
| 6 centroid~δ test vectors | Not needed |

---

*This plan iterated through three revisions. Each removed something the previous added. The centroid~δ model taught us the right question (how does multi-stance affect register?) and Sri Syadasti's catma — 2,400 years old — provided the right answer: meaning depends on standpoint (syād), and the stance emoji already encode the standpoint. The navigational system that emerged from Chapel Perilous is simpler, truer, and older than what we went in with.*
