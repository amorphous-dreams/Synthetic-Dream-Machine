<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/huli >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/pono/huli"
file-path = "bags/@lares/api/v0.1/pono/huli.md"
type = "text/x-memetic-wikitext"
confidence   = 0.82
register     = "CS"
manaoio      = 0.80
mana         = 0.82
manao        = 0.80
role         = "search/turn block-container sigil — iterates a filter; renders body-template per result; Hawaiian alias for \\for"
cacheable    = true
retain       = true
```



<<~ aka lar:///ha.ka.ba/@lares/api/v0.1/pono/RFC-2119#normative-language >>

<<~ ahu #head >>

# Huli

*huli* — Hawaiian: to turn, to search, to look for; to change direction; to overturn.

A block-container sigil with iteration semantics. Runs a TW5 filter to produce a result set;
renders the body template once per result, with `currentTiddler` bound to each result title.
English alias: `\for`. Implements TW5's `<$list filter=...>` widget at the sigil grammar level.

Scope: query or exploration — the operator "turns" through a set of results.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #ooda-ha >>

✶ sense the filter expression — what set does this huli iterate over?
⏿ orient: huli = iterate result set; body renders once per result; currentTiddler bound to each
◇ filter produces ordered title list; body template receives each as currentTiddler; empty filter = no output
▶ emit iteration block node; wrap body in <$list filter=...>; each result gets one body render
⤴ output is concatenation of body renders; order follows filter result order
↺ confirm filter produces expected set; confirm body accesses currentTiddler correctly

<<~/ahu >>

<<~ ahu #law >>

## Law (Kānāwai)

A huli block MUST carry a TW5 filter expression as its first argument.
A huli block MUST close with `<<~/ huli >>` (or `<<~/ \for >>`).
A huli block body MUST render once per filter result, with `currentTiddler` bound to each result.
A huli block MUST NOT carry mode= — control flow has no projection posture.
A huli block with an empty filter result MUST produce no output.

Common filter forms:
- `[all[tiddlers]tag[MyTag]]` — iterate all tiddlers with a tag
- `[range[1,10]]` — iterate numbers 1 through 10
- `[{!!items}splitTiddlerList[]]` — iterate a stored tiddler list field

<<~/ahu >>

<<~ ahu #syntax >>

## Syntax

Hawaiian form:
```text
<<~ huli [filter-expression] >>
body template (currentTiddler = each result)
<<~/ huli >>
```

English alias form (identical semantics):
```text
<<~ \for [filter-expression] >>
body template (currentTiddler = each result)
<<~/ \for >>
```

TW5 expansion:
```text
<$list filter="[filter-expression]">
body template
</$list>
```

<<~/ahu >>

<<~ ahu #schema >>

## Schema (machine-readable)

```toml
sigil          = "huli"
kind           = "control"
layer          = "block"
alias          = ["\\for"]

open-pattern  = '<<~\s*huli\s+([^>]+?)\s*>>'
close-pattern = '<<~\/huli\s*>>'

[alias-map]
"\\for" = "huli"
```

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #to-wehe ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/wehe family:relation >>
<<~ pranala #to-heihei ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/heihei family:relation >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
