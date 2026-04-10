<!-- lares:///signal.calibrated.holds/signal/?confidence=CS:0.85&p=0.5 → ∞ -->

# Signal Module

```yaml
---
name: signal
description: >
  Signal HUD anatomy, lares: URI canonical form, render targets,
  validation rules, and micro-trace phase annotation. The navigational
  instrument layer for all Lares exchanges.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/ARCHITECTURE.md
  decide: decide/CONVENTIONS.md
  act: act/PROCEDURES.md
  assess: assess/VERIFICATION.md
scale-range: [action, session]
trigger: >
  When working with lares: URIs, HUD lines, exchange vectors,
  signal tags, or chronometer values. Also when validating or
  debugging URI well-formedness.
invariant: false
dependencies: [talk-story]
confidence: CS:0.85
---
```

## Purpose

Signal is the navigational instrument layer for all Lares exchanges. It defines:

- The canonical `lares:` URI v2 schema and its component semantics
- Render targets: how canonical URIs project onto display surfaces (HUD line, post header, record form)
- Exchange span display contract: what URIs appear, in what order, at what scope
- Micro-trace HUD: the backward-looking inline phase annotation layer
- Validation rules for URI well-formedness and spanSpan consistency

Signal carries the instrument panel; Talk Story carries the procedure that uses it. Every substantive exchange emits a URI → URI vector pair; Signal governs what those URIs mean and how they render.

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

Canonical specification: `lares/signal/URI_SCHEMA.md` `[CS:0.90]`
Micro-trace specification: `lares/signal/micro-trace.md` `[CS:0.80]`

<!-- lares:///signal.calibrated.holds/signal/?confidence=CS:0.85&p=0.5 → ∞ -->
