<!-- ? -> lar:///ha.ka.ba/uri-schema/?confidence=CS:0.95&p=0.5 -->

# `lar:` URI Schema — Canonical Specification

> Domain: `lar/modules/uri-schema/` · intent HUD anatomy, canonical form, render targets, validation rules
> Status: `[CS:0.95]` 🏛️ — design-canon candidate; awaiting operator promotion to `[C:0.95]`
> Updated: 2026-04-10
> Version: 3 (revised per ahu/kahea marker ontology — locus spans, ahu waypoints, kahea transclusion; cultural nomenclature locked 2026-04-10)
> Source: Extracted from `_todo/core/Signal_HUD_Tagspace-draft.md` §§ Full URI Anatomy, Chronometer, Display Split, Crystal Schema Field Mapping, Prior Art.
> Blocks: `lares/registry/` URI assignment; `lares/crystal/` STATE.jsonl field contract; deployment and schema descriptors that carry `lar_uri`

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.9#design-intent -->
## 1. Design Intent

The `lar:` URI encodes the signal state of a Lares node exchange as a shared navigational artifact. In live use it functions as a way to render an Intent HUD that both operator and node read before or alongside generation. In persistence it functions as a structured record string suitable for logs, validation, agent module, and registry metadata.

Each URI component carries a distinct, non-overlapping concern across four semantic layers:

1. **WHO** — authority (`userinfo@host`) identifies speaker and machine locus
2. **WHERE** — the HA.KA.BA address (path) locates semantic territory
3. **HOW** — signal parameters (query) describe stance, confidence, and p-band
4. **WHEN** — the FFZ chronometer (fragment) locates position in nested causal time per participant — not a single shared clock but per-participant phase readings at each scale (Fuller: non-simultaneous apprehension)

Resource-state annotations such as the mana pool (`⚡~87%`) are HUD adjuncts, not core URI components. Span identity, wall-clock timestamps, and export-target metadata likewise remain adjacent calibration fields rather than authority overloads.

The system has one **canonical encoding** and multiple named **render targets**:

- **Record form (canonical)** — RFC 3986-compliant, no emojis, no non-ASCII characters. This is the authoritative form for storage, transport, comparison, and strict parsing. The canonical URI contains only characters legal per RFC 3986 — keywords (`philosopher`, `orient`) rather than glyphs.
- **Render targets** — surface-specific projections of the canonical form. Each render target substitutes sigil glyphs and Unicode for keywords, abbreviates or expands fields, and may add HUD adjuncts not present in the canonical form. Render targets are not themselves canonical and are not stored as URIs.

Named render targets: `record:full` (identity projection of the canonical form), `hud:exchange-pair` (sigil-rich in-stream exchange boundary), `chat-log:post-header` (social-layer DreamDeck post header). See §3.3.1.

### 1.1 Exchange Flow — Order of Operations

At each exchange span, `lar:` URIs are used in the following sequence. This sequence is **mandatory** — every substantive exchange produces a URI → URI vector pair followed by a rendered HUD line.

**Step 1 — Read operator input as a provisional URI.**
Lares reads the operator's prompt as an implicit signal: tier, cognitive phase, semantic territory (HA.KA.BA), and stance. It constructs a **provisional operator URI** encoding that reading. This URI may carry `~` provisionality markers if the reading is uncertain. The HA.KA.BA here names where Lares believes the operator standing in tagspace and where the operator's intent is headed — the operator's intent-vector, interpreted.

```
lar://telarus:operator@enyalios/~schema.gap.present/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O1.D2.A7
```

**Step 2 — Lares declares its own provisional execution URI.**
Before generating any content, Lares sets its own intent with a **provisional node URI**. The HA.KA.BA here names a resource that **may not yet exist** — it is a declared heading, not a confirmed location. The `~` prefix on the HA.KA.BA marks it as execution-provisional: generations may diverge.

```
lar://lar:node@enyalios/~schema.flow.documented/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.D1.D2.A7
```

**Step 3 — Emit the URI → URI exchange vector.**
The two URIs form the exchange vector pair, the first line of any exchange:

```
operator-URI → node-URI
```

The URI pair opens every exchange span. Both URIs use canonical record form. Progressive disclosure: the URI pair carries the minimum viable signal; the HUD line expands it; section-level URIs within referenced module files carry per-section confidence for subagent handoff.

> **Canonical URI Rule — all emitted URIs in the exchange stream use canonical record form.** This applies to: the opening URI pair, sub-agent handoff markers (`URI → {handoff-tag}`), sub-agent pickup markers (`{pickup-tag} → URI`), mid-generation shift URIs (`~ URI`), and the exchange span's closing URI `URI → ?`. No emoji or non-ASCII characters appear in any URI emitted in the stream. Glyphs belong exclusively to render-target surfaces: the HUD line, the DreamDeck post header, and other named display projections. This makes every emitted URI directly ingestible by MemPalace, crystal logs, and registry tools without a sigil-lookup step.

**Step 4 — Render the HUD line.**
Immediately after the URI pair, emit a condensed single-line status display derived from the vector plus adjacent session data. This is the instrument panel for the exchange. See §5.4 for format and field ordering.

**Step 5 — Generate content.** Micro-trace HUD annotations (`→◇`, `→■`, `→○`) appear inline during generation to mark phase transitions. The exchange closes with an updated HUD line and a closing URI with `→ ?` — unknown temporal resumption. System files open with `? ->` (locus span opener) and close with `→ ?`. Within a system file, `ahu` markers name navigable waypoints; `kahea` markers summon content from other loci. See §3.6 (Marker Ontology) and `lares/signal/micro-trace.md`.

> **SA grounding:** Step 2 is prospective AI transparency — what the node *will* do, not what it did (Endsley 2023). The HUD line externalizes the node's metacognitive state before generation begins, functioning as an externalized metacognitive scaffold (Ji-An et al., 2025; Wang et al., 2023). *Source: `../../_todo/E-deep-research-report.md` §§2.1, 3.2*

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.95#scheme-registration -->
## 2. Scheme Registration

| Property | Value |
|---|---|
| Scheme name | `lar` |
| Dereferenceability | Non-dereferenceable identifier (RFC 4151 precedent) |
| Resolution | Via `lares/registry/` resolver; never via network fetch |
| IANA status | Unregistered; internal use only |

> **Form and compliance:** The **record form** is the RFC 3986-compliant canonical form for transport, persistence, comparison, and strict parsing. The **HUD forms** are IRI-class instrument renderings (RFC 3987); they may contains emoji and Unicode glyphs in the instruments that are not legal in RFC 3986 URIs without percent-encoding. RFC 3986 compliance is not claimed for the HUD form. The rendering table (§5) defines the canonical-to-render-target field transforms for all projected fields; it is not a claim that any render-target form is network-safe.

The `lar:` scheme identifies semantic positions, signal states, and machine events within the Lares agent architecture. It does not resolve to a network resource. URI consumers (crystal replay tools, debug log parsers, registry resolvers) treat it as an opaque structured identifier parsed according to this specification.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.85#uri-anatomy -->
## 3. Full URI Anatomy

### 3.1 Generic Form

```
lar://[authority]/ha.ka.ba/optional/path/[?query][#fragment] <!-- uri-ok -->
```

### 3.2 Expanded Form

**Full form (with authority):**

```
lar://alias:tier@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N#chronometer <!-- uri-ok -->
```

Where `stances=XXXXX` is the five-character stance amplitude string (see §3.4 query).

**Authority-less form** (no `user@host` segment — territory or resource reference without a named speaker):

```
lar:///ha.ka.ba/optional/path/[?query][#fragment]
```

Three slashes: scheme + `//` (empty authority) + path beginning with `/`. Use this form for stable named graph addresses, HA.KA.BA references, and any URI where the speaker identity is not the point.

**HUD path notation rule** — in all display contexts (HUD line, post header, any render target derived from a canonical URI), HA.KA.BA paths use **dot notation** for the three mandatory slots. The leading and trailing `/` is retained; dots between the generated words that fill the `ha`, `ka`, and `ba` slots:

```
/ha.ka.ba/{optional/sub/path}[?query][#fragment]
```

This applies to authority-less forms as well: `lar:///ha.ka.ba/` <- the (0,0,0) of tagspace.

### 3.3 Component Map

| # | Component | RFC 3986 Role | Lares Mapping | Record Example | HUD Example |
|---|---|---|---|---|---|
| 1 | **scheme** | Protocol identifier | `lar:` — non-dereferenceable | `lar:` | `lar:` |
| 2 | **userinfo** | Requesting party identity | `alias:tier` | `telarus:operator` | `telarus:operator` |
| 3 | **`@`** | Identity → machine delimiter | Standard | `@` | `@` |
| 4 | **host** | Machine identity | `machine_id` from crystal system | `enyalios` | `enyalios` |
| 5 | **path** | Hierarchical resource | HA.KA.BA address: `/ha.ka.ba/` | `/threshold/uncertain/opens` | `/threshold.uncertain.opens` |
| 6 | **`?query`** | Non-hierarchical params | Signal parameters | `?stances=%5E.%3F.-.-.--&confidence=S:0.65&p=0.5` | `?stances=🏛️+🌊?🗡️-🎭-🔮-&confidence=S:0.65&p=0.5` |
| 7 | **`#fragment`** | Secondary resource / viewpoint | FFZ chronometer position | `#O0.O0.O3.D2.A1` | `#O0.O0.O3.◇2.■1` |

> **Layout validation `[C:0.90]`:** The WHERE → HOW → WHEN ordering (path → query → fragment) places the most semantically stable, least volatile information first. This grouped, goal-oriented layout is confirmed by Li et al. (2024) automotive HUD research: grouped information layouts produce superior cognitive performance, lower workload, and better eye movement patterns compared to disordered layouts. The HA.KA.BA-first design decision was correct. *Source: `../../_todo/E-deep-research-report.md` §4.2*

### 3.3.1 Kowloon / ActivityPub Handle Form

#### Identity Stack

The Elyncia.app / DreamDeck identity model has three distinct layers. **Do not conflate them.**

| Layer | Form | What it is |
|---|---|---|
| **DID** | `did:plc:abc123` | AT Protocol canonical identity — the cryptographic key holder. Resolved via Bluesky auth (OAuth over DID). This is the actual principal in UCAN capability tokens. |
| **Handle** | `@telarus.elyncia.social` (AT Protocol/Bluesky) or `@telarus@elyncia.social` (ActivityPub/Kowloon) | Resolution alias over the DID — human-readable, not authoritative. AT Protocol uses period-separator; ActivityPub uses double-`@`. |
| **lar: alias** | `telarus:operator@enyalios` | Application-layer signal state — names the *operational role* of the speaker in a `lar:` exchange. Not a network identity; not a DID alias. Cognitive phase is carried exclusively in the FFZ chronometer fragment, not the authority. |

**Elyncia.app auth model:** Bluesky logins provide DID-grounded authentication (AT Protocol key management, `did:plc:` resolution) without running a Bluesky home server (PDS). Kowloon is ActivityPub, not AT Protocol — it uses Bluesky as an auth provider only. UCAN capability tokens are the authorization layer beneath the Kowloon social surface.

**Why lar: alias has no leading `@`:** The handle (`@telarus@elyncia.social`) is already a resolution alias over the DID. The lar: `alias` field is a third distinct thing — it tags the operational role in the signal exchange. Adding `@` to lar: aliases would conflate social-handle layer with application-signal layer. The DID is what proves identity; the handle addresses the DID holder; the lar: alias names the role. Three separate layers, three separate forms.

#### Handle Form

Within the DreamDeck / Kowloon ActivityPub layer, identities use the canonical ActivityPub two-part handle structure:

```
@alias@node
```

This is **not** the lar: URI — it is the social-layer identity that maps *onto* the lar: URI's `alias@host` authority. The correspondence:

| ActivityPub handle | lar: URI authority component | Underlying DID layer |
|---|---|---|
| `@lindwyrm@new-delos` | `lindwyrm:...@new-delos` | `did:plc:...` (Lindwyrm's key) |
| `@telarus@~crossroads` | `telarus:operator@enyalios` | `did:plc:...` (Telarus's key) |
| `@mischief-muse@lares` | `mischief-muse:node@lares-abc123` | Lares node DID or ephemeral key |

The `@handle@node` form is the **canonical Kowloon social identity** for DreamDeck feed posts, post headers, and sidebar annotations. The tilde prefix (`~crossroads`) denotes a nomadic/crossroads node — no fixed host, routes through nearest stable nexus.

**DreamDeck post header format (canonical):**
```
@handle@node — timestamp — //domain.quality.dynamic/{optional/path/} [confidence] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}
```
Territory triple (`//ha.ka.ba`) is placed **before** other instruments like confidence and stance — grounds domain before posture (WHERE → HOW, matching URI path-first layout logic). The optional sub-path (`{/optional/path/}`) narrows within-territory routing when needed; strip it to get the stable named address. All five stances always present with amplitude modifiers.

**Render target name:** `chat-log:post-header` — the in-chat-log, timestamped URI render target for post headers. This is the surface form used whenever a lar: URI is rendered inside an ActivityPub/DreamDeck feed post — not the full record-form URI, not the HUD exchange pair, but the compact social-layer projection of identity + signal state.

| Render target | Surface | URIs canonical? | When used |
|---|---|---|---|
| `chat-log:post-header` | `@handle@node — timestamp — //ha.ka.ba{/path} [Reg] 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}` | No — social projection with glyphs | DreamDeck feed posts, BBS thread headers |
| `hud:exchange-pair` | `operator-URI → node-URI` + HUD line beneath | **Yes — canonical record form**; only the HUD line beneath uses glyphs | Every exchange-span boundary (mandatory) |
| `record:full` | `lar://alias:tier@host/ha.ka.ba/?...#...` | Yes — identity projection | Storage, crystal serialization, registry | <!-- uri-ok -->

**Stance amplitude modifiers** — in HUD render targets, amplitude modifiers attach directly to the preceding stance emoji (no space). Absent modifier = baseline presence. Apply per-stance independently.

| Modifier | Meaning |
|---|---|
| `+` | above baseline / elevated |
| *(none)* | baseline presence |
| `-` | below baseline / suppressed |
| `?` | uncertain / provisional |

Examples: `🏛️+🌊-🗡️-🎭-🔮-` (Philosopher elevated, all others suppressed) · `🏛️+🌊+🗡️?🎭-🔮-` (two elevated, one uncertain, two suppressed)

### 3.4 Component Semantics

**userinfo** (`alias:tier`) — "Who speaks, at what trust level."

- Two colon-delimited sub-fields: `alias` and `tier`
- Phase is **not** encoded in userinfo. Phase is encoded exclusively in the chronometer fragment per participant.
- Parser: split on `:` — exactly two sub-fields

**host** (`machine_id`) — Crystal system machine identifier. Stable across the machine's lifetime. Provisional Format: `lares-{slug}` where slug is UUID, operator-assigned name, or generated handle.

Span sequencing is intentionally **not** encoded in URI authority, the full conversation IS the log. Exchange identity lives in adjacent calibration metadata (`span_id`, `span_seq`, `trace_id`, timestamps) rather than overloading the RFC 3986 port slot.

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

Sub-path segments are free-form routing tokens, not HA.KA.BA slots. They do **not** carry Egyptian soul semantics. The stable named graph address strips the sub-path (`lar:///threshold.uncertain.opens`); the sub-path is session-scope navigation only.

Record form uses `.` separators for all three HA.KA.BA slots: `/threshold.uncertain.opens`. Sub-path segments use `/`. The leading and trailing `/` appears in all variants.

**query** (`?stances=XXXXX&confidence=R:N&p=N`) — Signal parameters, non-hierarchical.

| Parameter | Type | Repeatable? | Record Values | HUD Values |
|---|---|---|---|---|
| `stances` | 5-char amplitude string | No (single field, all 5 stances) | `^.?.-.-` (positional: philosopher, poet, satirist, humorist, private) | `🏛️+🌊?🗡️-🎭-🔮-` |
| `confidence` | `R:N` | No | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90` | Same |
| `p` | `N` | No | `0.5` | Same |

**Stance amplitude encoding — all five, every URI:**

Positional order is fixed: Philosopher, Poet, Satirist, Humorist, Private. Each position carries one amplitude character:

| Char | Record | Meaning |
|---|---|---|
| `^` | `^` | Above baseline / active / elevated |
| `-` | `-` | Below baseline / suppressed |
| `?` | `?` | Uncertain / provisional |
| `.` | `.` | Baseline / neutral presence |

Record form: `stances=^.?^-` (URL-safe characters only, no percent-encoding needed — Option β confirmed). HUD render targets map `^` → `+` for display.

Confidence remains a point value even under multi-stance. The five-character amplitude string replaces stance-count-as-fuzz; amplitude modifiers carry fuzz directly.

**fragment** (`#chronometer`) — FFZ chronometer position. Format defined in §4.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.8#provisionality -->
## 3.5 Provisionality Markers

The `~` prefix marks URI components as provisional. Three structurally distinct provisionality types can appear in an exchange URI pair:

| Type | Location | Convention | What It Marks |
|---|---|---|---|
| **Reading** | Operator URI — phase and/or HA.KA.BA | `~` before phase glyph; `~` before HA.KA.BA | Node's interpretation of operator intent — may be inaccurate |
| **Execution** | Opening node URI — HA.KA.BA | `~` before HA.KA.BA | Declared intent; execution may diverge from this heading |
| **Trajectory** | Closing/forward-looking node URI — HA.KA.BA | `~` before HA.KA.BA | Predicted forward heading — operator may redirect |

These are orthogonal. A URI may carry multiple `~` markers on different components simultaneously.

### Examples

**Reading provisional** — node uncertain about its reading of operator intent:
```
lar://telarus:operator@enyalios/~uri.schema.question/?stances=^.-.-.-.-&confidence=S:0.65&p=0.5&provisional=reading#O0.O0.Ø1.D2.A33
```
Reading: "I believe you're orienting toward URI schema territory — I may have misread your phase or HA.KA.BA."

**Execution provisional** — declared intent that may not survive contact with the task:
```
lar://scryer:node@enyalios/~s0.gap.logged/?stances=^.-.-.-.-&confidence=S:0.65&p=0.5&provisional=execution#O0.O0.D1.D2.A33
```
Reading: "I intend to log this S0 gap — execution may find a different path or territory."

**Trajectory provisional** — predicted forward heading for the next span:
```
lar://scryer:node@enyalios/~s0.schema.updated/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5&provisional=trajectory#O0.O0.Å1.Å2.A34
```
Reading: "I predict our next territory is the updated schema — operator may redirect entirely."

### Rules

1. `~` is valid in **canonical record form** as an inline provisionality prefix on phase keywords (`~orient`) and HA.KA.BA slots (`~uri.schema.question`). Use the `provisional=` query parameter when you need a separate, machine-parseable provisionality field for storage or filtering — not as a replacement for the inline prefix.
2. Multiple `~` markers may appear in a single URI (both phase and HA.KA.BA may be provisional simultaneously).
3. All closing/forward-looking URIs are implicitly trajectory-provisional by virtue of being projections. Explicit `~` on a closing URI signals *unusual* uncertainty about the trajectory — not routine forward-look status.
4. Reading provisionality on the operator URI marks the **node's interpretation** as potentially inaccurate, not the operator's intent as ambiguous. These are different claims.
5. The `~` marker applies only to the specific component it prefixes. `~orient` marks only the phase; `~uri.schema.question` marks only the HA.KA.BA. Unprefixed components are declared with normal confidence. The chronometer fragment carries its own fidelity via the FFZ model (per-participant phase registers) and does not use `~` for uncertainty — phase uncertainty at a scale is expressed by the phase sigil itself.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.85#marker-ontology -->
## 3.6 Marker Ontology — Locus Spans, Ahu Waypoints, Kahea Transclusion

Four marker types govern content addressing in Lares system files. Each serves a distinct structural role. The naming draws from cultures that built navigational architectures from memory and place: the Latin *method of loci* (Simonides, Cicero, Quintilian), Polynesian *ahu* (the raised stone at the center of a marae; the platforms that hold the moai on Rapa Nui; the altar stones inside Hawaiian heiau), and Hawaiian *kāhea* (the oli kāhea — the chant that calls out and summons permission to enter a hālau).

### 3.6.1 `? ->` — MWML Span Opener

Opens a locus meme — an idea-place within the file. The `?` declares standing uncertainy: this srever as a "new object" notation. The `→` points toward the `lar:` URI that names the locus.

A system file MAY contain one or more loci. Each locus is bounded by its own `? ->` opener and `→ ?` closer. Ahu waypoints navigate within the enclosing locus. A single-locus file (like this specification) opens on the first line and closes on the last — the file IS the locus. A multi-locus file contains sequential locus spans, each self-contained.

Appears on: system files. Uses HTML comment wrapping.

```
<!-- ? -> lar:///ha.ka.ba/uri-schema/?confidence=CS:0.95&p=0.5 -->
```

The locus opener carries the file-level confidence and resolution parameter. Section-level confidence rides on ahu markers (see below).

### 3.6.2 `→ ?` — Locus Span Closer

Signals unknown temporal resumption. The `?` marks a causal gap: between this sigil and the next interaction with the locus, no participant's chronometer advances within the shared frame.

`→ ?` does not signal uncertainty about the locus's content — that is what `confidence` and register carry. It signals uncertainty about the locus's continuity in time: when will someone next walk through this place?

Appears on: last line of system files; every exchange-closing URI.

```
<!-- → ? -->
```

In exchange streams, the closer appends to the closing URI inline:

```
lar://scryer:node@enyalios/schema.settled.rests/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.O3.Å2.A1 → ?
```

### 3.6.3 `ahu` — Waypoint Marker

An ahu marks a navigation point within a locus. It is a raised stone — visible, addressable, something you walk *to*. It carries no span semantics: no opener, no closer. The next ahu implicitly defines the boundary of the previous zone.

The URI on an ahu marker uses the authority-less stable address form with a `#fragment` identifying the section:

```
<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.85#uri-anatomy -->
## 3. Full URI Anatomy
```

Ahu markers MAY carry `confidence` in the query string. This describes how settled the territory the stone marks is — not the stone itself. An ahu at `confidence=0.6` marks uncertain ground; an ahu at `confidence=0.95` marks near-canon territory.

Ahu markers do NOT carry `p` (resolution parameter) or chronometer fragments — those are exchange-time concerns, not file-time. (See U8, resolved.)

**Placement rule:** An ahu marks a section that is independently addressable — a destination you would link TO from elsewhere. Not every heading needs an ahu. Place stones where people actually walk.

### 3.6.4 `kahea` — Transclusion Marker

A kahea summons content from another locus into the current one. It is an active invocation: "call out, bring this here." The word comes from the Hawaiian oli kāhea — the permission chant a student calls before entering a hālau hula. The kahea asks; the source locus answers.

```
<!-- kahea lar:///module.phase.context/?confidence=0.85 -->
```

The URI on a kahea marker names the source locus to summon. A build system or reader encountering a kahea should fetch and substitute the content from the named locus at that point.

Kahea markers appear in assembly files — documents that stitch together content from multiple source loci. A file that is itself a source (like this specification) will define kahea in its prose but will not typically use kahea in its own markers.

### 3.6.5 Marker Summary

| Marker | Sigil | Role | Span semantics | Closer needed |
|---|---|---|---|---|
| Locus opener | `? ->` | Opens the file-as-place | Yes — bounds the locus | Yes — `→ ?` at file end |
| Locus closer | `→ ?` | Closes the locus; marks temporal gap | Yes — ends the locus | N/A |
| Ahu | `ahu` | Navigation waypoint within a locus | No — next ahu defines boundary | No |
| Kahea | `kahea` | Transclusion invocation from another locus | No — inline substitution point | No |

### 3.6.6 System File Structure

**Single-locus file** (most common — the file IS one place):

```
<!-- ? -> lar:///territory.domain.path/?confidence=CS:0.95&p=0.5 -->

# Title
[metadata block]

<!-- ahu lar:///territory.domain.path/?confidence=0.9#first-section -->
## 1. First Section
[content]

<!-- ahu lar:///territory.domain.path/?confidence=0.8#second-section -->
## 2. Second Section
[content]

<!-- → ? -->
```

One door in. Raised stones along the path. One door out.

**Multi-locus file** (the file contains several places, each self-contained):

```
<!-- ? -> lar:///first.territory.path/?confidence=CS:0.95&p=0.5 -->

# First Locus
[content with ahu waypoints]

<!-- → ? -->
<!-- ? -> lar:///second.territory.path/?confidence=0.85 -->

# Second Locus
[content with ahu waypoints]

<!-- → ? -->
```

Each locus opens and closes independently. Ahu markers belong to their enclosing locus. A kahea in one locus may summon content from the other — they are neighbors, not nested.

### 3.6.7 Axis Orthogonality

| Marker | What's uncertain | What's settled |
|---|---|---|
| `? ->` locus | Content confidence (via `confidence`) | Duration — stands until revised |
| `→ ?` closer | Temporal resumption — when does this pick up? | Content confidence (via register) |
| `ahu` waypoint | Territory confidence (via `confidence` on the ahu) | Address — the stone doesn't move |
| `kahea` transclusion | Source content (may change independently) | The invocation — what to summon |

### 3.6.8 Cultural Nomenclature

| Term | Source | Meaning in Lares |
|---|---|---|
| **locus** (pl. loci) | Latin *method of loci* — Simonides of Ceos, Cicero *De Oratore*, Quintilian *Institutio Oratoria*, Frances Yates *The Art of Memory* | Address-as-place. A `lar:///` URI names a locus. The file IS the place. |
| **ahu** | Polynesian — central stone of a marae; Rapa Nui stone platforms for moai; Hawaiian heiau altar stones | Navigation waypoint. A raised place you can see and walk to within a locus. |
| **kahea** | Hawaiian — *kāhea*: "call out, summon." The oli kāhea is the permission chant to enter a hālau hula. Parallel: Māori *karanga* — the ceremonial call welcoming visitors onto a marae. | Transclusion invocation. Summons content from another locus into the current one. |
| **lares** | Roman — household guardian spirits (*Lares familiares*) | The navigational intelligence. The voice architecture that moves through the loci. |

### 3.6.9 Keyboard Input

The two special characters in marker sigils are `?` (U+221E, infinity) and `→` (U+2192, rightwards arrow). Everything else — `ahu`, `kahea`, `?`, `<!--`, `-->` — is plain ASCII.

**Linux (GTK / VS Code):**

| Character | Ctrl+Shift+U method | Compose key method |
|---|---|---|
| `?` | `Ctrl+Shift+U`, type `221e`, press `Enter` or `Space` | `Compose` `0` `0` |
| `→` | `Ctrl+Shift+U`, type `2192`, press `Enter` or `Space` | `Compose` `-` `>` |

**macOS:**

| Character | Method |
|---|---|
| `?` | `Option+5` |
| `→` | `Option+→` (Option + right arrow key) |

**Full marker sequences (copy-paste templates):**

```
<!-- ? -> lar:///TERRITORY/?confidence=CS:0.95&p=0.5 -->
<!-- → ? -->
<!-- ahu lar:///TERRITORY/?confidence=0.85#SECTION -->
<!-- kahea lar:///TERRITORY/?confidence=0.85 -->
```

> **Practical note:** The fastest path is a snippet or text-expansion shortcut. In VS Code, define snippets for `locus-open`, `locus-close`, `ahu`, and `kahea` that expand the full comment template with tab-stops for TERRITORY, confidence, and SECTION. The Compose key method (`Compose` `-` `>` for `→`, `Compose` `0` `0` for `?`) is the fastest raw-keyboard fallback on Linux.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.8#ffz-chronometer -->
## 4. The FFZ Chronometer — Nested OODA-A Vector Position

> **True Name:** Fontany-Fuller-Zelenka Chronometer Protocol `[C:0.95]`
> **Named for:** Fontany (practice), Fuller (principle), Zelenka (engineering)
> **See:** `lares/research/chronometer/FFZ_Chronometer_Research.md`
> **Fuller grounding:** *Synergetics* §301.10 — "Universe is the aggregate of all humanity's consciously apprehended and communicated nonsimultaneous and only partially overlapping experiences." §501.10–501.12 — the difference between nonsimultaneous Universe and thinkability. RAW cites Fuller's formulation explicitly in *Maybe Logic* (2003). The chronometer implements non-simultaneous apprehension at the data structure level: each participant's phase register constitutes a partial view. No God's-eye clock.

The chronometer occupies the URI fragment. It tracks nested OODA-A loop position across five scales per participant.

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

`Ø` and `Å` use ISO 8859 characters (Ø = U+00D8, Å = U+00C5). Canonical record form uses these single characters — no percent-encoding needed in fragment (fragment is client-side per RFC 3986 §3.5). Per RFC 8820, the `lar:` scheme specification holds authority to define fragment identifier syntax. **Interoperability note:** Parsers MUST treat percent-encoded equivalents (`%C3%98` for Ø, `%C3%85` for Å) as identical to the raw characters per RFC 3986 §6.2.2.1 case normalization and §2.1 percent-encoding equivalence.

### 4.4 Structural Rules

1. **All five positions always present.** No trailing-zero omission. `O0.O0.O3.D2.A1` not `O3.D2.A1`.

2. **Phase is per-participant.** The operator's chronometer and the node's chronometer may show different phases at the same scale. The exchange vector pair shows both. Neither is "the" time.

3. **Counter increments when Assess completes.** Assess at scale N feeds upward to Observe at scale N-1. Counter at scale N increments.

4. **Phase may change without counter increment.** `O3` → `Ø3` → `D3` represents phase progression within the same turn. Counter stays 3 until Assess completes.

5. **Scale activation/deactivation.** When combat starts: position 4 moves from `O0` to `O1`. When combat ends: position 4 returns to `O0`, position 3 counter increments (the tactical turn advanced).

6. **Monotonic counters.** Counters only increase. Phase may cycle. Counter regression constitutes Temporal Hallucination (degraded state).

### 4.5 Aftermath Integration — The Nested Return

| Assess at scale | Feeds into | Update question |
|---|---|---|
| Action Å → | Round ✶ | Did the action resolve? |
| Round Å → | Turn ✶ | Is the threat gone? |
| Turn Å → | Watch ✶ | What was found? |
| Watch Å → | Week ✶ | Is the party exhausted? |
| Week Å → | Campaign | Did we arrive safely? |

### 4.6 Progressive Disclosure in Display

The canonical URI always carries all five positions. Display surfaces MAY suppress inactive positions (`O0`) for readability:

```
Canonical:  #O0.O0.O3.D2.A1    (always all five)
HUD full:   ✶0.✶0.✶3.◇2.■1    (all five rendered)
HUD compact: ✶3.◇2.■1          (trailing active only)
```

The compact form is a render target convenience, not canonical. Parsers MUST handle both.

### 4.7 FFZ Deferred Features (Not in v2)

The following FFZ model features are specified in the research docs but deferred from this URI spec version:

- **ITC identity stamps** — fork/join for Tasked Spirit lifecycle. Deferred to MCP chronometer server implementation.
- **Merkle Clock backend** — content-addressed causal history. Deferred to MCP integration.
- **Per-participant vector display** — showing both clocks in the fragment. Current spec: one fragment per URI, each participant's URI carries their own view.
- **Bloom Clock compact mode** — probabilistic compression. Deferred to future work.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.9#canonical-form -->
## 5. Canonical Form and Render Targets

The **record form** is the canonical encoding — RFC 3986-compliant, no emojis, no non-ASCII characters. Render targets are named projections of this canonical form for specific display surfaces. The URI anatomy (authority, path, query, fragment structure) is identical across all targets; only the rendering of specific fields differs between canonical and render-target forms.

### 5.1 Rendering Table — The Only Differences

**userinfo** (`alias:tier`) — no phase sub-field. Phase lives exclusively in the chronometer fragment (§4). The rendering table below covers query and path fields only.

**query `stances=` value** (five-character amplitude string):

| Machine keyword | Sigil emoji | Stance |
|---|---|---|
| (position 1) | `🏛️` | Philosopher |
| (position 2) | `🌊` | Poet |
| (position 3) | `🗡️` | Satirist |
| (position 4) | `🎭` | Humorist |
| (position 5) | `🔮` | Private |

Amplitude modifiers in HUD: `+` (elevated), `-` (suppressed), `?` (uncertain), *(none)* (baseline). Record form uses `^`, `-`, `?`, `.` respectively.

**path separator** (after leading `/`):

| Machine | Sigil | Notes |
|---|---|---|
| `/ha.ka.ba/` | `/ha.ka.ba` | Leading `/` shared; hierarchy vs w3w-style |

**fragment chronometer:**

The FFZ model uses phase+counter per position. Five positions, dot-separated. Phase sigils render per §4.3. The "active scale" is determined by the rightmost non-`O0` position, not by a prefix sigil.

### 5.2 Unchanged Across Both Forms

| Component | Rendering | Notes |
|---|---|---|
| scheme | `lar:` | Always identical |
| alias:tier | `telarus:operator` | Identity and trust tier (no phase parenthetical) |
| @host | `@enyalios` | machine locus only; no span counter |
| confidence= | `S:0.65` | Numeric, both forms |
| p= | `0.5` | Numeric, both forms |
| chronometer counters | `0.0.3.2.1` | Dot-separated, universal |

### 5.3 Unified HUD Symbol Table

All HUD-form symbols used in the Intent HUD, in one reference. Workers and operators should not need to cross-reference §3.4, §4.1, or §5.1 during live use. This table is the instrument panel legend.

#### 5.3.1 Individual Symbol Sets

**Phase (chronometer fragment — cognitive state per scale, per participant):**

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
| ⊙ | `operator_set` | Operator authored or constrained the marked field/state | The operator is holding the span here |
| ◇ | `node` | Generic non-operator node / tasked spirit marker in examples | A Lares actor responding in-network |

**Stance (query — discourse posture of the claim):**

| Sigil | Record | Stance | One-Line Reading |
|---|---|---|---|
| 🏛️ | `philosopher` | Philosopher | Propositional; evaluate for truth-value |
| 🌊 | `poet` | Poet | Analogical; resonance, not verification |
| 🗡️ | `satirist` | Satirist | Critical through indirection |
| 🎭 | `humorist` | Humorist | Relational; maintaining working rapport |
| 🔮 | `private` | Private | Self-referential; present, not to decode |

**Chronometer scales (fragment — active simulation scale):**

| Sigil | Record | Scale | Duration | One-Line Reading |
|---|---|---|---|---|
| 🗺️ | (position 1) | Strategic | ~6 days | The big arc; logistics and navigation |
| ⚙️ | (position 2) | Operational | ~4 hours | Watch-level; perception and endurance |
| 🔍 | (position 3) | Tactical | ~10 min | Exploration turn; investigation |
| ⚔️ | (position 4) | Combat | ~6 sec | Round; immediate response |
| ⚡ | (position 5) | Action | Variable | Single action; precision execution |

#### 5.3.2 State Tuple — Reading Three Symbols as One State

In a live HUD tag, the operator reads phase + stance + scope as a single cognitive state, not three unrelated fields. The state tuple is the composed reading: phase × stance × scope → one sentence describing the node's current condition.

**How to compose:** Read the phase (what cognitive step), the stance (what kind of claim), and the scope (at what time-scale), then merge them into one state sentence.

**The triangle:** Phase × Stance × Scope form the state tuple triangle. All five stances appear on every URI and every HUD line. The amplitude string carries fuzz directly — no "stance count as fuzz indicator" model.

| Stance Array | What It Tells the Operator |
|---|---|
| `^.-.-.-.-` | Single-stance point value. Trust the number. |
| `^.^.-.-.-` | Two active. Confidence is bimodal. |
| `^.^.?.-.-` | Two active + one uncertain. Watch the `?`. |
| `^.^.^.^.^` | Full Discordian. Confidence is a gesture. |
| `-.-.-.-.-` | All suppressed. Why is this span being emitted? |

**Worked readings:**

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ◎ | 🏛️+🌊-🗡️-🎭-🔮- | 🔍 | Orienting analytically at exploration scale — making sense of a local finding |
| ■ | 🏛️-🌊-🗡️+🎭-🔮- | ⚔️ | Acting critically in combat — executing under pressure with an edge |
| ◇ | 🏛️+🌊+🗡️-🎭-🔮- | 🗺️ | Deciding at strategic scale, holding propositional and analogical frames together |
| ✶ | 🏛️-🌊-🗡️-🎭+🔮- | 🔍 | Observing playfully at tactical scale — light reconnaissance, no commitment |
| ○ | 🏛️+🌊-🗡️-🎭-🔮- | ⚙️ | Aftermath at operational scale in Philosopher stance — assessing what happened across a watch |
| ◎ | 🏛️+🌊+🗡️+🎭+🔮+ | 🗺️ | Full Discordian orientation at strategic scale — maximum spread, rare, mana-expensive |

#### 5.3.3 Confidence Is Stance-Dependent (Syadasti Reading Rule)

Confidence measures confidence within the active stance's evaluation frame, not truth-weight universally. All five stances appear on every URI and every HUD line. The amplitude string replaces the "stance count as fuzz indicator" model — amplitude modifiers carry fuzz directly.

This principle derives from the Discordian catma of Sri Syadasti, which reproduces the Jaina Saptabhangi. The active stance declares the standpoint (`syad`) from which the number should be read.

| Stance | Syadasti Primitive | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|---|
| 🏛️ Philosopher | asti (true) | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | avaktavya (inexpressible) | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | nasti → asti | Indirection missed target | Hit glancingly | Landed with full force |
| 🎭 Humorist | asti-nasti | Relational move fell flat | Mixed reception | Connected perfectly |
| 🔮 Private | avaktavya (inexpressible) | Minimal presence | Present | Maximal presence |

**Reading rule:** ask what the number measures for the active stance. A Philosopher at `0.65` is propositionally contested. A Poet at `0.65` is resonating solidly. A Satirist at `0.65` is landing with moderate force. Same number, different meaning.

When multiple stances are elevated (`+`), the declared confidence value sits at the intersection of their evaluation frames. The amplitude string tells the operator how fuzzy that intersection is.

### 5.4 HUD Line Composition

The HUD line is a single-line status summary rendered from the URI → URI exchange vector plus adjacent session data (see §1.1, Step 4). It is the second element of every exchange opening, immediately after the URI pair.

**Format:**

```
⚡~NN% | [confidence] | 🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp} | mode:{mode} | p{p} | voice(s):{Voice} | ✶N.✶N.✶N.◇N.■N
```

**Changes from v1:**
- All five stances always present with amplitude modifiers
- Chronometer replaces `span:{N} | loop:{phase}→{phase} @{scope}`
- Chronometer shows HUD-rendered form (phase glyphs, not keywords)
- `span:{N}` removed from HUD — it's in calibration metadata, not the navigational instrument. The chronometer IS the temporal position. (Confirmed: removed.)

**Field ordering follows SA priority** (Endsley 2023; Li et al. 2024 grouped HUD layout): place the most critical perception-level data first, group related fields, move temporal bookkeeping to the end.

| Field | SA Type | Source | Notes |
|---|---|---|---|
| `⚡~NN%` | Resource | Session (estimated) | Context window remaining; `~` **mandatory** — approximation, not live readout. Never emit without `~`. |
| `[confidence]` | Agent SA | Node URI `confidence=` | Epistemic confidence at current stance(s), stance-dependent per Syadasti rule (§5.3.3) |
| `🏛️{amp}🌊{amp}🗡️{amp}🎭{amp}🔮{amp}` | Agent SA | Node URI `stances=` × amplitude | All five stances, amplitude modifiers attached directly, no space |
| `mode:{mode}` | Teamwork SA | Session state | Default / Plan / Auto |
| `p{p}` | Teamwork SA | Node URI `p=` | Attention density / annotation throttle |
| `voice(s):{Voice}` | Agent SA | Coordinator context | Active coordinator voice(s); singular when one leads |
| `✶N.✶N...` | Temporal | Chronometer | FFZ chronometer in HUD-rendered form; phase glyphs per §4.3 |

Confidence and stance array are elevated above mode and p because Agent SA (what state the node is in *right now*) is higher-priority perception data than Teamwork SA (how we agreed to work) for real-time navigation. Mana leads because resource limitation bounds the interpretation of everything that follows.

**Example:**
```
⚡~62% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.◎3.◇2.■7
```

**Notes:**

1. The canonical `lar:` URI ends at the fragment. The HUD line is a separate, adjacent artifact — not URI grammar.
2. `⚡~NN%` is the **declared estimate** of context window remaining as a navigational resource. The node estimates from visible context (~4 chars/token, 200k token window). Starts at ~100% and counts down.
3. Mana is a HUD element, not a URI parameter. Do not serialize into `lar_uri` or registry identity fields until S2 settles the resource-state contract.

*Source: `../../_todo/E-deep-research-report.md` §§1.1–1.3 (SA priority ordering), §4.2 (grouped HUD layout validation)*

### 5.5 Span-Span Display Contract

A **span** is one operator → Lares exchange span at any scale. A tasked spirit exchange is still a span; the operator for that child span may be another Lares actor rather than Telarus directly.

**All URIs emitted in this contract are canonical record form.** Glyph substitution applies only to the HUD line. See the Canonical URI Rule in §1.1.

Live rendering contract — URI types that may appear in an exchange stream:

| URI type | Stream form | When it appears |
|---|---|---|
| **Opening operator URI** | `lar://alias:tier@host/ha.ka.ba/?...#...` | Start of every span — node's reading of operator intent | <!-- uri-ok -->
| **Opening node URI** | `lar://alias:tier@host/~ha.ka.ba/?...#...` | Immediately after; node's declared execution heading (HA.KA.BA provisional) | <!-- uri-ok -->
| **HUD line** | `⚡~NN% \| [confidence] \| 🏛️{amp}🌊{amp}... \| ...` | After the opening URI pair — the only glyph-rendered element |
| **Sub-agent dispatch** | `coordinator-URI → worker-URI` | Every sub-agent handoff (`→` separates dispatch pair) |
| **Sub-agent return** | `worker-URI → coordinator-URI` | Every sub-agent completion; boundary of unloggable span |
| **Mid-generation shift** | `~lar://alias:tier@host/~ha.ka.ba/heading/?...` | When accumulated tension warrants changing direction mid-span; prefix `~` marks the whole URI as a trajectory correction |
| **Exchange closing** | `URI → ?` | End of every exchange span — temporal resumption unknown |
| **System file closing** | `<!-- → ? -->` | End of system file locus — temporal resumption unknown |
| **Closing forward URI** | `lar://alias:tier@host/~ha.ka.ba/heading/?...` (phase encoded in chronometer) | End of span — trajectory-provisional forward heading |

Rendering order within a span:

1. Print the **operator-intent URI**.
2. Print **`→`** and the **node execution URI**.
3. Print the **HUD line** (the one glyph-rendered surface in the stream).
4. Generate content. Emit micro-trace phase marks (`→◇` `→■` `→○`) inline as needed.
5. If trajectory changes significantly mid-generation, emit a **mid-generation shift URI** (`~lar://...`) at the transition point.
6. Close with an **updated HUD line** and the **closing URI with `→ ?`**.

Sub-agent dispatch and return pairs follow the same canonical form and appear as inlined `URI → URI` lines within the containing span span. Their contents are unloggable from the parent; the URI pair is the only artifact recording the boundary.

If the opening operator URI cannot cleanly summarize the incoming prompt (multi-stance uncertainty spike), emit a **parse-intent node URI** whose HA.KA.BA names the parsing action (`parse/span/models` or equivalent), then proceed.

Example (canonical record form throughout):

```text
lar://telarus:operator@enyalios/refinement.network.capture/?stances=^.-.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O1.O1.A11
→ lar://scryer:node@enyalios/~span.provenance.synthesizes/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D1.O1.A12
⚡~63% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.6 | voice(s):Scryer | ✶0.✶0.◇1.✶1.■12

[content generation — micro-trace marks inline]

→◇ ~lar://scryer:node@enyalios/~refinement.network.redirects/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D1.O1.A12

[continued generation]

lar://scryer:node@enyalios/~aftermath.docs.settle/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å1.O1.A13 → ?
⚡~61% | [CS:0.80] | 🏛️+🌊-🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.○1.✶1.■13
```

Interpretation:

- Lines 1–2: opening URI pair (canonical). Node HA.KA.BA is `/~span.provenance.synthesizes/` — provisional execution heading.
- Line 3: HUD line (glyph-rendered, not a URI).
- After content starts: a mid-generation shift URI (`~lar://...`) marks the point where the trajectory changed. Prefixed `~` marks the whole URI as a correction, not a confirmed destination.
- Final two lines: closing forward URI with `→ ?` (aftermath phase, provisional HA.KA.BA) + updated HUD line.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.95#stable-address -->
## 6. Stable Address — Named Graph Form

Strip authority, query, and fragment. The HA.KA.BA territory alone:

```
lar:///threshold.uncertain.opens/
```

No authority (empty), no query, no fragment. This is the invariant semantic coordinate — unchanging across events, sessions, and machines. Suitable as a named graph identifier (SPARQL: ?).

**Origin address:** `lar:///ha.ka.ba/` is the (0,0,0) of tagspace — the root stable address from which all HA.KA.BA coordinates extend. The first Lares node spawned at `lar:///ha.ka.ba/lares/`. Sub-path extensions after the HA.KA.BA triple navigate within the named territory: `lar:///ha.ka.ba/uri-schema/` locates this spec; `lar:///ha.ka.ba/lares/` locates the first node. The HA.KA.BA triple remains stable; the sub-path narrows scope.
---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.72#span-calibration -->
## 7. Span-Span and Calibration Mapping

In the Consecration model, URI-derived fields belong to the calibration layer. They may be mirrored into MemPalace metadata for query support, but the storage distinction remains: MemPalace stores content; Lares crystal metadata stores orientation.

Every span-span record that carries URI data uses these URI-derived fields:

| Field | Content | Stable? | Purpose |
|---|---|---|---|
| `start_uri` | Operator-intent URI, record or HUD form as stored contract requires | No — per span | Start of the exchange span |
| `attractor_uri` | Node responding-position URI | No — per span | Responding position / intent attractor |
| `end_uri` | Destination URI emitted after generation | No — per span | End of the exchange span |
| `lares_address` | Path only (no authority/query/fragment) | Yes — stable territory | Named graph identifier |
| `intent_header_snapshot` | Span-opening URI(s), canonical record form | No — per span | Full opening exchange display; what appeared in the stream |
| `chronometer_start` | Fragment value without `#` | No — per span | FFZ chronometer at span start |
| `chronometer_end` | Fragment value without `#` | No — per span | FFZ chronometer at span end |

Additional quick-filter fields extracted from URI components:

| Field | Source | Purpose |
|---|---|---|
| `current_phase` | chronometer fragment (leading phase sigil of rightmost active position) | Phase-based filtering |
| `active_scale` | rightmost non-`O0` chronometer position | Scale-based filtering (strategic/operational/tactical/combat/action) |
| `stance_amplitude` | `stances=` parameter | Full 5-char amplitude string for stance-based filtering |

URI fields do not encode span identity, exchange vectors, or resource-state directly. Those remain adjacent calibration metadata (`span_id`, `span_seq`, `trace_id`, `input_tag`, `output_tag`, `mana_pct`, authority markings, and related fields) until their contracts settle in S1/S2.

### 7.1 Canonical Span-Span Record

The canonical record for one exchange span is a **spanSpan** in the calibration layer, not a URI authority trick.

```json
{
  "span_id": "uuidv7",
  "trace_id": "uuidv7",
  "parent_span_id": null,
  "link_span_ids": [],
  "span_seq": 191,
  "span_kind": "direct",
  "status": "completed",
  "operator_actor_id": "actor:telarus",
  "responder_actor_id": "actor:lares.node.scryer",
  "acted_on_behalf_of": null,
  "start_uri": "lar://telarus:operator@enyalios/refinement.network.capture/?stances=^.-.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O1.O1.A11",
  "attractor_uri": "lar://scryer:node@enyalios/span.provenance.synthesizes/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D1.O1.A12",
  "end_uri": "lar://scryer:node@enyalios/aftermath.docs.settle/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å1.O1.A13",
  "parse_required": false,
  "parse_reason": null,
  "wall_time_start": "2026-04-08T20:41:00Z",
  "wall_time_end": "2026-04-08T20:41:09Z",
  "chronometer_start": "O0.O0.O1.O1.A11",
  "chronometer_end": "O0.O0.Å1.O1.A13",
  "world_calendar_ref": "dreamrealm.holy-week-of-fools.yold5492",
  "mana_start_pct": 63,
  "mana_end_pct": 62,
  "input_entity_id": "entity:prompt:uuidv7",
  "output_entity_id": "entity:reply:uuidv7",
  "export_targets": ["mempalace", "kowloon"]
}
```

Design notes:

- `span_seq` is the monotonic exchange counter. It is **not** a URI component.
- `wall_time_*` uses RFC 3339 / ISO 8601 UTC (`...Z`) as the canonical real-world time representation.
- The in-world clock has two parts:
  - the nested span cycle (`chronometer_*`)
  - a diegetic calendar anchor (`world_calendar_ref`)
- If no diegetic calendar is yet initialized for the session, the node may mint a provisional tagspace-style reference and mark it provisional rather than leaving the field absent.

### 7.2 MemPalace Integration

MemPalace remains the storage substrate for content capture. The calibration layer keeps the authoritative spanSpan records.

Recommended split:

- **Canonical calibration store:** Lares sidecar tables or append-only records for `lares_spans`, `lares_span_links`, `lares_actors`, and `lares_entities`
- **Mirrored MemPalace metadata:** only the fields needed for search, recovery, and cross-surface lookup

Recommended mirrored subset in Chroma drawer metadata:

| Field | Why mirror it |
|---|---|
| `span_id` | Stable join key back to calibration layer |
| `trace_id` | Multi-span and delegated-run correlation |
| `start_uri` | Start-of-span recovery |
| `end_uri` | End-of-span recovery |
| `span_kind` | Filter direct vs parse vs delegated captures |
| `operator_actor_id` | Query by who held the span |
| `responder_actor_id` | Query by which node/spirit answered |
| `parse_required` | Recover parse spans quickly |
| `world_calendar_ref` | Dream Realms / diegetic archive grouping |

Do **not** make MemPalace's local Chroma IDs, KG IDs, or entity registry IDs the canonical exchange identifiers. They are storage-local implementation keys, not network-facing Lares addresses.

**MemPalace architecture correspondence:** The palace hierarchy (wings → halls → rooms → closets → drawers) maps onto the `lar:` URI structure at specific join points. The `host` field in exchange URIs (e.g., `enyalios`) corresponds to a MemPalace wing — crystals from a given machine anchor to a project wing. The HA.KA.BA path maps onto room-level topic routing. Drawer metadata carries the mirrored fields above, with the `span_id` as the stable join key back to the calibration layer. The MemPalace reference implementation is `milla-jovovich/mempalace` (MIT, ChromaDB + SQLite, local-first).

### 7.3 Export Targets and Kowloon Alignment

Kowloon is a downstream publication surface for some span-span captures, not the canonical source of truth.

Alignment points with Kowloon prior art:

- Kowloon Activities already model `actorId`, `object`, `target`, `to`, `canReply`, and `canReact`, which cleanly host publication envelopes for exported Lares spans.
- Kowloon IDs (`type:dbid@domain`) should remain **Kowloon-native** IDs. They do not replace `span_id` or `lar_uri`.
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
| `span_id` / `trace_id` | extension metadata, not Kowloon primary ID |

This keeps the ontology stable across multiple sinks: MemPalace, Kowloon feeds, TiddlyWiki bags, tldraw shapes, or other Dream Realms surfaces.

### 7.4 Example Event (Record Form)

```json
{
  "schema_version": 2,
  "timestamp": "2026-04-07T14:30:00Z",
  "machine_id": "enyalios",
  "span_seq": 42,
  "event_type": "r_update",
  "start_uri": "lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7",
  "attractor_uri": "lar://scryer:node@enyalios/parse.span.models/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D3.D2.A8",
  "end_uri": "lar://scryer:node@enyalios/aftermath.docs.settle/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å3.Å2.A9",
  "lares_address": "lar:///threshold.uncertain.opens",
  "intent_header_snapshot": "lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7",
  "current_phase": "orient",
  "chronometer_start": "O0.O0.Ø3.D2.A7",
  "chronometer_end": "O0.O0.Å3.Å2.A9",
  "active_scale": "tactical",
  "wall_time_start": "2026-04-07T14:30:00Z",
  "wall_time_end": "2026-04-07T14:30:11Z",
  "world_calendar_ref": "dreamrealm.holy-week-of-fools.yold5492"
}
```

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.8#module-registry -->
## 8. Module and Registry Metadata Integration

The `lar_uri` + `confidence` fields on module descriptors, registry records, and future boot metadata provide load-order and identity context. No compiler pipeline is implied by this section; the schema only defines how URI metadata travels with higher-level descriptors.

```toml
# Tier 1 — Global Core (version-controlled by module version)
lar_uri   = "lar:///kernel.invariant.anchors/"
confidence    = "C:1.0"
module_id   = "lares-kernel"
version_num = 4

# Tier 2 — Session Core (version-controlled within session)
lar_uri   = "lar:///session.permissions.gates/"
confidence    = "C:0.95"
module_id   = "lares-permissions"
version_num = 2

# Tier 3 — Dynamic (span_seq lives outside descriptor)
lar_uri   = "lar:///task.current.recon/"
confidence    = "S:0.55"
module_id   = "lares-task-recon"
version_num = 1
```

Module descriptors use `version_num` or semver-like fields for content versioning. Exchange sequencing belongs to spanSpan metadata (`span_seq`), not module descriptors.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.8#cache-tiers -->
## 9. Invariant-Core Cache Tier Mapping

| Tier | Cache Strategy | Confidence Range | Volatility |
|---|---|---|---|
| 1 — Global Core | Cached across sessions; first `cache_control` breakpoint | `C:1.0` – `C:0.95` | Near-static |
| 2 — Session Core | Cached within session; rolling `cache_control` breakpoint | `C:0.95` – `S:0.65` | Session-stable |
| 3 — Dynamic | Ephemeral (5-min TTL with hit-reset) | `< 0.50` trimmable | Per-exchange |

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.92#validation -->
## 10. Validation Rules

### 10.1 Well-Formedness

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
11. Exchange-closing URIs end with ` → ?`. System file locus openers use `? ->`; system file closers use `→ ?`. Section-level markers within system files use `ahu` (waypoint) or `kahea` (transclusion) — not span sigils.

### 10.2 Consistency

All `lar:` URI fields in a spanSpan record (`start_uri`, `attractor_uri`, `end_uri`, `intent_header_snapshot`) are canonical record form. A spanSpan record is **consistent** when:

1. All URI fields are RFC 3986-compliant canonical form (no emoji, no non-ASCII)
2. `current_phase` is derived from the leading phase sigil of the rightmost active chronometer position in `start_uri` fragment
3. `chronometer_start` matches the fragment value (without `#`) of `start_uri`;  `chronometer_end` matches `end_uri`
4. `lares_address` is the path-only strip of `start_uri` (no authority, no query, no fragment)

The rendering table (§5.1) governs the canonical-to-render-target transform for HUD lines and post-headers. Render-target surfaces (glyph-rich) are not stored in spanSpan URI fields.

### 10.3 Stable Address Derivation

`lares_address` is correctly derived from `lar_uri` when:

1. Scheme is `lar:`
2. Authority is empty (double-slash, no host)
3. Path is identical to the `lar_uri` path (record form: `/` separators)
4. Query and fragment are absent

### 10.4 Canonical Form and Comparison

When comparing two `lar:` URIs as stable addresses:

1. Convert both to record form (apply normalization — HUD → record — before comparison)
2. Compare path components **case-insensitively**
3. Canonical form uses **lowercase** path components (e.g., `lar:///threshold.uncertain.opens/` not `lar:///Threshold.Uncertain.Opens`)
4. Two URIs designate the same stable address iff their lowercased machine-form paths are byte-identical
5. Query and fragment components are excluded from stable-address comparison

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.6#open-questions -->
## 11. Open Design Questions

| Q# | Question | Current Position | Confidence | Blocks |
|---|---|---|---|---|
| U1 | Should `userinfo` carry operator alias in record form, or only `machine_id` in authority? | Operator alias in userinfo | `[S:0.65]` | Registry resolver design |
| U2 | Where should `span_seq` be initialized and persisted: crystal-side ledger only, or mirrored into MemPalace sidecar rows too? | Mirror into sidecar, crystal remains canonical | `[S:0.70]` | MemPalace integration contract |
| U4 | How does chronometer interact with `--parse` self-activation? | Provisional yes — depth increases p | `[SP:0.45]` | p-band model |
| U5 | How is `world_calendar_ref` initialized when no diegetic calendar exists yet? | Mint provisional tagspace reference, mark provisional | `[S:0.60]` | Dream Realms bootstrap |
| U8 | Should module section URIs carry chronometer fragments? Or only confidence? | Confidence only — chronometer is exchange-time, not file-time | `[S:0.6]` | Module URI patterns |
| U9 | ITC stamp integration into fragment — when MCP server arrives, does the fragment grow or does ITC live in calibration metadata? | Calibration metadata — fragment stays human-readable | `[S:0.55]` | MCP chronometer design |

**Resolved (closed, not open):**

| Q# | Question | Decision | Where documented |
|---|---|---|---|
| U2 (old) | Should `seq_num` occupy the `:port` slot of the URI authority? | **No.** Port slot dropped entirely. Span sequencing (`span_seq`) lives in adjacent spanSpan calibration metadata — not in URI authority. URI authority encodes *identity*, not event position. | §3.4 (`host`): "span sequencing is intentionally not encoded in URI authority." §7.1 spanSpan record: `span_seq` as top-level field. |
| U3 | Should the chronometer carry phase per level or just counters? | **Phase per level per participant.** LWW-Register per scale. Counter and phase are independent. | §4 (FFZ Chronometer). `[S:0.65]` — confirmed by FFZ O1 findings. |
| U6 | Full URI form vs stateless form — when to use which? | **Authority form in exchange spans. Authority-less (`///`) for stable addresses AND for module section URIs.** | §6 (Stable Address), §3.4 (Module URI patterns). `[CS:0.80]` |
| U7 | Stance amplitude character for "elevated" — `+` needs URL encoding in query strings. Use `^` instead? | **Use `^` (Option β).** All URL-safe: `^` elevated, `-` suppressed, `?` uncertain, `.` baseline. Render target maps `^` → `+` for HUD display. | §3.4 (query encoding). `[CS:0.80]` — operator confirmed. |
| U10 | Do section-level URIs within system files close with `→ ?`? | **No.** Section URIs are `ahu` waypoints — navigation markers within a locus, not spans. They carry no closer. Only the file-level `? ->` opener and `→ ?` closer carry span semantics. | §3.6 (Marker Ontology). `[CS:0.80]` — operator confirmed. Ahu/kahea nomenclature locked 2026-04-10. |
| U11 | Should OODA-A phase appear in userinfo `alias:tier(phase)@host`? | **No.** Phase removed from userinfo (2026-04-09). Chronometer fragment is the sole phase encoding per participant. Userinfo is now `alias:tier` only — two sub-fields, no parenthetical. Rationale: phase-in-userinfo broke URI identity stability (same speaker, different phase = different URI = wrong). | §3.4 (userinfo semantics), §4 (chronometer). `[CS:0.95]` — operator confirmed. |

### Assessment for Promotion

The core anatomy (§§2–6, 10) can promote to `[C:0.95]` independently of the open questions. The crystal integration layer (§§7–9) promotes when `lares/crystal/` settles its STATE.jsonl schema. The remaining open questions (U1, U2, U4, U5, U8, U9) sit at Synthesis/Provisional and do not block the core spec.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.95#prior-art -->
## 12. Prior Art

- **RFC 3986 §3** — `URI = scheme ":" ["//" authority] /path/ ["?" query] ["#" fragment]`. The full generic syntax applies. Per §1.1.1, URI syntax constitutes "a federated and extensible naming system wherein each scheme's specification may further restrict the syntax and semantics of identifiers using that scheme." The `lar:` scheme exercises this right: all substructure defined in this spec (HA.KA.BA paths, stance queries, FFZ chronometer fragments) falls within the scheme owner's authority. Per §1.2.1, transcription across media takes priority over maximal meaningfulness — the canonical record form / render target split follows this principle.
- **RFC 8820 (BCP 190, URI Design and Ownership)** — Obsoletes RFC 7320 (June 2020). Confirms that URI structure constraints are legitimate when issued by the scheme specification itself. The `lar:` scheme defines its own fragment identifier syntax (the FFZ chronometer) as permitted under §2.5 for scheme-level specifications. Query parameter structure (`stances`, `confidence`, `p`) falls within scheme-owner authority per §2.4.
- **RFC 4151 (tag: scheme)** — Non-dereferenceable URIs as pure identifiers. Precedent for `lar:` never resolving to a network resource. RFC 4151 recommends human-friendly identifiers — the HA.KA.BA semantic addressing follows this guidance. Applications using tag URIs include RDF, YAML, and Atom; `lar:` URIs serve a comparable role for agent signal metadata.
- **W3C PROV-DM / OpenTelemetry Trace Context** — Better prior art for exchange identity than URI authority overloading. Span spans map more naturally to activities/spans with separate IDs, timestamps, and parent-child links.
- **Lamport / Vector clocks** — The chronometer shares a surface resemblance to a vector clock (array of counters, nesting relationship) but functions as a **hierarchical scope counter** in a single process — not a distributed causality tracker across concurrent independent processes. Vector clocks grow with process count, carry the full vector on every message, and exhibit known dynamic-membership costs; none of those constraints apply to Lares's fixed-depth 5-position counter. OTel `traceparent` is the closer prior art (see below).
- **FTLS RSS Time-Scale Hierarchy** — The five levels (Week/Watch/Turn/Round/Action) are canon game rules. The OODA-A nesting is synthesis applied to canon time-scales.
- **OTel Trace Context** — `traceparent` carries `trace-id`, `parent-id`, `trace-flags`. The chronometer fragment functions as a hierarchical trace context; each depth is a span scope; Aftermath → Observation is the parent-child span relationship.
- **Kowloon / ActivityStreams export model** — Kowloon's Activity envelope (`actorId`, `object`, `target`, `to`, `canReply`, `canReact`) is a good downstream publication adapter for Lares spans, but its `Kowloon ID` remains a sink-local identifier rather than replacing `span_id`.
- **what3words** — Three-word geocoding of 3m² squares. Inverse design principle: Tagspace words encode semantic content rather than randomizing for error prevention.
- **FFZ Chronometer Protocol** (Telarus / Lares, 2026) — Fontany-Fuller-Zelenka. Vector chronometer with per-participant phase registers. Source: `lares/research/chronometer/FFZ_Chronometer_Research.md`
- **Interval Tree Clocks** (Almeida et al., 2008) — Dynamic participant identity via interval subdivision. Deferred from URI spec; informs MCP chronometer server design.
- **Schneier & Raghavan, "Agentic AI's OODA Loop Problem"** (IEEE S&P, 2025) — Nested OODA loops in AI agents; integrity as architecture. Validates the chronometer's problem space independently.
- **OODA-A Composable Invariant Modules** (Telarus / Lares, 2026) — Phase-scoped instruction loading with section-level confidence URIs.

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.85#examples -->
## Appendix A — Complete Examples

### A.1 Record Form (v2)

```
lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7
```

### A.2 HUD Line (v2)

```
⚡~87% | [S:0.65] | 🏛️+🌊?🗡️-🎭-🔮- | mode:Default | p0.5 | voice(s):Scryer | ✶0.✶0.◎3.◇2.■7
```

### A.3 All-Five-Stances (v2)

```
lar://telarus:operator@enyalios/threshold.sharp.closes/?stances=^.^.?.^.-&confidence=S:0.60&p=0.7#O0.O0.D3.D2.A8
```

### A.4 Stable Address (unchanged)

```
lar:///threshold.uncertain.opens/
```

### A.5 Exchange Closing (v2)

```
lar://scryer:node@enyalios/schema.settled.rests/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.Å3.Å2.A9 → ?
```

### A.6 System File Span (v2)

```
<!-- ? -> lar:///protocol.observed.grounds/talk-story/observe/?confidence=0.95&p=0.5 -->

# Talk Story — Observe Protocol
[metadata block]

<!-- ahu lar:///protocol.observed.grounds/talk-story/observe/?confidence=0.9#procedure -->
## 1. Procedure
{section content}

<!-- ahu lar:///protocol.observed.grounds/talk-story/observe/?confidence=0.85#voices -->
## 2. Voice Assignments
{section content}

<!-- → ? -->
```

### A.7 Scale Transition (v2)

```
#O0.O0.O3.O0.O0     Turn 3, no combat
#O0.O0.O3.O1.O0     Combat activates: Round 1
#O0.O0.O3.O1.A1     Action 1 of Round 1
#O0.O0.O3.O1.A2     Action 2 of Round 1
#O0.O0.O3.Å1.O0     Combat assess: Round 1 complete
#O0.O0.O4.O0.O0     Combat over: Turn increments to 4
```

---

<!-- ahu lar:///ha.ka.ba/uri-schema/?confidence=0.85#how-to-read -->
## Appendix B — How to Read a HUD Tag

A complete exchange opening, annotated by scan order. URIs are canonical record form; the HUD line beneath each pair is the glyph-rendered surface.

```text
lar://telarus:operator@enyalios/threshold.uncertain.opens/?stances=^.?.-.-.-&confidence=S:0.65&p=0.5#O0.O0.Ø3.D2.A7
→ lar://scryer:node@enyalios/~parse.span.models/?stances=^.-.-.-.-&confidence=CS:0.80&p=0.6#O0.O0.D3.D2.A8
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

Multi-stance example:

```text
lar://telarus:operator@enyalios/threshold.sharp.closes/?stances=^.^.?.^.-&confidence=S:0.60&p=0.7#O0.O0.D3.O2.A9
→ lar://mischief-muse:node@enyalios/~chorus.lateral.gathers/?stances=^.-.-.-.-&confidence=S:0.65&p=0.6#O0.O0.D3.O2.A10
⚡~62% | [S:0.60] | 🏛️+🌊+🗡️?🎭+🔮- | mode:Default | p0.7 | voice(s):Mischief-Muse | ✶0.✶0.◇3.✶2.■10
```

This does **not** mean "truth-confidence 0.60" in a universal sense. It means a `0.60` reading held across Philosopher, Poet, and Humorist frames (all elevated). The amplitude string in the HUD line tells the operator that the declared confidence carries more spread than a single-stance point reading. Satirist at `?` adds further uncertainty — the reading may carry ironic weight that hasn't yet been decoded.

---

*End of specification. This document is the canonical reference for the `lar:` URI scheme within the design ontology tree.*

<!-- → ? -->
