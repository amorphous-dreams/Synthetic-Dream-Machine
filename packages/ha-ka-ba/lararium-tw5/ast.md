<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/ast >>
```toml iam
uri-path     = "ha.ka.ba/@lararium/tw5/v0.1/ast"
file-path    = "packages/ha-ka-ba/lararium-tw5/ast.md"
source-file  = "packages/lararium-tw5/src/ast.ts"
type         = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.92
mana         = 0.90
role         = "self-documentation: MemeAstNode — parse-tree node types for memetic-wikitext"
tagspace     = "engine"
cacheable    = true
retain       = true
```
<<~&#x0002;>>

<<~ ahu #contract >>

## MemeAstNode

Parse-time AST for `text/x-memetic-wikitext`. Owned by `@lararium/tw5` — compiles into the TW5 IIFE parser/deserializer modules. No instances cross the VM boundary.

Edge-vocabulary types (`PranaEdge`, `GrammarRules`, `SigilRule`) stay in `@lararium/core` — shared with server-side graph and compiler without circular dependency.

### Node kinds

| Kind | Sigil | Description |
|---|---|---|
| `Ahu` | `<<~ ahu #slot >>` | Addressable scope socket; body = child worksite |
| `Pranala` | `<<~ pranala ? -> URI >>` | Explicit edge, block or inline |
| `PranalaSugar` | `<<~ loulou/aka/kahea/pono/papalohe >>` | Sugared edge forms |
| `Lele` | `<<~ lele -> URI >>` | Fire-and-forget dispatch |
| `Pae` | `<<~①②③④>>` | SOH/STX/ETX/EOT phase boundary |
| `Text` | (prose) | Raw wikitext prose span |
| `Sigil` | `<<~ name >>` | All other canonical sigils |
| `Dynamic` | (grammar-registered) | Grammar-meme-defined extensions |

### CarrierNode

Root of every parsed carrier document. `uri` = canonical lar:/// key. `body` = flat `MemeAstNode[]`.

<<~/ahu >>

<<~&#x0003;>>

<<~ pranala ? -> lar:///ha.ka.ba/@lararium/core/v0.1/ast family:dataflow role:reads >>
<<~ pranala ? -> lar:///ha.ka.ba/@lararium/tw5/v0.1/parser family:control role:governed-by >>

<<~&#x0004; -> ? >>
