<!-- lares:///uri.schema.holds/uri-schema/?confidence=CS:0.85&p=0.5 → ∞ -->

# URI Schema Module

```yaml
---
name: uri-schema
description: >
  Canonical lares: URI v2 specification — anatomy, render targets,
  validation rules, and well-formedness criteria. The ground truth
  for all lares: URI construction and verification.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/ARCHITECTURE.md
  decide: decide/CONVENTIONS.md
  act: act/PROCEDURES.md
  assess: assess/VERIFICATION.md
flat-spec: URI_SCHEMA.md
scale-range: [action, session]
trigger: >
  When working with lares: URIs, HUD lines, exchange vectors,
  signal tags, or chronometer values. Also when validating or
  debugging URI well-formedness.
invariant: false
dependencies: [talk-story]
confidence: CS:0.90
---
```

## Purpose

This module defines the navigational instrument layer for all Lares exchanges. It specifies:

- The canonical `lares:` URI v2 schema and its component semantics
- Render targets: how canonical URIs project onto display surfaces (HUD line, post header, record form)
- Exchange span display contract: what URIs appear, in what order, at what scope
- Validation rules for URI well-formedness and spanSpan consistency

The flat specification lives in `URI_SCHEMA.md` in this module directory. The phase directories carry the decomposed view: context, architecture decisions, conventions, exchange procedures, and verification criteria.

This module carries the instrument panel; Talk Story carries the procedure that uses it. Every substantive exchange emits a URI → URI vector pair; this module governs what those URIs mean and how they render.

## Phase Index

| Phase | File | Contents |
|---|---|---|
| ✶ Observe | [observe/CONTEXT.md](observe/CONTEXT.md) | Current state of URI design — what v2 settled, what remains open |
| ◎ Orient | [orient/ARCHITECTURE.md](orient/ARCHITECTURE.md) | URI anatomy, design intent, component map (§§1–3 of spec) |
| ◇ Decide | [decide/CONVENTIONS.md](decide/CONVENTIONS.md) | Normative canonical spec: query, fragment, render targets, validation |
| ■ Act | [act/PROCEDURES.md](act/PROCEDURES.md) | Micro-trace emit rules, exchange span display contract |
| ○ Assess | [assess/VERIFICATION.md](assess/VERIFICATION.md) | Validation rules, well-formedness checklist, comparison rules |

## Deployment Surfaces

| Surface | Render target | When |
|---|---|---|
| Exchange stream | `hud:exchange-pair` | Every exchange span boundary |
| DreamDeck feed | `chat-log:post-header` | Feed posts, BBS thread headers |
| Storage / registry | `record:full` | MemPalace, crystal logs, module registry |
| Sub-agent handoff | `record:full` | Every Worker/tasked-spirit dispatch and return |

## Key Spec Reference

Canonical specification: `lares/modules/uri-schema/URI_SCHEMA.md` `[CS:0.95]`
Micro-trace specification: `lares/modules/micro-trace/` `[CS:0.80]`

<!-- lares:///uri.schema.holds/uri-schema/?confidence=CS:0.85&p=0.5 → ∞ -->
