<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/lele >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/lele"
file-path = "packages/lararium-tw5/memes/widgets/lele.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: LeleWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/lele.ts"
source-symbol = "LeleWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/lele-tw5"
body-sha256 = "8899582a8999aa95120eff4ee43a1b2a272288cdcb98d0fa54256389c9449210"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$lele>` renders a `<meta data-lar-kind="lele">` element. Carries a `target` attribute pointing to a jump/transclusion target.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function LeleWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/lele family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/lele-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
