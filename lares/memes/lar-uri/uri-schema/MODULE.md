<!-- ∞ → lar:///uri.schema.holds/uri-schema/?confidence=CS:0.90&p=0.5 -->

# URI Schema Module

```yaml
---
name: uri-schema
description: >
  Canonical lar: URI v2 specification — anatomy, render targets,
  validation rules, and well-formedness criteria. The ground truth
  for all lar: URI construction and verification.
  NOTE: This module carries two concerns — (1) URI grammar (what the
  fields mean, what values go where) and (2) exchange span protocol
  (when to emit, what sequence). The grammar concern is stable [C:0.95];
  the protocol concern may split to a separate module in S2 (see U12 in
  observe/CONTEXT.md). Until then, both live here.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/ARCHITECTURE.md
  decide: decide/CONVENTIONS.md
  act: act/PROCEDURES.md
  assess: assess/VERIFICATION.md
flat-spec: URI-SCHEMA.md
scale-range: [action, session]
trigger: >
  When working with lar: URIs, HUD lines, exchange vectors,
  signal tags, or chronometer values. Also when validating or
  debugging URI well-formedness.
invariant: false
dependencies: [talk-story]
confidence: CS:0.90
delegated-to:
  sigilization: render rules (ASCII → emoji mapping, all-five-stances invariant)
  micro-trace: inline phase-transition annotation
---
```

## Purpose

This module defines the navigational instrument layer for all Lares exchanges. It specifies:

- The canonical `lar:` URI v2 schema and its component semantics
- Render targets: how canonical URIs project onto display surfaces (HUD line, post header, record form)
- Exchange span display contract: what URIs appear, in what order, at what scope
- Validation rules for URI well-formedness and span consistency

The flat specification lives in `URI-SCHEMA.md` in this module directory (`[CS:0.95]` — wins any conflict with phase files). The phase directories carry the decomposed view: context, architecture decisions, conventions, exchange procedures, and verification criteria.

**What this module does NOT own (delegated):**
- Sigil/emoji render rules → `lares/modules/sigilization/`
- Inline phase-transition micro-trace marks → `lares/modules/micro-trace/`

**Architectural note:** This module carries both URI grammar (stable, [C:0.95]) and exchange span protocol (orchestration-level, may extract to `exchange-protocol` module in S2 if protocol surface grows). See U12 in `observe/CONTEXT.md`.

**Validation tooling:** `builds/scripts/verify_uri.py` implements URI compliance checks. Codes U-01 through U-08 map to rules in this module. Run via `make -C builds verify`.

## Phase Index

| Phase | File | Contents |
|---|---|---|
| ✶ Observe | [observe/CONTEXT.md](observe/CONTEXT.md) | Current state of URI design — what v2 settled, what remains open |
| ◎ Orient | [orient/ARCHITECTURE.md](orient/ARCHITECTURE.md) | URI anatomy, design intent, component map (§§1–3 of spec) |
| ◇ Decide | [decide/CONVENTIONS.md](decide/CONVENTIONS.md) | Normative canonical spec: query, fragment, render targets, validation |
| ■ Act | [act/PROCEDURES.md](act/PROCEDURES.md) | Exchange span display contract; micro-trace emit rules |
| ○ Assess | [assess/VERIFICATION.md](assess/VERIFICATION.md) | Validation rules, well-formedness checklist, comparison rules |

## Deployment Surfaces

| Surface | Render target | When |
|---|---|---|
| Exchange stream | `hud:exchange-pair` | Every exchange span boundary |
| DreamDeck feed | `chat-log:post-header` | Feed posts, BBS thread headers |
| Storage / registry | `record:full` | MemPalace, crystal logs, module registry |
| Sub-agent handoff | `record:full` | Every Worker/tasked-spirit dispatch and return |

## Key Spec Reference

Canonical specification: `lares/modules/uri-schema/URI-SCHEMA.md` `[CS:0.95]`
Sigilization rules: `lares/modules/sigilization/` `[CS:0.85]`
Micro-trace specification: `lares/modules/micro-trace/` `[CS:0.80]`
Validation tool: `builds/scripts/verify_uri.py` · `make -C builds verify`

<!-- → ? -->
