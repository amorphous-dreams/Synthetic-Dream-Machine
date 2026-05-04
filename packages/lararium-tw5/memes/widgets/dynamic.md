<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/dynamic >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/dynamic"
file-path = "packages/lararium-tw5/memes/widgets/dynamic.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: DynamicWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/dynamic.ts"
source-symbol = "DynamicWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/dynamic-tw5"
body-sha256 = "5beae338d5da165a12ef267fc64b3a85f16597a19f0d5192123458046954f3b2"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$dynamic>` renders a `<span data-lar-kind="dynamic">` element. `data-lar-sigil` is the parse-tree tag. Renders children inside the span. Used for dynamically-resolved sigil forms.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function DynamicWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/dynamic family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/dynamic-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
