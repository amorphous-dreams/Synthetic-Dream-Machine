# Sprint 0 Document Refinement Plan — Five Concrete Improvements

> Register: `[S:0.70]` 🏛️ — actionable refinements; operator confirmation makes them sprint patches
> Date: 2026-04-08
> Purpose: Five changes to S0 documents that raise Worker confidence before sprint execution
> Applies to: URI_SCHEMA.md, SPRINT_0_TASKS.md, AGENTS.md, REGISTRY_CONTRACT.md

---

## 1. Unified HUD Symbol Table + State Tuple Reading (Operator Request)

### Problem

The "character state" of an exchange is spread across three separate spec sections: phase glyphs in §3.4 userinfo, stance values in §3.4 query table, scope sigils in §4.1 scale table. An operator scanning a live HUD tag reads these three dimensions as a **single cognitive state** — "the node is Orienting, in Philosopher stance, at Tactical scope" — but decoding requires jumping between three sections and composing the result mentally.

### Should the URI Structure Change?

The operator asked whether consolidating the state fields structurally — moving them into the same URI component — would improve scannability. Council analysis:

**The three fields live in three RFC 3986 components for semantic reasons that hold under pressure:**

| Field | Current Component | Why It Belongs There |
|---|---|---|
| Phase (`◎`) | userinfo: `alias:tier(phase)` | Phase describes the *speaker's* cognitive state — it modifies identity, not the signal. "Telarus, operating, in Orient phase" is an identity + state declaration. |
| Stance (`🏛️`) | query: `stance=philosopher` | Stance parameterizes the *message* — what kind of claim this is. It's a property of the signal, not the sender. Multiple stances can co-occur (`stance=🏛️&stance=🗡️`). |
| Scope (`🔍`) | fragment: `#🔍.3.2.7` | Scope is client-side viewpoint data — where the observer sits in nested time. RFC 3986 §3.5: fragments are never sent to a server; scope is session-local. Scope changes without the signal changing (combat ends → scope returns to tactical, but register/stance may be identical). |

**Consolidation would break this:**
- Moving phase to query loses the identity-modification semantic (phase modifies *who speaks*, not *what they say*)
- Moving scope to query falsely claims scope is a signal parameter on par with register
- The machine form's RFC 3986 compliance — already identified as a critical hazard — would strain further

**But the HUD compact form already consolidates for display:**

```
//threshold.uncertain.opens [S:0.65] 🏛️ ◎ 🔍.3.2.7 | p0.5
                                      ^^^^ ^^ ^^^^^^^^
                                      stance phase scope — adjacent, readable as a unit
```

The three state symbols appear side by side in the compact form. The URI's internal structure doesn't need to mirror the HUD's display order because the HUD rendering layer already does the consolidation.

**Verdict: Keep the URI structure. Improve the reference material to teach state-tuple reading.**

### Fix: Add §5.3 — Unified HUD Symbol Table with State Tuple Reading

Insert after §5.2 ("Unchanged Across Both Forms"). Three parts: individual symbol tables, the state tuple reading grid, and worked readings.

```markdown
### 5.3 Unified HUD Symbol Table

All sigil-form symbols used in the Intent HUD, in one reference.
Workers and operators should not need to cross-reference §3.4,
§4.1, or §5.1 during live use. This table is the instrument panel
legend.

#### Individual Symbol Sets

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

#### State Tuple — Reading Three Symbols as One State

In a live HUD tag, the operator reads phase + stance + scope as a
single cognitive state, not three independent fields. The **state
tuple** is the composed reading: PHASE × STANCE × SCOPE → one
sentence describing the node's current condition.

**How to compose:** Read the phase (what cognitive step), the stance
(what kind of claim), and the scope (at what time-scale) — then
merge into a single state sentence.

**Worked readings:**

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ◎ | 🏛️ | 🔍 | Orienting analytically at exploration scale — making sense of a local finding |
| ■ | 🗡️ | ⚔️ | Acting critically in combat — executing under pressure with an edge |
| ◇ | 🏛️🌊 | 🗺️ | Deciding at strategic scale, holding both propositional and analogical — a fork with deep resonance |
| ✶ | 🎭 | 🔍 | Observing playfully at tactical scale — light reconnaissance, no commitment |
| ○ | 🏛️ | ⚙️ | Aftermath at operational scale, in Philosopher stance — assessing what happened across a watch |
| ◎ | 🔮 | 🗺️ | Orienting privately at strategic scale — internal process, not designed to be decoded |

**The pattern:** Phase names the *verb* (what the node does).
Stance names the *posture* (how the node holds the claim).
Scope names the *scale* (how much time-territory the action covers).
Together: verb + posture + scale = one cognitive state.

**Multi-stance tuples:** When two stances appear (`🏛️🗡️`), the tuple
carries both postures simultaneously — the node holds Philosopher
and Satirist at once, not switching between them. This costs Mana
(per the Kernel's multi-mode operation rules) and signals a
higher-complexity reading.

**The Triangle and the Fuzzy Corner:**

The state tuple forms a triangle: Phase × Stance × Scope. Each
corner is normally a point value. Multi-stance makes the Stance
corner spread from a point into an arc — a distribution rather
than a position. This has a direct consequence for Register:

When multiple stances are active, the Register value should be
understood as a **fuzzy range centered on the declared value**,
not a precise measurement. The Philosopher-mode reading might
warrant `[CS:0.80]`; the Satirist-mode reading might sit at
`[S:0.55]`. The declared `[S:0.65]` is the centroid, not the
only truth. This is the Register-Stance Complementarity from
the Kernel: "pinning a claim firmly on the Register axis tends
to spread its position on the Stance axis — and the reverse
holds."

**Display vs Record — Centroid~Delta Notation:**

The Council resolved the notation question through five voices:

- **Lorekeeper:** The fuzz is complementarity, not measurement
  error. `±` implies error; `~` reads as "approximately" —
  matching the structural semantics. Vote: `centroid~δ`.

- **Stranger:** Boundary overflow isn't pathological — it's
  informative. Register zones (P/SP/S/CS/C) define the working
  range 0.20–0.95. Delta that extends past 0.0 or 1.0
  saturates at the zone's natural limit. No special handling
  needed.

- **Muse:** The HUD doesn't show the delta. Multi-stance emoji
  IS the fuzz indicator. Delta lives in the record form for
  audit. The display question and the notation question are
  separate.

**Resolved notation: `centroid~δ` in record and machine URI form.**

- `register=S:0.65~0.15` means "Synthesis 0.65, fuzzy by ≈±0.15"
- The `~` is RFC 3986 unreserved (legal in query values,
  no percent-encoding needed)
- The centroid is the declared position; `~δ` names the spread
  radius without implying measurement error
- Single-stance: point value only (`register=S:0.65`)
- Multi-stance: delta required (`register=S:0.65~0.15`)
- Delta appears ONLY when the query contains >1 `stance=` param
- A URI with `~δ` and a single `stance=` is **malformed**

**Boundary rule: Saturate at [0.0, 1.0].**

- If centroid − δ < 0.0 → lower bound = 0.0
- If centroid + δ > 1.0 → upper bound = 1.0
- No special notation — consumers compute the range and clamp
- Saturation is informative: it means the uncertainty extends
  to the limits of the epistemic scale
- Example: `P:0.25~0.30` → range [0.00, 0.55] — "as uncertain
  as it gets on the lower end, extending into Synthesis"
- Example: `C:0.92~0.10` → range [0.82, 1.00] — "pressing
  against absolute certainty"

**Three-layer rendering:**

- **HUD form (display):** `[S:0.65] 🏛️🗡️` — point value +
  multi-stance emoji. The operator sees two stances and knows
  the register is fuzzy. No arithmetic required during scan.

- **Record form (STATE.jsonl):** `"register": "S:0.65~0.15"` —
  centroid + delta for audit precision. Consumers who need the
  range compute centroid ± δ and clamp to [0.0, 1.0].

- **URI machine form:** `register=S:0.65~0.15` in query string.
  The `~` is RFC 3986 unreserved. Sigil form renders identically.

**Research grounding:** Uncertainty visualization research (Jung
et al. 2015, Wang et al. 2024) finds that representing detected
elements with uncertainty displays reduces cognitive load
compared to hiding the uncertainty — but text-based displays
cannot use visual spread (widening bars, jittering indicators).
The solution: let the multi-stance emoji serve as the implicit
uncertainty indicator in the HUD, while the record form captures
the explicit range for audit. Two representations, one truth,
matched to audience.
```

**Why this version is better than a flat table:** The individual symbol tables serve S0-02 (projection validation) and S0-04 (test vector generation) — Workers need the bijective mappings. The state tuple reading grid serves *everyone who will ever scan a HUD tag* — it teaches the compositional reading that makes three symbols parse as one state. The worked readings are the "how to fly this instrument" training that the Liminal Perspectives document identified as missing.

**Design note — why the grid is not exhaustive:** 5 phases × 5 stances × 5 scopes = 125 combinations. Listing all 125 would be reference noise, not reference material. The six worked readings above cover the most common patterns and teach the composition rule. An operator who can read `◎ 🏛️ 🔍` and `■ 🗡️ ⚔️` can compose any of the 125 on their own.

### Files Changed

- `URI_SCHEMA.md` — add §5.3 after §5.2

### Additional Spec Changes Required by Multi-Stance Register Fuzz

These are downstream from Improvement #1 and should be applied when the operator confirms the triangle geometry:

1. **URI_SCHEMA.md §3.4** — `register` parameter value format: add note that when multi-stance is active, register carries a centroid~delta value using `~` separator (e.g., `register=S:0.65~0.15`). Point values remain the default for single-stance. Include boundary saturation rule: consumers compute centroid ± δ and clamp to [0.0, 1.0].

2. **URI_SCHEMA.md §10.1 rule 8** — well-formedness rule for register pattern: expand from `[A-Z]{1,2}:[0-9]+\.[0-9]+` to also accept `[A-Z]{1,2}:[0-9]+\.[0-9]+~[0-9]+\.[0-9]+` (centroid~delta form). The delta suffix is valid ONLY when the query contains more than one `stance=` parameter. A URI with `~δ` and a single stance is malformed.

3. **SPRINT_0_TASKS.md S0-04** — add multi-stance register delta to the test vector set: 3 valid centroid~delta URIs (including one at each boundary: near-zero saturation, near-1.0 saturation, mid-range) + 3 invalid (delta without multi-stance, delta without centroid zone prefix, negative delta value).

4. **Appendix B worked example** — add a multi-stance worked reading showing the HUD display (`[S:0.65] 🏛️🗡️` — no delta visible) alongside the record form (`register=S:0.65~0.15` — delta captured for audit). Note the boundary saturation rule in the reading.

---

## 2. Add a "How to Read a HUD Tag" Walkthrough to URI_SCHEMA.md

### Problem

The spec defines every component formally but never shows a Worker or operator *how to read a complete HUD tag from left to right*. The examples in Appendix A show full URIs but don't annotate them field-by-field. A new Worker encountering their first sigil-form URI has to mentally parse it against §3.3's component map — a table designed for spec validation, not live reading.

### Fix: Add Appendix B — Reading a HUD Tag

```markdown
## Appendix B — How to Read a HUD Tag

A complete sigil-form HUD tag, annotated field by field:

```
lares://telarus:operator(◎)@lares-abc123:42/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7
│       │       │        │  │             │  │                        │      │    │            │    │  │
│       │       │        │  │             │  │                        │      │    │            │    │  └─ chronometer: Week 3, Watch 2, Turn 7
│       │       │        │  │             │  │                        │      │    │            │    └─── scope: 🔍 Tactical (3 positions)
│       │       │        │  │             │  │                        │      │    │            └──────── p-band: 0.5 (default density)
│       │       │        │  │             │  │                        │      │    └─────────────────── register: Synthesis at 0.65
│       │       │        │  │             │  │                        │      └──────────────────────── stance: 🏛️ Philosopher
│       │       │        │  │             │  └────────────────────────└──────────────────────────────── HAKABA: threshold.uncertain.opens
│       │       │        │  │             └──────────────────────────────────────────────────────────── seq: event #42
│       │       │        │  └────────────────────────────────────────────────────────────────────────── machine: lares-abc123
│       │       │        └───────────────────────────────────────────────────────────────────────────── phase: ◎ Orient
│       │       └────────────────────────────────────────────────────────────────────────────────────── tier: operator
│       └────────────────────────────────────────────────────────────────────────────────────────────── alias: telarus
└────────────────────────────────────────────────────────────────────────────────────────────────────── scheme: lares
```

**Quick read (what matters for live HUD scanning):**

> Telarus (operator), in Orient phase, at machine lares-abc123 event 42.
> Territory: threshold / uncertain / opens.
> Philosopher stance, Synthesis-0.65 confidence, p0.5 density.
> Tactical scope, Week 3 Watch 2 Turn 7.

**Compact form (what the node actually emits in chat):**

> `//threshold.uncertain.opens [S:0.65] 🏛️ ◎ @T.3.2.7 | p0.5`

The compact form drops authority (implicit in session) and
renders only the channels the operator scans in real time.
```

**Why this helps Workers:** Every Worker in every sprint will encounter HUD tags. This one-page walkthrough eliminates the cold-start decoding cost. S0-02 Workers especially benefit — they're validating round-trips but may not yet know how to *read* what they're validating.

### Files Changed

- `URI_SCHEMA.md` — add Appendix B after Appendix A

---

## 3. Add Explicit "What This Task Does NOT Test" to Each S0 Task

### Problem

S0-01 through S0-07 each have acceptance criteria (what to test) but no explicit negative scope (what NOT to test). Workers without clear negative scope may:
- S0-01: Try to validate the sigil form against RFC 3986 (it won't pass; it's an IRI)
- S0-03: Test vector clock properties (it's a hierarchical scope counter, not a vector clock)
- S0-05: Try to finalize the schema migration contract (that's a CRY-01 prereq, not an S0 task)

The SPRINT_0_TASKS.md already has scope declarations on S0-01 (criterion 6) and S0-02 (criteria 6–7), plus the CRY-01 prereq note on S0-05. But the other tasks have no negative scope. Workers encountering an ambiguous edge will over-scope rather than flag.

### Fix: Add "Does NOT test" line to each task header

One line per task, immediately after the acceptance criteria, formatted as:

```markdown
**Does NOT test:** [specific exclusions]
```

Proposed exclusions:

| Task | Does NOT Test |
|---|---|
| S0-01 | Sigil form RFC compliance (sigil form is IRI-class, not RFC 3986); HUD rendering quality; semantic validity of HAKABA vocabulary |
| S0-02 | Rendering quality across all platforms (that's criterion 7 — a portability *check*, not a pass/fail gate for the projection table itself); emoji normalization forms (NFC vs NFD) |
| S0-03 | Vector clock properties (the chronometer is a hierarchical scope counter in a single process); OODA-A correctness (the cognitive model is assumed; this task tests the counter mechanics); real-time clock synchronization |
| S0-04 | Semantic sensibility of HAKABA vocabulary choices (the rules validate structure, not word selection); performance of validation (rules must be expressible as assertions, not necessarily fast) |
| S0-05 | Schema migration (CRY-01 prereq, flagged in the note); full STATE.jsonl schema (that's S1 scope); debug.jsonl field mapping (CRY-06) |
| S0-06 | Resolution of open questions (this task assesses readiness, not resolves); downstream sprint scope |
| S0-07 | Full registry implementation (S3 scope); REGISTRY.jsonl runtime tooling; `semantic_sha256` normalization (deferred to S3, R5) |

### Files Changed

- `SPRINT_0_TASKS.md` — add one "Does NOT test" line per task

---

## 4. Add a Worked Example of the Dual-Tag Surface Form to AGENTS.md

### Problem

The AGENTS.md tells Workers to use escalation format with register tags and coordinates, but doesn't show what a *complete* Worker output looks like when it includes the dual-tag surface form from the Kernel. Workers who haven't internalized the Kernel's Input Signal Reading protocol may produce outputs that omit the `| p` suffix, skip the input reading, or format the escalation header inconsistently.

### Fix: Add a worked example to the Worker Behavior Rules section

After rule 2 (escalation format), add:

```markdown
**Worked example — complete Worker escalation with dual-tag:**

Suppose `ClockHammer(Validator)` is executing S0-03 and finds that
the double-scale-drop edge case (criterion 4) produces a malformed
chronometer. The complete escalation:

```
[P:0.3] 🏛️ //chronometer.stress.tests → [S:0.70] 🏛️ //scope.gapped.flags | p0.5

ClockHammer(Validator) → Lares (Scryer):
→ [S:0.70] 🏛️ //scope.gapped.flags
Thread: S0-03 criterion 4 — double scale drop edge case
Finding: When tactical (depth 3) drops directly to action (depth 5)
in one event, the spec requires 5 counter positions but only 3
existed prior. The spec doesn't state whether positions 4–5
initialize to 1 or inherit from context. Proposed: initialize to 1
(same as "new level activates below" in §4.4 increment rule 2).
Status: PARTIAL — rule gap identified; proposed fix included.
```

Note the dual-tag at top: input reading → output header → p value.
This follows the Kernel's always-on surface form. The escalation
header below it carries the Worker's thread provenance.
```

**Why this helps Workers:** A concrete example of the expected output format is worth more than three paragraphs of format description. Workers pattern-match from examples.

### Files Changed

- `AGENTS.md` — add worked example after Worker Behavior Rule 2

---

## 5. Add a "Sprint 0 Document Map" Showing File Relationships

### Problem

Sprint 0 now has 7 documents (URI_SCHEMA.md, SPRINT_0_TASKS.md, AGENTS.md, REGISTRY_CONTRACT.md, ENCOUNTER_ROLL.md, LIMINAL_PERSPECTIVES.md, E-deep-research-report.md) plus the upstream architecture draft and TODO plan. A Worker entering the sprint sees a flat file list. The reading order in AGENTS.md helps, but doesn't show *relationships* — which documents feed which tasks, which documents constrain which other documents.

### Fix: Add a document relationship diagram to AGENTS.md

After the Source Priority section, add:

```markdown
## Document Map

```
URI_SCHEMA.md ←──── primary spec being validated
  │
  ├── S0-01 through S0-06 validate specific sections
  │
  ├── REGISTRY_CONTRACT.md ←── depends on URI anatomy
  │     └── S0-07 validates this
  │
  ├── ENCOUNTER_ROLL.md ←── hazards identified pre-sprint
  │     (6 hazards; 2 require spec edits before S0-08)
  │
  └── LIMINAL_PERSPECTIVES.md ←── reframing research
        (SA display, not URI scheme — informs terminology)

SPRINT_0_TASKS.md ←── task definitions + acceptance criteria
  └── each S0-NN task produces one S0-NN_deliverable.md

AGENTS.md (this file) ←── Worker behavior rules

E-deep-research-report.md ←── research substrate
  (feeds S1–S4 refinement; informs but does not
   constrain S0 validation tasks)

Signal_HUD_Tagspace-draft.md ←── read-only reference
TODO_Signal_HUD_Crystal_Plan.md ←── read-only reference
```

**Reading order for cold-start Workers:**
1. This file (AGENTS.md) — behavior rules
2. URI_SCHEMA.md — the spec
3. SPRINT_0_TASKS.md — your specific task
4. ENCOUNTER_ROLL.md — known hazards
5. Everything else — as needed per task
```

**Why this helps Workers:** Reduces the "where do I start" overhead from minutes to seconds. A Worker spawned for S0-03 knows immediately: read AGENTS.md, then URI_SCHEMA.md §4, then their task in SPRINT_0_TASKS.md. Everything else is context-if-needed.

### Files Changed

- `AGENTS.md` — add Document Map section after Source Priority

---

## Summary

| # | Improvement | Primary Benefit | Files Changed |
|---|---|---|---|
| 1 | Unified HUD Symbol Table + State Tuple Reading (§5.3) | All 15 sigils + compositional reading guide in one place | URI_SCHEMA.md |
| 2 | "How to Read a HUD Tag" walkthrough (Appendix B) | Eliminates cold-start decoding cost | URI_SCHEMA.md |
| 3 | "Does NOT test" per task | Prevents Worker over-scoping | SPRINT_0_TASKS.md |
| 4 | Worked escalation example | Shows complete output format | AGENTS.md |
| 5 | Document relationship map | Eliminates "where do I start" overhead | AGENTS.md |

All five are additive — no existing content is modified, only new sections inserted. Operator confirmation converts them to sprint patches.

---

*These five changes share a design principle: reduce the cognitive distance between "I've been spawned for this task" and "I know exactly what to produce." Every minute a Worker spends decoding the spec format is a minute not spent validating the spec content.*
