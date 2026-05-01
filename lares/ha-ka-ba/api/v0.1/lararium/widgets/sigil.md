<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/sigil >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/sigil"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/sigil.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: SigilWidget — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/widgets/sigil.ts"
source-symbol = "SigilWidget"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/widgets/sigil-tw5"
body-sha256 = "235354a9ccdc72dbc7765b32c5b90b5329cfe547a7919af783639eb847b9799d"
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
function SigilWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
SigilWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",  "sigil");
  el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
SigilWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/api/v0.1/pono/sigil family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/sigil-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
