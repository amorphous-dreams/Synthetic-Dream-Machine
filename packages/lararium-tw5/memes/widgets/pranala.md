<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pranala >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/pranala"
file-path = "packages/lararium-tw5/memes/widgets/pranala.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: PranalaWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/pranala.ts"
source-symbol = "PranalaWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/pranala-tw5"
body-sha256 = "b00d58b877b14c494b15d219cb456e8c55dd2e00703347d763a26d73753de1c4"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$pranala>` renders a `<meta data-lar-kind="pranala">` element carrying edge fields as data attributes. No visible output. Attributes: `from`, `to`, `family`, `role`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function PranalaWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pranala-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
