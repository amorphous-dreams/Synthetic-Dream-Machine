<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/papalohe >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/papalohe"
file-path = "packages/lararium-tw5/memes/widgets/papalohe.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: PapaloheWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/papalohe.ts"
source-symbol = "PapaloheWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/papalohe-tw5"
body-sha256 = "e92dd8b986640521996b49672dde6081626e0b44c5b9cc8a82ae2372d285dd97"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$papalohe>` renders a `<meta data-lar-kind="papalohe">` element. Encodes a trigger-fn-slot binding for reactive pipeline hooks. Attributes: `from`, `to`, `trigger`, `fn`, `slot`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function PapaloheWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/papalohe family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/papalohe-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
