<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/parser >>
```toml iam
uri-path     = "ha.ka.ba/@lararium/tw5/v0.1/parser"
file-path    = "packages/ha-ka-ba/lararium-tw5/parser.md"
source-file  = "packages/lararium-tw5/src/parser.ts"
type         = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.92
mana         = 0.90
role         = "self-documentation: parseMemeCarrier — memetic-wikitext parse engine"
tagspace     = "engine"
cacheable    = true
retain       = true
```
<<~&#x0002;>>

<<~ ahu #contract >>

## parseMemeCarrier

Three-stage pipeline: `collectEvents → buildAst → [edgesFromAst]`

```
parseMemeCarrier(uri: string, text: string, grammar?: GrammarRules): MemeAstNode[]
```

Owned by `@lararium/tw5`. Compiles into the TW5 parser IIFE tiddler.
No AST trees cross the VM boundary — VMs receive flat `LarTiddlerRecord[]` and produce projection output.

### Stages

| Stage | Function | Output |
|---|---|---|
| 1 | `collectEvents(text, grammar?)` | `ParseEvent[]` |
| 2 | `buildAst(events, carrierUri)` | `MemeAstNode[]` |
| 3 | `edgesFromAst(ast, carrierUri)` | `PranaEdge[]` |

### Bootstrap

`BOOTSTRAP_SCANS` covers edge sigils + ahu + common control sigils when no `GrammarRules` loaded.
`buildScansFromGrammar(grammar)` replaces BOOTSTRAP_SCANS once the grammar carrier hydrates.

<<~/ahu >>

<<~ ahu #invariants >>

## Invariants

- Alias erasure runs inline in `collectEvents` — no separate phase.
- Node hierarchy is flat: non-edge canonical sigils collapse to `SigilNode`.
- `TextNode` spans interleaved between structural nodes preserve prose for TW5 wiki.parseText.
- `PaeNode` phase boundaries (`soh/stx/etx/eot`) survive into the AST for streaming consumers.

<<~/ahu >>

<<~&#x0003;>>

<<~ pranala ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/ast family:dataflow role:produces >>
<<~ pranala ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/pranala-parser family:dataflow role:pipes >>
<<~ pranala ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/modules/memetic-parser family:control role:implements >>

<<~&#x0004; -> ? >>
