# `lares:` URI Schema — Canonical Specification

> Domain: `lares/signal/` · intent HUD anatomy, co-primary encodings, validation rules
> Status: `[CS:0.85]` 🏛️ — design-canon candidate; awaiting operator promotion to `[C:0.95]`
> Updated: 2026-04-08
> Source: Extracted from `_todo/core/Signal_HUD_Tagspace-draft.md` §§ Full URI Anatomy, Chronometer, Display Split, Crystal Schema Field Mapping, Prior Art
> Blocks: `lares/registry/` URI assignment; `lares/crystal/` STATE.jsonl field contract; deployment and schema descriptors that carry `lares_uri`
> Candidate URI: `lares://core/design/signal/uri-schema@CS:0.85`

---

## 1. Design Intent

The `lares:` URI encodes the signal state of a Lares node exchange as a shared navigational artifact. In live use it functions as an Intent HUD that both operator and node read before or alongside generation. In persistence it functions as a structured record string suitable for logs, validation, and registry metadata.

Each URI component carries a distinct, non-overlapping concern across four semantic layers:

1. **WHO** — authority (`userinfo@host`) identifies speaker and machine locus
2. **WHERE** — the HAKABA address (path) locates semantic territory
3. **HOW** — signal parameters (query) describe stance, register, and p-band
4. **WHEN** — the chronometer (fragment) locates position in nested time

Resource-state annotations such as the mana pool (`⚡87%`) are HUD adjuncts, not core URI components. Tick identity, wall-clock timestamps, and export-target metadata likewise remain adjacent calibration fields rather than authority overloads.

The system has two co-primary encodings of the same state:

- **Record form** — RFC 3986-compliant, keyword-based, machine-safe
- **HUD form** — operator-facing, Unicode/sigil-rich, optimized for scan speed

Record form is canonical for transport, comparison, and storage. HUD form is canonical for in-stream navigation.

---

## 2. Scheme Registration

| Property | Value |
|---|---|
| Scheme name | `lares` |
| Dereferenceability | Non-dereferenceable identifier (RFC 4151 precedent) |
| Resolution | Via `lares/registry/` resolver; never via network fetch |
| IANA status | Unregistered; internal use only |

> **Form and compliance:** The **record form** is the RFC 3986-compliant canonical form for transport, persistence, comparison, and strict parsing. The **HUD form** is an IRI-class instrument rendering (RFC 3987); it contains emoji and Unicode glyphs in the `stance=` parameter, phase field, and fragment scope prefix that are not legal in RFC 3986 URIs without percent-encoding. RFC 3986 compliance is not claimed for the HUD form. The rendering table (§5) defines a deterministic transform between forms for the projected fields; it is a co-primary display/record mapping, not a claim that the HUD form itself is network-safe.

The `lares:` scheme identifies semantic positions, signal states, and machine events within the Lares agent architecture. It does not resolve to a network resource. URI consumers (crystal replay tools, debug log parsers, registry resolvers) treat it as an opaque structured identifier parsed according to this specification.

---

## 3. Full URI Anatomy

### 3.1 Generic Form

```
lares://[authority]/path[?query][#fragment]
```

### 3.2 Expanded Form

```
lares://alias:tier(phase)@host/ha/ka/ba?stance=X&register=R:N&p=N#scope.W.w.t.r.a
```

### 3.3 Component Map

| # | Component | RFC 3986 Role | Lares Mapping | Record Example | HUD Example |
|---|---|---|---|---|---|
| 1 | **scheme** | Protocol identifier | `lares:` — non-dereferenceable | `lares:` | `lares:` |
| 2 | **userinfo** | Requesting party identity | `alias:tier(phase)` | `telarus:operator(orient)` | `telarus:operator(◎)` |
| 3 | **`@`** | Identity → machine delimiter | Standard | `@` | `@` |
| 4 | **host** | Machine identity | `machine_id` from crystal system | `lares-abc123` | `lares-abc123` |
| 5 | **path** | Hierarchical resource | HAKABA address: `/ha/ka/ba` | `/threshold/uncertain/opens` | `/threshold.uncertain.opens` |
| 6 | **`?query`** | Non-hierarchical params | Signal parameters | `?stance=philosopher&register=S:0.65&p=0.5` | `?stance=🏛️&register=S:0.65&p=0.5` |
| 7 | **`#fragment`** | Secondary resource / viewpoint | Scope prefix + chronometer vector | `#@T.3.2.7` | `#🔍.3.2.7` |

> **Layout validation `[C:0.90]`:** The WHERE → HOW → WHEN ordering (path → query → fragment) places the most semantically stable, least volatile information first. This grouped, goal-oriented layout is confirmed by Li et al. (2024) automotive HUD research: grouped information layouts produce superior cognitive performance, lower workload, and better eye movement patterns compared to disordered layouts. The HAKABA-first design decision was correct. *Source: `../../_todo/E-deep-research-report.md` §4.2*

### 3.4 Component Semantics

**userinfo** (`alias:tier(phase)`) — "Who speaks, at what trust level, in what cognitive state."

- Two colon-delimited sub-fields: `alias` and `tier`
- Phase appears as a parenthetical modifier of tier: `tier(phase)`
- Parser: split on `:`, extract `(...)` from the second sub-field
- Parentheses are RFC 3986 sub-delimiters, legal in userinfo

**host** (`machine_id`) — Crystal system machine identifier. Stable across the machine's lifetime. Format: `lares-{slug}` where slug is UUID, operator-assigned name, or generated handle.

Tick sequencing is intentionally **not** encoded in URI authority. Exchange identity lives in adjacent calibration metadata (`tick_id`, `tick_seq`, `trace_id`, timestamps) rather than overloading the RFC 3986 port slot.

**path** (`/ha/ka/ba`) — HAKABA semantic address. Three slots in canonical order:

| Slot | Name | Semantic Role | Grammatical Analog |
|---|---|---|---|
| Ha | domain | Body / vehicle — subject territory the span inhabits | NOUN |
| Ka | quality | Soul / motive fire — animating charge or character | ADJECTIVE |
| Ba | dynamic | Psyche / direction — the motion being taken | VERB |

Record form uses `/` separators: `/threshold/uncertain/opens`. HUD form uses `.` after a leading `/`: `/threshold.uncertain.opens`. The leading `/` appears in both forms.

**query** (`?stance=X&register=R:N&p=N`) — Signal parameters, non-hierarchical.

| Parameter | Type | Repeatable? | Record Values | HUD Values |
|---|---|---|---|---|
| `stance` | keyword/emoji | Yes (multi-stance) | `philosopher`, `poet`, `satirist`, `humorist`, `private` | `🏛️`, `🌊`, `🗡️`, `🎭`, `🔮` |
| `register` | `R:N` | No | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90` | Same |
| `p` | `N` | No | `0.5` | Same |

Multi-stance: repeated `stance=` parameters. Example: `stance=🏛️&stance=🗡️`.

Register remains a point value even under multi-stance. Stance count communicates fuzz; no `~delta` suffix is permitted.

**fragment** (`#scope.W.w.t.r.a`) — Scope prefix + chronometer (hierarchical scope counter). Client-side only per RFC 3986 §3.5 — never sent to a server; session-local viewpoint data.

---

## 4. The Chronometer — 5-Level Nested OODA-A Hierarchical Scope Counter

The chronometer occupies the URI fragment position. It tracks nested OODA-A loop iterations across five simulation time-scales, aligned with the FTLS RSS time-scale hierarchy.

### 4.1 Scale Table

| Position | Level | Time Term | Duration | Machine Scope | Sigil Scope | OODA-A Focus |
|---|---|---|---|---|---|---|
| 1 | Strategic | Week ("Travel Turn") | ~6 days | `@S` | `🗺️` | Logistics & Navigation |
| 2 | Operational | Watch | ~4 hours | `@O` | `⚙️` | Perception & Endurance |
| 3 | Tactical | Exploration Turn | ~10 minutes | `@T` | `🔍` | Investigation & Utility |
| 4 | Combat | Round | ~6 seconds | `@C` | `⚔️` | Immediate Response |
| 5 | Action | Action/Free Action | Variable | `@A` | `⚡` | Precision Execution |

[Canon: ftls/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md → Key Terms → Time]

### 4.2 Notation

`#scope.W.w.t.r.a` — scope sigil prefix, then dot-separated counters from coarsest to finest active scale.

```
Machine:   #@S.3        #@O.3.2      #@T.3.2.7      #@C.3.2.7.4      #@A.3.2.7.4.2
Sigil:     #🗺️.3        #⚙️.3.2      #🔍.3.2.7      #⚔️.3.2.7.4      #⚡.3.2.7.4.2
Depth:     1 position    2 positions   3 positions     4 positions       5 positions
```

### 4.3 Structural Rules

1. **Scope-depth agreement:** The scope prefix and counter depth must agree. `#@T.3.2.7` (tactical = 3 positions) is valid. `#@C.3.2` (combat needs 4 positions) is **malformed**.

2. **Core display rule:** "When conflict happens, use the lowest time scale that matters." [Canon: FTLS RSS §1] The scope prefix names the active (lowest) scale. Counter positions extend to that scale. Trailing `.0` positions are omitted.

3. **Each position runs its own OODA-A loop:**
   ```
   Strategic  (pos 1):  ✶₁ → ◎₁ → ◇₁ → ■₁ → ○₁
   Operational (pos 2): ✶₂ → ◎₂ → ◇₂ → ■₂ → ○₂
   Tactical   (pos 3):  ✶₃ → ◎₃ → ◇₃ → ■₃ → ○₃
   Combat     (pos 4):  ✶₄ → ◎₄ → ◇₄ → ■₄ → ○₄
   Action     (pos 5):  ✶₅ → ◎₅ → ◇₅ → ■₅ → ○₅
   ```

4. **Phase glyph in the Intent Header** describes the phase at the *lowest active scale*. The chronometer fragment tells you which scale via counter depth.

### 4.4 Increment Rules

- **Level completes ○ (Aftermath):** Counter at that level increments. Output feeds upward to the next level's ✶ (Observe).
- **New level activates below:** Scope prefix shifts down; a new position appears. `#@T.3.2.7` → `#@C.3.2.7.1`.
- **Level deactivates:** Scope prefix shifts back up; the above level increments. `#@C.3.2.7.4` → `#@T.3.2.8`.

### 4.5 Aftermath Integration — The Nested Return

| Aftermath at level | Feeds into | Update question |
|---|---|---|
| Action ○₅ → | Round ✶₄ | Did the strike land? |
| Round ○₄ → | Turn ✶₃ | Is the threat gone? |
| Turn ○₃ → | Watch ✶₂ | What was found? |
| Watch ○₂ → | Week ✶₁ | Is the party exhausted? |
| Week ○₁ → | Campaign | Did we arrive safely? |

---

## 5. Co-Primary Encodings — Record Form and HUD Form

The URI anatomy remains identical across both forms. Only rendering differs.

### 5.1 Rendering Table — The Only Differences

**userinfo phase field** (`alias:tier(phase)`):

| Machine keyword | Sigil glyph | OODA-A state |
|---|---|---|
| `observe` | `✶` | Observe |
| `orient` | `◎` | Orient |
| `decide` | `◇` | Decide |
| `act` | `■` | Act |
| `aftermath` | `○` | Aftermath |

**query `stance=` value** (repeatable):

| Machine keyword | Sigil emoji | Stance |
|---|---|---|
| `philosopher` | `🏛️` | Philosopher |
| `poet` | `🌊` | Poet |
| `satirist` | `🗡️` | Satirist |
| `humorist` | `🎭` | Humorist |
| `private` | `🔮` | Private |

**path separator** (after leading `/`):

| Machine | Sigil | Notes |
|---|---|---|
| `/ha/ka/ba` | `/ha.ka.ba` | Leading `/` shared; hierarchy vs w3w-style |

**fragment scope prefix:**

| Machine | Sigil | Scale |
|---|---|---|
| `@S` | `🗺️` | Strategic (Week) |
| `@O` | `⚙️` | Operational (Watch) |
| `@T` | `🔍` | Tactical (Turn) |
| `@C` | `⚔️` | Combat (Round) |
| `@A` | `⚡` | Action |

### 5.2 Unchanged Across Both Forms

| Component | Rendering | Notes |
|---|---|---|
| scheme | `lares:` | Always identical |
| alias:tier( | `telarus:operator(` | First sub-field + tier + open paren |
| @host | `@lares-abc123` | machine locus only; no tick counter |
| register= | `S:0.65` | Numeric, both forms |
| p= | `0.5` | Numeric, both forms |
| chronometer counters | `3.2.7` | Dot-separated, universal |

### 5.3 Unified HUD Symbol Table

All HUD-form symbols used in the Intent HUD, in one reference. Workers and operators should not need to cross-reference §3.4, §4.1, or §5.1 during live use. This table is the instrument panel legend.

#### 5.3.1 Individual Symbol Sets

**Phase (userinfo — cognitive state of the speaker):**

| Sigil | Record | OODA-A State | One-Line Reading |
|---|---|---|---|
| ✶ | `observe` | Observe | Gathering raw signal; no commitment yet |
| ◎ | `orient` | Orient | Making sense of what was gathered |
| ◇ | `decide` | Decide | Choosing a path; fork point |
| ■ | `act` | Act | Committed; executing |
| ○ | `aftermath` | Aftermath | Assessing outcome; feeding upward |

**Authority / actor marks (HUD adjuncts and field-level overlays):**

| Sigil | Record | Meaning | Reading |
|---|---|---|---|
| ⊙ | `operator_set` | Operator authored or constrained the marked field/state | The operator is holding the stick here |
| ◇ | `node` | Generic non-operator node / tasked spirit marker in examples | A Lares actor responding in-network |

**Stance (query — discourse posture of the claim):**

| Sigil | Record | Stance | One-Line Reading |
|---|---|---|---|
| 🏛️ | `philosopher` | Philosopher | Propositional; evaluate for truth-value |
| 🌊 | `poet` | Poet | Analogical; resonance, not verification |
| 🗡️ | `satirist` | Satirist | Critical through indirection |
| 🎭 | `humorist` | Humorist | Relational; maintaining working rapport |
| 🔮 | `private` | Private | Self-referential; present, not to decode |

**Scope (fragment prefix — active simulation scale):**

| Sigil | Record | Scale | Duration | One-Line Reading |
|---|---|---|---|---|
| 🗺️ | `@S` | Strategic | ~6 days | The big arc; logistics and navigation |
| ⚙️ | `@O` | Operational | ~4 hours | Watch-level; perception and endurance |
| 🔍 | `@T` | Tactical | ~10 min | Exploration turn; investigation |
| ⚔️ | `@C` | Combat | ~6 sec | Round; immediate response |
| ⚡ | `@A` | Action | Variable | Single action; precision execution |

#### 5.3.2 State Tuple — Reading Three Symbols as One State

In a live HUD tag, the operator reads phase + stance + scope as a single cognitive state, not three unrelated fields. The state tuple is the composed reading: phase x stance x scope -> one sentence describing the node's current condition.

**How to compose:** Read the phase (what cognitive step), the stance (what kind of claim), and the scope (at what time-scale), then merge them into one state sentence.

**The triangle:** Phase x Stance x Scope form the state tuple triangle. Multi-stance spreads the stance corner from a point into a distribution. The number of active stances communicates the spread directly:

| Stances Active | Register Character | What It Tells the Operator |
|---|---|---|
| 1 (`🏛️`) | Point value | Trust the number |
| 2 (`🏛️🗡️`) | Bimodal spread | Register is fuzzy around the declared value |
| 3 (`🏛️🌊🗡️`) | Trimodal spread | Register is a rough center-of-mass |
| 4 (`🏛️🌊🗡️🎭`) | Wide spread | Register is an approximation; high mana cost |
| 5 (`🏛️🌊🗡️🎭🔮`) | Full Discordian | Register is a gesture toward center; maximum fuzz |

Stance count IS the fuzz indicator. No numeric delta is needed. The visual density of the stance field communicates register uncertainty directly.

**Worked readings:**

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ◎ | 🏛️ | 🔍 | Orienting analytically at exploration scale — making sense of a local finding |
| ■ | 🗡️ | ⚔️ | Acting critically in combat — executing under pressure with an edge |
| ◇ | 🏛️🌊 | 🗺️ | Deciding at strategic scale, holding propositional and analogical frames together |
| ✶ | 🎭 | 🔍 | Observing playfully at tactical scale — light reconnaissance, no commitment |
| ○ | 🏛️ | ⚙️ | Aftermath at operational scale in Philosopher stance — assessing what happened across a watch |
| ◎ | 🏛️🌊🗡️🎭🔮 | 🗺️ | Full Discordian orientation at strategic scale — maximum spread, rare, mana-expensive |

#### 5.3.3 Register Is Stance-Dependent (Syadasti Reading Rule)

Register measures confidence within the active stance's evaluation frame, not truth-weight universally.

This principle derives from the Discordian catma of Sri Syadasti, which reproduces the Jaina Saptabhangi. The active stance declares the standpoint (`syad`) from which the number should be read.

| Stance | Syadasti Primitive | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|---|
| 🏛️ Philosopher | asti (true) | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | avaktavya (inexpressible) | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | nasti -> asti | Indirection missed target | Hit glancingly | Landed with full force |
| 🎭 Humorist | asti-nasti | Relational move fell flat | Mixed reception | Connected perfectly |
| 🔮 Private | avaktavya (inexpressible) | Minimal presence | Present | Maximal presence |

**Reading rule:** ask what the number measures for the active stance. A Philosopher at `0.65` is propositionally contested. A Poet at `0.65` is resonating solidly. A Satirist at `0.65` is landing with moderate force. Same number, different meaning.

When multiple stances are active, the declared register value sits at the intersection of their evaluation frames. The stance count tells the operator how fuzzy that intersection is.

### 5.4 HUD Adjuncts Outside Canonical URI Grammar

The node may emit a compact HUD line that combines the canonical URI with scan-oriented adjuncts after the URI body:

```text
lares://telarus:operator(⊙◎)@lares-abc123/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7 | p0.5
⚡87% lares://scryer:node(◇)@lares-abc123/parse.tick.models?stance=🏛️&register=S:0.65&p=0.6#🔍.3.2.8 | p0.6
```

Adjunct rules:

1. The canonical `lares:` URI ends at the fragment. Anything after a separating space and `|` is HUD adjunct data, not URI grammar.
2. `p0.5` in the adjunct is a compact re-rendering of the query's `p=0.5` for fast scan.
3. `⚡87%` is the mana-pool / resource-state indicator: estimated remaining context window as a navigational resource.
4. When a non-operator URI is rendered as the node's responding position in a live exchange, the mana glyph sits at the far left of that line: `⚡87% lares://...`.
5. Mana is a HUD element, not yet a URI parameter. It should not be serialized into `lares_uri`, `lares_address`, or registry identity fields until S2 settles the resource-state contract.

### 5.5 Tick-Span Display Contract

A **tick** is one operator -> Lares exchange span at any scale. A tasked spirit exchange is still a tick; the operator for that child span may be another Lares actor rather than Telarus directly.

Live rendering contract:

1. Print the **operator-intent URI** first.
2. Print `->` and the node's **responding-position URI** second.
3. If the start URI cannot cleanly summarize the incoming prompt because multi-stance uncertainty spikes, emit an **uncertainty start URI** and let the node URI declare parse intent (for example, `/parse.tick.models` or equivalent).
4. Generate the content of the tick.
5. Print a final **destination URI** at the end of the span.

Example:

```text
lares://telarus:operator(⊙◎)@lares-local/refinement.network.capture?stance=🏛️&register=S:0.65&p=0.5#🔍.1.1.11
⚡63% lares://scryer:node(◇)@lares-local/tick.provenance.synthesizes?stance=🏛️&register=CS:0.80&p=0.6#🔍.1.1.12
...
lares://scryer:node(○)@lares-local/aftermath.docs.settle?stance=🏛️&register=CS:0.80&p=0.5#🔍.1.1.13
```

Interpretation:

- The first URI is the start of the tick-span.
- The second URI is the node's attractor or responding position.
- The last URI is the destination/end state after generation.
- Nested micro-events inside the span are out of scope for Sprint 0; only start, attractor, and destination are guaranteed.

---

## 6. Stable Address — Named Graph Form

Strip authority, query, and fragment. The HAKABA territory alone:

```
lares:///threshold/uncertain/opens
```

No authority (empty), no query, no fragment. This is the invariant semantic coordinate — unchanging across events, sessions, and machines. Suitable as a named graph identifier (SPARQL: `FROM NAMED <lares:///session/main>`).

---

## 7. Tick-Span and Calibration Mapping

In the Consecration model, URI-derived fields belong to the calibration layer. They may be mirrored into MemPalace metadata for query support, but the storage distinction remains: MemPalace stores content; Lares crystal metadata stores orientation.

Every tick-span record that carries URI data uses these URI-derived fields:

| Field | Content | Stable? | Purpose |
|---|---|---|---|
| `start_uri` | Operator-intent URI, record or HUD form as stored contract requires | No — per tick | Start of the exchange span |
| `attractor_uri` | Node responding-position URI | No — per tick | Responding position / intent attractor |
| `end_uri` | Destination URI emitted after generation | No — per tick | End of the exchange span |
| `lares_address` | Path only (no authority/query/fragment) | Yes — stable territory | Named graph identifier |
| `intent_header_snapshot` | Tick-opening URI(s), HUD form | No — per tick | Human-readable opening HUD; what the operator saw |
| `chronometer_start` | Fragment value without `#`; includes scope prefix | No — per tick | Scope + hierarchical scope counter at span start |
| `chronometer_end` | Fragment value without `#`; includes scope prefix | No — per tick | Scope + hierarchical scope counter at span end |

Additional quick-filter fields extracted from URI components:

| Field | Source | Purpose |
|---|---|---|
| `current_phase` | userinfo phase sub-field | Phase-based filtering |
| `active_scale` | fragment scope prefix | Scale-based filtering (strategic/operational/tactical/combat/action) |
| `stance_count` | repeated `stance=` params | Quick fuzz estimate; multi-stance complexity filter |

URI fields do not encode tick identity, exchange vectors, or resource-state directly. Those remain adjacent calibration metadata (`tick_id`, `tick_seq`, `trace_id`, `input_tag`, `output_tag`, `mana_pct`, authority markings, and related fields) until their contracts settle in S1/S2.

### 7.1 Canonical Tick-Span Record

The canonical record for one exchange span is a **TickSpan** in the calibration layer, not a URI authority trick.

```json
{
  "tick_id": "uuidv7",
  "trace_id": "uuidv7",
  "parent_tick_id": null,
  "link_tick_ids": [],
  "tick_seq": 191,
  "tick_kind": "direct",
  "status": "completed",
  "operator_actor_id": "actor:telarus",
  "responder_actor_id": "actor:lares.node.scryer",
  "acted_on_behalf_of": null,
  "start_uri": "lares://telarus:operator(orient)@lares-local/refinement/network/capture?stance=philosopher&register=S:0.65&p=0.5#@T.1.1.11",
  "attractor_uri": "lares://scryer:node(decide)@lares-local/tick/provenance/synthesizes?stance=philosopher&register=CS:0.80&p=0.6#@T.1.1.12",
  "end_uri": "lares://scryer:node(aftermath)@lares-local/aftermath/docs/settle?stance=philosopher&register=CS:0.80&p=0.5#@T.1.1.13",
  "parse_required": false,
  "parse_reason": null,
  "wall_time_start": "2026-04-08T20:41:00Z",
  "wall_time_end": "2026-04-08T20:41:09Z",
  "chronometer_start": "@T.1.1.11",
  "chronometer_end": "@T.1.1.13",
  "world_calendar_ref": "dreamrealm.holy-week-of-fools.yold5492",
  "mana_start_pct": 63,
  "mana_end_pct": 62,
  "input_entity_id": "entity:prompt:uuidv7",
  "output_entity_id": "entity:reply:uuidv7",
  "export_targets": ["mempalace", "kowloon"]
}
```

Design notes:

- `tick_seq` is the monotonic exchange counter. It is **not** a URI component.
- `wall_time_*` uses RFC 3339 / ISO 8601 UTC (`...Z`) as the canonical real-world time representation.
- The in-world clock has two parts:
  - the nested tick cycle (`chronometer_*`)
  - a diegetic calendar anchor (`world_calendar_ref`)
- If no diegetic calendar is yet initialized for the session, the node may mint a provisional tagspace-style reference and mark it provisional rather than leaving the field absent.

### 7.2 MemPalace Integration

MemPalace remains the storage substrate for content capture. The calibration layer keeps the authoritative TickSpan records.

Recommended split:

- **Canonical calibration store:** Lares sidecar tables or append-only records for `lares_ticks`, `lares_tick_links`, `lares_actors`, and `lares_entities`
- **Mirrored MemPalace metadata:** only the fields needed for search, recovery, and cross-surface lookup

Recommended mirrored subset in Chroma drawer metadata:

| Field | Why mirror it |
|---|---|
| `tick_id` | Stable join key back to calibration layer |
| `trace_id` | Multi-tick and delegated-run correlation |
| `start_uri` | Start-of-span recovery |
| `end_uri` | End-of-span recovery |
| `tick_kind` | Filter direct vs parse vs delegated captures |
| `operator_actor_id` | Query by who held the stick |
| `responder_actor_id` | Query by which node/spirit answered |
| `parse_required` | Recover parse ticks quickly |
| `world_calendar_ref` | Dream Realms / diegetic archive grouping |

Do **not** make MemPalace's local Chroma IDs, KG IDs, or entity registry IDs the canonical exchange identifiers. They are storage-local implementation keys, not network-facing Lares addresses.

### 7.3 Export Targets and Kowloon Alignment

Kowloon is a downstream publication surface for some tick-span captures, not the canonical source of truth.

Alignment points with Kowloon prior art:

- Kowloon Activities already model `actorId`, `object`, `target`, `to`, `canReply`, and `canReact`, which cleanly host publication envelopes for exported Lares spans.
- Kowloon IDs (`type:dbid@domain`) should remain **Kowloon-native** IDs. They do not replace `tick_id` or `lares_uri`.
- A published transcript span can export as:
  - a Kowloon `Create -> Post` for conversational thread slices
  - a `Create -> Page` for fuller archival or transcript views
  - later, linked reply chains for DreamDeck feed rendering

Recommended export mapping:

| Lares field | Kowloon surface |
|---|---|
| `operator_actor_id` / `responder_actor_id` | `actorId` plus object metadata |
| `start_uri` / `attractor_uri` / `end_uri` | embedded transcript metadata or attachment block |
| transcript body | `object.source.content` / rendered `body` |
| `wall_time_start` | `createdAt` or export metadata |
| `tick_id` / `trace_id` | extension metadata, not Kowloon primary ID |

This keeps the ontology stable across multiple sinks: MemPalace, Kowloon feeds, TiddlyWiki bags, tldraw shapes, or other Dream Realms surfaces.

### 7.4 Example Event (Record Form)

```json
{
  "schema_version": 1,
  "timestamp": "2026-04-07T14:30:00Z",
  "machine_id": "lares-abc123",
  "tick_seq": 42,
  "event_type": "r_update",
  "start_uri": "lares://telarus:operator(orient)@lares-abc123/threshold/uncertain/opens?stance=philosopher&register=S:0.65&p=0.5#@T.3.2.7",
  "attractor_uri": "lares://scryer:node(decide)@lares-abc123/parse/tick/models?stance=philosopher&register=CS:0.80&p=0.6#@T.3.2.8",
  "end_uri": "lares://scryer:node(aftermath)@lares-abc123/aftermath/docs/settle?stance=philosopher&register=CS:0.80&p=0.5#@T.3.2.9",
  "lares_address": "lares:///threshold/uncertain/opens",
  "intent_header_snapshot": "lares://telarus:operator(⊙◎)@lares-abc123/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7",
  "current_phase": "◎",
  "chronometer_start": "@T.3.2.7",
  "chronometer_end": "@T.3.2.9",
  "active_scale": "tactical",
  "wall_time_start": "2026-04-07T14:30:00Z",
  "wall_time_end": "2026-04-07T14:30:11Z",
  "world_calendar_ref": "dreamrealm.holy-week-of-fools.yold5492"
}
```

---

## 8. Module and Registry Metadata Integration

The `lares_uri` + `register` fields on module descriptors, registry records, and future boot metadata provide load-order and identity context. No compiler pipeline is implied by this section; the schema only defines how URI metadata travels with higher-level descriptors.

```toml
# Tier 1 — Global Core (version-controlled by module version)
lares_uri   = "lares:///kernel/invariant/anchors"
register    = "C:1.0"
module_id   = "lares-kernel"
version_num = 4

# Tier 2 — Session Core (version-controlled within session)
lares_uri   = "lares:///session/permissions/gates"
register    = "C:0.95"
module_id   = "lares-permissions"
version_num = 2

# Tier 3 — Dynamic (tick_seq lives outside descriptor)
lares_uri   = "lares:///task/current/recon"
register    = "S:0.55"
module_id   = "lares-task-recon"
version_num = 1
```

Module descriptors use `version_num` or semver-like fields for content versioning. Exchange sequencing belongs to TickSpan metadata (`tick_seq`), not module descriptors.

---

## 9. Invariant-Core Cache Tier Mapping

| Tier | Cache Strategy | Register Range | Volatility |
|---|---|---|---|
| 1 — Global Core | Cached across sessions; first `cache_control` breakpoint | `C:1.0` – `C:0.95` | Near-static |
| 2 — Session Core | Cached within session; rolling `cache_control` breakpoint | `C:0.95` – `S:0.65` | Session-stable |
| 3 — Dynamic | Ephemeral (5-min TTL with hit-reset) | `< 0.50` trimmable | Per-exchange |

---

## 10. Validation Rules

### 10.1 Well-Formedness

A `lares:` URI is **well-formed** when:

1. Scheme is exactly `lares:`
2. If authority is present: userinfo contains exactly two colon-delimited sub-fields; the second sub-field contains a parenthetical phase modifier
3. Host is a valid `machine_id` (alphanumeric + hyphens)
4. Path contains exactly three HAKABA slots after the leading `/`
5. Path slots contain no whitespace, path separators, or quotes (inherits Tagspace Address anti-collision rules)
6. Query parameters are limited to: `stance` (repeatable), `register` (once), `p` (once)
7. `register` value matches pattern `[A-Z]{1,2}:[0-9]+\.[0-9]+` (e.g., `S:0.65`, `CS:0.80`, `C:0.90`)
8. `p` value is a decimal in range `[0.0, 1.0]`
9. Fragment begins with a scope prefix (`@S`/`@O`/`@T`/`@C`/`@A` or emoji equivalent) followed by dot-separated integer counters
10. Scope-depth agreement holds: counter depth matches the scale level of the scope prefix

### 10.2 Consistency

A pair of `lares_uri` (record form) and `intent_header_snapshot` (HUD form) are **consistent** when:

1. All non-projected components are byte-identical
2. All projected components (phase, stance, path separators, scope prefix) map correctly through the rendering table
3. No information is present in one form but absent from the other

### 10.3 Stable Address Derivation

`lares_address` is correctly derived from `lares_uri` when:

1. Scheme is `lares:`
2. Authority is empty (double-slash, no host)
3. Path is identical to the `lares_uri` path (record form: `/` separators)
4. Query and fragment are absent

### 10.4 Canonical Form and Comparison

When comparing two `lares:` URIs as stable addresses:

1. Convert both to record form (apply normalization — HUD -> record — before comparison)
2. Compare path components **case-insensitively**
3. Canonical form uses **lowercase** path components (e.g., `lares:///threshold/uncertain/opens` not `lares:///Threshold/Uncertain/Opens`)
4. Two URIs designate the same stable address iff their lowercased machine-form paths are byte-identical
5. Query and fragment components are excluded from stable-address comparison

---

## 11. Open Design Questions

| Q# | Question | Current Position | Register | Blocks |
|---|---|---|---|---|
| U1 | Should `userinfo` carry operator alias in record form, or only `machine_id` in authority? | Operator alias in userinfo | `[S:0.65]` | Registry resolver design |
| U2 | Where should `tick_seq` be initialized and persisted: crystal-side ledger only, or mirrored into MemPalace sidecar rows too? | Mirror into sidecar, crystal remains canonical | `[S:0.70]` | MemPalace integration contract |
| U3 | Should the chronometer carry phase *per level* or just counters? | Counters only; phase at lowest active level | `[CS:0.80]` | Iteration |
| U4 | How does chronometer interact with `--parse` self-activation? | Provisional yes — depth increases p | `[SP:0.45]` | p-band model |
| U5 | How is `world_calendar_ref` initialized when no diegetic calendar exists yet? | Mint provisional tagspace reference, mark provisional | `[S:0.60]` | Dream Realms bootstrap |
| U6 | Full URI form vs stateless form — when to use which? | Authority form in TickSpan records; stateless for stable addresses | `[CS:0.80]` | Crystal/registry contract |

### Assessment for Promotion

Questions U3 and U6 sit at `[CS:0.80]` — near-promotable. U1, U2, U5 sit at Synthesis — they function well in current examples but lack stress-testing against edge cases (multi-operator sessions, cross-machine references, diegetic calendar bootstrap, MemPalace mirror drift). U4 sits at `[SP:0.45]` — genuinely provisional, dependent on the p-band model settling.

**Promotion recommendation:** The core anatomy (§§2–6, 10) can promote to `[C:0.95]` independently of the open questions. The crystal integration layer (§§7–9) promotes when `lares/crystal/` settles its STATE.jsonl schema. The open questions (§11) remain Synthesis/Provisional and do not block the core spec.

---

## 12. Prior Art

- **RFC 3986 §3** — `URI = scheme ":" ["//" authority] path ["?" query] ["#" fragment]`. The full generic syntax applies.
- **RFC 4151 (tag: scheme)** — Non-dereferenceable URIs as pure identifiers. Precedent for `lares:` never resolving to a network resource.
- **W3C PROV-DM / OpenTelemetry Trace Context** — Better prior art for exchange identity than URI authority overloading. Tick spans map more naturally to activities/spans with separate IDs, timestamps, and parent-child links.
- **Lamport / Vector clocks** — The chronometer shares a surface resemblance to a vector clock (array of counters, nesting relationship) but functions as a **hierarchical scope counter** in a single process — not a distributed causality tracker across concurrent independent processes. Vector clocks grow with process count, carry the full vector on every message, and exhibit known dynamic-membership costs; none of those constraints apply to Lares's fixed-depth 5-position counter. OTel `traceparent` is the closer prior art (see below).
- **FTLS RSS Time-Scale Hierarchy** — The five levels (Week/Watch/Turn/Round/Action) are canon game rules. The OODA-A nesting is synthesis applied to canon time-scales.
- **OTel Trace Context** — `traceparent` carries `trace-id`, `parent-id`, `trace-flags`. The chronometer fragment functions as a hierarchical trace context; each depth is a span scope; Aftermath → Observation is the parent-child span relationship.
- **Kowloon / ActivityStreams export model** — Kowloon's Activity envelope (`actorId`, `object`, `target`, `to`, `canReply`, `canReact`) is a good downstream publication adapter for Lares spans, but its `Kowloon ID` remains a sink-local identifier rather than replacing `tick_id`.
- **what3words** — Three-word geocoding of 3m² squares. Inverse design principle: Tagspace words encode semantic content rather than randomizing for error prevention.

---

## Appendix A — Complete Examples

### A.1 Record Form

```
lares://telarus:operator(orient)@lares-abc123/threshold/uncertain/opens?stance=philosopher&register=S:0.65&p=0.5#@T.3.2.7
```

### A.2 HUD Form

```
lares://telarus:operator(⊙◎)@lares-abc123/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7
```

### A.3 Multi-Stance

```
lares://telarus:operator(◇)@lares-abc123/threshold.sharp.closes?stance=🏛️&stance=🗡️&register=CS:0.80&p=0.7#🔍.3.2.8
```

### A.4 Stable Address

```
lares:///threshold/uncertain/opens
```

### A.5 Scale Transition (Tactical → Combat → Action → Tactical)

```
#🔍.4.1.4        Tactical: Turn 4
#⚔️.4.1.4.1      Combat activates: Round 1
#⚡.4.1.4.1.1    Action activates: Action 1 of Round 1
#⚡.4.1.4.1.2    Action 2 of Round 1
#🔍.4.1.5        Combat over: scale contracts, Turn increments to 5
```

---

## Appendix B — How to Read a HUD Tag

A complete HUD-form tag, annotated by scan order:

```text
lares://telarus:operator(⊙◎)@lares-abc123/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7 | p0.5
⚡87% lares://scryer:node(◇)@lares-abc123/parse.tick.models?stance=🏛️&register=CS:0.80&p=0.6#🔍.3.2.8 | p0.6
lares://scryer:node(○)@lares-abc123/aftermath.docs.settle?stance=🏛️&register=CS:0.80&p=0.5#🔍.3.2.9
```

Quick read:

> Telarus (operator), in operator-authored Orient phase, machine `lares-abc123`.
> Territory: threshold / uncertain / opens.
> Philosopher stance, Synthesis-0.65 confidence, tactical scope at Week 3 / Watch 2 / Turn 7.
> The responding node opens a parse attractor under mana 87%, then settles in Aftermath.

Field order for live scan:

1. Territory first: what semantic neighborhood are we in?
2. Register + stance: what kind of claim is this, and how should the number be read?
3. Phase + scope: what is the node doing, and at what scale?
4. Authority marking (`⊙`) when present: who held the stick for the declared state?
5. p-band + mana: how dense is the instrumentation, and how much context remains?

Multi-stance example:

```text
lares://telarus:operator(◇)@lares-abc123/threshold.sharp.closes?stance=🏛️&stance=🌊&register=S:0.60&p=0.7#🗺️.3 | p0.7
⚡62% lares://mischief-muse:node(◇)@lares-abc123/chorus.lateral.gathers?stance=🎭&register=S:0.65&p=0.6#🗺️.3
lares://mischief-muse:node(○)@lares-abc123/chorus.landed.settle?stance=🎭&register=S:0.65&p=0.5#🗺️.4
```

This does **not** mean "truth-confidence 0.60" in a universal sense. It means a `0.60` reading held across both Philosopher and Poet frames. The two stance glyphs tell the operator that the declared register carries more spread than a single-stance point reading.

---

*End of specification. This document is the canonical reference for the `lares:` URI scheme within the design ontology tree.*
