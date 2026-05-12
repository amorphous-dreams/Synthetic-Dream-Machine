<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/toml >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/toml"
file-path = "packages/lararium-tw5/memes/widgets/toml.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: TomlWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/toml.ts"
source-symbol = "TomlWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/toml-tw5"
body-sha256 = "a849f6d978bdcef8de8677fa484bac0c1c70a3192b065e04d501fce4223c339d"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$toml>` renders a `<script type="application/toml" data-lar-kind="toml">` element. The `content` attribute is the raw TOML string.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function TomlWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/toml family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/toml-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
