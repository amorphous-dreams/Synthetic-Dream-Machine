<!-- ∞ → lares:///grammar.uri.defines/uri/?confidence=SP:0.45&p=0.5 -->

# Grammar: `lares:` URI Syntax

```yaml
---
name: uri
description: >
  The lares: URI scheme — syntax, components, well-formedness rules.
  The addressing system that makes everything else navigable.
  RFC 3986 compliant record form. Non-dereferenceable identifier.
trigger: always — grammar primitive
invariant: true
dependencies: [transclusion]
confidence: SP:0.45
grammar: true
---
```

> **Register:** `[SP:0.45]` — stub. Full spec lives in `lares/modules/uri-schema/`.
> **Extraction source:** `lares/modules/uri-schema/URI_SCHEMA.md` §§1–3.4, `URI_SCHEME_SPEC.md` §§1–2

---

<!-- ahu lares:///grammar.uri.defines/uri/#scope -->

## Scope

This grammar defines:
- The `lares:` scheme name and registration status
- Generic and expanded URI forms
- Component map: authority, path (HA.KA.BA), query (signal params), fragment (chronometer)
- The four semantic layers: WHO (authority), WHERE (path), HOW (query), WHEN (fragment)
- Well-formedness and validation rules

<!-- kahea lares:///ha.ka.ba/uri-schema/#scheme-registration -->
<!-- kahea lares:///ha.ka.ba/uri-schema/#uri-anatomy -->

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[SP:0.45]` | This file — stub, kahea to uri-schema |

---

<!-- → ? -->
