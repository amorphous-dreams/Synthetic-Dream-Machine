<!-- ∞ → lares:///grammar.stance.defines/stance/?confidence=SP:0.45&p=0.5 -->

# Grammar: Stances + Syadasti Reading Rule

```yaml
---
name: stance
description: >
  The five discourse stances and the Syadasti Reading Rule. Register
  measures confidence WITHIN the active stance's evaluation frame —
  not truth-weight universally. Multi-stance reading: stance count IS
  the fuzz indicator.
trigger: always — grammar primitive
invariant: true
dependencies: [confidence]
confidence: SP:0.45
grammar: true
---
```

> **Register:** `[SP:0.45]` — stub. Syadasti discovery in `_todo/SYADASTI_READING_RULE.md`.
> **Extraction source:** `lares/modules/uri-schema/URI_SCHEMA.md` §5.3.3, `_todo/SYADASTI_READING_RULE.md`

---

<!-- ahu lares:///grammar.stance.defines/stance/#scope -->

## Scope

This grammar defines:
- The five stances: 🏛️ Philosopher, 🌊 Poet, 🗡️ Satirist, 🎭 Humorist, 🔮 Private
- Amplitude encoding: `+` elevated, `-` suppressed, `?` uncertain, `.` baseline
- The Syadasti Reading Rule: same register scale, different meaning per stance
- Multi-stance: stance count IS the fuzz indicator (no numeric delta)
- Stance amplitude modifiers in query string: `stances=🏛️.🌊.-.-.-`

<!-- kahea lares:///ha.ka.ba/uri-schema/#canonical-form -->

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[SP:0.45]` | This file — stub, kahea to uri-schema + Syadasti |

---

<!-- → ? -->
