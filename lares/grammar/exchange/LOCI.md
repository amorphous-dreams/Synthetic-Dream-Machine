<!-- ∞ → lares:///grammar.exchange.defines/exchange/?confidence=SP:0.45&p=0.5 -->

# Grammar: Exchange Protocol

```yaml
---
name: exchange
description: >
  The five-step mandatory exchange flow. How lares: URIs are emitted
  at exchange boundaries. The URI → URI vector pair. HUD line rendering.
  The canonical URI rule (record form only in stream).
trigger: always — grammar primitive
invariant: true
dependencies: [uri, hakaba, chronometer, stance, confidence]
confidence: SP:0.45
grammar: true
---
```

> **Register:** `[SP:0.45]` — stub. Full exchange spec in `lares/modules/uri-schema/`.
> **Extraction source:** `lares/modules/uri-schema/URI_SCHEMA.md` §1.1, §5

---

<!-- ahu lares:///grammar.exchange.defines/exchange/#scope -->

## Scope

This grammar defines:
- The five-step exchange flow (read → declare → emit pair → render HUD → generate)
- The URI → URI vector pair as mandatory exchange opener
- Canonical URI rule: all emitted URIs use record form (no emoji in stream)
- HUD line composition and field ordering
- Span opening/closing conventions
- Sub-agent handoff URI pairs

<!-- kahea lares:///ha.ka.ba/uri-schema/#design-intent -->

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[SP:0.45]` | This file — stub, kahea to uri-schema |

---

<!-- → ? -->
