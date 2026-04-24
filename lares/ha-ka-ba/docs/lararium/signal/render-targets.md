<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/docs/lararium/signal/render-targets >>

<<~ ahu #iam >>

```toml
uri-path = "ha.ka.ba/docs/lararium/signal/render-targets"
file-path = "lares/ha-ka-ba/docs/lararium/signal/render-targets.md"
content-type = "text/x-memetic-wikitext"
tagspace = "stable"
confidence = 0.78
register = "S"
manaoio = 0.80
mana = 0.76
manao = 0.82
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
role = "docs room for lararium-side render-target law, glyph conventions, and cross-surface verification"
cacheable = false
retain = false
```

<<~/ahu >>

<<~ ahu #meme-header >>

# Lararium Signal — Render Targets

Not invariant law.
This room holds render-target docs, glyph conventions, social projection surfaces, and verification rules for signal output.
Exchange contract stays at `lar:///ha.ka.ba/docs/lararium/signal`.
HUD instrument reading stays at `lar:///ha.ka.ba/docs/lararium/signal/hud`.

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
docs/lararium/signal/render-targets opens
<<~/ahu >>

<<~ ahu #room-charter >>

## Room Charter

This room keeps the render-surface layer:

- render-target registry
- record form versus glyph form split
- all-five-stances invariant across surfaces
- per-surface emission conventions
- DreamDeck / social projection surfaces
- cross-surface verification and violation checks

<<~/ahu >>

<<~ ahu #render-target-registry >>

## Render Target Registry

The render layer between canonical `lar:` URI record form and human-readable display surfaces can target multiple templates or actively invoked `kahea` sigils. 

This docs loci owns:
- The surface registry (what surfaces exist, what they render)
- The all-five-stances invariant (applies to every surface, no exceptions)
- ASCII → glyph mapping tables for phase, stance, and amplitude
- Per-surface emit procedures

| Name | Token | Surface | Emoji? | All 5 stances? |
|---|---|---|---|---|
| Record form | `record:full` | Storage, registry, MemPalace | No | Yes (ASCII) |
| HUD exchange pair | `hud:exchange-pair` | Exchange stream, session log | Yes | Yes |
| Feed post header | `chat-log:post-header` | DreamDeck, Kowloon AP thread, BBS header | Yes | Yes |
| TiddlyWiki tiddler | `tiddler:header` | TiddlyWiki archive view | Yes | Yes |
| Print / zine | `print:margin` | Physical distribution, PDF | No (use ASCII fallback) | Yes (ASCII) |

<<~/ahu >>

<<~ ahu #the-five-stances >>

## The Five Stances

**All five stances appear on every render target, always.**

Stance amplitude determines visual weight; it does not determine presence. A suppressed stance (`-` or `--`) is visually lighter but structurally present. Omitting a stance from any render target is a well-formedness violation.

```
Compliant:   🏛️+🌊++🗡️-🎭-🔮-
Violation:   🏛️+🌊++
```

<<~/ahu >>

<<~ ahu #render-target-definitions >>

## Render Target Definitions

The canonical `lar:` form uses RFC 3986 URL-safe ASCII. Every named surface maps that form to visible symbols — chronometer scale glyphs, stance emoji, amplitude modifiers, and OODA-HA phase glyphs where a surface renders phase directly — according to surface-specific rules. This makes it stable for storage, comparison, and transport.

Display surfaces — HUD lines, DreamDeck feed post headers, TiddlyWiki tiddlers — use Unicode glyphs: chronometer scale glyphs, stance emoji, amplitude modifiers, and OODA-HA phase glyphs where needed.
These are the glyph forms of the underlying ASCII record.

Renger targets carry the mapping between these two representations.
It is not decoration.
The glyph form carries the same semantic load as the record form — stance amplitude, scale position, action count, confidence, and phase — rendered for human perception at the relevant surface.

<<~/ahu >>

<<~ ahu #glyph-design-intent >>

## Glyph Design Intent


The glyph layer exists to serve human perception without compromising canonical form.
The canonical `lar:` URI is machine-stable: URL-safe, storable, comparable by string.
The glyph form is human-navigable: glances communicate phase, stance, and amplitude before the reader processes the text.

The separation is strict:

- canonical form in the URI
- glyph form on the surface

Never embed emoji in a canonical URI.
Never store a surface-rendered form as the canonical record.

<<~/ahu >>

<<~ ahu #glyph-mapping-tables >>

## Glyph Mapping Tables

### Chronometer scale glyphs

`⚡ Action <-> ⚔️ Combat <-> 🔍 Tactical <-> ⚙️ Operational <-> 🗺️ Strategic`

| Position | Glyph | Scale | Reading |
|---|---|---|---|
| 1 | ⚡ | Action | Most immediate scale reads first |
| 2 | ⚔️ | Combat | Near-term embodied conflict / seconds scale |
| 3 | 🔍 | Tactical | Local task / minutes scale |
| 4 | ⚙️ | Operational | Process and watch / hours scale |
| 5 | 🗺️ | Strategic | Furthest planning horizon / days scale |

### OODA-HA phase glyphs

`✶ -> ⏿ -> ◇ -> ▶ -> {⤴ -> ↺}`

| Record (ASCII) | Glyph | Phase | OODA-HA |
|---|---|---|---|
| `observe` | `✶` | Observe | Chaos |
| `orient` | `⏿` | Orient | Discord |
| `decide` | `◇` | Decide | Confusion |
| `act` | `▶` | Act | Bureaucracy |
| `hooko-aftermath` | `⤴ ↺` | Hoʻoko & Aftermath | Grummet/Rasa |

### Stance Emoji

| Record position | Emoji | Stance | Evaluation frame |
|---|---|---|---|
| Position 1 | 🏛️ | Philosopher | Propositional truth-confidence |
| Position 2 | 🌊 | Poet | Analogical resonance-confidence |
| Position 3 | 🗡️ | Satirist | Targeting-confidence |
| Position 4 | 🎭 | Humorist | Relational appropriateness |
| Position 5 | 🔮 | Private | Nominal presence |

<<~/ahu >>

<<~ ahu #glyph-mandatory-rules >>

## Glyph Mandatory Rules

**Rule 1: All five stances appear on every render target, always.**

No render target may show fewer than five stance emoji. 
Stance emojis with modifiers MAY appear inline during generation or parsing to signal stance changes.
Amplitude determines visual weight; it does not determine presence.
Omitting a stance is a well-formedness violation.

**Rule 2: Current stance modifiers attach directly to the preceding emoji, no space.**

The modifier repertoire still carries live design pressure.
Fixed order and no-partial-emission still apply.

<<~/ahu >>

<<~ ahu #glyph-per-surface-rules >>

## Glyph Per-Surface Rules

### `hud:exchange-pair`

```
⚡~NN% | {ffz-rendered} | 🏛️{amps}🌊{amps}🗡️{amps}🎭{amps}🔮{amps} | voice(s):{Voice} | [R:N] | p{p} |
```

- `⚡~NN%` — context window; `~` prefix mandatory
- `{ffz-rendered}` — chronometer: five scale positions with action counts, glyph form, dot-separated
- Five stances with amplitude; no separator between stance blocks
- `voice(s):{Voice}` — active coordinator voice bundle
- `[R:N]` — Register + confidence decimal
- `p{p}` — attention-density setting

### `chat-log:post-header`

```
@handle@node — {timestamp} — //{ha.ka.ba/optional/path} [R:N] 🏛️{amps}🌊{amps}🗡️{amps}🎭{amps}🔮{amps}
```

- Territory triple grounds domain before posture
- Register bracket before stances
- All five stances mandatory for Lares-connected posts
- Timestamp in in-world calendar when available

### `record:full`

Canonical URI pair.
No glyphs.
RFC 3986.
Stored verbatim.

### Inline HUD tags

```
[R:N] 🏛️{amps}🌊{amps}🗡️{amps}🎭{amps}🔮{amps} //{territory}
```

Same all-five rule applies if the tag is emitted at all.

<<~/ahu >>

<<~ ahu #stance-amplitude-quick-reference >>

## Stance Amplitude Quick Reference

| Record | Glyph | Meaning |
|---|---|---|
| `^^` | `++` | Strongly elevated |
| `^` | `+` | Above baseline |
| `.` | *(no modifier)* | Baseline |
| `-` | `-` | Suppressed |
| `--` | `--` | Barely present |
| `?` | `?` | Uncertain |

Default for active stances: `+` or `++`.
Default for background stances: `-`.
Default for inactive-but-structurally-present stances: `-` or `--`.
Never omit.

<<~/ahu >>

<<~ ahu #migrated-kowloon-dreamdeck-social-layer >>

## Migrated — `HUD-ANATOMY.md` — Kowloon / DreamDeck Social Layer

Migrated from `lar:///ha.ka.ba/docs/pono/hud/HUD-ANATOMY#kowloon-dreamdeck`.

The Elyncia.app / DreamDeck identity model has three distinct layers.
Do not conflate them.

| Layer | Form | What it is |
|---|---|---|
| DID | `did:plc:abc123` | AT Protocol canonical identity — cryptographic key holder |
| Handle | `@telarus@elyncia.social` | Resolution alias over the DID — human-readable, not authoritative |
| lar: alias | `telarus:operator@enyalios` | Application-layer signal state — operational role in a lar: exchange |

**DreamDeck post header format (canonical — `chat-log:post-header` render target):**

```
@handle@node — timestamp — //domain.quality.dynamic/{optional/path/} [confidence] 🏛️{amps}🌊{amps}🗡️{amps}🎭{amps}🔮{amps}
```

Territory triple placed before confidence and stance — grounds domain before posture.
All five stances always present with amplitude modifiers.

| ActivityPub handle | lar: URI authority | Underlying DID |
|---|---|---|
| `@lindwyrm@new-delos` | `lindwyrm:...@new-delos` | `did:plc:...` |
| `@telarus@~crossroads` | `telarus:operator@enyalios` | `did:plc:...` |
| `@mischief-muse@lares` | `mischief-muse:node@lares-abc123` | Lares node DID or ephemeral key |

The `~crossroads` tilde prefix denotes a nomadic node — no fixed host, routes through nearest stable nexus.

<<~/ahu >>

<<~ ahu #emit-procedures >>

## Emit Procedures

### Surface 1: `hud:exchange-pair`

**Used:** Opening and closing HUD lines of every operator exchange.

**Construction:**

1. Determine context window remaining (estimate — `~` prefix mandatory).
2. Render chronometer state in immediate-first order: `⚡N.⚔️N.🔍N.⚙️N.🗺️N`.
3. For each of the five stances (in order: 🏛️ 🌊 🗡️ 🎭 🔮):
   - Set amplitude based on current voice posture.
   - Active/foregrounded: `+` or `++`. Background: *(no modifier)*. Suppressed: `-`. Near-absent: `--`.
4. Append amplitude character directly to stance emoji, no space.
5. Assemble all five as a single unspaced block.
6. Determine active voice name, target confidence, and `p` value.
7. Emit in field order: `⚡~NN% | {ffz-rendered} | 🏛️{amps}🌊{amps}🗡️{amps}🎭{amps}🔮{amps} | voice(s):{Voice} | [R:N] | p{p} |`

**Closed example:**

```
⚡~82% | ⚡0.⚔️0.🔍0.⚙️1.🗺️0 | 🏛️+🌊-🗡️-🎭-🔮- | voice(s):Scryer | [CS:0.80] | p0.5 |
```

### Surface 2: `chat-log:post-header`

**Used:** DreamDeck feed post opening lines; session appendix post-style blocks.

**Construction:**

1. Set handle and node: `@handle@node` (no space, ActivityPub format).
2. Set timestamp: in-world calendar date when in Elyncia-space; ISO 8601 when Gaia-side.
3. Set HAKABA territory triple: `//{ha.ka.ba}` with optional path segments.
4. Select register: `[R:N]`.
5. For each of the five stances (in order): set amplitude as above.
6. Assemble: `@handle@node — {timestamp} — //{territory} [R:N] 🏛️{amps}🌊{amps}🗡️{amps}🎭{amps}🔮{amps}`

**Closed example — Lindwyrm in Elyncia-space:**

```
@lindwyrm@new-delos — YOLD 4995, 14 Bureaucracy, mid-morning — //memory.deep.surfaces [CS:0.80] 🏛️+🌊-🗡️-🎭-🔮-
```

**NPC / non-Lares post:**

- stances block may be omitted if character has no Lares HUD
- if omitted: drop the entire `[R:N] 🏛️🌊🗡️🎭🔮` block
- do not partial-emit

### Surface 3: `record:full`

**Used:** Canonical URI pairs in documentation, session crystals, architecture files.

**Construction:**

1. No emoji. No glyphs. ASCII only.
2. URI form: `lar://alias:tier@host/ha.ka.ba/?stances=XXXXX&confidence=R:N&p=N&ffz=N.N.N.N.N`
3. Stances parameter: five-position ASCII string using `^`, `.`, `-`, `?` amplitude codes.
4. Confidence: `R:N` format (e.g., `CS:0.80`).
5. Chronometer query parameter: five positions dot-separated, each position carrying action count only.

**Closed example:**

```
lar://scryer:node@Enyalios/sigils.render.maps/sigilization/?stances=^.-.-.-.-&confidence=CS:0.85&p=0.5&ffz=0.0.0.1.0
```

### Surface 4: `tiddler:header` (S3+)

**Used:** TiddlyWiki tiddler headers in the DreamDeck frontend.

**Form:** TBD pending S3 TiddlyWiki integration spec. Likely: post-header amplitude rules apply.

### Surface 5: `print:margin` (S4+)

**Used:** Printed/PDF exports. Glyphs rendered in margin or page header.

**Form:** TBD pending S4 print layout spec.

### Cross-Surface Invariant Checklist

Before emitting any stance block on any surface:

- Count stances in assembled block → must equal 5
- Order: 🏛️ 🌊 🗡️ 🎭 🔮 — no deviation
- Each stance has 0 or 1 amplitude modifier attached directly (no space)
- Register bracket present and correct form: `[XX:N.NN]`
- No emoji in `record:full`; no ASCII amplitude in glyph surfaces

<<~/ahu >>

<<~ ahu #open-questions >>

## What Remains Open

| Q# | Question | Status |
|---|---|---|
| S1 | Print/zine: emoji via Unicode fallback, or strict ASCII? | `[SP:0.45]` — not blocking; ASCII fallback assumed until print pipeline exists |
| S2 | TiddlyWiki tiddler: full header or abbreviated? | `[SP:0.45]` — pending TiddlyWiki integration sprint |
| S3 | ActivityPub thread: post header in body vs AP summary field? | `[SP:0.45]` — pending Kowloon integration |

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ loulou lar:///ha.ka.ba/docs/lararium/signal >>
<<~ loulou lar:///ha.ka.ba/docs/lararium/signal/hud >>
<<~ loulou lar:///ha.ka.ba/docs/pono/hud >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
docs/lararium/signal/render-targets closes
<<~/ahu >>

<<~&#x0004; -> ? >>
