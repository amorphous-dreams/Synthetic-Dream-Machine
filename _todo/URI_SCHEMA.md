# `lares:` URI Schema — Canonical Specification

> Domain: `lares/signal/` · URI scheme anatomy, projection model, validation rules
> Status: `[CS:0.85]` 🏛️ — design-canon candidate; awaiting operator promotion to `[C:0.95]`
> Updated: 2026-04-08
> Source: Extracted from `_todo/core/Signal_HUD_Tagspace-draft.md` §§ Full URI Anatomy, Chronometer, Display Split, Crystal Schema Field Mapping, Prior Art
> Blocks: `lares/registry/` URI assignment; `lares/crystal/` STATE.jsonl field contract; `lares/compiler/` module descriptor `lares_uri` field
> Candidate URI: `lares://core/design/signal/uri-schema@CS:0.85`

---

## 1. Design Intent

The `lares:` URI encodes the full signal state of a Lares node exchange in a single string conforming to RFC 3986 generic syntax. Each URI component carries a distinct, non-overlapping concern across three semantic layers:

1. **WHERE** — the HAKABA address (path) locates semantic territory
2. **HOW** — signal parameters (query) describe stance, register, p
3. **WHEN** — the chronometer (fragment) locates position in nested time

The URI serves as both a human-readable annotation (sigil form) and a machine-parseable identifier (machine form). The two forms share identical structure; only glyph/keyword rendering differs.

---

## 2. Scheme Registration

| Property | Value |
|---|---|
| Scheme name | `lares` |
| Dereferenceability | Non-dereferenceable identifier (RFC 4151 precedent) |
| Resolution | Via `lares/registry/` resolver; never via network fetch |
| IANA status | Unregistered; internal use only |

The `lares:` scheme identifies semantic positions, signal states, and machine events within the Lares agent architecture. It does not resolve to a network resource. URI consumers (crystal replay tools, debug log parsers, registry resolvers) treat it as an opaque structured identifier parsed according to this specification.

---

## 3. Full URI Anatomy

### 3.1 Generic Form

```
lares://[authority]/path[?query][#fragment]
```

### 3.2 Expanded Form

```
lares://alias:tier(phase)@host:seq/ha/ka/ba?stance=X&register=R:N&p=N#scope.W.w.t.r.a
```

### 3.3 Component Map

| # | Component | RFC 3986 Role | Lares Mapping | Machine Example | Sigil Example |
|---|---|---|---|---|---|
| 1 | **scheme** | Protocol identifier | `lares:` — non-dereferenceable | `lares:` | `lares:` |
| 2 | **userinfo** | Requesting party identity | `alias:tier(phase)` | `telarus:operator(orient)` | `telarus:operator(◎)` |
| 3 | **`@`** | Identity → machine delimiter | Standard | `@` | `@` |
| 4 | **host** | Machine identity | `machine_id` from crystal system | `lares-abc123` | `lares-abc123` |
| 5 | **`:port`** | Service endpoint | `seq_num` — event sequence number | `:42` | `:42` |
| 6 | **path** | Hierarchical resource | HAKABA address: `/ha/ka/ba` | `/threshold/uncertain/opens` | `/threshold.uncertain.opens` |
| 7 | **`?query`** | Non-hierarchical params | Signal parameters | `?stance=philosopher&register=S:0.65&p=0.5` | `?stance=🏛️&register=S:0.65&p=0.5` |
| 8 | **`#fragment`** | Secondary resource / viewpoint | Scope prefix + chronometer vector | `#@T.3.2.7` | `#🔍.3.2.7` |

### 3.4 Component Semantics

**userinfo** (`alias:tier(phase)`) — "Who speaks, at what trust level, in what cognitive state."

- Two colon-delimited sub-fields: `alias` and `tier`
- Phase appears as a parenthetical modifier of tier: `tier(phase)`
- Parser: split on `:`, extract `(...)` from the second sub-field
- Parentheses are RFC 3986 sub-delimiters, legal in userinfo

**host** (`machine_id`) — Crystal system machine identifier. Stable across the machine's lifetime. Format: `lares-{slug}` where slug is UUID, operator-assigned name, or generated handle.

**port** (`seq_num`) — Monotonic event sequence number within the machine's active STATE.jsonl shard. Integers only. Increments by exactly 1 per event.

**path** (`/ha/ka/ba`) — HAKABA semantic address. Three slots in canonical order:

| Slot | Name | Semantic Role | Grammatical Analog |
|---|---|---|---|
| Ha | domain | Body / vehicle — subject territory the span inhabits | NOUN |
| Ka | quality | Soul / motive fire — animating charge or character | ADJECTIVE |
| Ba | dynamic | Psyche / direction — the motion being taken | VERB |

Machine form uses `/` separators: `/threshold/uncertain/opens`. Sigil form uses `.` after a leading `/`: `/threshold.uncertain.opens`. The leading `/` appears in both forms.

**query** (`?stance=X&register=R:N&p=N`) — Signal parameters, non-hierarchical.

| Parameter | Type | Repeatable? | Machine Values | Sigil Values |
|---|---|---|---|---|
| `stance` | keyword/emoji | Yes (multi-stance) | `philosopher`, `poet`, `satirist`, `humorist`, `private` | `🏛️`, `🌊`, `🗡️`, `🎭`, `🔮` |
| `register` | `R:N` | No | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90` | Same |
| `p` | `N` | No | `0.5` | Same |

Multi-stance: repeated `stance=` parameters. Example: `stance=🏛️&stance=🗡️`.

**fragment** (`#scope.W.w.t.r.a`) — Scope prefix + chronometer vector clock. Client-side only per RFC 3986 §3.5 — never sent to a server; session-local viewpoint data.

---

## 4. The Chronometer — 5-Level Nested OODA-A Vector Clock

The chronometer occupies the URI fragment position. It tracks nested OODA-A loop iterations across five simulation time-scales, aligned with the FTLS RSS time-scale hierarchy.

### 4.1 Scale Table

| Position | Level | Time Term | Duration | Machine Scope | Sigil Scope | OODA-A Focus |
|---|---|---|---|---|---|---|
| 1 | Strategic | Week ("Travel Turn") | ~6 days | `@S` | `🗺️` | Logistics & Navigation |
| 2 | Operational | Watch | ~4 hours | `@O` | `⚙️` | Perception & Endurance |
| 3 | Tactical | Exploration Turn | ~10 minutes | `@T` | `🔍` | Investigation & Utility |
| 4 | Combat | Round | ~6 seconds | `@C` | `⚔️` | Immediate Response |
| 5 | Action | Action/Free Action | Variable | `@A` | `⚡` | Precision Execution |

[Canon: FTLS/Flying_Triremes_and_Laser_Swords_04_Recon_Salvage_Secrets.md → Key Terms → Time]

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

## 5. Bidirectional Projection — Display Split

The URI anatomy remains identical across both forms. Only rendering differs.

### 5.1 Projection Table — The Only Differences

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
| @host:port | `@lares-abc123:42` | machine_id and seq_num |
| register= | `S:0.65` | Numeric, both forms |
| p= | `0.5` | Numeric, both forms |
| chronometer counters | `3.2.7` | Dot-separated, universal |

---

## 6. Stable Address — Named Graph Form

Strip authority, query, and fragment. The HAKABA territory alone:

```
lares:///threshold/uncertain/opens
```

No authority (empty), no query, no fragment. This is the invariant semantic coordinate — unchanging across events, sessions, and machines. Suitable as a named graph identifier (SPARQL: `FROM NAMED <lares:///session/main>`).

---

## 7. Crystal Schema Field Mapping

Every STATE.jsonl event that carries URI data uses four derived fields:

| Field | Content | Stable? | Purpose |
|---|---|---|---|
| `lares_uri` | Full URI, machine form, all components | No — changes per event | Complete queryable state; machine-parseable |
| `lares_address` | Path only (no authority/query/fragment) | Yes — stable territory | Named graph identifier |
| `intent_header_snapshot` | Full URI, sigil form | No — changes per event | Human-readable HUD; what the operator saw |
| `chronometer` | Fragment value without `#`; includes scope prefix | No — increments with time | Scope + vector clock; temporal/scale queries |

Additional quick-filter fields extracted from URI components:

| Field | Source | Purpose |
|---|---|---|
| `current_phase` | userinfo phase sub-field | Phase-based event filtering |
| `active_scale` | fragment scope prefix | Scale-based event filtering (strategic/operational/tactical/combat/action) |

### 7.1 Example Event (Machine Form)

```json
{
  "schema_version": 1,
  "timestamp": "2026-04-07T14:30:00Z",
  "machine_id": "lares-abc123",
  "seq_num": 42,
  "event_type": "r_update",
  "lares_uri": "lares://telarus:operator(orient)@lares-abc123:42/threshold/uncertain/opens?stance=philosopher&register=S:0.65&p=0.5#@T.3.2.7",
  "lares_address": "lares:///threshold/uncertain/opens",
  "intent_header_snapshot": "lares://telarus:operator(◎)@lares-abc123:42/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7",
  "current_phase": "◎",
  "chronometer": "@T.3.2.7",
  "active_scale": "tactical"
}
```

---

## 8. Module Descriptor Integration

The `lares_uri` + `register` fields on module descriptors serve as the compiler's sort key. Modules load by register descending — highest confidence first.

```toml
# Tier 1 — Global Core (version-controlled by seq_num)
lares_uri   = "lares:///kernel/invariant/anchors"
register    = "C:1.0"
module_id   = "lares-kernel"
seq_num     = 4

# Tier 2 — Session Core (version-controlled within session)
lares_uri   = "lares:///session/permissions/gates"
register    = "C:0.95"
module_id   = "lares-permissions"
seq_num     = 2

# Tier 3 — Dynamic (seq_num = event counter, not version)
lares_uri   = "lares:///task/current/recon"
register    = "S:0.55"
module_id   = "lares-task-recon"
seq_num     = 47
```

For `register >= C:0.95`, `seq_num` carries **version semantics** — it increments only on content change. For `register < C:0.95`, `seq_num` retains its original meaning as a monotonic event counter.

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
4. Port is a positive integer (the `seq_num`)
5. Path contains exactly three HAKABA slots after the leading `/`
6. Path slots contain no whitespace, path separators, or quotes (inherits Tagspace Address anti-collision rules)
7. Query parameters are limited to: `stance` (repeatable), `register` (once), `p` (once)
8. `register` value matches pattern `[A-Z]{1,2}:[0-9]+\.[0-9]+` (e.g., `S:0.65`, `CS:0.80`, `C:0.90`)
9. `p` value is a decimal in range `[0.0, 1.0]`
10. Fragment begins with a scope prefix (`@S`/`@O`/`@T`/`@C`/`@A` or emoji equivalent) followed by dot-separated integer counters
11. Scope-depth agreement holds: counter depth matches the scale level of the scope prefix

### 10.2 Consistency

A pair of `lares_uri` (machine form) and `intent_header_snapshot` (sigil form) are **consistent** when:

1. All non-projected components are byte-identical
2. All projected components (phase, stance, path separators, scope prefix) map correctly through the projection table
3. No information is present in one form but absent from the other

### 10.3 Stable Address Derivation

`lares_address` is correctly derived from `lares_uri` when:

1. Scheme is `lares:`
2. Authority is empty (double-slash, no host/port)
3. Path is identical to the `lares_uri` path (machine form: `/` separators)
4. Query and fragment are absent

---

## 11. Open Design Questions

| Q# | Question | Current Position | Register | Blocks |
|---|---|---|---|---|
| U1 | Should `userinfo` carry operator alias in machine form, or only `machine_id` in authority? | Operator alias in userinfo | `[S:0.65]` | Registry resolver design |
| U2 | Is `seq_num` as `:port` the right mapping, or should port carry something else? | seq_num as port | `[S:0.70]` | Crystal shard semantics |
| U3 | Should the chronometer carry phase *per level* or just counters? | Counters only; phase at lowest active level | `[CS:0.80]` | Iteration |
| U4 | How does chronometer interact with `--parse` self-activation? | Provisional yes — depth increases p | `[SP:0.45]` | p-band model |
| U5 | Chronometer persistence in REGISTRY.jsonl vs STATE.jsonl only? | Both — REGISTRY carries latest for quick enumeration | `[S:0.65]` | Registry schema |
| U6 | Full URI form vs stateless form — when to use which? | Authority form in STATE.jsonl; stateless for stable addresses | `[CS:0.80]` | Crystal/registry contract |

### Assessment for Promotion

Questions U3 and U6 sit at `[CS:0.80]` — near-promotable. U1, U2, U5 sit at Synthesis — they function well in current examples but lack stress-testing against edge cases (multi-operator sessions, cross-machine references, shard boundary handoffs). U4 sits at `[SP:0.45]` — genuinely provisional, dependent on the p-band model settling.

**Promotion recommendation:** The core anatomy (§§2–6, 10) can promote to `[C:0.95]` independently of the open questions. The crystal integration layer (§§7–9) promotes when `lares/crystal/` settles its STATE.jsonl schema. The open questions (§11) remain Synthesis/Provisional and do not block the core spec.

---

## 12. Prior Art

- **RFC 3986 §3** — `URI = scheme ":" ["//" authority] path ["?" query] ["#" fragment]`. The full generic syntax applies.
- **RFC 4151 (tag: scheme)** — Non-dereferenceable URIs as pure identifiers. Precedent for `lares:` never resolving to a network resource.
- **Lamport / Vector clocks** — The chronometer is structurally a vector clock with nesting. Each position is an independent counter; the full vector provides a partial ordering across scales.
- **FTLS RSS Time-Scale Hierarchy** — The five levels (Week/Watch/Turn/Round/Action) are canon game rules. The OODA-A nesting is synthesis applied to canon time-scales.
- **OTel Trace Context** — `traceparent` carries `trace-id`, `parent-id`, `trace-flags`. The chronometer fragment functions as a hierarchical trace context; each depth is a span scope; Aftermath → Observation is the parent-child span relationship.
- **what3words** — Three-word geocoding of 3m² squares. Inverse design principle: Tagspace words encode semantic content rather than randomizing for error prevention.

---

## Appendix A — Complete Examples

### A.1 Machine Form

```
lares://telarus:operator(orient)@lares-abc123:42/threshold/uncertain/opens?stance=philosopher&register=S:0.65&p=0.5#@T.3.2.7
```

### A.2 Sigil Form

```
lares://telarus:operator(◎)@lares-abc123:42/threshold.uncertain.opens?stance=🏛️&register=S:0.65&p=0.5#🔍.3.2.7
```

### A.3 Multi-Stance

```
lares://telarus:operator(◇)@lares-abc123:43/threshold.sharp.closes?stance=🏛️&stance=🗡️&register=CS:0.80&p=0.7#🔍.3.2.8
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

*End of specification. This document is the canonical reference for the `lares:` URI scheme within the design ontology tree.*
