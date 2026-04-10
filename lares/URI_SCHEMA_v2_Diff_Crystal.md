lares://core/protocol/uri_schema_v2_diff?stances=++?+-&register=S:0.8&p=0.5#O0.O0.O0.O0.O0
⚡∞ | mode:infodense-handoff | p0.5 | register:[S:0.8] | build:FORGE

# URI_SCHEMA.md v2 — Infodense Diff Crystal

> **Type:** Merge handoff — load alongside URI_SCHEMA.md (v1) into fresh session
> **Register:** `[S:0.8]` — operator-directed, research-grounded, consecration-grade
> **Date:** 2026-04-09, Session 5
> **Instruction:** Apply every change below to URI_SCHEMA.md. Sections not listed: keep as-is.

---

## META: What Changed and Why

Three research streams converged on this spec:

1. **FFZ Chronometer** — ITC-informed vector model replaces flat counters.
   Phase is per-participant LWW-Register, not embedded in counter.
   Source: `FFZ_Chronometer_Research.md` [S:0.55]

2. **Span Closing Sigils** — `→ ∞` (system files) and `→ ?` (exchanges)
   formalized as orthogonal to confidence. Duration axis vs certainty axis.
   Source: Session 5 operator decision [S:0.8]

3. **OODA-A Module URIs** — section-level `confidence` in HTML comments.
   Every module file is a span. Every section carries addressable trust.
   Source: `OODA_A_Module_Template_and_URI_Patterns.md` [S:0.6]

Plus: all-five-stances-every-URI mandate, amplitude modifiers settled.

---

## CHANGES BY SECTION

### §1 Design Intent

**REPLACE** the four semantic layers list:

```
1. **WHO** — authority (`userinfo@host`) identifies speaker and machine locus
2. **WHERE** — the HA.KA.BA address (path) locates semantic territory
3. **HOW** — signal parameters (query) describe stance, confidence, and p-band
4. **WHEN** — the FFZ chronometer (fragment) locates position in nested
   causal time per participant — not a single shared clock but per-participant
   phase readings at each scale (Fuller: non-simultaneous apprehension)
```

**REMOVE** the `{needs FFZ chronometer alignment}` comment.

**REMOVE** the `?` after "Resource-state annotations...adjacent calibration fields rather than authority overloads?"  — that question is resolved: yes, they are adjacent, not URI components.

### §1.1 Exchange Flow

**REPLACE** Step 5 closing sentence. Old:

> See `lares/signal/micro-trace.md`.

New:

> The exchange closes with an updated HUD line and a closing URI.
> Exchange spans close with `→ ?` — unknown temporal resumption.
> System file spans close with `→ ∞` — unbounded duration.
> See §3.6 (Span Closing Sigils) and `lares/signal/micro-trace.md`.

**ADD** after "refactor for progressive disclosure" comment — remove that comment, replace with:

> The URI pair opens every exchange span. Both URIs use canonical record
> form. Progressive disclosure: the URI pair carries the minimum viable
> signal; the HUD line expands it; section-level URIs within referenced
> module files carry per-section confidence for subagent handoff.

### §3.2 Expanded Form

**REPLACE** the full form template:

```
lares://alias:tier(phase)@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N#chronometer
```

Where `stances=XXXXX` is the five-character stance amplitude string (see §3.4 query).

**REPLACE** fragment description. Old:

> `#scope.W.w.t.r.a`

New:

> `#chronometer` — FFZ chronometer position. Format defined in §4.

### §3.3 Component Map

**REPLACE** row 6 (query):

| 6 | **`?query`** | Non-hierarchical params | Signal parameters | `?stances=+%2B%3F%2B-&confidence=S:0.65&p=0.5` | `?stances=🏛️+🌊+🗡️?🎭+🔮-&confidence=S:0.65&p=0.5` |

**REPLACE** row 7 (fragment):

| 7 | **`#fragment`** | Secondary resource / viewpoint | FFZ chronometer position | `#O0.O0.O3.D2.A1` | `#O0.O0.O3.◇2.■1` |

**REMOVE** all `{needs phase FFZ chronometer alignment}` and similar curly-brace comments throughout §3.

### §3.4 Component Semantics — Query

**REPLACE** the stance parameter definition:

**query** (`?stances=XXXXX&confidence=R:N&p=N`)

| Parameter | Type | Repeatable? | Record Values | HUD Values |
|---|---|---|---|---|
| `stances` | 5-char amplitude string | No (single field, all 5 stances) | `+?-+-` (positional: philosopher, poet, satirist, humorist, private) | `🏛️+🌊?🗡️-🎭+🔮-` |
| `confidence` | `R:N` | No | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90` | Same |
| `p` | `N` | No | `0.5` | Same |

**Stance amplitude encoding — all five, every URI:**

Positional order is fixed: Philosopher, Poet, Satirist, Humorist, Private.
Each position carries one amplitude character:

| Char | Meaning |
|---|---|
| `+` | Above baseline / active / elevated |
| `-` | Below baseline / suppressed |
| `?` | Uncertain / provisional |
| `.` | Baseline / neutral presence |

Record form: `stances=+.?+-` (URL-safe characters only, no encoding needed for `+.-?`)

**WAIT — `+` is a reserved character in query strings (means space).** Use percent-encoding in canonical form: `stances=%2B.%3F%2B-`. Or switch to a different character for "elevated." Operator decision needed:

**Option α:** Use `^` for elevated: `stances=^.?^-` — no encoding needed.
**Option β:** Use URL-safe characters throughout: `^` elevated, `-` suppressed, `?` uncertain, `.` baseline. All URL-safe.
**Option γ:** Percent-encode `+`: `stances=%2B.%3F%2B-` — ugly but explicit.

**RECOMMENDATION:** Option β — `^.?^-` in canonical. Render target maps `^` → `+` for HUD display. Cleanest parse, no encoding ambiguity.

{OPERATOR: pick α/β/γ before merge session executes.}

### §3.4 Component Semantics — Fragment (Chronometer)

**REPLACE** the fragment description entirely. Old referenced `#scope.W.w.t.r.a`. New:

**fragment** (`#chronometer`) — FFZ chronometer position. Five dot-separated
positions, coarsest to finest. Each position: OODA-A phase sigil + counter.

```
#O0.O0.O3.D2.A1
 │  │  │  │  └─ Action: Act, counter 1
 │  │  │  └──── Round: Decide, counter 2
 │  │  └─────── Turn: Observe, counter 3
 │  └────────── Watch: Observe, counter 0
 └───────────── Week: Observe, counter 0
```

Phase sigils in record form:

| Sigil | Phase | Keyword |
|---|---|---|
| `O` | Observe | `observe` |
| `Ø` | Orient | `orient` |
| `D` | Decide | `decide` |
| `A` | Act | `act` |
| `Å` | Assess/Aftermath | `aftermath` |

**Key FFZ model properties:**

1. Phase sigil is per-participant, per-scale — it does NOT merge across
   participants. Two participants may show different phases at the same
   scale. This IS non-simultaneous apprehension at the data structure level.

2. Counter merges via pointwise max (standard vector clock join) at
   exchange boundaries (sync points).

3. The chronometer in the URI fragment represents ONE participant's view.
   The exchange vector pair shows both: operator's fragment vs node's
   fragment. The gap between them is the causal distance.

4. All five positions always present. Inactive scales show `O0`.
   No trailing-zero omission (changed from v1 — consistency over brevity).

5. Counters increment monotonically. Phase sigils may change without
   counter increment (phase transition within the same turn). Counter
   increments when the Assess phase completes at that scale and feeds
   upward.

**Progressive disclosure in display:** The HUD may suppress positions
where phase has remained `O` and counter has remained `0` for visual
clarity. The canonical URI always carries all five. Display adapts;
data persists.

### NEW §3.6 — Span Closing Sigils

**INSERT** new section after §3.5 Provisionality Markers:

## 3.6 Span Closing Sigils

Two sigils close spans in the Lares protocol. They encode different
temporal properties and are orthogonal to the `confidence` parameter.

### `→ ?` — Exchange Span Closing

Signals unknown temporal resumption. This exchange will continue, but
when and from where sits outside the span's knowledge.

The `?` marks a causal gap: between this sigil and the next message,
no participant's chronometer advances within the shared frame. The
operator's clock runs in lived time; the Lares clock stops. Two causal
islands, no messages crossing, no ordering determinable.

`→ ?` does not signal uncertainty about the exchange's content — that
is what `confidence` and register carry. It signals uncertainty about
the exchange's continuity in time.

Appears on: every exchange-closing URI. Mandatory.

```
lares://scryer:node(aftermath)@enyalios/schema.settled.rests/?stances=^.-^-&confidence=CS:0.80&p=0.5#O0.O0.O3.Å2.A1 → ?
```

### `→ ∞` — System File Span Closing

Signals unbounded span duration. This content remains available until
explicitly revised. It does not signal certainty; per-section and
per-file `confidence` parameters carry epistemic uncertainty independently.

A system file that closes `→ ∞` stands as infrastructure: readable,
addressable, trustable to the degree its confidence ratings declare,
until someone rebuilds it.

Appears on: system files (MODULE.md, phase files, invariant configs).
Uses HTML comment wrapping for markdown compatibility:

```
<!-- lares:///module/phase/file?confidence=0.85 → ∞ -->
```

### Axis Orthogonality

| Sigil | Span type | What's uncertain | What's settled |
|---|---|---|---|
| `→ ∞` | System file | Content confidence (via `confidence`) | Duration — stays until revised |
| `→ ?` | Exchange | Temporal resumption — when does this pick up? | Content confidence (via register + tags) |

Both carry uncertainty. Neither claims completeness. The uncertainty
is about different things. The system file doesn't know how trustworthy
it is (confidence tells it). The exchange doesn't know when it resumes
(the chronometer gap tells it). Orthogonal unknowns, orthogonal sigils.

### §4 Chronometer — FULL REPLACEMENT

**REPLACE** all of §4 (4.1–4.5) with:

## 4. The FFZ Chronometer — Nested OODA-A Vector Position

> **True Name:** Fontany-Fuller-Zelenka Chronometer Protocol [C:0.95]
> **Named for:** Fontany (practice), Fuller (principle), Zelenka (engineering)
> **See:** `lares/research/chronometer/FFZ_Chronometer_Research.md`

The chronometer occupies the URI fragment. It tracks nested OODA-A
loop position across five scales per participant.

### 4.1 Scale Table

| Position | Scale | FTLS Time Term | Duration | Record Prefix | HUD Sigil |
|---|---|---|---|---|---|
| 1 | Strategic | Week ("Travel Turn") | ~6 days | (none — leftmost) | 🗺️ |
| 2 | Operational | Watch | ~4 hours | (none) | ⚙️ |
| 3 | Tactical | Exploration Turn | ~10 minutes | (none) | 🔍 |
| 4 | Combat | Round | ~6 seconds | (none) | ⚔️ |
| 5 | Action | Action/Free Action | Variable | (none) | ⚡ |

[Canon: FTLS RSS §1]

### 4.2 Notation

Each position: phase sigil + counter. Five positions, dot-separated.

```
Record:  O0.O0.O3.D2.A1
HUD:     ✶0.✶0.✶3.◇2.■1   (phase sigils rendered)
```

All five positions always present. `O0` = inactive scale (Observe, counter zero).

### 4.3 Phase Sigils

| Record | HUD | Phase | Keyword |
|---|---|---|---|
| `O` | `✶` | Observe | `observe` |
| `Ø` | `◎` | Orient | `orient` |
| `D` | `◇` | Decide | `decide` |
| `A` | `■` | Act | `act` |
| `Å` | `○` | Assess/Aftermath | `aftermath` |

`Ø` and `Å` use ISO 8859 characters (Ø = U+00D8, Å = U+00C5).
Canonical record form uses these single characters — no percent-encoding
needed in fragment (fragment is client-side per RFC 3986 §3.5).

### 4.4 Structural Rules

1. **All five positions always present.** No trailing-zero omission.
   `O0.O0.O3.D2.A1` not `O3.D2.A1`.

2. **Phase is per-participant.** The operator's chronometer and the
   node's chronometer may show different phases at the same scale.
   The exchange vector pair shows both. Neither is "the" time.

3. **Counter increments when Assess completes.** Assess at scale N
   feeds upward to Observe at scale N-1. Counter at scale N increments.

4. **Phase may change without counter increment.** `O3` → `Ø3` → `D3`
   represents phase progression within the same turn. Counter stays 3
   until Assess completes.

5. **Scale activation/deactivation.** When combat starts: position 4
   moves from `O0` to `O1`. When combat ends: position 4 returns to
   `O0`, position 3 counter increments (the tactical turn advanced).

6. **Monotonic counters.** Counters only increase. Phase may cycle.
   Counter regression constitutes Temporal Hallucination (degraded state).

### 4.5 Aftermath Integration — The Nested Return

| Assess at scale | Feeds into | Update question |
|---|---|---|
| Action Å → | Round ✶ | Did the action resolve? |
| Round Å → | Turn ✶ | Is the threat gone? |
| Turn Å → | Watch ✶ | What was found? |
| Watch Å → | Week ✶ | Is the party exhausted? |
| Week Å → | Campaign | Did we arrive safely? |

### 4.6 Progressive Disclosure in Display

The canonical URI always carries all five positions. Display surfaces
MAY suppress inactive positions (`O0`) for readability:

```
Canonical:  #O0.O0.O3.D2.A1    (always all five)
HUD full:   ✶0.✶0.✶3.◇2.■1    (all five rendered)
HUD compact: ✶3.◇2.■1          (trailing active only)
```

The compact form is a render target convenience, not canonical.
Parsers MUST handle both.

### 4.7 FFZ Deferred Features (Not in v2)

The following FFZ model features are specified in the research docs
but deferred from this URI spec version:

- **ITC identity stamps** — fork/join for Tasked Spirit lifecycle.
  Deferred to MCP chronometer server implementation.
- **Merkle Clock backend** — content-addressed causal history.
  Deferred to MCP integration.
- **Per-participant vector display** — showing both clocks in the
  fragment. Current spec: one fragment per URI, each participant's
  URI carries their own view.
- **Bloom Clock compact mode** — probabilistic compression.
  Deferred to future work.

### §5.3 HUD Symbol Table

**UPDATE** fragment scope prefix table — remove the `@S`/`@O`/`@T`/`@C`/`@A`
scope prefixes. The FFZ model uses phase+counter per position, not
scope prefix + counter array. The "active scale" is determined by the
rightmost non-`O0` position, not by a prefix sigil.

**ADD** to §5.3.3 (Syadasti Reading Rule): note that all five stances
appear on every URI and every HUD line. The amplitude string replaces
the "stance count as fuzz indicator" model — amplitude modifiers carry
fuzz directly. Update the table in §5.3.2:

| Stance Array | What It Tells the Operator |
|---|---|
| `^.-.-.-` | Single-stance point value. Trust the number. |
| `^.^.-.-.` | Two active. Confidence is bimodal. |
| `^.^.?.-.` | Two active + one uncertain. Watch the `?`. |
| `^.^.^.^.^` | Full Discordian. Confidence is a gesture. |
| `-.-.-.-.` | All suppressed. Why is this span being emitted? |

### §5.4 HUD Line Composition

**REPLACE** format template:

```
⚡~NN% | [confidence] | 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp} | mode:{mode} | p{p} | voice(s):{Voice} | ✶N.✶N.✶N.◇N.■N
```

**Changes from v1:**
- All five stances always present with amplitude modifiers
- Chronometer replaces `span:{N} | loop:{phase}→{phase} @{scope}`
- Chronometer shows HUD-rendered form (phase glyphs, not keywords)
- `span:{N}` removed from HUD — it's in calibration metadata, not
  the navigational instrument. The chronometer IS the temporal position.

### §5.5 Span-Span Display Contract

**ADD** to the URI types table:

| **Exchange closing** | `URI → ?` | End of every exchange span — temporal resumption unknown |
| **System file closing** | `<!-- URI → ∞ -->` | End of system file spans — unbounded duration |

**UPDATE** rendering order step 6:

> 6. Close with an **updated HUD line** and the **closing URI with `→ ?`**.

### §10.1 Validation — Well-Formedness

**REPLACE** rules 6, 7, 9, 10:

6. Query parameters limited to: `stances` (once, 5-char amplitude string),
   `confidence` (once), `p` (once)
7. `confidence` value matches pattern `[A-Z]{1,2}:[0-9]+\.[0-9]+`
9. Fragment is five dot-separated positions, each: phase sigil (`O`/`Ø`/`D`/`A`/`Å`)
   followed by integer counter ≥ 0
10. All five positions present (no trailing-zero omission in canonical form)

**ADD** rule 11:

11. Exchange-closing URIs end with ` → ?`. System file URIs end with ` → ∞`.

### §11 Open Questions

**CLOSE** U3: "Should the chronometer carry phase per level or just counters?"
**Decision:** Phase per level per participant. LWW-Register per scale.
Counter and phase are independent. [S:0.65] — confirmed by FFZ O1 findings.

**CLOSE** U6: "Full URI form vs stateless form — when to use which?"
**Decision:** Authority form in exchange spans. Authority-less (`///`) for
stable addresses AND for module section URIs. [CS:0.80]

**ADD** new open questions:

| Q# | Question | Position | Confidence |
|---|---|---|---|
| U7 | Stance amplitude character for "elevated" — `+` needs URL encoding in query strings. Use `^` instead? | Use `^` (Option β) | [SP:0.45] — needs operator decision |
| U8 | Should module section URIs carry chronometer fragments? Or only confidence? | Confidence only — chronometer is exchange-time, not file-time | [S:0.6] |
| U9 | ITC stamp integration into fragment — when MCP server arrives, does the fragment grow or does ITC live in calibration metadata? | Calibration metadata — fragment stays human-readable | [S:0.55] |

### §12 Prior Art

**ADD** entries:

- **FFZ Chronometer Protocol** (Telarus / Lares, 2026) — Fontany-Fuller-Zelenka.
  Vector chronometer with per-participant phase registers. Source:
  `lares/research/chronometer/FFZ_Chronometer_Research.md`
- **Interval Tree Clocks** (Almeida et al., 2008) — Dynamic participant
  identity via interval subdivision. Deferred from URI spec; informs
  MCP chronometer server design.
- **Schneier & Raghavan, "Agentic AI's OODA Loop Problem"** (IEEE S&P,
  2025) — Nested OODA loops in AI agents; integrity as architecture.
  Validates the chronometer's problem space independently.
- **OODA-A Composable Invariant Modules** (Telarus / Lares, 2026) —
  Phase-scoped instruction loading with section-level confidence URIs.

### Appendix A — REPLACE all examples

**A.1 Record Form (v2):**

```
lares://telarus:operator(orient)@enyalios/threshold.uncertain.opens/?stances=^.?.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7
```

**A.2 HUD Line (v2):**

```
⚡~87% | [S:0.65] | 🏛️+🌊?🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.◎3.◇2.■7
```

**A.3 All-Five-Stances (v2):**

```
lares://telarus:operator(decide)@enyalios/threshold.sharp.closes/?stances=^.^.?.^.-&confidence=S:0.60&p=0.7#O0.O0.D3.D2.A8
```

**A.4 Stable Address (unchanged):**

```
lares:///threshold.uncertain.opens/
```

**A.5 Exchange Closing (v2):**

```
lares://scryer:node(aftermath)@enyalios/schema.settled.rests/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å3.Å2.A9 → ?
```

**A.6 System File Span (NEW):**

```
<!-- lares:///talk-story/observe/context?confidence=0.95&p=0.5#O0.O0.O0.O0.O0 -->

{file content with section URIs}

<!-- lares:///talk-story/observe/context?confidence=0.95 → ∞ -->
```

**A.7 Scale Transition (v2, replaces old A.5):**

```
#O0.O0.O3.O0.O0     Turn 3, no combat
#O0.O0.O3.O1.O0     Combat activates: Round 1
#O0.O0.O3.O1.A1     Action 1 of Round 1
#O0.O0.O3.O1.A2     Action 2 of Round 1
#O0.O0.O3.Å1.O0     Combat assess: Round 1 complete
#O0.O0.O4.O0.O0     Combat over: Turn increments to 4
```

### Appendix B — REPLACE "How to Read" example

```
lares://telarus:operator(orient)@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7
→ lares://scryer:node(decide)@enyalios/~parse.span.models/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D3.D2.A8
⚡~87% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.6 | voice(s):Scryer | ✶0.✶0.◇3.◇2.■8
```

Quick read:

> Telarus (operator), orienting, machine enyalios.
> Territory: threshold / uncertain / opens.
> Philosopher elevated, Poet uncertain, others suppressed.
> Synthesis-0.65, tactical scope at Week 0, Watch 0, Turn 3 (Orient),
> Round 2 (Decide), Action 7.
> Scryer responds at CS:0.80, deciding, Philosopher only.
> Chronometer shows: node is one phase ahead at tactical scale
> (Orient→Decide) — normal: node orients from operator's observe.

---

## SECTIONS UNCHANGED — INCORPORATE BY REFERENCE

These sections transfer from v1 without modification (or with only
the removal of `{curly brace comments}`):

- §2 Scheme Registration (remove typo "Unconfidenceed" → "Unregistered")
- §3.3.1 Kowloon/ActivityPub Handle Form (entire subsection)
- §3.5 Provisionality Markers (remove `{keep this?}` and `{needs FFZ}`
  comments; content itself unchanged)
- §6 Stable Address (unchanged)
- §7 Span-Span and Calibration Mapping (update `chronometer_start`/
  `chronometer_end` example values to new format: `O0.O0.Ø3.D2.A7`
  instead of `@T.3.2.7`)
- §8 Module and Registry Metadata (unchanged)
- §9 Cache Tier Mapping (unchanged)
- §10.2–10.4 Validation Consistency/Address/Comparison (unchanged)

---

## OPERATOR DECISIONS NEEDED BEFORE MERGE

1. **Stance amplitude character** — `^` for elevated (Option β)?
   Or keep `+` and percent-encode (Option γ)? Blocks §3.4 query encoding.

2. **`Ø` and `Å` in fragment** — these are single-byte ISO 8859-1 chars,
   legal in URI fragments without encoding. Confirm acceptable, or
   prefer pure ASCII (`Or` for Orient, `As` for Assess)?

3. **HUD `span:{N}` field** — removed in v2 (chronometer replaces it).
   Confirm, or keep as redundant temporal anchor?

4. **`→ ?` on system file section URIs** — confirmed `→ ∞` for system
   files. But do individual *section* URIs within a system file also
   close `→ ∞`? Or only the file-level closing URI? Recommendation:
   only file-level. Section URIs don't close — they're waypoints.

---

*This crystal is the offering. Feed it alongside URI_SCHEMA.md v1
into a fresh session. The agent reads the diff, applies every change,
produces the consecrated v2.*

*Amor et hilaritas.*

lares:///artificer,council/forge-crystal?stances=++?+-&register=S:0.8&p=0.5#O0.O0.O0.O0.O0 → ∞
