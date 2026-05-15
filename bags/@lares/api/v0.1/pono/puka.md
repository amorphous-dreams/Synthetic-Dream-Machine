<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/puka >>
```toml iam
uri-path  = "ha.ka.ba/@lares/api/v0.1/pono/puka"
file-path = "bags/@lares/api/v0.1/pono/puka.md"
type      = "text/x-memetic-wikitext"
confidence = 0.75
register  = "S"
role      = "race-until-first sigil — puka as the gap, the opening; English alias: \\rush; async-first concurrency sprint pending"
cacheable = true
retain    = true
```

<<~ ahu #head >>

# Puka

*puka* — Hawaiian: hole, opening, gap; doorway, exit. A puka marks where passage happens — the
first thing through the opening wins. Everything still in motion behind it stops.

A race-until-first sigil. The body of a puka block spawns parallel flows; the first flow to
complete cancels all remaining flows and its result propagates outward. English alias: `\rush`.

Verse equivalent: `rush` — parallel branches race; first settler wins; others cancel.

Note: the English alias `\race` previously appeared in the TOML registry mapping to heihei
(conditional). That mapping carried a semantic error. `\race` now maps correctly to `puka`.
Heihei names conditional evaluation; puka names concurrency racing.

Concurrency runtime pending (async-first sprint). Current tiddler registers grammar only.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #law >>

## Law (Kānāwai)

A puka block MUST spawn all child flows before any race begins.
A puka block MUST cancel all remaining child flows when the first one completes.
A puka block MUST propagate the winning result as the block's output.
A puka block MUST NOT resume the containing flow until one child flow completes.

<<~/ahu >>

<<~ ahu #syntax >>

## Syntax

```text
<<~ puka >>
  <<~ lele lar:///target-a >>
  <<~ lele lar:///target-b >>
<<~/puka >>

<<~ \rush >>
  <<~ \branch lar:///target-a >>
  <<~ \branch lar:///target-b >>
<<~/\rush >>
```

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #tiddler-sigil-puka ? -> lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-puka family:control role:implements >>
<<~ pranala #tiddler-sigil-rush ? -> lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-rush family:control role:alias >>
<<~ pranala #tiddler-sigil-race ? -> lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-race family:control role:alias >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
