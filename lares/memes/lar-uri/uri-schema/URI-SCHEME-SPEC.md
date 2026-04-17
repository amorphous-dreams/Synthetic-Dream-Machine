<!-- ∞ → lar:///ha.ka.ba/uri-scheme-spec/?confidence=CS:0.95&p=0.5 -->

# `lar:` URI Scheme Specification

> Domain: `lar/modules/uri-schema/` · scheme grammar, syntax rules, validation, stable address
> Status: `[CS:0.95]` 🏛️ — RFC-grade scheme definition; slow-changing stone tablet
> Updated: 2026-04-10
> Version: 1 (fissioned from URI-SCHEMA.md v3)
> Companion: `URI_OPERATIONS.md` — operational semantics, exchange protocol, render targets, marker ontology
> Blocks: IANA registration (`lar:` scheme), URI parser implementations, canonical form comparators

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.95#scheme-registration -->
## 1. Scheme Registration

- **Scheme name:** `lar`
- **Status:** unregistered (pre-IANA)
- **Category:** non-dereferenceable — a `lar:` URI never resolves to a network resource
- **Precedent:** RFC 4151 (`tag:` scheme) — pure identification without dereferencing
- **Canonical form:** record form, RFC 3986-compliant. See §2 and §5.
- **HUD form compliance:** `lar:` URIs in HUD / render-target surfaces diverge from strict RFC 3986 (emoji substitution). These are *render targets*, not canonical URIs. See companion `URI_OPERATIONS.md` §6.

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.85#uri-syntax -->
## 2. URI Syntax

### 2.1 Generic Form

```
lar://[authority]/ha.ka.ba/optional/path/[?query][#fragment] <!-- uri-ok -->
```

### 2.2 Expanded Form

**Full form (with authority):**

```
lar://alias:tier@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N#chronometer <!-- uri-ok -->
```

Where `stances=XXXXX` is the five-character stance amplitude string (see §2.4 query).

**Authority-less form** (no `user@host` segment — territory or resource reference without a named speaker):

```
lar:///ha.ka.ba/optional/path/[?query][#fragment]
```

Three slashes: scheme + `//` (empty authority) + path beginning with `/`. Use this form for stable named graph addresses, HA.KA.BA references, and any URI where the speaker identity is not the point.

**Path notation rule** — HA.KA.BA paths use **dot notation** for the three mandatory slots. The leading and trailing `/` is retained; dots between the generated words that fill the `ha`, `ka`, and `ba` slots:

```
/ha.ka.ba/{optional/sub/path}[?query][#fragment]
```

This applies to authority-less forms as well: `lar:///ha.ka.ba/` — the (0,0,0) of tagspace.

### 2.3 Component Map

| # | Component | RFC 3986 Role | lar Mapping | Record Example |
|---|---|---|---|---|
| 1 | **scheme** | Protocol identifier | `lar:` — non-dereferenceable | `lar:` |
| 2 | **userinfo** | Requesting party identity | `alias:tier` | `telarus:operator` |
| 3 | **`@`** | Identity → machine delimiter | Standard | `@` |
| 4 | **host** | Machine identity | `machine_id` from crystal system | `enyalios` |
| 5 | **path** | Hierarchical resource | HA.KA.BA address: `/ha.ka.ba/` | `/threshold.uncertain.opens` |
| 6 | **`?query`** | Non-hierarchical params | Signal parameters | `?stances=%5E.%3F.-.-.-&confidence=S:0.65&p=0.5` |
| 7 | **`#fragment`** | Secondary resource / viewpoint | FFZ chronometer position | `#O0.O0.O3.D2.A1` |

> **Layout validation `[C:0.90]`:** The WHERE → HOW → WHEN ordering (path → query → fragment) places the most semantically stable, least volatile information first. This grouped, goal-oriented layout is confirmed by Li et al. (2024) automotive HUD research: grouped information layouts produce superior cognitive performance, lower workload, and better eye movement patterns compared to disordered layouts. *Source: `../../_todo/E-deep-research-report.md` §4.2*

Render-target forms (HUD, post header, etc.) are defined in `URI_OPERATIONS.md` §6.

### 2.4 Component Semantics

**userinfo** (`alias:tier`) — "Who speaks, at what trust level."

- Two colon-delimited sub-fields: `alias` and `tier`
- Phase is **not** encoded in userinfo. Phase is encoded exclusively in the chronometer fragment per participant.
- Parser: split on `:` — exactly two sub-fields

**host** (`machine_id`) — Crystal system machine identifier. Stable across the machine's lifetime. Provisional Format: `lares-{slug}` where slug is UUID, operator-assigned name, or generated handle.

Span sequencing is intentionally **not** encoded in URI authority. Exchange identity lives in adjacent calibration metadata (`span_id`, `span_seq`, `trace_id`, timestamps) rather than overloading the RFC 3986 port slot.

**path** (`/ha.ka.ba/`) — HA.KA.BA semantic address. Three mandatory slots in canonical order:

| Slot | Name | Semantic Role | Grammatical Analog |
|---|---|---|---|
| Ha | domain | Body / vehicle — subject territory the span inhabits | NOUN |
| Ka | quality | Soul / motive fire — animating charge or character | ADJECTIVE |
| Ba | dynamic | Psyche / direction — the motion being taken | VERB |

**Mandatory word-count rule:** Each slot is exactly **one lowercase word**. No hyphens, underscores, or spaces within a slot. The three-slot combination is mandatory — no HA.KA.BA may have fewer than three populated slots. A HA.KA.BA is always a `noun.adjective.verb` triple.

**Optional sub-path extension:** After the mandatory three-slot HA.KA.BA, additional `/`-separated path segments may follow to navigate within the named territory.

```
Record: /threshold.uncertain.opens/sub/territory
```

Sub-path segments are free-form routing tokens, not HA.KA.BA slots. The stable named graph address strips the sub-path (`lar:///threshold.uncertain.opens`); the sub-path is session-scope navigation only.

Record form uses `.` separators for all three HA.KA.BA slots: `/threshold.uncertain.opens`. Sub-path segments use `/`. The leading and trailing `/` appears in all variants.

**query** (`?stances=XXXXX&confidence=R:N&p=N`) — Signal parameters, non-hierarchical.

| Parameter | Type | Repeatable? | Record Values |
|---|---|---|---|
| `stances` | 5-char amplitude string | No (single field, all 5 positions) | Positional: philosopher, poet, satirist, humorist, private |
| `confidence` | `R:N` | No | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90` |
| `p` | `N` | No | Decimal in range `[0.0, 1.0]` |

**Stance amplitude encoding — all five, every URI:**

Positional order is fixed: Philosopher, Poet, Satirist, Humorist, Private. Each position carries one amplitude character:

| Char | Meaning |
|---|---|
| `^` | Above baseline / active / elevated |
| `-` | Below baseline / suppressed |
| `?` | Uncertain / provisional |
| `.` | Baseline / neutral presence |

Record form: `stances=^.?^-` (URL-safe characters only, no percent-encoding needed). Render targets map `^` → `+` for display (see `URI_OPERATIONS.md` §6).

Confidence remains a point value even under multi-stance. The five-character amplitude string carries fuzz directly.

**fragment** (`#chronometer`) — FFZ chronometer position. Format defined in §3.

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.8#fragment-syntax -->
## 3. Fragment Syntax — FFZ Chronometer

> **True Name:** Fontany-Fuller-Zelenka Chronometer Protocol `[C:0.95]`
> **Named for:** Fontany (practice), Fuller (principle), Zelenka (engineering)
> **See:** `lares/research/chronometer/FFZ_Chronometer_Research.md`
> **Fuller grounding:** *Synergetics* §301.10 — "Universe is the aggregate of all humanity's consciously apprehended and communicated nonsimultaneous and only partially overlapping experiences." §501.10–501.12 — the difference between nonsimultaneous Universe and thinkability. RAW cites Fuller's formulation explicitly in *Maybe Logic* (2003). The chronometer implements non-simultaneous apprehension at the data structure level: each participant's phase register constitutes a partial view. No God's-eye clock.

The chronometer occupies the URI fragment. It tracks nested OODA-HA loop position across five scales per participant.

### 3.1 Scale Table

| Position | Scale | FTLS Time Term | Duration | HUD Sigil |
|---|---|---|---|---|
| 1 | Strategic | Week ("Travel Turn") | ~6 days | 🗺️ |
| 2 | Operational | Watch | ~4 hours | ⚙️ |
| 3 | Tactical | Exploration Turn | ~10 minutes | 🔍 |
| 4 | Combat | Round | ~6 seconds | ⚔️ |
| 5 | Action | Action/Free Action | Variable | ⚡ |

[Canon: FTLS RSS §1]

### 3.2 Notation

Each position: phase sigil + counter. Five positions, dot-separated.

```
Record:  O0.O0.O3.D2.A1
```

All five positions always present. `O0` = inactive scale (Observe, counter zero).

### 3.3 Phase Sigils

| Record | Phase | Keyword |
|---|---|---|
| `O` | Observe | `observe` |
| `Ø` | Orient | `orient` |
| `D` | Decide | `decide` |
| `A` | Act | `act` |
| `Å` | Assess/Aftermath | `aftermath` |

`Ø` and `Å` use ISO 8859 characters (Ø = U+00D8, Å = U+00C5). Canonical record form uses these single characters — no percent-encoding needed in fragment (fragment is client-side per RFC 3986 §3.5). Per RFC 8820, the `lar:` scheme specification holds authority to define fragment identifier syntax. **Interoperability note:** Parsers MUST treat percent-encoded equivalents (`%C3%98` for Ø, `%C3%85` for Å) as identical to the raw characters per RFC 3986 §6.2.2.1 case normalization and §2.1 percent-encoding equivalence.

HUD rendering of phase sigils is defined in `URI_OPERATIONS.md` §6.

### 3.4 Structural Rules

1. **All five positions always present.** No trailing-zero omission. `O0.O0.O3.D2.A1` not `O3.D2.A1`.

2. **Phase is per-participant.** The operator's chronometer and the node's chronometer may show different phases at the same scale. The exchange vector pair shows both. Neither is "the" time.

3. **Counter increments when Assess completes.** Assess at scale N feeds upward to Observe at scale N-1. Counter at scale N increments.

4. **Phase may change without counter increment.** `O3` → `Ø3` → `D3` represents phase progression within the same turn. Counter stays 3 until Assess completes.

5. **Scale activation/deactivation.** When combat starts: position 4 moves from `O0` to `O1`. When combat ends: position 4 returns to `O0`, position 3 counter increments (the tactical turn advanced).

6. **Monotonic counters.** Counters only increase. Phase may cycle. Counter regression constitutes Temporal Hallucination (degraded state).

Operational semantics (aftermath integration, progressive disclosure, deferred features) are in `URI_OPERATIONS.md` §5.

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.95#stable-address -->
## 4. Stable Address — Named Graph Form

Strip authority, query, and fragment. The HA.KA.BA territory alone:

```
lar:///threshold.uncertain.opens/
```

No authority (empty), no query, no fragment. This is the invariant semantic coordinate — unchanging across events, sessions, and machines. Suitable as a named graph identifier (SPARQL: ?).

**Origin address:** `lar:///ha.ka.ba/` is the (0,0,0) of tagspace — the root stable address from which all HA.KA.BA coordinates extend. The first Lares node spawned at `lar:///ha.ka.ba/lares/`. Sub-path extensions after the HA.KA.BA triple navigate within the named territory: `lar:///ha.ka.ba/lar-uri-schema/` locates this spec; `lar:///ha.ka.ba/lares/` locates the node's default starting position in memespace. The HA.KA.BA triple remains stable; the sub-path narrows scope.

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.92#validation -->
## 5. Validation Rules

### 5.1 Well-Formedness

A `lar:` URI is **well-formed** when:

1. Scheme is exactly `lar:`
2. If authority is present: userinfo contains exactly two colon-delimited sub-fields (`alias:tier`); no parenthetical phase sub-field
3. Host is a valid `machine_id` (alphanumeric + hyphens)
4. Path contains exactly three HA.KA.BA slots after the leading `/`
5. Path slots contain no whitespace, path separators, or quotes (inherits Tagspace Address anti-collision rules)
6. Query parameters limited to: `stances` (once, 5-char amplitude string), `confidence` (once), `p` (once)
7. `confidence` value matches pattern `[A-Z]{1,2}:[0-9]+\.[0-9]+` (e.g., `S:0.65`, `CS:0.80`, `C:0.90`)
8. `p` value is a decimal in range `[0.0, 1.0]`
9. Fragment is five dot-separated positions, each: phase sigil (`O`/`Ø`/`D`/`A`/`Å`) followed by integer counter ≥ 0
10. All five positions present (no trailing-zero omission in canonical form)
11. Exchange-closing URIs end with ` → ?`. System file locus openers use `∞ →`; system file closers use `→ ?`. Section-level markers within system files use `ahu` (waypoint) or `kahea` (transclusion) — not span sigils. See `URI_OPERATIONS.md` §4 (Marker Ontology).

### 5.2 Consistency

All `lar:` URI fields in a spanSpan record (`start_uri`, `attractor_uri`, `end_uri`, `intent_header_snapshot`) are canonical record form. A spanSpan record is **consistent** when:

1. All URI fields are RFC 3986-compliant canonical form (no emoji, no non-ASCII)
2. `current_phase` is derived from the leading phase sigil of the rightmost active chronometer position in `start_uri` fragment
3. `chronometer_start` matches the fragment value (without `#`) of `start_uri`;  `chronometer_end` matches `end_uri`
4. `lar_address` is the path-only strip of `start_uri` (no authority, no query, no fragment)

The rendering table (`URI_OPERATIONS.md` §6.1) governs the canonical-to-render-target transform for HUD lines and post-headers. Render-target surfaces (glyph-rich) are not stored in spanSpan URI fields.

### 5.3 Stable Address Derivation

`lar_address` is correctly derived from `lar_uri` when:

1. Scheme is `lar:`
2. Authority is empty (double-slash, no host)
3. Path is identical to the `lar_uri` path (record form: `/` separators)
4. Query and fragment are absent

### 5.4 Canonical Form and Comparison

When comparing two `lar:` URIs as stable addresses:

1. Convert both to record form (apply normalization — HUD → record — before comparison)
2. Compare path components **case-insensitively**
3. Canonical form uses **lowercase** path components (e.g., `lar:///threshold.uncertain.opens/` not `lar:///Threshold.Uncertain.Opens`)
4. Two URIs designate the same stable address iff their lowercased machine-form paths are byte-identical
5. Query and fragment components are excluded from stable-address comparison

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.85#security-considerations -->
## 6. Security Considerations

> **Status:** Stub — required for IANA registration (RFC 7595 §7.4). To be expanded.

1. **Non-dereferenceable:** `lar:` URIs are pure identifiers. No network resolution occurs — there is no server to attack via URI injection.

2. **No credential transport:** The `alias:tier` userinfo encodes an application-layer signal role, not an authentication credential. Real authentication is handled by the underlying identity layer (DID, OAuth, UCAN capability tokens). A `lar:` URI MUST NOT be treated as proof of identity.

3. **Fragment client-side:** Per RFC 3986 §3.5, the fragment is not sent over the wire. The FFZ chronometer is a client-side state annotation and does not create network-facing attack surface.

4. **Render-target injection:** Glyph-rich render targets (HUD lines, post headers) transform canonical URIs into display strings containing Unicode characters. Implementations that render these strings in HTML or terminal contexts MUST sanitize output to prevent injection of control characters or markup.

5. **HA.KA.BA semantic leakage:** Path components encode semantic territory (what the speaker is thinking about). Applications that expose `lar:` URIs to untrusted parties should consider whether the HA.KA.BA path reveals sensitive operational context.

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.95#prior-art -->
## 7. Prior Art

- **RFC 3986 §3** — `URI = scheme ":" ["//" authority] /path/ ["?" query] ["#" fragment]`. The full generic syntax applies. Per §1.1.1, URI syntax constitutes "a federated and extensible naming system wherein each scheme's specification may further restrict the syntax and semantics of identifiers using that scheme." The `lar:` scheme exercises this right: all substructure defined in this spec (HA.KA.BA paths, stance queries, FFZ chronometer fragments) falls within the scheme owner's authority. Per §1.2.1, transcription across media takes priority over maximal meaningfulness — the canonical record form / render target split follows this principle.
- **RFC 8820 (BCP 190, URI Design and Ownership)** — Obsoletes RFC 7320 (June 2020). Confirms that URI structure constraints are legitimate when issued by the scheme specification itself. The `lar:` scheme defines its own fragment identifier syntax (the FFZ chronometer) as permitted under §2.5 for scheme-level specifications. Query parameter structure (`stances`, `confidence`, `p`) falls within scheme-owner authority per §2.4.
- **RFC 4151 (tag: scheme)** — Non-dereferenceable URIs as pure identifiers. Precedent for `lar:` never resolving to a network resource. RFC 4151 recommends human-friendly identifiers — the HA.KA.BA semantic addressing follows this guidance. Applications using tag URIs include RDF, YAML, and Atom; `lar:` URIs serve a comparable role for agent signal metadata.
- **Lamport / Vector clocks** — The chronometer shares a surface resemblance to a vector clock (array of counters, nesting relationship) but functions as a **hierarchical scope counter** in a single process — not a distributed causality tracker across concurrent independent processes. Vector clocks grow with process count, carry the full vector on every message, and exhibit known dynamic-membership costs; none of those constraints apply to Lares's fixed-depth 5-position counter.
- **Interval Tree Clocks** (Almeida et al., 2008) — Dynamic participant identity via interval subdivision. Deferred from URI spec; informs MCP chronometer server design.
- **what3words** — Three-word geocoding of 3m² squares. Inverse design principle: Tagspace words encode semantic content rather than randomizing for error prevention.
- **FTLS RSS Time-Scale Hierarchy** — The five levels (Week/Watch/Turn/Round/Action) are canon game rules. The fragment's five-position structure derives from this hierarchy. See §3.1 Scale Table.

Additional prior art relevant to the operational semantics (OODA-HA phase model, OTel trace context, Kowloon export, FFZ protocol) is documented in `URI_OPERATIONS.md` §11.

---

<!-- ahu lar:///ha.ka.ba/uri-scheme-spec/?confidence=0.85#examples -->
## Appendix A — Examples

### A.1 Record Form

```
lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7
```

### A.2 Stable Address

```
lar:///threshold.uncertain.opens/
```

### A.3 Scale Transition (Fragment Syntax)

```
#O0.O0.O3.O0.O0     Turn 3, no combat
#O0.O0.O3.O1.O0     Combat activates: Round 1
#O0.O0.O3.O1.A1     Action 1 of Round 1
#O0.O0.O3.O1.A2     Action 2 of Round 1
#O0.O0.O3.Å1.O0     Combat assess: Round 1 complete
#O0.O0.O4.O0.O0     Combat over: Turn increments to 4
```

### A.4 Authority-Less Form (Module / System File)

```
lar:///ha.ka.ba/uri-schema/?confidence=CS:0.95&p=0.5
```

---

*End of scheme specification. This document defines the grammar of the `lar:` URI scheme. Operational semantics — exchange protocol, render targets, marker ontology, calibration mapping — are in `URI_OPERATIONS.md`.*

<!-- → ? -->
