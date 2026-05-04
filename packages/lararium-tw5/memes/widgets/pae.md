<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pae >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/pae"
file-path = "packages/lararium-tw5/memes/widgets/pae.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: PaeWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/pae.ts"
source-symbol = "PaeWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/pae-tw5"
body-sha256 = "132e271839e2574b1d00a9b68bd9c638bddb8de441b29ac5c575f2bc16dccd8a"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$pae>` is a phase-marker widget. Carries no visible output — phase metadata lives in the AST.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function PaeWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pae family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pae-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
