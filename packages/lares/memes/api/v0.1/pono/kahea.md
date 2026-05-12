<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kahea >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/kahea"
file-path = "packages/lares/memes/api/v0.1/pono/kahea.md"
type = "text/x-memetic-wikitext"
confidence   = 0.84
register     = "CS"
manaoio      = 0.82
mana         = 0.86
manao        = 0.84
role         = "dataflow-family edge sugar — live transclusion; push-forward value transport; dual form: URI edge and name-call invocation"
cacheable    = true
retain       = true
```



<<~ aka lar:///ha.ka.ba/@lares/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #head >>

# Kahea

*kāhea* — Hawaiian: to call out, to summon, to invoke; a call, a cry.

A dataflow-family edge sugar with dual form. The URI form creates a live transclusion edge —
typed value, field, or geometry transport from target to source, propagating push-forward.
The name-call form invokes a named definition at render time only (no edge created).
Sugar for `<<~ pranala ? -> URI family:dataflow propagation:push-forward >>`.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #ooda-ha >>

✶ sense the sigil form — URI (contains `/`, `lar:`, or `#`) or name-call (bare word with optional args)
⏿ orient: URI form → dataflow edge, push-forward; name-call → render-only invocation, no edge
◇ URI form: bind source-to-target, propagation:push-forward; validate no DAG cycles; role:reads default
▶ URI form: emit EdgeSugarNode sigil:kahea, family:dataflow; name form: emit SigilNode sigilName:kahea
⤴ URI form: value flows push-forward into source render; name form: definition expands in place
↺ confirm edge registered (URI form) or definition resolved (name form); propagation chain intact

<<~/ahu >>

<<~ ahu #law >>

## Law (Kānāwai)

**URI form:**
A kahea URI form MUST bind a source socket and a target URI.
A kahea URI form MUST carry `family:dataflow`.
A kahea URI form MUST carry `propagation:push-forward` (the default; MAY be overridden to `pull`).
A kahea URI form MUST NOT form a cycle — directly or transitively.
A kahea URI form SHOULD carry `role:reads` when reading a field; `role:streams` for continuous values.

**Name-call form:**
A kahea name-call MUST reference a declared definition name.
A kahea name-call MUST NOT create a pranala edge — it is render-only.
A kahea name-call MAY carry parenthesized arguments: `<<~ kahea name(arg1, arg2) >>`.

The two forms are distinguished at parse time by URI shape:
- Contains `lar:`, `/`, or `#` → URI form (edge)
- Bare word with optional `(args)` → name-call form (render-only)

<<~/ahu >>

<<~ ahu #syntax >>

## Syntax

URI form (creates dataflow edge):
```text
<<~ kahea lar:///ha.ka.ba/@lares/api/v0.1/pono/meme >>
<<~ kahea lar:///ha.ka.ba/@lares/api/v0.1/pono/meme#law >>
<<~ kahea relative/path >>
```

Name-call form (render-only, no edge):
```text
<<~ kahea definitionName >>
<<~ kahea definitionName(arg1, arg2) >>
```

Regex — URI form (canonical):
```
/<<~\s*kahea\s+(lar:[^\s>]+|[^\s>(]+\/[^\s>]*|[^\s>(]+#[^\s>]*)\s*>>/
```

Regex — name-call form (canonical):
```
/<<~\s*kahea\s+([\w][\w.-]*)\s*(?:\(([^)]*)\))?\s*>>/
```

Full pranala expansion (URI form):
```text
<<~ pranala ? -> URI family:dataflow lifecycle:instance traversal:source-to-target propagation:push-forward >>
```

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

Canonical TOML form. Source of truth for `BUILTIN_KAHEA_RE`, `kaheaDefaultFamily`,
`kaheaDefaultPropagation` in `packages/lararium-core/src/pranala-parser.ts`.

```toml
sigil          = "kahea"
kind           = "edge-sugar"
layer          = "both"
default-family = "dataflow"
default-propagation = "push-forward"
render-mode    = null
alias          = []

# URI form — creates a dataflow edge
pattern-uri  = '<<~\s*kahea\s+(lar:[^\s>]+|[^\s>(]+\/[^\s>]*|[^\s>(]+#[^\s>]*)\s*>>'

# Name-call form — render-only definition invocation; no edge created
pattern-name = '<<~\s*kahea\s+([\w][\w.-]*)\s*(?:\(([^)]*)\))?\s*>>'

[captures-uri]
to   = 1

[captures-name]
name = 1
args = 2

[family-contract]
role-recommended   = true
confidence-bounded = false

canonical-roles = ["reads", "writes", "streams", "buffers", "pipes"]
```

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-pranala ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala family:control role:implements >>
<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-loulou ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/loulou family:relation >>
<<~ pranala #to-aka ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/aka family:relation >>
<<~ pranala #to-papalohe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:relation >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
