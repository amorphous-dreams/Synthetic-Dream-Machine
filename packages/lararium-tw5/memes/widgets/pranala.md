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
body-sha256 = "1008f270a77c24eb777078f9213a9a15e714776e555a63c1dcf4c366b29ad2e6"
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
function PranalaWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
PranalaWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "pranala");
  el.setAttribute("data-lar-from",   this.getAttribute("from", ""));
  el.setAttribute("data-lar-to",     this.getAttribute("to", ""));
  el.setAttribute("data-lar-family", this.getAttribute("family", ""));
  el.setAttribute("data-lar-role",   this.getAttribute("role", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
PranalaWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/pranala family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pranala-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
