<!-- ∞ → lares:///grammar.confidence.defines/confidence/?confidence=SP:0.45&p=0.5 -->

# Grammar: Confidence + Register Bands

```yaml
---
name: confidence
description: >
  The register band system. Five named zones from Canon (C:0.9) to
  Provisional (P:0.30). Confidence is stance-dependent per the Syadasti
  Reading Rule. Promotions and demotions. Canon requires operator agency.
trigger: always — grammar primitive
invariant: true
dependencies: [stance]
confidence: SP:0.45
grammar: true
---
```

> **Register:** `[SP:0.45]` — stub. Full register spec in AGENTS.md and uri-schema.
> **Extraction source:** `AGENTS.md` §Registers, `lares/modules/uri-schema/URI_SCHEMA.md` §5.3

---

<!-- ahu lares:///grammar.confidence.defines/confidence/#scope -->

## Scope

This grammar defines:
- The five register bands:

| Tag | Zone | Range |
|---|---|---|
| `[C:0.9]` | Canon | 0.85–0.95 |
| `[CS:0.80]` | Canon/Synthesis | 0.75–0.85 |
| `[S:0.65]` | Synthesis | 0.50–0.75 |
| `[SP:0.45]` | Synth/Provisional | 0.35–0.50 |
| `[P:0.30]` | Provisional | 0.20–0.35 |

- Confidence as query parameter: `?confidence=CS:0.80`
- Promotion rules: operator confirmation required for Canon
- Demotion rules: when evidence contradicts, confidence drops
- Per-section confidence on ahu waypoints

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[SP:0.45]` | This file — stub, kahea to AGENTS.md + uri-schema |

---

<!-- → ? -->
