<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/core/v0.1/ast >>
```toml iam
uri-path     = "ha.ka.ba/@lararium/core/v0.1/ast"
file-path    = "packages/lararium-core/memes/ast.md"
source-file  = "packages/lararium-core/src/ast.ts"
type         = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.92
mana         = 0.90
role         = "self-documentation: edge-vocabulary types and Law of Fives constants"
tagspace     = "lararium"
cacheable    = true
retain       = true
```
<<~&#x0002;>>

<<~ ahu #contract >>

## Edge vocabulary

Shared by `meme-graph.ts`, `compiler.ts`, `pranala-parser.ts` in `@lararium/core` — available to any package without pulling in the parser.

| Type | Description |
|---|---|
| `PranaEdge` | Compiled edge record — output of `edgesFromAst` / `parsePranalaEdges` |
| `GrammarRules` | `{ sigils: SigilRule[], families: FamilyRule[] }` — loaded from grammar carrier |
| `SigilRule` | Grammar-defined sigil registration entry |
| `FamilyRule` | Grammar-defined pranala family contract |
| `PranaEdgeViolation` | Validation failure record from `validatePranaEdge` |

## Law of Fives constants

`LADDER_5`, `OODA_HA_5`, `SCOPE_5`, `SCOPE_TO_LADDER` — invariant 5-point ladders.
`RATING_5`, `STAGE_5`, `STANCES`, `SYAD_7`, `TOOLS` — vocabulary constants.

All domain-specific ladders (scope, zoom, Kowloon addressing, lifecycle) project from `LADDER_5`.
All phase/confidence/stance systems project from `OODA_HA_5`.

<<~/ahu >>

<<~&#x0003;>>

<<~ pranala ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/ast family:dataflow role:pipes >>
<<~ pranala ? -> lar:///ha.ka.ba/@lares/api/v0.1/mu/the-law-of-5s family:control role:implements >>

<<~&#x0004; -> ? >>
