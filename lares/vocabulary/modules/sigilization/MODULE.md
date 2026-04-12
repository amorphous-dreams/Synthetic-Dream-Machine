<!-- ∞ → lar:///sigils.render.maps/sigilization/?confidence=CS:0.85&p=0.5 -->

```yaml
---
name: sigilization
description: >
  Render rules for the lares: URI v2 schema. Maps canonical record form
  (RFC 3986, ASCII-only) to named display surfaces (HUD line, DreamDeck
  post header, TiddlyWiki tiddler, storage record). Governs which glyphs
  appear on which surfaces and enforces the all-five-stances invariant
  across all render targets.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/ARCHITECTURE.md
  decide: decide/CONVENTIONS.md
  act: act/PROCEDURES.md
  assess: assess/VERIFICATION.md
scale-range: [action, session]
trigger: >
  When emitting any lares: URI to a display surface. When writing
  DreamDeck post headers, HUD lines, TiddlyWiki tiddlers, or any
  render target that requires sigil-form output. When validating
  whether output matches surface rules.
invariant: false
dependencies: [uri-schema]
confidence: CS:0.85
---
```

# Sigilization Module

> **Register:** `[CS:0.85]` — near-canon; governs all surface emission
> **Status:** Active. Filed 2026-04-09 as resolution of U10 + U11 (uri-schema open questions).
> **Source of truth:** `lares/modules/sigilization/decide/CONVENTIONS.md`
> **Depends on:** `lares/modules/uri-schema/` for canonical record form

## What This Module Provides

Sigilization is the render layer between canonical `lares:` URI record form and human-readable display surfaces. The canonical form uses RFC 3986 URL-safe ASCII. Every named surface maps that form to glyphs — phase sigils, stance emoji, amplitude modifiers — according to surface-specific rules.

This module owns:
- The surface registry (what surfaces exist, what they render)
- The all-five-stances invariant (applies to every surface, no exceptions)
- ASCII → glyph mapping tables for phase, stance, and amplitude
- Per-surface emit procedures

## The Core Invariant

**All five stances appear on every render target, always.**

Stance amplitude determines visual weight; it does not determine presence. A suppressed stance (`-` or `--`) is visually lighter but structurally present. Omitting a stance from any render target is a well-formedness violation.

```
Compliant:   🏛️+🌊++🗡️-🎭-🔮-
Violation:   🏛️+🌊++
```

Bug origin: `LINDWYRM_STORY_SHAPE.md` post-header example showed active-only stances. All downstream drafts inherited the pattern. Fixed in this module. Corrected in: LINDWYRM_STORY_SHAPE.md, LINDWYRM_ACT_VI_DRAFT.md, LINDWYRM_ACT_VII_DRAFT.md.

## Render Target Registry

| Name | Token | Surface | Emoji? | All 5 stances? |
|---|---|---|---|---|
| Record form | `record:full` | Storage, registry, MemPalace | No | Yes (ASCII) |
| HUD exchange pair | `hud:exchange-pair` | Exchange stream, session log | Yes | Yes |
| Feed post header | `chat-log:post-header` | DreamDeck, Kowloon AP thread, BBS header | Yes | Yes |
| TiddlyWiki tiddler | `tiddler:header` | TiddlyWiki archive view | Yes | Yes |
| Print / zine | `print:margin` | Physical distribution, PDF | No (use ASCII fallback) | Yes (ASCII) |

## Phase File Index

| Phase | File | Contents |
|---|---|---|
| ✶ Observe | `observe/CONTEXT.md` | What sigilization is; why this module was needed; bug history |
| ◎ Orient | `orient/ARCHITECTURE.md` | Design intent; record-form → sigil mapping tables |
| ◇ Decide | `decide/CONVENTIONS.md` | Normative rules; all-five invariant; per-surface conventions |
| ■ Act | `act/PROCEDURES.md` | How to emit for each named surface |
| ○ Assess | `assess/VERIFICATION.md` | Validation checklist; well-formedness rules |

<!-- → ? -->
