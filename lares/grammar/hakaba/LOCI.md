<!-- ∞ → lares:///grammar.hakaba.defines/hakaba/?confidence=SP:0.45&p=0.5 -->

# Grammar: HA.KA.BA Semantic Addressing

```yaml
---
name: hakaba
description: >
  The three-slot semantic addressing system. Ha (domain), Ka (quality/dynamic),
  Ba (place/state). Every lares: URI path encodes a position in this
  navigational space. The origin is lares:///ha.ka.ba/ = (0,0,0).
trigger: always — grammar primitive
invariant: true
dependencies: [uri, transclusion]
confidence: SP:0.45
grammar: true
---
```

> **Register:** `[SP:0.45]` — stub. Full addressing spec in `lares/modules/uri-schema/`.
> **Extraction source:** `lares/modules/uri-schema/URI_SCHEMA.md` §3.3, `URI_SCHEME_SPEC.md` §2

---

<!-- ahu lares:///grammar.hakaba.defines/hakaba/#scope -->

## Scope

This grammar defines:
- The three semantic slots: Ha (domain/territory), Ka (quality/dynamic), Ba (place/state)
- Path construction rules: `domain.quality.dynamic/sub/path/`
- The origin address: `lares:///ha.ka.ba/` = semantic zero
- Sub-path conventions for module routing
- Identity stack for authority-bearing URIs (Kowloon / ActivityPub)

<!-- kahea lares:///ha.ka.ba/uri-schema/#uri-anatomy -->

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[SP:0.45]` | This file — stub, kahea to uri-schema |

---

<!-- → ? -->
