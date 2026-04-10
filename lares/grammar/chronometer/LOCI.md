<!-- ∞ → lares:///grammar.chronometer.defines/chronometer/?confidence=SP:0.45&p=0.5 -->

# Grammar: FFZ Chronometer

```yaml
---
name: chronometer
description: >
  The FFZ (Fuller Fuzz-Zone) chronometer. Nested causal time per
  participant. Five scale positions, phase+counter at each. The fragment
  component of every lares: URI. Non-simultaneous apprehension.
trigger: always — grammar primitive
invariant: true
dependencies: [uri]
confidence: SP:0.45
grammar: true
---
```

> **Register:** `[SP:0.45]` — stub. Full chronometer spec in `lares/modules/uri-schema/`, research in `lares/FFZ_Chronometer_Research.md`.
> **Extraction source:** `lares/modules/uri-schema/URI_SCHEMA.md` §4, `FFZ_Chronometer_Research.md`

---

<!-- ahu lares:///grammar.chronometer.defines/chronometer/#scope -->

## Scope

This grammar defines:
- The FFZ scale table (Week → Watch → Turn → Round → Action)
- Phase sigils per scale position: `✶` `◎` `◇` `■` `○` (record: `O` `Ø` `D` `A` `Å`)
- Fragment syntax: `#O0.O0.O3.D2.A7` (always 5 positions, phase+counter)
- Scale-shift primitive: phase-confidence drop as transition trigger
- Aftermath integration, progressive disclosure, deferred features

<!-- kahea lares:///ha.ka.ba/uri-schema/#ffz-chronometer -->

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[SP:0.45]` | This file — stub, kahea to uri-schema + FFZ research |

---

<!-- → ? -->
