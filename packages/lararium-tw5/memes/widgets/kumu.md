<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kumu >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kumu"
file-path = "packages/lararium-tw5/memes/widgets/kumu.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: KumuWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/kumu.ts"
source-symbol = "KumuWidget"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/widgets/kumu-tw5"
body-sha256 = "7e310613b17e9b72e5553d4f4bc0ee90d909fdf2e3a6da751950ee68a7cc8aa3"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`<$kumu>` resolves a named kumu device by `[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[name]]`, transcluding it with props. Renders a `<div data-lar-kind="kumu">` container; unresolved devices show a `<span data-lar-kind="hole">`. Attributes: `name`, `props`.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function KumuWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/kumu family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kumu-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
