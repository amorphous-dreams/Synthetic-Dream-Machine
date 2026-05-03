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
body-sha256 = "adf19c7be25695020e887074244464c00985e6c514af0f65661e084de4d6b3d4"
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
function LeleWidget(this: TW5WidgetInstance, parseTreeNode: TW5ParseTreeNode, options: Record<string, unknown>) {
  this.initialise(parseTreeNode, options);
}
LeleWidget.prototype.render = function (this: TW5WidgetInstance, parent: TW5FakeElement, _nextSibling: TW5FakeElement | null) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "lele");
  el.setAttribute("data-lar-target", this.getAttribute("target", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
LeleWidget.prototype.execute = function (this: TW5WidgetInstance) { this.makeChildWidgets(); };
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-pono ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/lele family:control role:implements >>
<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/lele-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
