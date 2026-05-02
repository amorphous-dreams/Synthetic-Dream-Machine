<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/toml >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/widgets/toml"
file-path = "packages/lararium-tw5/memes/widgets/toml.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: TomlWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/toml.ts"
source-symbol = "TomlWidget"
module-ref    = "lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/toml-tw5"
body-sha256 = "ed82083a46492a0d4c93a43e941435ff08c34bfd3f682917a625439e3003ede9"
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
function TomlWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
TomlWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("script");
  el.setAttribute("type",          "application/toml");
  el.setAttribute("data-lar-kind", "toml");
  el.textContent = this.getAttribute("content", "");
  parent.appendChild(el);
  this.domNodes = [el];
};
TomlWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/toml family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/toml-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
