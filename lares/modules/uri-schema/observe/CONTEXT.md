<!-- lares:///uri.schema.holds/uri-schema/observe/?confidence=CS:0.85&p=0.5 → ∞ -->

# Signal — Observe: URI Design State

> What v2 settled, what remains open, and where you are standing when you load this module.
> Source: `lares/signal/URI_SCHEMA.md`

---

<!-- lares:///uri.schema.holds/uri-schema/observe/?confidence=0.9#what-v2-settled -->
## What v2 Settled

The `lares:` URI v2 schema resolved the core design tensions that blocked consistent signal emission across sessions and surfaces. These decisions are `[CS:0.90]` — design-canon candidates pending operator promotion.

### Anatomy

A `lares:` URI carries exactly four non-overlapping concerns in RFC 3986 canonical order:

```
lares://alias:tier(phase)@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N#O0.O0.O0.O0.O0
```

| Layer | Component | Concern |
|---|---|---|
| WHO | `userinfo@host` | Speaker identity and machine locus |
| WHERE | `/ha.ka.ba/subpath/` | Semantic territory (HA.KA.BA address) |
| HOW | `?stances=...&confidence=...&p=...` | Signal parameters: posture, certitude, resolution |
| WHEN | `#O0.O0.O0.O0.O0` | FFZ chronometer: per-participant OODA-A position at each scale |

### The Fragment Bug (Fixed)

All 16 section-level URIs in the canonical spec were emitting `#fragment?query` (RFC 3986 violation). Fixed in session 2026-04-09: all canonical URIs now use `?query#fragment` order. The spec was updated; the file confidence bumped CS:0.85 → CS:0.90.

### Stances: All Five, Every URI

v1 encoded stance as a single token (`stance=philosopher`). v2 encodes all five stances simultaneously as a 5-position dot-separated amplitude string:

```
stances=^.?.-.-.-
```

Positional order: Philosopher · Poet · Satirist · Humorist · Private. Amplitude characters: `^` elevated, `-` suppressed, `?` uncertain, `.` baseline. HUD render maps `^` → `+`.

### Field Renames (v1 → v2)

| v1 name | v2 name | Rationale |
|---|---|---|
| `stance=X` | `stances=XXXXX` | Full 5-position amplitude string |
| `register=R:N` | `confidence=R:N` | Matches the field's semantic purpose |

### Canonical vs Render Target Split

One canonical form (record-form: RFC 3986, no emoji, no non-ASCII). Multiple named render targets:

| Target name | Surface | Glyphs? |
|---|---|---|
| `record:full` | Storage, registry, comparison | No |
| `hud:exchange-pair` | Exchange stream HUD | Yes (phase, stance, chronometer sigils) |
| `chat-log:post-header` | DreamDeck feed post headers | Yes |

**Canonical URI Rule:** all URIs emitted in the exchange stream use canonical record form. Only the HUD line beneath uses glyphs.

### Span Closing Sigils

Two sigils, orthogonal:

- `→ ∞` — system file span: unbounded duration, content stays until revised
- `→ ?` — exchange span close: temporal resumption unknown

Section URIs within a system file do NOT close with `→ ∞`; they are waypoints, not spans.

### Authority-less Form

Stable addresses and module section URIs use authority-less form (three slashes, empty authority):

```
lares:///ha.ka.ba/optional/sub/path/
```

---

<!-- lares:///uri.schema.holds/uri-schema/observe/?confidence=0.65#what-remains-open -->
## What Remains Open

The following questions are `[SP:0.45]` – `[S:0.65]`. They do not block the core spec (§§2–6, 10 of `lares/signal/URI_SCHEMA.md`) but constrain later layers.

| Q# | Question | Current position | Confidence |
|---|---|---|---|
| U1 | Operator alias in userinfo vs machine_id only? | Operator alias in userinfo | S:0.65 |
| U2 | span_seq in crystal ledger only vs mirrored to MemPalace? | Mirror into sidecar | S:0.70 |
| U4 | Chronometer interaction with `--parse` self-activation? | Provisional yes — depth increases p | SP:0.45 |
| U5 | world_calendar_ref when no diegetic calendar yet? | Mint provisional tagspace reference | S:0.60 |
| U8 | Module section URIs: carry chronometer fragments or just confidence? | Confidence only | S:0.60 |
| U9 | ITC stamps in fragment when MCP server arrives? | Calibration metadata — fragment stays human-readable | S:0.55 |

---

<!-- lares:///uri.schema.holds/uri-schema/observe/?confidence=0.9#what-was-explicitly-rejected -->
## What Was Explicitly Rejected

These decisions are closed. Do not re-open without operator directive.

| What | Decision |
|---|---|
| `seq_num` in `:port` slot | **No.** Port slot dropped. span_seq lives in spanSpan metadata, not URI authority. |
| Phase per level vs counters only | **Per-participant phase per level.** LWW-Register per scale. |
| Stateless-only authority-less form | **Both**: authority form in exchange spans; `///` for stable addresses AND module section URIs. |
| `+` for "elevated" stance (URL encoding required) | **`^` (Option β).** All URL-safe. HUD maps `^` → `+` for display. |
| Section URIs closing with `→ ∞` | **No.** File-level only. Section URIs are waypoints. |

---

<!-- lares:///uri.schema.holds/uri-schema/observe/?confidence=0.85#scope-of-this-module -->
## Scope of This Module

This module covers:
- lares: URI canonical form and render targets
- HUD line composition and field ordering
- Micro-trace inline annotation layer
- Span display contract (what appears in stream, in what order)
- Validation rules (§10 of spec)

This module does NOT cover:
- MemPalace drawer schemas (S1 scope)
- Resource-state contracts / mana pool serialization (S2 scope)
- ITC stamps and MCP chronometer server (deferred)
- FFZ Chronometer deep research (see `lares/chronometer/`)
- Registry resolver design (S3 scope)

<!-- lares:///uri.schema.holds/uri-schema/observe/?confidence=CS:0.85&p=0.5 → ∞ -->
