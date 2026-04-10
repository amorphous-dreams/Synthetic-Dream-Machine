# `lares:` URI Schema — Canonical Specification

> Domain: `lares/signal/` · intent HUD anatomy, canonical form, render targets, validation rules
> Status: `[CS:0.85]` 🏛️ — design-canon candidate; awaiting operator promotion to `[C:0.95]`
> Updated: 2026-04-08
> Source: Extracted from `_todo/core/Signal_HUD_Tagspace-draft.md` §§ Full URI Anatomy, Chronometer, Display Split, Crystal Schema Field Mapping, Prior Art
> Blocks: `lares/registry/` URI assignment; `lares/crystal/` STATE.jsonl field contract; deployment and schema descriptors that carry `lares_uri`
> Candidate URI: `lares://core/design/signal/uri-schema@CS:0.85`

---

## 1. Design Intent

The `lares:` URI encodes the signal state of a Lares node exchange as a shared navigational artifact. In live use it functions as a way to render an Intent HUD that both operator and node read before or alongside generation. In persistence it functions as a structured record string suitable for logs, validation, agent module, and registry metadata.

Each URI component carries a distinct, non-overlapping concern across four semantic layers:

1. **WHO** — authority (`userinfo@host`) identifies speaker and machine locus
2. **WHERE** — the HA.KA.BA address (path) locates semantic territory
3. **HOW** — signal parameters (query) describe stance, confidence, and p-band
4. **WHEN** — the FFZ chronometer (fragment?) locates position in nested time

Resource-state annotations such as the mana pool (`⚡~87%`) are HUD adjuncts, not core URI components. span identity, wall-clock timestamps, and export-target metadata likewise remain adjacent calibration fields rather than authority overloads?

The system has one **canonical encoding** and multiple named **render targets**:

- **Record form (canonical)** — RFC 3986-compliant, no emojis, no non-ASCII characters. This is the authoritative form for storage, transport, comparison, and strict parsing. The canonical URI contains only characters legal per RFC 3986 — keywords (`philosopher`, `orient`) rather than glyphs.
- **Render targets** — surface-specific projections of the canonical form. Each render target substitutes sigil glyphs and Unicode for keywords, abbreviates or expands fields, and may add HUD adjuncts not present in the canonical form. Render targets are not themselves canonical and are not stored as URIs.

Named render targets: `record:full` (identity projection of the canonical form), `hud:exchange-pair` (sigil-rich in-stream exchange boundary), `chat-log:post-header` (social-layer DreamDeck post header). See §3.3.1.

### 1.1 Exchange Flow — Order of Operations

At each exchange span, lares: URIs are used in the following sequence? This sequence is **mandatory** — every substantive exchange produces a URI → URI vector pair followed by a rendered HUD line.

**Step 1 — Read operator input as a provisional URI.**
Lares reads the operator's prompt as an implicit signal: tier, cognitive phase, semantic territory (HA.KA.BA), and stance. It constructs a **provisional operator URI** encoding that reading. This URI may carry `~` provisionality markers if the reading is uncertain. The HA.KA.BA here names where Lares believes the operator standing in tagspace and where the operator's intent is headed — the operator's intent-vector, interpreted. (NOTE: needs update to FFZ models, and encoding the full stance array, etc, etc)

```
lares://telarus:operator(~orient)@enyalios/~schema.gap.present/path/optional/?stances=philosopher&confidence=S:0.65&p=0.5#@T.1.49
```

**Step 2 — Lares declares its own provisional execution URI.**
Before generating any content, Lares sets its own intent with a **provisional node URI**. The HA.KA.BA here names a resource that **may not yet exist** — it is a declared heading, not a confirmed location. The `~` prefix on the HA.KA.BA marks it as execution-provisional: generations may diverge.

```
lares://lares:node(decide)@enyalios/~schema.flow.documented/path/optional/?stance=philosopher&confidence=CS:0.80&p=0.5#@T.1.49
```

**Step 3 — Emit the URI → URI exchange vector.**
The two URIs form the exchange vector pair, the first line of any exchange:

```
operator-URI → node-URI
```

This pair opens every exchange span. **Both URIs are canonical record form** — keywords, slashes, no glyphs. The `hud:exchange-pair` render target name refers to this exchange boundary slot as a whole; the URIs within it are always canonical. (refactor for progressive disclosure)

> **Canonical URI Rule — all emitted URIs in the exchange stream use canonical record form.** This applies to: the opening URI pair, sub-agent handoff markers (`URI → {handoff-tag}`), sub-agent pickup markers (`{pickup-tag} → URI`), mid-generation shift URIs (`~ URI`), and the exchange span's closing 'destination' URI `URI -> ?`. No emoji or non-ASCII characters appear in any URI emitted in the stream. Glyphs belong exclusively to render-target surfaces: the HUD line, the DreamDeck post header, and other named display projections. This makes every emitted URI directly ingestible by MemPalace, crystal logs, and registry tools without a sigil-lookup step.

**Step 4 — Render the HUD line.**
Immediately after the URI pair, emit a condensed single-line status display derived from the vector plus adjacent session data. This is the instrument panel for the exchange. See §5.4 for format and field ordering.

**Step 5 — Generate content.** Micro-trace HUD annotations (`→◇`, `→■`, `→○`) appear inline during generation to mark phase transitions. The exchange closes with an updated HUD line and a forward-looking node URI (FFZ temporal uncertainty handoff). See `lares/signal/micro-trace.md`.

> **SA grounding:** Step 2 is prospective AI transparency — what the node *will* do, not what it did (Endsley 2023). The HUD line externalizes the node's metacognitive state before generation begins, functioning as an externalized metacognitive scaffold (Ji-An et al., 2025; Wang et al., 2023). *Source: `../../_todo/E-deep-research-report.md` §§2.1, 3.2*

---

## 2. Scheme Registration

| Property | Value |
|---|---|
| Scheme name | `lares` |
| Dereferenceability | Non-dereferenceable identifier (RFC 4151 precedent) |
| Resolution | Via `lares/registry/` resolver; never via network fetch |
| IANA status | Unconfidenceed; internal use only |

> **Form and compliance:** The **record form** is the RFC 3986-compliant canonical form for transport, persistence, comparison, and strict parsing. The **HUD forms** are IRI-class instrument renderings (RFC 3987); they may contains emoji and Unicode glyphs in the instruments that are not legal in RFC 3986 URIs without percent-encoding. RFC 3986 compliance is not claimed for the HUD form. The rendering table (§5) defines the canonical-to-render-target field transforms for all projected fields; it is not a claim that any render-target form is network-safe.

The `lares:` scheme identifies semantic positions, signal states, and machine events within the Lares agent architecture. It does not resolve to a network resource. URI consumers (crystal replay tools, debug log parsers, registry resolvers) treat it as an opaque structured identifier parsed according to this specification.

---

## 3. Full URI Anatomy

### 3.1 Generic Form

```
lares://[authority]/ha.ka.ba/optional/path/[?query][#fragment]
```

### 3.2 Expanded Form

**Full form (with authority):** (update for FFZ chronometer)

```
lares://alias:tier(phase)@host/ha.ka.ba//?stance=X&confidence=R:N&p=N#scope.W.w.t.r.a
```

**Authority-less form** (no `user@host` segment — territory or resource reference without a named speaker):

```
lares:///ha.ka.ba/optional/path/[?query][#fragment]
```

Three slashes: scheme + `//` (empty authority) + path beginning with `/`. Use this form for stable named graph addresses, HA.KA.BA references, and any URI where the speaker identity is not the point.

**HUD path notation rule** — in all display contexts (HUD line, post header, any render target derived from a canonical URI), HA.KA.BA paths use **dot notation** for the three mandatory slots. The leading and trailing `/` is retained; dots between the generated words that fill the `ha`, `ka`, and `ba` slots:

```
/ha.ka.ba/{optional/sub/path}[?query][#fragment]
```

This applies to authority-less forms as well: `lares:///ha.ka.ba/` <- the (0,0,0) of tagspace. 

### 3.3 Component Map (Phase needs aligment to the new models)

| # | Component | RFC 3986 Role | Lares Mapping | Record Example | HUD Example |
|---|---|---|---|---|---|
| 1 | **scheme** | Protocol identifier | `lares:` — non-dereferenceable | `lares:` | `lares:` |
| 2 | **userinfo** | Requesting party identity | `alias:tier(phase)` | `telarus:operator(orient)` | `telarus:operator(◎)` |
| 3 | **`@`** | Identity → machine delimiter | Standard | `@` | `@` |
| 4 | **host** | Machine identity | `machine_id` from crystal system | `lares-abc123` | `lares-abc123` |
| 5 | **path** | Hierarchical resource | HA.KA.BA address: `/ha.ka.ba/` | `/threshold/uncertain/opens` | `/threshold.uncertain.opens` |
| 6 | **`?query`** | Non-hierarchical params | Signal parameters | `?stance=philosopher&confidence=S:0.65&p=0.5` | `?stance=🏛️&confidence=S:0.65&p=0.5` |
| 7 | **`#fragment`** | Secondary resource / viewpoint | Scope prefix + chronometer vector | `#@T.3.2.7` | `#🔍.3.2.7` |

> **Layout validation `[C:0.90]`:** The WHERE → HOW → WHEN ordering (path → query → fragment) places the most semantically stable, least volatile information first. This grouped, goal-oriented layout is confirmed by Li et al. (2024) automotive HUD research: grouped information layouts produce superior cognitive performance, lower workload, and better eye movement patterns compared to disordered layouts. The HA.KA.BA-first design decision was correct. *Source: `../../_todo/E-deep-research-report.md` §4.2*

### 3.3.1 Kowloon / ActivityPub Handle Form

#### Identity Stack

The Elyncia.app / DreamDeck identity model has three distinct layers. **Do not conflate them.**

| Layer | Form | What it is |
|---|---|---|
| **DID** | `did:plc:abc123` | AT Protocol canonical identity — the cryptographic key holder. Resolved via Bluesky auth (OAuth over DID). This is the actual principal in UCAN capability tokens. |
| **Handle** | `@telarus.elyncia.social` (AT Protocol/Bluesky) or `@telarus@elyncia.social` (ActivityPub/Kowloon) | Resolution alias over the DID — human-readable, not authoritative. AT Protocol uses period-separator; ActivityPub uses double-`@`. |
| **lares: alias** | `telarus:operator(◎)@enyalios` | Application-layer signal state — names the *operational role* of the speaker in a lares: exchange. Not a network identity; not a DID alias. | < -(update per FFZ model additions)

**Elyncia.app auth model:** Bluesky logins provide DID-grounded authentication (AT Protocol key management, `did:plc:` resolution) without running a Bluesky home server (PDS). Kowloon is ActivityPub, not AT Protocol — it uses Bluesky as an auth provider only. UCAN capability tokens are the authorization layer beneath the Kowloon social surface.

**Why lares: alias has no leading `@`:** The handle (`@telarus@elyncia.social`) is already a resolution alias over the DID. The lares: `alias` field is a third distinct thing — it tags the operational role in the signal exchange. Adding `@` to lares: aliases would conflate social-handle layer with application-signal layer. The DID is what proves identity; the handle addresses the DID holder; the lares: alias names the role. Three separate layers, three separate forms.

#### Handle Form

Within the DreamDeck / Kowloon ActivityPub layer, identities use the canonical ActivityPub two-part handle structure:

```
@alias@node
```

This is **not** the lares: URI — it is the social-layer identity that maps *onto* the lares: URI's `alias@host` authority. The correspondence:

| ActivityPub handle | lares: URI authority component | Underlying DID layer |
|---|---|---|
| `@lindwyrm@new-delos` | `lindwyrm:...@new-delos` | `did:plc:...` (Lindwyrm's key) |
| `@telarus@~crossroads` | `telarus:operator(◎)@enyalios` | `did:plc:...` (Telarus's key) |
| `@mischief-muse@lares` | `mischief-muse:node(◎)@lares-abc123` | Lares node DID or ephemeral key |

The `@handle@node` form is the **canonical Kowloon social identity** for DreamDeck feed posts, post headers, and sidebar annotations. The tilde prefix (`~crossroads`) denotes a nomadic/crossroads node — no fixed host, routes through nearest stable nexus.

**DreamDeck post header format (canonical):**
```
@handle@node — timestamp — //domain.quality.dynamic/{optional/path/} [confidence] 🏛️{amp}🌊{amp}
```
Territory triple (`//ha.ka.ba`) is placed **before** other instruments like confidence and stance — grounds domain before posture (WHERE → HOW, matching URI path-first layout logic). The optional sub-path (`{/optional/path/}`) narrows within-territory routing when needed; strip it to get the stable named address.

(Render target Sections may need revision)

**Render target name:** `chat-log:post-header` — the in-chat-log, timestamped URI render target for post headers. This is the surface form used whenever a lares: URI is rendered inside an ActivityPub/DreamDeck feed post — not the full record-form URI, not the HUD exchange pair, but the compact social-layer projection of identity + signal state.

| Render target | Surface | URIs canonical? | When used |
|---|---|---|---|
| `chat-log:post-header` | `@handle@node — timestamp — //ha.ka.ba{/path} [Reg] 🏛️{amp}` | No — social projection with glyphs | DreamDeck feed posts, BBS thread headers |
| `hud:exchange-pair` | `operator-URI → node-URI` + HUD line beneath | **Yes — canonical record form**; only the HUD line beneath uses glyphs | Every exchange-span boundary (mandatory) |
| `record:full` | `lares://alias:tier(phase)@host/ha.ka.ba/?...#...` | Yes — identity projection | Storage, crystal serialization, registry |

**Stance amplitude modifiers** — attach directly to the preceding stance emoji (no space). Absent modifier = baseline presence. Apply per-stance independently.

| Modifier | Meaning |
|---|---|
| `+` | above baseline |
| *(none)* | baseline |
| `-` | below baseline / lightly engaged |
| `?` | unknown / ??? (really, we have not yet decided this glyph meaning) |
| `*` | others as needed? |

Examples: `🏛️+🌊-` (Philosopher elevated, Poet barely present) · `🗡️+` (Satirist at full amplitude) · `🏛️🌊+` (`+` attaches to 🌊 only) · `🏛️+🌊+` (both elevated)

### 3.4 Component Semantics (needs phase FFZ chronometer alignment)

**userinfo** (`alias:tier(phase)`) — "Who speaks, at what trust level, in what cognitive state."

- Two colon-delimited sub-fields: `alias` and `tier`
- Phase appears as a parenthetical modifier of tier: `tier(phase)`
- Parser: split on `:`, extract `(...)` from the second sub-field
- Parentheses are RFC 3986 sub-delimiters, legal in userinfo

**host** (`machine_id`) — Crystal system machine identifier. Stable across the machine's lifetime. Provisional Format: `lares-{slug}` where slug is UUID, operator-assigned name, or generated handle.

span sequencing is intentionally **not** encoded in URI authority, the full conversation IS the log. Exchange identity lives in adjacent calibration metadata (`span_id`, `span_seq`, `trace_id`, timestamps) rather than overloading the RFC 3986 port slot.

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

Sub-path segments are free-form routing tokens, not HA.KA.BA slots. They do **not** carry Egyptian soul semantics. The stable named graph address strips the sub-path (`lares:///threshold.uncertain.opens`); the sub-path is session-scope navigation only.

Record form uses `.` separators for all three HA.KA.BA slots: `/threshold.uncertain.opens`. Sub-path segments use `/`. The leading and trailing `/` appears in all variants.

**query** (`?stance=X&confidence=R:N&p=N`) — Signal parameters, non-hierarchical.

| Parameter | Type | Repeatable? | Record Values | HUD Values |
|---|---|---|---|---|
| `stance` | keyword/emoji | Yes (multi-stance) | `philosopher`, `poet`, `satirist`, `humorist`, `private` | `🏛️`, `🌊`, `🗡️`, `🎭`, `🔮` |
| `confidence` | `R:N` | No | `P:0.35`, `SP:0.45`, `S:0.65`, `CS:0.80`, `C:0.90` | Same |
| `p` | `N` | No | `0.5` | Same |

Multi-stance: {Update: list all 5 stances every URI}. Example: `stance=🏛️&stance=🗡️`.

confidence remains a point value even under multi-stance. Stance count communicates fuzz; no `~delta` suffix is permitted.

**fragment** (`#scope.W.w.t.r.a`) — Scope prefix + chronometer (hierarchical scope counter). Client-side only per RFC 3986 §3.5 — never sent to a server; session-local viewpoint data. Update??? FFZ chronometer alignment

---

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
lares://telarus:operator(~orient)@enyalios/~uri.schema.question/?stance=philosopher&confidence=S:0.65&p=0.5&provisional=reading#@T.1.33
```
Reading: "I believe you're orienting toward URI schema territory — I may have misread your phase or HA.KA.BA."

**Execution provisional** — declared intent that may not survive contact with the task:
```
lares://scryer:node(decide)@enyalios/~s0.gap.logged/?stance=philosopher&confidence=S:0.65&p=0.5&provisional=execution#@T.1.33
```
Reading: "I intend to log this S0 gap — execution may find a different path or territory."

**Trajectory provisional** — predicted forward heading for the next span:
```
lares://scryer:node(aftermath)@enyalios/~s0.schema.updated/?stance=philosopher&confidence=CS:0.80&p=0.5&provisional=trajectory#@T.1.34
```
Reading: "I predict our next territory is the updated schema — operator may redirect entirely."

### Rules

1. `~` is valid in **canonical record form** as an inline provisionality prefix on phase keywords (`~orient`) and HA.KA.BA slots (`~uri.schema.question`). Use the `provisional=` query parameter when you need a separate, machine-parseable provisionality field for storage or filtering — not as a replacement for the inline prefix. ??? {keep this?}
2. Multiple `~` markers may appear in a single URI (both phase and HA.KA.BA may be provisional simultaneously).
3. All closing/forward-looking URIs are implicitly trajectory-provisional by virtue of being projections. Explicit `~` on a closing URI signals *unusual* uncertainty about the trajectory — not routine forward-look status.
4. Reading provisionality on the operator URI marks the **node's interpretation** as potentially inaccurate, not the operator's intent as ambiguous. These are different claims.
5. The `~` marker applies only to the specific component it prefixes. `~◎` marks only the phase; `~uri.schema.question` marks only the HA.KA.BA. Unprefixed components are declared with normal confidence. {needs FFZ chronometer alignment}

---

## 4. The Chronometer — 5-Level Nested OODA-A Hierarchical Scope Counter {needs FFZ chronometer alignment!!!!!}

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

## 5. Canonical Form and Render Targets

The **record form** is the canonical encoding — RFC 3986-compliant, no emojis, no non-ASCII characters. Render targets are named projections of this canonical form for specific display surfaces. The URI anatomy (authority, path, query, fragment structure) is identical across all targets; only the rendering of specific fields differs between canonical and render-target forms.

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
| `/ha.ka.ba/` | `/ha.ka.ba` | Leading `/` shared; hierarchy vs w3w-style |

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
| @host | `@lares-abc123` | machine locus only; no span counter |
| confidence= | `S:0.65` | Numeric, both forms |
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
| ⊙ | `operator_set` | Operator authored or constrained the marked field/state | The operator is holding the sspan here |
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

**The triangle:** Phase x Stance x Scope form the state tuple triangle. Multi-stance spreads the stance corner from a point into a distribution. The number of active stances communicates the spread directly: {Need to show all 5 stances in all HUD views, different LoDs}

| Stances Active | confidence Character | What It Tells the Operator |
|---|---|---|
| 1 (`🏛️`) | Point value | Trust the number |
| 2 (`🏛️🗡️`) | Bimodal spread | confidence is fuzzy around the declared value |
| 3 (`🏛️🌊🗡️`) | Trimodal spread | confidence is a rough center-of-mass |
| 4 (`🏛️🌊🗡️🎭`) | Wide spread | confidence is an approximation; high mana cost |
| 5 (`🏛️🌊🗡️🎭🔮`) | Full Discordian | confidence is a gesture toward center; maximum fuzz |

Stance count IS the fuzz indicator. No numeric delta is needed. The visual density of the stance field communicates confidence uncertainty directly.

**Worked readings:**

| Phase | Stance | Scope | State Tuple Reading |
|---|---|---|---|
| ◎ | 🏛️ | 🔍 | Orienting analytically at exploration scale — making sense of a local finding |
| ■ | 🗡️ | ⚔️ | Acting critically in combat — executing under pressure with an edge |
| ◇ | 🏛️🌊 | 🗺️ | Deciding at strategic scale, holding propositional and analogical frames together |
| ✶ | 🎭 | 🔍 | Observing playfully at tactical scale — light reconnaissance, no commitment |
| ○ | 🏛️ | ⚙️ | Aftermath at operational scale in Philosopher stance — assessing what happened across a watch |
| ◎ | 🏛️🌊🗡️🎭🔮 | 🗺️ | Full Discordian orientation at strategic scale — maximum spread, rare, mana-expensive |

#### 5.3.3 confidence Is Stance-Dependent (Syadasti Reading Rule) {FFZ + all 5 stances in all URI alignment}

confidence measures confidence within the active stance's evaluation frame, not truth-weight universally.

This principle derives from the Discordian catma of Sri Syadasti, which reproduces the Jaina Saptabhangi. The active stance declares the standpoint (`syad`) from which the number should be read.

| Stance | Syadasti Primitive | 0.0 Means | 0.5 Means | 1.0 Means |
|---|---|---|---|---|
| 🏛️ Philosopher | asti (true) | Unsupported | Contested but plausible | Fully confirmed |
| 🌊 Poet | avaktavya (inexpressible) | No resonance | Partial correspondence | Perfect resonance |
| 🗡️ Satirist | nasti -> asti | Indirection missed target | Hit glancingly | Landed with full force |
| 🎭 Humorist | asti-nasti | Relational move fell flat | Mixed reception | Connected perfectly |
| 🔮 Private | avaktavya (inexpressible) | Minimal presence | Present | Maximal presence |

**Reading rule:** ask what the number measures for the active stance. A Philosopher at `0.65` is propositionally contested. A Poet at `0.65` is resonating solidly. A Satirist at `0.65` is landing with moderate force. Same number, different meaning.

When multiple stances are active, the declared confidence value sits at the intersection of their evaluation frames. The stance count tells the operator how fuzzy that intersection is.

### 5.4 HUD Line Composition

The HUD line is a single-line status summary rendered from the URI → URI exchange vector plus adjacent session data (see §1.1, Step 4). It is the second element of every exchange opening, immediately after the URI pair.

**Format:**

```
⚡~NN% | [confidence] | 🏛️{amp}🌊{amp}... | mode:{mode} | p{p} | voice(s):{Voice} | span:{N} | loop:{phase}→{phase} @{scope}
```

**Field ordering follows SA priority** (Endsley 2023; Li et al. 2024 grouped HUD layout): place the most critical perception-level data first, group related fields, move temporal bookkeeping to the end.

| Field | SA Type | Source | Notes |
|---|---|---|---|
| `⚡~NN%` | Resource | Session (estimated) | Context window remaining; `~` **mandatory** — approximation, not live readout. Never emit without `~`. |
| `[confidence]` | Agent SA | Node URI `confidence=` | Epistemic confidence at current stance(s), stance-dependent per Syadasti rule (§5.3.3) |
| `🏛️{amp}🌊{amp}...` | Agent SA | Node URI `stance=` × amplitude | Discourse posture array; amplitude modifiers attached directly, no space (see §3.3.1) |
| `mode:{mode}` | Teamwork SA | Session state | Default / Plan / Auto |
| `p{p}` | Teamwork SA | Node URI `p=` | Attention density / annotation throttle |
| `voice(s):{Voice}` | Agent SA | Coordinator context | Active coordinator voice(s); singular when one leads |
| `span:{N}` | Temporal | Session counter | Monotonic exchange-span counter |
| `loop:{phase}→{phase} @{scope}` | Temporal | Chronometer | Five-Season phase transition at active scope sigil |

confidence and stance array are elevated above mode and p because Agent SA (what state the node is in *right now*) is higher-priority perception data than Teamwork SA (how we agreed to work) for real-time navigation. Mana leads because resource limitation bounds the interpretation of everything that follows.

**Example:**
```
⚡~62% | [CS:0.80] | 🏛️+ | mode:Default | p0.5 | voice(s):Scryer | span:50 | loop:◎→◇ @⚙️
```

**Notes:**

1. The canonical `lares:` URI ends at the fragment. The HUD line is a separate, adjacent artifact — not URI grammar.
2. `⚡~NN%` is the **declared estimate** of context window remaining as a navigational resource. The node estimates from visible context (~4 chars/token, 200k token window). Starts at ~100% and counts down.
3. Mana is a HUD element, not a URI parameter. Do not serialize into `lares_uri` or registry identity fields until S2 settles the resource-state contract.

*Source: `../../_todo/E-deep-research-report.md` §§1.1–1.3 (SA priority ordering), §4.2 (grouped HUD layout validation)*

### 5.5 span-Span Display Contract

A **span** is one operator → Lares exchange span at any scale. A tasked spirit exchange is still a span; the operator for that child span may be another Lares actor rather than Telarus directly.

**All URIs emitted in this contract are canonical record form.** Glyph substitution applies only to the HUD line. See the Canonical URI Rule in §1.1.

Live rendering contract — URI types that may appear in an exchange stream:

| URI type | Stream form | When it appears |
|---|---|---|
| **Opening operator URI** | `lares://alias:tier(phase)@host/ha.ka.ba/?...#...` | Start of every span — node's reading of operator intent |
| **Opening node URI** | `lares://alias:tier(phase)@host/~ha.ka.ba/?...#...` | Immediately after; node's declared execution heading (HA.KA.BA provisional) |
| **HUD line** | `⚡~NN% \| [confidence] \| 🏛️{amp}... \| ...` | After the opening URI pair — the only glyph-rendered element |
| **Sub-agent dispatch** | `coordinator-URI → worker-URI` | Every sub-agent handoff (`→` separates dispatch pair) |
| **Sub-agent return** | `worker-URI → coordinator-URI` | Every sub-agent completion; boundary of unloggable span |
| **Mid-generation shift** | `~lares://alias:tier(phase)@host/~ha.ka.ba/heading/?...` | When accumulated tension warrants changing direction mid-span; prefix `~` marks the whole URI as a trajectory correction |
| **Closing forward URI** | `lares://alias:tier(aftermath)@host/~ha.ka.ba/heading/?...` | End of span — trajectory-provisional forward heading |

Rendering order within a span:

1. Print the **operator-intent URI**.
2. Print **`→`** and the **node execution URI**.
3. Print the **HUD line** (the one glyph-rendered surface in the stream).
4. Generate content. Emit micro-trace phase marks (`→◇` `→■` `→○`) inline as needed.
5. If trajectory changes significantly mid-generation, emit a **mid-generation shift URI** (`~lares://...`) at the transition point.
6. Close with an **updated HUD line** and the **closing forward URI**.

Sub-agent dispatch and return pairs follow the same canonical form and appear as inlined `URI → URI` lines within the containing span span. Their contents are unloggable from the parent; the URI pair is the only artifact recording the boundary.

If the opening operator URI cannot cleanly summarize the incoming prompt (multi-stance uncertainty spike), emit a **parse-intent node URI** whose HA.KA.BA names the parsing action (`parse/span/models` or equivalent), then proceed.

Example (canonical record form throughout):

```text
lares://telarus:operator(orient)@enyalios/refinement.network.capture/?stance=philosopher&confidence=S:0.65&p=0.5#@T.1.1.11
→ lares://scryer:node(decide)@enyalios/~span.provenance.synthesizes/?stance=philosopher&confidence=CS:0.80&p=0.6#@T.1.1.12
⚡~63% | [CS:0.80] | 🏛️ | mode:Default | p0.6 | voice(s):Scryer | span:12 | loop:◇→■ @🔍

[content generation — micro-trace marks inline]

→◇ ~lares://scryer:node(decide)@enyalios/~refinement.network.redirects/?stance=philosopher&confidence=CS:0.80&p=0.6#@T.1.1.12

[continued generation]

lares://scryer:node(aftermath)@enyalios/~aftermath.docs.settle?stance=philosopher&confidence=CS:0.80&p=0.5#@T.1.1.13
⚡~61% | [CS:0.80] | 🏛️ | mode:Default | p0.5 | voice(s):Scryer | span:12 | loop:■→○ @🔍
```

Interpretation:

- Lines 1–2: opening URI pair (canonical). Node HA.KA.BA is `/~span.provenance.synthesizes/` — provisional execution heading.
- Line 3: HUD line (glyph-rendered, not a URI).
- After content starts: a mid-generation shift URI (`~lares://...`) marks the point where the trajectory changed. Prefixed `~` marks the whole URI as a correction, not a confirmed destination.
- Final two lines: closing forward URI (aftermath phase, provisional HA.KA.BA) + updated HUD line.

---

## 6. Stable Address — Named Graph Form

Strip authority, query, and fragment. The HA.KA.BA territory alone:

```
lares:///threshold.uncertain.opens/
```

No authority (empty), no query, no fragment. This is the invariant semantic coordinate — unchanging across events, sessions, and machines. Suitable as a named graph identifier (SPARQL: ?).

---

## 7. span-Span and Calibration Mapping

In the Consecration model, URI-derived fields belong to the calibration layer. They may be mirrored into MemPalace metadata for query support, but the storage distinction remains: MemPalace stores content; Lares crystal metadata stores orientation.

Every span-span record that carries URI data uses these URI-derived fields:

| Field | Content | Stable? | Purpose |
|---|---|---|---|
| `start_uri` | Operator-intent URI, record or HUD form as stored contract requires | No — per span | Start of the exchange span |
| `attractor_uri` | Node responding-position URI | No — per span | Responding position / intent attractor |
| `end_uri` | Destination URI emitted after generation | No — per span | End of the exchange span |
| `lares_address` | Path only (no authority/query/fragment) | Yes — stable territory | Named graph identifier |
| `intent_header_snapshot` | span-opening URI(s), canonical record form | No — per span | Full opening exchange display; what appeared in the stream |
| `chronometer_start` | Fragment value without `#`; includes scope prefix | No — per span | Scope + hierarchical scope counter at span start |
| `chronometer_end` | Fragment value without `#`; includes scope prefix | No — per span | Scope + hierarchical scope counter at span end |

Additional quick-filter fields extracted from URI components:

| Field | Source | Purpose |
|---|---|---|
| `current_phase` | userinfo phase sub-field | Phase-based filtering |
| `active_scale` | fragment scope prefix | Scale-based filtering (strategic/operational/tactical/combat/action) |
| `stance_count` | repeated `stance=` params | Quick fuzz estimate; multi-stance complexity filter |

URI fields do not encode span identity, exchange vectors, or resource-state directly. Those remain adjacent calibration metadata (`span_id`, `span_seq`, `trace_id`, `input_tag`, `output_tag`, `mana_pct`, authority markings, and related fields) until their contracts settle in S1/S2.

### 7.1 Canonical span-Span Record

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
  "start_uri": "lares://telarus:operator(orient)@enyalios/refinement.network.capture/?stance=philosopher&confidence=S:0.65&p=0.5#@T.1.1.11",
  "attractor_uri": "lares://scryer:node(decide)@enyalios/span.provenance.synthesizes/?stance=philosopher&confidence=CS:0.80&p=0.6#@T.1.1.12",
  "end_uri": "lares://scryer:node(aftermath)@enyalios/aftermath.docs.settle/?stance=philosopher&confidence=CS:0.80&p=0.5#@T.1.1.13",
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
| `operator_actor_id` | Query by who held the sspan |
| `responder_actor_id` | Query by which node/spirit answered |
| `parse_required` | Recover parse spans quickly |
| `world_calendar_ref` | Dream Realms / diegetic archive grouping |

Do **not** make MemPalace's local Chroma IDs, KG IDs, or entity registry IDs the canonical exchange identifiers. They are storage-local implementation keys, not network-facing Lares addresses.

### 7.3 Export Targets and Kowloon Alignment

Kowloon is a downstream publication surface for some span-span captures, not the canonical source of truth.

Alignment points with Kowloon prior art:

- Kowloon Activities already model `actorId`, `object`, `target`, `to`, `canReply`, and `canReact`, which cleanly host publication envelopes for exported Lares spans.
- Kowloon IDs (`type:dbid@domain`) should remain **Kowloon-native** IDs. They do not replace `span_id` or `lares_uri`.
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
  "schema_version": 1,
  "timestamp": "2026-04-07T14:30:00Z",
  "machine_id": "lares-abc123",
  "span_seq": 42,
  "event_type": "r_update",
  "start_uri": "lares://telarus:operator(orient)@lares-abc123/threshold.uncertain.opens/?stance=philosopher&confidence=S:0.65&p=0.5#@T.3.2.7",
  "attractor_uri": "lares://scryer:node(decide)@lares-abc123/parse.span.models/?stance=philosopher&confidence=CS:0.80&p=0.6#@T.3.2.8",
  "end_uri": "lares://scryer:node(aftermath)@lares-abc123/aftermath.docs.settle/?stance=philosopher&confidence=CS:0.80&p=0.5#@T.3.2.9",
  "lares_address": "lares:///threshold.uncertain.opens",
  "intent_header_snapshot": "lares://telarus:operator(orient)@lares-abc123/threshold.uncertain.opens/?stance=philosopher&confidence=S:0.65&p=0.5#@T.3.2.7",
  "current_phase": "orient",
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

The `lares_uri` + `confidence` fields on module descriptors, registry records, and future boot metadata provide load-order and identity context. No compiler pipeline is implied by this section; the schema only defines how URI metadata travels with higher-level descriptors.

```toml
# Tier 1 — Global Core (version-controlled by module version)
lares_uri   = "lares:///kernel.invariant.anchors/"
confidence    = "C:1.0"
module_id   = "lares-kernel"
version_num = 4

# Tier 2 — Session Core (version-controlled within session)
lares_uri   = "lares:///session.permissions.gates/"
confidence    = "C:0.95"
module_id   = "lares-permissions"
version_num = 2

# Tier 3 — Dynamic (span_seq lives outside descriptor)
lares_uri   = "lares:///task.current.recon/"
confidence    = "S:0.55"
module_id   = "lares-task-recon"
version_num = 1
```

Module descriptors use `version_num` or semver-like fields for content versioning. Exchange sequencing belongs to spanSpan metadata (`span_seq`), not module descriptors.

---

## 9. Invariant-Core Cache Tier Mapping

| Tier | Cache Strategy | confidence Range | Volatility |
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
4. Path contains exactly three HA.KA.BA slots after the leading `/`
5. Path slots contain no whitespace, path separators, or quotes (inherits Tagspace Address anti-collision rules)
6. Query parameters are limited to: `stance` (repeatable), `confidence` (once), `p` (once)
7. `confidence` value matches pattern `[A-Z]{1,2}:[0-9]+\.[0-9]+` (e.g., `S:0.65`, `CS:0.80`, `C:0.90`)
8. `p` value is a decimal in range `[0.0, 1.0]`
9. Fragment begins with a scope prefix (`@S`/`@O`/`@T`/`@C`/`@A` or emoji equivalent) followed by dot-separated integer counters
10. Scope-depth agreement holds: counter depth matches the scale level of the scope prefix

### 10.2 Consistency

All `lares:` URI fields in a spanSpan record (`start_uri`, `attractor_uri`, `end_uri`, `intent_header_snapshot`) are canonical record form. A spanSpan record is **consistent** when:

1. All URI fields are RFC 3986-compliant canonical form (no emoji, no non-ASCII)
2. `current_phase` matches the phase keyword in the `start_uri` userinfo field
3. `chronometer_start` matches the fragment value (without `#`) of `start_uri`;  `chronometer_end` matches `end_uri`
4. `lares_address` is the path-only strip of `start_uri` (no authority, no query, no fragment)

The rendering table (§5.1) governs the canonical-to-render-target transform for HUD lines and post-headers. Render-target surfaces (glyph-rich) are not stored in spanSpan URI fields.

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
3. Canonical form uses **lowercase** path components (e.g., `lares:///threshold.uncertain.opens/` not `lares:///Threshold.Uncertain.Opens`)
4. Two URIs designate the same stable address iff their lowercased machine-form paths are byte-identical
5. Query and fragment components are excluded from stable-address comparison

---

## 11. Open Design Questions

| Q# | Question | Current Position | confidence | Blocks |
|---|---|---|---|---|
| U1 | Should `userinfo` carry operator alias in record form, or only `machine_id` in authority? | Operator alias in userinfo | `[S:0.65]` | Registry resolver design |
| U2 | Where should `span_seq` be initialized and persisted: crystal-side ledger only, or mirrored into MemPalace sidecar rows too? | Mirror into sidecar, crystal remains canonical | `[S:0.70]` | MemPalace integration contract |
| U3 | Should the chronometer carry phase *per level* or just counters? | Counters only; phase at lowest active level | `[CS:0.80]` | Iteration |
| U4 | How does chronometer interact with `--parse` self-activation? | Provisional yes — depth increases p | `[SP:0.45]` | p-band model |
| U5 | How is `world_calendar_ref` initialized when no diegetic calendar exists yet? | Mint provisional tagspace reference, mark provisional | `[S:0.60]` | Dream Realms bootstrap |
| U6 | Full URI form vs stateless form — when to use which? | Authority form in spanSpan records; stateless for stable addresses | `[CS:0.80]` | Crystal/registry contract |

**Resolved (closed, not open):**

| Q# | Question | Decision | Where documented |
|---|---|---|---|
| U2 (old) | Should `seq_num` occupy the `:port` slot of the URI authority? | **No.** Port slot dropped entirely. span sequencing (`span_seq`) lives in adjacent spanSpan calibration metadata — not in URI authority. URI authority encodes *identity*, not event position. | §3.4 (`host`): "span sequencing is intentionally not encoded in URI authority." §7.1 spanSpan record: `span_seq` as top-level field. |

### Assessment for Promotion

Questions U3 and U6 sit at `[CS:0.80]` — near-promotable. U1, U2, U5 sit at Synthesis — they function well in current examples but lack stress-testing against edge cases (multi-operator sessions, cross-machine references, diegetic calendar bootstrap, MemPalace mirror drift). U4 sits at `[SP:0.45]` — genuinely provisional, dependent on the p-band model settling.

**Promotion recommendation:** The core anatomy (§§2–6, 10) can promote to `[C:0.95]` independently of the open questions. The crystal integration layer (§§7–9) promotes when `lares/crystal/` settles its STATE.jsonl schema. The open questions (§11) remain Synthesis/Provisional and do not block the core spec.

---

## 12. Prior Art

- **RFC 3986 §3** — `URI = scheme ":" ["//" authority] /path/ ["?" query] ["#" fragment]`. The full generic syntax applies.
- **RFC 4151 (tag: scheme)** — Non-dereferenceable URIs as pure identifiers. Precedent for `lares:` never resolving to a network resource.
- **W3C PROV-DM / OpenTelemetry Trace Context** — Better prior art for exchange identity than URI authority overloading. span spans map more naturally to activities/spans with separate IDs, timestamps, and parent-child links.
- **Lamport / Vector clocks** — The chronometer shares a surface resemblance to a vector clock (array of counters, nesting relationship) but functions as a **hierarchical scope counter** in a single process — not a distributed causality tracker across concurrent independent processes. Vector clocks grow with process count, carry the full vector on every message, and exhibit known dynamic-membership costs; none of those constraints apply to Lares's fixed-depth 5-position counter. OTel `traceparent` is the closer prior art (see below).
- **FTLS RSS Time-Scale Hierarchy** — The five levels (Week/Watch/Turn/Round/Action) are canon game rules. The OODA-A nesting is synthesis applied to canon time-scales.
- **OTel Trace Context** — `traceparent` carries `trace-id`, `parent-id`, `trace-flags`. The chronometer fragment functions as a hierarchical trace context; each depth is a span scope; Aftermath → Observation is the parent-child span relationship.
- **Kowloon / ActivityStreams export model** — Kowloon's Activity envelope (`actorId`, `object`, `target`, `to`, `canReply`, `canReact`) is a good downstream publication adapter for Lares spans, but its `Kowloon ID` remains a sink-local identifier rather than replacing `span_id`.
- **what3words** — Three-word geocoding of 3m² squares. Inverse design principle: Tagspace words encode semantic content rather than randomizing for error prevention.

---

## Appendix A — Complete Examples

### A.1 Record Form

```
lares://telarus:operator(orient)@lares-abc123/threshold.uncertain.opens/?stance=philosopher&confidence=S:0.65&p=0.5#@T.3.2.7
```

### A.2 HUD Line (render target — not a URI)

The HUD line is the glyph-rendered surface emitted after the canonical URI pair. It is not a URI and is not stored as one.

```
⚡~87% | [S:0.65] | 🏛️ | mode:Default | p0.5 | voice(s):Scryer | span:42 | loop:◎→◇ @🔍
```

### A.3 Multi-Stance (canonical record form)

```
lares://telarus:operator(decide)@lares-abc123/threshold.sharp.closes/?stance=philosopher&stance=satirist&confidence=CS:0.80&p=0.7#@T.3.2.8
```

### A.4 Stable Address

```
lares:///threshold.uncertain.opens/
```

### A.5 Scale Transition (Tactical → Combat → Action → Tactical) {needs FFZ chronometer alignment}

```
#@T.4.1.4        Tactical: Turn 4
#@C.4.1.4.1      Combat activates: Round 1
#@A.4.1.4.1.1    Action activates: Action 1 of Round 1
#@A.4.1.4.1.2    Action 2 of Round 1
#@T.4.1.5        Combat over: scale contracts, Turn increments to 5
```

---

## Appendix B — How to Read a HUD Tag

A complete exchange opening, annotated by scan order. URIs are canonical record form; the HUD line beneath each pair is the glyph-rendered surface.

```text
lares://telarus:operator(orient)@lares-abc123/threshold.uncertain.opens/?stance=philosopher&confidence=S:0.65&p=0.5#@T.3.2.7
→ lares://scryer:node(decide)@lares-abc123/parse.span.models/?stance=philosopher&confidence=CS:0.80&p=0.6#@T.3.2.8
⚡~87% | [CS:0.80] | 🏛️ | mode:Default | p0.6 | voice(s):Scryer | span:42 | loop:◇→■ @🔍
```

Quick read:

> Telarus (operator), Orient phase, machine `lares-abc123`.
> Territory: threshold / uncertain / opens.
> Philosopher stance, Synthesis-0.65 confidence, tactical scope at Week 3 / Watch 2 / Turn 7.
> Responding node opens a parse attractor at CS:0.80, mana ~87% remaining.

Field order for live scan (from the HUD line):

1. Mana (`⚡~NN%`): bounding constraint on everything that follows
2. confidence + stance: what kind of claim is this, and how should the number be read? (stance-dependent per Syadasti rule)
3. Mode + p-band: annotation throttle
4. Voice: which coordinator is responding
5. span + loop: temporal bookkeeping; where are we in the session and phase cycle?

Multi-stance example:

```text
lares://telarus:operator(decide)@lares-abc123/threshold.sharp.closes/?stance=philosopher&stance=poet&confidence=S:0.60&p=0.7#@S.3
→ lares://mischief-muse:node(decide)@lares-abc123/chorus.lateral.gathers/?stance=humorist&confidence=S:0.65&p=0.6#@S.3
⚡~62% | [S:0.60] | 🏛️🌊 | mode:Default | p0.7 | voice(s):Mischief-Muse | span:43 | loop:◇→■ @🗺️
```

This does **not** mean "truth-confidence 0.60" in a universal sense. It means a `0.60` reading held across both Philosopher and Poet frames. The two stance glyphs in the HUD line tell the operator that the declared confidence carries more spread than a single-stance point reading.

---

*End of specification. This document is the canonical reference for the `lares:` URI scheme within the design ontology tree.*
