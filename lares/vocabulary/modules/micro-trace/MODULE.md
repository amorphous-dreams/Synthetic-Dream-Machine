<!-- ∞ → lar:///trace.micro.marks/micro-trace/?confidence=CS:0.80&p=0.5 -->

# Micro-trace Module

```yaml
---
name: micro-trace
description: >
  Backward-looking in-flow annotation layer. Marks where a governed
  response actually changed OODA-A phase state during generation.
  Orthogonal to the exchange HUD pair (boundary) and Intent Header
  (prospective). Density controlled by p-band.
phase-map:
  observe: observe/CONTEXT.md
  orient: orient/ARCHITECTURE.md
  decide: decide/CONVENTIONS.md
  act: act/PROCEDURES.md
  assess: assess/VERIFICATION.md
scale-range: [action, session]
trigger: >
  When governing any Lares response. Annotation density scales with p.
  Always active at default p0.5 (Band 3: ◇ Decide · ■ Act · ○ Aftermath).
invariant: false
dependencies: [talk-story, uri-schema]
confidence: CS:0.80
---
```

## Purpose

The micro-trace is the **event trace layer** of the Signal HUD system. It annotates the inside of a generative span with backward-looking phase transition markers — emitted at the point of transition, never predicted.

## Source

`lares/signal/micro-trace.md` `[CS:0.80]` — promoted from SIG-04 draft; operator-confirmed 2026-04-08.

## Deployment Surfaces

| Surface | Path |
|---|---|
| Source spec | `lares/signal/micro-trace.md` |
| OODA-A module (source of truth) | `lares/modules/micro-trace/` |
| Operations instructions | `.github/instructions/lares-operations.instructions.md` |

<!-- → ? -->
