<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kukali >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kukali"
file-path = "packages/lararium-tw5/memes/widgets/kukali.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: KukaliWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/kukali.ts"
source-symbol = "KukaliWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/kukali-tw5"
body-sha256 = "7144a493f6c3e8594654dd1242579032226ddf0d6a34cff37f23d4992a67d033"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$kukali>` renders a `<span data-lar-kind="kukali">` element and wires a reactive hook via `wiki._larKukaliHook`. The hook cancel function is stored on the DOM node. Attribute: `trigger`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function KukaliWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kukali family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kukali-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
