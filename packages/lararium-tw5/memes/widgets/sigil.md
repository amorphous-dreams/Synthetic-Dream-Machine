<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/sigil >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/sigil"
file-path = "packages/lararium-tw5/memes/widgets/sigil.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: SigilWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/sigil.ts"
source-symbol = "SigilWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/sigil-tw5"
body-sha256 = "1b825842beea8a3e00d8c4feee19fbbfeb56f2575ab8a36dcb7a0a41467f887f"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$sigil>` renders a `<span data-lar-kind="sigil">` element. `data-lar-sigil` is the parse-tree tag. Renders children inside the span.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function SigilWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/sigil family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/sigil-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
